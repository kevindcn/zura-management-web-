import { Request, Response, NextFunction } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message = "Terlalu banyak permintaan. Silakan coba lagi beberapa saat lagi." } = options;
  const ipRequests = new Map<string, number[]>();

  // Periodically clean up entries older than windowMs
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipRequests.entries()) {
      const validTimestamps = timestamps.filter((time) => now - time < windowMs);
      if (validTimestamps.length === 0) {
        ipRequests.delete(ip);
      } else {
        ipRequests.set(ip, validTimestamps);
      }
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, allow bypassing rate limits if desired, but still testable
    if (process.env.NODE_ENV === "test" && req.headers["x-test-bypass-rate-limit"]) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const now = Date.now();

    const timestamps = ipRequests.get(ip) || [];
    const validTimestamps = timestamps.filter((time) => now - time < windowMs);

    if (validTimestamps.length >= max) {
      const oldestTime = validTimestamps[0];
      const retryAfterSec = Math.ceil((oldestTime + windowMs - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSec, 1)));
      res.status(429).json({ message });
      return;
    }

    validTimestamps.push(now);
    ipRequests.set(ip, validTimestamps);
    next();
  };
}

// 10 requests per minute for sensitive auth endpoints (login, register, demo)
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: "Terlalu banyak percobaan autentikasi. Silakan tunggu 1 menit sebelum mencoba lagi.",
});

// 30 requests per minute for sensitive member and role actions
export const memberActionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Terlalu banyak permintaan perubahan anggota. Silakan tunggu 1 menit sebelum mencoba lagi.",
});

const mutatingMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// 120 requests per minute for data mutation methods (POST, PATCH, PUT, DELETE)
const baseApiMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: "Terlalu banyak permintaan perubahan data. Silakan tunggu 1 menit sebelum mencoba lagi.",
});

export const apiMutationRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  if (!mutatingMethods.has(req.method)) {
    return next();
  }
  // In test environment, bypass rate limits to avoid failing existing test suites unless explicitly requested
  if (process.env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"]) {
    return next();
  }
  return baseApiMutationLimiter(req, res, next);
};

