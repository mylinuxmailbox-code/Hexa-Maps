import type {
  Coordinates,
  GeocodingPlace,
  IncidentCreateInput,
  IncidentRecord,
  OfflineRegionCreateInput,
  OfflineRegionRecord,
  RouteAlternative,
  RouteRequest,
  SavedPlaceCreateInput,
  SavedPlaceRecord,
  TrafficResponse,
  TransportMode,
  UserPreferences,
  UserProfile,
} from '@hexa/shared';
import type { ClassifiedRoad, OsmRoadInput } from '@hexa/shields';

const GUEST_KEY = 'hexa_maps_guest_id';
const TOKEN_KEY = 'hexa_maps_session_token';

export function getGuestWorkspaceId(): string {
  if (typeof window === 'undefined') return 'ssr-guest';
  try {
    let existing = window.localStorage.getItem(GUEST_KEY);
    if (!existing) {
      existing = `gst_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      window.localStorage.setItem(GUEST_KEY, existing);
    }
    return existing;
  } catch {
    return 'browser-guest';
  }
}

export function getStoredSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage quota / private mode issues
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-hexa-guest-id', getGuestWorkspaceId());
  const sessionToken = getStoredSessionToken();
  if (sessionToken) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Always relative URL so browser preview proxies seamlessly
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let errMessage = `Request failed (${res.status})`;
    try {
      const errJson = (await res.json()) as { error?: { message?: string } };
      if (errJson?.error?.message) errMessage = errJson.error.message;
    } catch {
      // Fallback to HTTP status message
    }
    throw new Error(errMessage);
  }

  return (await res.json()) as T;
}

export const hexaApi = {
  health: () =>
    apiFetch<{
      status: string;
      database: { engine: string; postgisEnabled: boolean };
      capabilities: {
        routingModes: Array<{ mode: TransportMode; label: string; supported: boolean; note?: string }>;
        trafficProvenance: string;
        mapillaryConfigured: boolean;
      };
    }>('/api/v1/health'),

  searchPlaces: (
    params: { q: string; lat?: number; lng?: number; limit?: number },
    signal?: AbortSignal,
  ) => {
    const sp = new URLSearchParams({ q: params.q, limit: String(params.limit ?? 10) });
    if (params.lat !== undefined && params.lng !== undefined) {
      sp.set('lat', String(params.lat));
      sp.set('lng', String(params.lng));
    }
    return apiFetch<{ query: string; count: number; results: GeocodingPlace[] }>(
      `/api/v1/geocode/search?${sp.toString()}`,
      { signal },
    );
  },

  reverseGeocode: (coords: Coordinates, signal?: AbortSignal) =>
    apiFetch<{ place: GeocodingPlace | null }>(
      `/api/v1/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}`,
      { signal },
    ),

  calculateRoutes: (req: RouteRequest, signal?: AbortSignal) =>
    apiFetch<{ mode: TransportMode; count: number; routes: RouteAlternative[] }>(
      '/api/v1/routing/route',
      {
        method: 'POST',
        body: JSON.stringify(req),
        signal,
      },
    ),

  classifyRoad: (input: OsmRoadInput & { theme?: 'light' | 'dark' }) =>
    apiFetch<ClassifiedRoad>('/api/v1/roads/classify', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getClassifiedRoadsGeoJson: () =>
    apiFetch<GeoJSON.FeatureCollection>('/api/v1/roads/classified'),

  getTraffic: (bbox?: [number, number, number, number]) => {
    const q = bbox ? `?bbox=${bbox.join(',')}` : '';
    return apiFetch<TrafficResponse>(`/api/v1/traffic${q}`);
  },

  listIncidents: (params?: { bbox?: [number, number, number, number]; lat?: number; lng?: number }) => {
    const sp = new URLSearchParams();
    if (params?.bbox) sp.set('bbox', params.bbox.join(','));
    if (params?.lat !== undefined && params?.lng !== undefined) {
      sp.set('lat', String(params.lat));
      sp.set('lng', String(params.lng));
    }
    const qs = sp.toString();
    return apiFetch<{ count: number; incidents: IncidentRecord[] }>(
      `/api/v1/incidents${qs ? `?${qs}` : ''}`,
    );
  },

  createIncident: (input: IncidentCreateInput) =>
    apiFetch<{ incident: IncidentRecord; mergedDuplicate: boolean }>('/api/v1/incidents', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  voteIncident: (id: string, vote: 'confirm' | 'resolved') =>
    apiFetch<{ incident: IncidentRecord }>(`/api/v1/incidents/${encodeURIComponent(id)}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote }),
    }),

  getMe: () =>
    apiFetch<{
      authenticated: boolean;
      user: UserProfile | null;
      preferences: UserPreferences;
    }>('/api/v1/auth/me'),

  register: async (input: { email: string; password: string; displayName: string }) => {
    const res = await apiFetch<{ user: UserProfile; token: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setStoredSessionToken(res.token);
    return res;
  },

  login: async (input: { email: string; password: string }) => {
    const res = await apiFetch<{ user: UserProfile; token: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setStoredSessionToken(res.token);
    return res;
  },

  logout: async () => {
    await apiFetch<{ status: string }>('/api/v1/auth/logout', { method: 'POST' });
    setStoredSessionToken(null);
  },

  deleteAccount: async () => {
    await apiFetch<{ status: string }>('/api/v1/auth/account', { method: 'DELETE' });
    setStoredSessionToken(null);
  },

  listSavedPlaces: () => apiFetch<{ places: SavedPlaceRecord[] }>('/api/v1/places/saved'),

  savePlace: (input: SavedPlaceCreateInput) =>
    apiFetch<{ place: SavedPlaceRecord }>('/api/v1/places/saved', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  deleteSavedPlace: (id: string) =>
    apiFetch<{ status: string }>(`/api/v1/places/saved/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  listSearchHistory: () =>
    apiFetch<{
      items: Array<{
        id: string;
        query: string;
        placeName: string | null;
        lat: number | null;
        lng: number | null;
        createdAt: string;
      }>;
    }>('/api/v1/history/searches'),

  clearSearchHistory: () =>
    apiFetch<{ status: string; deletedCount: number }>('/api/v1/history/searches', {
      method: 'DELETE',
    }),

  updatePreferences: (prefs: Partial<UserPreferences>) =>
    apiFetch<{ preferences: UserPreferences }>('/api/v1/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),

  listOfflineRegions: () => apiFetch<{ regions: OfflineRegionRecord[] }>('/api/v1/offline/regions'),

  saveOfflineRegionMetadata: (input: OfflineRegionCreateInput) =>
    apiFetch<{ region: OfflineRegionRecord }>('/api/v1/offline/regions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  deleteOfflineRegionMetadata: (id: string) =>
    apiFetch<{ status: string }>(`/api/v1/offline/regions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  lookupStreetImagery: (coords: Coordinates) =>
    apiFetch<{
      available: boolean;
      configured: boolean;
      provider: string;
      frames: Array<{
        id: string;
        lat: number;
        lng: number;
        compassAngle: number;
        capturedAt: string;
        thumbUrl?: string;
        attribution: string;
      }>;
      message: string;
      attribution: string;
    }>(`/api/v1/imagery/nearby?lat=${coords.lat}&lng=${coords.lng}`),
};
