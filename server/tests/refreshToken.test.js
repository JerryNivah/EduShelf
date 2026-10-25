import test from "node:test";
import assert from "node:assert/strict";

import {
  generateRefreshToken,
  hashRefreshToken,
  generateRefreshTokenPair,
} from "../utils/refreshToken.js";

// TEST 1: Token generation
test("generates a valid opaque refresh token", () => {
  const token = generateRefreshToken();

  assert.equal(typeof token, "string");
  assert.equal(token.length, 43);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
});

// TEST 2: Token uniqueness
test("generates unique refresh tokens", () => {
  const first = generateRefreshToken();
  const second = generateRefreshToken();

  assert.notEqual(first, second);
});

// TEST 3: Hashing is deterministic
test("hashes refresh tokens consistently", () => {
  const token = generateRefreshToken();

  const firstHash = hashRefreshToken(token);
  const secondHash = hashRefreshToken(token);

  assert.equal(firstHash, secondHash);
  assert.equal(firstHash.length, 64);
  assert.match(firstHash, /^[a-f0-9]{64}$/);
});

// TEST 4: Pair generation
test("generates matching token and hash", () => {
  const { token, tokenHash } = generateRefreshTokenPair();

  assert.equal(hashRefreshToken(token), tokenHash);
  assert.notEqual(token, tokenHash);
});

// TEST 5: Invalid input
test("rejects malformed refresh tokens", () => {
  for (const token of [
    null,
    undefined,
    "",
    "invalid-token",
    12345,
    {},
  ]) {
    assert.throws(
      () => hashRefreshToken(token),
      {
        name: "TypeError",
        message: "Invalid refresh token",
      }
    );
  }
});