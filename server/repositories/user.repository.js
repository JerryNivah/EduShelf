
import { prisma } from "../lib/prisma.js";

// Find a user ID by email
export async function findUserIdByEmail(email) {
  return prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });
}

// Create a new user
export async function createUser({
  firstName,
  lastName,
  email,
  passwordHash,
}) {
  return prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
}

/**
 * Find a user by email for authentication.
 * Includes the password hash for internal verification.
 */
export async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      passwordHash: true,
      emailVerifiedAt: true,
    },
  });
}
// Look up the current user for protected requests.
// Never retrieve their password hash here.
export async function findUserForAuthById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
    },
  });
}