
import test from "node:test";
import assert from "node:assert/strict";

import {
  createLoginService,
  createTokenLoginService,
} from "../services/auth.service.js";

import {
  createAccessTokenService,
} from "../utils/accessToken.js";

import {
  hashPassword,
  verifyPassword,
} from "../utils/password.js";

import {
  createLoginController,
} from "../controllers/auth.controller.js";

import {
  createLoginHandler,
} from "../../api/auth/login.js";

// Test credentials only
const email = "jwt.integration@example.com";
const password = "TestOnly!Password2026";

// Test-only JWT signing key
const tokenService = createAccessTokenService("z".repeat(64));

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,

    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },
  };
}

// Build the complete login pipeline
async function createTestHandler() {
  const passwordHash = await hashPassword(password);

  const authenticate = createLoginService({
    findUserByEmail: async (requestedEmail) => {
      if (requestedEmail !== email) return null;

      return {
        id: 42,
        firstName: "JWT",
        lastName: "Tester",
        email,
        role: "CUSTOMER",
        passwordHash,
      };
    },

    verifyPassword,
  });

  const loginWithToken = createTokenLoginService({
    authenticate,
    signAccessToken: tokenService.signAccessToken,
  });

  return createLoginHandler(
    createLoginController(loginWithToken)
  );
}

// TEST 1: Real password verification and JWT issuance
test("authenticates and issues a verifiable JWT", async () => {
  const handler = await createTestHandler();
  const res = createMockResponse();

  await handler({
    method: "POST",
    body: {
      email: " JWT.INTEGRATION@EXAMPLE.COM ",
      password,
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.id, 42);

  const token = res.body.data.accessToken;

  assert.equal(typeof token, "string");

  const verified = await tokenService.verifyAccessToken(token);

  assert.equal(verified.userId, 42);

  assert.equal(
    "passwordHash" in res.body.data.user,
    false
  );

  assert.equal(res.headers["cache-control"], "no-store");
});

// TEST 2: Incorrect password must not receive JWT
test("rejects wrong password without issuing a JWT", async () => {
  const handler = await createTestHandler();
  const res = createMockResponse();

  await handler({
    method: "POST",
    body: {
      email,
      password: "WrongPassword!2026",
    },
  }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, "Invalid email or password");

  // No successful authentication data or access token
  assert.equal("data" in res.body, false);

  assert.equal(res.headers["cache-control"], "no-store");
});
