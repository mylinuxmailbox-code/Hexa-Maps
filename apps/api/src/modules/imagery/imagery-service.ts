import { bboxFromRadius, type Coordinates } from '@hexa/shared';
import type { AppEnv } from '../../config/env.js';

export interface StreetImageryFrame {
  id: string;
  lat: number;
  lng: number;
  compassAngle: number;
  capturedAt: string;
  thumbUrl?: string;
  provider: 'mapillary';
  attribution: string;
}

export interface StreetImageryLookupResponse {
  available: boolean;
  configured: boolean;
  provider: 'mapillary';
  frames: StreetImageryFrame[];
  message: string;
  attribution: string;
  /** Server-side safe flag indicating if interactive MapillaryJS token is present */
  viewerTokenAvailable: boolean;
}

export class StreetImageryService {
  constructor(private readonly env: AppEnv) {}

  public async lookupNearbyImagery(coords: Coordinates): Promise<StreetImageryLookupResponse> {
    const token = this.env.MAPILLARY_ACCESS_TOKEN.trim();
    if (!token) {
      return {
        available: false,
        configured: false,
        provider: 'mapillary',
        frames: [],
        viewerTokenAvailable: false,
        message:
          'Street-level imagery requires a Mapillary v4 API access token (MAPILLARY_ACCESS_TOKEN). Configure a token in .env to query live street-level sequences.',
        attribution: '© Mapillary contributors (CC BY-SA 4.0)',
      };
    }

    const bbox = bboxFromRadius(coords, 180);
    const url = new URL('https://graph.mapillary.com/images');
    url.searchParams.set('access_token', token);
    url.searchParams.set('fields', 'id,compass_angle,captured_at,geometry,thumb_1024_url');
    url.searchParams.set('bbox', bbox.join(','));
    url.searchParams.set('limit', '12');

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) {
        return {
          available: false,
          configured: true,
          provider: 'mapillary',
          frames: [],
          viewerTokenAvailable: false,
          message: `Mapillary API returned HTTP ${res.status}. Verify MAPILLARY_ACCESS_TOKEN permissions.`,
          attribution: '© Mapillary contributors (CC BY-SA 4.0)',
        };
      }

      const body = (await res.json()) as {
        data?: Array<{
          id: string;
          compass_angle?: number;
          captured_at?: number;
          thumb_1024_url?: string;
          geometry?: { coordinates?: [number, number] };
        }>;
      };

      const frames: StreetImageryFrame[] = (body.data ?? []).flatMap((item) => {
        const c = item.geometry?.coordinates;
        if (!c || c.length < 2) return [];
        return [
          {
            id: item.id,
            lng: c[0],
            lat: c[1],
            compassAngle: item.compass_angle ?? 0,
            capturedAt: item.captured_at
              ? new Date(item.captured_at).toISOString()
              : new Date().toISOString(),
            thumbUrl: item.thumb_1024_url,
            provider: 'mapillary' as const,
            attribution: '© Mapillary contributors (CC BY-SA 4.0)',
          },
        ];
      });

      if (frames.length === 0) {
        return {
          available: false,
          configured: true,
          provider: 'mapillary',
          frames: [],
          viewerTokenAvailable: true,
          message: 'No Mapillary street-level imagery frames exist within 180 meters of this coordinate.',
          attribution: '© Mapillary contributors (CC BY-SA 4.0)',
        };
      }

      return {
        available: true,
        configured: true,
        provider: 'mapillary',
        frames,
        viewerTokenAvailable: true,
        message: `Found ${frames.length} street-level frames nearby.`,
        attribution: '© Mapillary contributors (CC BY-SA 4.0)',
      };
    } catch {
      return {
        available: false,
        configured: true,
        provider: 'mapillary',
        frames: [],
        viewerTokenAvailable: false,
        message: 'Mapillary API could not be reached from this network environment.',
        attribution: '© Mapillary contributors (CC BY-SA 4.0)',
      };
    }
  }
}
