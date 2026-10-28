import test from "node:test";
import assert from "node:assert/strict";

import {
  createRefreshAccessService,
} from "../services/refreshSession.service.js";

const findVerifiedUser = async (userId) => ({
  id: userId,
  email: "verified@example.com",
  emailVerifiedAt: new Date("2026-10-01T00:00:00Z"),
});

test("issues a new access JWT after successful rotation", async () => {
  const calls = [];

  const expiresAt = new Date("2030-01-07T00:00:00Z");

  const familyId =
    "11111111-1111-4111-8111-111111111111";

  const refreshAccessSession = createRefreshAccessService({
    rotateRawRefreshToken: async ({ refreshToken }) => {
      calls.push("rotate");

      assert.equal(refreshToken, "old-refresh-token");

      return {
        status: "ROTATED",
        userId: 7,
        familyId,
        refreshToken: "new-refresh-token",
        expiresAt,
      };
    },

    // NEW: Confirm the account is verified.
    findUser: findVerifiedUser,

    signAccessToken: async (userId) => {
      calls.push("sign");

      assert.equal(userId, 7);

      return "new-access-jwt";
    },

    // NEW: A successful refresh must not revoke the family.
    revokeFamily: async () => {
      throw new Error(
        "Family revocation must not run during successful refresh"
      );
    },
  });

  const result = await refreshAccessSession({
    refreshToken: "old-refresh-token",
  });

  assert.deepEqual(calls, ["rotate", "sign"]);

  assert.equal(result.status, "ROTATED");
  assert.equal(result.accessToken, "new-access-jwt");
  assert.equal(result.refreshToken, "new-refresh-token");
  assert.equal(result.expiresAt, expiresAt);
  assert.equal(result.familyId, familyId);
});

test("does not issue access JWTs for rejected refresh tokens", async () => {
  for (const status of ["INVALID", "REPLAY_DETECTED"]) {
    let signingCalled = false;

    const refreshAccessSession = createRefreshAccessService({
      rotateRawRefreshToken: async () => ({
        status,
        refreshToken: null,
        expiresAt: null,
      }),

      signAccessToken: async () => {
        signingCalled = true;
        throw new Error("JWT signing must not run");
      },
    });

    const result = await refreshAccessSession({
      refreshToken: "rejected-refresh-token",
    });

    assert.equal(result.status, status);
    assert.equal(result.accessToken, null);
    assert.equal(result.refreshToken, null);
    assert.equal(result.expiresAt, null);

    assert.equal(signingCalled, false);
  }
});
test("propagates database rotation errors", async () => {
  const databaseError = Object.assign(
    new Error("Refresh transaction failed"),
    { code: "P2028" }
  );

  let signingCalled = false;

  const refreshAccessSession = createRefreshAccessService({
    rotateRawRefreshToken: async () => {
      throw databaseError;
    },

    signAccessToken: async () => {
      signingCalled = true;
      throw new Error("JWT signing must not run");
    },
  });

  await assert.rejects(
    () => refreshAccessSession({
      refreshToken: "test-refresh-token",
    }),
    (error) => error === databaseError
  );

  assert.equal(signingCalled, false);
});
test("revokes the family when JWT signing fails", async () => {
  const signingError = new Error(
    "Access JWT signing failed"
  );

  const familyId =
    "11111111-1111-4111-8111-111111111111";

  const calls = [];

  const refreshAccessSession = createRefreshAccessService({
    rotateRawRefreshToken: async () => {
      calls.push("rotate");

      return {
        status: "ROTATED",
        userId: 7,
        familyId,
        refreshToken: "replacement-refresh-token",
        expiresAt: new Date("2030-01-07"),
      };
    },

    // NEW: Verified account lookup
    findUser: findVerifiedUser,

    signAccessToken: async (userId) => {
      calls.push("sign");

      assert.equal(userId, 7);

      throw signingError;
    },

    revokeFamily: async ({ familyId: receivedFamilyId }) => {
      calls.push("revoke");

      assert.equal(receivedFamilyId, familyId);

      return 2;
    },
  });

  await assert.rejects(
    () =>
      refreshAccessSession({
        refreshToken: "original-refresh-token",
      }),
    (error) => error === signingError
  );

  assert.deepEqual(calls, [
    "rotate",
    "sign",
    "revoke",
  ]);
});
test("preserves signing and revocation errors", async () => {
  const signingError = new Error("JWT signing failed");
  const revocationError = new Error("Family revocation failed");

  const familyId =
    "11111111-1111-4111-8111-111111111111";

  const calls = [];

  const refreshAccessSession = createRefreshAccessService({
    rotateRawRefreshToken: async () => {
      calls.push("rotate");

      return {
        status: "ROTATED",
        userId: 7,
        familyId,
        refreshToken: "replacement-refresh-token",
        expiresAt: new Date("2030-01-07"),
      };
    },

    // NEW: Verified account lookup
    findUser: findVerifiedUser,

    signAccessToken: async () => {
       calls.push("sign");
       throw signingError;
     },

    revokeFamily: async ({ familyId: receivedFamilyId }) => {
      calls.push("revoke");

      assert.equal(receivedFamilyId, familyId);

      throw revocationError;
    },
  });

  await assert.rejects(
    () =>
      refreshAccessSession({
        refreshToken: "original-refresh-token",
      }),
    (error) => {
      assert.ok(error instanceof AggregateError);

      assert.equal(error.errors[0], signingError);
      assert.equal(error.errors[1], revocationError);

      return true;
    }
  );

  assert.deepEqual(calls, [
    "rotate",
    "sign",
    "revoke",
  ]);
});
test("revokes refresh family for an unverified user", async () => {
  const familyId =
    "11111111-1111-4111-8111-111111111111";

  let signingCalled = false;
  let revoked = false;

  const refreshAccessSession = createRefreshAccessService({
    rotateRawRefreshToken: async () => ({
      status: "ROTATED",
      userId: 7,
      familyId,
      refreshToken: "replacement-token",
      expiresAt: new Date("2030-01-07"),
    }),

    findUser: async () => ({
      id: 7,
      email: "unverified@example.com",
      emailVerifiedAt: null,
    }),

    signAccessToken: async () => {
      signingCalled = true;
      return "access-jwt";
    },

    revokeFamily: async ({ familyId: receivedId }) => {
      assert.equal(receivedId, familyId);
      revoked = true;
      return 2;
    },
  });

  const result = await refreshAccessSession({
    refreshToken: "original-token",
  });

  assert.equal(result.status, "INVALID");
  assert.equal(result.accessToken, null);
  assert.equal(result.refreshToken, null);
  assert.equal(signingCalled, false);
  assert.equal(revoked, true);
});