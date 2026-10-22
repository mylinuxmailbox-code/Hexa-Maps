'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DownloadCloud, HardDrive, Trash2, Wifi, WifiOff, XCircle } from 'lucide-react';
import { enumerateTilesForBbox, type OfflineRegionRecord } from '@hexa/shared';
import {
  downloadOfflineRegionTiles,
  getStorageEstimate,
  listLocalOfflineRegions,
  removeLocalOfflineRegion,
  type DownloadRegionProgress,
} from '@/lib/offline-db';
import { hexaApi } from '@/lib/api-client';
import { useMapStore } from '@/store/map-store';

export function OfflineMapsPanel() {
  const bbox = useMapStore((s) => s.bbox);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const isOnline = useMapStore((s) => s.isOnline);
  const flyTo = useMapStore((s) => s.flyTo);

  const [regionName, setRegionName] = useState('North Goa (Mapusa – Panaji)');
  const [regions, setRegions] = useState<OfflineRegionRecord[]>([]);
  const [storage, setStorage] = useState<{ usageBytes: number; quotaBytes: number; supported: boolean }>({
    usageBytes: 0,
    quotaBytes: 0,
    supported: false,
  });
  const [progress, setProgress] = useState<DownloadRegionProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshLocalState = async () => {
    const [localList, est] = await Promise.all([listLocalOfflineRegions(), getStorageEstimate()]);
    setRegions(localList);
    setStorage(est);
  };

  useEffect(() => {
    void refreshLocalState();
  }, []);

  const previewTiles = enumerateTilesForBbox(bbox, 6, 11, 320);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regionName.trim()) return;
    setErrorMsg(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const localRecord = await downloadOfflineRegionTiles({
        id: `off-local-${Date.now()}`,
        name: regionName.trim(),
        bbox,
        minZoom: 6,
        maxZoom: 11,
        styleId: mapStyle,
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      });

      // Best-effort sync metadata with backend PostgreSQL table
      await hexaApi
        .saveOfflineRegionMetadata({
          name: localRecord.name,
          bbox: localRecord.bbox,
          minZoom: localRecord.minZoom,
          maxZoom: localRecord.maxZoom,
          tileCount: localRecord.tileCount,
          estimatedBytes: localRecord.estimatedBytes,
          styleId: localRecord.styleId,
        })
        .catch(() => null);

      setProgress(null);
      await refreshLocalState();
    } catch (err) {
      setProgress(null);
      if ((err as { name?: string })?.name === 'AbortError') {
        setErrorMsg('Download cancelled by user.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Offline download failed.');
      }
    } finally {
      abortRef.current = null;
    }
  };

  const handleDelete = async (id: string) => {
    await removeLocalOfflineRegion(id);
    await refreshLocalState();
  };

  return (
    <div className="space-y-4" data-testid="offline-maps-panel">
      {/* Network & Capability Clarity Banner */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-emerald-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-amber-500" />
          )}
          <span>{isOnline ? 'Online — PWA Ready' : 'Offline Mode Active'}</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
          <strong>Offline Map Viewing:</strong> Cached vector tiles (`.pbf`) and glyphs are stored in IndexedDB & Service Worker Cache Storage for full offline panning/zooming.{' '}
          <strong>Offline Route Calculation:</strong> Requires an active backend/local routing connection; Hexa Maps does not claim client-only browser WASM routing when disconnected from the server.
        </p>
      </div>

      {/* Storage Estimate */}
      {storage.supported && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
            <HardDrive className="h-4 w-4 text-amber-500" />
            Browser Cache Usage
          </span>
          <span className="text-[11px] text-slate-500">
            {(storage.usageBytes / 1024 / 1024).toFixed(1)} MB used
          </span>
        </div>
      )}

      {/* Download Current Viewport Form */}
      <form
        onSubmit={handleDownload}
        className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
          Download Current Viewport Region
        </div>
        <input
          type="text"
          value={regionName}
          onChange={(e) => setRegionName(e.target.value)}
          placeholder="Region name"
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <div className="text-[11px] text-slate-500">
          Zoom 6–11 • {previewTiles.length} vector tiles in current bounds
        </div>

        {progress ? (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{
                  width: `${Math.round((progress.completedTiles / Math.max(1, progress.totalTiles)) * 100)}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span>
                {progress.completedTiles}/{progress.totalTiles} tiles (
                {(progress.bytesDownloaded / 1024).toFixed(0)} KB)
              </span>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="inline-flex items-center gap-1 font-semibold text-rose-600"
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="submit"
            data-testid="download-offline-region-btn"
            disabled={!isOnline}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            <DownloadCloud className="h-4 w-4" />
            Download Offline Map Tiles
          </button>
        )}

        {errorMsg && (
          <div className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400">
            {errorMsg}
          </div>
        )}
      </form>

      {/* Downloaded Regions List */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Saved Offline Regions ({regions.length})
        </div>
        {regions.map((r) => {
          const midLat = (r.bbox[1] + r.bbox[3]) / 2;
          const midLng = (r.bbox[0] + r.bbox[2]) / 2;
          return (
            <div
              key={r.id}
              data-testid="offline-region-item"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => flyTo(midLat, midLng, 10)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                  {r.name}
                </div>
                <div className="text-[10px] text-slate-500">
                  {r.tileCount} tiles • {(r.estimatedBytes / 1024).toFixed(0)} KB • z{r.minZoom}–
                  {r.maxZoom}
                </div>
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(r.id)}
                aria-label={`Delete offline region ${r.name}`}
                className="rounded-md p-1.5 text-slate-400 hover:text-rose-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
