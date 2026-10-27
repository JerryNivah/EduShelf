
import { signAccessToken } from "../utils/accessToken.js";

import { AppError } from "../utils/AppError.js";

import {
  hashPassword,
  verifyPassword,
} from "../utils/password.js";

import {
  findUserIdByEmail,
  findUserByEmail,
  createUser,
} from "../repositories/user.repository.js";

import {
  issueInitialRefreshToken,
} from "./refreshSession.service.js";

// Factory for creating the registration service
export function createAuthService(dependencies) {
  const {
    findUserIdByEmail,
    createUser,
    hashPassword,
  } = dependencies;

  return async function registerUser(data) {
    const {
      firstName,
      lastName,
      email,
      password,
    } = data;

    // 1. Check for an existing email
    const existingUser = await findUserIdByEmail(email);

    if (existingUser) {
      throw new AppError("Email already registered", 409);
    }

    // 2. Hash the password
    const passwordHash = await hashPassword(password);

    // 3. Create the user
    try {
      return await createUser({
        firstName,
        lastName,
        email,
        passwordHash,
      });
    } catch (error) {
      if (error.code === "P2002") {
        throw new AppError("Email already registered", 409);
      }

      throw error;
    }
  };
}

// Production implementation
export const registerUser = createAuthService({
  findUserIdByEmail,
  createUser,
  hashPassword,
});

// Factory for creating the login service
export function createLoginService(dependencies) {
  const {
    findUserByEmail,
    verifyPassword,
  } = dependencies;

  return async function loginUser({ email, password }) {
    // 1. Find the user
    const user = await findUserByEmail(email);

    // 2. Reject missing users or accounts without passwords
    if (!user || !user.passwordHash) {
      throw new AppError("Invalid email or password", 401);
    }

    // 3. Verify the submitted password
    const isValid = await verifyPassword(
      password,
      user.passwordHash
    );

    if (!isValid) {
      throw new AppError("Invalid email or password", 401);
    }

    if (
      user.email &&
      !(user.emailVerifiedAt instanceof Date)
    ) {
      throw new AppError(
        "Email verification required",
        403
      );
    }

    // 4. Return only safe user information
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    };
  };
}
// Production implementation
export const loginUser = createLoginService({
  findUserByEmail,
  verifyPassword,
});

// Factory for login with access token issuance
export function createTokenLoginService(dependencies) {
  const {
    authenticate,
    signAccessToken,
  } = dependencies;

  return async function loginWithAccessToken(credentials) {
    // 1. Verify credentials using the existing login service
    const user = await authenticate(credentials);

    // 2. Issue a token only after successful authentication
    const accessToken = await signAccessToken(user.id);

    // 3. Return safe user details and the access token
    return {
      user,
      accessToken,
    };
  };
}

// Production implementation
export const loginWithAccessToken = createTokenLoginService({
  authenticate: loginUser,
  signAccessToken,
});
// Factory for login with access and refresh tokens
export function createSessionLoginService(dependencies) {
  const {
    loginWithAccessToken,
    issueInitialRefreshToken,
  } = dependencies;

  return async function loginWithSession(credentials) {

    // 1. Authenticate and generate access JWT
    const { user, accessToken } =
      await loginWithAccessToken(credentials);

    // 2. Create and persist the initial refresh session
    const {
      refreshToken,
      expiresAt,
    } = await issueInitialRefreshToken({
      userId: user.id,
    });

    // 3. Return tokens for controller-level handling
    return {
      user,
      accessToken,
      refreshToken,
      refreshExpiresAt: expiresAt,
    };
  };
}
// Production login with access and refresh tokens
export const loginWithSession = createSessionLoginService({
  loginWithAccessToken,
  issueInitialRefreshToken,
});