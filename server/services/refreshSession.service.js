import { findRefreshSessionByTokenHash }
  from "../repositories/refreshSession.repository.js";
import {
    rotateRefreshSession,
    revokeFamilyIfTokenReplayed,
    revokeRefreshSessionFamily,
    createRefreshSessionFamilyWithSession,
  } from "../repositories/refreshSession.repository.js";
  import { randomUUID } from "node:crypto";

  import {
    generateRefreshTokenPair,
    hashRefreshToken,
  } from "../utils/refreshToken.js";
  import {
    signAccessToken,
  } from "../utils/accessToken.js";

export function classifyRefreshSession(
  session,
  now = new Date()
) {
  if (!session) {
    return "UNKNOWN";
  }

  if (session.revokedAt !== null) {
    return "REVOKED";
  }

  if (session.usedAt !== null) {
    return "USED";
  }

  if (session.expiresAt <= now) {
    return "EXPIRED";
  }
  return "ACTIVE";
}
export async function inspectRefreshSession(
  tokenHash,
  {
    findSession = findRefreshSessionByTokenHash,
    now = new Date(),
  } = {}
) {
  const session = await findSession(tokenHash);

  return {
    status: classifyRefreshSession(session, now),
    session,
  };
}
export async function rotateOrHandleRefreshReplay(
  { currentTokenHash, nextTokenHash, expiresAt },
  {
    rotate = rotateRefreshSession,
    checkReplay = revokeFamilyIfTokenReplayed,
  } = {}
) {
  const session = await rotate({
    currentTokenHash,
    nextTokenHash,
    expiresAt,
  });

  if (session) {
    return {
      status: "ROTATED",
      session,
    };
  }

  const replay = await checkReplay({
    tokenHash: currentTokenHash,
  });

  return {
    status: replay.replayDetected
      ? "REPLAY_DETECTED"
      : "INVALID",
    session: null,
  };
}
const REFRESH_TOKEN_LIFETIME_MS =
  7 * 24 * 60 * 60 * 1000;

export async function issueInitialRefreshToken(
  { userId },
  {
    createSession = createRefreshSessionFamilyWithSession,
    generatePair = generateRefreshTokenPair,
    generateFamilyId = randomUUID,
    now = () => Date.now(),
  } = {}
) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError("Invalid user ID");
  }

  const familyId = generateFamilyId();

  const { token, tokenHash } = generatePair();

  const expiresAt = new Date(
    now() + REFRESH_TOKEN_LIFETIME_MS
  );

  // Database transaction must succeed before issuance
  const result = await createSession({
    userId,
    familyId,
    tokenHash,
    expiresAt,
  });
  
  const persistedExpiresAt = result?.session?.expiresAt;
  
  if (
    !(persistedExpiresAt instanceof Date) ||
    !Number.isFinite(persistedExpiresAt.getTime())
  ) {
    throw new TypeError("Invalid persisted refresh expiry");
  }
  
  return {
    refreshToken: token,
    familyId,
    expiresAt: persistedExpiresAt,
  };
}
export async function rotateRawRefreshToken(
  { refreshToken },
  {
    rotate = rotateOrHandleRefreshReplay,
    generatePair = generateRefreshTokenPair,
    now = () => Date.now(),
  } = {}
) {
  let currentTokenHash;

  // 1. Validate and hash the incoming token
  try {
    currentTokenHash = hashRefreshToken(refreshToken);
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message === "Invalid refresh token"
    ) {
      return {
        status: "INVALID",
        refreshToken: null,
        expiresAt: null,
      };
    }

    throw error;
  }

  // 2. Generate the candidate replacement
  const { token, tokenHash } = generatePair();

  const expiresAt = new Date(
    now() + REFRESH_TOKEN_LIFETIME_MS
  );

  // 3. Rotate through the existing secure service
  const result = await rotate({
    currentTokenHash,
    nextTokenHash: tokenHash,
    expiresAt,
  });

  // 4. Never expose a replacement if rotation failed
  if (result.status !== "ROTATED") {
    return {
      status: result.status,
      refreshToken: null,
      expiresAt: null,
    };
  }

  return {
    status: "ROTATED",
    userId: result.session.userId,
    familyId: result.session.familyId,
    refreshToken: token,
    expiresAt: result.session.expiresAt,
  };
}
// Factory for refreshing both authentication tokens
export function createRefreshAccessService(dependencies) {
  const {
    rotateRawRefreshToken,
    signAccessToken,
    revokeFamily,
  } = dependencies;

  return async function refreshAccessSession({ refreshToken }) {
    // 1. Rotate the incoming refresh token
    const rotation = await rotateRawRefreshToken({
      refreshToken,
    });

    // 2. Reject invalid or replayed tokens
    if (rotation.status !== "ROTATED") {
      return {
        status: rotation.status,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      };
    }

    // 3. Generate the new access JWT
let accessToken;

try {
  accessToken = await signAccessToken(rotation.userId);
} catch (signingError) {
  // Rotation already committed. Revoke the family
  // so the undelivered replacement cannot remain active.
  try {
    await revokeFamily({
      familyId: rotation.familyId,
    });
  } catch (revocationError) {
    // Preserve both failures for investigation.
    throw new AggregateError(
      [signingError, revocationError],
      "JWT signing and refresh-family revocation failed"
    );
  }

  // Preserve the original signing failure.
  throw signingError;
}

    // 4. Return credentials for controller-level delivery
    return {
      status: "ROTATED",
      accessToken,
      refreshToken: rotation.refreshToken,
      familyId: rotation.familyId,
      expiresAt: rotation.expiresAt,
    };
  };
}
// Production implementation for access-token renewal
export const refreshAccessSession = createRefreshAccessService({
  rotateRawRefreshToken,
  signAccessToken,
  revokeFamily: revokeRefreshSessionFamily,
});