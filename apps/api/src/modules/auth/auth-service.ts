import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyRequest } from 'fastify';
import type { UserProfile } from '@hexa/shared';
import type { DatabaseContext } from '../../db/client.js';
import type { AppEnv } from '../../config/env.js';

const scryptAsync = promisify(crypto.scrypt);

export interface RequestActor {
  ownerKey: string;
  userId: string | null;
  displayName: string;
  isAuthenticated: boolean;
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export class AuthService {
  constructor(
    private readonly dbCtx: DatabaseContext,
    private readonly env: AppEnv,
  ) {}

  public async recordAudit(actorKey: string, action: string, metadata?: Record<string, unknown>) {
    await this.dbCtx.queryRaw(
      `INSERT INTO audit_logs (id, actor_key, action, metadata) VALUES ($1, $2, $3, $4)`,
      [`aud-${crypto.randomUUID()}`, actorKey, action, metadata ? JSON.stringify(metadata) : null],
    );
  }

  public async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ user: UserProfile; sessionToken: string }> {
    const emailNorm = input.email.trim().toLowerCase();
    const existing = await this.dbCtx.queryRaw<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [emailNorm],
    );
    if (existing.length > 0) {
      const err = new Error('An account with this email already exists.') as Error & {
        statusCode?: number;
      };
      err.statusCode = 409;
      throw err;
    }

    const userId = `usr-${crypto.randomUUID()}`;
    const pwHash = await hashPassword(input.password);
    const rows = await this.dbCtx.queryRaw<{
      id: string;
      email: string;
      display_name: string;
      created_at: string | Date;
    }>(
      `INSERT INTO users (id, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, created_at`,
      [userId, emailNorm, pwHash, input.displayName.trim()],
    );

    const sessionToken = await this.createSession(userId);
    await this.recordAudit(`user:${userId}`, 'auth.register', { email: emailNorm });

    const u = rows[0]!;
    return {
      user: {
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        createdAt: new Date(u.created_at).toISOString(),
      },
      sessionToken,
    };
  }

  public async login(input: {
    email: string;
    password: string;
  }): Promise<{ user: UserProfile; sessionToken: string }> {
    const emailNorm = input.email.trim().toLowerCase();
    const rows = await this.dbCtx.queryRaw<{
      id: string;
      email: string;
      password_hash: string;
      display_name: string;
      created_at: string | Date;
    }>(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [emailNorm]);

    const u = rows[0];
    if (!u || !(await verifyPassword(input.password, u.password_hash))) {
      const err = new Error('Invalid email or password.') as Error & { statusCode?: number };
      err.statusCode = 401;
      throw err;
    }

    const sessionToken = await this.createSession(u.id);
    await this.recordAudit(`user:${u.id}`, 'auth.login');

    return {
      user: {
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        createdAt: new Date(u.created_at).toISOString(),
      },
      sessionToken,
    };
  }

  private async createSession(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = new Date(
      Date.now() + this.env.SESSION_TTL_DAYS * 24 * 3600 * 1000,
    ).toISOString();

    await this.dbCtx.queryRaw(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [`ses-${crypto.randomUUID()}`, userId, tokenHash, expiresAt],
    );
    return rawToken;
  }

  public async logout(rawToken?: string): Promise<void> {
    if (!rawToken) return;
    await this.dbCtx.queryRaw(`DELETE FROM sessions WHERE token_hash = $1`, [sha256Hex(rawToken)]);
  }

  public async requestPasswordReset(email: string): Promise<{ resetTokenPreview?: string }> {
    const emailNorm = email.trim().toLowerCase();
    const rows = await this.dbCtx.queryRaw<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [emailNorm],
    );
    if (!rows[0]) {
      // Do not leak whether an email is registered
      return {};
    }
    const rawToken = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    await this.dbCtx.queryRaw(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [`rst-${crypto.randomUUID()}`, rows[0].id, sha256Hex(rawToken), expiresAt],
    );
    await this.recordAudit(`user:${rows[0].id}`, 'auth.password_reset_requested');
    return this.env.NODE_ENV !== 'production' ? { resetTokenPreview: rawToken } : {};
  }

  public async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = sha256Hex(rawToken);
    const rows = await this.dbCtx.queryRaw<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    if (!rows[0]) {
      const err = new Error('Invalid or expired password reset token.') as Error & {
        statusCode?: number;
      };
      err.statusCode = 400;
      throw err;
    }

    const newHash = await hashPassword(newPassword);
    await this.dbCtx.queryRaw(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [
      rows[0].user_id,
      newHash,
    ]);
    await this.dbCtx.queryRaw(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [
      rows[0].id,
    ]);
    await this.dbCtx.queryRaw(`DELETE FROM sessions WHERE user_id = $1`, [rows[0].user_id]);
    await this.recordAudit(`user:${rows[0].user_id}`, 'auth.password_reset_completed');
  }

  public async deleteAccount(userId: string): Promise<void> {
    const ownerKey = `user:${userId}`;
    await this.dbCtx.queryRaw(`DELETE FROM saved_places WHERE owner_key = $1`, [ownerKey]);
    await this.dbCtx.queryRaw(`DELETE FROM search_history WHERE owner_key = $1`, [ownerKey]);
    await this.dbCtx.queryRaw(`DELETE FROM route_history WHERE owner_key = $1`, [ownerKey]);
    await this.dbCtx.queryRaw(`DELETE FROM offline_regions WHERE owner_key = $1`, [ownerKey]);
    await this.dbCtx.queryRaw(`DELETE FROM user_preferences WHERE owner_key = $1`, [ownerKey]);
    await this.dbCtx.queryRaw(`DELETE FROM users WHERE id = $1`, [userId]);
    await this.recordAudit(ownerKey, 'auth.account_deleted');
  }

  public async resolveActor(req: FastifyRequest): Promise<{
    actor: RequestActor;
    profile: UserProfile | null;
  }> {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : undefined;
    const cookieToken = req.cookies?.hexa_session;
    const token = bearer || cookieToken;

    if (token) {
      const rows = await this.dbCtx.queryRaw<{
        id: string;
        email: string;
        display_name: string;
        created_at: string | Date;
      }>(
        `SELECT u.id, u.email, u.display_name, u.created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()
         LIMIT 1`,
        [sha256Hex(token)],
      );
      if (rows[0]) {
        const u = rows[0];
        return {
          actor: {
            ownerKey: `user:${u.id}`,
            userId: u.id,
            displayName: u.display_name,
            isAuthenticated: true,
          },
          profile: {
            id: u.id,
            email: u.email,
            displayName: u.display_name,
            createdAt: new Date(u.created_at).toISOString(),
          },
        };
      }
    }

    // Isolated guest workspace token
    const rawGuest =
      (typeof req.headers['x-hexa-guest-id'] === 'string' && req.headers['x-hexa-guest-id']) ||
      req.cookies?.hexa_guest ||
      'default-guest';
    const sanitizedGuest = rawGuest.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default-guest';

    return {
      actor: {
        ownerKey: `guest:${sanitizedGuest}`,
        userId: null,
        displayName: 'Community Explorer',
        isAuthenticated: false,
      },
      profile: null,
    };
  }
}
