import test from "node:test";
import assert from "node:assert/strict";

import { rotateOrHandleRefreshReplay } from
  "../services/refreshSession.service.js";

const input = {
  currentTokenHash: "old-hash",
  nextTokenHash: "new-hash",
  expiresAt: new Date("2030-01-01"),
};

test("successful rotation does not check replay", async () => {
  const result = await rotateOrHandleRefreshReplay(
    input,
    {
      rotate: async () => ({ id: "new-session" }),
      checkReplay: async () => {
        throw new Error("Replay check should not run");
      },
    }
  );

  assert.equal(result.status, "ROTATED");
  assert.equal(result.session.id, "new-session");
});

test("consumed token triggers replay handling", async () => {
  const result = await rotateOrHandleRefreshReplay(
    input,
    {
      rotate: async () => null,
      checkReplay: async ({ tokenHash }) => {
        assert.equal(tokenHash, "old-hash");
        return { replayDetected: true, revokedCount: 2 };
      },
    }
  );

  assert.equal(result.status, "REPLAY_DETECTED");
  assert.equal(result.session, null);
});
test("invalid token returns INVALID", async () => {
  const result = await rotateOrHandleRefreshReplay(
    input,
    {
      rotate: async () => null,
      checkReplay: async () => ({
        replayDetected: false,
        revokedCount: 0,
      }),
    }
  );

  assert.equal(result.status, "INVALID");
  assert.equal(result.session, null);
});
test("database errors propagate without replay detection", async () => {
  const databaseError = Object.assign(
    new Error("Transaction unavailable"),
    { code: "P2028" }
  );

  let replayChecked = false;

  await assert.rejects(
    () =>
      rotateOrHandleRefreshReplay(input, {
        rotate: async () => {
          throw databaseError;
        },
        checkReplay: async () => {
          replayChecked = true;
          return { replayDetected: true };
        },
      }),
    (error) => error === databaseError
  );

  assert.equal(replayChecked, false);
});
test("replay handler errors propagate correctly", async () => {
  const databaseError = Object.assign(
    new Error("Replay transaction failed"),
    { code: "P2028" }
  );

  let replayChecked = false;

  await assert.rejects(
    () =>
      rotateOrHandleRefreshReplay(input, {
        rotate: async () => null,

        checkReplay: async () => {
          replayChecked = true;
          throw databaseError;
        },
      }),
    (error) => error === databaseError
  );

  assert.equal(replayChecked, true);
});