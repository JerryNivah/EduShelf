
import { prisma } from "../../server/lib/prisma.js";

export function createCleanupHandler({
  db,
  secret,
  now = () => new Date(),
}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");

      return res.status(405).json({
        success: false,
        message: "Method not allowed",
      });
    }

    // Fail closed when CRON_SECRET is missing.
    if (
      !secret ||
      secret.length < 16 ||
      req.headers?.authorization !== `Bearer ${secret}`
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    try {
      const result = await db.authRateLimit.deleteMany({
        where: {
          expiresAt: {
            lt: now(),
          },
        },
      });

      return res.status(200).json({
        success: true,
        deleted: result.count,
      });
    } catch (error) {
      console.error("Rate-limit cleanup failed:", error?.name);

      return res.status(500).json({
        success: false,
        message: "Cleanup failed",
      });
    }
  };
}

export default createCleanupHandler({
  db: prisma,
  secret: process.env.CRON_SECRET,
});
