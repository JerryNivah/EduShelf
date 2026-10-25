
import { validate } from "../middleware/validate.js";

import {
  registerSchema,
  loginSchema,
} from "../validations/auth.validation.js";


import {
  registerUser,
  loginWithAccessToken,
  loginWithSession,
} from "../services/auth.service.js";
import {
  serializeRefreshCookie,
} from "../utils/refreshCookie.js";

export async function registerController(req, res) {
  // 1. Validate and normalize incoming data
  const validatedData = validate(registerSchema, req.body);

  // 2. Register the customer
  const user = await registerUser(validatedData);

  // 3. Return a successful HTTP response
  return res.status(201).json({
    success: true,
    message: "Registration successful",
    data: {
      user,
    },
  });
}


export function createLoginController(authenticate) {
  return async function loginController(req, res) {
    // 1. Validate incoming credentials
    const validatedData = validate(loginSchema, req.body);

    // 2. Authenticate using injected service
    const { user, accessToken } = await authenticate(validatedData);
    // 3. Prevent response caching
    res.setHeader("Cache-Control", "no-store");

    // 4. Send successful response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user,
        accessToken,
      },
    });
  };
}

// Real implementation used by Vercel
export const loginController = createLoginController(
  loginWithAccessToken
);
// Session-aware login controller
export function createSessionLoginController(
  authenticate,
  { secureCookies = true } = {}
) {
  return async function sessionLoginController(req, res) {
    // 1. Validate credentials
    const validatedData = validate(loginSchema, req.body);

    // 2. Authenticate and issue session tokens
    const {
      user,
      accessToken,
      refreshToken,
      refreshExpiresAt,
    } = await authenticate(validatedData);

    // 3. Prepare the refresh cookie
    const cookie = serializeRefreshCookie({
      refreshToken,
      expiresAt: refreshExpiresAt,
      secure: secureCookies,
    });

    // 4. Prevent caching
    res.setHeader("Cache-Control", "no-store");

    // 5. Set HttpOnly refresh cookie
    res.setHeader("Set-Cookie", cookie);

    // 6. Return only safe user data and access JWT
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user,
        accessToken,
      },
    });
  };
}
// Secure cookies on deployed HTTPS environments
const secureCookies =
  process.env.VERCEL_ENV === "production" ||
  process.env.VERCEL_ENV === "preview" ||
  (
    !process.env.VERCEL_ENV &&
    process.env.NODE_ENV === "production"
  );

// Production session-aware login controller
export const sessionLoginController =
  createSessionLoginController(
    loginWithSession,
    { secureCookies }
  );