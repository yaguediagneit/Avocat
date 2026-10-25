import { NextRequest, NextResponse } from "next/server";
import { createClient, type RedisClientType } from "redis";

/**
 * Limiteur de débit (fenêtre glissante) pour les routes sensibles
 * (authentification, MFA).
 *
 * - Si `REDIS_URL` est défini, le store est partagé entre instances (sorted sets Redis).
 * - Sinon, ou si Redis est injoignable, repli automatique sur un store mémoire local.
 */

export interface RateLimitOptions {
  /** Nombre maximal de tentatives dans la fenêtre. */
  limit: number;
  /** Durée de la fenêtre en millisecondes. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Secondes avant qu'une nouvelle tentative soit acceptée. */
  retryAfter: number;
}

interface RateLimitStore {
  hit(key: string, opts: RateLimitOptions): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

/* ---------------------------------------------------------------- Mémoire */

class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, number[]>();
  private lastSweep = Date.now();
  private static MAX_BUCKETS = 50_000;

  private sweep(now: number, windowMs: number) {
    if (now - this.lastSweep < 60_000 && this.buckets.size < MemoryStore.MAX_BUCKETS) return;
    this.lastSweep = now;
    for (const [key, hits] of this.buckets) {
      const kept = hits.filter((t) => now - t < windowMs);
      if (kept.length === 0) this.buckets.delete(key);
      else this.buckets.set(key, kept);
    }
  }

  async hit(key: string, { limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> {
    const now = Date.now();
    this.sweep(now, windowMs);
    const hits = (this.buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      this.buckets.set(key, hits);
      return { ok: false, remaining: 0, retryAfter: Math.ceil((hits[0] + windowMs - now) / 1000) };
    }
    hits.push(now);
    this.buckets.set(key, hits);
    return { ok: true, remaining: limit - hits.length, retryAfter: 0 };
  }

  async reset(key: string) {
    this.buckets.delete(key);
  }
}

/* ------------------------------------------------------------------ Redis */

class RedisStore implements RateLimitStore {
  private client: RedisClientType;
  private ready: Promise<void>;
  private prefix = "ratelimit:";

  constructor(url: string) {
    this.client = createClient({
      url,
      socket: { reconnectStrategy: (retries) => Math.min(retries * 200, 5_000) },
    });
    this.client.on("error", (err) => console.error("[rate-limit] Redis error", err));
    this.ready = this.client.connect().then(() => undefined);
  }

  async hit(key: string, { limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> {
    await this.ready;
    const k = this.prefix + key;
    const now = Date.now();

    await this.client.zRemRangeByScore(k, 0, now - windowMs);
    const count = await this.client.zCard(k);

    if (count >= limit) {
      const oldest = await this.client.zRangeWithScores(k, 0, 0);
      const oldestTs = oldest[0]?.score ?? now;
      return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((oldestTs + windowMs - now) / 1000)) };
    }

    await this.client
      .multi()
      .zAdd(k, { score: now, value: `${now}-${Math.random().toString(36).slice(2)}` })
      .pExpire(k, windowMs)
      .exec();

    return { ok: true, remaining: limit - count - 1, retryAfter: 0 };
  }

  async reset(key: string) {
    await this.ready;
    await this.client.del(this.prefix + key);
  }
}

/* -------------------------------------------------------------- Sélection */

const globalForRateLimit = globalThis as unknown as {
  rateLimitStore?: RateLimitStore;
  rateLimitMemoryFallback?: MemoryStore;
};

function getStore(): RateLimitStore {
  if (globalForRateLimit.rateLimitStore) return globalForRateLimit.rateLimitStore;
  const url = process.env.REDIS_URL;
  globalForRateLimit.rateLimitStore = url ? new RedisStore(url) : new MemoryStore();
  return globalForRateLimit.rateLimitStore;
}

function getFallback(): MemoryStore {
  return (globalForRateLimit.rateLimitMemoryFallback ??= new MemoryStore());
}

export async function rateLimit(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  try {
    return await getStore().hit(key, opts);
  } catch (err) {
    console.error("[rate-limit] store indisponible, repli mémoire", err);
    return getFallback().hit(key, opts);
  }
}

/** Réinitialise le compteur (ex. après une authentification réussie). */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await getStore().reset(key);
  } catch (err) {
    console.error("[rate-limit] reset impossible", err);
  }
  await getFallback().reset(key);
}

/* --------------------------------------------------------------- Helpers */

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || req.ip || "unknown";
}

export function tooManyRequests(result: RateLimitResult, message = "Trop de tentatives. Veuillez réessayer plus tard.") {
  return NextResponse.json(
    { error: message, retryAfter: result.retryAfter },
    { status: 429, headers: { "Retry-After": String(result.retryAfter) } }
  );
}

export function authRateLimitKeys(req: NextRequest, scope: string, identifier?: string) {
  const keys = [`${scope}:ip:${clientIp(req)}`];
  if (identifier) keys.push(`${scope}:id:${identifier.toLowerCase()}`);
  return keys;
}

/**
 * Applique une limite par IP et, si fourni, par identifiant (email) pour une
 * route donnée. Retourne `null` si autorisé, sinon une réponse 429.
 */
export async function enforceAuthRateLimit(
  req: NextRequest,
  scope: string,
  identifier?: string,
  opts: { perIp?: RateLimitOptions; perIdentifier?: RateLimitOptions } = {}
): Promise<NextResponse | null> {
  const perIp = opts.perIp ?? { limit: 30, windowMs: 15 * 60 * 1000 };
  const perIdentifier = opts.perIdentifier ?? { limit: 10, windowMs: 15 * 60 * 1000 };

  const [ipKey, idKey] = authRateLimitKeys(req, scope, identifier);
  const ipResult = await rateLimit(ipKey, perIp);
  if (!ipResult.ok) return tooManyRequests(ipResult);

  if (idKey) {
    const idResult = await rateLimit(idKey, perIdentifier);
    if (!idResult.ok) return tooManyRequests(idResult);
  }

  return null;
}

/** Réinitialise les compteurs IP + identifiant d'une route (après succès). */
export async function resetAuthRateLimit(req: NextRequest, scope: string, identifier?: string) {
  await Promise.all(authRateLimitKeys(req, scope, identifier).map(resetRateLimit));
}
