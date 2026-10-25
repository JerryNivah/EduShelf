import test from "node:test";
import assert from "node:assert/strict";

import {
  createLoginHandler,
} from "../../api/auth/login.js";

import {
  createOriginGuard,
} from "../middleware/requireTrustedOrigin.js";

const guard = createOriginGuard([
  "http://localhost:3000",
]);

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
test("accepts login from a trusted origin", async () => {
  let controllerCalled = false;

  const handler = createLoginHandler(
    async (req, res) => {
      controllerCalled = true;

      return res.status(200).json({
        success: true,
      });
    },
    guard
  );

  const res = createMockResponse();

  await handler({
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
    },
  }, res);

  assert.equal(controllerCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});
test("rejects login from an untrusted origin", async () => {
  let controllerCalled = false;

  const handler = createLoginHandler(
    async () => {
      controllerCalled = true;
    },
    guard
  );

  const res = createMockResponse();

  await handler({
    method: "POST",
    headers: {
      origin: "https://attacker.example",
    },
  }, res);

  assert.equal(controllerCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});
test("rejects non-POST login requests", async () => {
  let controllerCalled = false;

  const handler = createLoginHandler(
    async () => {
      controllerCalled = true;
    },
    guard
  );

  const res = createMockResponse();

  await handler({
    method: "GET",
    headers: {},
  }, res);

  assert.equal(controllerCalled, false);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers["allow"], "POST");
});