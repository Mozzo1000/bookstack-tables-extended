#!/usr/bin/env bash
# Runs the end-to-end tests against one BookStack release.
#
#   bash test/run-version.sh <image-tag> [lexical]
#   bash test/run-version.sh version-v26.09
#   bash test/run-version.sh version-v26.09 lexical
#   PREPARE_ONLY=1 bash test/run-version.sh version-v26.09   # leave an instance running, skip tests
#
# Starts a fresh BookStack from ../docker-compose.yml (wiping any previous test data),
# installs the script into Custom HTML Head Content, creates fixture pages, and runs e2e.js.
# Screenshots are saved to screenshots/<version>[-lexical]/ in the repository root.
# Exit code: 0 all passed, 1 test failures, 3 environment problem.
export MSYS_NO_PATHCONV=1   # stop Git Bash rewriting container paths on Windows

TAG_ARG="${1:?usage: run-version.sh <image-tag> [lexical]}"
MODE="${2:-tinymce}"
# `pwd -W` gives a C:/... style path on Windows (Node cannot read Git Bash's /c/... paths);
# elsewhere it is unsupported and plain `pwd` is used.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && { pwd -W 2>/dev/null || pwd; })"
REPO="$(dirname "$HERE")"
LABEL="${TAG_ARG#version-}"
[ "$MODE" = lexical ] && LABEL="$LABEL-lexical"

DB="docker exec bookstack-tables-extended-db mariadb -ubookstack -pbookstack-test bookstackapp"

# Install test dependencies once.
if [ ! -d "$HERE/node_modules/playwright" ]; then
  (cd "$HERE" && npm install --no-audit --no-fund && npx playwright install chromium) || exit 3
fi

cd "$REPO" || exit 3
docker compose down -v >/dev/null 2>&1
BOOKSTACK_VERSION="$TAG_ARG" docker compose up -d >/dev/null 2>&1 || { echo "[$LABEL] docker compose up failed"; exit 3; }

# Wait until the migrations have created the admin user and the web app answers.
for _ in $(seq 1 90); do
  users=$($DB -N -e "select count(*) from users" 2>/dev/null)
  status=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:6875/login)
  [ "${users:-0}" -ge 1 ] && [ "$status" = "200" ] && break
  sleep 4
done
[ "${users:-0}" -ge 1 ] || { echo "[$LABEL] BookStack never became ready"; exit 3; }
sleep 5
echo "[$LABEL] running BookStack $(docker exec bookstack-tables-extended cat /app/www/version)"

# The settings table gained a `type` column in later releases, so try both shapes.
set_setting() {
  $DB -e "insert into settings (setting_key, \`value\`, created_at, updated_at, type) values ('$1','$2',now(),now(),'string') on duplicate key update \`value\`='$2';" 2>/dev/null \
    || $DB -e "insert into settings (setting_key, \`value\`, created_at, updated_at) values ('$1','$2',now(),now()) on duplicate key update \`value\`='$2';"
}

# Throwaway API token (id testtokenid, secret testsecret) used by fixtures.js.
HASH=$(docker exec bookstack-tables-extended php -r 'echo password_hash("testsecret", PASSWORD_BCRYPT);')
$DB -e "insert into api_tokens (name, token_id, secret, user_id, expires_at, created_at, updated_at) values ('bte','testtokenid','$HASH',1,'2099-01-01',now(),now());"

set_setting app-custom-head '<script src="/bookstack-tables-extended.js"></script>'
[ "$MODE" = lexical ] && set_setting app-editor wysiwyg2024

cd "$HERE" || exit 3
node fixtures.js >/dev/null || { echo "[$LABEL] creating fixtures failed"; exit 3; }

# PREPARE_ONLY=1 leaves the prepared instance running for manual testing, without running the tests.
if [ -n "$PREPARE_ONLY" ]; then
  echo "[$LABEL] instance ready at http://localhost:6875 (admin@admin.com / password); fixture book: Table Tests"
  exit 0
fi

OUT_DIR="$REPO/screenshots/$LABEL"
rm -rf "$OUT_DIR" && mkdir -p "$OUT_DIR"
EDITOR_MODE="$MODE" BS_VERSION="${LABEL%-lexical}" SHOTS_DIR="$OUT_DIR" node e2e.js 2>&1 | tee "$OUT_DIR/results.txt" \
  | grep -E 'FAIL|ALL PASSED|FAILED|body tag|editor:|editor-page|Error' | sed "s/^/[$LABEL] /"
exit "${PIPESTATUS[0]}"
