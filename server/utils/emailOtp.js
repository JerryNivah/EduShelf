import {
  randomInt,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export function generateEmailOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashEmailOtp(secret, userId, code) {
  if (
    typeof secret !== "string" ||
    secret.length < 32
  ) {
    throw new TypeError("Invalid OTP secret");
  }

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError("Invalid user ID");
  }

  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    throw new TypeError("Invalid OTP format");
  }

  return createHmac("sha256", secret)
    .update(`${userId}:${code}`)
    .digest("hex");
}

export function verifyEmailOtpHash(
  secret,
  userId,
  code,
  storedHash
) {
  if (
    typeof code !== "string" ||
    !/^\d{6}$/.test(code) ||
    typeof storedHash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(storedHash)
  ) {
    return false;
  }

  const actual = Buffer.from(
    hashEmailOtp(secret, userId, code),
    "hex"
  );

  const expected = Buffer.from(storedHash, "hex");

  return timingSafeEqual(actual, expected);
}