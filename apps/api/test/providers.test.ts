import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NominatimGeocodingProvider,
  PhotonGeocodingProvider,
} from '../src/modules/geocode/geocoding-service.js';
import { OsrmRoutingProvider } from '../src/modules/routing/routing-service.js';

describe('External Provider Adapters (Deterministic Mocked HTTP)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes Photon GeoJSON geocoding responses with strict attribution', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          features: [
            {
              geometry: { coordinates: [73.8278, 15.4909] },
              properties: {
                osm_id: 245655195,
                osm_value: 'city',
                name: 'Panaji',
                state: 'Goa',
                country: 'India',
                countrycode: 'in',
                extent: [73.79, 15.52, 73.86, 15.46],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const photon = new PhotonGeocodingProvider('https://photon.example.test');
    const results = await photon.search({ q: 'Panaji' });
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Panaji');
    expect(results[0]?.countryCode).toBe('IN');
    expect(results[0]?.source).toBe('photon');
    expect(results[0]?.attribution).toContain('OpenStreetMap');
  });

  it('normalizes Nominatim v2 JSON responses and sends required User-Agent header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            place_id: 99123,
            lat: '15.5912',
            lon: '73.8080',
            name: 'Mapusa',
            display_name: 'Mapusa, Bardez, North Goa, Goa, 403507, India',
            type: 'town',
            boundingbox: ['15.57', '15.61', '73.79', '73.83'],
            address: {
              town: 'Mapusa',
              state: 'Goa',
              country: 'India',
              country_code: 'in',
              postcode: '403507',
            },
          },
        ]),
        { status: 200 },
      ),
    );

    const nominatim = new NominatimGeocodingProvider(
      'https://nominatim.example.test',
      'HexaMapsTest/1.0',
    );
    const results = await nominatim.search({ q: 'Mapusa', countryCode: 'IN' });
    expect(results[0]?.postcode).toBe('403507');
    expect(results[0]?.source).toBe('nominatim');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('normalizes OSRM route responses and extracts verified highway shields from step refs', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [
            {
              distance: 11850,
              duration: 740,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [73.808, 15.5912],
                  [73.8286, 15.5335],
                  [73.8368, 15.4945],
                ],
              },
              legs: [
                {
                  summary: 'NH 66',
                  steps: [
                    {
                      name: 'Mumbai-Goa Highway',
                      ref: 'NH 66',
                      distance: 11850,
                      duration: 740,
                      maneuver: {
                        type: 'depart',
                        location: [73.808, 15.5912],
                      },
                    },
                    {
                      name: 'Patto Plaza',
                      distance: 0,
                      duration: 0,
                      maneuver: {
                        type: 'arrive',
                        location: [73.8368, 15.4945],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const osrm = new OsrmRoutingProvider('https://osrm.example.test');
    const routes = await osrm.calculateRoutes({
      mode: 'driving',
      alternatives: true,
      avoidTolls: false,
      waypoints: [
        { lat: 15.5912, lng: 73.808 },
        { lat: 15.4945, lng: 73.8368 },
      ],
    });

    expect(routes).toHaveLength(1);
    expect(routes[0]?.provider).toBe('osrm');
    expect(routes[0]?.shields[0]?.displayRef).toBe('NH 66');
    expect(routes[0]?.steps[0]?.shields[0]?.family).toBe('IN_NH');
    // Step without `ref` has zero fabricated shields
    expect(routes[0]?.steps[1]?.shields).toHaveLength(0);
  });
});
