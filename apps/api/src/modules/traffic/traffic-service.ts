import {
  isPointInBbox,
  type BoundingBox,
  type CongestionLevel,
  type TrafficResponse,
  type TrafficSegment,
} from '@hexa/shared';
import { OSM_ROAD_SEGMENTS } from '../../data/osm-network.js';
import type { AppEnv } from '../../config/env.js';

export class TrafficService {
  constructor(private readonly env: AppEnv) {}

  public async getTrafficForBbox(bbox?: BoundingBox): Promise<TrafficResponse> {
    if (this.env.TRAFFIC_PROVIDER === 'tomtom' && this.env.TOMTOM_API_KEY && bbox) {
      try {
        return await this.fetchLiveTomTomFlow(bbox);
      } catch {
        // Fall through cleanly to simulated development feed with explicit provenance label
      }
    }

    return this.buildSimulatedFeed(bbox);
  }

  private async fetchLiveTomTomFlow(bbox: BoundingBox): Promise<TrafficResponse> {
    const centerLat = (bbox[1] + bbox[3]) / 2;
    const centerLng = (bbox[0] + bbox[2]) / 2;
    const url = new URL(
      'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json',
    );
    url.searchParams.set('point', `${centerLat},${centerLng}`);
    url.searchParams.set('key', this.env.TOMTOM_API_KEY);

    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) throw new Error(`TomTom HTTP ${res.status}`);
    const payload = (await res.json()) as {
      flowSegmentData?: {
        currentSpeed?: number;
        freeFlowSpeed?: number;
        currentTravelTime?: number;
        freeFlowTravelTime?: number;
        coordinates?: { coordinate?: Array<{ latitude: number; longitude: number }> };
      };
    };

    const flow = payload.flowSegmentData;
    if (!flow?.coordinates?.coordinate?.length) {
      throw new Error('Empty TomTom segment');
    }

    const current = flow.currentSpeed ?? 50;
    const free = Math.max(1, flow.freeFlowSpeed ?? 60);
    const ratio = current / free;
    const congestion: CongestionLevel =
      ratio >= 0.8 ? 'flowing' : ratio >= 0.55 ? 'moderate' : ratio >= 0.3 ? 'heavy' : 'severe';

    return {
      provenance: 'live',
      providerName: 'TomTom Traffic Flow API',
      updatedAt: new Date().toISOString(),
      disclaimer: 'Live traffic speed feed supplied by TomTom. Routing ETAs remain independent unless a traffic-aware engine is configured.',
      segments: [
        {
          id: 'tomtom-live-0',
          roadName: 'Monitored Corridor',
          congestion,
          speedKph: current,
          freeFlowSpeedKph: free,
          delaySeconds: Math.max(0, (flow.currentTravelTime ?? 0) - (flow.freeFlowTravelTime ?? 0)),
          coordinates: flow.coordinates.coordinate.map((c) => [c.longitude, c.latitude]),
        },
      ],
    };
  }

  private buildSimulatedFeed(bbox?: BoundingBox): TrafficResponse {
    // Deterministic 5-minute bucket so tests & live preview show stable, realistic corridor variation
    const bucket = Math.floor(Date.now() / (5 * 60_000));
    const segments: TrafficSegment[] = [];

    OSM_ROAD_SEGMENTS.forEach((seg, idx) => {
      if (bbox) {
        const anyInside = seg.coordinates.some(([lng, lat]) => isPointInBbox({ lat, lng }, bbox));
        if (!anyInside) return;
      }

      const freeFlow =
        seg.highway === 'motorway' ? 100 : seg.highway === 'trunk' ? 75 : seg.highway === 'primary' ? 55 : 42;
      const hash = (idx * 31 + bucket * 7) % 10;
      let congestion: CongestionLevel = 'flowing';
      let factor = 0.92;
      if (hash === 8 || hash === 9) {
        congestion = 'moderate';
        factor = 0.68;
      } else if (hash === 7) {
        congestion = 'heavy';
        factor = 0.42;
      } else if (hash === 6 && (seg.id.includes('porvorim') || seg.id.includes('i95') || seg.id.includes('m25'))) {
        congestion = 'severe';
        factor = 0.24;
      }

      const currentSpeed = Math.max(8, Math.round(freeFlow * factor));
      const delaySeconds =
        congestion === 'flowing'
          ? 0
          : congestion === 'moderate'
            ? 140
            : congestion === 'heavy'
              ? 360
              : 690;

      segments.push({
        id: `sim-traffic-${seg.id}`,
        roadName: seg.name,
        ref: seg.ref,
        congestion,
        speedKph: currentSpeed,
        freeFlowSpeedKph: freeFlow,
        delaySeconds,
        coordinates: seg.coordinates,
      });
    });

    return {
      provenance: 'simulated',
      providerName: 'Hexa Simulated Development Traffic Feed',
      updatedAt: new Date(bucket * 5 * 60_000).toISOString(),
      disclaimer:
        'SIMULATED TRAFFIC DATA for development & cartographic preview. Set TRAFFIC_PROVIDER=tomtom and TOMTOM_API_KEY for live probe telemetry.',
      segments,
    };
  }
}
