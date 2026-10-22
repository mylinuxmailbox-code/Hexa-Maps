-- PostGIS Spatial Upgrade Migration (executed automatically when PostGIS is available)
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE saved_places
  ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED;

CREATE INDEX IF NOT EXISTS idx_saved_places_postgis_geom ON saved_places USING GIST (geom);

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED;

CREATE INDEX IF NOT EXISTS idx_incidents_postgis_geom ON incidents USING GIST (geom);
