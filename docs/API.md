# Hexa Maps — API Reference (`/api/v1`)

Interactive OpenAPI 3.0 Swagger documentation is served automatically at **`GET /api/docs`** (`GET /api/docs/json` for raw OpenAPI JSON).

All browser requests use relative `/api/v1/*` paths proxied by Next.js to `@hexa/api`.

---

## Standard Error Envelope

Every validation, authentication, rate-limit, or domain error returns a consistent JSON payload:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      { "path": "q", "message": "String must contain at least 1 character(s)" }
    ]
  }
}
```

---

## 1. Health & Vector Basemap Endpoints

| Method & Path | Description |
| :--- | :--- |
| `GET /api/v1/health` | Service health, database mode (`postgres` or `pglite`), PostGIS status, and active external provider adapters. |
| `GET /api/v1/tiles/basemap/:z/:x/:y.pbf` | Mapbox Vector Tile (`application/vnd.mapbox-vector-tile`) with layers `land`, `countries`, `admin`, `water`, `rivers`, `parks`, `roads`, `transit`, `places`. |
| `GET /api/v1/glyphs/:fontstack/:range.pbf` | Signed-distance-field MapLibre PBF font glyph ranges (`Noto Sans Regular`, `Medium`, `Bold`). |
| `GET /api/v1/roads/classified?bbox=w,s,e,n` | Returns classified road segments in bounding box with normalized highway shields and confidence metadata. |
| `POST /api/v1/roads/classify` | Classifies raw OSM highway tags (`highway`, `ref`, `network`, `name`, `toll`, `countryCode`) and returns vector shield descriptors. |

---

## 2. Search, Autocomplete & Reverse Geocoding

| Method & Path | Description |
| :--- | :--- |
| `GET /api/v1/geocode/search` | Query params: `q` (required), `lat`, `lng` (proximity bias), `bbox`, `category`, `limit` (`1..25`). Supports coordinate strings (`15.5912, 73.8080`), route refs (`NH 66`, `I-95`), cities, and POIs. |
| `GET /api/v1/geocode/reverse` | Query params: `lat`, `lng`. Returns nearest verified place or coordinate fallback without fabricated business metadata. |
| `GET /api/v1/places/lookup/:id` | Looks up full verified OSM place details by stable ID. |

---

## 3. Multimodal Routing & Navigation

| Method & Path | Description |
| :--- | :--- |
| `GET /api/v1/routing/modes` | Reports enabled vs unconfigured transport modes (`driving`, `walking`, `cycling`, `transit`) and active routing engine (`osrm`, `valhalla`, `otp`, or `local_road_graph`). |
| `POST /api/v1/routing/route` | Body: `{ waypoints: [{lat, lng, label?}, ...], mode, alternatives, avoidTolls }`. Returns GeoJSON `LineString` route alternatives, distance, duration, ETA, route-level highway shields, and turn-by-turn steps with inline maneuver shields. |

---

## 4. Traffic & Community Road Incidents

| Method & Path | Description |
| :--- | :--- |
| `GET /api/v1/traffic?bbox=w,s,e,n` | Returns GeoJSON `FeatureCollection` of traffic segments (`flowing`, `moderate`, `heavy`, `severe`) plus `freshness` (`live`, `cached`, `simulated`) and `updatedAt`. |
| `GET /api/v1/incidents?bbox=w,s,e,n` | Spatial bounding-box query returning active non-expired incidents ordered by confirmations and recency. |
| `POST /api/v1/incidents` | Rate-limited (`12/min`). Body: `{ category, severity, title?, description?, roadName?, coordinates: {lat, lng} }`. Automatically deduplicates active same-category incidents within `180m` (incrementing confirmations) and broadcasts `incident:updated` over Socket.IO. |
| `POST /api/v1/incidents/:id/vote` | Body: `{ vote: "confirm" \| "resolve" }`. Extends incident TTL on confirmation or marks `resolved` once community threshold (`>= 3`) is reached. |

### Real-Time WebSocket (`/api/socket.io`)
- Client emits `subscribe:bbox` with `[west, south, east, north]`.
- Server joins regional bucket rooms (`region:{latBucket}:{lngBucket}`) and emits `incident:created` / `incident:updated` events when nearby incidents change.

---

## 5. Authentication, Saved Places, Preferences & Offline Regions

| Method & Path | Description |
| :--- | :--- |
| `GET /api/v1/auth/me` | Current user profile (or `authenticated: false` guest state) + active preferences. |
| `POST /api/v1/auth/register` | Creates account (`scrypt` salted password hash) and sets `HttpOnly` `SameSite=Lax` `hexa_sid` session cookie. |
| `POST /api/v1/auth/login` | Rate-limited (`10/min`). Verifies credentials with constant-time `timingSafeEqual` and issues session cookie. |
| `POST /api/v1/auth/logout` | Revokes server session and clears cookie. |
| `POST /api/v1/auth/password-reset/request` | Generates SHA-256 hashed 30-minute reset token (`devResetToken` returned only in `development`/`test`). |
| `POST /api/v1/auth/password-reset/confirm` | Resets password, consumes token, and revokes existing sessions. |
| `DELETE /api/v1/auth/account` | Permanently deletes user account, sessions, saved places, search history, and offline metadata (`ON DELETE CASCADE`). |
| `GET \| POST /api/v1/places/saved` | Lists or creates saved places (`home`, `work`, `favorite`, `custom_pin`). |
| `DELETE /api/v1/places/saved/:id` | Deletes a saved place owned by the authenticated user. |
| `GET \| DELETE /api/v1/history/searches` | Lists recent search history or wipes all recorded searches. |
| `GET \| PUT /api/v1/preferences` | Reads or updates map style, metric/imperial units, transport mode, shield toggle, and history retention settings. |
| `GET \| POST /api/v1/offline/regions` | Syncs downloaded offline tile region metadata across devices. |
| `DELETE /api/v1/offline/regions/:id` | Deletes synced offline region metadata. |
| `GET /api/v1/imagery/nearby` | Query params: `lat`, `lng`, `radiusMeters`. Queries Mapillary v4 street-level imagery or returns honest availability status. |
