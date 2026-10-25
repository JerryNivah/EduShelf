import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateRefreshExpiry,
} from "../utils/refreshPolicy.js";

const DAY = 24 * 60 * 60 * 1000;
const createdAt = new Date("2026-10-21T00:00:00Z");

// TEST 1
test("allows normal seven-day refresh expiry", () => {
  const nowMs = createdAt.getTime() + 5 * DAY;

  const result = calculateRefreshExpiry({
    familyCreatedAt: createdAt,
    nowMs,
  });

  assert.equal(
    result.getTime(),
    createdAt.getTime() + 12 * DAY
  );
});

// TEST 2
test("caps refresh expiry at family deadline", () => {
  const nowMs = createdAt.getTime() + 27 * DAY;

  const result = calculateRefreshExpiry({
    familyCreatedAt: createdAt,
    nowMs,
  });

  assert.equal(
    result.getTime(),
    createdAt.getTime() + 30 * DAY
  );
});

// TEST 3
test("rejects refresh at absolute family expiry", () => {
  const nowMs = createdAt.getTime() + 30 * DAY;

  const result = calculateRefreshExpiry({
    familyCreatedAt: createdAt,
    nowMs,
  });

  assert.equal(result, null);
});

// TEST 4
test("rejects refresh after family expiry", () => {
  const nowMs = createdAt.getTime() + 31 * DAY;

  const result = calculateRefreshExpiry({
    familyCreatedAt: createdAt,
    nowMs,
  });

  assert.equal(result, null);
});

// TEST 5
test("rejects invalid family timestamps", () => {
  assert.throws(
    () => calculateRefreshExpiry({
      familyCreatedAt: new Date("invalid"),
    }),
    TypeError
  );
});