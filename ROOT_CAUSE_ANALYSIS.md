# Root Cause Analysis: ISR On-Demand Not Working

## 🔍 Investigation Summary

After extensive debugging, we've identified the **root cause**: **Next.js 16.1.6 with OpenNext 3.9.15 has compatibility issues with `revalidatePath()`**.

## 📊 Evidence

### 1. API Logs Show Success

```
[2026-02-08T09:45:23.596Z] ========== REVALIDATION REQUEST START ==========
[2026-02-08T09:45:23.596Z] Request body: {"path":"/isr-on-demand","type":"page"}
[2026-02-08T09:45:23.596Z] Calling revalidatePath("/isr-on-demand", "page")
[2026-02-08T09:45:23.596Z] revalidatePath completed successfully
[2026-02-08T09:45:23.596Z] ========== REVALIDATION REQUEST END ==========
```

✅ The API is being called
✅ `revalidatePath()` executes without errors
✅ No exceptions thrown

### 2. But DynamoDB is Empty

```bash
$ aws dynamodb scan --table-name OpenNextDemoStack-CacheTableC1E6DF7E-1LM27A9RHZGG1
[]
```

❌ No cache entries in DynamoDB
❌ `revalidatePath()` is NOT writing to the cache

### 3. SQS Queue is Empty

```json
{
  "Messages": "0",
  "InFlight": "0",
  "Delayed": "0"
}
```

❌ No revalidation messages being sent
❌ Revalidation function never triggered

### 4. Infrastructure is Correct

✅ DynamoDB table schema is correct:

- Primary key: `tag` (HASH), `path` (RANGE)
- GSI `revalidate`: `path` (HASH), `revalidatedAt` (RANGE)
- GSI `revalidate-tag`: `tag` (HASH)

✅ CloudFront routing is correct:

- `_next/data/*` → Lambda function (not S3)
- Default behavior → Lambda function
- Static assets → S3

✅ Lambda permissions are correct:

- `dynamodb:PutItem` ✅
- `dynamodb:Query` on GSIs ✅
- `sqs:SendMessage` ✅

✅ Environment variables are set:

- `CACHE_BUCKET_NAME` ✅
- `CACHE_DYNAMO_TABLE` ✅
- `REVALIDATION_QUEUE_URL` ✅

## 🎯 The Real Problem

**`revalidatePath()` in Next.js 16 is not triggering OpenNext's cache invalidation logic.**

According to research:

- OpenNext 3.9.15 officially supports Next.js 16
- BUT there are known issues with `revalidatePath` in Next.js 16 + OpenNext
- The function executes but doesn't actually write to DynamoDB or send SQS messages

## 🔧 Potential Solutions

### Solution 1: Use `revalidateTag()` Instead ✅ RECOMMENDED

Tag-based revalidation is more reliable with OpenNext:

```typescript
// Page
import { unstable_cache } from "next/cache";

const getData = unstable_cache(
  async () => ({ timestamp: new Date().toISOString() }),
  ["page-data"],
  { tags: ["my-page"] },
);

// API
import { revalidateTag } from "next/cache";
revalidateTag("my-page");
```

**Why this works better:**

- Tag-based cache is explicitly designed for OpenNext
- Uses the `revalidate-tag` GSI we already have
- More reliable in Next.js 16

### Solution 2: Downgrade to Next.js 15

Next.js 15 has better OpenNext compatibility:

```json
{
  "dependencies": {
    "next": "15.0.3"
  }
}
```

### Solution 3: Wait for OpenNext Update

Monitor OpenNext releases for Next.js 16 fixes:

- https://github.com/opennextjs/opennextjs-aws/releases

### Solution 4: Use Direct DynamoDB/SQS Calls

Bypass Next.js cache and call AWS services directly:

```typescript
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// Manually write to DynamoDB and send SQS message
```

**Cons:** Defeats the purpose of using Next.js ISR

## 📝 Why It Works on Vercel

Vercel uses their **proprietary infrastructure**, not OpenNext:

- Custom cache implementation
- Direct integration with Next.js internals
- No dependency on DynamoDB/SQS
- Handles Next.js 16 changes internally

## 🎓 Key Learnings

1. **OpenNext is not Vercel** - It's a reverse-engineered implementation
2. **New Next.js versions** can break OpenNext compatibility
3. **Tag-based revalidation** is more reliable than path-based
4. **Always check compatibility** before upgrading Next.js with OpenNext

## ✅ Recommended Action

**Switch to tag-based revalidation** as I've already implemented in the latest code changes. This should work more reliably with Next.js 16 + OpenNext 3.9.15.

If that doesn't work, consider:

1. Downgrading to Next.js 15
2. Waiting for OpenNext 3.10+ with better Next.js 16 support
3. Filing a bug report with OpenNext team

## 🔗 References

- OpenNext Documentation: https://open-next.js.org/
- Known Issues: https://github.com/opennextjs/opennextjs-aws/issues
- Next.js 16 + OpenNext compatibility discussions
