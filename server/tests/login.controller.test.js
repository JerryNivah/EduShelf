
import test from "node:test";
import assert from "node:assert/strict";

import { createLoginController } from "../controllers/auth.controller.js";
import { AppError } from "../utils/AppError.js";


// Simulate a Vercel HTTP response
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

// TEST 1: Successful login
test("returns HTTP 200 for valid login", async () => {
  const loginController = createLoginController(async (data) => {
    assert.equal(data.email, "test@example.com");

    return {
      user: {
        id: 1,
        email: data.email,
        role: "CUSTOMER",
      },
      accessToken: "mock.signed.access-token",
    };
  });

  const req = {
    body: {
      email: " TEST@EXAMPLE.COM ",
      password: "correct-password",
    },
  };

  const res = createMockResponse();

  await loginController(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.id, 1);
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal("passwordHash" in res.body.data.user, false);
  assert.equal(
    res.body.data.accessToken,
    "mock.signed.access-token"
  );

});

// TEST 2: Invalid email
test("rejects an invalid login email", async () => {
  const loginController = createLoginController(async () => {
    throw new Error("Authentication should not run");
  });

  const req = {
    body: {
      email: "invalid-email",
      password: "password123",
    },
  };

  await assert.rejects(
    loginController(req, createMockResponse()),
    { statusCode: 400 }
  );
});

// TEST 3: Missing password
test("rejects an empty login password", async () => {
  const loginController = createLoginController(async () => {
    throw new Error("Authentication should not run");
  });

  const req = {
    body: {
      email: "test@example.com",
      password: "",
    },
  };

  await assert.rejects(
    loginController(req, createMockResponse()),
    { statusCode: 400 }
  );
});

// TEST 4: Incorrect credentials
test("rejects invalid credentials", async () => {
  const loginController = createLoginController(async () => {
    throw new AppError("Invalid email or password", 401);
  });

  const req = {
    body: {
      email: "test@example.com",
      password: "wrong-password",
    },
  };

  await assert.rejects(
    loginController(req, createMockResponse()),
    {
      statusCode: 401,
      message: "Invalid email or password",
    }
  );
});
