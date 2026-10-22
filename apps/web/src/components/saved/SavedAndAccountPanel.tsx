'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Home,
  Lock,
  MapPin,
  Plus,
  Star,
  Trash2,
  UserCheck,
} from 'lucide-react';
import type { SavedPlaceKind } from '@hexa/shared';
import { hexaApi } from '@/lib/api-client';
import { useMapStore } from '@/store/map-store';

export function SavedAndAccountPanel() {
  const queryClient = useQueryClient();
  const lat = useMapStore((s) => s.lat);
  const lng = useMapStore((s) => s.lng);
  const flyTo = useMapStore((s) => s.flyTo);
  const routeToDestination = useMapStore((s) => s.routeToDestination);
  const user = useMapStore((s) => s.user);
  const setAuthModalOpen = useMapStore((s) => s.setAuthModalOpen);
  const distanceUnit = useMapStore((s) => s.distanceUnit);
  const setDistanceUnit = useMapStore((s) => s.setDistanceUnit);

  const [newLabel, setNewLabel] = useState('');
  const [newKind, setNewKind] = useState<SavedPlaceKind>('favorite');

  const savedQuery = useQuery({
    queryKey: ['saved-places'],
    queryFn: () => hexaApi.listSavedPlaces(),
  });

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => hexaApi.getMe(),
  });

  const saveMutation = useMutation({
    mutationFn: hexaApi.savePlace,
    onSuccess: () => {
      setNewLabel('');
      void queryClient.invalidateQueries({ queryKey: ['saved-places'] });
    },
  });

  const deletePlaceMutation = useMutation({
    mutationFn: hexaApi.deleteSavedPlace,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-places'] });
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: hexaApi.clearSearchHistory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['search-history'] });
    },
  });

  const prefMutation = useMutation({
    mutationFn: hexaApi.updatePreferences,
    onSuccess: (res) => {
      setDistanceUnit(res.preferences.distanceUnit);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const places = savedQuery.data?.places ?? [];

  const handlePinCurrentCenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    saveMutation.mutate({
      kind: newKind,
      label: newLabel.trim(),
      category: 'poi',
      lat,
      lng,
    });
  };

  return (
    <div className="space-y-4" data-testid="saved-places-panel">
      {/* Account Status Card */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
              <UserCheck className="h-4 w-4 text-amber-500" />
              {user ? user.displayName : 'Private Guest Workspace'}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {user
                ? user.email
                : 'Sign in to sync saved places across devices with encrypted session cookies.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="shrink-0 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-amber-400 hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950"
          >
            {user ? 'Account' : 'Sign in'}
          </button>
        </div>
      </div>

      {/* Add Custom Pin / Home / Work at Current Map Center */}
      <form
        onSubmit={handlePinCurrentCenter}
        className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Save Current Map Center ({lat.toFixed(4)}, {lng.toFixed(4)})
        </div>
        <div className="flex gap-1.5">
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as SavedPlaceKind)}
            aria-label="Saved place category"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="favorite">Favorite</option>
            <option value="home">Home</option>
            <option value="work">Work</option>
            <option value="custom_pin">Custom Pin</option>
          </select>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Khorlim Home)"
            data-testid="custom-pin-label-input"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="submit"
            data-testid="add-saved-place-btn"
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </form>

      {/* Saved Places List */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Saved Places ({places.length})
        </div>
        {places.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-800">
            No saved places yet. Save any search result or drop a custom pin above.
          </p>
        ) : (
          places.map((p) => (
            <div
              key={p.id}
              data-testid="saved-place-item"
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => flyTo(p.lat, p.lng, 14)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                {p.kind === 'home' ? (
                  <Home className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : p.kind === 'work' ? (
                  <Briefcase className="h-4 w-4 shrink-0 text-sky-500" />
                ) : p.kind === 'favorite' ? (
                  <Star className="h-4 w-4 shrink-0 text-amber-500" />
                ) : (
                  <MapPin className="h-4 w-4 shrink-0 text-rose-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                    {p.label}
                  </div>
                  <div className="truncate text-[10px] text-slate-500">
                    {p.address || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    routeToDestination({ label: p.label, lat: p.lat, lng: p.lng })
                  }
                  className="rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-500/25 dark:text-amber-300"
                >
                  Route
                </button>
                <button
                  type="button"
                  onClick={() => deletePlaceMutation.mutate(p.id)}
                  aria-label={`Delete ${p.label}`}
                  className="rounded-md p-1 text-slate-400 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preferences & Privacy Controls */}
      <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Lock className="h-3.5 w-3.5 text-amber-500" />
          Units & Privacy Controls
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-300">Distance Units</span>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950">
            {(['metric', 'imperial'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => prefMutation.mutate({ distanceUnit: u })}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                  distanceUnit === u ? 'bg-amber-500 text-slate-950' : 'text-slate-500'
                }`}
              >
                {u === 'metric' ? 'km / m' : 'mi / ft'}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <span>Record search history (30-day retention)</span>
          <input
            type="checkbox"
            checked={meQuery.data?.preferences.saveSearchHistory ?? true}
            onChange={(e) => prefMutation.mutate({ saveSearchHistory: e.target.checked })}
            className="rounded accent-amber-500"
          />
        </label>

        <button
          type="button"
          onClick={() => clearHistoryMutation.mutate()}
          className="w-full rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-950 dark:text-rose-400"
        >
          Clear All Search History
        </button>
      </div>
    </div>
  );
}
