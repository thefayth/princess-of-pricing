# Native VPS Deployment

PoP runs directly on Ubuntu with Node.js 22, PostgreSQL, systemd, and Nginx.
No container runtime is used. The API and web ports bind to loopback only.

## First install

1. Take a provider snapshot of `linveo-new` and copy `/etc/nginx` and `/etc/systemd/system` to a dated backup directory.
2. Upload this repository to a private staging directory on the VPS.
3. Run `sudo infra/vps/install-native.sh` from the repository root.
4. Add an optional `POP_BACKUP_RCLONE_REMOTE` to `/etc/pop/pop.env` without printing its value. The installer creates the local age identity automatically.
5. Run `sudo infra/vps/deploy-release.sh <release-id> <staging-directory>`.
6. Verify with `sudo /usr/local/sbin/pop-verify-live` and `sudo /usr/local/sbin/pop-verify-backup-restore`.

The installer enables the Nginx host on HTTP for private verification. DNS and
TLS are separate production gates. After the A record is approved and resolves,
use the existing VPS certificate workflow or `certbot --nginx -d pop.thefayth.net`.

## Operations

```bash
sudo systemctl status pop-api pop-worker pop-web
sudo journalctl -u pop-api -u pop-worker -u pop-web --since today
sudo /usr/local/sbin/pop-verify-live
sudo systemctl start pop-backup.service
sudo /usr/local/sbin/pop-verify-backup-restore
sudo infra/vps/rollback.sh
```

Releases live in `/srv/pop/releases`; `current` and `previous` are symlinks.
Database migrations are forward-only, so a release that adds a destructive
schema change must include its own reviewed data rollback. Current PoP migrations
are additive.

`pop-verify-backup-restore` verifies the checksum, decrypts the newest backup,
restores it to a disposable database, confirms Points Register data, and removes
both the temporary database and plaintext dump. It never writes to the live
database.
