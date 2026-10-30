
import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required"),

    JWT_SECRET: z
      .string()
      .min(43, "JWT_SECRET must be at least 43 characters"),

    JWT_REFRESH_SECRET: z
      .string()
      .min(43, "JWT_REFRESH_SECRET must be at least 43 characters"),
      AUTH_ALLOWED_ORIGINS: z.string().optional(),

      VERCEL_ENV: z
        .enum(["production", "preview", "development"])
        .optional(),
      VERCEL_URL: z.string().optional(),
      EMAIL_OTP_SECRET: z.string().min(32).optional(),
      RESEND_API_KEY: z.string().optional(),
      RESEND_FROM_EMAIL: z.string().optional(),
      RATE_LIMIT_SECRET: z.string().min(32),
  })
  .refine(
    (data) => data.JWT_SECRET !== data.JWT_REFRESH_SECRET,
    {
      message: "JWT secrets must be different",
      path: ["JWT_REFRESH_SECRET"],
    }
  );

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error("Invalid environment configuration");
}

export const env = parsedEnv.data;
