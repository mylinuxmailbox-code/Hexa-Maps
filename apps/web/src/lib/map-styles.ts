import type { StyleSpecification } from 'maplibre-gl';
import type { MapStyleDescriptor, MapStyleId } from '@hexa/shared';
import { ROAD_PALETTES } from '@hexa/shields';

const satelliteTileUrl = process.env.NEXT_PUBLIC_SATELLITE_TILE_URL || '';
const satelliteAttribution =
  process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION || '© Configured Imagery Provider';
const pmtilesUrl = process.env.NEXT_PUBLIC_PMTILES_URL || '';

export function getMapStyleDescriptors(): MapStyleDescriptor[] {
  const hasSatellite = Boolean(satelliteTileUrl.trim());
  return [
    {
      id: 'standard',
      label: 'Standard',
      description: 'Clean Hexa cartography with road classification & highway shields',
      available: true,
    },
    {
      id: 'dark',
      label: 'Dark',
      description: 'Low-glare night navigation theme with high-contrast shields',
      available: true,
    },
    {
      id: 'terrain',
      label: 'Terrain',
      description: 'Topographic relief tinting, watersheds, parks & road hierarchy',
      available: true,
    },
    {
      id: 'traffic',
      label: 'Traffic',
      description: 'Emphasizes corridor flow speeds and active road advisories',
      available: true,
    },
    {
      id: 'transit',
      label: 'Transit',
      description: 'Highlights commuter rail, metro, KTC bus corridors & stations',
      available: true,
    },
    {
      id: 'satellite',
      label: 'Satellite',
      description: hasSatellite
        ? 'Licensed aerial & satellite orthoimagery with hybrid road labels'
        : 'Unavailable — configure NEXT_PUBLIC_SATELLITE_TILE_URL',
      available: hasSatellite,
      unavailableReason: hasSatellite
        ? undefined
        : 'Satellite imagery requires a licensed raster tile provider (set NEXT_PUBLIC_SATELLITE_TILE_URL). Hexa Maps never fakes satellite mode by recoloring vector layers.',
    },
  ];
}

export interface BuildStyleOptions {
  styleId: MapStyleId;
  origin: string;
  showShields: boolean;
  showCyclingOverlay?: boolean;
}

/**
 * Generates a complete, self-contained MapLibre GL JS StyleSpecification
 * backed by `/api/v1/tiles/basemap/{z}/{x}/{y}.pbf` (or PMTiles when configured)
 * and `/api/v1/glyphs/{fontstack}/{range}.pbf`.
 */
export function buildHexaMapStyle(opts: BuildStyleOptions): StyleSpecification {
  const { styleId, origin, showShields } = opts;
  const isDark = styleId === 'dark';
  const isTerrain = styleId === 'terrain';
  const isTransit = styleId === 'transit';
  const isSatellite = styleId === 'satellite' && Boolean(satelliteTileUrl);

  const themeKey: 'light' | 'dark' = isDark ? 'dark' : 'light';
  const roadColors = ROAD_PALETTES[themeKey];

  const oceanColor = isDark ? '#0B1528' : isTerrain ? '#BFE0F5' : '#CBE4F9';
  const landColor = isDark ? '#111827' : isTerrain ? '#EEF3E3' : '#F6F5F0';
  const parkColor = isDark ? '#132A1E' : isTerrain ? '#C9E4B8' : '#DCF2D4';
  const borderColor = isDark ? '#334155' : '#94A3B8';
  const adminSubColor = isDark ? '#1E293B' : '#CBD5E1';
  const labelPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const labelHalo = isDark ? '#0B1120' : '#FFFFFF';

  const primarySpriteProp = isDark ? 'primarySpriteDark' : 'primarySpriteLight';
  const secondarySpriteProp = isDark ? 'secondarySpriteDark' : 'secondarySpriteLight';

  const tileSourceUrl = pmtilesUrl
    ? `pmtiles://${pmtilesUrl}`
    : `${origin}/api/v1/tiles/basemap/{z}/{x}/{y}.pbf`;

  const sources: StyleSpecification['sources'] = {
    hexa: {
      type: 'vector',
      tiles: pmtilesUrl ? undefined : [tileSourceUrl],
      url: pmtilesUrl ? tileSourceUrl : undefined,
      minzoom: 0,
      maxzoom: 16,
      attribution: '© OpenStreetMap contributors (ODbL) • Natural Earth (CC0)',
    },
  };

  if (isSatellite) {
    sources.satellite = {
      type: 'raster',
      tiles: [satelliteTileUrl],
      tileSize: 256,
      attribution: satelliteAttribution,
    };
  }

  const layers: StyleSpecification['layers'] = [
    {
      id: 'ocean-background',
      type: 'background',
      paint: {
        'background-color': oceanColor,
      },
    },
  ];

  if (isSatellite) {
    layers.push({
      id: 'satellite-raster',
      type: 'raster',
      source: 'satellite',
      paint: { 'raster-opacity': 1 },
    });
  } else {
    layers.push(
      {
        id: 'land-fill',
        type: 'fill',
        source: 'hexa',
        'source-layer': 'land',
        paint: {
          'fill-color': landColor,
        },
      },
      {
        id: 'countries-fill',
        type: 'fill',
        source: 'hexa',
        'source-layer': 'countries',
        paint: {
          'fill-color': isTerrain ? '#E6EED8' : landColor,
          'fill-opacity': isTerrain ? 0.55 : 0.2,
        },
      },
      {
        id: 'parks-fill',
        type: 'fill',
        source: 'hexa',
        'source-layer': 'parks',
        paint: {
          'fill-color': parkColor,
          'fill-opacity': 0.85,
        },
      },
      {
        id: 'rivers-line',
        type: 'line',
        source: 'hexa',
        'source-layer': 'rivers',
        paint: {
          'line-color': oceanColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.7, 8, 1.8, 13, 3.5],
        },
      },
      {
        id: 'water-fill',
        type: 'fill',
        source: 'hexa',
        'source-layer': 'water',
        paint: {
          'fill-color': oceanColor,
        },
      },
    );
  }

  // Country & State/Province Administrative Boundaries
  layers.push(
    {
      id: 'admin-state-lines',
      type: 'line',
      source: 'hexa',
      'source-layer': 'admin',
      paint: {
        'line-color': adminSubColor,
        'line-dasharray': [3, 2],
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1.1],
      },
    },
    {
      id: 'country-borders',
      type: 'line',
      source: 'hexa',
      'source-layer': 'countries',
      paint: {
        'line-color': borderColor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 1.3, 10, 1.8],
      },
    },
  );

  // Road Hierarchy — Casings then Fills (Expressways, Motorways, National, State, Primary, Secondary, Local)
  layers.push(
    {
      id: 'roads-casing',
      type: 'line',
      source: 'hexa',
      'source-layer': 'roads',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': [
          'match',
          ['get', 'functionalClass'],
          'expressway',
          roadColors.expresswayCasing,
          'motorway',
          roadColors.motorwayCasing,
          'national_highway',
          roadColors.nationalCasing,
          'state_highway',
          roadColors.stateCasing,
          'primary',
          roadColors.primaryCasing,
          'secondary',
          roadColors.secondaryCasing,
          roadColors.localCasing,
        ],
        'line-width': [
          'interpolate',
          ['exponential', 1.35],
          ['zoom'],
          3,
          [
            'match',
            ['get', 'functionalClass'],
            ['expressway', 'motorway'],
            2.2,
            'national_highway',
            1.7,
            0.8,
          ],
          8,
          [
            'match',
            ['get', 'functionalClass'],
            'expressway',
            6.2,
            'motorway',
            5.6,
            'national_highway',
            4.8,
            'state_highway',
            3.8,
            'primary',
            3.2,
            2.2,
          ],
          14,
          [
            'match',
            ['get', 'functionalClass'],
            'expressway',
            15,
            'motorway',
            13.5,
            'national_highway',
            12,
            'state_highway',
            9.5,
            'primary',
            8.5,
            6,
          ],
        ],
      },
    },
    {
      id: 'roads-fill',
      type: 'line',
      source: 'hexa',
      'source-layer': 'roads',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': [
          'match',
          ['get', 'functionalClass'],
          'expressway',
          roadColors.expresswayFill,
          'motorway',
          roadColors.motorwayFill,
          'national_highway',
          roadColors.nationalFill,
          'state_highway',
          roadColors.stateFill,
          'primary',
          roadColors.primaryFill,
          'secondary',
          roadColors.secondaryFill,
          'service_road',
          roadColors.serviceFill,
          roadColors.localFill,
        ],
        'line-width': [
          'interpolate',
          ['exponential', 1.35],
          ['zoom'],
          3,
          [
            'match',
            ['get', 'functionalClass'],
            ['expressway', 'motorway'],
            1.3,
            'national_highway',
            1.0,
            0.4,
          ],
          8,
          [
            'match',
            ['get', 'functionalClass'],
            'expressway',
            4.2,
            'motorway',
            3.8,
            'national_highway',
            3.2,
            'state_highway',
            2.4,
            'primary',
            2.0,
            1.3,
          ],
          14,
          [
            'match',
            ['get', 'functionalClass'],
            'expressway',
            11.5,
            'motorway',
            10,
            'national_highway',
            8.8,
            'state_highway',
            6.8,
            'primary',
            6,
            4,
          ],
        ],
      },
    },
  );

  // Cycling friendly secondary/local highlight overlay when requested
  if (opts.showCyclingOverlay) {
    layers.push({
      id: 'cycling-lanes-overlay',
      type: 'line',
      source: 'hexa',
      'source-layer': 'roads',
      filter: ['==', ['get', 'isControlledAccess'], false],
      paint: {
        'line-color': '#10B981',
        'line-dasharray': [2, 2],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 3.2],
      },
    });
  }

  // Public Transit Corridors & Station Stops (always subtle, bold in Transit mode)
  layers.push(
    {
      id: 'transit-corridors-line',
      type: 'line',
      source: 'hexa',
      'source-layer': 'transit',
      filter: ['==', ['get', 'kind'], 'line'],
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#0EA5E9'],
        'line-opacity': isTransit ? 0.95 : 0.35,
        'line-dasharray': [3, 1.5],
        'line-width': isTransit
          ? ['interpolate', ['linear'], ['zoom'], 7, 2.5, 13, 5]
          : ['interpolate', ['linear'], ['zoom'], 9, 1.2, 13, 2.2],
      },
    },
    {
      id: 'transit-stops-circle',
      type: 'circle',
      source: 'hexa',
      'source-layer': 'transit',
      minzoom: isTransit ? 8 : 11,
      filter: ['==', ['get', 'kind'], 'stop'],
      paint: {
        'circle-radius': isTransit ? 5.5 : 3.5,
        'circle-color': '#FFFFFF',
        'circle-stroke-width': 2,
        'circle-stroke-color': ['coalesce', ['get', 'color'], '#0EA5E9'],
      },
    },
  );

  // Road Name Text Labels along lines
  layers.push({
    id: 'roads-name-label',
    type: 'symbol',
    source: 'hexa',
    'source-layer': 'roads',
    minzoom: 9,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 320,
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Medium'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 14, 12.5],
      'text-max-angle': 30,
    },
    paint: {
      'text-color': isDark ? '#CBD5E1' : '#334155',
      'text-halo-color': labelHalo,
      'text-halo-width': 1.6,
    },
  });

  // GPU WebGL Highway Shields — Primary & International Co-Corridor Shields!
  if (showShields) {
    layers.push(
      {
        id: 'highway-shields-primary',
        type: 'symbol',
        source: 'hexa',
        'source-layer': 'roads',
        minzoom: 4,
        filter: [
          'all',
          ['!=', ['get', primarySpriteProp], ''],
          ['>=', ['zoom'], ['get', 'minZoomShield']],
        ],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 260,
          'icon-image': ['get', primarySpriteProp],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.68, 8, 0.84, 13, 1.0],
          'icon-rotation-alignment': 'viewport',
          'icon-pitch-alignment': 'viewport',
          'icon-padding': 8,
          // Fallback text label if sprite ever fails to synthesize
          'text-field': ['get', 'displayRef'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 0,
        },
      },
      {
        id: 'highway-shields-international',
        type: 'symbol',
        source: 'hexa',
        'source-layer': 'roads',
        minzoom: 6,
        filter: ['!=', ['get', secondarySpriteProp], ''],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 360,
          'icon-image': ['get', secondarySpriteProp],
          'icon-offset': [0, 34],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.72, 12, 0.92],
          'icon-rotation-alignment': 'viewport',
          'icon-pitch-alignment': 'viewport',
          'icon-padding': 10,
        },
      },
    );
  }

  // City, Capital & Landmark Labels
  layers.push({
    id: 'places-label',
    type: 'symbol',
    source: 'hexa',
    'source-layer': 'places',
    layout: {
      'symbol-sort-key': ['get', 'scalerank'],
      'text-field': ['get', 'name'],
      'text-font': [
        'match',
        ['get', 'kind'],
        ['capital', 'megacity', 'city'],
        ['literal', ['Noto Sans Bold']],
        ['literal', ['Noto Sans Regular']],
      ],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        2,
        ['match', ['get', 'kind'], 'capital', 11, 'megacity', 10.5, 9],
        8,
        ['match', ['get', 'kind'], 'capital', 14.5, 'megacity', 13.5, 'city', 12.5, 11],
        13,
        ['match', ['get', 'kind'], 'capital', 17, 'city', 15, 12],
      ],
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 0.55,
      'text-padding': 4,
    },
    paint: {
      'text-color': labelPrimary,
      'text-halo-color': labelHalo,
      'text-halo-width': 1.8,
    },
  });

  return {
    version: 8,
    name: `Hexa Maps — ${styleId}`,
    glyphs: `${origin}/api/v1/glyphs/{fontstack}/{range}.pbf`,
    sources,
    layers,
  };
}
