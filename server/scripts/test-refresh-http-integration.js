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
  createRefreshHandler,
} from "../../api/auth/refresh.js";

import {
  refreshController,
} from "../controllers/refresh.controller.js";
import {
  parseRefreshCookie,
} from "../utils/refreshCookie.js";

import {
  verifyAccessToken,
} from "../utils/accessToken.js";

import {
  decodeJwt,
  decodeProtectedHeader,
} from "jose";

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

const refreshHandler = createRefreshHandler(
  refreshController,

  (req) => {
    assert.equal(
      req.headers.origin,
      "http://localhost:3000"
    );
  }
);

const prisma = new PrismaClient();

async function main() {
  let familyId = null;

  try {
    // Use an existing development test customer
    const customer = await prisma.user.findFirst({
      where: { role: "CUSTOMER" },
      select: { id: true },
    });

    assert.ok(customer, "No test customer found");

    // 1. Issue a real refresh token
    const issued = await issueInitialRefreshToken({
      userId: customer.id,
    });

    familyId = issued.familyId;

    assert.match(
      issued.refreshToken,
      /^[A-Za-z0-9_-]{43}$/
    );

    console.log("Refresh token issuance: PASSED");

    // 2. Verify parent family exists
    const family =
      await prisma.refreshSessionFamily.findUnique({
        where: { id: familyId },
      });

    assert.ok(family);
    assert.equal(family.userId, customer.id);
    assert.equal(family.revokedAt, null);

    console.log("Parent family creation: PASSED");

    // 3. Verify initial session was saved
    const tokenHash = hashRefreshToken(
      issued.refreshToken
    );

    const session =
      await prisma.refreshSession.findUnique({
        where: { tokenHash },
      });

    assert.ok(session);
    assert.equal(session.userId, customer.id);
    assert.equal(session.familyId, familyId);

    console.log("Initial session creation: PASSED");

    // 4. Verify token security and expiration
    assert.equal(session.tokenHash, tokenHash);
    assert.notEqual(
      session.tokenHash,
      issued.refreshToken
    );

    assert.equal(
      session.expiresAt.getTime(),
      issued.expiresAt.getTime()
    );

    assert.equal(session.usedAt, null);
    assert.equal(session.revokedAt, null);

    console.log("Token security invariants: PASSED");
   // 5. Rotate Token A through the real HTTP handler
const req = {
  method: "POST",
  headers: {
    origin: "http://localhost:3000",
    cookie: `edushelf_refresh=${issued.refreshToken}`,
  },
};

const res = createMockResponse();

await refreshHandler(req, res);

// Verify successful HTTP response
assert.equal(res.statusCode, 200);
assert.equal(res.body.success, true);

// Verify access JWT was issued
const accessToken = res.body.data.accessToken;

assert.equal(typeof accessToken, "string");
assert.equal(accessToken.split(".").length, 3);

// Verify JWT signature and authentication requirements
const verifiedToken = await verifyAccessToken(accessToken);

assert.ok(
  verifiedToken,
  "Refreshed access JWT must verify successfully"
);

// Inspect claims only after successful verification
const claims = decodeJwt(accessToken);
const header = decodeProtectedHeader(accessToken);

// Verify the token belongs to the correct customer
assert.equal(claims.sub, String(customer.id));

// Verify EduShelf JWT configuration
assert.equal(claims.iss, "edushelf");
assert.equal(claims.aud, "edushelf-api");
assert.equal(claims.tokenUse, "access");

// Verify signing algorithm and token type
assert.equal(header.alg, "HS256");
assert.equal(header.typ, "JWT");

// Verify issued-at and expiration claims
assert.ok(Number.isInteger(claims.iat));
assert.ok(Number.isInteger(claims.exp));

assert.ok(claims.exp > claims.iat);

// Access JWT must have a 15-minute lifetime
assert.equal(
  claims.exp - claims.iat,
  15 * 60
);

console.log("Refreshed access JWT verification: PASSED");
// Verify replacement refresh cookie
const replacementCookie = res.headers["set-cookie"];

assert.equal(typeof replacementCookie, "string");
assert.ok(replacementCookie.includes("HttpOnly"));
assert.ok(replacementCookie.includes("SameSite=Lax"));

// Extract Token B from the response cookie
const tokenB = parseRefreshCookie(replacementCookie);

assert.match(tokenB, /^[A-Za-z0-9_-]{43}$/);

// Token B must differ from Token A
assert.notEqual(tokenB, issued.refreshToken);

// Raw refresh token must not appear in JSON
assert.ok(
  !JSON.stringify(res.body).includes(tokenB)
);

// Authentication responses must not be cached
assert.equal(
  res.headers["cache-control"],
  "no-store"
);

// Preserve compatibility with existing database checks
const rotation = {
  refreshToken: tokenB,
};

console.log("HTTP refresh-token rotation: PASSED");

// Verify Token A was consumed
const originalAfterRotation =
  await prisma.refreshSession.findUnique({
    where: { tokenHash },
  });

assert.ok(originalAfterRotation);
assert.ok(originalAfterRotation.usedAt instanceof Date);

// Verify Token B exists in PostgreSQL
const replacementHash = hashRefreshToken(
  rotation.refreshToken
);

const replacement =
  await prisma.refreshSession.findUnique({
    where: { tokenHash: replacementHash },
  });

assert.ok(replacement);
assert.equal(replacement.familyId, familyId);
assert.equal(replacement.userId, customer.id);

assert.equal(replacement.usedAt, null);
assert.equal(replacement.revokedAt, null);

// Extract expiration from the HTTP cookie
const expiresMatch = replacementCookie.match(
  /(?:^|;\s*)Expires=([^;]+)/i
);

assert.ok(
  expiresMatch,
  "Replacement cookie must contain Expires"
);

const cookieExpiresAt = new Date(expiresMatch[1]);

assert.ok(
  !Number.isNaN(cookieExpiresAt.getTime())
);

// Compare cookie expiry with PostgreSQL session expiry
assert.ok(
  Math.abs(
    replacement.expiresAt.getTime() -
    cookieExpiresAt.getTime()
  ) < 1000
);

console.log("Database rotation invariants: PASSED");
// 6. Replay consumed Token A through HTTP
const replayReq = {
  method: "POST",
  headers: {
    origin: "http://localhost:3000",
    cookie: `edushelf_refresh=${issued.refreshToken}`,
  },
};

const replayRes = createMockResponse();

await refreshHandler(replayReq, replayRes);

// Replayed tokens must be rejected
assert.equal(replayRes.statusCode, 401);
assert.equal(replayRes.body.success, false);

// No new access JWT must be returned
assert.equal(
  replayRes.body.data?.accessToken,
  undefined
);

// The browser's refresh cookie must be cleared
assert.ok(
  replayRes.headers["set-cookie"].includes("Max-Age=0")
);

// Rejected authentication responses must not be cached
assert.equal(
  replayRes.headers["cache-control"],
  "no-store"
);

console.log("HTTP refresh replay rejection: PASSED");


// Verify the parent family was revoked
const revokedFamily =
  await prisma.refreshSessionFamily.findUnique({
    where: { id: familyId },
  });

assert.ok(revokedFamily);
assert.ok(revokedFamily.revokedAt instanceof Date);

// Verify both sessions were revoked
const familySessions =
  await prisma.refreshSession.findMany({
    where: { familyId },
  });

assert.equal(familySessions.length, 2);

assert.ok(
  familySessions.every(
    (session) => session.revokedAt instanceof Date
  )
);

console.log("Replay family revocation: PASSED");
// 7. Attempt to use revoked Token B through HTTP
const blockedReq = {
  method: "POST",
  headers: {
    origin: "http://localhost:3000",
    cookie: `edushelf_refresh=${rotation.refreshToken}`,
  },
};

const blockedRes = createMockResponse();

await refreshHandler(blockedReq, blockedRes);

// Revoked Token B must also be rejected
assert.equal(blockedRes.statusCode, 401);
assert.equal(blockedRes.body.success, false);

// No new access credentials
assert.equal(
  blockedRes.body.data?.accessToken,
  undefined
);

// Clear the unusable cookie
assert.ok(
  blockedRes.headers["set-cookie"].includes("Max-Age=0")
);

console.log("Revoked Token B HTTP rejection: PASSED");

// Confirm no additional session was created
const finalSessionCount =
  await prisma.refreshSession.count({
    where: { familyId },
  });

assert.equal(finalSessionCount, 2);

console.log("Revoked replacement token blocked: PASSED");

  } finally {
    // Remove only records created by this test
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
  console.error("Issuance integration failed:", error);
  process.exitCode = 1;
});