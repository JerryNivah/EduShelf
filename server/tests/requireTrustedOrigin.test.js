import test from "node:test";
import assert from "node:assert/strict";

import {
  createOriginGuard,
} from "../middleware/requireTrustedOrigin.js";

const guard = createOriginGuard([
  "http://localhost:3000",
  "https://edushelf.example",
]);

function request(headers) {
  return { headers };
}

function expectForbidden(headers) {
  assert.throws(
    () => guard(request(headers)),
    (error) => error.statusCode === 403
  );
}

test("accepts an explicitly trusted Origin", () => {
  assert.doesNotThrow(() =>
    guard(request({
      origin: "https://edushelf.example",
    }))
  );
});

test("accepts a trusted Referer when Origin is absent", () => {
  assert.doesNotThrow(() =>
    guard(request({
      referer: "https://edushelf.example/login",
    }))
  );
});

test("rejects an untrusted Origin", () => {
  expectForbidden({
    origin: "https://attacker.example",
  });
});

test("rejects lookalike domains", () => {
  expectForbidden({
    origin: "https://edushelf.example.attacker.com",
  });
});

test("rejects missing or null Origin", () => {
  expectForbidden({});
  expectForbidden({ origin: "null" });
});

test("does not trust Referer over a hostile Origin", () => {
  expectForbidden({
    origin: "https://attacker.example",
    referer: "https://edushelf.example/login",
  });
});

test("rejects empty trusted-origin configuration", () => {
  assert.throws(
    () => createOriginGuard([]),
    TypeError
  );
});