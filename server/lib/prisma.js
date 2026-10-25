import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

const globalForPrisma = globalThis;

export const prisma = 
  globalForPrisma.prisma ?? 
  new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      }
    }
  });
globalForPrisma.prisma = prisma;