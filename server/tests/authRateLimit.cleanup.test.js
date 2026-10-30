import test from "node:test";
import assert from "node:assert/strict";

import {
  createCleanupHandler,
} from "../../api/maintenance/cleanup-rate-limits.js";

function response() {
  return {
    statusCode: null,
    body: null,
    headers: {},

    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
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

test("rejects unauthorized cleanup", async () => {
  let executed = false;

  const handler = createCleanupHandler({
    secret: "test-cleanup-secret-123456",
    db: {
      authRateLimit: {
        deleteMany: async () => {
          executed = true;
        },
      },
    },
  });

  const res = response();

  await handler({
    method: "GET",
    headers: {},
  }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(executed, false);
});

test("deletes only expired rate-limit buckets", async () => {
  const now = new Date("2026-10-30T10:00:00Z");

  let receivedWhere;

  const handler = createCleanupHandler({
    secret: "test-cleanup-secret-123456",
    now: () => now,
    db: {
      authRateLimit: {
        deleteMany: async ({ where }) => {
          receivedWhere = where;
          return { count: 12 };
        },
      },
    },
  });

  const res = response();

  await handler({
    method: "GET",
    headers: {
      authorization: "Bearer test-cleanup-secret-123456",
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.deleted, 12);

  assert.deepEqual(receivedWhere, {
    expiresAt: { lt: now },
  });
});