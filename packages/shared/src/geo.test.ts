import { describe, expect, it } from 'vitest';
import {
  bboxFromRadius,
  bearingDegrees,
  enumerateTilesForBbox,
  formatDistance,
  formatDuration,
  haversineDistanceMeters,
  isPointInBbox,
  isValidCoordinate,
  regionCellKey,
  regionCellKeysForBbox,
} from './geo.js';

describe('@hexa/shared geospatial helpers', () => {
  it('computes accurate Haversine distance between Mapusa and Panaji, Goa', () => {
    const mapusa = { lat: 15.5915, lng: 73.808 };
    const panaji = { lat: 15.4909, lng: 73.8278 };
    const dist = haversineDistanceMeters(mapusa, panaji);
    expect(dist).toBeGreaterThan(10_500);
    expect(dist).toBeLessThan(12_000);
  });

  it('computes compass bearings and bounding boxes around a radius', () => {
    const mapusa = { lat: 15.5915, lng: 73.808 };
    const bbox = bboxFromRadius(mapusa, 5000);
    expect(isPointInBbox(mapusa, bbox)).toBe(true);
    expect(isPointInBbox({ lat: 19.076, lng: 72.8777 }, bbox)).toBe(false);

    const southBearing = bearingDegrees({ lat: 16, lng: 73.8 }, { lat: 15, lng: 73.8 });
    expect(Math.round(southBearing)).toBe(180);
  });

  it('validates WGS84 coordinates and derives bounded Socket.IO regional keys', () => {
    expect(isValidCoordinate(15.59, 73.81)).toBe(true);
    expect(isValidCoordinate(95, 73.81)).toBe(false);
    expect(regionCellKey(15.59, 73.81)).toBe('region:15:73');
    const cells = regionCellKeysForBbox([73.2, 15.1, 74.3, 15.9]);
    expect(cells).toContain('region:15:73');
    expect(cells).toContain('region:15:74');
  });

  it('enumerates Slippy XYZ tiles for offline map bounding boxes with cap protection', () => {
    const tiles = enumerateTilesForBbox([73.7, 15.45, 73.9, 15.65], 8, 11, 100);
    expect(tiles.length).toBeGreaterThan(3);
    expect(tiles.length).toBeLessThanOrEqual(100);
    expect(tiles[0]?.z).toBe(8);
  });

  it('formats distances and durations in metric and imperial units', () => {
    expect(formatDistance(450, 'metric')).toBe('450 m');
    expect(formatDistance(12_340, 'metric')).toBe('12.3 km');
    expect(formatDistance(1609.344 * 5, 'imperial')).toBe('5.0 mi');
    expect(formatDuration(780)).toBe('13 min');
    expect(formatDuration(5400)).toBe('1 hr 30 min');
  });
});
