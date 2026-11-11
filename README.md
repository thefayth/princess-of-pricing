# Princess of Pricing

Princess of Pricing (PoP), formerly Prince of Pricing, is Faith Cheltenham's evidence-backed savings wallet inside an illustrated Savings Kingdom. Choose Royal Atlas, Rose Ledger, or Emerald Arcade from the theme menu; the same workspace data follows every look.

This repository contains the invite-only web application, shared packages, API, worker, and experimental Windows/Chromium companions. The canonical public app is https://pop.thefayth.net and proposed plans are at /plans. A source release is not proof that every experimental connector or desktop workflow is production-ready. See the release receipt for verified scope.

The target suite includes web/PWA, an encrypted Windows app, an activated Chromium companion, Fastify API, PostgreSQL-backed workers, and a FAD export bridge. Real loyalty points and non-cash PoP progress remain separate.

See [the roadmap](docs/ROADMAP.md), [design brief](docs/DESIGN_BRIEF.md), and [release policy](docs/RELEASE_POLICY.md).

Software source is intended to use AGPL-3.0-or-later. The name, mascot, logo, and artwork remain Faith-owned outside the software license.

## Development

Use Node.js 22.13 or later and native PostgreSQL. Run `npm ci`, `npm run db:generate`, `npm run db:deploy`, then `npm run dev:web` and `npm run dev:api` in separate terminals. Copy `.env.example` into an ignored local `.env` and supply your own credentials. Never import private statements or credentials into this repository. VPS service and rollback scripts are in `infra/vps`.

Run `npm test`, `npm --workspace @pop/api test`, `npm run check`, and `npm run audit:secrets`. The optional `tools/theme-browser-check.mts` uses Playwright against an isolated running candidate and labels its intercepted synthetic data; it is not a live-account test.

## Business Model

Optional paid plans and explicitly disclosed referrals fund the product. The $9/month and $79/year Plus prices are proposals, not an active checkout. Compensation is never a recommendation-ranking input. Private financial records are not for sale. No account, purchase, cancellation, redemption, or money movement is performed by changing a theme.
