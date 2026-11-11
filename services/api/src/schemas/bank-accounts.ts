import { z } from "zod";

export const createBankAccountBodySchema = z.object({
  accountId: z.string().min(1),
  institutionName: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(2).max(120),
  maskedNumber: z.string().trim().max(20).optional(),
  provider: z.string().trim().max(60).optional(),
});
