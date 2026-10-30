
import test from "node:test";
import assert from "node:assert/strict";

import {
  createAuthRateLimiter,
} from "../services/authRateLimiter.service.js";

const SECRET = "test-only-secret-".repeat(4);

test("allows requests up to the configured limit", async () => {
  let count = 0;

  const limiter = createAuthRateLimiter({
    secret: SECRET,
    now: () => new Date("2026-10-28T10:00:00Z"),

    db: {
      $queryRaw: async () => [{
        count: ++count,
        expiresAt: new Date("2026-10-28T10:01:00Z"),
      }],
    },
  });

  const request = {
    scope: "register",
    identifier: "127.0.0.1",
    limit: 2,
    windowMs: 60_000,
  };

  const first = await limiter.consume(request);
  const second = await limiter.consume(request);
  const third = await limiter.consume(request);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
  assert.equal(third.retryAfterSeconds, 60);
});

test("hashes identifiers before storing them", () => {
  const limiter = createAuthRateLimiter({
    secret: SECRET,
    db: {},
  });

  const key = limiter.keyFor({
    scope: "verification",
    identifier: "customer@example.com",
  });

  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(
    key.includes("customer@example.com"),
    false
  );
});

test("different scopes have different buckets", () => {
  const limiter = createAuthRateLimiter({
    secret: SECRET,
    db: {},
  });

  const registerKey = limiter.keyFor({
    scope: "register",
    identifier: "127.0.0.1",
  });

  const loginKey = limiter.keyFor({
    scope: "login",
    identifier: "127.0.0.1",
  });

  assert.notEqual(registerKey, loginKey);
});

test("rejects invalid policies", async () => {
  const limiter = createAuthRateLimiter({
    secret: SECRET,
    db: {},
  });

  await assert.rejects(
    limiter.consume({
      scope: "register",
      identifier: "127.0.0.1",
      limit: 0,
      windowMs: 60_000,
    }),
    TypeError
  );
});
