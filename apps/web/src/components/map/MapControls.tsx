'use client';

import React, { useMemo, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import {
  AlertTriangle,
  Bike,
  Compass,
  Layers,
  LocateFixed,
  Minus,
  Plus,
  TrafficCone,
  UserCircle2,
} from 'lucide-react';
import { getMapStyleDescriptors } from '@/lib/map-styles';
import { useMapStore } from '@/store/map-store';

export function MapControls({
  mapRef,
}: {
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
}) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [locatingError, setLocatingError] = useState<string | null>(null);

  const mapStyle = useMapStore((s) => s.mapStyle);
  const setMapStyle = useMapStore((s) => s.setMapStyle);
  const showTrafficOverlay = useMapStore((s) => s.showTrafficOverlay);
  const toggleTrafficOverlay = useMapStore((s) => s.toggleTrafficOverlay);
  const showCyclingOverlay = useMapStore((s) => s.showCyclingOverlay);
  const toggleCyclingOverlay = useMapStore((s) => s.toggleCyclingOverlay);
  const bearing = useMapStore((s) => s.bearing);
  const pitch = useMapStore((s) => s.pitch);
  const flyTo = useMapStore((s) => s.flyTo);
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const user = useMapStore((s) => s.user);
  const setAuthModalOpen = useMapStore((s) => s.setAuthModalOpen);

  const styleDescriptors = useMemo(() => getMapStyleDescriptors(), []);

  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 220 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 220 });

  const handleCompassOrPitch = () => {
    const map = mapRef.current;
    if (!map) return;
    if (Math.abs(bearing) > 2 || pitch > 5) {
      map.easeTo({ bearing: 0, pitch: 0, duration: 350 });
    } else {
      map.easeTo({ pitch: 45, duration: 400 });
    }
  };

  const handleLocateMe = () => {
    setLocatingError(null);
    if (!navigator.geolocation) {
      setLocatingError('Geolocation is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        flyTo(pos.coords.latitude, pos.coords.longitude, 14);
      },
      () => {
        setLocatingError('Location permission denied or unavailable.');
        setTimeout(() => setLocatingError(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  return (
    <>
      {/* Top-Right Quick Pill Bar (Traffic, Cycling, Account) */}
      <div className="pointer-events-auto fixed right-3 top-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTrafficOverlay}
          aria-pressed={showTrafficOverlay || mapStyle === 'traffic'}
          className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur transition sm:flex ${
            showTrafficOverlay || mapStyle === 'traffic'
              ? 'border-amber-500 bg-amber-500 text-slate-950'
              : 'border-slate-200/90 bg-white/95 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200'
          }`}
        >
          <TrafficCone className="h-3.5 w-3.5" />
          Traffic
        </button>

        <button
          type="button"
          onClick={toggleCyclingOverlay}
          aria-pressed={showCyclingOverlay}
          className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur transition sm:flex ${
            showCyclingOverlay
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-slate-200/90 bg-white/95 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200'
          }`}
        >
          <Bike className="h-3.5 w-3.5" />
          Cycling
        </button>

        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          aria-label="Account and settings"
          className="flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md backdrop-blur transition hover:border-amber-400 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
        >
          <UserCircle2 className="h-4 w-4 text-amber-500" />
          <span className="max-w-[110px] truncate">
            {user ? user.displayName : 'Sign in'}
          </span>
        </button>
      </div>

      {locatingError && (
        <div className="pointer-events-none fixed right-3 top-14 z-30 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-amber-300 shadow-lg">
          {locatingError}
        </div>
      )}

      {/* Bottom-Right Map Controls Stack */}
      <div className="pointer-events-auto fixed bottom-20 right-3 z-20 flex flex-col items-end gap-2.5 md:bottom-8">
        {/* Waze-style Floating Report Incident Action */}
        <button
          type="button"
          onClick={() => setActiveTab('incidents')}
          data-testid="fab-report-incident"
          title="Report Road Incident"
          className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-2.5 text-xs font-bold text-slate-950 shadow-lg ring-2 ring-slate-900/10 transition hover:bg-amber-400 active:scale-95"
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="hidden sm:inline">Report</span>
        </button>

        {/* Map Type / Layer Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLayersOpen((o) => !o)}
            data-testid="map-layers-button"
            aria-label="Map styles and layers"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-800 shadow-md backdrop-blur transition hover:border-amber-400 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
          >
            <Layers className="h-5 w-5" />
          </button>

          {layersOpen && (
            <div className="absolute bottom-0 right-12 w-72 rounded-2xl border border-slate-200 bg-white/98 p-3 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/98">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Map Type & Layers
                </span>
                <button
                  type="button"
                  onClick={() => setLayersOpen(false)}
                  className="text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {styleDescriptors.map((desc) => {
                  const active = mapStyle === desc.id;
                  return (
                    <button
                      key={desc.id}
                      type="button"
                      disabled={!desc.available}
                      title={desc.unavailableReason || desc.description}
                      onClick={() => {
                        if (desc.available) {
                          setMapStyle(desc.id);
                        }
                      }}
                      data-testid={`style-option-${desc.id}`}
                      className={`rounded-lg border p-2 text-left transition ${
                        !desc.available
                          ? 'cursor-not-allowed border-dashed border-slate-200 bg-slate-100/70 opacity-60 dark:border-slate-800 dark:bg-slate-950/60'
                          : active
                            ? 'border-amber-500 bg-amber-500/15 text-slate-950 dark:text-amber-300'
                            : 'border-slate-200 hover:border-amber-400 dark:border-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{desc.label}</span>
                        {!desc.available && (
                          <span className="rounded bg-slate-200 px-1 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            No Key
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                        {desc.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Locate Me */}
        <button
          type="button"
          onClick={handleLocateMe}
          aria-label="Center on current location"
          title="Current location"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-800 shadow-md backdrop-blur transition hover:border-amber-400 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
        >
          <LocateFixed className="h-4.5 w-4.5" />
        </button>

        {/* Zoom + / - & Compass / 3D Pitch */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="flex h-9 w-10 items-center justify-center border-b border-slate-200 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="flex h-9 w-10 items-center justify-center border-b border-slate-200 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleCompassOrPitch}
            aria-label="Reset compass orientation or toggle 3D tilt"
            title={pitch > 5 ? 'Reset north & 2D' : 'Toggle 3D tilt'}
            className="flex h-9 w-10 items-center justify-center text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Compass
              className="h-4 w-4 transition-transform"
              style={{ transform: `rotate(${-bearing}deg)` }}
            />
          </button>
        </div>
      </div>
    </>
  );
}
