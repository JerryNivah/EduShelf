
import { isIP } from "node:net";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

import {
  authRateLimiter,
} from "../services/authRateLimiter.service.js";

// Only trust forwarding headers when the request is
// received through Vercel's proxy infrastructure.
export function getTrustedClientIp(
  req,
  {
    onVercel =
      process.env.VERCEL === "1" ||
      ["production", "preview"].includes(
        process.env.VERCEL_ENV
      ),
  } = {}
) {
  const rawIp = onVercel
    ? (
        req.headers?.["x-vercel-forwarded-for"] ??
        req.headers?.["x-forwarded-for"]
      )
    : req.socket?.remoteAddress;

  if (typeof rawIp !== "string") {
    return null;
  }

  const ip = rawIp.split(",")[0].trim();

  return isIP(ip) ? ip : null;
}

export function createAuthRateLimitGuard({
  scope,
  limit,
  windowMs,
  limiter = authRateLimiter,
  getClientIp = getTrustedClientIp,
}) {
  return async function enforceRateLimit(req, res) {
    const clientIp = getClientIp(req);

    // Do not bypass limits when identity is unavailable.
    if (!clientIp) {
      throw new AppError(
        "Unable to determine client address",
        503
      );
    }

    // Database errors propagate: fail closed rather than
    // allowing unlimited requests.
    const result = await limiter.consume({
      scope,
      identifier: clientIp,
      limit,
      windowMs,
    });

    if (!result.allowed) {
      res.setHeader(
        "Retry-After",
        String(result.retryAfterSeconds)
      );

      throw new AppError(
        "Too many requests. Try again later.",
        429
      );
    }
  };
}
