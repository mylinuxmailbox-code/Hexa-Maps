# Hexa Maps — System Architecture

## 1. Monorepo & Domain Separation

Hexa Maps enforces strict separation between map rendering, geospatial classification, external provider adapters, spatial persistence, and API transport:

1. **`@hexa/shared` (`packages/shared`)**
   - Pure TypeScript + Zod contracts shared by `@hexa/api` and `@hexa/web`.
   - Implements WGS84 spherical haversine distance, forward bearing, polyline bounding boxes, Web Mercator `lonLatToTileXY`, bbox tile enumeration (`enumerateTilesInBbox`), and human-friendly coordinate parsing (`15.5912, 73.8080` or `15.5912° N, 73.8080° E`).
2. **`@hexa/shields` (`packages/shields`)**
   - Multi-dimensional OpenStreetMap highway classifier and vector SVG shield generator.
   - Completely independent of React or Fastify so it runs identically on the backend (enriching MVT vector tiles, search hits, and turn-by-turn routing maneuvers) and on the frontend (synthesizing Retina `2x` WebGL sprites and rendering inline route badges).
3. **`@hexa/api` (`apps/api`)**
   - Fastify 5 HTTP server with `@fastify/swagger` OpenAPI 3.0 generation, `@fastify/helmet`, `@fastify/cors`, `@fastify/cookie`, `@fastify/rate-limit`, and `Socket.IO` real-time pub/sub.
   - Modular domain services under `apps/api/src/modules/{tiles,geocode,routing,traffic,incidents,auth,places,imagery}`.
4. **`@hexa/web` (`apps/web`)**
   - Next.js 15 App Router client shell with a persistent, single-instance **MapLibre GL JS** canvas (`MapCanvas.tsx`), Zustand UI/viewport state (`map-store.ts`), TanStack Query caching, IndexedDB + Cache Storage offline tile manager (`offline-db.ts`), and Service Worker (`public/sw.js`).

---

## 2. Highway Classification & GPU Shield Architecture

### Multi-Dimensional Road Model
Unlike naive map styles that conflate `highway=*` with route shields, `@hexa/shields` separates five orthogonal dimensions:
- **`roadClass`** (20+ classes): `motorway`, `expressway`, `trunk`, `national_highway`, `state_highway`, `primary`, `secondary`, `tertiary`, `district_road`, `urban_arterial`, `residential`, `service`, `living_street`, `pedestrian`, `cycleway`, `footway`, `track`, `ferry`, `bridge`, `tunnel`, `toll_road`, `unclassified`.
- **Normalized Route References (`routeRefs`)**: Splits semicolon/slash multi-ref strings (`NH 66;AH47`, `I-95 / US 1`), extracts country/network prefixes, separates international corridors (`AH1`, `E40`) from national/state shields, and attaches `confidence: 'verified' | 'inferred' | 'fallback_name_only'` + `source: 'osm_relation_network' | 'osm_way_ref' | 'country_prefix_heuristic' | 'road_name_pattern'`.
- **Access, Structure & Toll Metadata**: Evaluates `toll`, `bridge`, `tunnel`, `oneway`, `lanes`, `surface`, and `maxspeed`.

### Zero-DOM-Clutter MapLibre Symbol Rendering
Rendering highway shields as HTML `<div>` markers causes severe layout thrashing when zooming out over dense highway networks. Instead:
1. Every classified road in the `roads` MVT vector tile layer carries a deterministic `shield_id` property (`shield:{family}:{header}:{code}`) and `shield_text`.
2. The MapLibre style (`map-styles.ts`) binds a GPU `symbol` layer (`symbol-placement: 'line'`, `symbol-spacing: 300`, `icon-image: ['concat', ['get', 'shield_id'], ':{theme}']`) with zoom-interpolated `icon-size` and label priority rules.
3. When a tile enters the viewport, MapLibre fires `styleimagemissing` once per unique shield code. `MapCanvas.tsx` calls `renderShieldBySpriteId()` in `@hexa/shields`, rasterizes the bespoke vector SVG onto an offscreen `2x` canvas, and registers it into WebGL texture memory (`pixelRatio: 2`). Thousands of repeating highway shields then render at 60 FPS on the GPU.

---

## 3. Spatial Database Strategy (PostgreSQL / PostGIS + Embedded PGlite)

Hexa Maps uses a dual-compatible PostgreSQL spatial layer (`apps/api/src/db/`):
- **Base Migration (`0001_init.sql`)**: Enables PostgreSQL `cube` and `earthdistance` extensions and builds `GIST (ll_to_earth(lat, lng))` spatial indexes on `incidents` and `saved_places`. Bounding-box and radius queries use index-accelerated `earth_box(ll_to_earth($lat, $lng), $radiusMeters) @> ll_to_earth(lat, lng)` plus exact `earth_distance(...)` filtering.
- **PostGIS Upgrade (`0002_postgis_upgrade.sql`)**: Automatically executed when `pg_available_extensions` reports `postgis` (such as `postgis/postgis:16-3.4` in `docker-compose.yml`). Adds `geom GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED` and `GIST (geom)` indexes.
- **Zero-Setup Local Fallback**: When `DATABASE_URL` is unset, `@electric-sql/pglite` runs the exact same PostgreSQL 16 engine + `cube` + `earthdistance` extensions embedded in Node.js (persisted on disk or `memory://` in tests).

---

## 4. Scaling & Operational Cost Considerations

| Component | Small / Regional Self-Hosted | Global Planet Scale |
| :--- | :--- | :--- |
| **Vector Basemap Tiles** | Built-in dynamic MVT server or regional `.pmtiles` file on S3/Cloudflare R2 ($0–$5/mo, HTTP Range requests, zero tile server CPU). | Planet Protomaps `.pmtiles` (~120 GB object on R2/S3 behind CDN) — avoids $500+/mo PostGIS dynamic tile rendering clusters. |
| **Geocoding** | Photon or Nominatim regional extract (4–8 GB RAM) + Redis query cache. | Dedicated Photon/Pelias cluster (~64 GB RAM SSD) with aggressive CDN/Redis autocomplete prefix caching. |
| **Routing Engine** | OSRM MLD or Valhalla regional `.osm.pbf` graph (2–8 GB RAM). | Valhalla tiled hierarchy on NVMe (supports dynamic costing & avoid-tolls without full CH rebuilds) + OTP2 for metropolitan GTFS feeds. |
| **Incidents & Real-Time** | Single Fastify + PostGIS instance + Socket.IO viewport rooms (`region:latBucket:lngBucket`). | `@socket.io/redis-adapter` across horizontal Fastify pods + PostGIS partitioned `incidents_archive` table for expired telemetry. |
