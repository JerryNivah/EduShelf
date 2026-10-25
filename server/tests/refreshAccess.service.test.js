import test from "node:test";
import assert from "node:assert/strict";

import {
  createRefreshAccessService,
} from "../services/refreshSession.service.js";

test("issues a new access JWT after successful rotation", async () => {
  const calls = [];

  const expiresAt = new Date("2030-01-07T00:00:00Z");

  const refreshAccessSession = createRefreshAccessService({
    rotateRawRefreshToken: async ({ refreshToken }) => {
      calls.push("rotate");

      assert.equal(refreshToken, "old-refresh-token");

      return {
        status: "ROTATED",
        userId: 7,
        familyId: "11111111-1111-4111-8111-111111111111",
        refreshToken: "new-refresh-token",
        expiresAt,
      };
      assert.equal(result.status, "ROTATED");
      assert.equal(result.accessToken, "new-access-jwt");
      assert.equal(result.refreshToken, "new-refresh-token");
      assert.equal(result.expiresAt, expiresAt);
      assert.equal(
        result.familyId,
        "11111111-1111-4111-8111-111111111111"
      );
    },

    

    signAccessToken: async (userId) => {
      calls.push("sign");

      assert.equal(userId, 7);

      return "new-access-jwt";
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