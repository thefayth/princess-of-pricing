# Accounting Backend

This starter backend is designed for one login to manage both personal books and company books through the same API. It is built so you can attach it to a company website, an internal admin portal, or a mobile app without changing the accounting core.

## Stack

- Fastify + TypeScript
- Prisma + PostgreSQL
- JWT authentication
- Dual-workspace model for `PERSONAL` and `BUSINESS` ledgers
- Double-entry journal architecture

## What It Supports Today

- User registration and login
- Automatic personal workspace creation on sign-up
- Optional company workspace creation during sign-up
- Chart of accounts seeding for personal and business ledgers
- Workspace-aware accounts, bank accounts, and journal entries
- Trial balance reporting
- OpenAPI/Swagger UI at `/api/v1/docs`

## Quick Start

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up -d`.
3. Generate the Prisma client with `npm run prisma:generate`.
4. Create the database schema with `npm run prisma:migrate -- --name init`.
5. Start the API with `npm run dev`.

The API will run on `http://localhost:4000` by default.

## Suggested Deployment Shape

- Public website: `www.yourcompany.com`
- App shell or portal: `app.yourcompany.com`
- Accounting API: `api.yourcompany.com`
- File storage for receipts/statements: S3, Cloudflare R2, or Supabase Storage

## Next High-Value Additions

- Receipt and bank statement upload endpoints
- OCR/import jobs for PDFs already in this workspace
- Invoice and bill workflows
- Reconciliation UI and matching engine
- Balance sheet, P&L, and cash flow report endpoints
