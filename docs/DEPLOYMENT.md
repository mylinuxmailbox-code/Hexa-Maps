# Hexa Maps — Production Deployment, Security & Compliance Guide

## 1. Docker Compose Production Stack

Deploy PostgreSQL 16 + PostGIS 3.4, Redis 7, `@hexa/api`, and `@hexa/web` behind TLS (Caddy / Nginx / Cloudflare Tunnel):

```bash
cp .env.example .env
# Generate a strong cryptographic SESSION_SECRET:
openssl rand -hex 32

# Edit .env to set POSTGRES_PASSWORD, SESSION_SECRET, and optional provider URLs
docker compose up --build -d
```

Verify service health:

```bash
curl -s http://localhost:4000/api/v1/health | jq .
```

---

## 2. Security Hardening Checklist

- **Session & Password Security**: Passwords are hashed with Node `crypto.scrypt` (`N=16384, r=8, p=1`, 64-byte derived key, 16-byte random salt) and verified via `crypto.timingSafeEqual`. Session tokens are 32-byte CSPRNG tokens stored only as `SHA-256` digests in `sessions.token_hash` with `HttpOnly`, `SameSite=Lax`, and `Secure` (in `NODE_ENV=production`) cookie flags.
- **Secret Isolation**: `TOMTOM_TRAFFIC_API_KEY`, `MAPILLARY_ACCESS_TOKEN`, `DATABASE_URL`, and `SESSION_SECRET` are strictly server-side environment variables in `@hexa/api` and are never exposed in `NEXT_PUBLIC_*` client bundles.
- **Input Validation & Parameterized SQL**: Every route validates payloads/query strings with Zod schemas before execution, and all SQL queries use parameterized `$1, $2` bindings.
- **Abuse & Rate Limiting**: `@fastify/rate-limit` enforces global API limits (`300 req/min` default) plus stricter endpoint limits on authentication (`10/min`), password reset (`5/min`), and community incident submission (`12/min`) alongside spatial duplicate suppression (`180m` radius).
- **HTTP Headers**: `@fastify/helmet` sets hardened security headers while keeping cross-origin map tile/glyph loading compatible with WebGL Workers.

---

## 3. Open-Source Geospatial License & Usage Policy Compliance

1. **OpenStreetMap Attribution (ODbL)**:
   - Visible `© OpenStreetMap contributors` attribution is permanently rendered on the map viewport (`MapCanvas` / `HexaMapsApp`) and included in geocoding and routing responses.
2. **Public Nominatim Usage Policy**:
   - Never point high-volume production autocomplete traffic at `nominatim.openstreetmap.org` (which strictly caps usage to 1 req/s and forbids bulk/unthrottled autocomplete).
   - For production autocomplete, self-host **Photon** (`PHOTON_BASE_URL`) + **Nominatim** (`NOMINATIM_BASE_URL`) on your own infrastructure, keep client debouncing (`220ms`) + server response caching enabled, and set a valid contact `NOMINATIM_USER_AGENT`.
3. **Public OSRM Demo Server**:
   - `router.project-osrm.org` is a community demo server and must not be used for production traffic. Run self-hosted `osrm-routed` or `valhalla_service` containers against regional/planet Geofabrik `.osm.pbf` extracts.
4. **Satellite & Street-Level Imagery**:
   - Satellite tiles are disabled unless `NEXT_PUBLIC_SATELLITE_TILES_URL` and `NEXT_PUBLIC_SATELLITE_ATTRIBUTION` are configured with a properly licensed imagery source (e.g., EOX Sentinel-2 Cloudless CC-BY 4.0 or commercial aerial license).
   - Mapillary street imagery thumbnails attribute contributors under **CC BY-SA 4.0** per Mapillary terms.

---

## 4. Database Backup & Recovery

```bash
# Logical PostGIS backup (compressed custom format):
docker exec hexa-postgis pg_dump -U hexa -Fc hexa_maps > hexa_maps_$(date +%F).dump

# Restore into a fresh PostGIS 16 database:
cat hexa_maps_2026-10-22.dump | docker exec -i hexa-postgis pg_restore -U hexa -d hexa_maps --clean --if-exists
```
