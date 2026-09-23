#!/usr/bin/env bash
# Exercise the ERP push API the way Fameline IT will: health check, dry run, real push.
#
#   APP_URL=http://localhost:3000 API_KEY=flq_... scripts/dev/erp-push-sample.sh [so|po|both]
#
# The sample files include one deliberately invalid document each, so a healthy
# run ends with "failed: 1" and a per-document error in results[].
set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-}"
WHAT="${1:-both}"
DIR="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ -z "$API_KEY" ]]; then
  echo "API_KEY is required (create one at /portal/api-keys)" >&2
  exit 1
fi

json() { if command -v jq >/dev/null 2>&1; then jq .; else cat; echo; fi; }

echo "== GET /api/integration/v1/health"
curl -sS -w '\nHTTP %{http_code}\n' -H "X-API-Key: $API_KEY" "$APP_URL/api/integration/v1/health" | json

push() {
  local kind="$1" file="$2"
  echo
  echo "== POST /api/integration/v1/$kind?dry_run=1"
  curl -sS -w '\nHTTP %{http_code}\n' -X POST \
    -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" -H "X-Request-Id: sample-$kind-dry-$(date +%s)" \
    --data-binary "@$file" "$APP_URL/api/integration/v1/$kind?dry_run=1" | json
  echo
  echo "== POST /api/integration/v1/$kind"
  curl -sS -w '\nHTTP %{http_code}\n' -X POST \
    -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" -H "X-Request-Id: sample-$kind-$(date +%s)" \
    --data-binary "@$file" "$APP_URL/api/integration/v1/$kind" | json
}

case "$WHAT" in
  so) push sales-orders "$DIR/docs/integration/samples/sales-orders.json" ;;
  po) push purchase-orders "$DIR/docs/integration/samples/purchase-orders.json" ;;
  both)
    push sales-orders "$DIR/docs/integration/samples/sales-orders.json"
    push purchase-orders "$DIR/docs/integration/samples/purchase-orders.json"
    ;;
  *) echo "usage: $0 [so|po|both]" >&2; exit 1 ;;
esac
