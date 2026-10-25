import {
  createOriginGuard,
} from "../middleware/requireTrustedOrigin.js";

export function createConfiguredOriginGuard(config) {
  const origins = (config.AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Trust only the current generated Vercel Preview URL
  if (
    config.VERCEL_ENV === "preview" &&
    config.VERCEL_URL
  ) {
    const hostname = config.VERCEL_URL;

    // Vercel-generated deployment hostnames only
    if (
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/i.test(
        hostname
      )
    ) {
      throw new TypeError(
        "Invalid Vercel Preview hostname"
      );
    }

    origins.push(`https://${hostname}`);
  }

  // Remove duplicates
  const uniqueOrigins = [...new Set(origins)];

  // Existing guard validates the origins and rejects
  // missing or invalid configuration.
  return createOriginGuard(uniqueOrigins);
}