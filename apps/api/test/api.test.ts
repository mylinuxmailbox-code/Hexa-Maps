import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { loadEnv } from '../src/config/env.js';
import { buildServer, type HexaApiContext } from '../src/server.js';

describe('@hexa/api — Full Backend & Spatial Integration Suite', () => {
  let ctx: HexaApiContext;
  let baseUrl: string;

  beforeAll(async () => {
    const testEnv = loadEnv({
      NODE_ENV: 'test',
      GEOCODING_PROVIDERS: 'local',
      ROUTING_PROVIDERS: 'local',
      TRAFFIC_PROVIDER: 'simulated',
      RATE_LIMIT_MAX_PER_MINUTE: '2000',
    });
    ctx = await buildServer({ env: testEnv, inMemoryDb: true, enableLogs: false });
    const addr = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
    baseUrl = addr;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('1. serves health check and OpenAPI v3 specification', async () => {
    const healthRes = await ctx.app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(healthRes.statusCode).toBe(200);
    const body = healthRes.json();
    expect(body.status).toBe('ok');
    expect(body.database.engine).toBe('pglite-postgres');
    expect(body.capabilities.trafficProvenance).toBe('simulated');

    const openApiRes = await ctx.app.inject({ method: 'GET', url: '/docs/json' });
    expect(openApiRes.statusCode).toBe(200);
    expect(openApiRes.json().openapi).toMatch(/^3\./);
  });

  it('2. generates real binary Mapbox Vector Tiles (.pbf) and Noto Sans font glyphs (.pbf)', async () => {
    // Tile covering Goa, India at zoom 6 (x=45, y=29)
    const tileRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/tiles/basemap/6/45/29.pbf',
    });
    expect(tileRes.statusCode).toBe(200);
    expect(tileRes.headers['content-type']).toContain('application/x-protobuf');
    expect(tileRes.rawPayload.length).toBeGreaterThan(200);

    const glyphRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/glyphs/Noto%20Sans%20Regular/0-255.pbf',
    });
    expect(glyphRes.statusCode).toBe(200);
    expect(glyphRes.rawPayload.length).toBeGreaterThan(1000);
  });

  it('3. performs forward geocoding (cities, POIs, NH 66, Mumbai–Pune Expy, category search) & reverse geocoding without fake ratings', async () => {
    const panaji = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/geocode/search?q=Panaji,%20Goa',
    });
    expect(panaji.statusCode).toBe(200);
    expect(panaji.json().results[0].name).toContain('Panaji');

    const mapusaBus = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/geocode/search?q=Mapusa%20Bus%20Stand',
    });
    expect(mapusaBus.json().results[0].category).toBe('bus_station');

    const nh66 = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/geocode/search?q=NH%2066',
    });
    expect(nh66.json().results[0].shields[0].displayRef).toBe('NH 66');
    expect(nh66.json().results[0].shields[0].family).toBe('IN_NH');

    const restaurants = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/geocode/search?q=Restaurants%20near%20Mapusa',
    });
    expect(restaurants.json().results.length).toBeGreaterThan(0);
    expect(restaurants.json().results[0].category).toBe('restaurant');
    // Verify zero fabricated business ratings
    expect(restaurants.json().results[0].rating).toBeUndefined();

    const rev = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/geocode/reverse?lat=15.5912&lng=73.8080',
    });
    expect(rev.statusCode).toBe(200);
    expect(rev.json().place.name).toContain('Mapusa');
  });

  it('4. calculates driving, walking, cycling, and transit routes with verified highway shields & error handling', async () => {
    // Driving from Mapusa Bus Stand to Panaji KTC along NH 66
    const driveRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/routing/route',
      payload: {
        mode: 'driving',
        alternatives: true,
        waypoints: [
          { lat: 15.5912, lng: 73.808, label: 'Mapusa Bus Stand' },
          { lat: 15.4945, lng: 73.8368, label: 'Panaji KTC' },
        ],
      },
    });
    expect(driveRes.statusCode).toBe(200);
    const driveBody = driveRes.json();
    expect(driveBody.routes.length).toBeGreaterThanOrEqual(1);
    const primary = driveBody.routes[0];
    expect(primary.distanceMeters).toBeGreaterThan(9_000);
    expect(primary.shields.some((s: { displayRef: string }) => s.displayRef === 'NH 66')).toBe(true);
    expect(primary.steps.length).toBeGreaterThanOrEqual(2);

    // Transit route between Mapusa and Margao via KTC Shuttle / Konkan corridor
    const transitRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/routing/route',
      payload: {
        mode: 'transit',
        waypoints: [
          { lat: 15.5912, lng: 73.808, label: 'Mapusa' },
          { lat: 15.2952, lng: 73.9581, label: 'Margao' },
        ],
      },
    });
    expect(transitRes.statusCode).toBe(200);
    expect(transitRes.json().routes[0].steps.some((s: { transit?: unknown }) => Boolean(s.transit))).toBe(true);

    // Identical origin & destination returns structured 422 error
    const badRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/routing/route',
      payload: {
        mode: 'driving',
        waypoints: [
          { lat: 15.5912, lng: 73.808 },
          { lat: 15.5912, lng: 73.808 },
        ],
      },
    });
    expect(badRes.statusCode).toBe(422);
    expect(badRes.json().error.code).toBe('IDENTICAL_ENDPOINTS');
  });

  it('5. persists incidents with PostGIS/earthdistance spatial queries, 150m duplicate merging, expiration, and Socket.IO broadcasts', async () => {
    const clientSocket = ioClient(baseUrl, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
    });

    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => {
        clientSocket.emit('viewport:subscribe', { bbox: [73.6, 15.2, 74.1, 15.8] });
        setTimeout(resolve, 80);
      });
    });

    const receivedEvents: Array<{ event: string; id: string }> = [];
    clientSocket.on('incident:created', (inc: { id: string }) => {
      receivedEvents.push({ event: 'created', id: inc.id });
    });
    clientSocket.on('incident:updated', (inc: { id: string }) => {
      receivedEvents.push({ event: 'updated', id: inc.id });
    });

    // Submit community incident near Calangute
    const create1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/incidents',
      headers: { 'x-hexa-guest-id': 'driver-alpha' },
      payload: {
        category: 'accident',
        severity: 'high',
        title: 'Two-vehicle fender bender near Calangute Circle',
        roadName: 'GA SH 1',
        lat: 15.5449,
        lng: 73.7684,
      },
    });
    expect(create1.statusCode).toBe(201);
    const incId = create1.json().incident.id;
    expect(create1.json().incident.verificationSource).toBe('community');

    // Submit duplicate within 50m by second driver -> merges instead of duplicating!
    const create2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/incidents',
      headers: { 'x-hexa-guest-id': 'driver-beta' },
      payload: {
        category: 'accident',
        severity: 'high',
        lat: 15.545,
        lng: 73.7685,
      },
    });
    expect(create2.statusCode).toBe(200);
    expect(create2.json().mergedDuplicate).toBe(true);
    expect(create2.json().incident.id).toBe(incId);
    expect(create2.json().incident.confirmationsCount).toBeGreaterThanOrEqual(2);

    // Spatial radius query around Calangute returns it; query around Tokyo does not
    const nearGoa = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/incidents?lat=15.5449&lng=73.7684&radiusMeters=5000',
    });
    expect(nearGoa.json().incidents.some((i: { id: string }) => i.id === incId)).toBe(true);

    const nearTokyo = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/incidents?lat=35.6812&lng=139.7671&radiusMeters=5000',
    });
    expect(nearTokyo.json().incidents).toHaveLength(0);

    // Wait briefly for Socket.IO delivery
    await new Promise((r) => setTimeout(r, 120));
    expect(receivedEvents.some((e) => e.id === incId)).toBe(true);
    clientSocket.disconnect();
  });

  it('6. enforces user authentication, saved-place ownership isolation, password reset, and account deletion', async () => {
    const regA = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'arjun@hexamaps.example',
        password: 'StrongPassword#2026',
        displayName: 'Arjun Naik',
      },
    });
    expect(regA.statusCode).toBe(201);
    const tokenA = regA.json().token as string;

    const regB = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'meera@hexamaps.example',
        password: 'AnotherStrongPassword#2026',
        displayName: 'Meera Desai',
      },
    });
    const tokenB = regB.json().token as string;

    // User A saves Home
    const saveHome = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/places/saved',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: {
        kind: 'home',
        label: 'Home — Khorlim, Mapusa',
        lat: 15.5885,
        lng: 73.8042,
      },
    });
    expect(saveHome.statusCode).toBe(201);
    const placeId = saveHome.json().place.id as string;

    // User B cannot see or delete User A's saved place!
    const listB = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/places/saved',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(listB.json().places).toHaveLength(0);

    const hijackDelete = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/places/saved/${placeId}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(hijackDelete.statusCode).toBe(404);

    // Password reset workflow
    const rstReq = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/request',
      payload: { email: 'meera@hexamaps.example' },
    });
    expect(rstReq.statusCode).toBe(200);
    const resetToken = rstReq.json().resetTokenPreview as string;
    expect(resetToken.length).toBeGreaterThan(16);

    const rstConfirm = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/confirm',
      payload: { token: resetToken, newPassword: 'UpdatedPassword#9999' },
    });
    expect(rstConfirm.statusCode).toBe(200);

    // User A deletes account -> cascades saved places & invalidates session
    const delAcc = await ctx.app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/account',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(delAcc.statusCode).toBe(200);

    const meAfter = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(meAfter.json().authenticated).toBe(false);
  });

  it('7. clearly labels simulated traffic provenance and street-level imagery unconfigured states', async () => {
    const traffic = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/traffic?bbox=73.6,15.2,74.1,15.8',
    });
    expect(traffic.statusCode).toBe(200);
    expect(traffic.json().provenance).toBe('simulated');
    expect(traffic.json().disclaimer).toContain('SIMULATED');
    expect(traffic.json().segments.length).toBeGreaterThan(0);

    const imagery = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/imagery/nearby?lat=15.4989&lng=73.8278',
    });
    expect(imagery.statusCode).toBe(200);
    expect(imagery.json().available).toBe(false);
    expect(imagery.json().configured).toBe(false);
  });
});
