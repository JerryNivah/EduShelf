import test from "node:test";
import assert from "node:assert/strict";

import {
  createRefreshHandler,
} from "../../api/auth/refresh.js";

import {
  AppError,
} from "../utils/AppError.js";

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
test("rejects non-POST requests before authentication", async () => {
  let controllerCalled = false;
  let originGuardCalled = false;

  const handler = createRefreshHandler(
    async () => {
      controllerCalled = true;
    },

    () => {
      originGuardCalled = true;
    }
  );

  const req = {
    method: "GET",
    headers: {},
  };

  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, "POST");

  assert.equal(controllerCalled, false);
  assert.equal(originGuardCalled, false);

  assert.equal(
    res.headers["cache-control"],
    "no-store"
  );
});
test("rejects untrusted origins before token rotation", async () => {
  let controllerCalled = false;

  const handler = createRefreshHandler(
    async () => {
      controllerCalled = true;
    },

    () => {
      throw new AppError(
        "Origin not allowed",
        403
      );
    }
  );

  const req = {
    method: "POST",
    headers: {
      origin: "https://malicious.example",
    },
  };

  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);

  assert.equal(controllerCalled, false);
});
test("trusted POST requests reach the refresh controller", async () => {
  const calls = [];

  const handler = createRefreshHandler(
    async (req, res) => {
      calls.push("controller");

      return res.status(200).json({
        success: true,
        data: {
          accessToken: "mock-access-jwt",
        },
      });
    },

    (req) => {
      calls.push("originGuard");

      assert.equal(
        req.headers.origin,
        "http://localhost:3000"
      );
    }
  );

  const req = {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
    },
  };

  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);

  assert.equal(
    res.body.data.accessToken,
    "mock-access-jwt"
  );

  assert.deepEqual(calls, [
    "originGuard",
    "controller",
  ]);

  assert.equal(
    res.headers["cache-control"],
    "no-store"
  );
});
test("handles unexpected refresh controller errors safely", async () => {
  const databaseError = new Error(
    "Refresh database transaction failed"
  );

  const calls = [];

  const handler = createRefreshHandler(
    async () => {
      calls.push("controller");

      throw databaseError;
    },

    () => {
      calls.push("originGuard");
    }
  );

  const req = {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      cookie: `edushelf_refresh=${"A".repeat(43)}`,
    },
  };

  const res = createMockResponse();

  await handler(req, res);

  // Unexpected errors should return HTTP 500
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);

  // Authentication checks run in the correct order
  assert.deepEqual(calls, [
    "originGuard",
    "controller",
  ]);

  // Never expose replacement credentials
  assert.equal(
    res.headers["set-cookie"],
    undefined
  );

  assert.equal(
    res.body.data?.accessToken,
    undefined
  );

  // Do not expose internal database errors
  assert.ok(
    !JSON.stringify(res.body).includes(
      databaseError.message
    )
  );

  // Never cache authentication responses
  assert.equal(
    res.headers["cache-control"],
    "no-store"
  );
});