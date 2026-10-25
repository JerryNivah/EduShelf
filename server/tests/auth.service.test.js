
import test from "node:test";
import assert from "node:assert/strict";

import { createAuthService } from "../services/auth.service.js";
import { AppError } from "../utils/AppError.js";

const validData = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  password: "SecurePass123!",
};

// TEST 1: Successful registration
test("registers a new customer successfully", async () => {
  let savedData;

  const fakeUser = {
    id: 1,
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    role: "CUSTOMER",
  };

  const registerUser = createAuthService({
    findUserIdByEmail: async () => null,

    hashPassword: async () => "hashed-password",

    createUser: async (data) => {
      savedData = data;
      return fakeUser;
    },
  });

  const result = await registerUser(validData);

  assert.deepEqual(result, fakeUser);

  assert.equal(savedData.passwordHash, "hashed-password");
  assert.equal(savedData.password, undefined);
});

// TEST 2: Duplicate email
test("rejects an already registered email", async () => {
  const registerUser = createAuthService({
    findUserIdByEmail: async () => ({ id: 1 }),

    hashPassword: async () => {
      throw new Error("Hashing should not occur");
    },

    createUser: async () => {
      throw new Error("User creation should not occur");
    },
  });

  await assert.rejects(
    registerUser(validData),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 409
  );
});

// TEST 3: Prisma unique constraint error
test("handles Prisma P2002 conflicts", async () => {
  const registerUser = createAuthService({
    findUserIdByEmail: async () => null,

    hashPassword: async () => "hashed-password",

    createUser: async () => {
      const error = new Error("Unique constraint failed");
      error.code = "P2002";
      throw error;
    },
  });

  await assert.rejects(
    registerUser(validData),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 409
  );
});
