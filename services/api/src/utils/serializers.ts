import type { PopConnector, Prisma } from "@prisma/client";
import { formatDecimal } from "./money";
import { toISODate } from "./date";

type UserShape = {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type WorkspaceShape = {
  id: string;
  name: string;
  slug: string;
  type: string;
  baseCurrency: string;
  createdAt: Date;
  updatedAt: Date;
};

type MembershipShape = {
  role: string;
  createdAt: Date;
  workspace: WorkspaceShape;
};

type BankAccountShape = {
  id: string;
  institutionName: string;
  displayName: string;
  maskedNumber: string | null;
  provider: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AccountShape = {
  id: string;
  workspaceId: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  currency: string | null;
  isSystem: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  bankAccount?: BankAccountShape | null;
};

export type JournalEntryRecord = Prisma.JournalEntryGetPayload<{
  include: {
    createdBy: true;
    lines: {
      include: {
        account: true;
        counterparty: true;
      };
    };
  };
}>;

export function serializeUser(user: UserShape) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function serializeConnector(connector: Pick<PopConnector, "id" | "name" | "kind" | "status" | "detail"> & { lastSyncAt?: Date | string | null }) {
  return {
    id: connector.id,
    name: connector.name,
    kind: connector.kind,
    status: connector.status,
    detail: connector.detail ?? "",
    lastSyncAt: connector.lastSyncAt instanceof Date ? connector.lastSyncAt.toISOString() : connector.lastSyncAt ?? undefined,
  };
}

export function serializeWorkspace(workspace: WorkspaceShape) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    type: workspace.type,
    baseCurrency: workspace.baseCurrency,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

export function serializeWorkspaceMembership(membership: MembershipShape) {
  return {
    role: membership.role,
    joinedAt: membership.createdAt.toISOString(),
    workspace: serializeWorkspace(membership.workspace),
  };
}

export function serializeBankAccount(bankAccount: BankAccountShape) {
  return {
    id: bankAccount.id,
    institutionName: bankAccount.institutionName,
    displayName: bankAccount.displayName,
    maskedNumber: bankAccount.maskedNumber,
    provider: bankAccount.provider,
    createdAt: bankAccount.createdAt.toISOString(),
    updatedAt: bankAccount.updatedAt.toISOString(),
  };
}

export function serializeAccount(account: AccountShape) {
  return {
    id: account.id,
    workspaceId: account.workspaceId,
    code: account.code,
    name: account.name,
    type: account.type,
    subtype: account.subtype,
    currency: account.currency,
    isSystem: account.isSystem,
    isArchived: account.isArchived,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    bankAccount: account.bankAccount ? serializeBankAccount(account.bankAccount) : null,
  };
}

export function serializeJournalEntry(entry: JournalEntryRecord) {
  return {
    id: entry.id,
    workspaceId: entry.workspaceId,
    reference: entry.reference,
    memo: entry.memo,
    entryDate: toISODate(entry.entryDate),
    status: entry.status,
    source: entry.source,
    sourceId: entry.sourceId,
    postedAt: entry.postedAt?.toISOString() ?? null,
    voidedAt: entry.voidedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    createdBy: entry.createdBy
      ? {
          id: entry.createdBy.id,
          email: entry.createdBy.email,
          fullName: entry.createdBy.fullName,
        }
      : null,
    lines: entry.lines.map((line) => ({
      id: line.id,
      description: line.description,
      debit: formatDecimal(line.debit),
      credit: formatDecimal(line.credit),
      createdAt: line.createdAt.toISOString(),
      account: {
        id: line.account.id,
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
      },
      counterparty: line.counterparty
        ? {
            id: line.counterparty.id,
            legalName: line.counterparty.legalName,
            type: line.counterparty.type,
          }
        : null,
    })),
  };
}
