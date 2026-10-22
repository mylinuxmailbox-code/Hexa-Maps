import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().optional().default(''),
  PGLITE_DATA_DIR: z.string().default('./.cache/pglite'),
  REDIS_URL: z.string().optional().default(''),
  SESSION_SECRET: z
    .string()
    .min(16)
    .default('hexa-maps-dev-session-secret-change-in-production-2026'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  RATE_LIMIT_MAX_PER_MINUTE: z.coerce.number().int().min(10).max(5000).default(240),
  CORS_ALLOWED_ORIGINS: z.string().default('*'),
  GEOCODING_PROVIDERS: z.string().default('local,photon,nominatim'),
  PHOTON_BASE_URL: z.string().default('https://photon.komoot.io'),
  NOMINATIM_BASE_URL: z.string().default('https://nominatim.openstreetmap.org'),
  NOMINATIM_USER_AGENT: z
    .string()
    .default('HexaMaps/1.0 (https://github.com/mylinuxmailbox-code/Hexa-Maps)'),
  ROUTING_PROVIDERS: z.string().default('local,osrm'),
  OSRM_BASE_URL: z.string().default('https://router.project-osrm.org'),
  VALHALLA_BASE_URL: z.string().optional().default(''),
  OTP_BASE_URL: z.string().optional().default(''),
  TRAFFIC_PROVIDER: z.enum(['simulated', 'tomtom']).default('simulated'),
  TOMTOM_API_KEY: z.string().optional().default(''),
  MAPILLARY_ACCESS_TOKEN: z.string().optional().default(''),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(overrides?: Partial<Record<string, string | undefined>>): AppEnv {
  return EnvSchema.parse({
    ...process.env,
    ...overrides,
  });
}

export const env = loadEnv();
