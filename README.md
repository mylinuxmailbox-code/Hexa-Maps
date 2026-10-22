# Hexa Maps

<p align="left">
  <img src="apps/web/public/icons/hexa-logo.svg" width="76" alt="Hexa Maps Hexagonal Route Emblem" />
</p>

**Hexa Maps** is an open-source, production-architected web mapping, multimodal routing, traffic/community incident reporting, and offline-capable Progressive Web App built on **OpenStreetMap**, **MapLibre GL JS**, **Fastify**, and **PostgreSQL / PostGIS**.

It combines Google Maps-style place discovery, turn-by-turn directions, and map layers with Waze-style live community road incident reporting and an original **International Vector Highway Classification & GPU Shield Rendering System** covering 18+ national and international corridor networks—including first-class support for Indian National Highways (`NH 66`, `NH 48`, `NH 44`, `NH 16`, `NH 27`), State Highways (`SH 1`, `SH 8`, `SH 17`), and Expressways (`Mumbai–Pune Expressway`, `Delhi–Mumbai Expressway`, `Yamuna Expressway`, `Purvanchal Expressway`).

---

## Architecture Overview

Hexa Maps is organized as a strict TypeScript npm workspace monorepo with clean domain boundaries:

```text
Hexa-Maps/
├── packages/
│   ├── shared/      # @hexa/shared — Zod API contracts, WGS84 spherical geometry, tile math
│   └── shields/     # @hexa/shields — 20-class OSM road classifier, route normalizer, 18-country SVG shield engine
├── apps/
│   ├── api/         # @hexa/api — Fastify 5 + Socket.IO + OpenAPI + PostgreSQL/PostGIS (with zero-setup PGlite fallback)
│   └── web/         # @hexa/web — Next.js 15 App Router + MapLibre GL JS + Zustand + React Query + PWA offline worker
├── scripts/
│   └── bootstrap-geodata.mjs  # Builds offline vector geodata & Noto Sans PBF glyphs from open datasets
├── docs/
│   ├── ARCHITECTURE.md        # System design, GPU shield rendering, provider architecture & scaling costs
│   ├── API.md                 # Versioned /api/v1 REST & Socket.IO real-time API reference
│   └── DEPLOYMENT.md          # Docker Compose, PostGIS, security hardening, OSM license compliance & backups
└── docker-compose.yml         # Full PostGIS 16 + Redis 7 + API + Web stack
```

---

## Quick Start (Zero API Keys Required)

Hexa Maps runs out of the box on a fresh clone with **zero external API keys and zero external Docker dependencies** required for local development:
- When `DATABASE_URL` is omitted, `@hexa/api` automatically boots an embedded **PostgreSQL (`@electric-sql/pglite`)** engine with `cube` + `earthdistance` GiST spatial indexes (`earth_box`) and runs the exact SQL migrations in `apps/api/migrations/`.
- Local MVT `.pbf` vector tiles (`land`, `countries`, `admin`, `water`, `rivers`, `parks`, `roads`, `transit`, `places`) and Noto Sans `.pbf` glyphs are served directly by `@hexa/api` from `apps/api/assets/`, so MapLibre renders crisply even inside air-gapped or restricted network sandboxes.

### 1. Install & Run Locally

```bash
cp .env.example .env
npm install

# Run both @hexa/api (0.0.0.0:4000) and @hexa/web (0.0.0.0:3000) concurrently:
npm run dev
```

Open **`http://localhost:3000`** in your browser. Next.js automatically proxies `/api/v1/*`, `/api/socket.io/*`, and `/api/docs/*` to the Fastify backend so browser code uses clean relative URLs everywhere.

### 2. Run with Full PostgreSQL 16 + PostGIS 3.4 + Redis 7 (Docker Compose)

```bash
cp .env.example .env
docker compose up --build -d
```

When `DATABASE_URL` points to PostGIS, `@hexa/api` automatically applies `0002_postgis_upgrade.sql`, provisioning `GEOGRAPHY(Point, 4326)` generated columns and `GIST` indexes across `incidents` and `saved_places`.

---

## Feature Matrix & Honest Capability States

Hexa Maps never fakes unavailable data or fabricates business metadata:

| Domain | Included Out of the Box | External Adapter Support | Honest Behavior / Limitations |
| :--- | :--- | :--- | :--- |
| **Vector Basemap & Styles** | Standard, Dark, Terrain, Traffic, Transit styles; local MVT `.pbf` tile generator + PBF glyphs | Custom `NEXT_PUBLIC_PMTILES_URL` & `NEXT_PUBLIC_SATELLITE_TILES_URL` | **Satellite** style is explicitly disabled with an explanation unless `NEXT_PUBLIC_SATELLITE_TILES_URL` is configured (never simulated via fake color swaps). |
| **Highway Classification & Shields** | 20+ road classes, `verified` vs `inferred` confidence, 18+ country/international SVG shields rendered as Retina `2x` WebGL symbol sprites & inline route badges | Custom OSM tags via `POST /api/v1/roads/classify` | Unnumbered streets never receive fabricated route shields; road names fall back cleanly along geometry. |
| **Search & Geocoding** | Forward search, autocomplete, reverse geocoding, coordinate parsing, category filters, verified place metadata | **Photon** (`PHOTON_BASE_URL`) & **Nominatim** (`NOMINATIM_BASE_URL`) with compliant `User-Agent` & caching | Never invents business phone numbers, ratings, reviews, or opening hours not present in source data. |
| **Routing & Navigation** | Multi-stop waypoints, drag/reorder, reverse, route alternatives, avoid-tolls, turn-by-turn steps with inline highway shields, shareable URLs | **OSRM** (`OSRM_BASE_URL`), **Valhalla** (`VALHALLA_BASE_URL`), **OpenTripPlanner** (`OTP_BASE_URL`) | **Public Transit** routing requires `OTP_BASE_URL` and displays a transparent configuration notice rather than fake GTFS schedules when unconfigured. |
| **Traffic & Live Incidents** | 4-level traffic severity overlay (`flowing`, `moderate`, `heavy`, `severe`); 9-category Waze-style spatial incidents with deduplication, confirmations, expiration & Socket.IO viewport push | **TomTom Traffic Flow** (`TOMTOM_TRAFFIC_API_KEY`) | Traffic badge explicitly labels `Simulated` vs `Cached` vs `Live Provider` freshness and differentiates `Community` vs `Official` incident reports. |
| **Accounts, Privacy & Guest Mode** | Full guest browsing/routing/local pins; optional `scrypt` authentication, HTTP-only sessions, password reset flow, preferences, search history toggle/clear, full account deletion | PostgreSQL / PostGIS + Redis rate-limit / cache store | Guest saved pins live locally until sign-in; authenticated users can wipe history or delete their account permanently in one click. |
| **Offline Maps & PWA** | Web App Manifest, Service Worker (`public/sw.js`), IndexedDB region metadata + `CacheStorage` vector `.pbf` downloader with progress, cancel & delete | Any configured MVT/PMTiles source | Explicitly distinguishes **offline map tile viewing** (supported in browser) from **offline turn-by-turn routing** (requires connectivity unless local routing engine is reachable). |
| **Street-Level Imagery** | Interactive Street Imagery modal triggered from place cards | **Mapillary Graph API v4** (`MAPILLARY_ACCESS_TOKEN`) | Clearly reports when `MAPILLARY_ACCESS_TOKEN` is unconfigured or when no imagery exists within radius. |

---

## Highway Shield System Highlights

`@hexa/shields` separates **physical road class**, **route reference normalization**, **access/toll metadata**, **international corridors**, and **data confidence**:
- **Dedicated India Support**: Distinct Saffron-header Indian National Highway shields (`NH 66`, `NH 48`, `NH 44`, `NH 16`, `NH 27`), Emerald-header State Highway shields (`SH 1`, `SH 8`, `SH 17`), Royal-Blue/Amber Indian Expressway crests (`Mumbai–Pune Expy`, `Delhi–Mumbai Expy`, `Yamuna Expy`, `Purvanchal Expy`), plus District (`MDR`), Ring (`ORR`), Bypass, and Toll tags.
- **Global & International Corridors**: US Interstates (`I-95`), US Routes (`US 101`), US State Routes, Trans-Canada (`TCH 1`), UK Motorways (`M25`) & A-Roads (`A1(M)`), German Autobahnen (`A 3`) & Bundesstraßen (`B 1`), French Autoroutes (`A 6`), Australian National (`M1`), Japanese Expressways (`E1`), Chinese NTHS (`G4`), Brazilian Rodovias (`BR-101`), South African (`N1`), Malaysian (`E1`), Indonesian (`Tol 1`), Pakistani (`M-2`, `N-5`), Bangladeshi (`N1`), Nepali (`H01`), European E-roads (`E40`), and Asian Highways (`AH1`, `AH43`, `AH47`).
- **GPU Symbol Rendering**: MapLibre requests missing `shield:{family}:{header}:{code}:{theme}` sprites on demand via `styleimagemissing`, rasterizing crisp `pixelRatio: 2` vector SVGs directly into the WebGL symbol atlas with collision decluttering—never spawning thousands of slow HTML DOM markers.

---

## Environment Variables

Copy `.env.example` to `.env`. Every external provider is optional for local development:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `API_HOST` / `API_PORT` | `0.0.0.0` / `4000` | Fastify API bind address and port |
| `INTERNAL_API_ORIGIN` | `http://127.0.0.1:4000` | Server-side proxy target used by Next.js rewrites |
| `DATABASE_URL` | *(empty → embedded PGlite)* | PostgreSQL / PostGIS connection URI |
| `PGLITE_DATA_DIR` | `./apps/api/.data/pglite` | Persistent data directory when running embedded PostgreSQL |
| `REDIS_URL` | *(empty → in-memory TTL cache)* | Optional Redis URI for caching & Socket.IO scaling |
| `SESSION_SECRET` | *(dev fallback; required in prod)* | Secret (`>= 16` chars) for session cookie signing |
| `NOMINATIM_BASE_URL` | *(optional)* | Nominatim geocoding endpoint |
| `NOMINATIM_USER_AGENT` | `HexaMaps/1.0 (open-source mapping platform)` | Required compliant User-Agent header for Nominatim |
| `PHOTON_BASE_URL` | *(optional)* | Komoot Photon autocomplete endpoint |
| `OSRM_BASE_URL` | *(optional)* | OSRM routing server base URL |
| `VALHALLA_BASE_URL` | *(optional)* | Valhalla routing server base URL |
| `OTP_BASE_URL` | *(optional)* | OpenTripPlanner GTFS transit server URL |
| `TOMTOM_TRAFFIC_API_KEY` | *(optional)* | Server-side TomTom live traffic API key (never exposed to browser) |
| `MAPILLARY_ACCESS_TOKEN` | *(optional)* | Server-side Mapillary v4 token for street-level imagery lookup |
| `NEXT_PUBLIC_PMTILES_URL` | *(optional)* | Optional regional/planet `.pmtiles` archive URL |
| `NEXT_PUBLIC_SATELLITE_TILES_URL` | *(optional)* | Licensed raster satellite `{z}/{x}/{y}` template + `NEXT_PUBLIC_SATELLITE_ATTRIBUTION` |

---

## Development, Testing & Verification Commands

```bash
# Lint all workspaces (ESLint 9 + TypeScript-ESLint)
npm run lint

# Strict TypeScript typechecking across all 4 packages/apps
npm run typecheck

# Run Vitest unit, schema, highway shield, spatial DB, API & React UI test suites
npm test

# Build all packages and Next.js production bundle
npm run build

# Run Playwright E2E browser tests (requires Playwright Chromium installed)
npm run test:e2e

# Rebuild offline Natural Earth + Protomaps glyph assets (optional)
node scripts/bootstrap-geodata.mjs
```

---

## Further Documentation

- [**System Architecture & Scaling Guide (`docs/ARCHITECTURE.md`)**](docs/ARCHITECTURE.md)
- [**REST & Real-Time WebSocket API Reference (`docs/API.md`)**](docs/API.md)
- [**Production Deployment, Security & Compliance (`docs/DEPLOYMENT.md`)**](docs/DEPLOYMENT.md)

---

## License & Attribution

Hexa Maps source code is released under the [MIT License](LICENSE).
Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL), Natural Earth (Public Domain), and MapLibre GL JS (BSD-3-Clause).
