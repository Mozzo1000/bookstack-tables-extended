#!/usr/bin/env bash
# Runs run-version.sh for every supported BookStack release, then for Lexical mode where it exists.
# Takes roughly 3 minutes per release. Edit the lists below when adding or removing a supported version.
#
#   bash test/run-all.sh
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

failed=0
for v in "${TINYMCE_VERSIONS[@]}"; do
  bash "$HERE/run-version.sh" "$v" || failed=$((failed + 1))
done
for v in "${LEXICAL_VERSIONS[@]}"; do
  bash "$HERE/run-version.sh" "$v" lexical || failed=$((failed + 1))
done

echo "=== done: $failed run(s) failed"
exit $((failed > 0))
