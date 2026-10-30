
import { sessionLoginController,

 } from "../../server/controllers/auth.controller.js";

import { handleError } from "../../server/middleware/errorHandler.js";

import { AppError } from "../../server/utils/AppError.js";

import { env } from "../../server/config/env.js";

import {
  createConfiguredOriginGuard,
} from "../../server/config/trustedOriginGuard.js";
import {
  createAuthRateLimitGuard,
} from "../../server/middleware/authRateLimit.js";

export function createLoginHandler(
  controller = sessionLoginController,
  originGuard = (req) =>
    createConfiguredOriginGuard(env)(req),
  rateLimitGuard = async () => {}
) {
  return async function handler(req, res) {
    // Never cache authentication responses
    res.setHeader("Cache-Control", "no-store");

    try {
      // Only allow POST requests
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");

        throw new AppError("Method not allowed", 405);
      }
      // Validate the origin before authenticating
      originGuard(req);
      // Delegate to the injected controller
      await rateLimitGuard(req, res);
      return await controller(req, res);

    } catch (error) {
      // Convert errors into standard HTTP responses
      return handleError(error, res);
    }
  };
}

// Production handler uses the real login controller
export default createLoginHandler(
  sessionLoginController,
  undefined,
  createAuthRateLimitGuard({
    scope: "login-ip",
    limit: 10,
    windowMs: 15 * 60 * 1000,
  })
);