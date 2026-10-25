import {
  requireAuth,
} from "../../server/middleware/requireAuth.js";

import {
  handleError,
} from "../../server/middleware/errorHandler.js";

import {
  AppError,
} from "../../server/utils/AppError.js";

export function createMeHandler(
  authenticate = requireAuth
) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    try {
      if (req.method !== "GET") {
        res.setHeader("Allow", "GET");

        throw new AppError(
          "Method not allowed",
          405
        );
      }

      await authenticate(req);

      const {
        id,
        firstName,
        lastName,
        email,
        role,
      } = req.user;

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id,
            firstName,
            lastName,
            email,
            role,
          },
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  };
}

export default createMeHandler();