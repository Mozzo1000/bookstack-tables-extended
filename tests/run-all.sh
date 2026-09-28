#!/usr/bin/env bash
# Runs run-version.sh for every supported BookStack release, then for Lexical mode where it exists.
# Takes roughly 3 minutes per release. Edit the lists below when adding or removing a supported version.
#
#   bash tests/run-all.sh
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TINYMCE_VERSIONS=(
  version-v23.05 version-v23.12.3 version-v24.02.3 version-v24.05.4 version-v24.10.3 version-v24.12.1
  version-v25.02 version-v25.05 version-v25.07 version-v25.11 version-v25.12
  version-v26.03.5 version-v26.05.5 version-v26.09
)
LEXICAL_VERSIONS=(
  version-v24.10.3 version-v24.12.1 version-v25.02 version-v25.05 version-v25.07 version-v25.11 version-v25.12
  version-v26.03.5 version-v26.05.5 version-v26.09
)

# Pause the development instance once for the whole batch (its data is kept) and restore it at the end.
cd "$HERE" || exit 3   # docker compose finds docker-compose.yml here
DEV_WAS_RUNNING=
if [ -n "$(docker compose ps -q --status running 2>/dev/null)" ]; then
  DEV_WAS_RUNNING=1
  echo "pausing the development instance (its data is kept)"
  docker compose stop >/dev/null 2>&1
fi
export BTE_DEV_PAUSED=1

failed=0
for v in "${TINYMCE_VERSIONS[@]}"; do
  bash "$HERE/run-version.sh" "$v" || failed=$((failed + 1))
done
for v in "${LEXICAL_VERSIONS[@]}"; do
  bash "$HERE/run-version.sh" "$v" lexical || failed=$((failed + 1))
done

if [ -n "$DEV_WAS_RUNNING" ]; then
  echo "starting the development instance again"
  docker compose up -d >/dev/null 2>&1
fi
echo "=== done: $failed run(s) failed"
exit $((failed > 0))
