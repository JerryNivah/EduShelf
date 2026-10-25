import { randomBytes, createHash } from "node:crypto";

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// Generate a cryptographically secure opaque refresh token
export function generateRefreshToken() {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

// Hash the refresh token before database storage or lookup
export function hashRefreshToken(token) {
  if (
    typeof token !== "string" ||
    !REFRESH_TOKEN_PATTERN.test(token)
  ) {
    throw new TypeError("Invalid refresh token");
  }

  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

// Generate the raw token and its database hash together
export function generateRefreshTokenPair() {
  const token = generateRefreshToken();

  return {
    token,
    tokenHash: hashRefreshToken(token),
  };
}