
import test from "node:test";
import assert from "node:assert/strict";

import {
  hashPassword,
  verifyPassword,
} from "../utils/password.js";

test("hashes passwords securely", async () => {
  const password = "SecurePass123!";

  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(typeof hash, "string");
});

test("verifies correct passwords", async () => {
  const password = "SecurePass123!";

  const hash = await hashPassword(password);

  const isValid = await verifyPassword(
    password,
    hash
  );

  assert.equal(isValid, true);
});

test("rejects incorrect passwords", async () => {
  const hash = await hashPassword("SecurePass123!");

  const isValid = await verifyPassword(
    "WrongPassword123!",
    hash
  );

  assert.equal(isValid, false);
});
