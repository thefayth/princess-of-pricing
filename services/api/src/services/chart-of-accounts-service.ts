import {
  AccountSubtype,
  AccountType,
  WorkspaceType,
} from "@prisma/client";
import type { DatabaseClient } from "../types/database";

type ChartAccountTemplate = {
  code: string;
  name: string;
  type: AccountType;
  subtype?: AccountSubtype;
};

const PERSONAL_ACCOUNT_TEMPLATE: ChartAccountTemplate[] = [
  { code: "1000", name: "Checking", type: AccountType.ASSET, subtype: AccountSubtype.BANK },
  { code: "1010", name: "Savings", type: AccountType.ASSET, subtype: AccountSubtype.BANK },
  { code: "1200", name: "Credit Card Clearing", type: AccountType.ASSET, subtype: AccountSubtype.CASH },
  { code: "2000", name: "Credit Card Payable", type: AccountType.LIABILITY, subtype: AccountSubtype.CREDIT_CARD },
  { code: "2100", name: "Mortgage or Loans", type: AccountType.LIABILITY, subtype: AccountSubtype.LOAN },
  { code: "3000", name: "Personal Equity", type: AccountType.EQUITY, subtype: AccountSubtype.OWNER_EQUITY },
  { code: "4000", name: "Salary Income", type: AccountType.INCOME, subtype: AccountSubtype.REVENUE },
  { code: "4100", name: "Other Income", type: AccountType.INCOME, subtype: AccountSubtype.OTHER_INCOME },
  { code: "6000", name: "Housing", type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE },
  { code: "6100", name: "Utilities", type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE },
  { code: "6200", name: "Groceries", type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE },
  { code: "6300", name: "Transportation", type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE },
  { code: "6400", name: "Insurance", type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE },
  { code: "6500", name: "Taxes", type: AccountType.EXPENSE, subtype: AccountSubtype.TAX_EXPENSE },
  { code: "6900", name: "Misc Personal Expense", type: AccountType.EXPENSE, subtype: AccountSubtype.OTHER_EXPENSE },
];

const BUSINESS_ACCOUNT_TEMPLATE: ChartAccountTemplate[] = [
  { code: "1000", name: "Operating Cash", type: AccountType.ASSET, subtype: AccountSubtype.BANK },
  { code: "1010", name: "Reserve Cash", type: AccountType.ASSET, subtype: AccountSubtype.BANK },
  { code: "1100", name: "Accounts Receivable", type: AccountType.ASSET, subtype: AccountSubtype.ACCOUNTS_RECEIVABLE },
  { code: "1200", name: "Inventory", type: AccountType.ASSET, subtype: AccountSubtype.INVENTORY },
  { code: "1500", name: "Equipment", type: AccountType.ASSET, subtype: AccountSubtype.FIXED_ASSET },
  { code: "2000", name: "Accounts Payable", type: AccountType.LIABILITY, subtype: AccountSubtype.ACCOUNTS_PAYABLE },
  { code: "2100", name: "Credit Card Payable", type: AccountType.LIABILITY, subtype: AccountSubtype.CREDIT_CARD },
  { code: "2200", name: "Sales Tax Payable", type: AccountType.LIABILITY, subtype: AccountSubtype.TAX_PAYABLE },
  { code: "2300", name: "Business Loans", type: AccountType.LIABILITY, subtype: AccountSubtype.LOAN },
  { code: "3000", name: "Owner Equity", type: AccountType.EQUITY, subtype: AccountSubtype.OWNER_EQUITY },
  { code: "3100", name: "Retained Earnings", type: AccountType.EQUITY, subtype: AccountSubtype.RETAINED_EARNINGS },
  { code: "4000", name: "Revenue", type: AccountType.INCOME, subtype: AccountSubtype.REVENUE },
  { code: "4100", name: "Other Income", type: AccountType.INCOME, subtype: AccountSubtype.OTHER_INCOME },
  { code: "5000", name: "Cost of Goods Sold", type: AccountType.EXPENSE, subtype: AccountSubtype.COST_OF_GOODS_SOLD },
  { code: "6000", name: "Office Supplies", type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE },
  { code: "6100", name: "Software and Subscriptions", type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE },
  { code: "6200", name: "Payroll", type: AccountType.EXPENSE, subtype: AccountSubtype.PAYROLL_EXPENSE },
  { code: "6300", name: "Rent and Facilities", type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE },
  { code: "6400", name: "Marketing", type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE },
  { code: "6900", name: "Misc Business Expense", type: AccountType.EXPENSE, subtype: AccountSubtype.OTHER_EXPENSE },
];

export async function seedDefaultAccounts(
  db: DatabaseClient,
  workspaceId: string,
  workspaceType: WorkspaceType,
): Promise<void> {
  const template =
    workspaceType === WorkspaceType.BUSINESS
      ? BUSINESS_ACCOUNT_TEMPLATE
      : PERSONAL_ACCOUNT_TEMPLATE;

  await db.account.createMany({
    data: template.map((account) => ({
      workspaceId,
      code: account.code,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      isSystem: true,
    })),
    skipDuplicates: true,
  });
}
