import test from "node:test";
import assert from "node:assert/strict";

import {
  createAccessTokenService,
} from "../utils/accessToken.js";

import {
  createRequireAuth,
} from "../middleware/requireAuth.js";

import {
  requireRole,
} from "../middleware/requireRole.js";

import {
  createMeHandler,
} from "../../api/auth/me.js";

const jwt = createAccessTokenService(
  "x".repeat(64)
);

const customer = {
  id: 7,
  firstName: "Test",
  lastName: "Customer",
  email: "test@example.com",
  role: "CUSTOMER",
};

function createAuth(findUser = async () => customer) {
  return createRequireAuth({
    verifyToken: jwt.verifyAccessToken,
    findUser,
  });
}

function createResponse() {
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

test("authenticates a valid access JWT", async () => {
  const token = await jwt.signAccessToken(7);

  const req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };

  await createAuth()(req);

  assert.equal(req.auth.userId, 7);
  assert.equal(req.auth.role, "CUSTOMER");
  assert.equal(req.user.email, customer.email);
  assert.equal(req.user.passwordHash, undefined);
});

test("rejects missing or malformed credentials", async () => {
  const authenticate = createAuth();

  for (const authorization of [
    undefined,
    "Basic abc",
    "Bearer",
    "Bearer token another-token",
  ]) {
    await assert.rejects(
      () => authenticate({
        headers: { authorization },
      }),
      { statusCode: 401 }
    );
  }
});

test("rejects an invalid access JWT", async () => {
  await assert.rejects(
    () => createAuth()({
      headers: {
        authorization: "Bearer invalid.jwt.token",
      },
    }),
    { statusCode: 401 }
  );
});

test("rejects a deleted user", async () => {
  const token = await jwt.signAccessToken(7);

  const authenticate = createAuth(
    async () => null
  );

  await assert.rejects(
    () => authenticate({
      headers: {
        authorization: `Bearer ${token}`,
      },
    }),
    { statusCode: 401 }
  );
});

test("propagates user lookup database errors", async () => {
  const token = await jwt.signAccessToken(7);
  const databaseError = new Error("Database unavailable");

  const authenticate = createAuth(
    async () => {
      throw databaseError;
    }
  );

  await assert.rejects(
    () => authenticate({
      headers: {
        authorization: `Bearer ${token}`,
      },
    }),
    (error) => error === databaseError
  );
});

test("allows authenticated admins", () => {
  const req = {
    auth: {
      userId: 10,
      role: "ADMIN",
    },
  };

  assert.doesNotThrow(() => {
    requireRole("ADMIN")(req);
  });
});

test("rejects customers from admin routes", () => {
  const req = {
    auth: {
      userId: 7,
      role: "CUSTOMER",
    },
  };

  assert.throws(
    () => requireRole("ADMIN")(req),
    { statusCode: 403 }
  );
});

test("role checks reject unauthenticated requests", () => {
  assert.throws(
    () => requireRole("ADMIN")({}),
    { statusCode: 401 }
  );
});

test("GET /me returns the authenticated profile", async () => {
  const token = await jwt.signAccessToken(7);

  const handler = createMeHandler(createAuth());

  const req = {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
  };

  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.id, 7);
  assert.equal(res.body.data.user.role, "CUSTOMER");
  assert.equal(
    res.body.data.user.passwordHash,
    undefined
  );
  assert.equal(
    res.headers["cache-control"],
    "no-store"
  );
});

test("GET /me rejects unauthenticated requests", async () => {
  const handler = createMeHandler(createAuth());
  const res = createResponse();

  await handler(
    { method: "GET", headers: {} },
    res
  );

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test("GET /me enforces its HTTP method", async () => {
  let authCalled = false;

  const handler = createMeHandler(async () => {
    authCalled = true;
  });

  const res = createResponse();

  await handler(
    { method: "POST", headers: {} },
    res
  );

  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, "GET");
  assert.equal(authCalled, false);
});