import test from "node:test";
import assert from "node:assert/strict";

import {
  rotateRawRefreshToken,
} from "../services/refreshSession.service.js";

import {
  generateRefreshToken,
  hashRefreshToken,
} from "../utils/refreshToken.js";

test("successfully rotates a raw refresh token", async () => {
  const currentToken = generateRefreshToken();
  const now = Date.UTC(2026, 9, 21);

  let receivedData;

  const result = await rotateRawRefreshToken(
    { refreshToken: currentToken },
    {
      now: () => now,

      generatePair: () => ({
        token: "new-raw-token",
        tokenHash: "new-token-hash",
      }),

      rotate: async (data) => {
        receivedData = data;

        return {
          status: "ROTATED",
          session: {
            id: "replacement-session",
            userId: 7,
            familyId: "11111111-1111-4111-8111-111111111111",
            expiresAt: new Date(
              now + 7 * 24 * 60 * 60 * 1000
            ),
          },
        };
      },
    }
  );

  assert.equal(result.status, "ROTATED");
  assert.equal(result.refreshToken, "new-raw-token");
  assert.equal(result.userId, 7);

  assert.equal(
    result.familyId,
    "11111111-1111-4111-8111-111111111111"
  );

  assert.equal(
    receivedData.currentTokenHash,
    hashRefreshToken(currentToken)
  );

  assert.equal(
    receivedData.nextTokenHash,
    "new-token-hash"
  );

  assert.equal(
    result.expiresAt.getTime(),
    now + 7 * 24 * 60 * 60 * 1000
  );
});
test("does not return a token when rotation fails", async () => {
  const currentToken = generateRefreshToken();

  for (const status of ["INVALID", "REPLAY_DETECTED"]) {
    const result = await rotateRawRefreshToken(
      { refreshToken: currentToken },
      {
        generatePair: () => ({
          token: "must-not-be-returned",
          tokenHash: "candidate-hash",
        }),

        rotate: async () => ({
          status,
          session: null,
        }),
      }
    );

    assert.equal(result.status, status);
    assert.equal(result.refreshToken, null);
    assert.equal(result.expiresAt, null);
  }
});
test("rejects malformed tokens without attempting rotation", async () => {
  const invalidTokens = [
    null,
    undefined,
    "",
    "invalid-token",
    12345,
    {},
  ];

  for (const refreshToken of invalidTokens) {
    let rotateCalled = false;
    let pairGenerated = false;

    const result = await rotateRawRefreshToken(
      { refreshToken },
      {
        generatePair: () => {
          pairGenerated = true;
          throw new Error("Should not generate a token");
        },

        rotate: async () => {
          rotateCalled = true;
          throw new Error("Should not rotate");
        },
      }
    );

    assert.equal(result.status, "INVALID");
    assert.equal(result.refreshToken, null);
    assert.equal(result.expiresAt, null);

    assert.equal(pairGenerated, false);
    assert.equal(rotateCalled, false);
  }
});
test("propagates rotation database errors", async () => {
  const currentToken = generateRefreshToken();

  const databaseError = Object.assign(
    new Error("Transaction failed"),
    { code: "P2028" }
  );

  await assert.rejects(
    () =>
      rotateRawRefreshToken(
        { refreshToken: currentToken },
        {
          rotate: async () => {
            throw databaseError;
          },
        }
      ),
    (error) => error === databaseError
  );
});
test("returns the expiration persisted by the repository", async () => {
  const currentToken = generateRefreshToken();

  const now = Date.UTC(2026, 9, 21);

  // Family has only one day remaining
  const persistedExpiry = new Date(
    now + 24 * 60 * 60 * 1000
  );

  const result = await rotateRawRefreshToken(
    { refreshToken: currentToken },
    {
      now: () => now,

      rotate: async ({ expiresAt }) => {
        // Service requested seven days
        assert.equal(
          expiresAt.getTime(),
          now + 7 * 24 * 60 * 60 * 1000
        );

        // Repository capped it to one day
        return {
          status: "ROTATED",
          session: {
            id: "capped-session",
            userId: 7,
            expiresAt: persistedExpiry,
          },
        };
      },
    }
  );

  assert.equal(result.status, "ROTATED");
  assert.equal(result.userId, 7);

  assert.equal(
    result.expiresAt.getTime(),
    persistedExpiry.getTime()
  );
});