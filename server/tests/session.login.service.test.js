import test from "node:test";
import assert from "node:assert/strict";

import {
  createSessionLoginService,
} from "../services/auth.service.js";

test("issues access and refresh tokens after authentication", async () => {
  const calls = [];

  const user = {
    id: 7,
    firstName: "Test",
    role: "CUSTOMER",
  };

  const refreshExpiresAt =
    new Date("2030-01-07T00:00:00Z");

  const loginWithSession = createSessionLoginService({
    loginWithAccessToken: async (credentials) => {
      calls.push("authenticate");

      assert.equal(credentials.email, "test@example.com");

      return {
        user,
        accessToken: "test-access-token",
      };
    },

    issueInitialRefreshToken: async ({ userId }) => {
      calls.push("issue-refresh");

      assert.equal(userId, 7);

      return {
        refreshToken: "test-refresh-token",
        expiresAt: refreshExpiresAt,
      };
    },
  });

  const result = await loginWithSession({
    email: "test@example.com",
    password: "test-password",
  });

  assert.deepEqual(calls, [
    "authenticate",
    "issue-refresh",
  ]);

  assert.deepEqual(result.user, user);

  assert.equal(
    result.accessToken,
    "test-access-token"
  );

  assert.equal(
    result.refreshToken,
    "test-refresh-token"
  );

  assert.equal(
    result.refreshExpiresAt,
    refreshExpiresAt
  );
});
test("does not issue a refresh token when authentication fails", async () => {
  const authenticationError =
    new Error("Invalid credentials");

  let refreshCalled = false;

  const loginWithSession = createSessionLoginService({
    loginWithAccessToken: async () => {
      throw authenticationError;
    },

    issueInitialRefreshToken: async () => {
      refreshCalled = true;
      throw new Error("Should not be called");
    },
  });

  await assert.rejects(
    () => loginWithSession({
      email: "wrong@example.com",
      password: "wrong-password",
    }),
    (error) => error === authenticationError
  );

  assert.equal(refreshCalled, false);
});
test("does not complete login when refresh issuance fails", async () => {
  const databaseError =
    new Error("Refresh session persistence failed");

  const loginWithSession = createSessionLoginService({
    loginWithAccessToken: async () => ({
      user: { id: 7 },
      accessToken: "test-access-token",
    }),

    issueInitialRefreshToken: async () => {
      throw databaseError;
    },
  });

  await assert.rejects(
    () => loginWithSession({
      email: "test@example.com",
      password: "test-password",
    }),
    (error) => error === databaseError
  );
});