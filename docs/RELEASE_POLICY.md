# Release and Source Policy

One monorepo covers PoP web/PWA, desktop, extension, API, worker and shared libraries. An independently deployed FAD plugin may use a separately reviewed repository. Each deployment links to its source commit and tag.

Import source through an explicit allowlist. Review filenames/contents and run secret/personal-data/license scans. Publish only synthetic fixtures. Exclude financial records, email content, credentials, raw coordinates, databases, private findings and unrelated archives.

Gates cover contracts/isolation, deterministic finance, responsive interactions, merchant fixture safety, Windows runtime, asset rights and backup restore/rollback. Tag only actual releases. Include source SHA, immutable build ID, tests, artifact hashes, migration notes and rollback instructions. Keep operator findings private.
