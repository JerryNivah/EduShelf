import test from "node:test";
import assert from "node:assert/strict";

import {
  createResendVerificationHandler,
} from "../../api/auth/resend-verification.js";

import {
  createVerifyEmailHandler,
} from "../../api/auth/verify-email.js";

import { AppError } from "../utils/AppError.js";

const trusted = () => {};

function response() {
  return {
    statusCode: null,
    body: null,
    headers: {},

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

test("resend accepts and normalizes email", async () => {
  let received;

  const handler = createResendVerificationHandler(
    async ({ email }) => {
      received = email;
      return { accepted: true };
    },
    trusted
  );

  const res = response();

  await handler({
    method: "POST",
    body: { email: " TEST@EXAMPLE.COM " },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(received, "test@example.com");
});

test("resend rejects invalid email", async () => {
  const handler = createResendVerificationHandler(
    async () => {
      throw new Error("Must not send");
    },
    trusted
  );

  const res = response();

  await handler({
    method: "POST",
    body: { email: "invalid" },
  }, res);

  assert.equal(res.statusCode, 400);
});

test("resend rejects non-POST requests", async () => {
  const handler = createResendVerificationHandler(
    async () => {
      throw new Error("Must not send");
    },
    trusted
  );

  const res = response();

  await handler({
    method: "GET",
    body: {},
  }, res);

  assert.equal(res.statusCode, 405);
});

test("resend rejects untrusted origins", async () => {
  let called = false;

  const handler = createResendVerificationHandler(
    async () => {
      called = true;
    },
    () => {
      throw new AppError("Origin not allowed", 403);
    }
  );

  const res = response();

  await handler({
    method: "POST",
    body: { email: "test@example.com" },
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
});

test("verifies a correct code", async () => {
  let received;

  const handler = createVerifyEmailHandler(
    async (input) => {
      received = input;
      return true;
    },
    trusted
  );

  const res = response();

  await handler({
    method: "POST",
    body: {
      email: "TEST@EXAMPLE.COM",
      code: "123456",
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(received.email, "test@example.com");
  assert.equal(received.code, "123456");
});

test("rejects incorrect verification codes", async () => {
  const handler = createVerifyEmailHandler(
    async () => false,
    trusted
  );

  const res = response();

  await handler({
    method: "POST",
    body: {
      email: "test@example.com",
      code: "999999",
    },
  }, res);

  assert.equal(res.statusCode, 400);
});

test("rejects malformed verification codes", async () => {
  let called = false;

  const handler = createVerifyEmailHandler(
    async () => {
      called = true;
      return true;
    },
    trusted
  );

  const res = response();

  await handler({
    method: "POST",
    body: {
      email: "test@example.com",
      code: "123",
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
});