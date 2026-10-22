'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  Camera,
  Check,
  Clock,
  Copy,
  MapPin,
  Navigation,
  Route,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { hexaApi } from '@/lib/api-client';
import { buildShareableMapUrl } from '@/lib/url-state';
import { useMapStore } from '@/store/map-store';
import { HighwayShieldBadge } from '../shields/HighwayShieldBadge';

const QUICK_SEARCH_CHIPS = [
  { label: 'NH 66', query: 'NH 66' },
  { label: 'Mumbai–Pune Expy', query: 'Mumbai–Pune Expressway' },
  { label: 'Mapusa Bus Stand', query: 'Mapusa Bus Stand' },
  { label: 'Panaji, Goa', query: 'Panaji, Goa' },
  { label: 'Restaurants', query: 'Restaurants near Mapusa' },
  { label: 'I-95 NYC', query: 'Interstate 95' },
];

export function ExplorePanel({ onTriggerSearch }: { onTriggerSearch: (q: string) => void }) {
  const queryClient = useQueryClient();
  const [copiedLink, setCopiedLink] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const searchResults = useMapStore((s) => s.searchResults);
  const selectedPlace = useMapStore((s) => s.selectedPlace);
  const selectPlace = useMapStore((s) => s.selectPlace);
  const inspectedRoad = useMapStore((s) => s.inspectedRoad);
  const setInspectedRoad = useMapStore((s) => s.setInspectedRoad);
  const flyTo = useMapStore((s) => s.flyTo);
  const routeToDestination = useMapStore((s) => s.routeToDestination);
  const setStreetImageryTarget = useMapStore((s) => s.setStreetImageryTarget);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const zoom = useMapStore((s) => s.zoom);

  const theme = mapStyle === 'dark' ? 'dark' : 'light';

  const historyQuery = useQuery({
    queryKey: ['search-history'],
    queryFn: () => hexaApi.listSearchHistory(),
  });

  const savePlaceMutation = useMutation({
    mutationFn: hexaApi.savePlace,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['saved-places'] });
      setSavedFeedback(`Saved to ${vars.kind.toUpperCase()}`);
      setTimeout(() => setSavedFeedback(null), 2500);
    },
  });

  const handleCopyShare = async (lat: number, lng: number) => {
    const url = buildShareableMapUrl({ lat, lng, zoom: Math.max(zoom, 13), style: mapStyle });
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard blocked in some iframe contexts
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Quick Discovery Chips */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_SEARCH_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onTriggerSearch(chip.query)}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-amber-400 hover:bg-amber-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-amber-500/50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Clicked Map Road Classification Inspector */}
      {inspectedRoad && (
        <div
          data-testid="road-inspector-card"
          className="rounded-xl border border-amber-500/40 bg-amber-50/40 p-3.5 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Shield className="h-3.5 w-3.5" />
                Road & Shield Inspector
              </div>
              <h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                {inspectedRoad.name}
              </h3>
              {inspectedRoad.officialDesignation && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {inspectedRoad.officialDesignation}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInspectedRoad(null)}
              aria-label="Close road inspector"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {inspectedRoad.shields.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {inspectedRoad.shields.map((sh) => (
                <HighwayShieldBadge key={sh.spriteId} spriteId={sh.spriteId} scale={0.95} />
              ))}
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {inspectedRoad.classes.map((cls) => (
              <span
                key={cls}
                className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-300"
              >
                {cls.replace(/_/g, ' ')}
              </span>
            ))}
            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {inspectedRoad.lanes} lanes
            </span>
            {inspectedRoad.maxspeed && (
              <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                maxspeed: {inspectedRoad.maxspeed}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                inspectedRoad.confidence === 'verified'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {inspectedRoad.confidence}
            </span>
          </div>
        </div>
      )}

      {/* Selected Place Details Card */}
      {selectedPlace && (
        <div
          data-testid="selected-place-card"
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                {selectedPlace.category.replace(/_/g, ' ')}
              </span>
              <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                {selectedPlace.name}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {selectedPlace.displayName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => selectPlace(null)}
              aria-label="Clear selected place"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {selectedPlace.shields && selectedPlace.shields.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {selectedPlace.shields.map((b) => (
                <HighwayShieldBadge
                  key={`${b.family}-${b.displayRef}`}
                  badge={b}
                  theme={theme}
                  scale={0.9}
                />
              ))}
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {selectedPlace.coordinates.lat.toFixed(5)}, {selectedPlace.coordinates.lng.toFixed(5)}
            </span>
            {selectedPlace.postcode && <span>PIN/ZIP: {selectedPlace.postcode}</span>}
            {selectedPlace.metadata?.population && (
              <span>Pop: {selectedPlace.metadata.population.toLocaleString()}</span>
            )}
            {selectedPlace.metadata?.maxspeed && (
              <span>Speed limit: {selectedPlace.metadata.maxspeed}</span>
            )}
          </div>

          {/* Primary Actions */}
          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="directions-to-place-btn"
              onClick={() =>
                routeToDestination({
                  label: selectedPlace.name,
                  lat: selectedPlace.coordinates.lat,
                  lng: selectedPlace.coordinates.lng,
                })
              }
              className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-amber-400"
            >
              <Navigation className="h-3.5 w-3.5" />
              Directions
            </button>

            <button
              type="button"
              data-testid="save-favorite-place-btn"
              onClick={() =>
                savePlaceMutation.mutate({
                  kind: 'favorite',
                  label: selectedPlace.name,
                  address: selectedPlace.displayName,
                  category: selectedPlace.category,
                  lat: selectedPlace.coordinates.lat,
                  lng: selectedPlace.coordinates.lng,
                })
              }
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:border-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <Bookmark className="h-3.5 w-3.5 text-amber-500" />
              Save Place
            </button>

            <button
              type="button"
              onClick={() =>
                setStreetImageryTarget({
                  lat: selectedPlace.coordinates.lat,
                  lng: selectedPlace.coordinates.lng,
                  label: selectedPlace.name,
                })
              }
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Camera className="h-3.5 w-3.5 text-sky-500" />
              Street Imagery
            </button>

            <button
              type="button"
              onClick={() =>
                void handleCopyShare(selectedPlace.coordinates.lat, selectedPlace.coordinates.lng)
              }
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedLink ? 'Copied URL' : 'Share Link'}
            </button>
          </div>

          {savedFeedback && (
            <div className="mt-2 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {savedFeedback}
            </div>
          )}

          <p className="mt-2.5 text-[10px] text-slate-400">{selectedPlace.attribution}</p>
        </div>
      )}

      {/* Search Results List */}
      {searchResults.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Search Results ({searchResults.length})
          </div>
          {searchResults.map((place) => {
            const isSelected = selectedPlace?.id === place.id;
            return (
              <button
                key={place.id}
                type="button"
                data-testid="search-result-item"
                onClick={() => {
                  selectPlace(place);
                  flyTo(
                    place.coordinates.lat,
                    place.coordinates.lng,
                    place.category === 'expressway' || place.category === 'highway' ? 10 : 13.5,
                  );
                }}
                className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-500/10'
                    : 'border-slate-200/80 bg-white hover:border-amber-300 dark:border-slate-800 dark:bg-slate-900/90'
                }`}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                      {place.name}
                    </span>
                    {place.shields?.slice(0, 2).map((b) => (
                      <HighwayShieldBadge
                        key={`${b.family}-${b.displayRef}`}
                        badge={b}
                        theme={theme}
                        scale={0.68}
                      />
                    ))}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {place.displayName}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Default Welcome & Recent Searches when idle */}
      {!selectedPlace && searchResults.length === 0 && !inspectedRoad && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Explore Goa & International Highways
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Search cities, streets, or highway numbers (`NH 66`, `Mumbai–Pune Expressway`, `I-95`, `A 3`), right-click anywhere on the map to reverse-geocode, or click any highway line to inspect its classification.
            </p>
            <button
              type="button"
              onClick={() => useMapStore.getState().setActiveTab('directions')}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950"
            >
              <Route className="h-3.5 w-3.5" />
              Plan Multi-Stop Route
            </button>
          </div>

          {historyQuery.data && historyQuery.data.items.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                Recent Searches
              </div>
              <div className="space-y-1">
                {historyQuery.data.items.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTriggerSearch(item.query)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <span className="truncate font-medium">{item.query}</span>
                    {item.placeName && (
                      <span className="ml-2 truncate text-[11px] text-slate-400">
                        {item.placeName}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
