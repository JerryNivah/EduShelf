import test from "node:test";
import assert from "node:assert/strict";

import {
  createRefreshController,
} from "../controllers/refresh.controller.js";

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
test("successful refresh rotates the cookie", async () => {
  const oldToken = "A".repeat(43);
  const newToken = "B".repeat(43);

  const controller = createRefreshController(
    async ({ refreshToken }) => {
      assert.equal(refreshToken, oldToken);

      return {
        status: "ROTATED",
        accessToken: "new-access-jwt",
        refreshToken: newToken,
        expiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
      };
    },
    { secureCookies: true }
  );

  const req = {
    headers: {
      cookie: `edushelf_refresh=${oldToken}`,
    },
  };

  const res = createMockResponse();

  await controller(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);

  assert.equal(
    res.body.data.accessToken,
    "new-access-jwt"
  );

  const cookie = res.headers["set-cookie"];

  assert.ok(cookie.includes(newToken));
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
  assert.ok(cookie.includes("SameSite=Lax"));

  // Refresh credentials must never appear in JSON
  assert.ok(
    !JSON.stringify(res.body).includes(newToken)
  );

  assert.equal(
    res.headers["cache-control"],
    "no-store"
  );
});
test("missing refresh cookie returns 401", async () => {
  let serviceCalled = false;

  const controller = createRefreshController(
    async () => {
      serviceCalled = true;
      throw new Error("Should not refresh");
    },
    { secureCookies: true }
  );

  const req = {
    headers: {},
  };

  const res = createMockResponse();

  await controller(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);

  assert.equal(serviceCalled, false);

  // Existing refresh cookie is cleared
  assert.ok(
    res.headers["set-cookie"].includes("Max-Age=0")
  );
});
test("rejected refresh tokens return 401", async () => {
  const token = "A".repeat(43);

  for (const status of [
    "INVALID",
    "REPLAY_DETECTED",
  ]) {
    const controller = createRefreshController(
      async () => ({
        status,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      }),
      { secureCookies: true }
    );

    const req = {
      headers: {
        cookie: `edushelf_refresh=${token}`,
      },
    };

    const res = createMockResponse();

    await controller(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);

    assert.ok(
      res.headers["set-cookie"].includes("Max-Age=0")
    );

    assert.equal(
      res.body.data?.accessToken,
      undefined
    );
  }
});
test("propagates refresh service errors safely", async () => {
  const serviceError = new Error(
    "Refresh database transaction failed"
  );

  const controller = createRefreshController(
    async () => {
      throw serviceError;
    },
    { secureCookies: true }
  );

  const req = {
    headers: {
      cookie: `edushelf_refresh=${"A".repeat(43)}`,
    },
  };

  const res = createMockResponse();

  await assert.rejects(
    () => controller(req, res),
    (error) => error === serviceError
  );

  // No replacement credentials were delivered
  assert.equal(res.headers["set-cookie"], undefined);
  assert.equal(res.body, null);

  // Authentication responses must not be cached
  assert.equal(
    res.headers["cache-control"],
    "no-store"
  );
});
test("does not return success when cookie serialization fails", async () => {
  const familyId =
  "11111111-1111-4111-8111-111111111111";

let revokedFamilyId = null;
  const controller = createRefreshController(
    async () => ({
      status: "ROTATED",
      accessToken: "new-access-jwt",
      familyId,

      // Deliberately malformed replacement token
      refreshToken: "invalid-token",

      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ),
    }),
    { secureCookies: true, 
      revokeFamily: async ({ familyId: receivedFamilyId }) => {
        revokedFamilyId = receivedFamilyId;
        return 2;
      },
    }
  );

  const req = {
    headers: {
      cookie: `edushelf_refresh=${"A".repeat(43)}`,
    },
  };

  const res = createMockResponse();

  await assert.rejects(
    () => controller(req, res),
    {
      name: "TypeError",
      message: "Invalid refresh token",
    }
  );

  // Failed serialization must not set a cookie
  assert.equal(
    res.headers["set-cookie"],
    undefined
  );

  // No successful response should be sent
  assert.equal(res.statusCode, null);
  assert.equal(res.body, null);
  // Verify the correct session family was revoked
  assert.equal(revokedFamilyId, familyId);
});
test("preserves cookie serialization and revocation errors", async () => {
  const familyId =
    "11111111-1111-4111-8111-111111111111";

  const revocationError = new Error(
    "Database family revocation failed"
  );

  const calls = [];

  const controller = createRefreshController(
    async () => {
      calls.push("refresh");

      return {
        status: "ROTATED",
        accessToken: "new-access-jwt",
        familyId,

        // Invalid replacement token forces serialization failure
        refreshToken: "invalid-token",

        expiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
      };
    },
    {
      secureCookies: true,

      revokeFamily: async ({ familyId: receivedFamilyId }) => {
        calls.push("revoke");

        assert.equal(receivedFamilyId, familyId);

        throw revocationError;
      },
    }
  );

  const req = {
    headers: {
      cookie: `edushelf_refresh=${"A".repeat(43)}`,
    },
  };

  const res = createMockResponse();

  await assert.rejects(
    () => controller(req, res),
    (error) => {
      assert.ok(error instanceof AggregateError);

      // Original cookie serialization failure
      assert.equal(
        error.errors[0].name,
        "TypeError"
      );

      assert.equal(
        error.errors[0].message,
        "Invalid refresh token"
      );

      // Database revocation failure preserved
      assert.equal(
        error.errors[1],
        revocationError
      );

      return true;
    }
  );

  // Verify the order of operations
  assert.deepEqual(calls, [
    "refresh",
    "revoke",
  ]);

  // No replacement cookie or success response
  assert.equal(res.headers["set-cookie"], undefined);
  assert.equal(res.statusCode, null);
  assert.equal(res.body, null);

  // Prevent caching
  assert.equal(
    res.headers["cache-control"],
    "no-store"
  );
});