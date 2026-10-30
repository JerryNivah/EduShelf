import test from "node:test";
import assert from "node:assert/strict";

import {
  getTrustedClientIp,
} from "../middleware/authRateLimit.js";

test("uses Vercel's forwarded client IP", () => {
  const ip = getTrustedClientIp({
    headers: {
      "x-vercel-forwarded-for": "203.0.113.10",
    },
    socket: {
      remoteAddress: "10.0.0.1",
    },
  }, { onVercel: true });

  assert.equal(ip, "203.0.113.10");
});

test("ignores spoofed forwarded headers locally", () => {
  const ip = getTrustedClientIp({
    headers: {
      "x-forwarded-for": "203.0.113.99",
    },
    socket: {
      remoteAddress: "127.0.0.1",
    },
  }, { onVercel: false });

  assert.equal(ip, "127.0.0.1");
});

test("rejects missing or invalid client addresses", () => {
  assert.equal(
    getTrustedClientIp(
      { headers: {} },
      { onVercel: true }
    ),
    null
  );

  assert.equal(
    getTrustedClientIp(
      {
        headers: {
          "x-vercel-forwarded-for": "invalid-ip",
        },
      },
      { onVercel: true }
    ),
    null
  );
});