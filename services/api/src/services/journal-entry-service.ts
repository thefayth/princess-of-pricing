import { EntryStatus, Prisma } from "@prisma/client";
import type { DatabaseClient } from "../types/database";
import { AppError } from "../utils/app-error";
import { parseISODate } from "../utils/date";
import { toCents, toMoneyString } from "../utils/money";
import type { JournalEntryRecord } from "../utils/serializers";

type JournalLineInput = {
  accountId: string;
  counterpartyId?: string;
  description?: string;
  debit: number;
  credit: number;
};

type CreateJournalEntryInput = {
  workspaceId: string;
  createdById: string;
  reference?: string;
  memo?: string;
  entryDate: string;
  status: EntryStatus;
  source:
    | "MANUAL"
    | "BANK_IMPORT"
    | "INVOICE"
    | "BILL"
    | "ADJUSTMENT"
    | "TRANSFER"
    | "OPENING_BALANCE";
  lines: JournalLineInput[];
};

export async function createJournalEntry(
  db: DatabaseClient,
  input: CreateJournalEntryInput,
): Promise<JournalEntryRecord> {
  if (input.status === EntryStatus.VOIDED) {
    throw new AppError(400, "Entries cannot be created in a voided state");
  }

  const totalDebits = input.lines.reduce((sum, line) => sum + toCents(line.debit), 0);
  const totalCredits = input.lines.reduce((sum, line) => sum + toCents(line.credit), 0);

  if (totalDebits !== totalCredits) {
    throw new AppError(400, "Journal entries must balance before posting");
  }

  const accountIds = [...new Set(input.lines.map((line) => line.accountId))];
  const accounts = await db.account.findMany({
    where: {
      workspaceId: input.workspaceId,
      id: { in: accountIds },
    },
  });

  if (accounts.length !== accountIds.length) {
    throw new AppError(400, "One or more accounts do not belong to this workspace");
  }

  const counterpartyIds = [...new Set(input.lines.flatMap((line) => (line.counterpartyId ? [line.counterpartyId] : [])))];

  if (counterpartyIds.length > 0) {
    const counterparties = await db.counterparty.findMany({
      where: {
        workspaceId: input.workspaceId,
        id: { in: counterpartyIds },
      },
    });

    if (counterparties.length !== counterpartyIds.length) {
      throw new AppError(400, "One or more counterparties do not belong to this workspace");
    }
  }

  const entry = await db.journalEntry.create({
    data: {
      workspaceId: input.workspaceId,
      createdById: input.createdById,
      reference: input.reference,
      memo: input.memo,
      entryDate: parseISODate(input.entryDate),
      status: input.status,
      source: input.source,
      postedAt: input.status === EntryStatus.POSTED ? new Date() : null,
      lines: {
        create: input.lines.map((line) => ({
          accountId: line.accountId,
          counterpartyId: line.counterpartyId,
          description: line.description,
          debit: new Prisma.Decimal(toMoneyString(line.debit)),
          credit: new Prisma.Decimal(toMoneyString(line.credit)),
        })),
      },
    },
    include: {
      createdBy: true,
      lines: {
        include: {
          account: true,
          counterparty: true,
        },
      },
    },
  });

  return entry;
}
