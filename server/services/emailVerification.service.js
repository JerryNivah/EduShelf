import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

import {
  generateEmailOtp,
  hashEmailOtp,
  verifyEmailOtpHash,
} from "../utils/emailOtp.js";

import {
  sendVerificationEmail,
} from "./emailDelivery.service.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const OTP_LIFETIME = 10 * MINUTE;

export function createEmailVerificationService({
  db,
  generateCode,
  hashCode,
  matchesCode,
  sendCode,
  now = () => new Date(),
}) {
  async function requestCode({ email }) {
    const delivery = await db.$transaction(async (tx) => {
      // Serialize OTP operations for this user.
      const users = await tx.$queryRaw`
        SELECT "id", "email", "emailVerifiedAt"
        FROM "User"
        WHERE "email" = ${email}
        FOR UPDATE
      `;

      const user = users[0];

      // Use a generic response to avoid account enumeration.
      if (!user || user.emailVerifiedAt) {
        return null;
      }

      const current = now();

      const previous =
        await tx.emailVerificationCode.findUnique({
          where: { userId: user.id },
        });

      if (
        previous &&
        current.getTime() - previous.lastSentAt.getTime()
          < MINUTE
      ) {
        return null;
      }

      const sameWindow =
        previous &&
        current.getTime() -
          previous.windowStartedAt.getTime() < HOUR;

      if (sameWindow && previous.sentCount >= 5) {
        return null;
      }

      const code = generateCode();
      const codeHash = hashCode(user.id, code);

      const challenge = {
        codeHash,
        expiresAt: new Date(
          current.getTime() + OTP_LIFETIME
        ),
        attempts: 0,
        lastSentAt: current,
        sentCount: sameWindow
          ? previous.sentCount + 1
          : 1,
        windowStartedAt: sameWindow
          ? previous.windowStartedAt
          : current,
      };

      await tx.emailVerificationCode.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          ...challenge,
        },
        update: challenge,
      });

      return {
        to: user.email,
        code,
      };
    });

    // Never call external email APIs inside a DB transaction.
    if (delivery) {
      await sendCode(delivery);
    }

    return { accepted: true };
  }

  async function verifyCode({ email, code }) {
    return db.$transaction(async (tx) => {
      const users = await tx.$queryRaw`
        SELECT "id", "emailVerifiedAt"
        FROM "User"
        WHERE "email" = ${email}
        FOR UPDATE
      `;

      const user = users[0];

      if (!user || user.emailVerifiedAt) {
        return false;
      }

      const challenge =
        await tx.emailVerificationCode.findUnique({
          where: { userId: user.id },
        });

      const current = now();

      if (
        !challenge ||
        challenge.expiresAt <= current ||
        challenge.attempts >= 5
      ) {
        return false;
      }

      const valid = matchesCode(
        user.id,
        code,
        challenge.codeHash
      );

      if (!valid) {
        // Persist the failed attempt without throwing
        // inside the transaction.
        await tx.emailVerificationCode.update({
          where: { userId: user.id },
          data: {
            attempts: { increment: 1 },
          },
        });

        return false;
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: current,
        },
      });

      // A verified code cannot be reused.
      await tx.emailVerificationCode.delete({
        where: { userId: user.id },
      });

      return true;
    });
  }

  return {
    requestCode,
    verifyCode,
  };
}
const productionVerificationService =
  createEmailVerificationService({
    db: prisma,

    generateCode: generateEmailOtp,

    hashCode: (userId, code) =>
      hashEmailOtp(
        env.EMAIL_OTP_SECRET,
        userId,
        code
      ),

    matchesCode: (userId, code, storedHash) =>
      verifyEmailOtpHash(
        env.EMAIL_OTP_SECRET,
        userId,
        code,
        storedHash
      ),

    sendCode: sendVerificationEmail,
  });

export const requestEmailVerificationCode =
  productionVerificationService.requestCode;

export const verifyEmailVerificationCode =
  productionVerificationService.verifyCode;