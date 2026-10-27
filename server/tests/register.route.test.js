
import test from "node:test";
import assert from "node:assert/strict";

import {
  createRegisterHandler,
} from "../../api/auth/register.js";

import {
  registerController,
} from "../controllers/auth.controller.js";

import {
  createOriginGuard,
} from "../middleware/requireTrustedOrigin.js";

const handler = createRegisterHandler(
  registerController,
  createOriginGuard([
    "http://localhost:3000",
  ])
);

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,

    setHeader(name, value) {
      this.headers[name] = value;
      return this;
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

// Test 1: Reject unsupported HTTP methods
test("rejects GET requests", async () => {
  const req = {
    method: "GET",
  };

  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
  assert.equal(res.body.success, false);
});


 // Test 2: Reject invalid registration data
 test("rejects invalid registration requests", async () => {
  const req = {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
    },
    body: {
      firstName: "J",
      lastName: "Doe",
      email: "invalid-email",
      password: "123",
    },
  };
  // Step 1: Create the response object
  const res = createMockResponse();

  // Step 2: Execute the route handler
  await handler(req, res);

  // Step 3: Verify the HTTP response
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.ok(Array.isArray(res.body.errors));

  // Step 4: Extract validation error fields
  const invalidFields = res.body.errors.map(
    (error) => error.field
  );

  // Step 5: Verify specific validation errors
  assert.ok(invalidFields.includes("firstName"));
  assert.ok(invalidFields.includes("email"));
  assert.ok(invalidFields.includes("password"));

  // Step 6: Ensure req.body was passed correctly
  assert.ok(!invalidFields.includes("request"));
});
test("rejects registration from untrusted origins", async () => {
  const req = {
    method: "POST",
    headers: {
      origin: "https://malicious.example",
    },
    body: {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "SecurePass123!",
    },
  };

  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});