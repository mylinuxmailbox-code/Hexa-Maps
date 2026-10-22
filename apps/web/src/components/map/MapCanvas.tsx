'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol as PMTilesProtocol } from 'pmtiles';
import { renderShieldBySpriteId, svgToDataUrl } from '@hexa/shields';
import type { TrafficResponse } from '@hexa/shared';
import { buildHexaMapStyle } from '@/lib/map-styles';
import { hexaApi } from '@/lib/api-client';
import { useMapStore, type InspectedRoadFeature } from '@/store/map-store';

let pmtilesProtocolRegistered = false;

async function rasterizeShieldToMap(map: maplibregl.Map, spriteId: string) {
  if (map.hasImage(spriteId)) return;
  const rendered = renderShieldBySpriteId(spriteId);
  const pixelRatio = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(rendered.width * pixelRatio);
  canvas.height = Math.ceil(rendered.height * pixelRatio);
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return;

  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = svgToDataUrl(rendered.svg);
  });

  if (!map.hasImage(spriteId)) {
    const imageData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
    map.addImage(
      spriteId,
      { width: canvas.width, height: canvas.height, data: imageData.data },
      { pixelRatio },
    );
  }
}

function ensureOverlayLayers(map: maplibregl.Map) {
  if (!map.getSource('traffic-overlay-source')) {
    map.addSource('traffic-overlay-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'traffic-overlay-line',
      type: 'line',
      source: 'traffic-overlay-source',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'match',
          ['get', 'congestion'],
          'flowing',
          '#10B981',
          'moderate',
          '#F59E0B',
          'heavy',
          '#F97316',
          'severe',
          '#DC2626',
          '#10B981',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 11, 5, 15, 8],
        'line-opacity': 0.88,
      },
    });
  }

  if (!map.getSource('routes-overlay-source')) {
    map.addSource('routes-overlay-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'routes-alt-line',
      type: 'line',
      source: 'routes-overlay-source',
      filter: ['==', ['get', 'selected'], false],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#64748B',
        'line-width': 6,
        'line-opacity': 0.65,
      },
    });
    map.addLayer({
      id: 'routes-selected-casing',
      type: 'line',
      source: 'routes-overlay-source',
      filter: ['==', ['get', 'selected'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#1E3A8A',
        'line-width': 9.5,
      },
    });
    map.addLayer({
      id: 'routes-selected-line',
      type: 'line',
      source: 'routes-overlay-source',
      filter: ['==', ['get', 'selected'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#3B82F6',
        'line-width': 6,
      },
    });
  }

  if (!map.getSource('waypoints-overlay-source')) {
    map.addSource('waypoints-overlay-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'waypoints-circle',
      type: 'circle',
      source: 'waypoints-overlay-source',
      paint: {
        'circle-radius': ['match', ['get', 'role'], 'origin', 7.5, 'destination', 8.5, 6.5],
        'circle-color': [
          'match',
          ['get', 'role'],
          'origin',
          '#10B981',
          'destination',
          '#EF4444',
          '#F59E0B',
        ],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#FFFFFF',
      },
    });
  }

  if (!map.getSource('selected-place-source')) {
    map.addSource('selected-place-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'selected-place-halo',
      type: 'circle',
      source: 'selected-place-source',
      paint: {
        'circle-radius': 18,
        'circle-color': '#F59E0B',
        'circle-opacity': 0.25,
      },
    });
    map.addLayer({
      id: 'selected-place-pin',
      type: 'circle',
      source: 'selected-place-source',
      paint: {
        'circle-radius': 8.5,
        'circle-color': '#F59E0B',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#111827',
      },
    });
  }

  if (!map.getSource('incidents-overlay-source')) {
    map.addSource('incidents-overlay-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 42,
    });
    map.addLayer({
      id: 'incidents-clusters',
      type: 'circle',
      source: 'incidents-overlay-source',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#F59E0B',
        'circle-radius': ['step', ['get', 'point_count'], 15, 5, 19, 15, 24],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#111827',
      },
    });
    map.addLayer({
      id: 'incidents-cluster-count',
      type: 'symbol',
      source: 'incidents-overlay-source',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Noto Sans Bold'],
        'text-size': 11,
      },
      paint: {
        'text-color': '#111827',
      },
    });
    map.addLayer({
      id: 'incidents-points',
      type: 'circle',
      source: 'incidents-overlay-source',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 8.5,
        'circle-color': [
          'match',
          ['get', 'severity'],
          'critical',
          '#DC2626',
          'high',
          '#EA580C',
          'moderate',
          '#F59E0B',
          '#0EA5E9',
        ],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#FFFFFF',
      },
    });
  }
}

export function MapCanvas({
  mapRefOut,
  trafficData,
}: {
  mapRefOut: React.MutableRefObject<maplibregl.Map | null>;
  trafficData: TrafficResponse | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const inflightSprites = useRef<Set<string>>(new Set());

  const mapStyle = useMapStore((s) => s.mapStyle);
  const showShieldsOnMap = useMapStore((s) => s.showShieldsOnMap);
  const showCyclingOverlay = useMapStore((s) => s.showCyclingOverlay);
  const showTrafficOverlay = useMapStore((s) => s.showTrafficOverlay);
  const flyToCommand = useMapStore((s) => s.flyToCommand);
  const routes = useMapStore((s) => s.routes);
  const selectedRouteIndex = useMapStore((s) => s.selectedRouteIndex);
  const waypoints = useMapStore((s) => s.waypoints);
  const selectedPlace = useMapStore((s) => s.selectedPlace);
  const incidents = useMapStore((s) => s.incidents);
  const activeTab = useMapStore((s) => s.activeTab);

  // 1. Initialize single persistent MapLibre GL JS instance once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!pmtilesProtocolRegistered) {
      const protocol = new PMTilesProtocol();
      maplibregl.addProtocol('pmtiles', protocol.tile);
      pmtilesProtocolRegistered = true;
    }

    const initialState = useMapStore.getState();
    const origin = window.location.origin;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildHexaMapStyle({
        styleId: initialState.mapStyle,
        origin,
        showShields: initialState.showShieldsOnMap,
        showCyclingOverlay: initialState.showCyclingOverlay,
      }),
      center: [initialState.lng, initialState.lat],
      zoom: initialState.zoom,
      bearing: initialState.bearing,
      pitch: initialState.pitch,
      attributionControl: false,
      maxPitch: 65,
    });

    mapRef.current = map;
    mapRefOut.current = map;

    // Synthesize 2x Retina Highway Shield sprites dynamically on GPU demand
    map.on('styleimagemissing', (e) => {
      const id = e.id;
      if (!id.startsWith('shield:') || inflightSprites.current.has(id)) return;
      inflightSprites.current.add(id);
      void rasterizeShieldToMap(map, id).finally(() => {
        inflightSprites.current.delete(id);
      });
    });

    const syncOverlays = () => {
      ensureOverlayLayers(map);
      syncDynamicDataToMap(map, trafficDataRef.current);
    };

    map.on('load', syncOverlays);
    map.on('styledata', () => {
      if (map.isStyleLoaded()) {
        syncOverlays();
      }
    });

    map.on('moveend', () => {
      const c = map.getCenter();
      const b = map.getBounds();
      useMapStore.getState().setViewport({
        lat: c.lat,
        lng: c.lng,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      });
    });

    // Click handlers for Incident location picker, Clusters, Incidents, and Road Classification Inspector
    map.on('click', (e) => {
      const st = useMapStore.getState();
      if (st.pickingIncidentLocation) {
        st.setPendingIncidentCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        st.setPickingIncidentLocation(false);
        st.setActiveTab('incidents');
        return;
      }

      const queryLayers = [
        'incidents-clusters',
        'incidents-points',
        'routes-alt-line',
        'highway-shields-primary',
        'roads-fill',
      ].filter((id) => Boolean(map.getLayer(id)));

      const features = map.queryRenderedFeatures(e.point, { layers: queryLayers });
      const top = features[0];
      if (!top) return;

      if (top.layer.id === 'incidents-clusters') {
        map.easeTo({
          center: e.lngLat,
          zoom: Math.min(15, map.getZoom() + 2.2),
          duration: 450,
        });
        return;
      }

      if (top.layer.id === 'incidents-points') {
        st.setActiveTab('incidents');
        return;
      }

      if (top.layer.id === 'routes-alt-line') {
        const idx = Number(top.properties?.routeIndex ?? 0);
        st.setSelectedRouteIndex(idx);
        return;
      }

      if (top.layer.id === 'roads-fill' || top.layer.id === 'highway-shields-primary') {
        const p = top.properties ?? {};
        let parsedClasses: string[] = [];
        let parsedShields: InspectedRoadFeature['shields'] = [];
        try {
          parsedClasses = JSON.parse(String(p.classesJson || '[]'));
        } catch {
          parsedClasses = [];
        }
        try {
          parsedShields = JSON.parse(String(p.shieldsJson || '[]'));
        } catch {
          parsedShields = [];
        }

        st.setInspectedRoad({
          id: String(p.id || ''),
          name: String(p.name || 'Unnamed Road'),
          highway: String(p.highway || 'road'),
          ref: String(p.ref || ''),
          int_ref: String(p.int_ref || ''),
          network: String(p.network || ''),
          countryCode: String(p.countryCode || ''),
          functionalClass: String(p.functionalClass || 'local_street'),
          officialDesignation: String(p.officialDesignation || ''),
          classes: parsedClasses,
          isToll: Boolean(p.isToll),
          isBridge: Boolean(p.isBridge),
          isControlledAccess: Boolean(p.isControlledAccess),
          lanes: Number(p.lanes || 2),
          maxspeed: String(p.maxspeed || ''),
          confidence: p.confidence === 'verified' ? 'verified' : 'inferred',
          source: String(p.source || 'osm_highway_tag_fallback'),
          shields: parsedShields,
        });
        st.setActiveTab('explore');
      }
    });

    // Right-click (contextmenu) anywhere on map -> Reverse Geocode!
    map.on('contextmenu', async (e) => {
      try {
        const res = await hexaApi.reverseGeocode({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        if (res.place) {
          useMapStore.getState().selectPlace(res.place);
        }
      } catch {
        // Ignore transient offline reverse-geocode error
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      mapRefOut.current = null;
    };
  }, [mapRefOut]);

  // Keep latest trafficData ref accessible inside styledata callback
  const trafficDataRef = useRef<TrafficResponse | null>(trafficData);
  trafficDataRef.current = trafficData;

  // 2. Update MapLibre style specification when theme / layer toggles change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const styleSpec = buildHexaMapStyle({
      styleId: mapStyle,
      origin: window.location.origin,
      showShields: showShieldsOnMap,
      showCyclingOverlay,
    });
    map.setStyle(styleSpec);
  }, [mapStyle, showShieldsOnMap, showCyclingOverlay]);

  // 3. Fly to target coordinates smoothly when requested
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToCommand) return;
    map.flyTo({
      center: [flyToCommand.lng, flyToCommand.lat],
      zoom: flyToCommand.zoom,
      duration: 950,
      essential: true,
    });
  }, [flyToCommand]);

  // 4. Auto-fit route bounding box when new routes arrive
  useEffect(() => {
    const map = mapRef.current;
    const activeRoute = routes[selectedRouteIndex];
    if (!map || !activeRoute || activeTab !== 'directions') return;
    const [w, s, e, n] = activeRoute.bbox;
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      {
        padding: { top: 80, bottom: 90, left: window.innerWidth >= 768 ? 430 : 45, right: 65 },
        duration: 850,
      },
    );
  }, [routes, selectedRouteIndex, activeTab]);

  // 5. Sync GeoJSON sources (Routes, Waypoints, Selected Place, Incidents, Traffic)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    ensureOverlayLayers(map);
    syncDynamicDataToMap(map, trafficData);
  }, [
    routes,
    selectedRouteIndex,
    waypoints,
    selectedPlace,
    incidents,
    trafficData,
    showTrafficOverlay,
    mapStyle,
    activeTab,
  ]);

  return (
    <div
      ref={containerRef}
      data-testid="hexa-map-canvas"
      aria-label="Hexa Maps interactive world map"
      className="fixed inset-0 h-full w-full outline-none"
    />
  );
}

function syncDynamicDataToMap(map: maplibregl.Map, trafficData: TrafficResponse | null) {
  const st = useMapStore.getState();

  const routeSource = map.getSource('routes-overlay-source') as GeoJSONSource | undefined;
  if (routeSource) {
    routeSource.setData({
      type: 'FeatureCollection',
      features:
        st.activeTab === 'directions'
          ? st.routes.map((r, idx) => ({
              type: 'Feature',
              properties: {
                id: r.id,
                routeIndex: idx,
                selected: idx === st.selectedRouteIndex,
              },
              geometry: r.geometry,
            }))
          : [],
    });
  }

  const wpSource = map.getSource('waypoints-overlay-source') as GeoJSONSource | undefined;
  if (wpSource) {
    const validWps =
      st.activeTab === 'directions'
        ? st.waypoints.filter((w) => w.lat !== null && w.lng !== null)
        : [];
    wpSource.setData({
      type: 'FeatureCollection',
      features: validWps.map((w, idx) => ({
        type: 'Feature',
        properties: {
          role: idx === 0 ? 'origin' : idx === validWps.length - 1 ? 'destination' : 'stop',
          label: w.label,
        },
        geometry: {
          type: 'Point',
          coordinates: [w.lng!, w.lat!],
        },
      })),
    });
  }

  const placeSource = map.getSource('selected-place-source') as GeoJSONSource | undefined;
  if (placeSource) {
    placeSource.setData({
      type: 'FeatureCollection',
      features: st.selectedPlace
        ? [
            {
              type: 'Feature',
              properties: { name: st.selectedPlace.name },
              geometry: {
                type: 'Point',
                coordinates: [st.selectedPlace.coordinates.lng, st.selectedPlace.coordinates.lat],
              },
            },
          ]
        : [],
    });
  }

  const incidentSource = map.getSource('incidents-overlay-source') as GeoJSONSource | undefined;
  if (incidentSource) {
    incidentSource.setData({
      type: 'FeatureCollection',
      features: st.incidents.map((inc) => ({
        type: 'Feature',
        properties: {
          id: inc.id,
          title: inc.title,
          category: inc.category,
          severity: inc.severity,
        },
        geometry: {
          type: 'Point',
          coordinates: [inc.coordinates.lng, inc.coordinates.lat],
        },
      })),
    });
  }

  const trafficSource = map.getSource('traffic-overlay-source') as GeoJSONSource | undefined;
  if (trafficSource) {
    const show = st.showTrafficOverlay || st.mapStyle === 'traffic';
    trafficSource.setData({
      type: 'FeatureCollection',
      features:
        show && trafficData
          ? trafficData.segments.map((seg) => ({
              type: 'Feature',
              properties: {
                id: seg.id,
                congestion: seg.congestion,
              },
              geometry: {
                type: 'LineString',
                coordinates: seg.coordinates,
              },
            }))
          : [],
    });
  }
}
