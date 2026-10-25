
import test from "node:test";
import assert from "node:assert/strict";

import { registerSchema } from "../validations/auth.validation.js";

// Test 1: Valid registration data
test("accepts and normalizes valid registration data", () => {
  const input = {
    firstName: "  Jane  ",
    lastName: "  Doe  ",
    email: "  JANE@EXAMPLE.COM  ",
    password: "SecurePass123!",
  };

  const result = registerSchema.safeParse(input);

  assert.equal(result.success, true);

  assert.equal(result.data.firstName, "Jane");
  assert.equal(result.data.lastName, "Doe");
  assert.equal(result.data.email, "jane@example.com");
});

// Test 2: Invalid registration data
test("rejects invalid registration data", () => {
  const input = {
    firstName: "J",
    lastName: "Doe",
    email: "invalid-email",
    password: "123",
  };

  const result = registerSchema.safeParse(input);

  assert.equal(result.success, false);

  const fields = result.error.issues.map(
    (issue) => issue.path[0]
  );

  assert.ok(fields.includes("firstName"));
  assert.ok(fields.includes("email"));
  assert.ok(fields.includes("password"));
});
