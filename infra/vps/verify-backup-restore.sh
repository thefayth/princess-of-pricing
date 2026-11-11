#!/usr/bin/env bash
set -euo pipefail
umask 077

backup_dir=${POP_BACKUP_DIR:-/var/backups/pop}
key_file=${POP_BACKUP_AGE_KEY_FILE:-/etc/pop/backup-age-key.txt}
restore_db="pop_restore_test_$$"
plain=$(mktemp /tmp/pop-restore-XXXXXX.dump)

cleanup() {
  runuser -u postgres -- dropdb --if-exists "$restore_db" >/dev/null 2>&1 || true
  rm -f -- "$plain"
}
trap cleanup EXIT

encrypted=$(find "$backup_dir" -maxdepth 1 -type f -name 'pop-*.dump.age' -printf '%T@ %p\n' \
  | sort -nr \
  | head -n 1 \
  | cut -d' ' -f2-)
if [[ -z "$encrypted" ]]; then
  echo "No encrypted PoP backup found." >&2
  exit 1
fi

sha256sum --check "${encrypted}.sha256" >/dev/null
age --decrypt --identity "$key_file" --output "$plain" "$encrypted"
chown postgres:postgres "$plain"
runuser -u postgres -- createdb "$restore_db"
runuser -u postgres -- pg_restore --dbname="$restore_db" "$plain"
register_count=$(runuser -u postgres -- psql --dbname="$restore_db" --tuples-only --no-align \
  --command 'SELECT count(*) FROM "PointsRegisterEntry";')

if [[ ! "$register_count" =~ ^[1-9][0-9]*$ ]]; then
  echo "Restored database did not contain Points Register fixtures." >&2
  exit 1
fi

echo "Encrypted backup restore verified with ${register_count} Points Register entries."
