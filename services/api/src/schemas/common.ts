import { z } from "zod";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must use YYYY-MM-DD format");

export const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens");

export const workspaceParamsSchema = z.object({
  workspaceId: z.string().min(1),
});

export const moneyInputSchema = z.coerce
  .number()
  .nonnegative("Amounts must be zero or greater")
  .refine(
    (value) => Number.isFinite(value) && Math.round(value * 100) === value * 100,
    "Amounts must use at most two decimal places",
  );
