export const REFRESH_TOKEN_LIFETIME_MS =
  7 * 24 * 60 * 60 * 1000;

export const REFRESH_FAMILY_LIFETIME_MS =
  30 * 24 * 60 * 60 * 1000;

export function calculateRefreshExpiry({
  familyCreatedAt,
  nowMs = Date.now(),
}) {
  if (
    !(familyCreatedAt instanceof Date) ||
    !Number.isFinite(familyCreatedAt.getTime())
  ) {
    throw new TypeError("Invalid family creation date");
  }

  if (!Number.isFinite(nowMs)) {
    throw new TypeError("Invalid current time");
  }

  const familyDeadline =
    familyCreatedAt.getTime() +
    REFRESH_FAMILY_LIFETIME_MS;

  // The session family has reached its absolute expiry.
  if (nowMs >= familyDeadline) {
    return null;
  }

  // Never extend a token beyond the family deadline.
  const expiresAt = Math.min(
    nowMs + REFRESH_TOKEN_LIFETIME_MS,
    familyDeadline
  );

  return new Date(expiresAt);
}