# Princess Themes Release

Release ID: `20261110-princess-themes-r1`. Owner: Faith Cheltenham.

## Verified Scope

- Royal Atlas, Rose Ledger, and Emerald Arcade share the authenticated dashboard and preserve on-device appearance preferences across navigation/reload.
- Faith's approved blue/pink illustrated originals replace the starring Prince presentation. Original Kingdom and Prince source artwork remain preserved.
- Public `/plans` explains Free beta, proposed Plus pricing, memberships, and disclosed referrals. No payment processor, charge, enrollment, or affiliate account is activated.
- Device tokens are restricted to their issuing workspace's sync route; pairing consumption is atomic; public connector responses omit credential configuration. Gmail's metadata scan no longer sends an unsupported search query.
- The ignored Prisma migration baseline is included for reproducible installation. No new schema migration is introduced.

## Verification

Clean locked dependency installation and Prisma generation; domain, recommendations, game, theme, web SSR, extension, and API regression tests; API/worker/desktop checks; web/API/worker/desktop compilation; secret scan. Browser QA covers 1440x900, 1024x768, and 390x844: nine theme workflows, three public plans views, theme persistence, review dialog, loaded assets, no horizontal overflow, non-overlapping district labels, and signed-out gate/Google link. Synthetic data is intercepted only inside QA, not substituted for production records.

Browser fallback: the bundled in-app browser's native bridge could not initialize. Headless Chromium 151 via Playwright was used without occupying Faith's desktop. Tests caught and repaired UTC/client hydration drift and overlapping Rose map labels. Final reference and render images were inspected directly.

## Fidelity Decisions

1. Layout: Atlas preserves map plus right action column; Rose foregrounds the register; Emerald foregrounds the action strip and Palace progress.
2. Assets: use the existing clean environment, not screenshot-composite concepts containing illustrative labels or figures.
3. Portrait: exact original Faith illustrations with CSS circular framing, not regenerated full-body likenesses from the concept images.
4. Copy: real dashboard records replace illustrative merchant names, amounts, identities, deadlines, and account balances. Estimates are not asserted as verified savings.
5. Typography and controls: retain existing shared React/CSS/Lucide conventions, accessible live HTML, reduced motion, review-first actions, and optional avatar.
6. Mobile: action first, then district chapters; no tiny desktop map controls. Public plans retain a full-width illustrated hero and stacked pricing.

These are functional adaptations of the approved directions, not pixel-identical reproductions of the concept composites.

## Operations

Deploy only the verified source commit as an immutable native VPS release. Retain the previous symlink target. Encrypted PostgreSQL backup and disposable restoration passed before cutover. No DNS, Nginx, OAuth configuration, or live billing changes are needed. Check `/release.json` for deployed source/tag identity and health-check all three services after switching. Rollback uses `infra/vps/rollback.sh`.

## Remaining Suite Work

This release does not certify Gmail OAuth end to end, merchant-specific checkout restoration, real desktop vault/sync, Windows installers, all queue integrations, complete PWA install/share support, or paid billing. Those remain explicit completion milestones. A Muse task being sent or queued is not proof of acceptance or execution.
