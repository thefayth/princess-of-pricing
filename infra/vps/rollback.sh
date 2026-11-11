#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo "Run as root." >&2; exit 1; fi
previous=$(readlink -f /srv/pop/previous 2>/dev/null || true)
current=$(readlink -f /srv/pop/current 2>/dev/null || true)
[[ -n "$previous" && -d "$previous" ]] || { echo "No previous release is available." >&2; exit 1; }
ln -sfn "$current" /srv/pop/previous
ln -sfn "$previous" /srv/pop/current
systemctl restart pop-api pop-worker pop-web
curl -fsS --retry 10 --retry-delay 2 http://127.0.0.1:4301/api/v1/health >/dev/null
echo "Rolled back to $previous"
