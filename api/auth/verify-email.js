import {
  verifyEmailVerificationCode,
} from "../../server/services/emailVerification.service.js";

import {
  verifyEmailSchema,
} from "../../server/validations/auth.validation.js";

import {
  validate,
} from "../../server/middleware/validate.js";

import {
  handleError,
} from "../../server/middleware/errorHandler.js";

import {
  AppError,
} from "../../server/utils/AppError.js";

import { env } from "../../server/config/env.js";

import {
  createConfiguredOriginGuard,
} from "../../server/config/trustedOriginGuard.js";

import {
  createAuthRateLimitGuard,
} from "../../server/middleware/authRateLimit.js";

export function createVerifyEmailHandler(
  verifyCode,
  originGuard = (req) =>
    createConfiguredOriginGuard(env)(req),
  rateLimitGuard = async () => {}
) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    try {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        throw new AppError("Method not allowed", 405);
      }

      originGuard(req);
      await rateLimitGuard(req, res);

      const { email, code } = validate(
        verifyEmailSchema,
        req.body
      );

      const verified = await verifyCode({
        email,
        code,
      });

      if (!verified) {
        throw new AppError(
          "Invalid or expired verification code",
          400
        );
      }

      return res.status(200).json({
        success: true,
        message: "Email verified successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  };
}

export default createVerifyEmailHandler(
  verifyEmailVerificationCode,
  undefined,
  createAuthRateLimitGuard({
    scope: "verify-email-ip",
    limit: 10,
    windowMs: 15 * 60 * 1000,
  })
);