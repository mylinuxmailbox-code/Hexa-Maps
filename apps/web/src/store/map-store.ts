import { create } from 'zustand';
import type {
  BoundingBox,
  GeocodingPlace,
  IncidentRecord,
  MapStyleId,
  RouteAlternative,
  TransportMode,
  UserPreferences,
  UserProfile,
} from '@hexa/shared';

export type SidebarTab =
  | 'explore'
  | 'directions'
  | 'shields'
  | 'incidents'
  | 'saved'
  | 'offline';

export interface RouteWaypointDraft {
  id: string;
  label: string;
  lat: number | null;
  lng: number | null;
}

export interface InspectedRoadFeature {
  id: string;
  name: string;
  highway: string;
  ref: string;
  int_ref: string;
  network: string;
  countryCode: string;
  functionalClass: string;
  officialDesignation: string;
  classes: string[];
  isToll: boolean;
  isBridge: boolean;
  isControlledAccess: boolean;
  lanes: number;
  maxspeed: string;
  confidence: 'verified' | 'inferred';
  source: string;
  shields: Array<{
    spriteId: string;
    family: string;
    code: string;
    header?: string;
    displayRef: string;
    isInternational: boolean;
    confidence: 'verified' | 'inferred';
  }>;
}

interface HexaMapState {
  // Viewport (defaults to Mapusa–Panaji–Calangute corridor in Goa, India)
  lat: number;
  lng: number;
  zoom: number;
  bearing: number;
  pitch: number;
  bbox: BoundingBox;
  flyToCommand: { lat: number; lng: number; zoom: number; nonce: number } | null;

  // Map styles & overlays
  mapStyle: MapStyleId;
  showTrafficOverlay: boolean;
  showCyclingOverlay: boolean;
  showShieldsOnMap: boolean;
  distanceUnit: 'metric' | 'imperial';

  // Sidebar & mobile bottom sheet
  sidebarOpen: boolean;
  activeTab: SidebarTab;
  mobileSheetExpanded: boolean;

  // Search & Selected Place / Inspected Road
  searchQuery: string;
  searchResults: GeocodingPlace[];
  selectedPlace: GeocodingPlace | null;
  inspectedRoad: InspectedRoadFeature | null;
  streetImageryTarget: { lat: number; lng: number; label: string } | null;

  // Multimodal Directions
  transportMode: TransportMode;
  avoidTolls: boolean;
  waypoints: RouteWaypointDraft[];
  routes: RouteAlternative[];
  selectedRouteIndex: number;
  isRouting: boolean;
  routingError: string | null;

  // Community Incidents & Socket status
  incidents: IncidentRecord[];
  socketConnected: boolean;
  pickingIncidentLocation: boolean;
  pendingIncidentCoords: { lat: number; lng: number } | null;

  // User Auth & Network state
  user: UserProfile | null;
  authModalOpen: boolean;
  isOnline: boolean;

  // Actions
  setViewport: (v: {
    lat: number;
    lng: number;
    zoom: number;
    bearing?: number;
    pitch?: number;
    bbox?: BoundingBox;
  }) => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  setMapStyle: (style: MapStyleId) => void;
  toggleTrafficOverlay: () => void;
  toggleCyclingOverlay: () => void;
  setShowShieldsOnMap: (show: boolean) => void;
  setDistanceUnit: (u: 'metric' | 'imperial') => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: SidebarTab) => void;
  setMobileSheetExpanded: (expanded: boolean) => void;
  setSearchQuery: (q: string) => void;
  setSearchResults: (r: GeocodingPlace[]) => void;
  selectPlace: (p: GeocodingPlace | null) => void;
  setInspectedRoad: (r: InspectedRoadFeature | null) => void;
  setStreetImageryTarget: (t: { lat: number; lng: number; label: string } | null) => void;

  setTransportMode: (m: TransportMode) => void;
  setAvoidTolls: (avoid: boolean) => void;
  setWaypoint: (index: number, patch: Partial<RouteWaypointDraft>) => void;
  addWaypoint: () => void;
  removeWaypoint: (index: number) => void;
  moveWaypoint: (index: number, direction: -1 | 1) => void;
  reverseWaypoints: () => void;
  routeToDestination: (dest: { label: string; lat: number; lng: number }) => void;
  setRoutesResult: (routes: RouteAlternative[], error?: string | null) => void;
  setSelectedRouteIndex: (idx: number) => void;
  setIsRouting: (loading: boolean) => void;

  setIncidents: (list: IncidentRecord[]) => void;
  upsertIncidentRealtime: (inc: IncidentRecord) => void;
  setSocketConnected: (connected: boolean) => void;
  setPickingIncidentLocation: (picking: boolean) => void;
  setPendingIncidentCoords: (c: { lat: number; lng: number } | null) => void;

  setUser: (u: UserProfile | null) => void;
  applyPreferences: (p: UserPreferences) => void;
  setAuthModalOpen: (open: boolean) => void;
  setIsOnline: (online: boolean) => void;
}

export const useMapStore = create<HexaMapState>((set) => ({
  lat: 15.535,
  lng: 73.825,
  zoom: 11.2,
  bearing: 0,
  pitch: 0,
  bbox: [73.68, 15.35, 74.02, 15.72],
  flyToCommand: null,

  mapStyle: 'standard',
  showTrafficOverlay: false,
  showCyclingOverlay: false,
  showShieldsOnMap: true,
  distanceUnit: 'metric',

  sidebarOpen: true,
  activeTab: 'explore',
  mobileSheetExpanded: false,

  searchQuery: '',
  searchResults: [],
  selectedPlace: null,
  inspectedRoad: null,
  streetImageryTarget: null,

  transportMode: 'driving',
  avoidTolls: false,
  waypoints: [
    { id: 'wp-origin', label: 'Mapusa Bus Stand, Goa', lat: 15.5912, lng: 73.808 },
    { id: 'wp-dest', label: 'Panaji KTC Bus Terminus, Goa', lat: 15.4945, lng: 73.8368 },
  ],
  routes: [],
  selectedRouteIndex: 0,
  isRouting: false,
  routingError: null,

  incidents: [],
  socketConnected: false,
  pickingIncidentLocation: false,
  pendingIncidentCoords: null,

  user: null,
  authModalOpen: false,
  isOnline: true,

  setViewport: (v) =>
    set((s) => ({
      lat: v.lat,
      lng: v.lng,
      zoom: v.zoom,
      bearing: v.bearing ?? s.bearing,
      pitch: v.pitch ?? s.pitch,
      bbox: v.bbox ?? s.bbox,
    })),

  flyTo: (lat, lng, zoom) =>
    set((s) => ({
      flyToCommand: { lat, lng, zoom: zoom ?? Math.max(s.zoom, 13), nonce: Date.now() + Math.random() },
    })),

  setMapStyle: (style) =>
    set((s) => ({
      mapStyle: style,
      showTrafficOverlay: style === 'traffic' ? true : s.showTrafficOverlay,
    })),

  toggleTrafficOverlay: () => set((s) => ({ showTrafficOverlay: !s.showTrafficOverlay })),
  toggleCyclingOverlay: () => set((s) => ({ showCyclingOverlay: !s.showCyclingOverlay })),
  setShowShieldsOnMap: (show) => set({ showShieldsOnMap: show }),
  setDistanceUnit: (u) => set({ distanceUnit: u }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab, sidebarOpen: true, mobileSheetExpanded: true }),
  setMobileSheetExpanded: (expanded) => set({ mobileSheetExpanded: expanded }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (r) => set({ searchResults: r }),
  selectPlace: (p) =>
    set({
      selectedPlace: p,
      inspectedRoad: null,
      activeTab: 'explore',
      sidebarOpen: true,
      mobileSheetExpanded: Boolean(p),
    }),
  setInspectedRoad: (r) =>
    set({
      inspectedRoad: r,
      sidebarOpen: Boolean(r),
      mobileSheetExpanded: Boolean(r),
    }),
  setStreetImageryTarget: (t) => set({ streetImageryTarget: t }),

  setTransportMode: (m) => set({ transportMode: m }),
  setAvoidTolls: (avoid) => set({ avoidTolls: avoid }),
  setWaypoint: (index, patch) =>
    set((s) => ({
      waypoints: s.waypoints.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    })),
  addWaypoint: () =>
    set((s) => {
      if (s.waypoints.length >= 6) return s;
      return {
        waypoints: [
          ...s.waypoints,
          { id: `wp-${Date.now()}`, label: '', lat: null, lng: null },
        ],
      };
    }),
  removeWaypoint: (index) =>
    set((s) => {
      if (s.waypoints.length <= 2) return s;
      return { waypoints: s.waypoints.filter((_, i) => i !== index) };
    }),
  moveWaypoint: (index, direction) =>
    set((s) => {
      const target = index + direction;
      if (target < 0 || target >= s.waypoints.length) return s;
      const copy = [...s.waypoints];
      const temp = copy[index]!;
      copy[index] = copy[target]!;
      copy[target] = temp;
      return { waypoints: copy };
    }),
  reverseWaypoints: () =>
    set((s) => ({
      waypoints: [...s.waypoints].reverse(),
    })),
  routeToDestination: (dest) =>
    set((s) => {
      const first = s.waypoints[0] ?? {
        id: 'wp-origin',
        label: 'Mapusa, Goa',
        lat: s.lat,
        lng: s.lng,
      };
      const originFilled =
        first.lat !== null && first.lng !== null
          ? first
          : { ...first, label: `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`, lat: s.lat, lng: s.lng };
      return {
        activeTab: 'directions',
        sidebarOpen: true,
        mobileSheetExpanded: true,
        waypoints: [
          originFilled,
          { id: 'wp-dest', label: dest.label, lat: dest.lat, lng: dest.lng },
        ],
      };
    }),
  setRoutesResult: (routes, error = null) =>
    set({ routes, selectedRouteIndex: 0, routingError: error, isRouting: false }),
  setSelectedRouteIndex: (idx) => set({ selectedRouteIndex: idx }),
  setIsRouting: (loading) => set({ isRouting: loading }),

  setIncidents: (list) => set({ incidents: list }),
  upsertIncidentRealtime: (inc) =>
    set((s) => {
      if (inc.status !== 'active') {
        return { incidents: s.incidents.filter((x) => x.id !== inc.id) };
      }
      const exists = s.incidents.some((x) => x.id === inc.id);
      if (exists) {
        return { incidents: s.incidents.map((x) => (x.id === inc.id ? inc : x)) };
      }
      return { incidents: [inc, ...s.incidents] };
    }),
  setSocketConnected: (connected) => set({ socketConnected: connected }),
  setPickingIncidentLocation: (picking) => set({ pickingIncidentLocation: picking }),
  setPendingIncidentCoords: (c) => set({ pendingIncidentCoords: c }),

  setUser: (u) => set({ user: u }),
  applyPreferences: (p) =>
    set({
      mapStyle: p.defaultMapStyle,
      distanceUnit: p.distanceUnit,
      transportMode: p.preferredTransportMode,
      avoidTolls: p.avoidTollsByDefault,
      showShieldsOnMap: p.showShieldsOnMap,
    }),
  setAuthModalOpen: (open) => set({ authModalOpen: open }),
  setIsOnline: (online) => set({ isOnline: online }),
}));
