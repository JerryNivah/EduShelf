import test from "node:test";
import assert from "node:assert/strict";

import {
  createConfiguredOriginGuard,
} from "../config/trustedOriginGuard.js";

test("accepts a configured local origin", () => {
  const guard = createConfiguredOriginGuard({
    AUTH_ALLOWED_ORIGINS: "http://localhost:3000",
  });

  assert.doesNotThrow(() => {
    guard({
      headers: {
        origin: "http://localhost:3000",
      },
    });
  });
});

test("rejects an unconfigured local origin", () => {
  const guard = createConfiguredOriginGuard({
    AUTH_ALLOWED_ORIGINS: "http://localhost:3000",
  });

  assert.throws(
    () => guard({
      headers: {
        origin: "http://localhost:5173",
      },
    }),
    (error) => error.statusCode === 403
  );
});

test("trusts the current Vercel Preview URL", () => {
  const guard = createConfiguredOriginGuard({
    VERCEL_ENV: "preview",
    VERCEL_URL: "edushelf-test.vercel.app",
  });

  assert.doesNotThrow(() => {
    guard({
      headers: {
        origin: "https://edushelf-test.vercel.app",
      },
    });
  });
});

test("rejects malformed Vercel Preview hostnames", () => {
  assert.throws(
    () => createConfiguredOriginGuard({
      VERCEL_ENV: "preview",
      VERCEL_URL: "edushelf.vercel.app.attacker.com",
    }),
    TypeError
  );
});

test("rejects missing origin configuration", () => {
  assert.throws(
    () => createConfiguredOriginGuard({}),
    TypeError
  );
});

test("rejects invalid configured origins", () => {
  assert.throws(
    () => createConfiguredOriginGuard({
      AUTH_ALLOWED_ORIGINS:
        "https://edushelf.example/unauthorized-path",
    }),
    TypeError
  );
});