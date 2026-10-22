import {
  bboxFromCoordinates,
  bboxFromRadius,
  haversineDistanceMeters,
  type Coordinates,
  type GeocodingPlace,
  type PlaceCategory,
  type RouteShieldBadge,
} from '@hexa/shared';
import { classifyRoad } from '@hexa/shields';
import { OSM_POIS, OSM_ROAD_SEGMENTS, OSM_TRANSIT_CORRIDORS } from '../../data/osm-network.js';
import { getWorldExtract } from '../tiles/tile-service.js';
import type { AppEnv } from '../../config/env.js';

export interface GeocodeSearchOptions {
  q: string;
  lat?: number;
  lng?: number;
  limit?: number;
  countryCode?: string;
}

export interface GeocodingProvider {
  readonly id: 'local' | 'photon' | 'nominatim';
  search(opts: GeocodeSearchOptions, signal?: AbortSignal): Promise<GeocodingPlace[]>;
  reverse(coords: Coordinates, signal?: AbortSignal): Promise<GeocodingPlace | null>;
}

const CATEGORY_KEYWORDS: Array<{ regex: RegExp; category: PlaceCategory }> = [
  { regex: /\b(restaurants?|dining|food|eat)\b/i, category: 'restaurant' },
  { regex: /\b(cafes?|coffee)\b/i, category: 'cafe' },
  { regex: /\b(hospitals?|medical|clinic)\b/i, category: 'hospital' },
  { regex: /\b(airports?)\b/i, category: 'airport' },
  { regex: /\b(bus\s*stands?|bus\s*stations?|ktc)\b/i, category: 'bus_station' },
  { regex: /\b(train|railway|stations?|metro)\b/i, category: 'transit_station' },
  { regex: /\b(parks?|beach|beaches|sanctuary)\b/i, category: 'park' },
];

function toShieldBadges(seg: (typeof OSM_ROAD_SEGMENTS)[number]): RouteShieldBadge[] {
  const classified = classifyRoad(seg, 'light');
  return classified.shields
    .filter((s) => s.family !== 'TOLL_BADGE')
    .map((s) => ({
      id: s.spriteId,
      family: s.family,
      code: s.header ? `${s.header}:${s.code}` : s.code,
      displayRef: s.displayRef,
      network: s.network,
      countryCode: s.countryCode,
      isInternational: s.isInternational,
      isToll: s.isToll,
      confidence: s.confidence,
    }));
}

export class LocalSpatialGeocodingProvider implements GeocodingProvider {
  public readonly id = 'local' as const;
  private readonly indexedPlaces: GeocodingPlace[];

  constructor() {
    const world = getWorldExtract();
    const list: GeocodingPlace[] = [];

    // 1. Curated OpenStreetMap POIs & Landmarks
    for (const poi of OSM_POIS) {
      list.push({
        id: poi.id,
        name: poi.name,
        displayName: poi.displayName,
        category: poi.category,
        coordinates: { lat: poi.lat, lng: poi.lng },
        bbox: bboxFromRadius({ lat: poi.lat, lng: poi.lng }, poi.category === 'city' ? 6000 : 800),
        countryCode: poi.countryCode,
        country: poi.country,
        state: poi.state,
        city: poi.city,
        street: poi.street,
        postcode: poi.postcode,
        osmType: poi.osmType,
        osmId: poi.osmId,
        source: 'local_osm_ne',
        attribution: '© OpenStreetMap contributors (ODbL)',
      });
    }

    // 2. Curated OpenStreetMap Highways & Expressways (searchable by ref like "NH 66" or name)
    for (const seg of OSM_ROAD_SEGMENTS) {
      const midIdx = Math.floor(seg.coordinates.length / 2);
      const midPt = seg.coordinates[midIdx] ?? seg.coordinates[0]!;
      const coordsList = seg.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const classified = classifyRoad(seg, 'light');
      const badges = toShieldBadges(seg);
      const isExpwy = classified.functionalClass === 'expressway';
      const refText = badges.map((b) => b.displayRef).join(' / ');

      list.push({
        id: `road-${seg.id}`,
        name: refText ? `${refText} — ${seg.name}` : seg.name,
        displayName: `${seg.name}${seg.subdivisionCode ? `, ${seg.subdivisionCode}` : ''}${seg.countryCode ? `, ${seg.countryCode}` : ''}`,
        category: isExpwy ? 'expressway' : 'highway',
        coordinates: { lat: midPt[1], lng: midPt[0] },
        bbox: bboxFromCoordinates(coordsList, 0.03),
        countryCode: seg.countryCode,
        state: seg.subdivisionCode,
        osmType: 'way',
        osmId: seg.id,
        shields: badges,
        metadata: {
          surface: seg.surface,
          maxspeed: seg.maxspeed,
          lanes: classified.lanes,
          toll: classified.isToll,
        },
        source: 'local_osm_ne',
        attribution: '© OpenStreetMap contributors (ODbL)',
      });
    }

    // 3. Transit stations from corridors
    for (const corridor of OSM_TRANSIT_CORRIDORS) {
      for (const stop of corridor.stops) {
        list.push({
          id: `transit-${corridor.id}-${stop.id}`,
          name: stop.name,
          displayName: `${stop.name} (${corridor.lineShortName} — ${corridor.agencyName})`,
          category: corridor.vehicleType === 'bus' ? 'bus_station' : 'transit_station',
          coordinates: { lat: stop.lat, lng: stop.lng },
          bbox: bboxFromRadius({ lat: stop.lat, lng: stop.lng }, 600),
          source: 'local_osm_ne',
          attribution: '© OpenStreetMap contributors (ODbL)',
        });
      }
    }

    // 4. Natural Earth 4,200+ Global Cities & Capitals
    for (let i = 0; i < world.places.length; i++) {
      const p = world.places[i]!;
      // Avoid duplicating Panaji if already in curated OSM_POIS
      if (p.name === 'Panaji' && p.iso2 === 'IN') continue;
      const displayParts = [p.name, p.adm1, p.adm0].filter(Boolean);
      list.push({
        id: `ne-city-${i}-${p.iso2 || 'xx'}`,
        name: p.name,
        displayName: displayParts.join(', '),
        category: p.pop >= 50000 || p.capital ? 'city' : 'town',
        coordinates: { lat: p.lat, lng: p.lng },
        bbox: bboxFromRadius({ lat: p.lat, lng: p.lng }, p.pop > 1_000_000 ? 18_000 : 7_000),
        countryCode: p.iso2 || undefined,
        country: p.adm0 || undefined,
        state: p.adm1 || undefined,
        city: p.name,
        metadata: p.pop > 0 ? { population: p.pop } : undefined,
        source: 'local_osm_ne',
        attribution: 'Natural Earth (CC0) & © OpenStreetMap contributors',
      });
    }

    this.indexedPlaces = list;
  }

  public getPlaceById(id: string): GeocodingPlace | null {
    return this.indexedPlaces.find((p) => p.id === id) ?? null;
  }

  public async search(opts: GeocodeSearchOptions): Promise<GeocodingPlace[]> {
    const rawQ = opts.q.trim();
    if (!rawQ) return [];
    const limit = opts.limit ?? 10;
    const countryFilter = opts.countryCode?.toUpperCase();

    // Detect "Restaurants near <Place>" or category searches
    let targetCategory: PlaceCategory | undefined;
    let locationHintCoords: Coordinates | undefined =
      opts.lat !== undefined && opts.lng !== undefined ? { lat: opts.lat, lng: opts.lng } : undefined;

    for (const entry of CATEGORY_KEYWORDS) {
      if (entry.regex.test(rawQ)) {
        targetCategory = entry.category;
        const nearMatch = /\b(?:near|in|around)\s+(.+)$/i.exec(rawQ);
        if (nearMatch?.[1]) {
          const anchorResults = this.scoreTextQuery(nearMatch[1].trim(), undefined, countryFilter);
          if (anchorResults[0]) {
            locationHintCoords = anchorResults[0].coordinates;
          }
        }
        break;
      }
    }

    if (targetCategory && /\b(near|in|around)\b/i.test(rawQ)) {
      const catMatches = this.indexedPlaces
        .filter((p) => p.category === targetCategory)
        .filter((p) => (!countryFilter ? true : p.countryCode === countryFilter))
        .map((p) => {
          const dist = locationHintCoords
            ? haversineDistanceMeters(locationHintCoords, p.coordinates)
            : 0;
          return { place: p, dist };
        })
        .sort((a, b) => a.dist - b.dist)
        .slice(0, limit)
        .map((x) => x.place);

      if (catMatches.length > 0) return catMatches;
    }

    return this.scoreTextQuery(rawQ, locationHintCoords, countryFilter).slice(0, limit);
  }

  private scoreTextQuery(
    query: string,
    proximity?: Coordinates,
    countryFilter?: string,
  ): GeocodingPlace[] {
    const qNorm = query.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
    const qCompact = qNorm.replace(/\s+/g, '');
    const tokens = qNorm.split(/[,\s]+/).filter(Boolean);

    const scored: Array<{ place: GeocodingPlace; score: number }> = [];

    for (const place of this.indexedPlaces) {
      if (countryFilter && place.countryCode && place.countryCode !== countryFilter) {
        continue;
      }

      const nameNorm = place.name.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ');
      const displayNorm = place.displayName
        .toLowerCase()
        .replace(/[-–—]/g, ' ')
        .replace(/\s+/g, ' ');
      const shieldCompact = (place.shields || [])
        .map((s) => s.displayRef.toLowerCase().replace(/[\s-]/g, ''))
        .join(' ');

      let score = 0;

      if (nameNorm === qNorm || shieldCompact.split(' ').includes(qCompact)) {
        score += 120;
      } else if (nameNorm.startsWith(qNorm)) {
        score += 90;
      } else if (nameNorm.includes(qNorm)) {
        score += 70;
      } else if (displayNorm.includes(qNorm)) {
        score += 55;
      } else {
        let matchedTokens = 0;
        for (const t of tokens) {
          if (displayNorm.includes(t) || shieldCompact.includes(t)) {
            matchedTokens++;
          }
        }
        if (matchedTokens === tokens.length && tokens.length > 0) {
          score += 65;
        } else if (matchedTokens > 0 && tokens.length > 1 && matchedTokens >= tokens.length - 1) {
          score += 30;
        }
      }

      if (score === 0) continue;

      // Boost prominent cities and highway corridors slightly
      if (place.category === 'expressway' || place.category === 'highway') score += 8;
      if (place.metadata?.population && place.metadata.population > 500_000) score += 6;

      // Viewport proximity boost (up to +18 points when within 80 km)
      if (proximity) {
        const distKm = haversineDistanceMeters(proximity, place.coordinates) / 1000;
        if (distKm < 80) {
          score += Math.round(18 * (1 - distKm / 80));
        }
      }

      scored.push({ place, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.place);
  }

  public async reverse(coords: Coordinates): Promise<GeocodingPlace | null> {
    let best: GeocodingPlace | null = null;
    let bestDist = Infinity;

    for (const p of this.indexedPlaces) {
      const d = haversineDistanceMeters(coords, p.coordinates);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }

    if (!best) return null;

    if (bestDist <= 1200) {
      return {
        ...best,
        coordinates: coords,
      };
    }

    const nearLabel =
      bestDist < 35_000
        ? `Near ${best.name}${best.state ? `, ${best.state}` : ''}${best.country ? `, ${best.country}` : ''}`
        : `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;

    return {
      id: `rev-${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`,
      name: nearLabel,
      displayName: `${nearLabel} (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`,
      category: 'address',
      coordinates: coords,
      countryCode: bestDist < 100_000 ? best.countryCode : undefined,
      country: bestDist < 100_000 ? best.country : undefined,
      state: bestDist < 100_000 ? best.state : undefined,
      source: 'local_osm_ne',
      attribution: '© OpenStreetMap contributors & Natural Earth',
    };
  }
}

export class PhotonGeocodingProvider implements GeocodingProvider {
  public readonly id = 'photon' as const;
  constructor(private readonly baseUrl: string) {}

  public async search(opts: GeocodeSearchOptions, signal?: AbortSignal): Promise<GeocodingPlace[]> {
    const url = new URL('/api', this.baseUrl);
    url.searchParams.set('q', opts.q);
    url.searchParams.set('limit', String(opts.limit ?? 8));
    if (opts.lat !== undefined && opts.lng !== undefined) {
      url.searchParams.set('lat', String(opts.lat));
      url.searchParams.set('lon', String(opts.lng));
    }

    const res = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(2800),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
    const data = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: Record<string, unknown>;
      }>;
    };

    return (data.features ?? []).flatMap((f, idx): GeocodingPlace[] => {
      const coords = f.geometry?.coordinates;
      const p = f.properties ?? {};
      if (!coords || coords.length < 2) return [];
      const name = String(p.name || p.street || p.city || opts.q);
      const parts = [name, p.street, p.city, p.state, p.country]
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .filter((v, i, arr) => arr.indexOf(v) === i);

      return [
        {
          id: `photon-${p.osm_id ?? idx}`,
          name,
          displayName: parts.join(', '),
          category: mapOsmValueToCategory(String(p.osm_value || '')),
          coordinates: { lng: coords[0], lat: coords[1] },
          bbox: Array.isArray(p.extent) && p.extent.length === 4
            ? [Number(p.extent[0]), Number(p.extent[3]), Number(p.extent[2]), Number(p.extent[1])]
            : undefined,
          countryCode: typeof p.countrycode === 'string' ? p.countrycode.toUpperCase() : undefined,
          country: typeof p.country === 'string' ? p.country : undefined,
          state: typeof p.state === 'string' ? p.state : undefined,
          city: typeof p.city === 'string' ? p.city : undefined,
          street: typeof p.street === 'string' ? p.street : undefined,
          postcode: typeof p.postcode === 'string' ? p.postcode : undefined,
          source: 'photon',
          attribution: '© OpenStreetMap contributors via Photon (Komoot)',
        },
      ];
    });
  }

  public async reverse(coords: Coordinates, signal?: AbortSignal): Promise<GeocodingPlace | null> {
    const url = new URL('/reverse', this.baseUrl);
    url.searchParams.set('lat', String(coords.lat));
    url.searchParams.set('lon', String(coords.lng));
    const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(2800) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    const p = data.features?.[0]?.properties;
    if (!p) return null;
    const name = String(p.name || p.street || p.city || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    return {
      id: `photon-rev-${p.osm_id ?? '0'}`,
      name,
      displayName: [name, p.city, p.state, p.country].filter(Boolean).join(', '),
      category: 'address',
      coordinates: coords,
      source: 'photon',
      attribution: '© OpenStreetMap contributors via Photon (Komoot)',
    };
  }
}

export class NominatimGeocodingProvider implements GeocodingProvider {
  public readonly id = 'nominatim' as const;
  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
  ) {}

  public async search(opts: GeocodeSearchOptions, signal?: AbortSignal): Promise<GeocodingPlace[]> {
    const url = new URL('/search', this.baseUrl);
    url.searchParams.set('q', opts.q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', String(Math.min(10, opts.limit ?? 8)));
    if (opts.countryCode) url.searchParams.set('countrycodes', opts.countryCode.toLowerCase());

    const res = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(2800),
      headers: {
        Accept: 'application/json',
        'User-Agent': this.userAgent,
      },
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const rows = (await res.json()) as Array<Record<string, unknown>>;

    return rows.map((r, idx): GeocodingPlace => {
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      const bb = Array.isArray(r.boundingbox) ? r.boundingbox.map(Number) : undefined;
      const addr = (r.address ?? {}) as Record<string, string | undefined>;
      return {
        id: `nominatim-${r.place_id ?? idx}`,
        name: String(r.name || addr.road || addr.city || String(r.display_name || '').split(',')[0]),
        displayName: String(r.display_name || ''),
        category: mapOsmValueToCategory(String(r.type || '')),
        coordinates: { lat, lng },
        bbox: bb && bb.length === 4 ? [bb[2]!, bb[0]!, bb[3]!, bb[1]!] : undefined,
        countryCode: addr.country_code?.toUpperCase(),
        country: addr.country,
        state: addr.state,
        city: addr.city || addr.town || addr.village,
        street: addr.road,
        postcode: addr.postcode,
        source: 'nominatim',
        attribution: '© OpenStreetMap contributors via Nominatim (ODbL)',
      };
    });
  }

  public async reverse(coords: Coordinates, signal?: AbortSignal): Promise<GeocodingPlace | null> {
    const url = new URL('/reverse', this.baseUrl);
    url.searchParams.set('lat', String(coords.lat));
    url.searchParams.set('lon', String(coords.lng));
    url.searchParams.set('format', 'jsonv2');
    const res = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(2800),
      headers: { 'User-Agent': this.userAgent },
    });
    if (!res.ok) return null;
    const r = (await res.json()) as Record<string, unknown>;
    if (!r.display_name) return null;
    return {
      id: `nominatim-rev-${r.place_id ?? '0'}`,
      name: String(r.name || String(r.display_name).split(',')[0]),
      displayName: String(r.display_name),
      category: 'address',
      coordinates: coords,
      source: 'nominatim',
      attribution: '© OpenStreetMap contributors via Nominatim (ODbL)',
    };
  }
}

function mapOsmValueToCategory(value: string): PlaceCategory {
  const v = value.toLowerCase();
  if (v === 'city') return 'city';
  if (v === 'town' || v === 'village') return 'town';
  if (v === 'motorway') return 'expressway';
  if (['trunk', 'primary', 'secondary', 'highway'].includes(v)) return 'highway';
  if (v === 'bus_station' || v === 'bus_stop') return 'bus_station';
  if (v === 'station' || v === 'halt') return 'transit_station';
  if (v === 'aerodrome' || v === 'airport') return 'airport';
  if (v === 'restaurant' || v === 'fast_food') return 'restaurant';
  if (v === 'cafe') return 'cafe';
  if (v === 'hospital' || v === 'clinic') return 'hospital';
  if (v === 'park' || v === 'beach') return 'park';
  return 'poi';
}

export class CompositeGeocodingService {
  private readonly providers: GeocodingProvider[];
  private readonly localProvider: LocalSpatialGeocodingProvider;
  private readonly cache = new Map<string, { expiresAt: number; items: GeocodingPlace[] }>();

  constructor(env: AppEnv, customProviders?: GeocodingProvider[]) {
    this.localProvider = new LocalSpatialGeocodingProvider();
    if (customProviders) {
      this.providers = customProviders;
      return;
    }

    const order = env.GEOCODING_PROVIDERS.split(',').map((s) => s.trim().toLowerCase());
    const configured: GeocodingProvider[] = [];
    for (const id of order) {
      if (id === 'local') configured.push(this.localProvider);
      if (id === 'photon' && env.PHOTON_BASE_URL) {
        configured.push(new PhotonGeocodingProvider(env.PHOTON_BASE_URL));
      }
      if (id === 'nominatim' && env.NOMINATIM_BASE_URL) {
        configured.push(
          new NominatimGeocodingProvider(env.NOMINATIM_BASE_URL, env.NOMINATIM_USER_AGENT),
        );
      }
    }
    if (configured.length === 0) configured.push(this.localProvider);
    this.providers = configured;
  }

  public getPlaceById(id: string): GeocodingPlace | null {
    return this.localProvider.getPlaceById(id);
  }

  public async search(opts: GeocodeSearchOptions): Promise<GeocodingPlace[]> {
    const cacheKey = JSON.stringify({
      q: opts.q.trim().toLowerCase(),
      lat: opts.lat ? Math.round(opts.lat * 20) / 20 : undefined,
      lng: opts.lng ? Math.round(opts.lng * 20) / 20 : undefined,
      limit: opts.limit ?? 10,
      cc: opts.countryCode,
    });

    const hit = this.cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.items;
    }

    const merged: GeocodingPlace[] = [];
    const limit = opts.limit ?? 10;

    for (const provider of this.providers) {
      try {
        const res = await provider.search(opts);
        for (const item of res) {
          const isDuplicate = merged.some(
            (existing) =>
              existing.name.toLowerCase() === item.name.toLowerCase() &&
              haversineDistanceMeters(existing.coordinates, item.coordinates) < 2500,
          );
          if (!isDuplicate) {
            merged.push(item);
          }
        }
        if (merged.length >= limit) break;
      } catch {
        // Provider unreachable or timed out -> continue cleanly to next configured provider
      }
    }

    const finalResults = merged.slice(0, limit);
    if (this.cache.size > 300) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, items: finalResults });
    return finalResults;
  }

  public async reverse(coords: Coordinates): Promise<GeocodingPlace | null> {
    for (const provider of this.providers) {
      try {
        const res = await provider.reverse(coords);
        if (res) return res;
      } catch {
        // Fallback to next provider
      }
    }
    return this.localProvider.reverse(coords);
  }
}
