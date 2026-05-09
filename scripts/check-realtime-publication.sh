#!/usr/bin/env bash
# scripts/check-realtime-publication.sh
#
# Guard against forgotten Realtime publication lines per design-doc decision A4.
#
# For every `create table <name>` statement under supabase/migrations/*.sql,
# require ONE of:
#   1. The same line ends with `-- no-realtime` (table is intentionally NOT
#      published — e.g. write-only counters, lookup tables seeded server-side).
#   2. Some migration contains `alter publication supabase_realtime add table <name>;`.
#
# Exit 0 if every table has a realtime decision; exit 1 (with a diagnostic
# pointing at the offending file:line) otherwise.
#
# Usage:
#   scripts/check-realtime-publication.sh                  # default dir
#   MIGRATIONS_DIR=path/to/migrations scripts/check-realtime-publication.sh

set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-supabase/migrations}"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: migrations dir not found: $MIGRATIONS_DIR" >&2
  exit 2
fi

# Collect tables that appear in any `alter publication supabase_realtime add table <name>;`
publication_tables=$(
  grep -hE "^[[:space:]]*alter publication supabase_realtime add table " \
    "$MIGRATIONS_DIR"/*.sql 2>/dev/null \
    | sed -E 's/^[[:space:]]*alter publication supabase_realtime add table[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*).*/\1/' \
    | sort -u || true
)

errors=0

# Iterate every `create table <name>` line. We deliberately skip
# `create table if not exists` to keep the regex simple — none of our
# migrations use it, and adopting it later means the author should also
# add a publication decision for the new occurrence.
while IFS= read -r match; do
  [ -z "$match" ] && continue
  file="${match%%:*}"
  rest="${match#*:}"
  lineno="${rest%%:*}"
  line="${rest#*:}"

  # Extract table name (strip optional schema-qualified prefix like public.)
  table=$(printf '%s' "$line" \
    | sed -E 's/^[[:space:]]*create table[[:space:]]+(([a-zA-Z_][a-zA-Z0-9_]*)\.)?([a-zA-Z_][a-zA-Z0-9_]*).*/\3/')

  # Allow opt-out marker on the same line.
  if printf '%s' "$line" | grep -q -- "-- no-realtime"; then
    continue
  fi

  # Allow if any migration adds this table to the publication.
  if printf '%s\n' "$publication_tables" | grep -qx "$table"; then
    continue
  fi

  echo "MISSING REALTIME DECISION: $file:$lineno  table=$table" >&2
  echo "  Fix: add 'alter publication supabase_realtime add table $table;' in this or a later migration," >&2
  echo "       OR mark the create-table line with a trailing '-- no-realtime' comment if clients should not subscribe." >&2
  errors=$((errors + 1))
done < <(grep -nE "^[[:space:]]*create table[[:space:]]+[a-zA-Z_]" "$MIGRATIONS_DIR"/*.sql || true)

if [ "$errors" -gt 0 ]; then
  echo "" >&2
  echo "FAIL: $errors create-table statement(s) missing realtime decision" >&2
  exit 1
fi

echo "OK: every create-table statement has a realtime decision (publication or '-- no-realtime')"
