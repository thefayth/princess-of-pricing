#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_dir=/var/backups/pop
[[ "$backup_dir" == /var/backups/pop ]] || { echo "Unexpected backup path." >&2; exit 1; }
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${POP_BACKUP_AGE_RECIPIENT:?POP_BACKUP_AGE_RECIPIENT is required}"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
plain="$backup_dir/pop-${stamp}.dump"
encrypted="${plain}.age"
database_url="${DATABASE_URL%%\?*}"

pg_dump "$database_url" --format=custom --file="$plain"
age --recipient "$POP_BACKUP_AGE_RECIPIENT" --output "$encrypted" "$plain"
rm -f -- "$plain"
sha256sum "$encrypted" > "${encrypted}.sha256"
if [[ -n "${POP_BACKUP_RCLONE_REMOTE:-}" ]]; then
  rclone copyto "$encrypted" "${POP_BACKUP_RCLONE_REMOTE%/}/$(basename "$encrypted")"
  rclone copyto "${encrypted}.sha256" "${POP_BACKUP_RCLONE_REMOTE%/}/$(basename "${encrypted}.sha256")"
fi
find "$backup_dir" -maxdepth 1 -type f -name 'pop-*.dump.age*' -mtime +28 -delete
echo "Encrypted backup complete: $(basename "$encrypted")"
