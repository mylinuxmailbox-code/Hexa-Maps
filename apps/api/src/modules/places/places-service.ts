import crypto from 'node:crypto';
import type {
  OfflineRegionCreateInput,
  OfflineRegionRecord,
  PlaceCategory,
  SavedPlaceCreateInput,
  SavedPlaceKind,
  SavedPlaceRecord,
  UserPreferences,
} from '@hexa/shared';
import type { DatabaseContext } from '../../db/client.js';
import type { RequestActor } from '../auth/auth-service.js';

export class UserPlacesService {
  constructor(private readonly dbCtx: DatabaseContext) {}

  // =========================================================================
  // Saved Places (Home, Work, Favorites, Custom Map Pins)
  // =========================================================================

  public async listSavedPlaces(actor: RequestActor): Promise<SavedPlaceRecord[]> {
    const rows = await this.dbCtx.queryRaw<{
      id: string;
      kind: SavedPlaceKind;
      label: string;
      address: string | null;
      category: PlaceCategory;
      notes: string | null;
      lat: number;
      lng: number;
      created_at: string | Date;
    }>(
      `SELECT id, kind, label, address, category, notes, lat, lng, created_at
       FROM saved_places
       WHERE owner_key = $1
       ORDER BY CASE kind WHEN 'home' THEN 0 WHEN 'work' THEN 1 ELSE 2 END, created_at DESC`,
      [actor.ownerKey],
    );

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      label: r.label,
      address: r.address ?? undefined,
      category: r.category,
      notes: r.notes ?? undefined,
      lat: Number(r.lat),
      lng: Number(r.lng),
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  public async upsertSavedPlace(
    actor: RequestActor,
    input: SavedPlaceCreateInput,
  ): Promise<SavedPlaceRecord> {
    // Home & Work are singleton slots per owner
    if (input.kind === 'home' || input.kind === 'work') {
      await this.dbCtx.queryRaw(
        `DELETE FROM saved_places WHERE owner_key = $1 AND kind = $2`,
        [actor.ownerKey, input.kind],
      );
    }

    const id = `plc-${crypto.randomUUID()}`;
    const rows = await this.dbCtx.queryRaw<{
      id: string;
      kind: SavedPlaceKind;
      label: string;
      address: string | null;
      category: PlaceCategory;
      notes: string | null;
      lat: number;
      lng: number;
      created_at: string | Date;
    }>(
      `INSERT INTO saved_places (
        id, owner_key, user_id, kind, label, address, category, notes, lat, lng
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, kind, label, address, category, notes, lat, lng, created_at`,
      [
        id,
        actor.ownerKey,
        actor.userId,
        input.kind,
        input.label,
        input.address ?? null,
        input.category,
        input.notes ?? null,
        input.lat,
        input.lng,
      ],
    );

    const r = rows[0]!;
    return {
      id: r.id,
      kind: r.kind,
      label: r.label,
      address: r.address ?? undefined,
      category: r.category,
      notes: r.notes ?? undefined,
      lat: Number(r.lat),
      lng: Number(r.lng),
      createdAt: new Date(r.created_at).toISOString(),
    };
  }

  public async deleteSavedPlace(actor: RequestActor, placeId: string): Promise<boolean> {
    const deleted = await this.dbCtx.queryRaw<{ id: string }>(
      `DELETE FROM saved_places WHERE id = $1 AND owner_key = $2 RETURNING id`,
      [placeId, actor.ownerKey],
    );
    return deleted.length > 0;
  }

  // =========================================================================
  // Search History (with Retention & Privacy Controls)
  // =========================================================================

  public async recordSearchHistory(
    actor: RequestActor,
    entry: { query: string; placeName?: string; lat?: number; lng?: number },
  ): Promise<void> {
    const prefs = await this.getPreferences(actor);
    if (!prefs.saveSearchHistory) return;

    await this.dbCtx.queryRaw(
      `DELETE FROM search_history
       WHERE owner_key = $1
         AND (LOWER(query) = LOWER($2) OR created_at < NOW() - ($3::text || ' days')::interval)`,
      [actor.ownerKey, entry.query.trim(), prefs.historyRetentionDays],
    );

    await this.dbCtx.queryRaw(
      `INSERT INTO search_history (id, owner_key, user_id, query, place_name, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        `sh-${crypto.randomUUID()}`,
        actor.ownerKey,
        actor.userId,
        entry.query.trim(),
        entry.placeName ?? null,
        entry.lat ?? null,
        entry.lng ?? null,
      ],
    );
  }

  public async listSearchHistory(actor: RequestActor): Promise<
    Array<{
      id: string;
      query: string;
      placeName: string | null;
      lat: number | null;
      lng: number | null;
      createdAt: string;
    }>
  > {
    const rows = await this.dbCtx.queryRaw<{
      id: string;
      query: string;
      place_name: string | null;
      lat: number | null;
      lng: number | null;
      created_at: string | Date;
    }>(
      `SELECT id, query, place_name, lat, lng, created_at
       FROM search_history
       WHERE owner_key = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [actor.ownerKey],
    );
    return rows.map((r) => ({
      id: r.id,
      query: r.query,
      placeName: r.place_name,
      lat: r.lat !== null ? Number(r.lat) : null,
      lng: r.lng !== null ? Number(r.lng) : null,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  public async clearSearchHistory(actor: RequestActor): Promise<number> {
    const deleted = await this.dbCtx.queryRaw<{ id: string }>(
      `DELETE FROM search_history WHERE owner_key = $1 RETURNING id`,
      [actor.ownerKey],
    );
    return deleted.length;
  }

  // =========================================================================
  // User Preferences
  // =========================================================================

  public async getPreferences(actor: RequestActor): Promise<UserPreferences> {
    const rows = await this.dbCtx.queryRaw<{
      default_map_style: UserPreferences['defaultMapStyle'];
      distance_unit: UserPreferences['distanceUnit'];
      preferred_transport_mode: UserPreferences['preferredTransportMode'];
      avoid_tolls_by_default: boolean;
      save_search_history: boolean;
      show_shields_on_map: boolean;
      history_retention_days: number;
    }>(`SELECT * FROM user_preferences WHERE owner_key = $1 LIMIT 1`, [actor.ownerKey]);

    if (!rows[0]) {
      return {
        defaultMapStyle: 'standard',
        distanceUnit: 'metric',
        preferredTransportMode: 'driving',
        avoidTollsByDefault: false,
        saveSearchHistory: true,
        showShieldsOnMap: true,
        historyRetentionDays: 30,
      };
    }

    const r = rows[0];
    return {
      defaultMapStyle: r.default_map_style,
      distanceUnit: r.distance_unit,
      preferredTransportMode: r.preferred_transport_mode,
      avoidTollsByDefault: Boolean(r.avoid_tolls_by_default),
      saveSearchHistory: Boolean(r.save_search_history),
      showShieldsOnMap: Boolean(r.show_shields_on_map),
      historyRetentionDays: Number(r.history_retention_days),
    };
  }

  public async updatePreferences(
    actor: RequestActor,
    prefs: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    const current = await this.getPreferences(actor);
    const merged: UserPreferences = { ...current, ...prefs };

    await this.dbCtx.queryRaw(
      `INSERT INTO user_preferences (
        owner_key, user_id, default_map_style, distance_unit,
        preferred_transport_mode, avoid_tolls_by_default,
        save_search_history, show_shields_on_map, history_retention_days, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      ON CONFLICT (owner_key) DO UPDATE SET
        default_map_style = EXCLUDED.default_map_style,
        distance_unit = EXCLUDED.distance_unit,
        preferred_transport_mode = EXCLUDED.preferred_transport_mode,
        avoid_tolls_by_default = EXCLUDED.avoid_tolls_by_default,
        save_search_history = EXCLUDED.save_search_history,
        show_shields_on_map = EXCLUDED.show_shields_on_map,
        history_retention_days = EXCLUDED.history_retention_days,
        updated_at = NOW()`,
      [
        actor.ownerKey,
        actor.userId,
        merged.defaultMapStyle,
        merged.distanceUnit,
        merged.preferredTransportMode,
        merged.avoidTollsByDefault,
        merged.saveSearchHistory,
        merged.showShieldsOnMap,
        merged.historyRetentionDays,
      ],
    );
    return merged;
  }

  // =========================================================================
  // Offline Region Metadata Sync
  // =========================================================================

  public async listOfflineRegions(actor: RequestActor): Promise<OfflineRegionRecord[]> {
    const rows = await this.dbCtx.queryRaw<{
      id: string;
      name: string;
      west: number;
      south: number;
      east: number;
      north: number;
      min_zoom: number;
      max_zoom: number;
      tile_count: number;
      estimated_bytes: string | number;
      style_id: OfflineRegionRecord['styleId'];
      created_at: string | Date;
    }>(`SELECT * FROM offline_regions WHERE owner_key = $1 ORDER BY created_at DESC`, [
      actor.ownerKey,
    ]);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      bbox: [Number(r.west), Number(r.south), Number(r.east), Number(r.north)],
      minZoom: Number(r.min_zoom),
      maxZoom: Number(r.max_zoom),
      tileCount: Number(r.tile_count),
      estimatedBytes: Number(r.estimated_bytes),
      styleId: r.style_id,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  public async saveOfflineRegion(
    actor: RequestActor,
    input: OfflineRegionCreateInput,
  ): Promise<OfflineRegionRecord> {
    const id = `off-${crypto.randomUUID()}`;
    const [west, south, east, north] = input.bbox;
    const rows = await this.dbCtx.queryRaw<{ created_at: string | Date }>(
      `INSERT INTO offline_regions (
        id, owner_key, user_id, name, west, south, east, north,
        min_zoom, max_zoom, tile_count, estimated_bytes, style_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING created_at`,
      [
        id,
        actor.ownerKey,
        actor.userId,
        input.name,
        west,
        south,
        east,
        north,
        input.minZoom,
        input.maxZoom,
        input.tileCount,
        input.estimatedBytes,
        input.styleId,
      ],
    );
    return {
      id,
      ...input,
      createdAt: new Date(rows[0]!.created_at).toISOString(),
    };
  }

  public async deleteOfflineRegion(actor: RequestActor, regionId: string): Promise<boolean> {
    const deleted = await this.dbCtx.queryRaw<{ id: string }>(
      `DELETE FROM offline_regions WHERE id = $1 AND owner_key = $2 RETURNING id`,
      [regionId, actor.ownerKey],
    );
    return deleted.length > 0;
  }
}
