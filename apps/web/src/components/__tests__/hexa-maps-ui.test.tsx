// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { HexaMapsApp } from '../HexaMapsApp';

// Deterministic MapLibre GL JS mock for jsdom (WebGL2 is unavailable in headless jsdom)
vi.mock('maplibre-gl', () => {
  class MockMap {
    private handlers = new Map<string, Array<(e?: unknown) => void>>();
    private images = new Set<string>();
    private sources = new Map<string, { setData: () => void }>();
    private layers = new Set<string>();

    on(event: string, cb: (e?: unknown) => void) {
      const list = this.handlers.get(event) ?? [];
      list.push(cb);
      this.handlers.set(event, list);
      if (event === 'load') {
        setTimeout(() => cb(), 0);
      }
    }
    isStyleLoaded() {
      return true;
    }
    setStyle() {}
    flyTo() {}
    easeTo() {}
    fitBounds() {}
    zoomIn() {}
    zoomOut() {}
    getCenter() {
      return { lat: 15.535, lng: 73.825 };
    }
    getZoom() {
      return 11.2;
    }
    getBearing() {
      return 0;
    }
    getPitch() {
      return 0;
    }
    getBounds() {
      return {
        getWest: () => 73.68,
        getSouth: () => 15.35,
        getEast: () => 74.02,
        getNorth: () => 15.72,
      };
    }
    hasImage(id: string) {
      return this.images.has(id);
    }
    addImage(id: string) {
      this.images.add(id);
    }
    getSource(id: string) {
      return this.sources.get(id);
    }
    addSource(id: string) {
      this.sources.set(id, { setData: () => {} });
    }
    getLayer(id: string) {
      return this.layers.has(id) ? { id } : undefined;
    }
    addLayer(layer: { id: string }) {
      this.layers.add(layer.id);
    }
    queryRenderedFeatures() {
      return [];
    }
    remove() {}
  }

  return {
    default: {
      Map: MockMap,
      addProtocol: () => {},
    },
  };
});

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: () => {},
    emit: () => {},
    disconnect: () => {},
  }),
}));

describe('@hexa/web — Interactive Map UI, Search, Routing, Shields, Incidents & Offline States', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes('/api/v1/auth/me')) {
        return new Response(
          JSON.stringify({
            authenticated: false,
            user: null,
            preferences: {
              defaultMapStyle: 'standard',
              distanceUnit: 'metric',
              preferredTransportMode: 'driving',
              avoidTollsByDefault: false,
              saveSearchHistory: true,
              showShieldsOnMap: true,
              historyRetentionDays: 30,
            },
          }),
          { status: 200 },
        );
      }

      if (url.includes('/api/v1/geocode/search')) {
        return new Response(
          JSON.stringify({
            query: 'Panaji',
            count: 1,
            results: [
              {
                id: 'osm-node-panaji-city',
                name: 'Panaji',
                displayName: 'Panaji, North Goa, Goa, India',
                category: 'city',
                coordinates: { lat: 15.4909, lng: 73.8278 },
                shields: [
                  {
                    id: 'shield:IN_NH:NH:66:light',
                    family: 'IN_NH',
                    code: 'NH:66',
                    displayRef: 'NH 66',
                    isInternational: false,
                    isToll: false,
                    confidence: 'verified',
                  },
                ],
                source: 'local_osm_ne',
                attribution: '© OpenStreetMap contributors',
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.includes('/api/v1/routing/route')) {
        return new Response(
          JSON.stringify({
            mode: 'driving',
            count: 1,
            routes: [
              {
                id: 'route-test-1',
                summary: 'Via NH 66 — Mapusa–Panaji Corridor',
                mode: 'driving',
                distanceMeters: 11800,
                durationSeconds: 780,
                estimatedArrivalIso: new Date(Date.now() + 780_000).toISOString(),
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [73.808, 15.5912],
                    [73.8368, 15.4945],
                  ],
                },
                bbox: [73.8, 15.48, 73.85, 15.6],
                shields: [
                  {
                    id: 'shield:IN_NH:NH:66:light',
                    family: 'IN_NH',
                    code: 'NH:66',
                    displayRef: 'NH 66',
                    isInternational: false,
                    isToll: false,
                    confidence: 'verified',
                  },
                ],
                steps: [
                  {
                    index: 0,
                    instruction: 'Head out on NH 66 — Mapusa–Porvorim–Atal Setu Corridor',
                    maneuver: 'depart',
                    roadName: 'NH 66',
                    distanceMeters: 11800,
                    durationSeconds: 780,
                    location: { lat: 15.5912, lng: 73.808 },
                    shields: [
                      {
                        id: 'shield:IN_NH:NH:66:light',
                        family: 'IN_NH',
                        code: 'NH:66',
                        displayRef: 'NH 66',
                        isInternational: false,
                        isToll: false,
                        confidence: 'verified',
                      },
                    ],
                    isToll: false,
                  },
                  {
                    index: 1,
                    instruction: 'Arrive at Panaji KTC',
                    maneuver: 'arrive',
                    distanceMeters: 0,
                    durationSeconds: 0,
                    location: { lat: 15.4945, lng: 73.8368 },
                    shields: [],
                    isToll: false,
                  },
                ],
                warnings: [],
                hasTolls: false,
                provider: 'local_road_graph',
                attribution: '© OpenStreetMap contributors',
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.includes('/api/v1/incidents') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            mergedDuplicate: false,
            incident: {
              id: 'inc-new-1',
              category: 'accident',
              severity: 'moderate',
              title: 'Collision Reported',
              description: 'Minor bumper contact near Porvorim',
              roadName: 'NH 66',
              coordinates: { lat: 15.5335, lng: 73.8286 },
              verificationSource: 'community',
              status: 'active',
              confirmationsCount: 1,
              resolvedVotesCount: 0,
              reporterDisplayName: 'Community Explorer',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            },
          }),
          { status: 201 },
        );
      }

      if (url.includes('/api/v1/incidents')) {
        return new Response(JSON.stringify({ count: 0, incidents: [] }), { status: 200 });
      }

      if (url.includes('/api/v1/places/saved') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            place: {
              id: 'plc-saved-1',
              ...body,
              createdAt: new Date().toISOString(),
            },
          }),
          { status: 201 },
        );
      }

      if (url.includes('/api/v1/places/saved')) {
        return new Response(JSON.stringify({ places: [] }), { status: 200 });
      }

      if (url.includes('/api/v1/history/searches')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads the interactive map canvas, search omnibox, attribution, dark/light toggle, and gated satellite layer', async () => {
    render(
      <AppProviders>
        <HexaMapsApp />
      </AppProviders>,
    );

    expect(screen.getByTestId('hexa-map-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('omnibox-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('map-attribution')).toHaveTextContent('OpenStreetMap');

    // Toggle Dark Mode and verify root class updates
    fireEvent.click(screen.getByTestId('theme-toggle-btn'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Open Map Layers popover and verify Satellite is honestly disabled without an imagery key
    fireEvent.click(screen.getByTestId('map-layers-button'));
    expect(screen.getByTestId('style-option-satellite')).toBeDisabled();
  });

  it('shows autocomplete suggestions, selects a place, requests directions, and renders highway shields', async () => {
    render(
      <AppProviders>
        <HexaMapsApp />
      </AppProviders>,
    );

    const searchInput = screen.getByTestId('omnibox-search-input');
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Panaji' } });

    const option = await screen.findByTestId('autocomplete-option');
    expect(option).toHaveTextContent('Panaji');
    fireEvent.click(option);

    const placeCards = await screen.findAllByTestId('selected-place-card');
    expect(placeCards[0]).toHaveTextContent('Panaji');

    // Click Directions from Place Card -> switches to Directions panel and renders route + NH 66 shield!
    fireEvent.click(screen.getAllByTestId('directions-to-place-btn')[0]!);
    const stepsLists = await screen.findAllByTestId('turn-by-turn-steps');
    expect(stepsLists[0]).toHaveTextContent('NH 66');
    expect(screen.getAllByAltText('NH 66').length).toBeGreaterThan(0);
  });

  it('saves places, submits community incidents, renders the international shield lab, and handles offline network states', async () => {
    render(
      <AppProviders>
        <HexaMapsApp />
      </AppProviders>,
    );

    // Switch to Saved Places tab and add a custom saved pin
    fireEvent.click(screen.getByTestId('tab-btn-saved'));
    fireEvent.change(screen.getAllByTestId('custom-pin-label-input')[0]!, {
      target: { value: 'Khorlim Home Pin' },
    });
    fireEvent.click(screen.getAllByTestId('add-saved-place-btn')[0]!);

    // Switch to Shields Lab tab and verify country shield gallery renders
    fireEvent.click(screen.getByTestId('tab-btn-shields'));
    expect(screen.getAllByText('International Highway Shield System')[0]).toBeInTheDocument();
    expect(screen.getAllByAltText('I-95')[0]).toBeInTheDocument();
    expect(screen.getAllByAltText('A 3')[0]).toBeInTheDocument();

    // Switch to Incident Reporting tab and submit a report
    fireEvent.click(screen.getByTestId('tab-btn-incidents'));
    fireEvent.change(screen.getAllByTestId('incident-description-input')[0]!, {
      target: { value: 'Minor bumper contact near Porvorim' },
    });
    fireEvent.click(screen.getAllByTestId('submit-incident-btn')[0]!);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Community incident submitted and broadcast live/i)[0],
      ).toBeInTheDocument();
    });

    // Simulate offline event -> displays honest Offline banner
    fireEvent(window, new Event('offline'));
    expect(await screen.findByTestId('offline-network-banner')).toBeInTheDocument();
  });
});
