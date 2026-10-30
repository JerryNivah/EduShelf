
import { createHmac } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

export function createAuthRateLimiter({
  db,
  secret,
  now = () => new Date(),
}) {
  if (!secret || secret.length < 32) {
    throw new Error("Invalid rate limiter secret");
  }

  function keyFor({ scope, identifier }) {
    if (
      typeof scope !== "string" ||
      !scope ||
      typeof identifier !== "string" ||
      !identifier
    ) {
      throw new TypeError("Invalid rate limit identity");
    }

    return createHmac("sha256", secret)
      .update(`${scope}\0${identifier}`)
      .digest("hex");
  }

  async function consume({
    scope,
    identifier,
    limit,
    windowMs,
  }) {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      !Number.isSafeInteger(windowMs) ||
      windowMs < 1
    ) {
      throw new TypeError("Invalid rate limit policy");
    }

    const key = keyFor({ scope, identifier });
    const current = now();

    const newExpiry = new Date(
      current.getTime() + windowMs
    );

    // One atomic PostgreSQL operation.
    // Concurrent requests cannot overwrite each other's counts.
    const rows = await db.$queryRaw`
      INSERT INTO "AuthRateLimit"
        ("key", "count", "expiresAt")
      VALUES
        (${key}, 1, ${newExpiry})
      ON CONFLICT ("key")
      DO UPDATE SET
        "count" = CASE
          WHEN "AuthRateLimit"."expiresAt" <= ${current}
            THEN 1
          ELSE "AuthRateLimit"."count" + 1
        END,
        "expiresAt" = CASE
          WHEN "AuthRateLimit"."expiresAt" <= ${current}
            THEN ${newExpiry}
          ELSE "AuthRateLimit"."expiresAt"
        END
      RETURNING "count", "expiresAt"
    `;

    const bucket = rows[0];

    if (!bucket) {
      throw new Error("Rate limit update failed");
    }

    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(
          (bucket.expiresAt.getTime() -
            current.getTime()) / 1000
        )
      ),
    };
  }

  return {
    consume,
    keyFor,
  };
}

export const authRateLimiter = createAuthRateLimiter({
  db: prisma,
  secret: env.RATE_LIMIT_SECRET,
});
