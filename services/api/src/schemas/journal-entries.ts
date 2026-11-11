import { z } from "zod";
import { isoDateSchema, moneyInputSchema } from "./common";
import { toCents } from "../utils/money";

const journalLineSchema = z.object({
  accountId: z.string().min(1),
  counterpartyId: z.string().min(1).optional(),
  description: z.string().trim().max(200).optional(),
  debit: moneyInputSchema.default(0),
  credit: moneyInputSchema.default(0),
});

export const createJournalEntryBodySchema = z
  .object({
    reference: z.string().trim().max(60).optional(),
    memo: z.string().trim().max(240).optional(),
    entryDate: isoDateSchema,
    status: z.enum(["DRAFT", "POSTED"]).default("POSTED"),
    source: z
      .enum(["MANUAL", "BANK_IMPORT", "INVOICE", "BILL", "ADJUSTMENT", "TRANSFER", "OPENING_BALANCE"])
      .default("MANUAL"),
    lines: z.array(journalLineSchema).min(2),
  })
  .superRefine((value, ctx) => {
    const totalDebits = value.lines.reduce((sum, line) => sum + toCents(line.debit), 0);
    const totalCredits = value.lines.reduce((sum, line) => sum + toCents(line.credit), 0);

    value.lines.forEach((line, index) => {
      const debitCents = toCents(line.debit);
      const creditCents = toCents(line.credit);

      if (debitCents === 0 && creditCents === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each line must contain a debit or credit amount",
          path: ["lines", index],
        });
      }

      if (debitCents > 0 && creditCents > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A line cannot contain both debit and credit values",
          path: ["lines", index],
        });
      }
    });

    if (totalDebits !== totalCredits) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Journal entries must balance",
        path: ["lines"],
      });
    }
  });

export const listJournalEntriesQuerySchema = z.object({
  status: z.enum(["DRAFT", "POSTED", "VOIDED"]).optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const trialBalanceQuerySchema = z.object({
  asOf: isoDateSchema.optional(),
  includeZeroBalance: z.coerce.boolean().default(false),
});
