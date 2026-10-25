import {
  refreshController,
} from "../../server/controllers/refresh.controller.js";

import { handleError } from "../../server/middleware/errorHandler.js";

import { AppError } from "../../server/utils/AppError.js";

import { env } from "../../server/config/env.js";

import {
  createConfiguredOriginGuard,
} from "../../server/config/trustedOriginGuard.js";

export function createRefreshHandler(
  controller,
originGuard = (req) => createConfiguredOriginGuard(env)(req)) {
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
      return await controller(req, res);

    } catch (error) {
      // Convert errors into standard HTTP responses
      return handleError(error, res);
    }
  };
}

// Production handler uses the real login controller
export default createRefreshHandler(refreshController);
