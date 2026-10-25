import { AppError } from "../utils/AppError.js";

function isValidOrigin(value) {
  try {
    const url = new URL(value);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

export function createOriginGuard(allowedOrigins) {
  if (
    !Array.isArray(allowedOrigins) ||
    allowedOrigins.length === 0 ||
    !allowedOrigins.every(isValidOrigin)
  ) {
    throw new TypeError("Invalid trusted origins configuration");
  }

  const trustedOrigins = new Set(allowedOrigins);

  return function requireTrustedOrigin(req) {
    const origin = req.headers?.origin;
    const referer = req.headers?.referer;

    let sourceOrigin = null;

    try {
      if (origin !== undefined) {
        // Never fall back to Referer if Origin is present
        if (isValidOrigin(origin)) {
          sourceOrigin = origin;
        }
      } else if (typeof referer === "string") {
        const url = new URL(referer);

        if (["http:", "https:"].includes(url.protocol)) {
          sourceOrigin = url.origin;
        }
      }
    } catch {
      // Malformed origin information is rejected below
    }

    if (
      !sourceOrigin ||
      !trustedOrigins.has(sourceOrigin)
    ) {
      throw new AppError("Forbidden request origin", 403);
    }
  };
}