
import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";

import {
  createAuthRateLimiter,
} from "../services/authRateLimiter.service.js";

const limiter = createAuthRateLimiter({
  db: prisma,
  secret: "test-only-rate-limit-secret-".repeat(3),
});

const identifier = `integration-${randomUUID()}`;
const scope = "integration-test";
const limit = 4;
const totalRequests = 12;
const windowMs = 60_000;

const key = limiter.keyFor({
  scope,
  identifier,
});

async function main() {
  try {
    // 1. Simulate simultaneous requests.
    const results = await Promise.all(
      Array.from({ length: totalRequests }, () =>
        limiter.consume({
          scope,
          identifier,
          limit,
          windowMs,
        })
      )
    );

    const allowed = results.filter(
      (result) => result.allowed
    );

    const blocked = results.filter(
      (result) => !result.allowed
    );

    assert.equal(allowed.length, limit);

    assert.equal(
      blocked.length,
      totalRequests - limit
    );

    console.log("Concurrent request limits: PASSED");

    // 2. Verify the database count.
    const bucket = await prisma.authRateLimit.findUnique({
      where: { key },
    });

    assert.ok(bucket);
    assert.equal(bucket.count, totalRequests);

    console.log("Atomic database counter: PASSED");

    // 3. Simulate an expired rate-limit window.
    await prisma.authRateLimit.update({
      where: { key },
      data: {
        count: totalRequests,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const afterExpiry = await limiter.consume({
      scope,
      identifier,
      limit,
      windowMs,
    });

    assert.equal(afterExpiry.allowed, true);
    assert.equal(afterExpiry.remaining, limit - 1);

    const resetBucket =
      await prisma.authRateLimit.findUnique({
        where: { key },
      });

    assert.equal(resetBucket.count, 1);
    assert.ok(resetBucket.expiresAt > new Date());

    console.log("Expired window reset: PASSED");

  } finally {
    // Delete only the bucket created by this test.
    await prisma.authRateLimit.deleteMany({
      where: { key },
    });

    await prisma.$disconnect();

    console.log("Test cleanup: COMPLETE");
  }
}

main().catch((error) => {
  console.error(
    "Rate-limiter integration failed:",
    error
  );

  process.exitCode = 1;
});
