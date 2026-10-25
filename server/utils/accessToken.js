
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const ALGORITHM = "HS256";
const ISSUER = "edushelf";
const AUDIENCE = "edushelf-api";
const ACCESS_TOKEN_EXPIRY = "15m";

// Factory enables isolated unit testing
export function createAccessTokenService(secret) {
  const key = new TextEncoder().encode(secret);

  // Generate a signed access token
  async function signAccessToken(userId) {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new TypeError("Invalid user ID");
    }

    return new SignJWT({ tokenUse: "access" })
      .setProtectedHeader({
        alg: ALGORITHM,
        typ: "JWT",
      })
      .setSubject(String(userId))
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .sign(key);
  }

  // Verify an incoming access token
  async function verifyAccessToken(token) {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
      typ: "JWT",
      requiredClaims: ["sub", "iat", "exp"],
    });

    const userId = Number(payload.sub);

    if (
      payload.tokenUse !== "access" ||
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      String(userId) !== payload.sub
    ) {
      throw new Error("Invalid access token");
    }

    return { userId };
  }

  return {
    signAccessToken,
    verifyAccessToken,
  };
}

// Production implementation
export const {
  signAccessToken,
  verifyAccessToken,
} = createAccessTokenService(env.JWT_SECRET);
