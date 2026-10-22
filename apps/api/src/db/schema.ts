import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userPreferences = pgTable('user_preferences', {
  ownerKey: text('owner_key').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  defaultMapStyle: text('default_map_style').notNull().default('standard'),
  distanceUnit: text('distance_unit').notNull().default('metric'),
  preferredTransportMode: text('preferred_transport_mode').notNull().default('driving'),
  avoidTollsByDefault: boolean('avoid_tolls_by_default').notNull().default(false),
  saveSearchHistory: boolean('save_search_history').notNull().default(true),
  showShieldsOnMap: boolean('show_shields_on_map').notNull().default(true),
  historyRetentionDays: integer('history_retention_days').notNull().default(30),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const savedPlaces = pgTable('saved_places', {
  id: text('id').primaryKey(),
  ownerKey: text('owner_key').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().default('favorite'),
  label: text('label').notNull(),
  address: text('address'),
  category: text('category').notNull().default('poi'),
  notes: text('notes'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const searchHistory = pgTable('search_history', {
  id: text('id').primaryKey(),
  ownerKey: text('owner_key').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  query: text('query').notNull(),
  placeName: text('place_name'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const routeHistory = pgTable('route_history', {
  id: text('id').primaryKey(),
  ownerKey: text('owner_key').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  originLabel: text('origin_label').notNull(),
  destinationLabel: text('destination_label').notNull(),
  mode: text('mode').notNull(),
  distanceMeters: doublePrecision('distance_meters').notNull(),
  durationSeconds: doublePrecision('duration_seconds').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  severity: text('severity').notNull().default('moderate'),
  title: text('title').notNull(),
  description: text('description'),
  roadName: text('road_name'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  verificationSource: text('verification_source').notNull().default('community'),
  status: text('status').notNull().default('active'),
  confirmationsCount: integer('confirmations_count').notNull().default(1),
  resolvedVotesCount: integer('resolved_votes_count').notNull().default(0),
  reporterOwnerKey: text('reporter_owner_key').notNull(),
  reporterDisplayName: text('reporter_display_name').notNull().default('Community Driver'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const incidentConfirmations = pgTable('incident_confirmations', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id')
    .notNull()
    .references(() => incidents.id, { onDelete: 'cascade' }),
  voterOwnerKey: text('voter_owner_key').notNull(),
  vote: text('vote').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const offlineRegions = pgTable('offline_regions', {
  id: text('id').primaryKey(),
  ownerKey: text('owner_key').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  west: doublePrecision('west').notNull(),
  south: doublePrecision('south').notNull(),
  east: doublePrecision('east').notNull(),
  north: doublePrecision('north').notNull(),
  minZoom: integer('min_zoom').notNull().default(5),
  maxZoom: integer('max_zoom').notNull().default(12),
  tileCount: integer('tile_count').notNull().default(0),
  estimatedBytes: bigint('estimated_bytes', { mode: 'number' }).notNull().default(0),
  styleId: text('style_id').notNull().default('standard'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  actorKey: text('actor_key').notNull(),
  action: text('action').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
