import test from "node:test";
import assert from "node:assert/strict";

import {
  createLogoutSessionService,
} from "../services/logout.service.js";

import {
  createLogoutController,
} from "../controllers/logout.controller.js";

import {
  createLogoutHandler,
} from "../../api/auth/logout.js";

import { AppError } from "../utils/AppError.js";

const TOKEN = "A".repeat(43);
const FAMILY_ID = "11111111-1111-4111-8111-111111111111";

function createMockResponse() {
  const headers = {};

  return {
    headers,
    statusCode: null,
    body: null,

    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
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

test("logout revokes the active session family", async () => {
  let receivedFamilyId = null;

  const logout = createLogoutSessionService({
    hashToken: () => "hashed-token",

    findSession: async (hash) => {
      assert.equal(hash, "hashed-token");

      return {
        familyId: FAMILY_ID,
        usedAt: null,
        revokedAt: null,
        expiresAt: new Date("2030-01-01"),
      };
    },

    revokeFamily: async ({ familyId }) => {
      receivedFamilyId = familyId;
      return 2;
    },

    now: () => new Date("2026-10-25"),
  });

  assert.equal(
    await logout({ refreshToken: TOKEN }),
    true
  );

  assert.equal(receivedFamilyId, FAMILY_ID);
});

test("logout ignores already-used refresh tokens", async () => {
  let revokeCalled = false;

  const logout = createLogoutSessionService({
    hashToken: () => "hashed-token",

    findSession: async () => ({
      familyId: FAMILY_ID,
      usedAt: new Date("2026-10-24"),
      revokedAt: null,
      expiresAt: new Date("2030-01-01"),
    }),

    revokeFamily: async () => {
      revokeCalled = true;
      return 2;
    },
  });

  assert.equal(
    await logout({ refreshToken: TOKEN }),
    false
  );

  assert.equal(revokeCalled, false);
});

test("logout clears cookie and returns success", async () => {
  let receivedToken = null;

  const controller = createLogoutController(
    async ({ refreshToken }) => {
      receivedToken = refreshToken;
    },
    { secureCookies: true }
  );

  const res = createMockResponse();

  await controller(
    { headers: { cookie: `edushelf_refresh=${TOKEN}` } },
    res
  );

  assert.equal(receivedToken, TOKEN);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);

  assert.ok(
    res.headers["set-cookie"].includes("Max-Age=0")
  );

  assert.ok(
    res.headers["set-cookie"].includes("HttpOnly")
  );

  assert.equal(
    res.headers["cache-control"],
    "no-store"
  );
});

test("logout without a cookie is idempotent", async () => {
  let serviceCalled = false;

  const controller = createLogoutController(
    async () => {
      serviceCalled = true;
    },
    { secureCookies: false }
  );

  const res = createMockResponse();

  await controller({ headers: {} }, res);

  assert.equal(serviceCalled, false);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);

  assert.ok(
    res.headers["set-cookie"].includes("Max-Age=0")
  );
});

test("logout rejects untrusted origins", async () => {
  let controllerCalled = false;

  const handler = createLogoutHandler(
    async () => {
      controllerCalled = true;
    },
    () => {
      throw new AppError("Origin not allowed", 403);
    }
  );

  const res = createMockResponse();

  await handler(
    {
      method: "POST",
      headers: {
        origin: "https://malicious.example",
      },
    },
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(controllerCalled, false);
});

test("logout propagates database errors without success", async () => {
  const databaseError = new Error("Database unavailable");

  const controller = createLogoutController(
    async () => {
      throw databaseError;
    }
  );

  const res = createMockResponse();

  await assert.rejects(
    () =>
      controller(
        {
          headers: {
            cookie: `edushelf_refresh=${TOKEN}`,
          },
        },
        res
      ),
    (error) => error === databaseError
  );

  assert.equal(res.statusCode, null);
  assert.equal(res.body, null);
  assert.equal(res.headers["set-cookie"], undefined);
});