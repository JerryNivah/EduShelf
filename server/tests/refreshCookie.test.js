import test from "node:test";
import assert from "node:assert/strict";

import {
  serializeRefreshCookie,
  serializeClearRefreshCookie,
  parseRefreshCookie,
} from "../utils/refreshCookie.js";

const nowMs = Date.UTC(2026, 9, 22);
const refreshToken = "A".repeat(43);

const expiresAt = new Date(
  nowMs + 7 * 24 * 60 * 60 * 1000
);

// TEST 1
test("serializes a secure refresh cookie", () => {
  const cookie = serializeRefreshCookie({
    refreshToken,
    expiresAt,
    secure: true,
    nowMs,
  });

  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
  assert.ok(cookie.includes("SameSite=Lax"));
  assert.ok(cookie.includes("Path=/api/auth"));
  assert.ok(cookie.includes("Max-Age=604800"));

  assert.ok(
    cookie.startsWith(`edushelf_refresh=${refreshToken}`)
  );

  assert.ok(!cookie.includes("Domain="));
});

// TEST 2
test("supports local HTTP development", () => {
  const cookie = serializeRefreshCookie({
    refreshToken,
    expiresAt,
    secure: false,
    nowMs,
  });

  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(!cookie.includes("; Secure"));
});

// TEST 3
test("rejects expired refresh cookies", () => {
  assert.throws(
    () => serializeRefreshCookie({
      refreshToken,
      expiresAt: new Date(nowMs - 1000),
      secure: true,
      nowMs,
    }),
    RangeError
  );
});

// TEST 4
test("clears the refresh cookie using matching scope", () => {
  const cookie = serializeClearRefreshCookie({
    secure: true,
  });

  assert.ok(cookie.includes("edushelf_refresh="));
  assert.ok(cookie.includes("Path=/api/auth"));
  assert.ok(cookie.includes("Max-Age=0"));
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
});
test("extracts refresh token among other cookies", () => {
  const token = "A".repeat(43);

  const cookieHeader =
    `theme=dark; edushelf_refresh=${token}; cartId=456`;

  const result = parseRefreshCookie(cookieHeader);

  assert.equal(result, token);
});

test("returns null when refresh cookie is missing", () => {
  assert.equal(parseRefreshCookie("theme=dark"), null);
  assert.equal(parseRefreshCookie(undefined), null);
  assert.equal(parseRefreshCookie(""), null);
});

test("rejects malformed refresh cookies", () => {
  assert.equal(
    parseRefreshCookie("edushelf_refresh=invalid"),
    null
  );

  assert.equal(
    parseRefreshCookie("edushelf_refresh="),
    null
  );
});

test("rejects duplicate refresh cookies", () => {
  const first = "A".repeat(43);
  const second = "B".repeat(43);

  const cookieHeader =
    `edushelf_refresh=${first}; edushelf_refresh=${second}`;

  assert.equal(parseRefreshCookie(cookieHeader), null);
});