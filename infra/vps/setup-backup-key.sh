#!/usr/bin/env bash
set -euo pipefail
umask 077

env_file=${POP_ENV_FILE:-/etc/pop/pop.env}
key_file=${POP_BACKUP_AGE_KEY_FILE:-/etc/pop/backup-age-key.txt}

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

if [[ ! -f "$key_file" ]]; then
  age-keygen --output "$key_file" >/dev/null 2>&1
fi
chmod 0600 "$key_file"
recipient=$(age-keygen -y "$key_file")
temporary=$(mktemp "${env_file}.XXXXXX")

awk -v recipient="$recipient" '
  BEGIN { replaced = 0 }
  /^POP_BACKUP_AGE_RECIPIENT=/ {
    print "POP_BACKUP_AGE_RECIPIENT=" recipient
    replaced = 1
    next
  }
  { print }
  END {
    if (!replaced) print "POP_BACKUP_AGE_RECIPIENT=" recipient
  }
' "$env_file" > "$temporary"

chown --reference="$env_file" "$temporary"
chmod --reference="$env_file" "$temporary"
mv --force "$temporary" "$env_file"
echo "Encrypted backup recipient configured."
