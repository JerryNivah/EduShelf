
import { prisma } from "../lib/prisma.js";
import {
  calculateRefreshExpiry,
} from "../utils/refreshPolicy.js";
// Create a refresh-token session record

export async function createRefreshSession({
  userId,
  familyId,
  tokenHash,
  expiresAt,
}) {
  return prisma.$transaction(async (tx) => {
    // Lock the parent family before creating a session
    const families = await tx.$queryRaw`
      SELECT "userId", "revokedAt", "createdAt"
      FROM "public"."RefreshSessionFamily"
      WHERE "id" = CAST(${familyId} AS UUID)
      FOR UPDATE
    `;

    const family = families[0];

    // Reject missing or revoked families
    if (!family || family.revokedAt !== null) {
      return null;
    }

    // Prevent creating a session under another user's family
    if (family.userId !== userId) {
      throw new Error("Refresh-session family owner mismatch");
    }
    // Capture time after acquiring the family lock
const now = new Date();

// Enforce the absolute family lifetime
const familyExpiry = calculateRefreshExpiry({
  familyCreatedAt: family.createdAt,
  nowMs: now.getTime(),
});

if (familyExpiry === null) {
  return null;
}

// Validate requested expiration
if (
  !(expiresAt instanceof Date) ||
  !Number.isFinite(expiresAt.getTime())
) {
  throw new TypeError("Invalid refresh expiry");
}

// Cap expiration at the family deadline
const effectiveExpiresAt = new Date(
  Math.min(
    expiresAt.getTime(),
    familyExpiry.getTime()
  )
);

if (effectiveExpiresAt.getTime() <= now.getTime()) {
  return null;
}

    return tx.refreshSession.create({
      data: {
        userId,
        familyId,
        tokenHash,
        expiresAt: effectiveExpiresAt,
      },
      select: {
        id: true,
        userId: true,
        familyId: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }, {
    maxWait: 10_000,
  });
}

export async function createRefreshSessionFamilyWithSession({
  userId,
  familyId,
  tokenHash,
  expiresAt,
}) {
  if (!familyId) {
    throw new TypeError("familyId is required");
  }
// Use one timestamp for family creation and lifetime policy
const createdAt = new Date();

if (
  !(expiresAt instanceof Date) ||
  !Number.isFinite(expiresAt.getTime())
) {
  throw new TypeError("Invalid refresh expiry");
}

if (expiresAt.getTime() <= createdAt.getTime()) {
  throw new RangeError("Refresh expiry must be in the future");
}

const policyExpiry = calculateRefreshExpiry({
  familyCreatedAt: createdAt,
  nowMs: createdAt.getTime(),
});

const effectiveExpiresAt = new Date(
  Math.min(
    expiresAt.getTime(),
    policyExpiry.getTime()
  )
);
  const [family, session] = await prisma.$transaction([
    prisma.refreshSessionFamily.create({
      data: {
        id: familyId,
        userId,
        createdAt,
      },
    }),

    prisma.refreshSession.create({
      data: {
        userId,
        familyId,
        tokenHash,
        expiresAt: effectiveExpiresAt,
      },
    }),
  ]);

  return { family, session };
}
export async function findRefreshSessionByTokenHash(tokenHash) {
  return prisma.refreshSession.findUnique({
    where: {
      tokenHash,
    },
    select: {
      id: true,
      userId: true,
      familyId: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
    },
  });
}
export async function rotateRefreshSession({
  currentTokenHash,
  nextTokenHash,
  expiresAt,
}) {
  return prisma.$transaction(async (tx) => {

    // 1. Find the existing refresh session
    const current = await tx.refreshSession.findUnique({
      where: {
        tokenHash: currentTokenHash,
      },
      select: {
        id: true,
        userId: true,
        familyId: true,
      },
    });

    if (!current) {
      return null;
    }

    // 2. Lock the parent family before rotation
    const families = await tx.$queryRaw`
      SELECT "id", "revokedAt", "createdAt"
      FROM "public"."RefreshSessionFamily"
      WHERE "id" = CAST(${current.familyId} AS UUID)
      FOR UPDATE
    `;

    const family = families[0];

    // Reject missing or revoked families
    if (!family || family.revokedAt !== null) {
      return null;
    }

    // Capture time AFTER acquiring the family lock
    const now = new Date();

    // 3. Enforce the 30-day absolute family lifetime
    const familyExpiry = calculateRefreshExpiry({
      familyCreatedAt: family.createdAt,
      nowMs: now.getTime(),
    });

    // Family has reached its absolute deadline
    if (familyExpiry === null) {
      return null;
    }

    // Validate requested expiration
    if (
      !(expiresAt instanceof Date) ||
      !Number.isFinite(expiresAt.getTime())
    ) {
      throw new TypeError("Invalid refresh expiry");
    }

    // Never exceed the family deadline
    const effectiveExpiresAt = new Date(
      Math.min(
        expiresAt.getTime(),
        familyExpiry.getTime()
      )
    );

    if (effectiveExpiresAt.getTime() <= now.getTime()) {
      return null;
    }

    // 4. Atomically consume the existing token
    const consumed = await tx.refreshSession.updateMany({
      where: {
        id: current.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        usedAt: now,
      },
    });

    // Only one request can consume this token
    if (consumed.count !== 1) {
      return null;
    }

    // 5. Create replacement with capped expiration
    return tx.refreshSession.create({
      data: {
        userId: current.userId,
        familyId: current.familyId,
        tokenHash: nextTokenHash,
        expiresAt: effectiveExpiresAt,
      },
      select: {
        id: true,
        userId: true,
        familyId: true,
        expiresAt: true,
        createdAt: true,
      },
    });

  }, {
    maxWait: 10_000,
  });
}
// Caller must hold the family row lock in this transaction
async function revokeFamilyWithinTransaction(
  tx,
  familyId,
  revokedAt
) {
  await tx.refreshSessionFamily.update({
    where: { id: familyId },
    data: { revokedAt },
  });

  const result = await tx.refreshSession.updateMany({
    where: {
      familyId,
      revokedAt: null,
    },
    data: {
      revokedAt,
    },
  });

  return result.count;
}
// Explicitly revoke a refresh-session family
export async function revokeRefreshSessionFamily({
  familyId,
}) {
  if (
    typeof familyId !== "string" ||
    familyId.trim() === ""
  ) {
    throw new TypeError("familyId is required");
  }

  return prisma.$transaction(async (tx) => {
    // 1. Lock the parent family
    const families = await tx.$queryRaw`
      SELECT "id", "revokedAt"
      FROM "public"."RefreshSessionFamily"
      WHERE "id" = CAST(${familyId} AS UUID)
      FOR UPDATE
    `;

    const family = families[0];

    // 2. Missing or already revoked family
    if (!family || family.revokedAt !== null) {
      return 0;
    }

    // 3. Capture the revocation timestamp
    const now = new Date();

    // 4. Atomically revoke parent and child sessions
    return revokeFamilyWithinTransaction(
      tx,
      familyId,
      now
    );
  }, {
    maxWait: 10_000,
  });
}
// Detect a consumed refresh token and revoke its family
export async function revokeFamilyIfTokenReplayed({
  tokenHash,
}) {
  return prisma.$transaction(async (tx) => {
    // 1. Find the session
    const session = await tx.refreshSession.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        familyId: true,
      },
    });

    if (!session) {
      return { replayDetected: false, revokedCount: 0 };
    }

    // 2. Lock the parent family
    const families = await tx.$queryRaw`
      SELECT "revokedAt"
      FROM "public"."RefreshSessionFamily"
      WHERE "id" = CAST(${session.familyId} AS UUID)
      FOR UPDATE
    `;

    const family = families[0];

    if (!family || family.revokedAt !== null) {
      return { replayDetected: false, revokedCount: 0 };
    }

    // 3. Re-read the session after acquiring the lock
    const latest = await tx.refreshSession.findUnique({
      where: { id: session.id },
      select: {
        usedAt: true,
        revokedAt: true,
      },
    });

    // Only consumed, non-revoked tokens indicate replay
    if (
      !latest ||
      latest.usedAt === null ||
      latest.revokedAt !== null
    ) {
      return { replayDetected: false, revokedCount: 0 };
    }

    // 4. Revoke the entire session family
    const revokedCount =
      await revokeFamilyWithinTransaction(
        tx,
        session.familyId,
        new Date()
      );

    return {
      replayDetected: true,
      revokedCount,
    };
  }, {
    maxWait: 10_000,
  });
}