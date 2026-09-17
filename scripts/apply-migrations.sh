#!/usr/bin/env bash
# Apply every file in supabase/migrations in name order against $DATABASE_URL.
# Stops at the first failing file. Idempotent files (IF NOT EXISTS) can be re-run.
#
#   DATABASE_URL=postgres://... scripts/apply-migrations.sh            # all files
#   DATABASE_URL=postgres://... scripts/apply-migrations.sh 202609170001  # only files >= this prefix
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to the target database (never a production URL from a dev machine without a backup)}"
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
