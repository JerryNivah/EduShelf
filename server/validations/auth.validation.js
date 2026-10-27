import { z } from "zod";

export const registerSchema = z.object({
  firstName: z
   .string()
   .trim()
   .min(2, "First name must be atleast 2 characters")
   .max(50, "First name must not exceed 50 characters"),
  
  lastName: z
   .string()
   .trim()
   .min(2, "Last name must be atleast 2 characters")
   .max(50, "last name must not exceed 50 characters"),

  email: z
   .string()
   .trim()
   .email("Please provide a valid email address")
   .toLowerCase(),

  password: z
   .string()
   .min(8, "Password must be at least 8 characters")
   .max(128, "Password must not exceed 128 characters"),
})

export const loginSchema = z.object({
  email: registerSchema.shape.email,

  password: z
    .string()
    .min(1, "Password is required"),
});
export const verificationEmailSchema = z.object({
  email: registerSchema.shape.email,
}).strict();

export const verifyEmailSchema =
  verificationEmailSchema.extend({
    code: z.string().regex(
      /^\d{6}$/,
      "Verification code must contain six digits"
    ),
  }).strict();