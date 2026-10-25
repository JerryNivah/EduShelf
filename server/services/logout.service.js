import {
  findRefreshSessionByTokenHash,
  revokeRefreshSessionFamily,
} from "../repositories/refreshSession.repository.js";

import {
  hashRefreshToken,
} from "../utils/refreshToken.js";

export function createLogoutSessionService({
  findSession,
  revokeFamily,
  hashToken,
  now = () => new Date(),
}) {
  return async function logoutSession({ refreshToken }) {
    // Missing or malformed credentials cannot revoke anything.
    if (
      typeof refreshToken !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(refreshToken)
    ) {
      return false;
    }

    // Look up the stored hash, never the raw token.
    const tokenHash = hashToken(refreshToken);
    const session = await findSession(tokenHash);

    // Only a currently usable session can initiate logout.
    if (
      !session ||
      session.usedAt != null ||
      session.revokedAt != null ||
      !(session.expiresAt instanceof Date) ||
      session.expiresAt <= now()
    ) {
      return false;
    }

    // Revoke the entire family atomically.
    const revokedCount = await revokeFamily({
      familyId: session.familyId,
    });

    return revokedCount > 0;
  };
}

// Production dependencies
export const logoutSession = createLogoutSessionService({
  findSession: findRefreshSessionByTokenHash,
  revokeFamily: revokeRefreshSessionFamily,
  hashToken: hashRefreshToken,
});
