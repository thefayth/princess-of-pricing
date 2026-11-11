#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then echo "Run as root." >&2; exit 1; fi
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
stamp=$(date -u +%Y%m%dT%H%M%SZ)

install -d -m 0700 "/root/pop-preinstall-${stamp}"
cp -a /etc/nginx "/root/pop-preinstall-${stamp}/nginx"
cp -a /etc/systemd/system "/root/pop-preinstall-${stamp}/systemd-system"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib nginx age rclone rsync curl
id pop >/dev/null 2>&1 || useradd --system --create-home --home-dir /srv/pop --shell /usr/sbin/nologin pop
install -d -o pop -g pop -m 0750 /srv/pop/releases /var/log/pop
install -d -o root -g pop -m 0750 /etc/pop
install -d -o root -g root -m 0700 /var/backups/pop

if [[ ! -f /etc/pop/pop.env ]]; then
  db_password=$(openssl rand -hex 24)
  jwt_secret=$(openssl rand -hex 48)
  if runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='pop'" | grep -q 1; then
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE pop WITH LOGIN PASSWORD '${db_password}'"
  else
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE pop WITH LOGIN PASSWORD '${db_password}'"
  fi
  runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='pop'" | grep -q 1 || runuser -u postgres -- createdb --owner=pop pop
  sed -e "s|generated-on-server@|${db_password}@|" -e "s|JWT_SECRET=generated-on-server|JWT_SECRET=${jwt_secret}|" "$repo_root/infra/vps/pop.env.example" > /etc/pop/pop.env
  chown root:pop /etc/pop/pop.env
  chmod 0640 /etc/pop/pop.env
fi

install -m 0644 "$repo_root"/infra/vps/systemd/*.service /etc/systemd/system/
install -m 0644 "$repo_root"/infra/vps/systemd/*.timer /etc/systemd/system/
install -m 0750 "$repo_root/infra/vps/backup.sh" /usr/local/sbin/pop-backup
install -m 0750 "$repo_root/infra/vps/verify-live.sh" /usr/local/sbin/pop-verify-live
install -m 0750 "$repo_root/infra/vps/setup-backup-key.sh" /usr/local/sbin/pop-setup-backup-key
install -m 0750 "$repo_root/infra/vps/verify-backup-restore.sh" /usr/local/sbin/pop-verify-backup-restore
install -m 0644 "$repo_root/infra/vps/nginx/pop-rate-limit.conf" /etc/nginx/conf.d/pop-rate-limit.conf
install -m 0644 "$repo_root/infra/vps/nginx/pop.thefayth.net.conf" /etc/nginx/sites-available/pop.thefayth.net.conf
ln -sfn /etc/nginx/sites-available/pop.thefayth.net.conf /etc/nginx/sites-enabled/pop.thefayth.net.conf
/usr/local/sbin/pop-setup-backup-key
nginx -t
systemctl daemon-reload
systemctl reload nginx
systemctl enable pop-api.service pop-worker.service pop-web.service
systemctl enable --now pop-backup.timer
echo "Native PoP prerequisites installed. Deploy a release before starting services."
