#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Two-pass CDK deployment for OpenNext + Lambda@Edge middleware
#
# WHY TWO PASSES?
#   Lambda@Edge has no environment variables. OpenNext's middleware bundle
#   needs OPEN_NEXT_ORIGIN to know which Lambda Function URL to forward
#   requests to. Since we can't pass env vars, we patch the value directly
#   into the bundle at synth time — but the URL only exists after Pass 1.
#
# USAGE:
#   ./scripts/deploy.sh                  # Full two-pass deploy
#   ./scripts/deploy.sh --pass1-only     # Only deploy infrastructure
#   ./scripts/deploy.sh --pass2-only     # Only patch + redeploy edge function
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

STACK_NAME="OpenNextDemoStack"
LOG_FILE="/tmp/cdk-deploy-pass1.txt"
PASS1_ONLY=false
PASS2_ONLY=false

for arg in "$@"; do
  case $arg in
    --pass1-only) PASS1_ONLY=true ;;
    --pass2-only) PASS2_ONLY=true ;;
  esac
done

# ── Pass 1: Deploy infrastructure ────────────────────────────────────────────
if [ "$PASS2_ONLY" = false ]; then
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "  Pass 1: Deploying infrastructure + server function"
  echo "════════════════════════════════════════════════════════════════"
  echo ""

  npx open-next build

  (
    cd infrastructure
    cdk deploy "$STACK_NAME" \
      --require-approval never \
      --outputs-file /tmp/cdk-outputs.json \
      2>&1 | tee "$LOG_FILE"
  )

  echo ""
  echo "✅ Pass 1 complete"
fi

if [ "$PASS1_ONLY" = true ]; then
  echo ""
  echo "ℹ️  Pass 1 only — skipping Pass 2"
  echo "   To complete deployment, run:"
  echo "   ./scripts/deploy.sh --pass2-only"
  exit 0
fi

# ── Extract server function URL host from CDK outputs ────────────────────────
echo ""
echo "Extracting server function URL from CDK outputs..."

if [ -f /tmp/cdk-outputs.json ]; then
  SERVER_URL=$(cat /tmp/cdk-outputs.json \
    | grep -o '"ServerFunctionUrl": *"[^"]*"' \
    | grep -o 'https://[^"]*' \
    | head -1)
else
  # Fallback: parse from deploy log
  SERVER_URL=$(grep -oP 'ServerFunctionUrl\s*=\s*\Khttps://[^\s]+' "$LOG_FILE" \
    | head -1)
fi

if [ -z "$SERVER_URL" ]; then
  echo ""
  echo "❌ Failed to extract ServerFunctionUrl from CDK outputs."
  echo "   Check $LOG_FILE or /tmp/cdk-outputs.json"
  echo ""
  echo "   You can run Pass 2 manually:"
  echo "   cdk deploy $STACK_NAME --context serverFunctionUrlHost=<host>"
  exit 1
fi

# Extract just the host (strip https:// and trailing slash)
SERVER_HOST=$(echo "$SERVER_URL" | sed 's|https://||' | sed 's|/.*||')

echo "✅ Server function host: $SERVER_HOST"

# ── Pass 2: Patch middleware and redeploy ─────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Pass 2: Patching Lambda@Edge middleware + redeploying"
echo "════════════════════════════════════════════════════════════════"
echo ""

(
  cd infrastructure
  cdk deploy "$STACK_NAME" \
    --require-approval never \
    --context "serverFunctionUrlHost=$SERVER_HOST" \
    --outputs-file /tmp/cdk-outputs.json
)

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Print useful outputs
if [ -f /tmp/cdk-outputs.json ]; then
  echo "Stack outputs:"
  cat /tmp/cdk-outputs.json | \
    grep -E '"(DistributionUrl|ServerFunctionUrl|WebhookUrl)"' | \
    sed 's/^/  /'
fi

echo ""