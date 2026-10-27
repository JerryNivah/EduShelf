import test from "node:test";
import assert from "node:assert/strict";

import {
  generateEmailOtp,
  hashEmailOtp,
  verifyEmailOtpHash,
} from "../utils/emailOtp.js";

const secret = "a".repeat(64);

test("generates six-digit verification codes", () => {
  for (let i = 0; i < 100; i++) {
    assert.match(generateEmailOtp(), /^\d{6}$/);
  }
});

test("stores a hash instead of plaintext OTP", () => {
  const hash = hashEmailOtp(secret, 7, "123456");

  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, "123456");
});

test("verifies the correct OTP for its user", () => {
  const hash = hashEmailOtp(secret, 7, "123456");

  assert.equal(
    verifyEmailOtpHash(secret, 7, "123456", hash),
    true
  );
});

test("rejects incorrect codes and different users", () => {
  const hash = hashEmailOtp(secret, 7, "123456");

  assert.equal(
    verifyEmailOtpHash(secret, 7, "654321", hash),
    false
  );

  assert.equal(
    verifyEmailOtpHash(secret, 8, "123456", hash),
    false
  );
});

test("rejects malformed OTP values", () => {
  const hash = hashEmailOtp(secret, 7, "123456");

  assert.equal(
    verifyEmailOtpHash(secret, 7, "123", hash),
    false
  );

  assert.equal(
    verifyEmailOtpHash(secret, 7, "abcdef", hash),
    false
  );
});