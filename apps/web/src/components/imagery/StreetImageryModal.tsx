'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import { hexaApi } from '@/lib/api-client';
import { useMapStore } from '@/store/map-store';

export function StreetImageryModal() {
  const target = useMapStore((s) => s.streetImageryTarget);
  const setTarget = useMapStore((s) => s.setStreetImageryTarget);
  const [frameIndex, setFrameIndex] = useState(0);

  const imageryQuery = useQuery({
    queryKey: ['street-imagery', target?.lat, target?.lng],
    queryFn: () => hexaApi.lookupStreetImagery({ lat: target!.lat, lng: target!.lng }),
    enabled: Boolean(target),
  });

  if (!target) return null;

  const frames = imageryQuery.data?.frames ?? [];
  const activeFrame = frames[frameIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold">{target.label} — Street-Level Imagery</h3>
              <p className="text-[11px] text-slate-400">
                {target.lat.toFixed(5)}, {target.lng.toFixed(5)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTarget(null)}
            aria-label="Close street imagery"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {imageryQuery.isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Checking nearby Mapillary street-level sequence coverage…
            </div>
          ) : imageryQuery.data?.available && activeFrame ? (
            <div className="space-y-3">
              {activeFrame.thumbUrl ? (
                <img
                  src={activeFrame.thumbUrl}
                  alt={`Street frame ${activeFrame.id}`}
                  className="h-72 w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-60 items-center justify-center rounded-xl bg-slate-950 text-xs text-slate-400">
                  Mapillary Frame #{activeFrame.id} (Heading {Math.round(activeFrame.compassAngle)}°)
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={frameIndex <= 0}
                  onClick={() => setFrameIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 font-semibold disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev Frame
                </button>
                <span className="text-slate-400">
                  Frame {frameIndex + 1} of {frames.length} •{' '}
                  {new Date(activeFrame.capturedAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  disabled={frameIndex >= frames.length - 1}
                  onClick={() => setFrameIndex((i) => Math.min(frames.length - 1, i + 1))}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 font-semibold disabled:opacity-40"
                >
                  Next Frame
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500">{activeFrame.attribution}</p>
            </div>
          ) : (
            <div
              data-testid="imagery-unavailable-state"
              className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center"
            >
              <Info className="mx-auto h-7 w-7 text-amber-400" />
              <h4 className="mt-2 text-sm font-bold">Street-Level Imagery Unavailable Here</h4>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                {imageryQuery.data?.message ||
                  'No licensed street-level imagery sequence is available at this coordinate.'}
              </p>
              <p className="mt-3 text-[10px] text-slate-500">
                Provider integration: Mapillary v4 Graph API & MapillaryJS (`MAPILLARY_ACCESS_TOKEN`).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
