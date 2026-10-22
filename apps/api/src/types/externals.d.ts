declare module 'vt-pbf' {
  export function fromGeojsonVt(
    layers: Record<string, unknown>,
    options?: { version?: number; extent?: number },
  ): Uint8Array;
}

declare module 'geojson-vt' {
  export default class GeoJSONVT {
    constructor(data: unknown, options?: Record<string, unknown>);
    getTile(z: number, x: number, y: number): { features: unknown[] } | null;
  }
}
