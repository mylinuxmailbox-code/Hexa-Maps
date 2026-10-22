import crypto from 'node:crypto';
import type {
  BoundingBox,
  IncidentCategory,
  IncidentCreateInput,
  IncidentRecord,
} from '@hexa/shared';
import type { DatabaseContext } from '../../db/client.js';

const CATEGORY_TITLES: Record<IncidentCategory, string> = {
  accident: 'Collision Reported',
  road_closure: 'Road Closure',
  congestion: 'Traffic Jam',
  flooding: 'Waterlogging / Flooding',
  construction: 'Roadworks & Lane Closure',
  road_hazard: 'Hazard on Roadway',
  broken_down_vehicle: 'Disabled Vehicle on Shoulder',
  obstruction: 'Roadway Obstruction',
  temporary_restriction: 'Temporary Traffic Restriction',
};

const CATEGORY_TTL_MINUTES: Record<IncidentCategory, number> = {
  accident: 90,
  road_closure: 360,
  congestion: 45,
  flooding: 240,
  construction: 720,
  road_hazard: 90,
  broken_down_vehicle: 60,
  obstruction: 90,
  temporary_restriction: 180,
};

interface DbIncidentRow extends Record<string, unknown> {
  id: string;
  category: IncidentCategory;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description: string | null;
  road_name: string | null;
  lat: number;
  lng: number;
  verification_source: 'community' | 'official';
  status: 'active' | 'expired' | 'resolved';
  confirmations_count: number;
  resolved_votes_count: number;
  reporter_display_name: string;
  created_at: string | Date;
  expires_at: string | Date;
}

function mapRow(r: DbIncidentRow): IncidentRecord {
  return {
    id: r.id,
    category: r.category,
    severity: r.severity,
    title: r.title,
    description: r.description,
    roadName: r.road_name,
    coordinates: { lat: Number(r.lat), lng: Number(r.lng) },
    verificationSource: r.verification_source,
    status: r.status,
    confirmationsCount: Number(r.confirmations_count),
    resolvedVotesCount: Number(r.resolved_votes_count),
    reporterDisplayName: r.reporter_display_name,
    createdAt: new Date(r.created_at).toISOString(),
    expiresAt: new Date(r.expires_at).toISOString(),
  };
}

export class IncidentService {
  constructor(private readonly dbCtx: DatabaseContext) {}

  public async expireStaleIncidents(): Promise<number> {
    const expired = await this.dbCtx.queryRaw<{ id: string }>(
      `UPDATE incidents
       SET status = 'expired'
       WHERE status = 'active' AND expires_at <= NOW()
       RETURNING id`,
    );
    return expired.length;
  }

  public async listNearbyIncidents(params: {
    lat?: number;
    lng?: number;
    radiusMeters?: number;
    bbox?: BoundingBox;
    limit?: number;
  }): Promise<IncidentRecord[]> {
    await this.expireStaleIncidents();
    const limit = Math.min(200, Math.max(1, params.limit ?? 80));

    if (params.bbox) {
      const [west, south, east, north] = params.bbox;
      const rows = await this.dbCtx.queryRaw<DbIncidentRow>(
        `SELECT * FROM incidents
         WHERE status = 'active'
           AND lng BETWEEN $1 AND $3
           AND lat BETWEEN $2 AND $4
         ORDER BY created_at DESC
         LIMIT $5`,
        [west, south, east, north, limit],
      );
      return rows.map(mapRow);
    }

    if (params.lat !== undefined && params.lng !== undefined) {
      const radius = Math.min(250_000, Math.max(200, params.radiusMeters ?? 35_000));
      const rows = await this.dbCtx.queryRaw<DbIncidentRow>(
        `SELECT *
         FROM incidents
         WHERE status = 'active'
           AND earth_box(ll_to_earth($1, $2), $3) @> ll_to_earth(lat, lng)
           AND earth_distance(ll_to_earth($1, $2), ll_to_earth(lat, lng)) <= $3
         ORDER BY earth_distance(ll_to_earth($1, $2), ll_to_earth(lat, lng)) ASC
         LIMIT $4`,
        [params.lat, params.lng, radius, limit],
      );
      return rows.map(mapRow);
    }

    const rows = await this.dbCtx.queryRaw<DbIncidentRow>(
      `SELECT * FROM incidents WHERE status = 'active' ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map(mapRow);
  }

  /**
   * Creates a new community incident report OR merges into an existing active report
   * within 150 meters of the same category (Waze-style duplicate suppression).
   */
  public async createOrConfirmIncident(
    input: IncidentCreateInput,
    reporterOwnerKey: string,
    reporterDisplayName: string,
  ): Promise<{ incident: IncidentRecord; mergedDuplicate: boolean }> {
    await this.expireStaleIncidents();

    // Spatial duplicate check within 150 meters + identical category
    const nearDuplicates = await this.dbCtx.queryRaw<DbIncidentRow>(
      `SELECT *
       FROM incidents
       WHERE status = 'active'
         AND category = $1
         AND earth_box(ll_to_earth($2, $3), 150) @> ll_to_earth(lat, lng)
         AND earth_distance(ll_to_earth($2, $3), ll_to_earth(lat, lng)) <= 150
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.category, input.lat, input.lng],
    );

    if (nearDuplicates[0]) {
      const voted = await this.voteOnIncident(nearDuplicates[0].id, reporterOwnerKey, 'confirm');
      return { incident: voted, mergedDuplicate: true };
    }

    const id = `inc-${crypto.randomUUID()}`;
    const ttlMinutes = CATEGORY_TTL_MINUTES[input.category] ?? 90;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
    const title = input.title?.trim() || CATEGORY_TITLES[input.category];

    const inserted = await this.dbCtx.queryRaw<DbIncidentRow>(
      `INSERT INTO incidents (
        id, category, severity, title, description, road_name,
        lat, lng, verification_source, status, confirmations_count,
        reporter_owner_key, reporter_display_name, expires_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'community','active',1,$9,$10,$11)
      RETURNING *`,
      [
        id,
        input.category,
        input.severity,
        title,
        input.description?.trim() || null,
        input.roadName?.trim() || null,
        input.lat,
        input.lng,
        reporterOwnerKey,
        reporterDisplayName,
        expiresAt,
      ],
    );

    return { incident: mapRow(inserted[0]!), mergedDuplicate: false };
  }

  public async voteOnIncident(
    incidentId: string,
    voterOwnerKey: string,
    vote: 'confirm' | 'resolved',
  ): Promise<IncidentRecord> {
    const existing = await this.dbCtx.queryRaw<DbIncidentRow>(
      `SELECT * FROM incidents WHERE id = $1 LIMIT 1`,
      [incidentId],
    );
    if (!existing[0]) {
      const err = new Error('Incident not found') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }

    await this.dbCtx.queryRaw(
      `INSERT INTO incident_confirmations (id, incident_id, voter_owner_key, vote)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (incident_id, voter_owner_key)
       DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW()`,
      [`vote-${crypto.randomUUID()}`, incidentId, voterOwnerKey, vote],
    );

    const tallies = await this.dbCtx.queryRaw<{ confirms: string; resolveds: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE vote = 'confirm')::text AS confirms,
         COUNT(*) FILTER (WHERE vote = 'resolved')::text AS resolveds
       FROM incident_confirmations
       WHERE incident_id = $1`,
      [incidentId],
    );

    const confirmsCount = 1 + Number(tallies[0]?.confirms ?? 0);
    const resolvedCount = Number(tallies[0]?.resolveds ?? 0);
    const newStatus = resolvedCount >= 3 ? 'resolved' : existing[0].status;
    // Extend expiration by 20 mins on active confirmation
    const extendSql =
      vote === 'confirm' && newStatus === 'active'
        ? `GREATEST(expires_at, NOW() + INTERVAL '20 minutes')`
        : `expires_at`;

    const updated = await this.dbCtx.queryRaw<DbIncidentRow>(
      `UPDATE incidents
       SET confirmations_count = $2,
           resolved_votes_count = $3,
           status = $4,
           expires_at = ${extendSql}
       WHERE id = $1
       RETURNING *`,
      [incidentId, confirmsCount, resolvedCount, newStatus],
    );

    return mapRow(updated[0]!);
  }
}
