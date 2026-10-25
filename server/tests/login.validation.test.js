
import test from "node:test";
import assert from "node:assert/strict";
import { loginSchema } from "../validations/auth.validation.js";

test("accepts valid login data and normalizes email", () => {
  const result = loginSchema.safeParse({
    email: " TEST@EXAMPLE.COM ",
    password: "test123",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.email, "test@example.com");
  assert.equal(result.data.password, "test123");
});

test("rejects an invalid email address", () => {
  const result = loginSchema.safeParse({
    email: "invalid-email",
    password: "test123",
  });

  assert.equal(result.success, false);

  const fields = result.error.issues.map(
    (issue) => issue.path.join(".")
  );

  assert.ok(fields.includes("email"));
});

test("rejects an empty password", () => {
  const result = loginSchema.safeParse({
    email: "test@example.com",
    password: "",
  });

  assert.equal(result.success, false);

  const fields = result.error.issues.map(
    (issue) => issue.path.join(".")
  );

  assert.ok(fields.includes("password"));
});
