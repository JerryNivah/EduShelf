import test from "node:test";
import assert from "node:assert/strict";

import {
  createRegisterController,
} from "../controllers/auth.controller.js";

const registration = {
  firstName: "Test",
  lastName: "Customer",
  email: "TEST@EXAMPLE.COM",
  password: "SecurePass123!",
};

function mockResponse() {
  return {
    statusCode: null,
    body: null,

    setHeader() {
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

test("registration requests verification after creating a user", async () => {
  const calls = [];

  const controller = createRegisterController(
    async (data) => {
      calls.push("register");

      assert.equal(data.email, "test@example.com");

      return {
        id: 7,
        email: data.email,
        role: "CUSTOMER",
      };
    },

    async ({ email }) => {
      calls.push("request-code");
      assert.equal(email, "test@example.com");
    }
  );

  const res = mockResponse();

  await controller(
    { body: registration },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);

  assert.deepEqual(calls, [
    "register",
    "request-code",
  ]);
});

test("delivery failure does not undo a created account", async () => {
  const controller = createRegisterController(
    async () => ({
      id: 7,
      email: "test@example.com",
    }),

    async () => {
      throw new Error("Email provider unavailable");
    }
  );

  const res = mockResponse();

  await controller(
    { body: registration },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.user.id, 7);
});