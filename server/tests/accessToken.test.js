
import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

import {
  createAccessTokenService,
} from "../utils/accessToken.js";

// Test-only secrets, never production credentials
const testSecret = "a".repeat(64);
const service = createAccessTokenService(testSecret);

// TEST 1: Valid token
test("signs and verifies a valid access token", async () => {
  const token = await service.signAccessToken(1);
  const result = await service.verifyAccessToken(token);

  assert.equal(result.userId, 1);
  assert.equal(token.split(".").length, 3);
});

// TEST 2: Tampered signature
test("rejects a tampered access token", async () => {
  const token = await service.signAccessToken(1);
  const parts = token.split(".");

  // Alter the signature without signing again
  parts[2] =
    (parts[2][0] === "A" ? "B" : "A") +
    parts[2].slice(1);

  const tamperedToken = parts.join(".");

  await assert.rejects(
    service.verifyAccessToken(tamperedToken)
  );
});

// TEST 3: Expired token
test("rejects an expired access token", async () => {
  const now = Math.floor(Date.now() / 1000);

  const expiredToken = await new SignJWT({
    tokenUse: "access",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("1")
    .setIssuer("edushelf")
    .setAudience("edushelf-api")
    .setIssuedAt(now - 120)
    .setExpirationTime(now - 60)
    .sign(new TextEncoder().encode(testSecret));

  await assert.rejects(
    service.verifyAccessToken(expiredToken),
    { code: "ERR_JWT_EXPIRED" }
  );
});

// TEST 4: Incorrect signing secret
test("rejects tokens signed with another secret", async () => {
  const token = await service.signAccessToken(1);

  const anotherService = createAccessTokenService(
    "b".repeat(64)
  );

  await assert.rejects(
    anotherService.verifyAccessToken(token)
  );
});

// TEST 5: Invalid user IDs
test("rejects invalid user IDs", async () => {
  for (const userId of [0, -1, 1.5, "1", null]) {
    await assert.rejects(
      service.signAccessToken(userId),
      {
        name: "TypeError",
        message: "Invalid user ID",
      }
    );
  }
});

// Helper for testing JWT claim restrictions
async function createTestToken({
  tokenUse = "access",
  issuer = "edushelf",
  audience = "edushelf-api",
} = {}) {
  return new SignJWT({ tokenUse })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setSubject("1")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(testSecret));
}

// TEST 6: Incorrect token purpose
test("rejects a token with the wrong purpose", async () => {
  const token = await createTestToken({
    tokenUse: "refresh",
  });

  await assert.rejects(
    service.verifyAccessToken(token),
    /Invalid access token/
  );
});

// TEST 7: Incorrect issuer
test("rejects a token from another issuer", async () => {
  const token = await createTestToken({
    issuer: "another-application",
  });

  await assert.rejects(
    service.verifyAccessToken(token),
    { code: "ERR_JWT_CLAIM_VALIDATION_FAILED" }
  );
});

// TEST 8: Incorrect audience
test("rejects a token intended for another API", async () => {
  const token = await createTestToken({
    audience: "another-api",
  });

  await assert.rejects(
    service.verifyAccessToken(token),
    { code: "ERR_JWT_CLAIM_VALIDATION_FAILED" }
  );
});
