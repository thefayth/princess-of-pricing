-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'BOOKKEEPER', 'VIEWER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountSubtype" AS ENUM ('CASH', 'BANK', 'ACCOUNTS_RECEIVABLE', 'INVENTORY', 'FIXED_ASSET', 'CREDIT_CARD', 'ACCOUNTS_PAYABLE', 'TAX_PAYABLE', 'LOAN', 'OWNER_EQUITY', 'RETAINED_EARNINGS', 'REVENUE', 'OTHER_INCOME', 'COST_OF_GOODS_SOLD', 'OPERATING_EXPENSE', 'PAYROLL_EXPENSE', 'TAX_EXPENSE', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "LedgerSource" AS ENUM ('MANUAL', 'BANK_IMPORT', 'INVOICE', 'BILL', 'ADJUSTMENT', 'TRANSFER', 'OPENING_BALANCE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BANK_STATEMENT', 'RECEIPT', 'INVOICE', 'BILL', 'CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "CounterpartyType" AS ENUM ('CUSTOMER', 'VENDOR', 'BOTH');

-- CreateEnum
CREATE TYPE "InvoiceDirection" AS ENUM ('OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOIDED');

-- CreateEnum
CREATE TYPE "PopConnectorKind" AS ENUM ('FAD_EXPORT', 'GMAIL_METADATA', 'MERCHANT_SOURCE', 'BROWSER_EXTENSION');

-- CreateEnum
CREATE TYPE "PopConnectorStatus" AS ENUM ('DISCONNECTED', 'READY', 'CONNECTED', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('ACTIVE', 'EXPIRING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WatchStatus" AS ENUM ('WATCHING', 'TARGET_HIT', 'PAUSED');

-- CreateEnum
CREATE TYPE "SubscriptionCadence" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PopSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCEL_PENDING', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "CancellationStatus" AS ENUM ('OPEN', 'USER_ACTION_REQUIRED', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('CANCEL_SUBSCRIPTION', 'BUY_PRICE_DROP', 'USE_OWNED_CARD', 'CONSIDER_NEW_CARD', 'EXPIRING_OFFER');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('MERCHANT_PAGE', 'EMAIL_METADATA', 'FAD_EXPORT', 'USER_CONFIRMATION', 'REWARD_TERMS', 'PRICE_OBSERVATION');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('PRICE_DROP', 'RENEWAL', 'OFFER_EXPIRING', 'SYNC_CONFLICT');

-- CreateEnum
CREATE TYPE "SubscriptionServiceCategory" AS ENUM ('MUSIC', 'VIDEO', 'SOFTWARE', 'NEWS', 'OTHER');

-- CreateEnum
CREATE TYPE "DealEligibility" AS ENUM ('NEW_ONLY', 'RETURNING_ONLY', 'STUDENT', 'FAMILY', 'DEVICE', 'PARTNER', 'ANY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DealVerificationState" AS ENUM ('OBSERVED', 'CHECKED', 'ELIGIBILITY_UNCONFIRMED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DealOfferStatus" AS ENUM ('ACTIVE', 'EXPIRING', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DuplicateCandidateType" AS ENUM ('IMPORT_DUPLICATE', 'ACTIVE_SERVICE_DUPLICATE');

-- CreateEnum
CREATE TYPE "DuplicateCandidateStatus" AS ENUM ('NEW', 'PENDING_REVIEW', 'AUTO_CANCEL_ELIGIBLE', 'CANCEL_IN_PROGRESS', 'CANCELLED', 'KEPT', 'FAILED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "CancellationRunStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "PointBalanceKind" AS ENUM ('LOYALTY_POINTS', 'POP_PROGRESS');

-- CreateEnum
CREATE TYPE "PointsRegisterEntryType" AS ENUM ('EARNED', 'EXPECTED', 'REVERSAL', 'EXPIRATION', 'REDEMPTION', 'TRANSFER', 'MISSED_ESTIMATE', 'PROGRESS_AWARD', 'CORRECTION');

-- CreateEnum
CREATE TYPE "PointsRegisterStatus" AS ENUM ('CONFIRMED', 'PENDING', 'ESTIMATED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FinancialGoalKind" AS ENUM ('EMERGENCY_FUND', 'DEBT_PAYOFF', 'INVESTING', 'CASH_SAVINGS', 'PLANNED_PURCHASE', 'TRAVEL');

-- CreateEnum
CREATE TYPE "FinancialGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GameStopStatus" AS ENUM ('ACTIVE', 'PAUSED', 'RETIRED');

-- CreateEnum
CREATE TYPE "GameStopTaskType" AS ENUM ('COMPARE_OFFERS', 'SELECT_CARD', 'CHECK_REWARD_RULE', 'FIND_PROMOTION', 'SCAN_PRICE', 'REVIEW_BENEFIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "settings" JSONB,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "subtype" "AccountSubtype",
    "currency" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "maskedNumber" TEXT,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "bankAccountId" TEXT,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "statementPeriodStart" TIMESTAMP(3),
    "statementPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counterparty" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "CounterpartyType" NOT NULL DEFAULT 'VENDOR',
    "legalName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counterparty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reference" TEXT,
    "memo" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'POSTED',
    "source" "LedgerSource" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "createdById" TEXT,
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "counterpartyId" TEXT,
    "description" TEXT,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "documentId" TEXT,
    "journalEntryId" TEXT,
    "direction" "InvoiceDirection" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "memo" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopConnector" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "PopConnectorKind" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PopConnectorStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "detail" TEXT,
    "config" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastContentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PopConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "merchantId" TEXT,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "canonicalUrl" TEXT,
    "unitSize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "currentPriceCents" INTEGER NOT NULL,
    "originalPriceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "OfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceUrl" TEXT,
    "validFrom" TIMESTAMP(3),
    "validThrough" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceObservation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "unitPriceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sourceUrl" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceWatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "targetPriceCents" INTEGER NOT NULL,
    "currentPriceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "WatchStatus" NOT NULL DEFAULT 'WATCHING',
    "lastCheckedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "serviceKey" TEXT,
    "planName" TEXT,
    "billingChannel" TEXT,
    "accountHintHash" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "isBundle" BOOLEAN NOT NULL DEFAULT false,
    "isFamilyOrHousehold" BOOLEAN NOT NULL DEFAULT false,
    "sourceKind" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "cadence" "SubscriptionCadence" NOT NULL DEFAULT 'UNKNOWN',
    "nextRenewalAt" TIMESTAMP(3),
    "status" "PopSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "sourceFingerprint" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PopSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionService" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "domains" JSONB NOT NULL DEFAULT '[]',
    "category" "SubscriptionServiceCategory" NOT NULL DEFAULT 'OTHER',
    "automationSupported" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealOffer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "serviceId" TEXT,
    "serviceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "eligibility" "DealEligibility" NOT NULL DEFAULT 'UNKNOWN',
    "priceCents" INTEGER NOT NULL,
    "renewalPriceCents" INTEGER,
    "trialDays" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "DealOfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "verification" "DealVerificationState" NOT NULL DEFAULT 'OBSERVED',
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "validFrom" TIMESTAMP(3),
    "validThrough" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "confidenceBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "terms" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealAlert" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dealOfferId" TEXT NOT NULL,
    "serviceId" TEXT,
    "alertType" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuplicateCandidate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "DuplicateCandidateType" NOT NULL,
    "subscriptionAId" TEXT NOT NULL,
    "subscriptionBId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "confidenceBasisPoints" INTEGER NOT NULL,
    "status" "DuplicateCandidateStatus" NOT NULL DEFAULT 'NEW',
    "reasons" JSONB NOT NULL,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuplicateCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationPolicy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "autoCancelExactDuplicates" BOOLEAN NOT NULL DEFAULT false,
    "protectedServiceKeys" JSONB NOT NULL DEFAULT '[]',
    "protectedPlanKinds" JSONB NOT NULL DEFAULT '["family","bundle","annual","prepaid","contract"]',
    "recentlyUsedDays" INTEGER NOT NULL DEFAULT 30,
    "maxMonthlyAmountCents" INTEGER,
    "dailyDealAlerts" BOOLEAN NOT NULL DEFAULT true,
    "renewalAlerts" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "status" "CancellationRunStatus" NOT NULL DEFAULT 'PLANNED',
    "adapterKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "failureCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CancellationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationTask" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "status" "CancellationStatus" NOT NULL DEFAULT 'OPEN',
    "instructions" JSONB NOT NULL,
    "actionUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CancellationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "lastFour" TEXT,
    "annualFeeCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "programKey" TEXT NOT NULL,
    "kind" "PointBalanceKind" NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "lastEarnedAt" TIMESTAMP(3),
    "cashValueCentsPerThousand" INTEGER,
    "travelValueCentsPerThousand" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsRegisterEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT,
    "balanceKind" "PointBalanceKind" NOT NULL,
    "type" "PointsRegisterEntryType" NOT NULL,
    "status" "PointsRegisterStatus" NOT NULL,
    "pointsDelta" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "merchantName" TEXT,
    "category" TEXT,
    "city" TEXT,
    "coarseArea" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "estimatedCashValueCents" INTEGER,
    "estimatedTravelValueCents" INTEGER,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "idempotencyKey" TEXT NOT NULL,
    "correctionOfId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsRegisterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointValuation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT,
    "programKey" TEXT NOT NULL,
    "cashValueCentsPerThousand" INTEGER NOT NULL,
    "travelValueCentsPerThousand" INTEGER,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "validThrough" TIMESTAMP(3),
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendingProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "lookbackDays" INTEGER NOT NULL DEFAULT 365,
    "categorySummary" JSONB NOT NULL DEFAULT '[]',
    "merchantSummary" JSONB NOT NULL DEFAULT '[]',
    "lastCalculatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpendingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialGoal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "FinancialGoalKind" NOT NULL,
    "name" TEXT NOT NULL,
    "targetCents" INTEGER NOT NULL,
    "capturedCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "FinancialGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardBenefit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userCardId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "cadence" TEXT NOT NULL,
    "validThrough" TIMESTAMP(3),
    "activationRequired" BOOLEAN NOT NULL DEFAULT false,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitUsage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "usedCents" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenefitUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardScenario" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "goalId" TEXT,
    "name" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "estimatedValueCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "confidenceBasisPoints" INTEGER NOT NULL,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "RewardScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameStop" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "coarseArea" TEXT NOT NULL,
    "latitudeE6" INTEGER NOT NULL,
    "longitudeE6" INTEGER NOT NULL,
    "status" "GameStopStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "validThrough" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameStopEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "gameStopId" TEXT,
    "title" TEXT NOT NULL,
    "taskType" "GameStopTaskType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswerHash" TEXT NOT NULL,
    "pointsAward" INTEGER NOT NULL,
    "atHome" BOOLEAN NOT NULL DEFAULT false,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeThrough" TIMESTAMP(3),
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameStopEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameStopSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "gameStopId" TEXT,
    "coarseArea" TEXT,
    "atHome" BOOLEAN NOT NULL,
    "proximityDistanceMeters" INTEGER,
    "locationAccuracyMeters" INTEGER,
    "timezoneOffsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameStopSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameStopCompletion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "gameStopId" TEXT,
    "city" TEXT,
    "coarseArea" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameStopCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressAward" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "completionId" TEXT NOT NULL,
    "registerEntryId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsModePreference" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeUntil" TIMESTAMP(3),
    "cityWatchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cityWatchCities" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointsModePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userCardId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rateBasisPoints" INTEGER NOT NULL,
    "capCents" INTEGER,
    "validFrom" TIMESTAMP(3),
    "validThrough" TIMESTAMP(3),
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "estimatedSavingsCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "confidenceBasisPoints" INTEGER NOT NULL,
    "calculationInputs" JSONB NOT NULL,
    "evidenceIds" JSONB NOT NULL,
    "sourceTimestamps" JSONB NOT NULL,
    "assumptions" JSONB NOT NULL,
    "actionLabel" TEXT NOT NULL,
    "actionHref" TEXT,
    "expiresAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "summary" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionReceipt" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopNotification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PopNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopDevice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PopDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "devicePublicId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "entityVersion" INTEGER,
    "idempotencyKey" TEXT NOT NULL,
    "conflict" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "Account_workspaceId_type_isArchived_idx" ON "Account"("workspaceId", "type", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "Account_workspaceId_code_key" ON "Account"("workspaceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_accountId_key" ON "BankAccount"("accountId");

-- CreateIndex
CREATE INDEX "BankAccount_workspaceId_idx" ON "BankAccount"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_workspaceId_displayName_key" ON "BankAccount"("workspaceId", "displayName");

-- CreateIndex
CREATE INDEX "Document_workspaceId_type_idx" ON "Document"("workspaceId", "type");

-- CreateIndex
CREATE INDEX "Counterparty_workspaceId_legalName_idx" ON "Counterparty"("workspaceId", "legalName");

-- CreateIndex
CREATE INDEX "JournalEntry_workspaceId_entryDate_status_idx" ON "JournalEntry"("workspaceId", "entryDate", "status");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "JournalLine_counterpartyId_idx" ON "JournalLine"("counterpartyId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_documentId_key" ON "Invoice"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_journalEntryId_key" ON "Invoice"("journalEntryId");

-- CreateIndex
CREATE INDEX "Invoice_workspaceId_status_dueDate_idx" ON "Invoice"("workspaceId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_workspaceId_invoiceNumber_key" ON "Invoice"("workspaceId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "PopConnector_workspaceId_status_idx" ON "PopConnector"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PopConnector_workspaceId_kind_name_key" ON "PopConnector"("workspaceId", "kind", "name");

-- CreateIndex
CREATE INDEX "Merchant_workspaceId_domain_idx" ON "Merchant"("workspaceId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_workspaceId_name_key" ON "Merchant"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Product_workspaceId_title_idx" ON "Product"("workspaceId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Product_workspaceId_canonicalUrl_key" ON "Product"("workspaceId", "canonicalUrl");

-- CreateIndex
CREATE INDEX "Offer_workspaceId_status_validThrough_idx" ON "Offer"("workspaceId", "status", "validThrough");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_workspaceId_contentHash_key" ON "Offer"("workspaceId", "contentHash");

-- CreateIndex
CREATE INDEX "PriceObservation_workspaceId_productId_observedAt_idx" ON "PriceObservation"("workspaceId", "productId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceObservation_workspaceId_idempotencyKey_key" ON "PriceObservation"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PriceWatch_workspaceId_status_idx" ON "PriceWatch"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "PopSubscription_workspaceId_status_nextRenewalAt_idx" ON "PopSubscription"("workspaceId", "status", "nextRenewalAt");

-- CreateIndex
CREATE INDEX "PopSubscription_workspaceId_serviceKey_status_idx" ON "PopSubscription"("workspaceId", "serviceKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PopSubscription_workspaceId_sourceFingerprint_key" ON "PopSubscription"("workspaceId", "sourceFingerprint");

-- CreateIndex
CREATE INDEX "SubscriptionService_workspaceId_category_idx" ON "SubscriptionService"("workspaceId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionService_workspaceId_canonicalKey_key" ON "SubscriptionService"("workspaceId", "canonicalKey");

-- CreateIndex
CREATE INDEX "DealOffer_workspaceId_serviceKey_eligibility_status_idx" ON "DealOffer"("workspaceId", "serviceKey", "eligibility", "status");

-- CreateIndex
CREATE INDEX "DealOffer_workspaceId_validThrough_idx" ON "DealOffer"("workspaceId", "validThrough");

-- CreateIndex
CREATE UNIQUE INDEX "DealOffer_workspaceId_contentHash_key" ON "DealOffer"("workspaceId", "contentHash");

-- CreateIndex
CREATE INDEX "DealAlert_workspaceId_readAt_createdAt_idx" ON "DealAlert"("workspaceId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DealAlert_workspaceId_fingerprint_key" ON "DealAlert"("workspaceId", "fingerprint");

-- CreateIndex
CREATE INDEX "DuplicateCandidate_workspaceId_status_idx" ON "DuplicateCandidate"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DuplicateCandidate_workspaceId_subscriptionAId_subscription_key" ON "DuplicateCandidate"("workspaceId", "subscriptionAId", "subscriptionBId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationPolicy_workspaceId_key" ON "AutomationPolicy"("workspaceId");

-- CreateIndex
CREATE INDEX "CancellationRun_workspaceId_status_createdAt_idx" ON "CancellationRun"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CancellationTask_workspaceId_status_idx" ON "CancellationTask"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "UserCard_workspaceId_issuer_idx" ON "UserCard"("workspaceId", "issuer");

-- CreateIndex
CREATE INDEX "PointsAccount_workspaceId_kind_expiresAt_idx" ON "PointsAccount"("workspaceId", "kind", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointsAccount_workspaceId_programKey_kind_key" ON "PointsAccount"("workspaceId", "programKey", "kind");

-- CreateIndex
CREATE INDEX "PointsRegisterEntry_workspaceId_occurredAt_idx" ON "PointsRegisterEntry"("workspaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "PointsRegisterEntry_workspaceId_balanceKind_status_type_idx" ON "PointsRegisterEntry"("workspaceId", "balanceKind", "status", "type");

-- CreateIndex
CREATE INDEX "PointsRegisterEntry_workspaceId_merchantName_category_occur_idx" ON "PointsRegisterEntry"("workspaceId", "merchantName", "category", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointsRegisterEntry_workspaceId_idempotencyKey_key" ON "PointsRegisterEntry"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PointValuation_workspaceId_programKey_observedAt_idx" ON "PointValuation"("workspaceId", "programKey", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpendingProfile_workspaceId_key" ON "SpendingProfile"("workspaceId");

-- CreateIndex
CREATE INDEX "FinancialGoal_workspaceId_status_kind_idx" ON "FinancialGoal"("workspaceId", "status", "kind");

-- CreateIndex
CREATE INDEX "RewardBenefit_workspaceId_validThrough_idx" ON "RewardBenefit"("workspaceId", "validThrough");

-- CreateIndex
CREATE INDEX "BenefitUsage_workspaceId_occurredAt_idx" ON "BenefitUsage"("workspaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "RewardScenario_workspaceId_calculatedAt_idx" ON "RewardScenario"("workspaceId", "calculatedAt");

-- CreateIndex
CREATE INDEX "GameStop_workspaceId_coarseArea_status_idx" ON "GameStop"("workspaceId", "coarseArea", "status");

-- CreateIndex
CREATE INDEX "GameStop_workspaceId_city_status_idx" ON "GameStop"("workspaceId", "city", "status");

-- CreateIndex
CREATE INDEX "GameStopEvent_workspaceId_activeFrom_activeThrough_atHome_idx" ON "GameStopEvent"("workspaceId", "activeFrom", "activeThrough", "atHome");

-- CreateIndex
CREATE INDEX "GameStopSession_workspaceId_userId_expiresAt_idx" ON "GameStopSession"("workspaceId", "userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameStopCompletion_sessionId_key" ON "GameStopCompletion"("sessionId");

-- CreateIndex
CREATE INDEX "GameStopCompletion_workspaceId_userId_completedAt_idx" ON "GameStopCompletion"("workspaceId", "userId", "completedAt");

-- CreateIndex
CREATE INDEX "GameStopCompletion_workspaceId_userId_gameStopId_completedA_idx" ON "GameStopCompletion"("workspaceId", "userId", "gameStopId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressAward_completionId_key" ON "ProgressAward"("completionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressAward_registerEntryId_key" ON "ProgressAward"("registerEntryId");

-- CreateIndex
CREATE INDEX "ProgressAward_workspaceId_createdAt_idx" ON "ProgressAward"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "PointsModePreference_userId_activeUntil_idx" ON "PointsModePreference"("userId", "activeUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PointsModePreference_workspaceId_userId_key" ON "PointsModePreference"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "RewardRule_workspaceId_category_validThrough_idx" ON "RewardRule"("workspaceId", "category", "validThrough");

-- CreateIndex
CREATE INDEX "Recommendation_workspaceId_dismissedAt_expiresAt_idx" ON "Recommendation"("workspaceId", "dismissedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "EvidenceRecord_workspaceId_observedAt_idx" ON "EvidenceRecord"("workspaceId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceRecord_workspaceId_contentHash_key" ON "EvidenceRecord"("workspaceId", "contentHash");

-- CreateIndex
CREATE INDEX "ActionReceipt_workspaceId_createdAt_idx" ON "ActionReceipt"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActionReceipt_workspaceId_idempotencyKey_key" ON "ActionReceipt"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PopNotification_workspaceId_readAt_createdAt_idx" ON "PopNotification"("workspaceId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "PopDevice_userId_revokedAt_idx" ON "PopDevice"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PopDevice_workspaceId_publicId_key" ON "PopDevice"("workspaceId", "publicId");

-- CreateIndex
CREATE INDEX "SyncEvent_workspaceId_createdAt_idx" ON "SyncEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncEvent_workspaceId_idempotencyKey_key" ON "SyncEvent"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_workspaceId_key_operation_key" ON "IdempotencyRecord"("workspaceId", "key", "operation");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counterparty" ADD CONSTRAINT "Counterparty_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PopConnector" ADD CONSTRAINT "PopConnector_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceWatch" ADD CONSTRAINT "PriceWatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceWatch" ADD CONSTRAINT "PriceWatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PopSubscription" ADD CONSTRAINT "PopSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionService" ADD CONSTRAINT "SubscriptionService_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealOffer" ADD CONSTRAINT "DealOffer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealOffer" ADD CONSTRAINT "DealOffer_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SubscriptionService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAlert" ADD CONSTRAINT "DealAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAlert" ADD CONSTRAINT "DealAlert_dealOfferId_fkey" FOREIGN KEY ("dealOfferId") REFERENCES "DealOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAlert" ADD CONSTRAINT "DealAlert_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SubscriptionService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_subscriptionAId_fkey" FOREIGN KEY ("subscriptionAId") REFERENCES "PopSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_subscriptionBId_fkey" FOREIGN KEY ("subscriptionBId") REFERENCES "PopSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationPolicy" ADD CONSTRAINT "AutomationPolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRun" ADD CONSTRAINT "CancellationRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRun" ADD CONSTRAINT "CancellationRun_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DuplicateCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRun" ADD CONSTRAINT "CancellationRun_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PopSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationTask" ADD CONSTRAINT "CancellationTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationTask" ADD CONSTRAINT "CancellationTask_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PopSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsAccount" ADD CONSTRAINT "PointsAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsRegisterEntry" ADD CONSTRAINT "PointsRegisterEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsRegisterEntry" ADD CONSTRAINT "PointsRegisterEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PointsAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsRegisterEntry" ADD CONSTRAINT "PointsRegisterEntry_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "PointsRegisterEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointValuation" ADD CONSTRAINT "PointValuation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointValuation" ADD CONSTRAINT "PointValuation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PointsAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingProfile" ADD CONSTRAINT "SpendingProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardBenefit" ADD CONSTRAINT "RewardBenefit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardBenefit" ADD CONSTRAINT "RewardBenefit_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitUsage" ADD CONSTRAINT "BenefitUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitUsage" ADD CONSTRAINT "BenefitUsage_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "RewardBenefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardScenario" ADD CONSTRAINT "RewardScenario_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardScenario" ADD CONSTRAINT "RewardScenario_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "FinancialGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStop" ADD CONSTRAINT "GameStop_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStopEvent" ADD CONSTRAINT "GameStopEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStopEvent" ADD CONSTRAINT "GameStopEvent_gameStopId_fkey" FOREIGN KEY ("gameStopId") REFERENCES "GameStop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStopSession" ADD CONSTRAINT "GameStopSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStopSession" ADD CONSTRAINT "GameStopSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GameStopEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStopSession" ADD CONSTRAINT "GameStopSession_gameStopId_fkey" FOREIGN KEY ("gameStopId") REFERENCES "GameStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStopCompletion" ADD CONSTRAINT "GameStopCompletion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStopCompletion" ADD CONSTRAINT "GameStopCompletion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameStopSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStopCompletion" ADD CONSTRAINT "GameStopCompletion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GameStopEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStopCompletion" ADD CONSTRAINT "GameStopCompletion_gameStopId_fkey" FOREIGN KEY ("gameStopId") REFERENCES "GameStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressAward" ADD CONSTRAINT "ProgressAward_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressAward" ADD CONSTRAINT "ProgressAward_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "GameStopCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressAward" ADD CONSTRAINT "ProgressAward_registerEntryId_fkey" FOREIGN KEY ("registerEntryId") REFERENCES "PointsRegisterEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsModePreference" ADD CONSTRAINT "PointsModePreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsModePreference" ADD CONSTRAINT "PointsModePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionReceipt" ADD CONSTRAINT "ActionReceipt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PopNotification" ADD CONSTRAINT "PopNotification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PopDevice" ADD CONSTRAINT "PopDevice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PopDevice" ADD CONSTRAINT "PopDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
