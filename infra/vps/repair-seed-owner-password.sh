#!/usr/bin/env bash
set -euo pipefail
umask 077

env_file=${POP_ENV_FILE:-/etc/pop/pop.env}
seed_file=${POP_SEED_ENV_FILE:-/etc/pop/seed-owner.env}
temporary=$(mktemp "${seed_file}.XXXXXX")

tr -d '\r' < "$seed_file" > "$temporary"
chown --reference="$seed_file" "$temporary"
chmod --reference="$seed_file" "$temporary"
mv --force "$temporary" "$seed_file"

set -a
# shellcheck disable=SC1090
source "$env_file"
# shellcheck disable=SC1090
source "$seed_file"
set +a

cd /srv/pop/current
node --input-type=module <<'NODE'
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const email = process.env.SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_PASSWORD;
  if (!email || !password) throw new Error("Seed owner credentials are unavailable");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { email }, data: { passwordHash } });
  console.log("Seed owner password normalized and reset.");
} finally {
  await prisma.$disconnect();
}
NODE
