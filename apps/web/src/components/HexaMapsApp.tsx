'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { useQuery } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  AlertTriangle,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  DownloadCloud,
  Moon,
  Navigation2,
  Search,
  Shield,
  Sun,
  WifiOff,
  X,
} from 'lucide-react';
import type { GeocodingPlace, IncidentRecord } from '@hexa/shared';
import { hexaApi } from '@/lib/api-client';
import { parseMapUrlState } from '@/lib/url-state';
import { useMapStore, type SidebarTab } from '@/store/map-store';
import { HexaLogoMark } from './brand/HexaLogo';
import { MapCanvas } from './map/MapCanvas';
import { MapControls } from './map/MapControls';
import { ExplorePanel } from './search/ExplorePanel';
import { DirectionsPanel } from './routing/DirectionsPanel';
import { ShieldLabPanel } from './shields/ShieldLabPanel';
import { IncidentsPanel } from './incidents/IncidentsPanel';
import { SavedAndAccountPanel } from './saved/SavedAndAccountPanel';
import { OfflineMapsPanel } from './offline/OfflineMapsPanel';
import { AuthModal } from './auth/AuthModal';
import { StreetImageryModal } from './imagery/StreetImageryModal';
import { HighwayShieldBadge } from './shields/HighwayShieldBadge';

const SIDEBAR_TABS: Array<{ id: SidebarTab; label: string; icon: React.ReactNode }> = [
  { id: 'explore', label: 'Explore', icon: <Compass className="h-4 w-4" /> },
  { id: 'directions', label: 'Route', icon: <Navigation2 className="h-4 w-4" /> },
  { id: 'shields', label: 'Shields', icon: <Shield className="h-4 w-4" /> },
  { id: 'incidents', label: 'Reports', icon: <AlertTriangle className="h-4 w-4" /> },
  { id: 'saved', label: 'Saved', icon: <Bookmark className="h-4 w-4" /> },
  { id: 'offline', label: 'Offline', icon: <DownloadCloud className="h-4 w-4" /> },
];

export function HexaMapsApp() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const lat = useMapStore((s) => s.lat);
  const lng = useMapStore((s) => s.lng);
  const zoom = useMapStore((s) => s.zoom);
  const bbox = useMapStore((s) => s.bbox);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const setMapStyle = useMapStore((s) => s.setMapStyle);
  const showTrafficOverlay = useMapStore((s) => s.showTrafficOverlay);
  const sidebarOpen = useMapStore((s) => s.sidebarOpen);
  const setSidebarOpen = useMapStore((s) => s.setSidebarOpen);
  const activeTab = useMapStore((s) => s.activeTab);
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const mobileSheetExpanded = useMapStore((s) => s.mobileSheetExpanded);
  const setMobileSheetExpanded = useMapStore((s) => s.setMobileSheetExpanded);
  const searchQuery = useMapStore((s) => s.searchQuery);
  const setSearchQuery = useMapStore((s) => s.setSearchQuery);
  const setSearchResults = useMapStore((s) => s.setSearchResults);
  const selectPlace = useMapStore((s) => s.selectPlace);
  const flyTo = useMapStore((s) => s.flyTo);
  const setIncidents = useMapStore((s) => s.setIncidents);
  const upsertIncidentRealtime = useMapStore((s) => s.upsertIncidentRealtime);
  const setSocketConnected = useMapStore((s) => s.setSocketConnected);
  const setUser = useMapStore((s) => s.setUser);
  const applyPreferences = useMapStore((s) => s.applyPreferences);
  const isOnline = useMapStore((s) => s.isOnline);
  const setIsOnline = useMapStore((s) => s.setIsOnline);

  const [suggestions, setSuggestions] = useState<GeocodingPlace[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const isDark = mapStyle === 'dark';

  // Apply Tailwind dark class at document root when Dark map style is selected
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Parse initial URL state, register PWA Service Worker, and load user profile
  useEffect(() => {
    const parsed = parseMapUrlState(window.location.search);
    if (parsed.lat !== undefined && parsed.lng !== undefined) {
      useMapStore.getState().setViewport({
        lat: parsed.lat,
        lng: parsed.lng,
        zoom: parsed.zoom ?? 12,
      });
      flyTo(parsed.lat, parsed.lng, parsed.zoom ?? 12);
    }
    if (parsed.style) {
      setMapStyle(parsed.style);
    }
    if (parsed.originCoords && parsed.destCoords) {
      useMapStore.getState().setWaypoint(0, {
        label: parsed.originCoords.label || 'Origin',
        lat: parsed.originCoords.lat,
        lng: parsed.originCoords.lng,
      });
      useMapStore.getState().setWaypoint(1, {
        label: parsed.destCoords.label || 'Destination',
        lat: parsed.destCoords.lat,
        lng: parsed.destCoords.lng,
      });
      setActiveTab('directions');
    }

    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    hexaApi
      .getMe()
      .then((res) => {
        setUser(res.user);
        if (!parsed.style) {
          applyPreferences(res.preferences);
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Keep URL coordinates & zoom synchronized without page navigation
  useEffect(() => {
    const timer = setTimeout(() => {
      const sp = new URLSearchParams(window.location.search);
      sp.set('at', `${lat.toFixed(4)},${lng.toFixed(4)},${zoom.toFixed(1)}z`);
      if (mapStyle !== 'standard') sp.set('style', mapStyle);
      else sp.delete('style');
      window.history.replaceState(null, '', `/?${sp.toString()}`);
    }, 350);
    return () => clearTimeout(timer);
  }, [lat, lng, zoom, mapStyle]);

  // Connect Socket.IO via relative path `/api/socket.io` for live regional incident broadcasts
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  useEffect(() => {
    const socket = io({
      path: '/api/socket.io',
      addTrailingSlash: false,
      transports: ['polling', 'websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('viewport:subscribe', { bbox: useMapStore.getState().bbox });
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('incident:created', (inc: IncidentRecord) => upsertIncidentRealtime(inc));
    socket.on('incident:updated', (inc: IncidentRecord) => upsertIncidentRealtime(inc));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [setSocketConnected, upsertIncidentRealtime]);

  useEffect(() => {
    socketRef.current?.emit('viewport:subscribe', { bbox });
  }, [bbox]);

  // Fetch nearby incidents for current viewport
  const incidentsQuery = useQuery({
    queryKey: ['incidents', Math.round(lat * 4), Math.round(lng * 4)],
    queryFn: () => hexaApi.listIncidents({ lat, lng }),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (incidentsQuery.data?.incidents) {
      setIncidents(incidentsQuery.data.incidents);
    }
  }, [incidentsQuery.data, setIncidents]);

  // Fetch Traffic segments when Traffic overlay or Traffic map style is enabled
  const trafficActive = showTrafficOverlay || mapStyle === 'traffic';
  const trafficQuery = useQuery({
    queryKey: ['traffic', Math.round(bbox[0] * 2), Math.round(bbox[1] * 2)],
    queryFn: () => hexaApi.getTraffic(bbox),
    enabled: trafficActive,
    refetchInterval: 60_000,
  });

  // Debounced Autocomplete Search with AbortController cancellation
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;
      try {
        const res = await hexaApi.searchPlaces({ q: trimmed, lat, lng, limit: 8 }, ctrl.signal);
        setSuggestions(res.results);
      } catch {
        // Aborted or offline
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchQuery, lat, lng]);

  const executeFullSearch = useCallback(
    async (queryText: string) => {
      const q = queryText.trim();
      if (!q) return;
      setSearchQuery(q);
      setDropdownOpen(false);
      setActiveTab('explore');
      try {
        const res = await hexaApi.searchPlaces({ q, lat, lng, limit: 12 });
        setSearchResults(res.results);
        if (res.results[0]) {
          const top = res.results[0];
          selectPlace(top);
          flyTo(
            top.coordinates.lat,
            top.coordinates.lng,
            top.category === 'expressway' || top.category === 'highway' ? 10 : 13.5,
          );
        }
      } catch {
        setSearchResults([]);
      }
    },
    [flyTo, lat, lng, selectPlace, setActiveTab, setSearchQuery, setSearchResults],
  );

  const handleSelectSuggestion = (place: GeocodingPlace) => {
    setSearchQuery(place.name);
    setDropdownOpen(false);
    setSearchResults(suggestions);
    selectPlace(place);
    flyTo(
      place.coordinates.lat,
      place.coordinates.lng,
      place.category === 'expressway' || place.category === 'highway' ? 10 : 13.5,
    );
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownOpen(true);
      setHighlightIndex((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && suggestions[highlightIndex]) {
        handleSelectSuggestion(suggestions[highlightIndex]!);
      } else {
        void executeFullSearch(searchQuery);
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Primary Interactive Vector Map Surface */}
      <MapCanvas mapRefOut={mapRef} trafficData={trafficQuery.data ?? null} />

      {/* Offline Network Banner */}
      {!isOnline && (
        <div
          data-testid="offline-network-banner"
          className="pointer-events-auto fixed left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-amber-400 shadow-xl ring-1 ring-amber-500/40"
        >
          <WifiOff className="h-3.5 w-3.5" />
          Offline — Viewing Cached Vector Map Tiles
        </div>
      )}

      {/* Traffic Provenance Badge (Clearly Distinguishes Simulated vs Live!) */}
      {trafficActive && trafficQuery.data && (
        <div
          data-testid="traffic-provenance-badge"
          className="pointer-events-auto fixed bottom-10 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3.5 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 md:flex"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              trafficQuery.data.provenance === 'live' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="uppercase tracking-wider text-amber-600 dark:text-amber-400">
            {trafficQuery.data.provenance} Traffic
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-600 dark:text-slate-300">
            Updated {new Date(trafficQuery.data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* Floating Top-Left Search Omnibox + Desktop Docked / Collapsible Panel */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex flex-col p-2.5 sm:p-3.5 md:inset-x-auto md:w-[408px]">
        {/* Prominent Search Bar */}
        <div className="pointer-events-auto relative rounded-2xl border border-slate-200/90 bg-white/98 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/98">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(true);
                setActiveTab('explore');
              }}
              className="flex shrink-0 items-center gap-1.5 pr-1"
              title="Hexa Maps Home"
            >
              <HexaLogoMark size={28} />
              <span className="hidden text-sm font-black tracking-tight text-slate-900 dark:text-white sm:inline">
                Hexa<span className="text-amber-500">Maps</span>
              </span>
            </button>

            <div className="relative flex min-w-0 flex-1 items-center">
              <Search className="pointer-events-none absolute left-2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                role="combobox"
                aria-expanded={dropdownOpen && suggestions.length > 0}
                aria-controls="hexa-autocomplete-listbox"
                aria-label="Search Hexa Maps"
                data-testid="omnibox-search-input"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setDropdownOpen(true);
                  setHighlightIndex(-1);
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search cities, NH 66, places…"
                className="w-full rounded-xl bg-slate-100/80 py-1.5 pl-8 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:bg-slate-950"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSuggestions([]);
                  }}
                  aria-label="Clear search query"
                  className="absolute right-1.5 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMapStyle(isDark ? 'standard' : 'dark')}
              aria-label={isDark ? 'Switch to light map style' : 'Switch to dark map style'}
              data-testid="theme-toggle-btn"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-amber-400 hover:text-amber-600 dark:border-slate-700 dark:text-slate-300"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setSidebarOpen(true);
                setActiveTab('directions');
              }}
              aria-label="Directions"
              data-testid="open-directions-btn"
              title="Directions"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-sm transition hover:bg-amber-400"
            >
              <Navigation2 className="h-4 w-4" />
            </button>
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {dropdownOpen && suggestions.length > 0 && (
            <ul
              id="hexa-autocomplete-listbox"
              role="listbox"
              data-testid="autocomplete-dropdown"
              className="max-h-72 overflow-y-auto border-t border-slate-100 p-1.5 dark:border-slate-800"
            >
              {suggestions.map((sug, idx) => (
                <li key={sug.id} role="option" aria-selected={idx === highlightIndex}>
                  <button
                    type="button"
                    data-testid="autocomplete-option"
                    onClick={() => handleSelectSuggestion(sug)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition ${
                      idx === highlightIndex
                        ? 'bg-amber-500/15 text-slate-950 dark:text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                        {sug.name}
                      </div>
                      <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {sug.displayName}
                      </div>
                    </div>
                    {sug.shields?.[0] && (
                      <HighwayShieldBadge
                        badge={sug.shields[0]}
                        theme={isDark ? 'dark' : 'light'}
                        scale={0.68}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Desktop Collapsible Sidebar Panel */}
        <div className="mt-2.5 hidden items-start md:flex">
          {sidebarOpen && (
            <section
              aria-label="Hexa Maps navigation sidebar"
              className="pointer-events-auto flex max-h-[calc(100dvh-96px)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/96 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
            >
              {/* Navigation Mode Tabs */}
              <nav className="grid grid-cols-6 border-b border-slate-200/80 bg-slate-50/90 px-1.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/90">
                {SIDEBAR_TABS.map((t) => {
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-testid={`tab-btn-${t.id}`}
                      onClick={() => setActiveTab(t.id)}
                      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition ${
                        active
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800'
                      }`}
                    >
                      {t.icon}
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Scrollable Panel Body */}
              <div className="flex-1 overflow-y-auto p-3.5">
                {activeTab === 'explore' && <ExplorePanel onTriggerSearch={executeFullSearch} />}
                {activeTab === 'directions' && <DirectionsPanel />}
                {activeTab === 'shields' && <ShieldLabPanel />}
                {activeTab === 'incidents' && (
                  <IncidentsPanel onIncidentMutated={() => void incidentsQuery.refetch()} />
                )}
                {activeTab === 'saved' && <SavedAndAccountPanel />}
                {activeTab === 'offline' && <OfflineMapsPanel />}
              </div>
            </section>
          )}

          {/* Desktop Collapse/Expand Handle */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            data-testid="sidebar-collapse-btn"
            className="pointer-events-auto ml-1.5 mt-3 flex h-10 w-6 items-center justify-center rounded-r-xl border border-slate-200 bg-white/95 text-slate-600 shadow-md hover:text-amber-600 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Bottom Sheet & Tab Bar */}
      <div
        data-testid="mobile-bottom-sheet"
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border-t border-slate-200 bg-white/98 pb-[env(safe-area-inset-bottom)] shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/98 md:hidden"
      >
        <button
          type="button"
          onClick={() => setMobileSheetExpanded(!mobileSheetExpanded)}
          aria-label={mobileSheetExpanded ? 'Collapse bottom sheet' : 'Expand bottom sheet'}
          className="flex w-full items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-slate-500"
        >
          <span className="h-1 w-9 rounded-full bg-slate-300 dark:bg-slate-700" />
          {mobileSheetExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>

        {mobileSheetExpanded && (
          <div className="max-h-[56dvh] overflow-y-auto px-3.5 pb-3">
            {activeTab === 'explore' && <ExplorePanel onTriggerSearch={executeFullSearch} />}
            {activeTab === 'directions' && <DirectionsPanel />}
            {activeTab === 'shields' && <ShieldLabPanel />}
            {activeTab === 'incidents' && (
              <IncidentsPanel onIncidentMutated={() => void incidentsQuery.refetch()} />
            )}
            {activeTab === 'saved' && <SavedAndAccountPanel />}
            {activeTab === 'offline' && <OfflineMapsPanel />}
          </div>
        )}

        <nav className="grid grid-cols-6 border-t border-slate-200/80 px-1 py-1 dark:border-slate-800">
          {SIDEBAR_TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTab(t.id);
                  setMobileSheetExpanded(true);
                }}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-bold ${
                  active ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Floating Map Controls (Layers, Zoom, Compass, Locate, Report Incident) */}
      <MapControls mapRef={mapRef} />

      {/* Clear Cartographic Attribution Footer */}
      <footer
        data-testid="map-attribution"
        className="pointer-events-auto fixed bottom-1.5 right-3 z-10 hidden rounded-md bg-white/85 px-2 py-0.5 text-[10px] text-slate-600 backdrop-blur dark:bg-slate-900/85 dark:text-slate-400 md:block"
      >
        Hexa Maps • ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-amber-600"
        >
          OpenStreetMap contributors
        </a>{' '}
        (ODbL) • Natural Earth (CC0)
      </footer>

      {/* Modals */}
      <AuthModal />
      <StreetImageryModal />
    </main>
  );
}
