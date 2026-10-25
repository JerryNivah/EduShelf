import {
  parseRefreshCookie,
  serializeRefreshCookie,
  serializeClearRefreshCookie,
} from "../utils/refreshCookie.js";

import {
  refreshAccessSession,
} from "../services/refreshSession.service.js";

import {
  revokeRefreshSessionFamily,
} from "../repositories/refreshSession.repository.js";

// Factory for refresh-controller dependency injection
export function createRefreshController(
  refreshAccess,
  {
    secureCookies = true,
    revokeFamily,
  } = {}
) {
  return async function refreshController(req, res) {
    // Never cache authentication responses
    res.setHeader("Cache-Control", "no-store");

    // Helper for rejected refresh requests
    function rejectRefresh() {
      res.setHeader(
        "Set-Cookie",
        serializeClearRefreshCookie({
          secure: secureCookies,
        })
      );

      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh session",
      });
    }

    // 1. Extract refresh token from incoming cookie
    const refreshToken = parseRefreshCookie(
      req.headers?.cookie
    );

    // 2. Reject missing or malformed cookies
    if (!refreshToken) {
      return rejectRefresh();
    }

    // 3. Rotate the token and generate a new access JWT
    const result = await refreshAccess({
      refreshToken,
    });

    // 4. Reject invalid or replayed tokens
    if (
      result.status === "INVALID" ||
      result.status === "REPLAY_DETECTED"
    ) {
      return rejectRefresh();
    }

    // Unexpected service results are programming errors
    if (result.status !== "ROTATED") {
      throw new Error("Unexpected refresh result");
    }

    // 5. Serialize the replacement refresh cookie
let cookie;

try {
  cookie = serializeRefreshCookie({
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
    secure: secureCookies,
  });
} catch (serializationError) {
  // Rotation has already committed.
  // Attempt to revoke the undelivered session family.
  try {
    await revokeFamily({
      familyId: result.familyId,
    });
  } catch (revocationError) {
    throw new AggregateError(
      [serializationError, revocationError],
      "Refresh cookie serialization and family revocation failed"
    );
  }

  // Preserve the original serialization error.
  throw serializationError;
}

// Set the replacement cookie only after serialization succeeds
res.setHeader("Set-Cookie", cookie);

    // 6. Return only the new access JWT
    return res.status(200).json({
      success: true,
      message: "Session refreshed successfully",
      data: {
        accessToken: result.accessToken,
      },
    });
  };
}
// HTTPS is used on both Vercel Preview and Production.
const secureCookies =
  process.env.VERCEL_ENV === "production" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.NODE_ENV === "production";

// Production refresh controller
export const refreshController = createRefreshController(
  refreshAccessSession,
  {
    secureCookies,
    revokeFamily: revokeRefreshSessionFamily,
  }
);