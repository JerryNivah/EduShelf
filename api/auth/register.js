
import { registerController } from "../../server/controllers/auth.controller.js";

import { handleError } from "../../server/middleware/errorHandler.js";

import { AppError } from "../../server/utils/AppError.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");

      throw new AppError("Method not allowed", 405);
    }

    return await registerController(req, res);
  } catch (error) {
    return handleError(error, res);
  }
}
