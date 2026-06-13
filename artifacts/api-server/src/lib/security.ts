import type { NextFunction, Request, Response } from "express";

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, "");
}

export function getAllowedOrigins(): Set<string> {
  const values = [
    process.env.PUBLIC_APP_URL,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGINS,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map(normalizeOrigin)
    .filter(Boolean);

  if (process.env.NODE_ENV !== "production") {
    values.push(
      "http://localhost:24545",
      "http://127.0.0.1:24545",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
    );
  }

  return new Set(values);
}

function getRequestOrigin(req: Request): string | null {
  const originHeader = req.headers.origin;
  if (typeof originHeader === "string" && originHeader.trim()) {
    return normalizeOrigin(originHeader);
  }

  const refererHeader = req.headers.referer;
  if (typeof refererHeader === "string" && refererHeader.trim()) {
    try {
      return normalizeOrigin(new URL(refererHeader.trim()).origin);
    } catch {
      return null;
    }
  }

  return null;
}

export function hasTrustedRequestOrigin(req: Request): boolean {
  const origin = getRequestOrigin(req);
  if (!origin) {
    return true;
  }

  return getAllowedOrigins().has(origin);
}

export function requireTrustedRequestOrigin(req: Request, res: Response): boolean {
  if (hasTrustedRequestOrigin(req)) {
    return true;
  }

  res.status(403).json({ error: "Forbidden origin" });
  return false;
}

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
};

type RateBucket = {
  hits: number[];
};

const rateLimitBuckets = new Map<string, RateBucket>();

function getRequestIp(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "unknown";
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

export function createRateLimiter(options: RateLimitOptions) {
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = options.keyGenerator?.(req) ?? getRequestIp(req);
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key) ?? { hits: [] };
    const cutoff = now - options.windowMs;

    bucket.hits = bucket.hits.filter((timestamp) => timestamp >= cutoff);
    if (bucket.hits.length >= options.max) {
      const oldest = bucket.hits[0] ?? now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldest + options.windowMs - now) / 1000),
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ error: options.message });
      return;
    }

    bucket.hits.push(now);
    rateLimitBuckets.set(key, bucket);
    next();
  };
}
