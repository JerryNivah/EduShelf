
import test from "node:test";
import assert from "node:assert/strict";

import { createLoginHandler } from "../../api/auth/login.js";
import { createLoginController } from "../controllers/auth.controller.js";
import { AppError } from "../utils/AppError.js";

// Mock the HTTP response object
function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,

    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },
  };
}

function createRequest(overrides = {}) {
  return {
    method: "POST",
    body: {
      email: "test@example.com",
      password: "correct-password",
    },
    ...overrides,
  };
}


// TEST 1: Successful login
test("returns 200 for successful login", async () => {
  const controller = createLoginController(async () => ({
    user: {
      id: 1,
      email: "test@example.com",
      role: "CUSTOMER",
    },
    accessToken: "mock.signed.access-token",
  }));

  const handler = createLoginHandler(controller);
  const res = createMockResponse();

  await handler(createRequest(), res);

  // Verify successful HTTP response
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);

  // Verify authenticated user
  assert.equal(res.body.data.user.id, 1);
  assert.equal(res.body.data.user.role, "CUSTOMER");

  // Verify access token is included
  assert.equal(
    res.body.data.accessToken,
    "mock.signed.access-token"
  );

  // Verify security requirements
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal("passwordHash" in res.body.data.user, false);
});

// TEST 2: Invalid email
test("returns 400 for invalid login data", async () => {
  const controller = createLoginController(async () => {
    throw new Error("Authentication must not run");
  });

  const handler = createLoginHandler(controller);
  const res = createMockResponse();

  await handler(
    createRequest({
      body: {
        email: "invalid-email",
        password: "password123",
      },
    }),
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.ok(
    res.body.errors.some((error) => error.field === "email")
  );
  assert.equal(res.headers["cache-control"], "no-store");
});

// TEST 3: Incorrect credentials
test("returns 401 for incorrect credentials", async () => {
  const controller = createLoginController(async () => {
    throw new AppError("Invalid email or password", 401);
  });

  const handler = createLoginHandler(controller);
  const res = createMockResponse();

  await handler(createRequest(), res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, "Invalid email or password");
  assert.equal(res.headers["cache-control"], "no-store");
});

// TEST 4: Unsupported HTTP method
test("returns 405 for non-POST requests", async () => {
  const handler = createLoginHandler(async () => {
    throw new Error("Controller must not execute");
  });

  const res = createMockResponse();

  await handler(createRequest({ method: "GET" }), res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.body.success, false);
  assert.equal(res.headers["allow"], "POST");
  assert.equal(res.headers["cache-control"], "no-store");
});
