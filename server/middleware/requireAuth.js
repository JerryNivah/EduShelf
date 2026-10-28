import {
  verifyAccessToken,
} from "../utils/accessToken.js";

import {
  findUserForAuthById,
} from "../repositories/user.repository.js";

import { AppError } from "../utils/AppError.js";

export function createRequireAuth({
  verifyToken = verifyAccessToken,
  findUser = findUserForAuthById,
} = {}) {
  return async function authenticate(req) {
    const authorization = req.headers?.authorization;

    // Accept one well-formed Bearer credential.
    const match =
      typeof authorization === "string"
        ? /^Bearer ([^\s,]+)$/i.exec(authorization)
        : null;

    if (!match) {
      throw new AppError(
        "Authentication required",
        401
      );
    }

    let identity;

    try {
      identity = await verifyToken(match[1]);
    } catch {
      throw new AppError(
        "Invalid or expired access token",
        401
      );
    }

    const userId = identity?.userId;

    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      throw new AppError(
        "Invalid access token",
        401
      );
    }

    // Database failures must propagate rather than
    // being incorrectly classified as invalid JWTs.
    const user = await findUser(userId);

    if (!user) {
      throw new AppError(
        "Authentication required",
        401
      );
    }
    // Prevents unverified accounts from using an access JWT that was issued before we introduced email verification.
    if (
      user.email &&
      !(user.emailVerifiedAt instanceof Date)
    ) {
      throw new AppError(
        "Email verification required",
        403
      );
    }
    // Trusted server-side identity for downstream code.
    req.auth = {
      userId: user.id,
      role: user.role,
    };

    req.user = user;

    return user;
  };
}

export const requireAuth = createRequireAuth();