/**
 * Geospatial & cartographic math utilities for Hexa Maps.
 * Pure TypeScript with zero external runtime dependencies.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

/** [west, south, east, north] in WGS84 degrees */
export type BoundingBox = [number, number, number, number];

export interface ViewportState {
  lat: number;
  lng: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

const EARTH_RADIUS_METERS = 6_371_008.8;

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Great-circle Haversine distance in meters between two WGS84 points.
 */
export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Initial forward compass bearing in degrees [0, 360) from point A to point B.
 */
export function bearingDegrees(a: Coordinates, b: Coordinates): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLng = toRadians(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Expand a center point + radius (meters) into a [west, south, east, north] bounding box.
 */
export function bboxFromRadius(center: Coordinates, radiusMeters: number): BoundingBox {
  const latDelta = toDegrees(radiusMeters / EARTH_RADIUS_METERS);
  const cosLat = Math.max(0.01, Math.cos(toRadians(center.lat)));
  const lngDelta = toDegrees(radiusMeters / (EARTH_RADIUS_METERS * cosLat));
  return [
    Math.max(-180, center.lng - lngDelta),
    Math.max(-90, center.lat - latDelta),
    Math.min(180, center.lng + lngDelta),
    Math.min(90, center.lat + latDelta),
  ];
}

export function isPointInBbox(pt: Coordinates, bbox: BoundingBox): boolean {
  const [west, south, east, north] = bbox;
  return pt.lng >= west && pt.lng <= east && pt.lat >= south && pt.lat <= north;
}

export function bboxFromCoordinates(points: Coordinates[], paddingDeg = 0.01): BoundingBox {
  if (points.length === 0) {
    return [-180, -85, 180, 85];
  }
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const p of points) {
    if (p.lng < west) west = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lng > east) east = p.lng;
    if (p.lat > north) north = p.lat;
  }
  return [
    Math.max(-180, west - paddingDeg),
    Math.max(-90, south - paddingDeg),
    Math.min(180, east + paddingDeg),
    Math.min(90, north + paddingDeg),
  ];
}

/**
 * Coarse 1-degree spatial cell key used for regional Socket.IO incident rooms.
 * Prevents broadcasting global events to unaffected viewports.
 */
export function regionCellKey(lat: number, lng: number, gridSizeDeg = 1): string {
  const rLat = Math.floor(lat / gridSizeDeg) * gridSizeDeg;
  const rLng = Math.floor(lng / gridSizeDeg) * gridSizeDeg;
  return `region:${rLat}:${rLng}`;
}

export function regionCellKeysForBbox(bbox: BoundingBox, gridSizeDeg = 1, maxCells = 36): string[] {
  const [west, south, east, north] = bbox;
  const minLat = Math.floor(south / gridSizeDeg) * gridSizeDeg;
  const maxLat = Math.floor(north / gridSizeDeg) * gridSizeDeg;
  const minLng = Math.floor(west / gridSizeDeg) * gridSizeDeg;
  const maxLng = Math.floor(east / gridSizeDeg) * gridSizeDeg;

  const keys: string[] = [];
  for (let lat = minLat; lat <= maxLat; lat += gridSizeDeg) {
    for (let lng = minLng; lng <= maxLng; lng += gridSizeDeg) {
      keys.push(`region:${lat}:${lng}`);
      if (keys.length >= maxCells) return keys;
    }
  }
  return keys;
}

/**
 * Convert WGS84 lon/lat to Slippy Map XYZ tile indices.
 */
export function lngLatToTile(lng: number, lat: number, zoom: number): { z: number; x: number; y: number } {
  const z = Math.max(0, Math.min(20, Math.floor(zoom)));
  const n = 2 ** z;
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const x = Math.min(n - 1, Math.max(0, Math.floor(((lng + 180) / 360) * n)));
  const latRad = toRadians(clampedLat);
  const y = Math.min(
    n - 1,
    Math.max(0, Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)),
  );
  return { z, x, y };
}

/**
 * Enumerate XYZ tiles covering a bounding box across [minZoom, maxZoom], capped at `maxTiles`
 * so offline downloads remain bounded and predictable.
 */
export function enumerateTilesForBbox(
  bbox: BoundingBox,
  minZoom: number,
  maxZoom: number,
  maxTiles = 450,
): Array<{ z: number; x: number; y: number }> {
  const [west, south, east, north] = bbox;
  const tiles: Array<{ z: number; x: number; y: number }> = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const nw = lngLatToTile(west, north, z);
    const se = lngLatToTile(east, south, z);
    const minX = Math.min(nw.x, se.x);
    const maxX = Math.max(nw.x, se.x);
    const minY = Math.min(nw.y, se.y);
    const maxY = Math.max(nw.y, se.y);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ z, x, y });
        if (tiles.length >= maxTiles) return tiles;
      }
    }
  }
  return tiles;
}

export function formatDistance(meters: number, unit: 'metric' | 'imperial' = 'metric'): string {
  if (!Number.isFinite(meters) || meters < 0) return '0 m';
  if (unit === 'imperial') {
    const feet = meters * 3.28084;
    if (feet < 1000) return `${Math.round(feet / 10) * 10} ft`;
    const miles = meters / 1609.344;
    return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km < 20 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '1 min';
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
}
