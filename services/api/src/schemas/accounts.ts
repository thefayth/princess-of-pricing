import { z } from "zod";

export const createAccountBodySchema = z.object({
  code: z.string().trim().min(3).max(12),
  name: z.string().trim().min(2).max(120),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
  subtype: z
    .enum([
      "CASH",
      "BANK",
      "ACCOUNTS_RECEIVABLE",
      "INVENTORY",
      "FIXED_ASSET",
      "CREDIT_CARD",
      "ACCOUNTS_PAYABLE",
      "TAX_PAYABLE",
      "LOAN",
      "OWNER_EQUITY",
      "RETAINED_EARNINGS",
      "REVENUE",
      "OTHER_INCOME",
      "COST_OF_GOODS_SOLD",
      "OPERATING_EXPENSE",
      "PAYROLL_EXPENSE",
      "TAX_EXPENSE",
      "OTHER_EXPENSE",
    ])
    .optional(),
  currency: z.string().trim().length(3).optional(),
});
