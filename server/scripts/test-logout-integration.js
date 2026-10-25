import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import {
  issueInitialRefreshToken,
} from "../services/refreshSession.service.js";

import {
  hashRefreshToken,
} from "../utils/refreshToken.js";

import {
  createLogoutHandler,
} from "../../api/auth/logout.js";

import {
  logoutController,
} from "../controllers/logout.controller.js";

import {
  createRefreshHandler,
} from "../../api/auth/refresh.js";

import {
  refreshController,
} from "../controllers/refresh.controller.js";

const prisma = new PrismaClient();

const trustedOrigin = (req) => {
  assert.equal(req.headers.origin, "http://localhost:3000");
};

const logoutHandler = createLogoutHandler(
  logoutController,
  trustedOrigin
);

const refreshHandler = createRefreshHandler(
  refreshController,
  trustedOrigin
);

function createMockResponse() {
  const headers = {};

  return {
    headers,
    statusCode: null,
    body: null,

    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
      return this;
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    },
  };
}

function makeRequest(token) {
  return {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      cookie: `edushelf_refresh=${token}`,
    },
  };
}

async function main() {
  let familyId = null;

  try {
    const customer = await prisma.user.findFirst({
      where: { role: "CUSTOMER" },
      select: { id: true },
    });

    assert.ok(customer, "Development test customer required");

    // Create a real database-backed session.
    const issued = await issueInitialRefreshToken({
      userId: customer.id,
    });

    familyId = issued.familyId;

    const tokenHash = hashRefreshToken(
      issued.refreshToken
    );

    console.log("Refresh session created: PASSED");

    // Perform logout through the real HTTP handler.
    const logoutRes = createMockResponse();

    await logoutHandler(
      makeRequest(issued.refreshToken),
      logoutRes
    );

    assert.equal(logoutRes.statusCode, 200);
    assert.equal(logoutRes.body.success, true);

    assert.ok(
      logoutRes.headers["set-cookie"].includes("Max-Age=0")
    );

    console.log("HTTP logout: PASSED");

    // Verify database family revocation.
    const family =
      await prisma.refreshSessionFamily.findUnique({
        where: { id: familyId },
      });

    assert.ok(family.revokedAt instanceof Date);

    const session =
      await prisma.refreshSession.findUnique({
        where: { tokenHash },
      });

    assert.ok(session.revokedAt instanceof Date);

    console.log("Database session revocation: PASSED");

    // Attempt refresh using the revoked token.
    const refreshRes = createMockResponse();

    await refreshHandler(
      makeRequest(issued.refreshToken),
      refreshRes
    );

    assert.equal(refreshRes.statusCode, 401);
    assert.equal(refreshRes.body.success, false);

    assert.equal(
      refreshRes.body.data?.accessToken,
      undefined
    );

    console.log("Post-logout refresh rejection: PASSED");

    // Logout remains idempotent.
    const secondLogoutRes = createMockResponse();

    await logoutHandler(
      makeRequest(issued.refreshToken),
      secondLogoutRes
    );

    assert.equal(secondLogoutRes.statusCode, 200);

    const count = await prisma.refreshSession.count({
      where: { familyId },
    });

    assert.equal(count, 1);

    console.log("Repeated logout: PASSED");
  } finally {
    if (familyId) {
      await prisma.refreshSession.deleteMany({
        where: { familyId },
      });

      await prisma.refreshSessionFamily.deleteMany({
        where: { id: familyId },
      });
    }

    await prisma.$disconnect();

    console.log("Test cleanup: COMPLETE");
  }
}

main().catch((error) => {
  console.error("Logout integration failed:", error);
  process.exitCode = 1;
});