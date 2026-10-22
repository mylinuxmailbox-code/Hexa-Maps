import { openDB, type IDBPDatabase } from 'idb';
import {
  enumerateTilesForBbox,
  type BoundingBox,
  type MapStyleId,
  type OfflineRegionRecord,
} from '@hexa/shared';

interface HexaOfflineDbSchema {
  regions: {
    key: string;
    value: OfflineRegionRecord & { downloadedTileKeys: string[] };
  };
  tiles: {
    key: string;
    value: {
      key: string;
      regionId: string;
      byteLength: number;
      data: ArrayBuffer;
      cachedAt: number;
    };
  };
}

const DB_NAME = 'hexa-maps-offline-v1';
const TILE_CACHE_NAME = 'hexa-tiles-v1';

let dbPromise: Promise<IDBPDatabase<HexaOfflineDbSchema>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<HexaOfflineDbSchema>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('regions')) {
          db.createObjectStore('regions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tiles')) {
          db.createObjectStore('tiles', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getStorageEstimate(): Promise<{
  usageBytes: number;
  quotaBytes: number;
  supported: boolean;
}> {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      return {
        usageBytes: est.usage ?? 0,
        quotaBytes: est.quota ?? 0,
        supported: true,
      };
    } catch {
      return { usageBytes: 0, quotaBytes: 0, supported: false };
    }
  }
  return { usageBytes: 0, quotaBytes: 0, supported: false };
}

export async function listLocalOfflineRegions(): Promise<OfflineRegionRecord[]> {
  if (typeof indexedDB === 'undefined') return [];
  const db = await getDb();
  const all = await db.getAll('regions');
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface DownloadRegionProgress {
  completedTiles: number;
  totalTiles: number;
  bytesDownloaded: number;
}

/**
 * Downloads real vector tiles (.pbf) covering `bbox` across `[minZoom, maxZoom]`
 * into both IndexedDB AND Cache Storage (`hexa-tiles-v1`) so Service Worker
 * serves them offline cleanly, with real-time progress and cancellation support.
 */
export async function downloadOfflineRegionTiles(opts: {
  id: string;
  name: string;
  bbox: BoundingBox;
  minZoom: number;
  maxZoom: number;
  styleId: MapStyleId;
  signal: AbortSignal;
  onProgress: (p: DownloadRegionProgress) => void;
}): Promise<OfflineRegionRecord> {
  const tiles = enumerateTilesForBbox(opts.bbox, opts.minZoom, opts.maxZoom, 320);
  const db = await getDb();
  const tileCache =
    typeof caches !== 'undefined' ? await caches.open(TILE_CACHE_NAME).catch(() => null) : null;

  let bytesDownloaded = 0;
  const downloadedKeys: string[] = [];

  for (let i = 0; i < tiles.length; i++) {
    if (opts.signal.aborted) {
      throw new DOMException('Offline region download cancelled', 'AbortError');
    }

    const t = tiles[i]!;
    const url = `/api/v1/tiles/basemap/${t.z}/${t.x}/${t.y}.pbf`;
    const res = await fetch(url, { signal: opts.signal });

    if (res.ok && res.status === 200) {
      const cloneForCache = tileCache ? res.clone() : null;
      const buf = await res.arrayBuffer();
      bytesDownloaded += buf.byteLength;
      downloadedKeys.push(url);

      await db.put('tiles', {
        key: url,
        regionId: opts.id,
        byteLength: buf.byteLength,
        data: buf,
        cachedAt: Date.now(),
      });

      if (tileCache && cloneForCache) {
        await tileCache.put(url, cloneForCache);
      }
    }

    opts.onProgress({
      completedTiles: i + 1,
      totalTiles: tiles.length,
      bytesDownloaded,
    });
  }

  const record: OfflineRegionRecord & { downloadedTileKeys: string[] } = {
    id: opts.id,
    name: opts.name,
    bbox: opts.bbox,
    minZoom: opts.minZoom,
    maxZoom: opts.maxZoom,
    tileCount: tiles.length,
    estimatedBytes: bytesDownloaded,
    styleId: opts.styleId,
    createdAt: new Date().toISOString(),
    downloadedTileKeys: downloadedKeys,
  };

  await db.put('regions', record);
  return record;
}

export async function removeLocalOfflineRegion(regionId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await getDb();
  const existing = await db.get('regions', regionId);
  const tileCache =
    typeof caches !== 'undefined' ? await caches.open(TILE_CACHE_NAME).catch(() => null) : null;

  if (existing) {
    for (const key of existing.downloadedTileKeys) {
      await db.delete('tiles', key);
      if (tileCache) {
        await tileCache.delete(key).catch(() => {});
      }
    }
    await db.delete('regions', regionId);
  }
}
