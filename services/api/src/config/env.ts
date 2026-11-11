import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  API_PREFIX: z.string().default("/api/v1"),
  POP_INVITE_ONLY: z.string().default("true").transform((value) => value.toLowerCase() !== "false"),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  CONNECTOR_ENCRYPTION_KEY: z.string().min(32).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
