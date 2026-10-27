import {
  registerController,
} from "../../server/controllers/auth.controller.js";

import {
  handleError,
} from "../../server/middleware/errorHandler.js";

import {
  AppError,
} from "../../server/utils/AppError.js";

import {
  createConfiguredOriginGuard,
} from "../../server/config/trustedOriginGuard.js";

import { env } from "../../server/config/env.js";

export function createRegisterHandler(
  controller = registerController,
  originGuard = (req) =>
    createConfiguredOriginGuard(env)(req)
) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    try {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        throw new AppError("Method not allowed", 405);
      }

      originGuard(req);

      return await controller(req, res);
    } catch (error) {
      return handleError(error, res);
    }
  };
}

export default createRegisterHandler();