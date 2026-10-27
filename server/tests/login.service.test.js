
import test from "node:test";
import assert from "node:assert/strict";

import { createLoginService } from "../services/auth.service.js";

// Fake database user for testing
const mockUser = {
  id: 1,
  firstName: "Integration",
  lastName: "Tester",
  email: "test@example.com",
  role: "CUSTOMER",
  passwordHash: "hashed-password",
  emailVerifiedAt: new Date("2026-10-01T00:00:00Z"),
};

const credentials = {
  email: "test@example.com",
  password: "correct-password",
};

// TEST 1: Successful login
test("logs in a user with valid credentials", async () => {
  const login = createLoginService({
    findUserByEmail: async () => mockUser,

    verifyPassword: async (password, hash) => {
      assert.equal(password, credentials.password);
      assert.equal(hash, mockUser.passwordHash);
      return true;
    },
  });

  const user = await login(credentials);

  assert.equal(user.id, 1);
  assert.equal(user.email, "test@example.com");
  assert.equal(user.role, "CUSTOMER");

  // Password hashes must never be returned
  assert.equal("passwordHash" in user, false);
});

// TEST 2: Incorrect password
test("rejects an incorrect password", async () => {
  const login = createLoginService({
    findUserByEmail: async () => mockUser,
    verifyPassword: async () => false,
  });

  await assert.rejects(
    login({
      email: "test@example.com",
      password: "wrong-password",
    }),
    {
      statusCode: 401,
      message: "Invalid email or password",
    }
  );
});

// TEST 3: Unknown email
test("rejects an unknown email", async () => {
  const login = createLoginService({
    findUserByEmail: async () => null,

    verifyPassword: async () => {
      throw new Error("Password verification should not run");
    },
  });

  await assert.rejects(
    login(credentials),
    {
      statusCode: 401,
      message: "Invalid email or password",
    }
  );
});

// TEST 4: Account without a password
test("rejects an account without a password hash", async () => {
  const login = createLoginService({
    findUserByEmail: async () => ({
      ...mockUser,
      passwordHash: null,
    }),

    verifyPassword: async () => {
      throw new Error("Password verification should not run");
    },
  });

  await assert.rejects(
    login(credentials),
    {
      statusCode: 401,
      message: "Invalid email or password",
    }
  );
});
test("rejects unverified email after a correct password", async () => {
  const login = createLoginService({
    findUserByEmail: async () => ({
      ...mockUser,
      emailVerifiedAt: null,
    }),

    verifyPassword: async () => true,
  });

  await assert.rejects(
    () => login(credentials),
    {
      statusCode: 403,
      message: "Email verification required",
    }
  );
});