
import test from "node:test";
import assert from "node:assert/strict";

import {
  createAuthRateLimitGuard,
} from "../middleware/authRateLimit.js";

import {
  createRegisterHandler,
} from "../../api/auth/register.js";

import {
  createLoginHandler,
} from "../../api/auth/login.js";

import {
  createResendVerificationHandler,
} from "../../api/auth/resend-verification.js";

import {
  createVerifyEmailHandler,
} from "../../api/auth/verify-email.js";

const trusted = () => {};

function response() {
  return {
    statusCode: null,
    headers: {},
    body: null,

    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    },
  };
}

const routes = [
  {
    name: "registration",
    body: {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "SecurePass123!",
    },
    create: (guard, executed) =>
      createRegisterHandler(
        async (_req, res) => {
          executed();
          return res.status(200).json({ success: true });
        },
        trusted,
        guard
      ),
  },
  {
    name: "login",
    body: {
      email: "john@example.com",
      password: "SecurePass123!",
    },
    create: (guard, executed) =>
      createLoginHandler(
        async (_req, res) => {
          executed();
          return res.status(200).json({ success: true });
        },
        trusted,
        guard
      ),
  },
  {
    name: "resend verification",
    body: { email: "john@example.com" },
    create: (guard, executed) =>
      createResendVerificationHandler(
        async () => {
          executed();
        },
        trusted,
        guard
      ),
  },
  {
    name: "verify email",
    body: {
      email: "john@example.com",
      code: "123456",
    },
    create: (guard, executed) =>
      createVerifyEmailHandler(
        async () => {
          executed();
          return true;
        },
        trusted,
        guard
      ),
  },
];

for (const route of routes) {
  test(`${route.name} returns 429 after its limit`, async () => {
    let attempts = 0;
    let controllerCalls = 0;

    const guard = createAuthRateLimitGuard({
      scope: `test-${route.name}`,
      limit: 2,
      windowMs: 60_000,
      getClientIp: () => "203.0.113.10",

      limiter: {
        consume: async () => {
          attempts++;

          return {
            allowed: attempts <= 2,
            retryAfterSeconds: 60,
          };
        },
      },
    });

    const handler = route.create(
      guard,
      () => { controllerCalls++; }
    );

    const statuses = [];

    for (let i = 0; i < 3; i++) {
      const res = response();

      await handler({
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
        },
        body: route.body,
      }, res);

      statuses.push(res.statusCode);

      if (i === 2) {
        assert.equal(res.body.success, false);
        assert.equal(res.headers["retry-after"], "60");
      }
    }

    assert.deepEqual(statuses, [200, 200, 429]);

    // The third request must never reach business logic.
    assert.equal(controllerCalls, 2);
  });
}

test("missing client IP fails closed", async () => {
  const guard = createAuthRateLimitGuard({
    scope: "test-missing-ip",
    limit: 5,
    windowMs: 60_000,
    getClientIp: () => null,
    limiter: {
      consume: async () => {
        throw new Error("Limiter must not run");
      },
    },
  });

  const handler = createRegisterHandler(
    async () => {
      throw new Error("Controller must not run");
    },
    trusted,
    guard
  );

  const res = response();

  await handler({
    method: "POST",
    body: {},
  }, res);

  assert.equal(res.statusCode, 503);
});

test("database rate limiter failure blocks the request", async () => {
  const guard = createAuthRateLimitGuard({
    scope: "test-db-failure",
    limit: 5,
    windowMs: 60_000,
    getClientIp: () => "203.0.113.10",
    limiter: {
      consume: async () => {
        throw new Error("Database unavailable");
      },
    },
  });

  const handler = createRegisterHandler(
    async () => {
      throw new Error("Controller must not run");
    },
    trusted,
    guard
  );

  const res = response();

  await handler({
    method: "POST",
    body: {},
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
});
