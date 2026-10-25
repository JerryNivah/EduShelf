
import test from "node:test";
import assert from "node:assert/strict";

import {
  createTokenLoginService,
} from "../services/auth.service.js";

import { AppError } from "../utils/AppError.js";

const mockUser = {
  id: 1,
  firstName: "Integration",
  lastName: "Tester",
  email: "test@example.com",
  role: "CUSTOMER",
};

const credentials = {
  email: "test@example.com",
  password: "correct-password",
};

// TEST 1: Successful login issues an access token
test("returns user and access token after authentication", async () => {
  let tokenSigningCalled = false;

  const login = createTokenLoginService({
    authenticate: async (data) => {
      assert.deepEqual(data, credentials);
      return mockUser;
    },

    signAccessToken: async (userId) => {
      assert.equal(userId, mockUser.id);
      tokenSigningCalled = true;

      return "mock.signed.access-token";
    },
  });

  const result = await login(credentials);

  assert.deepEqual(result.user, mockUser);
  assert.equal(
    result.accessToken,
    "mock.signed.access-token"
  );
  assert.equal(tokenSigningCalled, true);
});

// TEST 2: Invalid credentials must not issue a token
test("does not issue tokens for invalid credentials", async () => {
  let tokenSigningCalled = false;

  const login = createTokenLoginService({
    authenticate: async () => {
      throw new AppError("Invalid email or password", 401);
    },

    signAccessToken: async () => {
      tokenSigningCalled = true;
      return "should-not-be-generated";
    },
  });

  await assert.rejects(
    login(credentials),
    {
      statusCode: 401,
      message: "Invalid email or password",
    }
  );

  assert.equal(tokenSigningCalled, false);
});

// TEST 3: JWT signing failures propagate
test("rejects login when access token signing fails", async () => {
  const login = createTokenLoginService({
    authenticate: async () => mockUser,

    signAccessToken: async () => {
      throw new Error("Token signing failed");
    },
  });

  await assert.rejects(
    login(credentials),
    {
      message: "Token signing failed",
    }
  );
});
