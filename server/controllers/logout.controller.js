import {
  parseRefreshCookie,
  serializeClearRefreshCookie,
} from "../utils/refreshCookie.js";

import {
  logoutSession,
} from "../services/logout.service.js";

export function createLogoutController(
  logout,
  { secureCookies = true } = {}
) {
  return async function logoutController(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // Read the refresh credential from the HttpOnly cookie.
    const refreshToken = parseRefreshCookie(
      req.headers?.cookie
    );

    // Missing or malformed cookies are treated as
    // already logged-out sessions.
    if (refreshToken) {
      await logout({ refreshToken });
    }

    // Clear the browser cookie after successful processing.
    res.setHeader(
      "Set-Cookie",
      serializeClearRefreshCookie({
        secure: secureCookies,
      })
    );

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  };
}

const secureCookies =
  process.env.VERCEL_ENV === "production" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.NODE_ENV === "production";

export const logoutController = createLogoutController(
  logoutSession,
  { secureCookies }
);