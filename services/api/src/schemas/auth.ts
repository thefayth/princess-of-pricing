import { z } from "zod";

export const registerBodySchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  phoneNumber: z.string().trim().max(30).optional(),
  companyName: z.string().trim().min(2).max(120).optional(),
  baseCurrency: z.string().trim().length(3).default("USD"),
});

export const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export const googleLoginBodySchema = z.object({
  idToken: z.string().min(20),
});
