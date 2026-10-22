import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import geojsonvt from 'geojson-vt';
import * as vtPbf from 'vt-pbf';
import { feature as topoFeature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection } from 'geojson';
import { classifyRoad } from '@hexa/shields';
import {
  OSM_POIS,
  OSM_REGIONAL_POLYGONS,
  OSM_ROAD_SEGMENTS,
  OSM_TRANSIT_CORRIDORS,
} from '../../data/osm-network.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '../../../assets');

export interface WorldPlaceRecord {
  name: string;
  ascii: string;
  adm0: string;
  adm1: string;
  iso2: string;
  pop: number;
  capital: number;
  scalerank: number;
  lng: number;
  lat: number;
}

interface WorldExtractBundle {
  attribution: string;
  places: WorldPlaceRecord[];
  lakes: FeatureCollection;
  rivers: FeatureCollection;
  admin1Lines: FeatureCollection;
}

// Type-safe helper for geojson-vt v5 ES class
type GeojsonVtIndex = {
  getTile: (z: number, x: number, y: number) => unknown;
};
const GeoJSONVTClass = ((geojsonvt as unknown as { default?: unknown }).default ??
  geojsonvt) as new (data: unknown, options?: Record<string, unknown>) => GeojsonVtIndex;
function createGeojsonVt(data: unknown, options: Record<string, unknown>): GeojsonVtIndex {
  return new GeoJSONVTClass(data, options);
}

let cachedWorldBundle: WorldExtractBundle | null = null;

export function getWorldExtract(): WorldExtractBundle {
  if (cachedWorldBundle) return cachedWorldBundle;
  const extractPath = path.join(ASSETS_DIR, 'geodata/world-extract.json');
  if (fs.existsSync(extractPath)) {
    cachedWorldBundle = JSON.parse(fs.readFileSync(extractPath, 'utf8')) as WorldExtractBundle;
    return cachedWorldBundle;
  }
  cachedWorldBundle = {
    attribution: 'OpenStreetMap contributors (ODbL)',
    places: [],
    lakes: { type: 'FeatureCollection', features: [] },
    rivers: { type: 'FeatureCollection', features: [] },
    admin1Lines: { type: 'FeatureCollection', features: [] },
  };
  return cachedWorldBundle;
}

export class LocalVectorTileService {
  private readonly layerIndexes: Record<string, GeojsonVtIndex>;
  private readonly classifiedRoadsFc: FeatureCollection;
  private readonly emptyGlyphPbf: Buffer;

  constructor() {
    const world = getWorldExtract();
    const countriesTopo = require('world-atlas/countries-50m.json') as Topology<{
      countries: GeometryCollection<{ name?: string }>;
      land: GeometryCollection;
    }>;

    const landFc = topoFeature(countriesTopo, countriesTopo.objects.land) as unknown as
      | FeatureCollection
      | Feature;
    const normalizedLandFc: FeatureCollection =
      landFc.type === 'FeatureCollection'
        ? landFc
        : { type: 'FeatureCollection', features: [landFc] };

    const countriesFc = topoFeature(
      countriesTopo,
      countriesTopo.objects.countries,
    ) as unknown as FeatureCollection;

    const waterPolygons: Feature[] = [
      ...world.lakes.features,
      ...OSM_REGIONAL_POLYGONS.filter((p) => p.kind === 'water').map(
        (p): Feature => ({
          type: 'Feature',
          properties: { name: p.name },
          geometry: { type: 'Polygon', coordinates: p.coordinates },
        }),
      ),
    ];

    const parkPolygons: Feature[] = OSM_REGIONAL_POLYGONS.filter((p) => p.kind === 'park').map(
      (p): Feature => ({
        type: 'Feature',
        properties: { name: p.name },
        geometry: { type: 'Polygon', coordinates: p.coordinates },
      }),
    );

    // Pre-classify all OSM road segments with @hexa/shields for both light & dark themes
    const roadFeatures: Feature[] = OSM_ROAD_SEGMENTS.map((seg) => {
      const lightClass = classifyRoad(seg, 'light');
      const darkClass = classifyRoad(seg, 'dark');
      const primaryShield = lightClass.shields.find(
        (s) => !s.isInternational && s.family !== 'TOLL_BADGE',
      ) ?? lightClass.shields[0];

      return {
        type: 'Feature',
        properties: {
          id: seg.id,
          name: seg.name,
          highway: seg.highway || 'road',
          ref: seg.ref || '',
          int_ref: seg.int_ref || '',
          network: seg.network || '',
          countryCode: seg.countryCode || '',
          functionalClass: lightClass.functionalClass,
          classesJson: JSON.stringify(lightClass.classes),
          officialDesignation: lightClass.officialDesignation || '',
          primarySpriteLight: lightClass.primarySpriteId || '',
          primarySpriteDark: darkClass.primarySpriteId || '',
          secondarySpriteLight: lightClass.secondarySpriteId || '',
          secondarySpriteDark: darkClass.secondarySpriteId || '',
          minZoomShield: primaryShield?.minZoom ?? 6,
          displayRef: primaryShield?.displayRef || seg.ref || '',
          isToll: lightClass.isToll,
          isBridge: lightClass.isBridge,
          isControlledAccess: lightClass.isControlledAccess,
          lanes: lightClass.lanes ?? 2,
          maxspeed: lightClass.maxspeed || '',
          confidence: lightClass.confidence,
          source: lightClass.source,
          shieldsJson: JSON.stringify(lightClass.shields),
        },
        geometry: {
          type: 'LineString',
          coordinates: seg.coordinates,
        },
      };
    });

    this.classifiedRoadsFc = {
      type: 'FeatureCollection',
      features: roadFeatures,
    };

    const transitFeatures: Feature[] = OSM_TRANSIT_CORRIDORS.flatMap((line) => {
      const lineFeat: Feature = {
        type: 'Feature',
        properties: {
          id: line.id,
          kind: 'line',
          name: line.lineName,
          shortName: line.lineShortName,
          vehicleType: line.vehicleType,
          color: line.color,
        },
        geometry: {
          type: 'LineString',
          coordinates: line.stops.map((s) => [s.lng, s.lat]),
        },
      };
      const stopFeats: Feature[] = line.stops.map((s) => ({
        type: 'Feature',
        properties: {
          id: s.id,
          kind: 'stop',
          name: s.name,
          lineShortName: line.lineShortName,
          vehicleType: line.vehicleType,
          color: line.color,
        },
        geometry: {
          type: 'Point',
          coordinates: [s.lng, s.lat],
        },
      }));
      return [lineFeat, ...stopFeats];
    });

    const placeFeatures: Feature[] = [
      ...world.places.map(
        (p): Feature => ({
          type: 'Feature',
          properties: {
            name: p.name,
            kind: p.capital ? 'capital' : p.pop >= 1_000_000 ? 'megacity' : 'city',
            pop: p.pop,
            scalerank: p.scalerank,
            iso2: p.iso2,
          },
          geometry: {
            type: 'Point',
            coordinates: [p.lng, p.lat],
          },
        }),
      ),
      ...OSM_POIS.map(
        (poi): Feature => ({
          type: 'Feature',
          properties: {
            id: poi.id,
            name: poi.name,
            kind: poi.category,
            pop: poi.category === 'city' ? 120_000 : 0,
            scalerank: poi.category === 'city' ? 5 : 9,
            iso2: poi.countryCode,
          },
          geometry: {
            type: 'Point',
            coordinates: [poi.lng, poi.lat],
          },
        }),
      ),
    ];

    const vtOpts = {
      maxZoom: 16,
      indexMaxZoom: 6,
      indexMaxPoints: 50000,
      tolerance: 3,
      extent: 4096,
      buffer: 64,
    };

    this.layerIndexes = {
      land: createGeojsonVt(normalizedLandFc as never, vtOpts) as unknown as GeojsonVtIndex,
      countries: createGeojsonVt(countriesFc as never, vtOpts) as unknown as GeojsonVtIndex,
      admin: createGeojsonVt(world.admin1Lines as never, vtOpts) as unknown as GeojsonVtIndex,
      water: createGeojsonVt(
        { type: 'FeatureCollection', features: waterPolygons } as never,
        vtOpts,
      ) as unknown as GeojsonVtIndex,
      rivers: createGeojsonVt(world.rivers as never, vtOpts) as unknown as GeojsonVtIndex,
      parks: createGeojsonVt(
        { type: 'FeatureCollection', features: parkPolygons } as never,
        vtOpts,
      ) as unknown as GeojsonVtIndex,
      roads: createGeojsonVt(this.classifiedRoadsFc as never, {
        ...vtOpts,
        tolerance: 1,
        buffer: 128,
      }) as unknown as GeojsonVtIndex,
      transit: createGeojsonVt(
        { type: 'FeatureCollection', features: transitFeatures } as never,
        vtOpts,
      ) as unknown as GeojsonVtIndex,
      places: createGeojsonVt(
        { type: 'FeatureCollection', features: placeFeatures } as never,
        vtOpts,
      ) as unknown as GeojsonVtIndex,
    };

    const fallbackGlyphPath = path.join(ASSETS_DIR, 'glyphs/NotoSansRegular/10752-11007.pbf');
    this.emptyGlyphPbf = fs.existsSync(fallbackGlyphPath)
      ? fs.readFileSync(fallbackGlyphPath)
      : Buffer.alloc(0);
  }

  public getVectorTilePbf(z: number, x: number, y: number): Buffer {
    if (z < 0 || z > 18 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
      return Buffer.alloc(0);
    }
    const tileLayers: Record<string, unknown> = {};
    for (const [layerName, index] of Object.entries(this.layerIndexes)) {
      const tile = index.getTile(z, x, y);
      if (tile && Array.isArray((tile as { features?: unknown[] }).features) && (tile as { features: unknown[] }).features.length > 0) {
        tileLayers[layerName] = tile;
      }
    }
    if (Object.keys(tileLayers).length === 0) {
      return Buffer.alloc(0);
    }
    const encoded = vtPbf.fromGeojsonVt(tileLayers as never, { version: 2 });
    return Buffer.from(encoded);
  }

  public getGlyphPbf(fontstack: string, range: string): Buffer {
    const cleanRange = range.replace(/\.pbf$/i, '');
    const normalizedStack = /bold/i.test(fontstack)
      ? 'NotoSansBold'
      : /medium/i.test(fontstack)
        ? 'NotoSansMedium'
        : 'NotoSansRegular';

    const candidate = path.join(ASSETS_DIR, 'glyphs', normalizedStack, `${cleanRange}.pbf`);
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate);
    }
    return this.emptyGlyphPbf;
  }

  public getClassifiedRoadsGeoJson(): FeatureCollection {
    return this.classifiedRoadsFc;
  }
}
