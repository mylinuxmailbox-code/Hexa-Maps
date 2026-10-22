'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Radio,
  ShieldAlert,
  ThumbsUp,
} from 'lucide-react';
import type { IncidentCategory, IncidentSeverity } from '@hexa/shared';
import { hexaApi } from '@/lib/api-client';
import { useMapStore } from '@/store/map-store';

const INCIDENT_CATEGORIES: Array<{ id: IncidentCategory; label: string }> = [
  { id: 'accident', label: 'Accident' },
  { id: 'congestion', label: 'Traffic Jam' },
  { id: 'road_closure', label: 'Road Closure' },
  { id: 'construction', label: 'Construction' },
  { id: 'flooding', label: 'Flooding' },
  { id: 'road_hazard', label: 'Road Hazard' },
  { id: 'broken_down_vehicle', label: 'Broken Vehicle' },
  { id: 'obstruction', label: 'Obstruction' },
  { id: 'temporary_restriction', label: 'Restriction' },
];

export function IncidentsPanel({ onIncidentMutated }: { onIncidentMutated: () => void }) {
  const lat = useMapStore((s) => s.lat);
  const lng = useMapStore((s) => s.lng);
  const flyTo = useMapStore((s) => s.flyTo);
  const incidents = useMapStore((s) => s.incidents);
  const upsertIncidentRealtime = useMapStore((s) => s.upsertIncidentRealtime);
  const socketConnected = useMapStore((s) => s.socketConnected);
  const pickingIncidentLocation = useMapStore((s) => s.pickingIncidentLocation);
  const setPickingIncidentLocation = useMapStore((s) => s.setPickingIncidentLocation);
  const pendingIncidentCoords = useMapStore((s) => s.pendingIncidentCoords);
  const setPendingIncidentCoords = useMapStore((s) => s.setPendingIncidentCoords);

  const [category, setCategory] = useState<IncidentCategory>('accident');
  const [severity, setSeverity] = useState<IncidentSeverity>('moderate');
  const [roadName, setRoadName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const reportLat = pendingIncidentCoords?.lat ?? lat;
  const reportLng = pendingIncidentCoords?.lng ?? lng;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusBanner(null);
    try {
      const res = await hexaApi.createIncident({
        category,
        severity,
        roadName: roadName.trim() || undefined,
        description: description.trim() || undefined,
        lat: reportLat,
        lng: reportLng,
      });
      upsertIncidentRealtime(res.incident);
      setDescription('');
      setRoadName('');
      setPendingIncidentCoords(null);
      setStatusBanner(
        res.mergedDuplicate
          ? 'Confirmed existing nearby report within 150m!'
          : 'Community incident submitted and broadcast live!',
      );
      onIncidentMutated();
    } catch (err) {
      setStatusBanner(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (id: string, vote: 'confirm' | 'resolved') => {
    try {
      const res = await hexaApi.voteIncident(id, vote);
      upsertIncidentRealtime(res.incident);
      onIncidentMutated();
    } catch {
      // Ignore vote error
    }
  };

  return (
    <div className="space-y-4" data-testid="incidents-panel">
      {/* Live Socket.IO Regional Feed Status */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
          <Radio
            className={`h-4 w-4 ${socketConnected ? 'text-emerald-500' : 'text-amber-500'}`}
          />
          <span>{socketConnected ? 'Live Regional Feed Connected' : 'Regional Polling Active'}</span>
        </div>
        <span className="text-[11px] text-slate-500">{incidents.length} active</span>
      </div>

      {/* Waze-Style Incident Submission Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Report Road Incident
          </h2>
          <button
            type="button"
            onClick={() => setPickingIncidentLocation(!pickingIncidentLocation)}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
              pickingIncidentLocation
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Crosshair className="h-3 w-3" />
            {pickingIncidentLocation ? 'Click map now…' : 'Pick on map'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {INCIDENT_CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                data-testid={`incident-cat-${c.id}`}
                onClick={() => setCategory(c.id)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? 'border-amber-500 bg-amber-500/20 text-slate-950 dark:text-amber-300'
                    : 'border-slate-200 text-slate-600 hover:border-amber-300 dark:border-slate-800 dark:text-slate-300'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={roadName}
            onChange={(e) => setRoadName(e.target.value)}
            placeholder="Road / Highway (e.g. NH 66)"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
            aria-label="Incident severity"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="low">Low severity</option>
            <option value="moderate">Moderate</option>
            <option value="high">High severity</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details (lane blocked, detour, etc.)"
          data-testid="incident-description-input"
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Pin: {reportLat.toFixed(4)}, {reportLng.toFixed(4)}
          </span>
          <span className="italic">Marked as Community Report</span>
        </div>

        <button
          type="submit"
          data-testid="submit-incident-btn"
          disabled={submitting}
          className="w-full rounded-xl bg-amber-500 py-2 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Community Report'}
        </button>

        {statusBanner && (
          <div className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
            {statusBanner}
          </div>
        )}
      </form>

      {/* Active Nearby Incidents List */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Nearby Road Advisories & Reports
        </div>
        {incidents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-800">
            No active incidents reported in this viewport.
          </p>
        ) : (
          incidents.map((inc) => {
            const isOfficial = inc.verificationSource === 'official';
            return (
              <div
                key={inc.id}
                data-testid="incident-list-item"
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => flyTo(inc.coordinates.lat, inc.coordinates.lng, 13.5)}
                    className="text-left"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isOfficial ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                          <ShieldAlert className="h-3 w-3" />
                          Official Advisory
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-3 w-3" />
                          Community Report
                        </span>
                      )}
                      {inc.roadName && (
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {inc.roadName}
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                      {inc.title}
                    </h4>
                    {inc.description && (
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                        {inc.description}
                      </p>
                    )}
                  </button>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800">
                  <span className="text-slate-500">
                    {inc.confirmationsCount} confirmed
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleVote(inc.id, 'confirm')}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-700 hover:bg-amber-100 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <ThumbsUp className="h-3 w-3" />
                      Still there
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleVote(inc.id, 'resolved')}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-700 hover:bg-emerald-100 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Cleared
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
