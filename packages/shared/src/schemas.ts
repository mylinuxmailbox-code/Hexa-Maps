import { z } from 'zod';

// ============================================================================
// Coordinates & Bounding Boxes
// ============================================================================

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const BoundingBoxSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

// ============================================================================
// Map Styles & Layers
// ============================================================================

export const MapStyleIdSchema = z.enum([
  'standard',
  'dark',
  'terrain',
  'traffic',
  'transit',
  'satellite',
]);
export type MapStyleId = z.infer<typeof MapStyleIdSchema>;

export interface MapStyleDescriptor {
  id: MapStyleId;
  label: string;
  description: string;
  available: boolean;
  unavailableReason?: string;
}

// ============================================================================
// Highway Shield Reference Summary (shared across Geocoding, Routing, UI)
// ============================================================================

export const RouteShieldBadgeSchema = z.object({
  id: z.string(),
  family: z.string(),
  code: z.string(),
  displayRef: z.string(),
  network: z.string().optional(),
  countryCode: z.string().optional(),
  isInternational: z.boolean().default(false),
  isToll: z.boolean().default(false),
  confidence: z.enum(['verified', 'inferred']).default('verified'),
});
export type RouteShieldBadge = z.infer<typeof RouteShieldBadgeSchema>;

// ============================================================================
// Search, Geocoding & Places
// ============================================================================

export const PlaceCategorySchema = z.enum([
  'city',
  'town',
  'suburb',
  'address',
  'highway',
  'expressway',
  'transit_station',
  'bus_station',
  'airport',
  'restaurant',
  'cafe',
  'hospital',
  'hotel',
  'park',
  'landmark',
  'education',
  'fuel',
  'poi',
]);
export type PlaceCategory = z.infer<typeof PlaceCategorySchema>;

/**
 * Structured geocoding result. Optional metadata fields (website, phone, openingHours)
 * are strictly omitted unless explicitly supplied by the underlying data source.
 */
export const GeocodingPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  category: PlaceCategorySchema,
  coordinates: CoordinatesSchema,
  bbox: BoundingBoxSchema.optional(),
  countryCode: z.string().max(3).optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  street: z.string().optional(),
  postcode: z.string().optional(),
  osmType: z.enum(['node', 'way', 'relation']).optional(),
  osmId: z.string().optional(),
  shields: z.array(RouteShieldBadgeSchema).optional(),
  metadata: z
    .object({
      population: z.number().optional(),
      openingHours: z.string().optional(),
      phone: z.string().optional(),
      website: z.string().optional(),
      surface: z.string().optional(),
      maxspeed: z.string().optional(),
      lanes: z.number().optional(),
      toll: z.boolean().optional(),
    })
    .optional(),
  source: z.enum(['local_osm_ne', 'photon', 'nominatim']),
  attribution: z.string(),
});
export type GeocodingPlace = z.infer<typeof GeocodingPlaceSchema>;

export const GeocodeSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
  countryCode: z.string().trim().max(3).optional(),
});

export const ReverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// ============================================================================
// Multimodal Routing & Turn-by-Turn Navigation
// ============================================================================

export const TransportModeSchema = z.enum([
  'driving',
  'walking',
  'cycling',
  'transit',
  'motorcycle',
]);
export type TransportMode = z.infer<typeof TransportModeSchema>;

export const ManeuverTypeSchema = z.enum([
  'depart',
  'turn-left',
  'turn-slight-left',
  'turn-sharp-left',
  'turn-right',
  'turn-slight-right',
  'turn-sharp-right',
  'uturn',
  'continue',
  'merge',
  'on-ramp',
  'off-ramp',
  'roundabout',
  'transit-board',
  'transit-alight',
  'arrive',
]);
export type ManeuverType = z.infer<typeof ManeuverTypeSchema>;

export const TransitLegDetailsSchema = z.object({
  lineName: z.string(),
  lineShortName: z.string().optional(),
  agencyName: z.string().optional(),
  vehicleType: z.enum(['rail', 'metro', 'bus', 'ferry', 'tram']),
  departureStop: z.string(),
  arrivalStop: z.string(),
  stopCount: z.number().int().nonnegative().optional(),
  headsign: z.string().optional(),
  color: z.string().optional(),
  scheduleSource: z.enum(['gtfs', 'frequency_estimate']),
  serviceAlert: z.string().optional(),
});
export type TransitLegDetails = z.infer<typeof TransitLegDetailsSchema>;

export const RouteStepSchema = z.object({
  index: z.number().int().nonnegative(),
  instruction: z.string(),
  maneuver: ManeuverTypeSchema,
  roadName: z.string().optional(),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  location: CoordinatesSchema,
  shields: z.array(RouteShieldBadgeSchema).default([]),
  isToll: z.boolean().default(false),
  maxspeed: z.string().optional(),
  transit: TransitLegDetailsSchema.optional(),
});
export type RouteStep = z.infer<typeof RouteStepSchema>;

export const RouteAlternativeSchema = z.object({
  id: z.string(),
  summary: z.string(),
  mode: TransportModeSchema,
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  estimatedArrivalIso: z.string(),
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(z.tuple([z.number(), z.number()])),
  }),
  bbox: BoundingBoxSchema,
  steps: z.array(RouteStepSchema),
  shields: z.array(RouteShieldBadgeSchema),
  warnings: z.array(z.string()),
  hasTolls: z.boolean().default(false),
  provider: z.enum(['osrm', 'valhalla', 'otp', 'local_road_graph']),
  attribution: z.string(),
});
export type RouteAlternative = z.infer<typeof RouteAlternativeSchema>;

export const RouteRequestSchema = z.object({
  waypoints: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        label: z.string().max(160).optional(),
      }),
    )
    .min(2)
    .max(10),
  mode: TransportModeSchema.default('driving'),
  alternatives: z.boolean().default(true),
  avoidTolls: z.boolean().default(false),
});
export type RouteRequest = z.infer<typeof RouteRequestSchema>;

// ============================================================================
// Traffic & Road Conditions
// ============================================================================

export const CongestionLevelSchema = z.enum(['flowing', 'moderate', 'heavy', 'severe']);
export type CongestionLevel = z.infer<typeof CongestionLevelSchema>;

export const TrafficFeedProvenanceSchema = z.enum(['live', 'cached', 'simulated']);
export type TrafficFeedProvenance = z.infer<typeof TrafficFeedProvenanceSchema>;

export const TrafficSegmentSchema = z.object({
  id: z.string(),
  roadName: z.string(),
  ref: z.string().optional(),
  congestion: CongestionLevelSchema,
  speedKph: z.number().nonnegative(),
  freeFlowSpeedKph: z.number().positive(),
  delaySeconds: z.number().nonnegative(),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
});
export type TrafficSegment = z.infer<typeof TrafficSegmentSchema>;

export const TrafficResponseSchema = z.object({
  provenance: TrafficFeedProvenanceSchema,
  providerName: z.string(),
  updatedAt: z.string(),
  disclaimer: z.string(),
  segments: z.array(TrafficSegmentSchema),
});
export type TrafficResponse = z.infer<typeof TrafficResponseSchema>;

// ============================================================================
// Community Incident Reporting (Waze-inspired)
// ============================================================================

export const IncidentCategorySchema = z.enum([
  'accident',
  'road_closure',
  'congestion',
  'flooding',
  'construction',
  'road_hazard',
  'broken_down_vehicle',
  'obstruction',
  'temporary_restriction',
]);
export type IncidentCategory = z.infer<typeof IncidentCategorySchema>;

export const IncidentSeveritySchema = z.enum(['low', 'moderate', 'high', 'critical']);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export const IncidentCreateSchema = z.object({
  category: IncidentCategorySchema,
  severity: IncidentSeveritySchema.default('moderate'),
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  roadName: z.string().trim().max(120).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type IncidentCreateInput = z.infer<typeof IncidentCreateSchema>;

export const IncidentVoteSchema = z.object({
  vote: z.enum(['confirm', 'resolved']),
});

export const IncidentRecordSchema = z.object({
  id: z.string(),
  category: IncidentCategorySchema,
  severity: IncidentSeveritySchema,
  title: z.string(),
  description: z.string().nullable(),
  roadName: z.string().nullable(),
  coordinates: CoordinatesSchema,
  verificationSource: z.enum(['community', 'official']),
  status: z.enum(['active', 'expired', 'resolved']),
  confirmationsCount: z.number().int().nonnegative(),
  resolvedVotesCount: z.number().int().nonnegative(),
  reporterDisplayName: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
});
export type IncidentRecord = z.infer<typeof IncidentRecordSchema>;

// ============================================================================
// Authentication, Saved Places, Preferences & Offline Regions
// ============================================================================

export const RegisterSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(80),
});

export const LoginSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(1).max(128),
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().trim().email().max(180),
});

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(16).max(200),
  newPassword: z.string().min(8).max(128),
});

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  createdAt: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const SavedPlaceKindSchema = z.enum(['home', 'work', 'favorite', 'custom_pin']);
export type SavedPlaceKind = z.infer<typeof SavedPlaceKindSchema>;

export const SavedPlaceCreateSchema = z.object({
  kind: SavedPlaceKindSchema.default('favorite'),
  label: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300).optional(),
  category: PlaceCategorySchema.default('poi'),
  notes: z.string().trim().max(400).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type SavedPlaceCreateInput = z.infer<typeof SavedPlaceCreateSchema>;

export const SavedPlaceRecordSchema = SavedPlaceCreateSchema.extend({
  id: z.string(),
  createdAt: z.string(),
});
export type SavedPlaceRecord = z.infer<typeof SavedPlaceRecordSchema>;

export const UserPreferencesSchema = z.object({
  defaultMapStyle: MapStyleIdSchema.default('standard'),
  distanceUnit: z.enum(['metric', 'imperial']).default('metric'),
  preferredTransportMode: TransportModeSchema.default('driving'),
  avoidTollsByDefault: z.boolean().default(false),
  saveSearchHistory: z.boolean().default(true),
  showShieldsOnMap: z.boolean().default(true),
  historyRetentionDays: z.number().int().min(1).max(365).default(30),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const OfflineRegionCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  bbox: BoundingBoxSchema,
  minZoom: z.number().int().min(0).max(16).default(5),
  maxZoom: z.number().int().min(1).max(16).default(12),
  tileCount: z.number().int().nonnegative(),
  estimatedBytes: z.number().int().nonnegative(),
  styleId: MapStyleIdSchema.default('standard'),
});
export type OfflineRegionCreateInput = z.infer<typeof OfflineRegionCreateSchema>;

export const OfflineRegionRecordSchema = OfflineRegionCreateSchema.extend({
  id: z.string(),
  createdAt: z.string(),
});
export type OfflineRegionRecord = z.infer<typeof OfflineRegionRecordSchema>;

// ============================================================================
// Standard API Error Envelope
// ============================================================================

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorSchema>;
