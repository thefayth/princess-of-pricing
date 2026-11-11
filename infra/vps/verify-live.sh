#!/usr/bin/env bash
set -euo pipefail

: "${POP_ENV_FILE:=/etc/pop/pop.env}"
: "${POP_SEED_ENV_FILE:=/etc/pop/seed-owner.env}"
cookie_jar=$(mktemp /tmp/pop-verify-cookies-XXXXXX)
trap 'rm -f -- "$cookie_jar"' EXIT

set -a
# shellcheck disable=SC1090
source "$POP_ENV_FILE"
# shellcheck disable=SC1090
source "$POP_SEED_ENV_FILE"
set +a

payload=$(jq -n \
  --arg email "$SEED_EMAIL" \
  --arg password "$SEED_PASSWORD" \
  '{email: $email, password: $password}')
login=$(curl --fail --silent --show-error \
  --request POST \
  --header 'content-type: application/json' \
  --data "$payload" \
  http://127.0.0.1:4301/api/v1/auth/login)
token=$(jq -er '.token' <<<"$login")
workspace_id=$(jq -er '.workspaces[0].workspace.id' <<<"$login")

dashboard=$(curl --fail --silent --show-error \
  --header "authorization: Bearer $token" \
  "http://127.0.0.1:4301/api/v1/workspaces/$workspace_id/pop/dashboard")

jq -e '.pointsPalace.register | length > 0' <<<"$dashboard" >/dev/null
stops=$(curl --fail --silent --show-error \
  --header "authorization: Bearer $token" \
  "http://127.0.0.1:4301/api/v1/workspaces/$workspace_id/pop/game-stops?area=34.05%2C-118.25")
jq -e '(.stops | length > 0) and (.atHomeEvents | length > 0)' <<<"$stops" >/dev/null

bff_login=$(curl --fail --silent --show-error \
  --cookie-jar "$cookie_jar" \
  --request POST \
  --header 'content-type: application/json' \
  --data "$payload" \
  http://127.0.0.1:4300/api/pop/session)
jq -e '.csrfToken and (.workspaces | length > 0)' <<<"$bff_login" >/dev/null
session_cookie=$(awk '$6 == "pop_session" { print $7 }' "$cookie_jar")
csrf_cookie=$(awk '$6 == "pop_csrf" { print $7 }' "$cookie_jar")
if [[ -z "$session_cookie" || -z "$csrf_cookie" ]]; then
  echo "The browser session did not issue both protected cookies." >&2
  exit 1
fi

bff_dashboard=$(curl --fail --silent --show-error \
  --cookie "pop_session=$session_cookie; pop_csrf=$csrf_cookie" \
  "http://127.0.0.1:4300/api/pop/workspaces/$workspace_id/pop/dashboard")
jq -e '.pointsPalace.register | length > 0' <<<"$bff_dashboard" >/dev/null
echo "Authenticated API, browser BFF, Points Palace, and Game Stops verification passed."
