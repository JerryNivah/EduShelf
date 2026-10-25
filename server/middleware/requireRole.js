import { AppError } from "../utils/AppError.js";

const VALID_ROLES = new Set([
  "CUSTOMER",
  "ADMIN",
]);

export function requireRole(...allowedRoles) {
  if (
    allowedRoles.length === 0 ||
    allowedRoles.some(
      (role) => !VALID_ROLES.has(role)
    )
  ) {
    throw new TypeError(
      "At least one valid role is required"
    );
  }

  return function authorize(req) {
    if (!req.auth?.userId) {
      throw new AppError(
        "Authentication required",
        401
      );
    }

    if (!allowedRoles.includes(req.auth.role)) {
      throw new AppError(
        "Forbidden",
        403
      );
    }

    return req.auth;
  };
}