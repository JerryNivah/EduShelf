import {
  requestEmailVerificationCode,
} from "../../server/services/emailVerification.service.js";

import {
  verificationEmailSchema,
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

export function createResendVerificationHandler(
  requestCode,
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

      const { email } = validate(
        verificationEmailSchema,
        req.body
      );

      await requestCode({ email });

      return res.status(200).json({
        success: true,
        message:
          "If email verification is needed, a code will be sent.",
      });
    } catch (error) {
      return handleError(error, res);
    }
  };
}

export default createResendVerificationHandler(
  requestEmailVerificationCode,
  undefined,
  createAuthRateLimitGuard({
    scope: "resend-verification-ip",
    limit: 5,
    windowMs: 60 * 60 * 1000,
  })
);