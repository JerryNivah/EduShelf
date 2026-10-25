import test from "node:test";
import assert from "node:assert/strict";

import {
  createLoginHandler,
} from "../../api/auth/login.js";

import {
  createSessionLoginController,
} from "../controllers/auth.controller.js";

import {
  createOriginGuard,
} from "../middleware/requireTrustedOrigin.js";

const originGuard = createOriginGuard([
  "http://localhost:3000",
]);

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
test("login handler delivers refresh token via cookie", async () => {
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

  const handler = createLoginHandler(
    controller,
    originGuard
  );

  const req = {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
    },
    body: {
      email: "test@example.com",
      password: "Password123!",
    },
  };

  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);

  assert.deepEqual(res.body.data.user, user);

  assert.equal(
    res.body.data.accessToken,
    "test-access-token"
  );

  const cookie = res.headers["set-cookie"];

  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
  assert.ok(cookie.includes("SameSite=Lax"));

  assert.ok(cookie.includes(refreshToken));

  // Raw refresh token must not appear in JSON
  assert.ok(
    !JSON.stringify(res.body).includes(refreshToken)
  );

  assert.equal(
    res.headers["cache-control"],
    "no-store"
  );
});
test("untrusted origin cannot reach session login", async () => {
  let authenticationCalled = false;

  const controller = createSessionLoginController(
    async () => {
      authenticationCalled = true;
      throw new Error("Should not authenticate");
    },
    { secureCookies: true }
  );

  const handler = createLoginHandler(
    controller,
    originGuard
  );

  const req = {
    method: "POST",
    headers: {
      origin: "https://attacker.example",
    },
    body: {
      email: "test@example.com",
      password: "Password123!",
    },
  };

  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(authenticationCalled, false);

  assert.equal(
    res.headers["set-cookie"],
    undefined
  );
});