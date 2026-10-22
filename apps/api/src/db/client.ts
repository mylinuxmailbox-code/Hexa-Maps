import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { cube } from '@electric-sql/pglite/contrib/cube';
import { earthdistance } from '@electric-sql/pglite/contrib/earthdistance';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import type { AppEnv } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

export type HexaDrizzleDb = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;

export interface DatabaseContext {
  db: HexaDrizzleDb;
  engine: 'postgres-postgis' | 'postgres' | 'pglite-postgres';
  hasPostgis: boolean;
  queryRaw: <T extends Record<string, unknown> = Record<string, unknown>>(
    sqlText: string,
    params?: unknown[],
  ) => Promise<T[]>;
  close: () => Promise<void>;
}

export interface CreateDbOptions {
  env: AppEnv;
  /** Use isolated in-memory PGlite instance for deterministic fast integration tests */
  inMemory?: boolean;
}

export async function createDatabaseContext(options: CreateDbOptions): Promise<DatabaseContext> {
  const coreSql = fs.readFileSync(path.join(MIGRATIONS_DIR, '0001_core_schema.sql'), 'utf8');
  const postgisSql = fs.readFileSync(path.join(MIGRATIONS_DIR, '0002_postgis_upgrade.sql'), 'utf8');

  if (options.env.DATABASE_URL && !options.inMemory) {
    const pool = new pg.Pool({
      connectionString: options.env.DATABASE_URL,
      max: 15,
    });

    await pool.query(coreSql);
    let hasPostgis = false;
    try {
      const extRes = await pool.query<{ name: string }>(
        `SELECT name FROM pg_available_extensions WHERE name = 'postgis'`,
      );
      if (extRes.rows.length > 0) {
        await pool.query(postgisSql);
        hasPostgis = true;
      }
    } catch {
      hasPostgis = false;
    }

    const db = drizzlePg(pool, { schema });
    await seedInitialAdvisoriesIfEmpty(async (s, p) => (await pool.query(s, p)).rows);

    return {
      db,
      engine: hasPostgis ? 'postgres-postgis' : 'postgres',
      hasPostgis,
      queryRaw: async <T extends Record<string, unknown>>(sqlText: string, params: unknown[] = []) => {
        const res = await pool.query(sqlText, params);
        return res.rows as T[];
      },
      close: async () => {
        await pool.end();
      },
    };
  }

  // Embedded PostgreSQL (PGlite WASM) with `cube` + `earthdistance` GiST spatial indexing
  let pglite: PGlite;
  if (options.inMemory || options.env.NODE_ENV === 'test') {
    pglite = new PGlite({
      extensions: { cube, earthdistance },
    });
  } else {
    const dataDir = path.resolve(process.cwd(), options.env.PGLITE_DATA_DIR);
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });
    pglite = new PGlite(dataDir, {
      extensions: { cube, earthdistance },
    });
  }

  await pglite.exec(coreSql);
  const db = drizzlePglite(pglite, { schema });

  const queryRaw = async <T extends Record<string, unknown>>(
    sqlText: string,
    params: unknown[] = [],
  ): Promise<T[]> => {
    const res = await pglite.query<T>(sqlText, params);
    return res.rows;
  };

  await seedInitialAdvisoriesIfEmpty(queryRaw);

  return {
    db,
    engine: 'pglite-postgres',
    hasPostgis: false,
    queryRaw,
    close: async () => {
      await pglite.close();
    },
  };
}

/**
 * Seeds 3 clearly-labeled highway advisories on initial empty DB creation so the map
 * demonstrates official vs community differentiation without faking live external feeds.
 */
async function seedInitialAdvisoriesIfEmpty(
  queryRaw: <T extends Record<string, unknown>>(s: string, p?: unknown[]) => Promise<T[]>,
) {
  const existing = await queryRaw<{ cnt: string }>('SELECT COUNT(*)::text AS cnt FROM incidents');
  if (Number(existing[0]?.cnt ?? 0) > 0) return;

  const expiresIn12h = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
  const seeds = [
    {
      id: 'inc-seed-goa-porvorim-work',
      category: 'construction',
      severity: 'moderate',
      title: 'Elevated Corridor Pier Work — Porvorim NH 66',
      description:
        'Scheduled highway expansion lane narrowing along NH 66 Porvorim stretch. Expect 5–8 min delay.',
      roadName: 'NH 66 (Porvorim)',
      lat: 15.5335,
      lng: 73.8286,
      source: 'official',
      reporter: 'Goa PWD Highway Advisory (Demo Seed)',
    },
    {
      id: 'inc-seed-goa-zuari-approach',
      category: 'congestion',
      severity: 'low',
      title: 'Slow Moving Peak Approach — Cortalim Junction',
      description: 'Signal queue near NH 66 / NH 366 airport turnoff.',
      roadName: 'NH 66 / NH 366',
      lat: 15.4052,
      lng: 73.9092,
      source: 'community',
      reporter: 'Community Driver',
    },
    {
      id: 'inc-seed-mpew-ghat',
      category: 'road_hazard',
      severity: 'high',
      title: 'Heavy Truck Speed Enforcement — Lonavala Ghat',
      description: 'Gradient speed control active on Mumbai–Pune Expressway Khandala section.',
      roadName: 'Mumbai–Pune Expressway',
      lat: 18.768,
      lng: 73.372,
      source: 'official',
      reporter: 'MSRDC Highway Patrol (Demo Seed)',
    },
  ];

  for (const s of seeds) {
    await queryRaw(
      `INSERT INTO incidents (
        id, category, severity, title, description, road_name,
        lat, lng, verification_source, status, confirmations_count,
        reporter_owner_key, reporter_display_name, expires_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',3,'system',$10,$11)`,
      [
        s.id,
        s.category,
        s.severity,
        s.title,
        s.description,
        s.roadName,
        s.lat,
        s.lng,
        s.source,
        s.reporter,
        expiresIn12h,
      ],
    );
  }
}
