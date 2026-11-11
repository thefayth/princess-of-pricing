#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then echo "Run as root." >&2; exit 1; fi
release_id=${1:?Usage: deploy-release.sh RELEASE_ID SOURCE_DIRECTORY}
source_dir=$(realpath "${2:?Usage: deploy-release.sh RELEASE_ID SOURCE_DIRECTORY}")
release_dir="/srv/pop/releases/${release_id}"
[[ -d "$source_dir" ]] || { echo "Source directory not found." >&2; exit 1; }
[[ ! -e "$release_dir" ]] || { echo "Release already exists: $release_dir" >&2; exit 1; }

install -d -o pop -g pop -m 0750 "$release_dir"
rsync -a --exclude node_modules --exclude .env --exclude .runtime --exclude .git "$source_dir/" "$release_dir/"
chown -R pop:pop "$release_dir"
chmod -R u+rwX,go-rwx "$release_dir"
runuser -u pop -- bash -lc "cd '$release_dir' && npm ci && npm run db:generate && npm run build"
set -a
source /etc/pop/pop.env
set +a
cd "$release_dir"
npm run db:deploy

previous=""
if [[ -L /srv/pop/current ]]; then previous=$(readlink -f /srv/pop/current 2>/dev/null || true); fi
[[ -d "$previous" ]] || previous=""
[[ -z "$previous" ]] || ln -sfn "$previous" /srv/pop/previous
ln -sfn "$release_dir" /srv/pop/current
systemctl restart pop-api pop-worker pop-web

if ! curl -fsS --retry 12 --retry-connrefused --retry-delay 2 http://127.0.0.1:4301/api/v1/health >/dev/null || ! curl -fsS --retry 12 --retry-connrefused --retry-delay 2 http://127.0.0.1:4300/ >/dev/null; then
  if [[ -n "$previous" ]]; then
    ln -sfn "$previous" /srv/pop/current
    systemctl restart pop-api pop-worker pop-web
  else
    systemctl stop pop-api pop-worker pop-web
    if [[ -L /srv/pop/current && "$(readlink -f /srv/pop/current 2>/dev/null || true)" == "$release_dir" ]]; then unlink /srv/pop/current; fi
  fi
  echo "Health check failed; active release state restored." >&2
  exit 1
fi
echo "Deployed $release_id. Previous release: ${previous:-none}"
