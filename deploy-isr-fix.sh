#!/bin/bash

# ISR Fix Deployment Script
# This script rebuilds and redeploys the application with the ISR fix

set -e  # Exit on error

echo "🚀 Starting ISR Fix Deployment..."
echo ""

# Step 1: Clean previous builds
echo "📦 Step 1/3: Cleaning previous builds..."
rm -rf .next .open-next
echo "✅ Cleaned .next and .open-next directories"
echo ""

# Step 2: Build with OpenNext
echo "🔨 Step 2/3: Building with OpenNext..."
pnpm open-next
echo "✅ OpenNext build completed"
echo ""

# Step 3: Deploy to AWS
echo "☁️  Step 3/3: Deploying to AWS..."
cd infrastructure
cdk deploy --require-approval never
cd ..
echo "✅ Deployment completed"
echo ""

echo "🎉 ISR Fix Deployment Complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Visit your CloudFront URL"
echo "  2. Navigate to /isr-on-demand"
echo "  3. Note the timestamp"
echo "  4. Click 'Trigger Revalidation'"
echo "  5. Refresh the page"
echo "  6. Verify the timestamp has changed ✅"
echo ""
