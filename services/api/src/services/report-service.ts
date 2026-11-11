import { AccountType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { endOfISODate } from "../utils/date";
import { toMoneyString } from "../utils/money";

type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debit: string;
  credit: string;
};

export async function buildTrialBalance(
  workspaceId: string,
  asOf?: string,
  includeZeroBalance = false,
) {
  const [workspace, accounts, lines] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    prisma.account.findMany({
      where: { workspaceId, isArchived: false },
      orderBy: { code: "asc" },
    }),
    prisma.journalLine.findMany({
      where: {
        journalEntry: {
          workspaceId,
          status: "POSTED",
          ...(asOf ? { entryDate: { lte: endOfISODate(asOf) } } : {}),
        },
      },
      include: {
        account: true,
      },
    }),
  ]);

  const balances = new Map<string, number>();

  for (const line of lines) {
    const delta =
      Number.parseFloat(line.debit.toString()) - Number.parseFloat(line.credit.toString());

    balances.set(line.accountId, (balances.get(line.accountId) ?? 0) + delta);
  }

  const rows: TrialBalanceRow[] = accounts
    .map((account) => {
      const balance = balances.get(account.id) ?? 0;
      const roundedBalance = Math.round(balance * 100) / 100;

      if (!includeZeroBalance && roundedBalance === 0) {
        return null;
      }

      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit: roundedBalance > 0 ? toMoneyString(roundedBalance) : "0.00",
        credit: roundedBalance < 0 ? toMoneyString(Math.abs(roundedBalance)) : "0.00",
      };
    })
    .filter((row): row is TrialBalanceRow => row !== null);

  const totals = rows.reduce(
    (accumulator, row) => ({
      debit: accumulator.debit + Number.parseFloat(row.debit),
      credit: accumulator.credit + Number.parseFloat(row.credit),
    }),
    { debit: 0, credit: 0 },
  );

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      type: workspace.type,
      baseCurrency: workspace.baseCurrency,
    },
    asOf: asOf ?? new Date().toISOString().slice(0, 10),
    rows,
    totals: {
      debit: toMoneyString(totals.debit),
      credit: toMoneyString(totals.credit),
    },
  };
}
