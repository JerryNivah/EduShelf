import test from "node:test";
import assert from "node:assert/strict";

import {
  createSessionLoginController,
} from "../controllers/auth.controller.js";

function createMockResponse() {
  const headers = {};

  return {
    headers,
    statusCode: null,
    body: null,

    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
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

test("successful login sets an HttpOnly refresh cookie", async () => {
  const refreshToken = "A".repeat(43);

  const user = {
    id: 7,
    firstName: "Test",
    role: "CUSTOMER",
  };

  const controller = createSessionLoginController(
    async () => ({
      user,
      accessToken: "test-access-token",
      refreshToken,
      refreshExpiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ),
    }),
    { secureCookies: true }
  );

  const req = {
    body: {
      email: "test@example.com",
      password: "Password123!",
    },
  };

  const res = createMockResponse();

  await controller(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.accessToken, "test-access-token");

  const cookie = res.headers["set-cookie"];

  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
  assert.ok(cookie.includes("SameSite=Lax"));
  assert.ok(cookie.includes("Path=/api/auth"));

  // The raw refresh token must not appear in JSON
  assert.ok(!JSON.stringify(res.body).includes(refreshToken));

  assert.equal(res.headers["cache-control"], "no-store");
});
test("failed login does not set a refresh cookie", async () => {
  const authenticationError = new Error(
    "Invalid credentials"
  );

  const controller = createSessionLoginController(
    async () => {
      throw authenticationError;
    },
    { secureCookies: true }
  );

  const req = {
    body: {
      email: "wrong@example.com",
      password: "Password123!",
    },
  };

  const res = createMockResponse();

  await assert.rejects(
    () => controller(req, res),
    (error) => error === authenticationError
  );

  assert.equal(res.headers["set-cookie"], undefined);
  assert.equal(res.body, null);
});