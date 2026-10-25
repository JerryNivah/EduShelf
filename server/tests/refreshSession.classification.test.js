import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyRefreshSession,
  inspectRefreshSession,
} from "../services/refreshSession.service.js";

const now = new Date("2026-10-19T12:00:00Z");

const activeSession = {
  usedAt: null,
  revokedAt: null,
  expiresAt: new Date("2026-10-20T12:00:00Z"),
};

test("classifies unknown sessions", () => {
  assert.equal(classifyRefreshSession(null, now), "UNKNOWN");
});

test("classifies active sessions", () => {
  assert.equal(classifyRefreshSession(activeSession, now), "ACTIVE");
});

test("classifies expired sessions", () => {
  assert.equal(
    classifyRefreshSession({
      ...activeSession,
      expiresAt: new Date("2026-10-18T12:00:00Z"),
    }, now),
    "EXPIRED"
  );
});

test("classifies consumed sessions", () => {
  assert.equal(
    classifyRefreshSession({
      ...activeSession,
      usedAt: new Date("2026-10-19T11:00:00Z"),
    }, now),
    "USED"
  );
});

test("classifies revoked sessions", () => {
  assert.equal(
    classifyRefreshSession({
      ...activeSession,
      revokedAt: new Date("2026-10-19T11:00:00Z"),
    }, now),
    "REVOKED"
  );
});
test("identifies a used session from repository lookup", async () => {
  const storedSession = {
    ...activeSession,
    familyId: "test-family",
    usedAt: new Date("2026-10-19T11:00:00Z"),
  };

  const result = await inspectRefreshSession("test-hash", {
    findSession: async (hash) => {
      assert.equal(hash, "test-hash");
      return storedSession;
    },
    now,
  });

  assert.equal(result.status, "USED");
  assert.equal(result.session, storedSession);
});
test("handles an unknown refresh-token hash", async () => {
  const result = await inspectRefreshSession("unknown-hash", {
    findSession: async () => null,
    now,
  });

  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.session, null);
});
test("expires a session at the exact expiration time", () => {
  const session = {
    ...activeSession,
    expiresAt: now,
  };

  assert.equal(
    classifyRefreshSession(session, now),
    "EXPIRED"
  );
});

test("prioritizes USED over EXPIRED", () => {
  const session = {
    ...activeSession,
    usedAt: new Date("2026-10-18T10:00:00Z"),
    expiresAt: new Date("2026-10-18T12:00:00Z"),
  };

  assert.equal(
    classifyRefreshSession(session, now),
    "USED"
  );
});

test("prioritizes REVOKED over USED", () => {
  const session = {
    ...activeSession,
    usedAt: new Date("2026-10-18T10:00:00Z"),
    revokedAt: new Date("2026-10-18T11:00:00Z"),
  };

  assert.equal(
    classifyRefreshSession(session, now),
    "REVOKED"
  );
});