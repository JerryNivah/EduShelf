import test from "node:test";
import assert from "node:assert/strict";

import {
  issueInitialRefreshToken,
} from "../services/refreshSession.service.js";

test("issues a token only after session creation succeeds", async () => {
  const familyId =
    "11111111-1111-4111-8111-111111111111";

  const now = Date.UTC(2026, 9, 20);

  let savedData = null;

  const result = await issueInitialRefreshToken(
    { userId: 7 },
    {
      generateFamilyId: () => familyId,

      generatePair: () => ({
        token: "test-raw-token",
        tokenHash: "test-token-hash",
      }),

      now: () => now,

      createSession: async (data) => {
        savedData = data;

        return {
          session: {
            expiresAt: data.expiresAt,
          }
        }
      },
    }
  );

  assert.equal(result.refreshToken, "test-raw-token");
  assert.equal(result.familyId, familyId);

  assert.equal(savedData.userId, 7);
  assert.equal(savedData.familyId, familyId);
  assert.equal(savedData.tokenHash, "test-token-hash");

  assert.equal(
    savedData.expiresAt.getTime(),
    now + 7 * 24 * 60 * 60 * 1000
  );

  assert.equal(
    Object.hasOwn(savedData, "token"),
    false
  );
});
test("does not issue a token when persistence fails", async () => {
  const databaseError = new Error(
    "Database transaction failed"
  );

  await assert.rejects(
    () =>
      issueInitialRefreshToken(
        { userId: 7 },
        {
          createSession: async () => {
            throw databaseError;
          },
        }
      ),
    (error) => error === databaseError
  );
});
test("returns the expiration persisted by Prisma", async () => {
  const now = Date.UTC(2026, 9, 22);

  const persistedExpiry = new Date(
    now + 3 * 24 * 60 * 60 * 1000
  );

  const result = await issueInitialRefreshToken(
    { userId: 7 },
    {
      now: () => now,

      createSession: async ({ expiresAt }) => {
        // Service initially requests seven days.
        assert.equal(
          expiresAt.getTime(),
          now + 7 * 24 * 60 * 60 * 1000
        );

        // Simulate a repository that persisted
        // a shorter expiration.
        return {
          session: {
            expiresAt: persistedExpiry,
          },
        };
      },
    }
  );

  assert.equal(
    result.expiresAt.getTime(),
    persistedExpiry.getTime()
  );
});