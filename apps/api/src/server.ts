import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Server as SocketIOServer } from 'socket.io';
import { ZodError, z } from 'zod';
import {
  GeocodeSearchQuerySchema,
  IncidentCreateSchema,
  IncidentVoteSchema,
  LoginSchema,
  OfflineRegionCreateSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  RegisterSchema,
  ReverseGeocodeQuerySchema,
  RouteRequestSchema,
  SavedPlaceCreateSchema,
  UserPreferencesSchema,
  regionCellKey,
  regionCellKeysForBbox,
  type BoundingBox,
} from '@hexa/shared';
import { classifyRoad, OsmRoadInput } from '@hexa/shields';
import { loadEnv, type AppEnv } from './config/env.js';
import { createDatabaseContext, type DatabaseContext } from './db/client.js';
import { LocalVectorTileService } from './modules/tiles/tile-service.js';
import { CompositeGeocodingService } from './modules/geocode/geocoding-service.js';
import { CompositeRoutingService, RoutingError } from './modules/routing/routing-service.js';
import { TrafficService } from './modules/traffic/traffic-service.js';
import { IncidentService } from './modules/incidents/incident-service.js';
import { AuthService } from './modules/auth/auth-service.js';
import { UserPlacesService } from './modules/places/places-service.js';
import { StreetImageryService } from './modules/imagery/imagery-service.js';

export interface BuildServerOptions {
  env?: AppEnv;
  inMemoryDb?: boolean;
  enableLogs?: boolean;
}

export interface HexaApiContext {
  app: FastifyInstance;
  io: SocketIOServer;
  dbCtx: DatabaseContext;
  close: () => Promise<void>;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<HexaApiContext> {
  const appEnv = options.env ?? loadEnv();
  const dbCtx = await createDatabaseContext({
    env: appEnv,
    inMemory: options.inMemoryDb ?? appEnv.NODE_ENV === 'test',
  });

  const app = Fastify({
    logger: options.enableLogs ?? appEnv.NODE_ENV !== 'test',
    trustProxy: true,
  });

  // Security headers (relaxed crossOriginResourcePolicy so binary .pbf tiles load cleanly)
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: false,
  });

  await app.register(cors, {
    origin:
      appEnv.CORS_ALLOWED_ORIGINS === '*'
        ? true
        : appEnv.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
  });

  await app.register(cookie, {
    secret: appEnv.SESSION_SECRET,
  });

  await app.register(rateLimit, {
    max: appEnv.RATE_LIMIT_MAX_PER_MINUTE,
    timeWindow: '1 minute',
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Hexa Maps REST & Geospatial API',
        description:
          'Versioned OpenAPI specification for Hexa Maps geocoding, multimodal routing, international highway shield intelligence, real-time incidents, traffic, offline regions, and user personalization.',
        version: '1.0.0',
      },
      servers: [{ url: '/api/v1', description: 'Relative v1 API namespace' }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Domain services
  const tileService = new LocalVectorTileService();
  const geocodingService = new CompositeGeocodingService(appEnv);
  const routingService = new CompositeRoutingService(appEnv);
  const trafficService = new TrafficService(appEnv);
  const incidentService = new IncidentService(dbCtx);
  const authService = new AuthService(dbCtx, appEnv);
  const placesService = new UserPlacesService(dbCtx);
  const imageryService = new StreetImageryService(appEnv);

  // Attach Socket.IO on `/api/socket.io` so browser clients connect via relative path proxy
  const io = new SocketIOServer(app.server, {
    path: '/api/socket.io',
    addTrailingSlash: false,
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('viewport:subscribe', (payload: { bbox?: BoundingBox }) => {
      if (!payload?.bbox || !Array.isArray(payload.bbox) || payload.bbox.length !== 4) return;
      for (const room of socket.rooms) {
        if (room.startsWith('region:')) socket.leave(room);
      }
      const rooms = regionCellKeysForBbox(payload.bbox);
      for (const r of rooms) {
        socket.join(r);
      }
    });
  });

  // Centralized structured error handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '),
          details: error.issues,
          requestId: request.id,
        },
      });
    }

    if (error instanceof RoutingError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
        },
      });
    }

    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? ((error as { statusCode: number }).statusCode)
        : 500;
    if (statusCode >= 500) {
      request.log.error(error);
    }

    return reply.status(statusCode).send({
      error: {
        code: statusCode === 429 ? 'RATE_LIMITED' : statusCode === 401 ? 'UNAUTHORIZED' : 'API_ERROR',
        message:
          statusCode >= 500 && appEnv.NODE_ENV === 'production'
            ? 'An unexpected server error occurred.'
            : (error instanceof Error ? error.message : 'Request failed'),
        requestId: request.id,
      },
    });
  });

  // =========================================================================
  // Versioned /api/v1 Routes
  // =========================================================================

  app.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      service: 'hexa-maps-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: {
        engine: dbCtx.engine,
        postgisEnabled: dbCtx.hasPostgis,
      },
      capabilities: {
        localVectorTiles: true,
        routingModes: routingService.getSupportedModes(),
        trafficProvenance: appEnv.TRAFFIC_PROVIDER === 'tomtom' && appEnv.TOMTOM_API_KEY ? 'live' : 'simulated',
        mapillaryConfigured: Boolean(appEnv.MAPILLARY_ACCESS_TOKEN),
      },
    };
  });

  // --- Vector Tiles (.pbf), Font Glyphs (.pbf) & Classified Roads ---
  app.get('/api/v1/tiles/basemap/:z/:x/:yFile', async (req, reply) => {
    const params = z
      .object({
        z: z.coerce.number().int().min(0).max(18),
        x: z.coerce.number().int().min(0),
        yFile: z.string(),
      })
      .parse(req.params);
    const y = Number.parseInt(params.yFile.replace(/\.pbf$/i, ''), 10);
    if (!Number.isFinite(y) || y < 0) {
      return reply.status(400).send({ error: { code: 'BAD_TILE', message: 'Invalid tile Y' } });
    }
    const buf = tileService.getVectorTilePbf(params.z, params.x, y);
    reply
      .header('Content-Type', 'application/x-protobuf')
      .header('Cache-Control', 'public, max-age=3600');
    if (buf.length === 0) {
      return reply.status(204).send();
    }
    return reply.send(buf);
  });

  app.get('/api/v1/glyphs/:fontstack/:rangeFile', async (req, reply) => {
    const params = z.object({ fontstack: z.string(), rangeFile: z.string() }).parse(req.params);
    const buf = tileService.getGlyphPbf(params.fontstack, params.rangeFile);
    return reply
      .header('Content-Type', 'application/x-protobuf')
      .header('Cache-Control', 'public, max-age=86400')
      .send(buf);
  });

  app.get('/api/v1/roads/classified', async () => {
    return tileService.getClassifiedRoadsGeoJson();
  });

  app.post('/api/v1/roads/classify', async (req) => {
    const body = z
      .object({
        highway: z.string().optional(),
        ref: z.string().optional(),
        int_ref: z.string().optional(),
        network: z.string().optional(),
        name: z.string().optional(),
        official_name: z.string().optional(),
        toll: z.string().optional(),
        countryCode: z.string().max(3).optional(),
        subdivisionCode: z.string().max(4).optional(),
        theme: z.enum(['light', 'dark']).default('light'),
      })
      .parse(req.body);
    return classifyRoad(body as OsmRoadInput, body.theme);
  });

  // --- Search, Geocoding & Reverse Geocoding ---
  app.get('/api/v1/geocode/search', async (req) => {
    const query = GeocodeSearchQuerySchema.parse(req.query);
    const results = await geocodingService.search(query);
    const { actor } = await authService.resolveActor(req);
    if (query.q.length >= 3 && results[0]) {
      await placesService.recordSearchHistory(actor, {
        query: query.q,
        placeName: results[0].name,
        lat: results[0].coordinates.lat,
        lng: results[0].coordinates.lng,
      });
    }
    return {
      query: query.q,
      count: results.length,
      results,
    };
  });

  app.get('/api/v1/geocode/reverse', async (req) => {
    const coords = ReverseGeocodeQuerySchema.parse(req.query);
    const place = await geocodingService.reverse(coords);
    return { place };
  });

  app.get('/api/v1/places/lookup/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const place = geocodingService.getPlaceById(id);
    if (!place) {
      return reply.status(404).send({
        error: { code: 'PLACE_NOT_FOUND', message: 'Place not found in local index.' },
      });
    }
    return { place };
  });

  // --- Multimodal Routing ---
  app.get('/api/v1/routing/modes', async () => {
    return { modes: routingService.getSupportedModes() };
  });

  app.post('/api/v1/routing/route', async (req) => {
    const body = RouteRequestSchema.parse(req.body);
    const routes = await routingService.calculateRoutes(body);
    return {
      mode: body.mode,
      count: routes.length,
      routes,
    };
  });

  // --- Traffic & Road Conditions ---
  app.get('/api/v1/traffic', async (req) => {
    const query = z
      .object({
        bbox: z.string().optional(),
      })
      .parse(req.query);

    let parsedBbox: BoundingBox | undefined;
    if (query.bbox) {
      const nums = query.bbox.split(',').map(Number);
      if (nums.length === 4 && nums.every(Number.isFinite)) {
        parsedBbox = [nums[0]!, nums[1]!, nums[2]!, nums[3]!];
      }
    }
    return trafficService.getTrafficForBbox(parsedBbox);
  });

  // --- Community Incidents + Real-Time Socket.IO Broadcasts ---
  app.get('/api/v1/incidents', async (req) => {
    const query = z
      .object({
        lat: z.coerce.number().min(-90).max(90).optional(),
        lng: z.coerce.number().min(-180).max(180).optional(),
        radiusMeters: z.coerce.number().min(200).max(250_000).optional(),
        bbox: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      })
      .parse(req.query);

    let parsedBbox: BoundingBox | undefined;
    if (query.bbox) {
      const nums = query.bbox.split(',').map(Number);
      if (nums.length === 4 && nums.every(Number.isFinite)) {
        parsedBbox = [nums[0]!, nums[1]!, nums[2]!, nums[3]!];
      }
    }

    const incidents = await incidentService.listNearbyIncidents({
      lat: query.lat,
      lng: query.lng,
      radiusMeters: query.radiusMeters,
      bbox: parsedBbox,
      limit: query.limit,
    });
    return { count: incidents.length, incidents };
  });

  app.post(
    '/api/v1/incidents',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const input = IncidentCreateSchema.parse(req.body);
      const { actor } = await authService.resolveActor(req);
      const { incident, mergedDuplicate } = await incidentService.createOrConfirmIncident(
        input,
        actor.ownerKey,
        actor.displayName,
      );

      const room = regionCellKey(incident.coordinates.lat, incident.coordinates.lng);
      io.to(room).emit(mergedDuplicate ? 'incident:updated' : 'incident:created', incident);

      return reply.status(mergedDuplicate ? 200 : 201).send({
        incident,
        mergedDuplicate,
      });
    },
  );

  app.post('/api/v1/incidents/:id/vote', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { vote } = IncidentVoteSchema.parse(req.body);
    const { actor } = await authService.resolveActor(req);
    const incident = await incidentService.voteOnIncident(id, actor.ownerKey, vote);

    const room = regionCellKey(incident.coordinates.lat, incident.coordinates.lng);
    io.to(room).emit('incident:updated', incident);

    return { incident };
  });

  // --- Authentication & Account Privacy ---
  app.get('/api/v1/auth/me', async (req) => {
    const { actor, profile } = await authService.resolveActor(req);
    const preferences = await placesService.getPreferences(actor);
    return {
      authenticated: actor.isAuthenticated,
      user: profile,
      preferences,
    };
  });

  app.post(
    '/api/v1/auth/register',
    { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = RegisterSchema.parse(req.body);
      const { user, sessionToken } = await authService.register(body);
      reply.setCookie('hexa_session', sessionToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: appEnv.SESSION_TTL_DAYS * 86400,
      });
      return reply.status(201).send({ user, token: sessionToken });
    },
  );

  app.post(
    '/api/v1/auth/login',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = LoginSchema.parse(req.body);
      const { user, sessionToken } = await authService.login(body);
      reply.setCookie('hexa_session', sessionToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: appEnv.SESSION_TTL_DAYS * 86400,
      });
      return { user, token: sessionToken };
    },
  );

  app.post('/api/v1/auth/logout', async (req, reply) => {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : undefined;
    await authService.logout(bearer || req.cookies?.hexa_session);
    reply.clearCookie('hexa_session', { path: '/' });
    return { status: 'logged_out' };
  });

  app.post('/api/v1/auth/password-reset/request', async (req) => {
    const { email } = PasswordResetRequestSchema.parse(req.body);
    const res = await authService.requestPasswordReset(email);
    return { status: 'accepted', ...res };
  });

  app.post('/api/v1/auth/password-reset/confirm', async (req) => {
    const { token, newPassword } = PasswordResetConfirmSchema.parse(req.body);
    await authService.confirmPasswordReset(token, newPassword);
    return { status: 'password_updated' };
  });

  app.delete('/api/v1/auth/account', async (req, reply) => {
    const { actor } = await authService.resolveActor(req);
    if (!actor.isAuthenticated || !actor.userId) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Sign in required to delete an account.' },
      });
    }
    await authService.deleteAccount(actor.userId);
    reply.clearCookie('hexa_session', { path: '/' });
    return { status: 'account_deleted' };
  });

  // --- Saved Places, Search History, Preferences & Offline Region Metadata ---
  app.get('/api/v1/places/saved', async (req) => {
    const { actor } = await authService.resolveActor(req);
    const places = await placesService.listSavedPlaces(actor);
    return { places };
  });

  app.post('/api/v1/places/saved', async (req, reply) => {
    const input = SavedPlaceCreateSchema.parse(req.body);
    const { actor } = await authService.resolveActor(req);
    const place = await placesService.upsertSavedPlace(actor, input);
    return reply.status(201).send({ place });
  });

  app.delete('/api/v1/places/saved/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { actor } = await authService.resolveActor(req);
    const deleted = await placesService.deleteSavedPlace(actor, id);
    if (!deleted) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Saved place not found or not owned by caller.' },
      });
    }
    return { status: 'deleted', id };
  });

  app.get('/api/v1/history/searches', async (req) => {
    const { actor } = await authService.resolveActor(req);
    const items = await placesService.listSearchHistory(actor);
    return { items };
  });

  app.delete('/api/v1/history/searches', async (req) => {
    const { actor } = await authService.resolveActor(req);
    const cleared = await placesService.clearSearchHistory(actor);
    return { status: 'cleared', deletedCount: cleared };
  });

  app.get('/api/v1/preferences', async (req) => {
    const { actor } = await authService.resolveActor(req);
    const preferences = await placesService.getPreferences(actor);
    return { preferences };
  });

  app.put('/api/v1/preferences', async (req) => {
    const body = UserPreferencesSchema.partial().parse(req.body);
    const { actor } = await authService.resolveActor(req);
    const preferences = await placesService.updatePreferences(actor, body);
    return { preferences };
  });

  app.get('/api/v1/offline/regions', async (req) => {
    const { actor } = await authService.resolveActor(req);
    const regions = await placesService.listOfflineRegions(actor);
    return { regions };
  });

  app.post('/api/v1/offline/regions', async (req, reply) => {
    const input = OfflineRegionCreateSchema.parse(req.body);
    const { actor } = await authService.resolveActor(req);
    const region = await placesService.saveOfflineRegion(actor, input);
    return reply.status(201).send({ region });
  });

  app.delete('/api/v1/offline/regions/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { actor } = await authService.resolveActor(req);
    const ok = await placesService.deleteOfflineRegion(actor, id);
    if (!ok) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Offline region not found.' },
      });
    }
    return { status: 'deleted', id };
  });

  // --- Street-Level Imagery (Mapillary) ---
  app.get('/api/v1/imagery/nearby', async (req) => {
    const coords = ReverseGeocodeQuerySchema.parse(req.query);
    return imageryService.lookupNearbyImagery(coords);
  });

  const close = async () => {
    io.close();
    await app.close();
    await dbCtx.close();
  };

  return { app, io, dbCtx, close };
}
