-- Hexa Maps Core PostgreSQL Schema + Spatial GiST Indexing
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  owner_key TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  default_map_style TEXT NOT NULL DEFAULT 'standard',
  distance_unit TEXT NOT NULL DEFAULT 'metric',
  preferred_transport_mode TEXT NOT NULL DEFAULT 'driving',
  avoid_tolls_by_default BOOLEAN NOT NULL DEFAULT FALSE,
  save_search_history BOOLEAN NOT NULL DEFAULT TRUE,
  show_shields_on_map BOOLEAN NOT NULL DEFAULT TRUE,
  history_retention_days INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_places (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'favorite',
  label TEXT NOT NULL,
  address TEXT,
  category TEXT NOT NULL DEFAULT 'poi',
  notes TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_places_owner ON saved_places(owner_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_places_spatial ON saved_places USING gist (ll_to_earth(lat, lng));

CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  place_name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_history_owner ON search_history(owner_key, created_at DESC);

CREATE TABLE IF NOT EXISTS route_history (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  origin_label TEXT NOT NULL,
  destination_label TEXT NOT NULL,
  mode TEXT NOT NULL,
  distance_meters DOUBLE PRECISION NOT NULL,
  duration_seconds DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_route_history_owner ON route_history(owner_key, created_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate',
  title TEXT NOT NULL,
  description TEXT,
  road_name TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  verification_source TEXT NOT NULL DEFAULT 'community',
  status TEXT NOT NULL DEFAULT 'active',
  confirmations_count INTEGER NOT NULL DEFAULT 1,
  resolved_votes_count INTEGER NOT NULL DEFAULT 0,
  reporter_owner_key TEXT NOT NULL,
  reporter_display_name TEXT NOT NULL DEFAULT 'Community Driver',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_status_expires ON incidents(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_incidents_spatial ON incidents USING gist (ll_to_earth(lat, lng));
CREATE INDEX IF NOT EXISTS idx_incidents_bbox ON incidents(lat, lng);

CREATE TABLE IF NOT EXISTS incident_confirmations (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  voter_owner_key TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('confirm', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(incident_id, voter_owner_key)
);

CREATE TABLE IF NOT EXISTS offline_regions (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  west DOUBLE PRECISION NOT NULL,
  south DOUBLE PRECISION NOT NULL,
  east DOUBLE PRECISION NOT NULL,
  north DOUBLE PRECISION NOT NULL,
  min_zoom INTEGER NOT NULL DEFAULT 5,
  max_zoom INTEGER NOT NULL DEFAULT 12,
  tile_count INTEGER NOT NULL DEFAULT 0,
  estimated_bytes BIGINT NOT NULL DEFAULT 0,
  style_id TEXT NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_offline_regions_owner ON offline_regions(owner_key, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_key TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_key, created_at DESC);
