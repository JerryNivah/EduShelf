import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmailVerificationService,
} from "../services/emailVerification.service.js";

import {
  hashEmailOtp,
  verifyEmailOtpHash,
} from "../utils/emailOtp.js";

const secret = "a".repeat(64);

function setup() {
  const state = {
    user: {
      id: 7,
      email: "customer@example.com",
      emailVerifiedAt: null,
    },
    challenge: null,
    sent: [],
  };

  let timestamp = Date.parse("2026-10-26T08:00:00Z");

  const tx = {
    async $queryRaw(_sql, email) {
      return email === state.user.email
        ? [state.user]
        : [];
    },

    emailVerificationCode: {
      async findUnique() {
        return state.challenge;
      },

      async upsert({ create, update }) {
        state.challenge = state.challenge
          ? { ...state.challenge, ...update }
          : { ...create };
        return state.challenge;
      },

      async update({ data }) {
        state.challenge.attempts +=
          data.attempts.increment;
      },

      async delete() {
        state.challenge = null;
      },
    },

    user: {
      async update({ data }) {
        state.user.emailVerifiedAt =
          data.emailVerifiedAt;
      },
    },
  };

  const service = createEmailVerificationService({
    db: {
      $transaction: async (callback) => callback(tx),
    },

    generateCode: () => "123456",

    hashCode: (userId, code) =>
      hashEmailOtp(secret, userId, code),

    matchesCode: (userId, code, hash) =>
      verifyEmailOtpHash(
        secret,
        userId,
        code,
        hash
      ),

    sendCode: async (delivery) => {
      state.sent.push(delivery);
    },

    now: () => new Date(timestamp),
  });

  return {
    state,
    service,
    advance: (milliseconds) => {
      timestamp += milliseconds;
    },
  };
}

test("issues and stores a hashed OTP", async () => {
  const { state, service } = setup();

  await service.requestCode({
    email: "customer@example.com",
  });

  assert.equal(state.sent.length, 1);
  assert.equal(state.sent[0].code, "123456");
  assert.equal(state.challenge.attempts, 0);
  assert.notEqual(
    state.challenge.codeHash,
    "123456"
  );
});

test("verifies once and marks the email verified", async () => {
  const { state, service } = setup();

  await service.requestCode({
    email: "customer@example.com",
  });

  assert.equal(
    await service.verifyCode({
      email: "customer@example.com",
      code: "123456",
    }),
    true
  );

  assert.ok(state.user.emailVerifiedAt);
  assert.equal(state.challenge, null);

  assert.equal(
    await service.verifyCode({
      email: "customer@example.com",
      code: "123456",
    }),
    false
  );
});

test("wrong codes consume attempts", async () => {
  const { state, service } = setup();

  await service.requestCode({
    email: "customer@example.com",
  });

  for (let i = 0; i < 5; i++) {
    assert.equal(
      await service.verifyCode({
        email: "customer@example.com",
        code: "999999",
      }),
      false
    );
  }

  assert.equal(state.challenge.attempts, 5);

  assert.equal(
    await service.verifyCode({
      email: "customer@example.com",
      code: "123456",
    }),
    false
  );
});

test("enforces resend cooldown and hourly limit", async () => {
  const { state, service, advance } = setup();

  for (let i = 0; i < 5; i++) {
    await service.requestCode({
      email: "customer@example.com",
    });

    advance(60_000);
  }

  assert.equal(state.sent.length, 5);

  await service.requestCode({
    email: "customer@example.com",
  });

  assert.equal(state.sent.length, 5);

  advance(60 * 60_000);

  await service.requestCode({
    email: "customer@example.com",
  });

  assert.equal(state.sent.length, 6);
});