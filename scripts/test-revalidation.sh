#!/bin/bash

# Test script to manually trigger revalidation and check the response

CLOUDFRONT_URL="https://d3jfl11lito0ta.cloudfront.net"

echo "🧪 Testing ISR On-Demand Revalidation"
echo "======================================"
echo ""

echo "Step 1: Get current timestamp from page..."
echo "Fetching: $CLOUDFRONT_URL/isr-on-demand"
INITIAL_RESPONSE=$(curl -s "$CLOUDFRONT_URL/isr-on-demand")
INITIAL_TIME=$(echo "$INITIAL_RESPONSE" | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\.[0-9]\{3\}Z' | head -1)
echo "Initial timestamp: $INITIAL_TIME"
echo ""

echo "Step 2: Trigger revalidation..."
REVALIDATE_RESPONSE=$(curl -s -X POST "$CLOUDFRONT_URL/api/revalidate" \
  -H "Content-Type: application/json" \
  -d '{"path":"/isr-on-demand"}')
echo "Revalidation response: $REVALIDATE_RESPONSE"
echo ""

echo "Step 3: Wait 3 seconds for revalidation to complete..."
sleep 3
echo ""

echo "Step 4: Fetch page again..."
NEW_RESPONSE=$(curl -s "$CLOUDFRONT_URL/isr-on-demand")
NEW_TIME=$(echo "$NEW_RESPONSE" | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\.[0-9]\{3\}Z' | head -1)
echo "New timestamp: $NEW_TIME"
echo ""

echo "Step 5: Fetch the RSC data endpoint..."
BUILD_ID=$(cat .next/BUILD_ID)
RSC_URL="$CLOUDFRONT_URL/_next/data/$BUILD_ID/isr-on-demand.rsc"
echo "Fetching: $RSC_URL"
RSC_RESPONSE=$(curl -s "$RSC_URL")
echo "RSC Response (first 500 chars):"
echo "$RSC_RESPONSE" | head -c 500
echo ""
echo ""

echo "======================================"
echo "📊 Results:"
echo "======================================"
if [ "$INITIAL_TIME" = "$NEW_TIME" ]; then
  echo "❌ FAILED: Timestamp did NOT change"
  echo "   Initial: $INITIAL_TIME"
  echo "   After:   $NEW_TIME"
else
  echo "✅ SUCCESS: Timestamp changed!"
  echo "   Initial: $INITIAL_TIME"
  echo "   After:   $NEW_TIME"
fi
echo ""
