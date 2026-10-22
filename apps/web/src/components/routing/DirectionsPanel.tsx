'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowDownUp,
  Bike,
  Bus,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  Footprints,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';
import { formatDistance, formatDuration, type TransportMode } from '@hexa/shared';
import { hexaApi } from '@/lib/api-client';
import { buildShareableMapUrl } from '@/lib/url-state';
import { useMapStore } from '@/store/map-store';
import { HighwayShieldBadge } from '../shields/HighwayShieldBadge';

const TRANSPORT_TABS: Array<{ mode: TransportMode; label: string; icon: React.ReactNode }> = [
  { mode: 'driving', label: 'Drive', icon: <Car className="h-3.5 w-3.5" /> },
  { mode: 'walking', label: 'Walk', icon: <Footprints className="h-3.5 w-3.5" /> },
  { mode: 'cycling', label: 'Cycle', icon: <Bike className="h-3.5 w-3.5" /> },
  { mode: 'transit', label: 'Transit', icon: <Bus className="h-3.5 w-3.5" /> },
];

export function DirectionsPanel() {
  const transportMode = useMapStore((s) => s.transportMode);
  const setTransportMode = useMapStore((s) => s.setTransportMode);
  const avoidTolls = useMapStore((s) => s.avoidTolls);
  const setAvoidTolls = useMapStore((s) => s.setAvoidTolls);
  const waypoints = useMapStore((s) => s.waypoints);
  const setWaypoint = useMapStore((s) => s.setWaypoint);
  const addWaypoint = useMapStore((s) => s.addWaypoint);
  const removeWaypoint = useMapStore((s) => s.removeWaypoint);
  const moveWaypoint = useMapStore((s) => s.moveWaypoint);
  const reverseWaypoints = useMapStore((s) => s.reverseWaypoints);
  const routes = useMapStore((s) => s.routes);
  const selectedRouteIndex = useMapStore((s) => s.selectedRouteIndex);
  const setSelectedRouteIndex = useMapStore((s) => s.setSelectedRouteIndex);
  const isRouting = useMapStore((s) => s.isRouting);
  const routingError = useMapStore((s) => s.routingError);
  const setRoutesResult = useMapStore((s) => s.setRoutesResult);
  const setIsRouting = useMapStore((s) => s.setIsRouting);
  const distanceUnit = useMapStore((s) => s.distanceUnit);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const lat = useMapStore((s) => s.lat);
  const lng = useMapStore((s) => s.lng);
  const zoom = useMapStore((s) => s.zoom);
  const flyTo = useMapStore((s) => s.flyTo);

  const [focusedWpIdx, setFocusedWpIdx] = useState<number | null>(null);
  const [wpSuggestions, setWpSuggestions] = useState<
    Array<{ id: string; name: string; displayName: string; lat: number; lng: number }>
  >([]);
  const [sharedCopied, setSharedCopied] = useState(false);

  const theme = mapStyle === 'dark' ? 'dark' : 'light';

  const triggerRouteCalculation = async () => {
    const resolved = waypoints.filter((w) => w.lat !== null && w.lng !== null);
    if (resolved.length < 2) {
      setRoutesResult([], 'Select at least an origin and destination from suggestions.');
      return;
    }

    setIsRouting(true);
    try {
      const res = await hexaApi.calculateRoutes({
        waypoints: resolved.map((w) => ({
          lat: w.lat!,
          lng: w.lng!,
          label: w.label,
        })),
        mode: transportMode,
        alternatives: true,
        avoidTolls,
      });
      setRoutesResult(res.routes, null);
    } catch (err) {
      setRoutesResult([], err instanceof Error ? err.message : 'Route calculation failed.');
    }
  };

  // Auto-calculate whenever mode, avoidTolls, or resolved waypoint coordinates change
  const wpSignature = waypoints.map((w) => `${w.lat ?? 'x'},${w.lng ?? 'x'}`).join('|');
  useEffect(() => {
    const ready = waypoints.filter((w) => w.lat !== null && w.lng !== null);
    if (ready.length >= 2) {
      void triggerRouteCalculation();
    }
  }, [transportMode, avoidTolls, wpSignature]);

  const handleWaypointTyping = async (idx: number, text: string) => {
    setWaypoint(idx, { label: text, lat: null, lng: null });
    setFocusedWpIdx(idx);
    if (text.trim().length < 2) {
      setWpSuggestions([]);
      return;
    }
    try {
      const res = await hexaApi.searchPlaces({ q: text, lat, lng, limit: 5 });
      setWpSuggestions(
        res.results.map((p) => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          lat: p.coordinates.lat,
          lng: p.coordinates.lng,
        })),
      );
    } catch {
      setWpSuggestions([]);
    }
  };

  const activeRoute = routes[selectedRouteIndex];

  const handleShareRoute = async () => {
    const valid = waypoints
      .filter((w) => w.lat !== null && w.lng !== null)
      .map((w) => ({ lat: w.lat!, lng: w.lng!, label: w.label }));
    const url = buildShareableMapUrl({ lat, lng, zoom, style: mapStyle, waypoints: valid });
    try {
      await navigator.clipboard.writeText(url);
      setSharedCopied(true);
      setTimeout(() => setSharedCopied(false), 2000);
    } catch {
      // Ignore clipboard restriction
    }
  };

  return (
    <div className="space-y-3.5" data-testid="directions-panel">
      {/* Transport Mode Switcher */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
        {TRANSPORT_TABS.map((t) => {
          const active = transportMode === t.mode;
          return (
            <button
              key={t.mode}
              type="button"
              data-testid={`mode-btn-${t.mode}`}
              onClick={() => setTransportMode(t.mode)}
              className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Multi-Stop Waypoint Inputs */}
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/70">
        {waypoints.map((wp, idx) => {
          const isOrigin = idx === 0;
          const isDest = idx === waypoints.length - 1;
          return (
            <div key={wp.id} className="relative flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  isOrigin ? 'bg-emerald-500' : isDest ? 'bg-rose-500' : 'bg-amber-500'
                }`}
              />
              <input
                type="text"
                value={wp.label}
                onChange={(e) => void handleWaypointTyping(idx, e.target.value)}
                onFocus={() => setFocusedWpIdx(idx)}
                placeholder={isOrigin ? 'Choose starting point' : isDest ? 'Choose destination' : 'Intermediate stop'}
                aria-label={isOrigin ? 'Origin' : isDest ? 'Destination' : `Stop ${idx}`}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {waypoints.length > 2 && (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveWaypoint(idx, -1)}
                    aria-label="Move stop up"
                    className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isDest}
                    onClick={() => moveWaypoint(idx, 1)}
                    aria-label="Move stop down"
                    className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeWaypoint(idx)}
                    aria-label="Remove stop"
                    className="rounded p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Autocomplete dropdown for active waypoint */}
              {focusedWpIdx === idx && wpSuggestions.length > 0 && (
                <div className="absolute left-4 right-0 top-9 z-30 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  {wpSuggestions.map((sug) => (
                    <button
                      key={sug.id}
                      type="button"
                      onClick={() => {
                        setWaypoint(idx, { label: sug.name, lat: sug.lat, lng: sug.lng });
                        setWpSuggestions([]);
                        setFocusedWpIdx(null);
                      }}
                      className="block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-amber-50 dark:hover:bg-slate-800"
                    >
                      <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {sug.name}
                      </div>
                      <div className="truncate text-[10px] text-slate-500">{sug.displayName}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-2">
            {waypoints.length < 6 && (
              <button
                type="button"
                onClick={addWaypoint}
                className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:text-amber-500 dark:text-amber-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add stop
              </button>
            )}
            <button
              type="button"
              onClick={reverseWaypoints}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
              Reverse
            </button>
          </div>

          <label className="flex cursor-pointer items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={avoidTolls}
              onChange={(e) => setAvoidTolls(e.target.checked)}
              className="rounded accent-amber-500"
            />
            Avoid tolls
          </label>
        </div>
      </div>

      {/* Calculate / Share Row */}
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="calculate-route-btn"
          onClick={() => void triggerRouteCalculation()}
          disabled={isRouting}
          className="flex-1 rounded-xl bg-amber-500 py-2 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:opacity-60"
        >
          {isRouting ? 'Calculating Route…' : 'Calculate Route'}
        </button>
        <button
          type="button"
          onClick={() => void handleShareRoute()}
          title="Copy shareable route URL"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {sharedCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
          {sharedCopied ? 'Copied' : 'Share'}
        </button>
      </div>

      {routingError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300"
        >
          {routingError}
        </div>
      )}

      {/* Route Alternatives Cards */}
      {routes.length > 0 && (
        <div className="space-y-2" data-testid="route-alternatives-list">
          {routes.map((route, idx) => {
            const selected = idx === selectedRouteIndex;
            const etaTime = new Date(route.estimatedArrivalIso).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => setSelectedRouteIndex(idx)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selected
                    ? 'border-amber-500 bg-amber-50/70 shadow-sm dark:bg-amber-500/10'
                    : 'border-slate-200 bg-white hover:border-amber-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {formatDuration(route.durationSeconds)}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {formatDistance(route.distanceMeters, distanceUnit)} • ETA {etaTime}
                  </span>
                </div>
                <div className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  {route.summary}
                </div>
                {route.shields.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {route.shields.map((b) => (
                      <HighwayShieldBadge
                        key={`${b.family}-${b.displayRef}`}
                        badge={b}
                        theme={theme}
                        scale={0.78}
                      />
                    ))}
                    {route.hasTolls && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                        TOLL
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Turn-by-Turn Step Instructions */}
      {activeRoute && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Turn-by-Turn Directions ({activeRoute.steps.length} steps)
            </h3>
            <span className="text-[10px] text-slate-400">{activeRoute.provider}</span>
          </div>

          {activeRoute.warnings.map((w) => (
            <div
              key={w}
              className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300"
            >
              {w}
            </div>
          ))}

          <ol className="divide-y divide-slate-100 dark:divide-slate-800" data-testid="turn-by-turn-steps">
            {activeRoute.steps.map((step) => (
              <li key={step.index} className="py-2.5 first:pt-1 last:pb-0">
                <button
                  type="button"
                  onClick={() => flyTo(step.location.lat, step.location.lng, 14)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {step.instruction}
                    </div>
                    {step.shields.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {step.shields.map((b) => (
                          <HighwayShieldBadge
                            key={`${b.family}-${b.displayRef}`}
                            badge={b}
                            theme={theme}
                            scale={0.74}
                          />
                        ))}
                      </div>
                    )}
                    {step.transit && (
                      <div className="mt-1 rounded-md bg-sky-500/10 px-2 py-1 text-[11px] text-sky-800 dark:text-sky-300">
                        <span className="font-bold">{step.transit.lineShortName || step.transit.lineName}</span>{' '}
                        • {step.transit.departureStop} → {step.transit.arrivalStop} (
                        {step.transit.stopCount} stops)
                      </div>
                    )}
                  </div>
                  {step.distanceMeters > 0 && (
                    <span className="shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {formatDistance(step.distanceMeters, distanceUnit)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>

          <p className="pt-1 text-[10px] text-slate-400">{activeRoute.attribution}</p>
        </div>
      )}
    </div>
  );
}
