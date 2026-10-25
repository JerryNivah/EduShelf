export const REFRESH_COOKIE_NAME = "edushelf_refresh";

const COOKIE_PATH = "/api/auth";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// Serialize a secure refresh-token cookie
export function serializeRefreshCookie({
  refreshToken,
  expiresAt,
  secure,
  nowMs = Date.now(),
}) {
  if (
    typeof refreshToken !== "string" ||
    !TOKEN_PATTERN.test(refreshToken)
  ) {
    throw new TypeError("Invalid refresh token");
  }

  if (
    !(expiresAt instanceof Date) ||
    !Number.isFinite(expiresAt.getTime()) ||
    !Number.isFinite(nowMs)
  ) {
    throw new TypeError("Invalid cookie expiration");
  }

  if (typeof secure !== "boolean") {
    throw new TypeError("Cookie security mode is required");
  }

  const maxAge = Math.floor(
    (expiresAt.getTime() - nowMs) / 1000
  );

  if (maxAge <= 0) {
    throw new RangeError("Refresh token already expired");
  }

  return [
    `${REFRESH_COOKIE_NAME}=${refreshToken}`,
    `Path=${COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    `Expires=${expiresAt.toUTCString()}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

// Remove the cookie during logout or invalidation
export function serializeClearRefreshCookie({
  secure,
}) {
  if (typeof secure !== "boolean") {
    throw new TypeError("Cookie security mode is required");
  }

  return [
    `${REFRESH_COOKIE_NAME}=`,
    `Path=${COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
// Extract the refresh token from an incoming Cookie header
export function parseRefreshCookie(cookieHeader) {
  if (
    typeof cookieHeader !== "string" ||
    cookieHeader.length === 0
  ) {
    return null;
  }

  let refreshToken = null;

  for (const item of cookieHeader.split(";")) {
    const part = item.trim();
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();

    if (name !== REFRESH_COOKIE_NAME) {
      continue;
    }

    // Reject duplicate refresh cookies
    if (refreshToken !== null) {
      return null;
    }

    const value = part.slice(separatorIndex + 1).trim();

    // Refresh tokens use our 43-character Base64URL format
    if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
      return null;
    }

    refreshToken = value;
  }

  return refreshToken;
}