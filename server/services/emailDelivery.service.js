import { Resend } from "resend";
import { env } from "../config/env.js";

export async function sendVerificationEmail({ to, code }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error(
      "Email delivery is not configured"
    );
  }

  const resend = new Resend(env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: "Verify your EduShelf email",
    text: [
      "Welcome to EduShelf!",
      "",
      `Your verification code is: ${code}`,
      "",
      "This code expires in 10 minutes.",
      "If you did not request it, ignore this email.",
    ].join("\n"),
  });

  if (error) {
    throw new Error("Verification email delivery failed", {
      cause: error,
    });
  }

  return data?.id;
}