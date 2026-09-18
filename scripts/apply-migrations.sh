#!/usr/bin/env bash
# Apply every file in supabase/migrations in name order against $DATABASE_URL.
# Stops at the first failing file. Idempotent files (IF NOT EXISTS) can be re-run.
#
#   scripts/apply-migrations.sh                                         # all files, DATABASE_URL from env or .env
#   DATABASE_URL=postgres://... scripts/apply-migrations.sh 202609170001  # only files >= this prefix
set -euo pipefail
# Fall back to DATABASE_URL in .env (never committed) when it is not exported.
if [[ -z "${DATABASE_URL:-}" && -f "$(dirname "$0")/../.env" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$(dirname "$0")/../.env" | head -1 | cut -d= -f2- | tr -d "\"' ")"
fi
: "${DATABASE_URL:?set DATABASE_URL (env or .env) to the target database — a production URL means a production change}"
FROM="${1:-}"
DIR="$(cd "$(dirname "$0")/../supabase/migrations" && pwd)"
for f in "$DIR"/*.sql; do
  name="$(basename "$f")"
  if [[ -n "$FROM" && "$name" < "$FROM" ]]; then continue; fi
  echo "==> $name"
  # -1 = one transaction per file, the same way `supabase db push` applies them.
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -1 -f "$f"
done
echo "all migrations applied"
