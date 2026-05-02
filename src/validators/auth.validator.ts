import { z } from "zod";

/**
 * SIGNUP VALIDATION
 */
// validators/auth.validator.ts
export const signUpSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  wallet: z.string().optional(), // 👈 add this
});

/**
 * LOGIN VALIDATION
 */
export const loginSchema = z.object({
    email: z.string().email("Invalid email format"),

    password: z.string().min(1, "Password is required"),
});
