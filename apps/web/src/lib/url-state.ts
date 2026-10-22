import { isValidCoordinate, MapStyleIdSchema, type MapStyleId, type TransportMode } from '@hexa/shared';

export interface ParsedMapUrlState {
  lat?: number;
  lng?: number;
  zoom?: number;
  style?: MapStyleId;
  originCoords?: { lat: number; lng: number; label?: string };
  destCoords?: { lat: number; lng: number; label?: string };
  mode?: TransportMode;
}

export function parseMapUrlState(search: string): ParsedMapUrlState {
  const sp = new URLSearchParams(search);
  const state: ParsedMapUrlState = {};

  const at = sp.get('at');
  if (at) {
    const parts = at.replace(/z$/i, '').split(',').map(Number);
    if (parts.length >= 3 && isValidCoordinate(parts[0]!, parts[1]!) && Number.isFinite(parts[2])) {
      state.lat = parts[0];
      state.lng = parts[1];
      state.zoom = Math.max(1, Math.min(18, parts[2]!));
    }
  }

  const styleRaw = sp.get('style');
  const parsedStyle = MapStyleIdSchema.safeParse(styleRaw);
  if (parsedStyle.success) {
    state.style = parsedStyle.data;
  }

  const orig = sp.get('from');
  if (orig) {
    const [latStr, lngStr, ...lbl] = orig.split(',');
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (isValidCoordinate(lat, lng)) {
      state.originCoords = { lat, lng, label: lbl.join(',') || undefined };
    }
  }

  const dest = sp.get('to');
  if (dest) {
    const [latStr, lngStr, ...lbl] = dest.split(',');
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (isValidCoordinate(lat, lng)) {
      state.destCoords = { lat, lng, label: lbl.join(',') || undefined };
    }
  }

  return state;
}

export function buildShareableMapUrl(params: {
  lat: number;
  lng: number;
  zoom: number;
  style: MapStyleId;
  waypoints?: Array<{ lat: number; lng: number; label?: string }>;
}): string {
  const sp = new URLSearchParams();
  sp.set('at', `${params.lat.toFixed(4)},${params.lng.toFixed(4)},${params.zoom.toFixed(1)}z`);
  if (params.style !== 'standard') {
    sp.set('style', params.style);
  }
  if (params.waypoints && params.waypoints.length >= 2) {
    const first = params.waypoints[0]!;
    const last = params.waypoints[params.waypoints.length - 1]!;
    sp.set('from', `${first.lat.toFixed(5)},${first.lng.toFixed(5)}${first.label ? `,${first.label}` : ''}`);
    sp.set('to', `${last.lat.toFixed(5)},${last.lng.toFixed(5)}${last.label ? `,${last.label}` : ''}`);
  }
  if (typeof window === 'undefined') return `/?${sp.toString()}`;
  return `${window.location.origin}/?${sp.toString()}`;
}
