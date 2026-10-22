'use client';

import React, { useMemo, useState } from 'react';
import { classifyRoad, type ShieldFamily } from '@hexa/shields';
import { Compass, ShieldCheck, Sparkles } from 'lucide-react';
import { HighwayShieldBadge } from './HighwayShieldBadge';
import { useMapStore } from '@/store/map-store';

const SHOWCASE_SHIELDS: Array<{
  label: string;
  country: string;
  family: ShieldFamily;
  header?: string;
  code: string;
  flyLat: number;
  flyLng: number;
  flyZoom: number;
}> = [
  { label: 'India National Hwy', country: 'India', family: 'IN_NH', header: 'NH', code: '66', flyLat: 15.5335, flyLng: 73.8286, flyZoom: 11.5 },
  { label: 'India Expressway', country: 'India', family: 'IN_EXPRESSWAY', header: 'EXPWY', code: 'MPEW', flyLat: 18.781, flyLng: 73.3321, flyZoom: 10 },
  { label: 'Delhi–Mumbai NE 4', country: 'India', family: 'IN_EXPRESSWAY', header: 'NE', code: '4', flyLat: 25.18, flyLng: 75.8648, flyZoom: 6.5 },
  { label: 'Goa State Highway', country: 'India (Goa)', family: 'IN_SH', header: 'GA SH', code: '1', flyLat: 15.5688, flyLng: 73.7915, flyZoom: 12.5 },
  { label: 'Asian Highway', country: 'UNESCAP Intl', family: 'INT_AH', code: 'AH47', flyLat: 18.5204, flyLng: 73.8567, flyZoom: 8 },
  { label: 'European E-Road', country: 'UNECE Intl', family: 'INT_E', code: 'E 45', flyLat: 49.4521, flyLng: 11.0767, flyZoom: 7.5 },
  { label: 'US Interstate', country: 'United States', family: 'US_I', code: '95', flyLat: 40.79, flyLng: -74.02, flyZoom: 10 },
  { label: 'US Numbered Hwy', country: 'United States', family: 'US_US', code: '1', flyLat: 40.7357, flyLng: -74.1724, flyZoom: 10 },
  { label: 'UK Motorway', country: 'United Kingdom', family: 'GB_M', code: 'M25', flyLat: 51.472, flyLng: -0.485, flyZoom: 9.5 },
  { label: 'UK Primary A-Road', country: 'United Kingdom', family: 'GB_A', code: 'A40', flyLat: 51.515, flyLng: -0.22, flyZoom: 11 },
  { label: 'German Autobahn', country: 'Germany', family: 'DE_A', code: 'A 3', flyLat: 49.7913, flyLng: 9.9534, flyZoom: 8 },
  { label: 'German Bundesstraße', country: 'Germany', family: 'DE_B', code: 'B 2', flyLat: 48.3705, flyLng: 10.8978, flyZoom: 8.5 },
  { label: 'Japan Route Onigiri', country: 'Japan', family: 'JP_R', code: '1', flyLat: 35.4437, flyLng: 139.638, flyZoom: 9.5 },
  { label: 'Malaysia Hexagon', country: 'Malaysia', family: 'MY_E', code: 'E1', flyLat: 4.5975, flyLng: 101.0901, flyZoom: 7.5 },
  { label: 'South Africa Pentagon', country: 'South Africa', family: 'ZA_N', code: 'N1', flyLat: -33.87, flyLng: 18.65, flyZoom: 10 },
  { label: 'Canada Trans-Canada', country: 'Canada', family: 'CA_TCH', header: 'TCH', code: '1', flyLat: 43.76, flyLng: -79.3832, flyZoom: 9.5 },
  { label: 'Brazil Federal BR', country: 'Brazil', family: 'BR_FED', header: 'BR', code: '116', flyLat: -23.2237, flyLng: -45.8872, flyZoom: 8 },
  { label: 'Australia Motorway', country: 'Australia', family: 'AU_M', code: 'M1', flyLat: -33.8688, flyLng: 151.2093, flyZoom: 9 },
];

export function ShieldLabPanel() {
  const flyTo = useMapStore((s) => s.flyTo);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const showShieldsOnMap = useMapStore((s) => s.showShieldsOnMap);
  const setShowShieldsOnMap = useMapStore((s) => s.setShowShieldsOnMap);

  const [testRef, setTestRef] = useState('NH 48;AH47');
  const [testNetwork, setTestNetwork] = useState('IN:NH;AsianHighway');
  const [testCountry, setTestCountry] = useState('IN');
  const [testHighway, setTestHighway] = useState('trunk');
  const [testToll, setTestToll] = useState(true);

  const theme = mapStyle === 'dark' ? 'dark' : 'light';

  const liveClassified = useMemo(
    () =>
      classifyRoad(
        {
          ref: testRef,
          network: testNetwork,
          countryCode: testCountry || undefined,
          highway: testHighway,
          toll: testToll ? 'yes' : 'no',
        },
        theme,
      ),
    [testRef, testNetwork, testCountry, testHighway, testToll, theme],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              International Highway Shield System
            </h2>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showShieldsOnMap}
              onChange={(e) => setShowShieldsOnMap(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-amber-500"
            />
            Show on map
          </label>
        </div>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Tap any shield below to fly directly to its live corridor on the map, or click any highway line on the map to inspect its OSM tags.
        </p>
      </div>

      {/* Global Shield Gallery Grid */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Country & Corridor Gallery (Click to Fly)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {SHOWCASE_SHIELDS.map((item) => (
            <button
              key={`${item.family}-${item.code}`}
              type="button"
              onClick={() => flyTo(item.flyLat, item.flyLng, item.flyZoom)}
              className="group flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white/90 p-2 text-left transition hover:border-amber-400 hover:bg-amber-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-amber-500/60 dark:hover:bg-slate-800"
            >
              <div className="flex h-10 w-12 shrink-0 items-center justify-center">
                <HighwayShieldBadge
                  family={item.family}
                  header={item.header}
                  code={item.code}
                  theme={theme}
                  scale={0.85}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-900 group-hover:text-amber-600 dark:text-slate-100 dark:group-hover:text-amber-400">
                  {item.label}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <Compass className="h-3 w-3 shrink-0" />
                  <span className="truncate">{item.country}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Live OSM Tag Normalizer & Classifier Playground */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Live OSM Road Reference Tester
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="block">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">OSM ref=</span>
            <input
              type="text"
              value={testRef}
              onChange={(e) => setTestRef(e.target.value)}
              placeholder="e.g. NH 66;AH47"
              className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">OSM network=</span>
            <input
              type="text"
              value={testNetwork}
              onChange={(e) => setTestNetwork(e.target.value)}
              placeholder="e.g. IN:NH"
              className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">ISO Country</span>
            <input
              type="text"
              maxLength={2}
              value={testCountry}
              onChange={(e) => setTestCountry(e.target.value.toUpperCase())}
              placeholder="IN, US, DE, JP..."
              className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">OSM highway=</span>
            <select
              value={testHighway}
              onChange={(e) => setTestHighway(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="motorway">motorway</option>
              <option value="trunk">trunk</option>
              <option value="primary">primary</option>
              <option value="secondary">secondary</option>
              <option value="residential">residential</option>
            </select>
          </label>
        </div>

        <label className="mt-2 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={testToll}
            onChange={(e) => setTestToll(e.target.checked)}
            className="rounded accent-amber-500"
          />
          Toll road (`toll=yes`)
        </label>

        {/* Live Output */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center gap-2">
            {liveClassified.shields.length > 0 ? (
              liveClassified.shields.map((sh) => (
                <HighwayShieldBadge key={sh.spriteId} spriteId={sh.spriteId} scale={0.95} />
              ))
            ) : (
              <span className="text-xs italic text-slate-400">No route shields (unnumbered road)</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {liveClassified.classes.map((cls) => (
              <span
                key={cls}
                className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300"
              >
                {cls}
              </span>
            ))}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                liveClassified.confidence === 'verified'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {liveClassified.confidence} ({liveClassified.source})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
