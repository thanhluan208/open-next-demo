# ISR Request Flow Comparison

## ❌ BEFORE (Broken Configuration)

```
User visits /isr-on-demand
    ↓
CloudFront
    ↓
S3 (serves pre-rendered HTML)
    ↓
User sees timestamp: 2024-01-01T10:00:00Z
```

```
User clicks "Trigger Revalidation"
    ↓
POST /api/revalidate
    ↓
CloudFront → Lambda (Server Function)
    ↓
revalidatePath('/isr-on-demand')
    ↓
Updates DynamoDB cache
    ↓
Sends message to SQS queue
    ↓
Revalidation Function processes queue
    ↓
Cache updated in DynamoDB ✅
```

```
User refreshes page
    ↓
Next.js requests: /_next/data/<build-id>/isr-on-demand.rsc
    ↓
CloudFront routes to S3 ❌ (WRONG!)
    ↓
S3 serves OLD cached file
    ↓
User still sees: 2024-01-01T10:00:00Z ❌
```

## ✅ AFTER (Fixed Configuration)

```
User visits /isr-on-demand
    ↓
CloudFront
    ↓
S3 (serves pre-rendered HTML)
    ↓
User sees timestamp: 2024-01-01T10:00:00Z
```

```
User clicks "Trigger Revalidation"
    ↓
POST /api/revalidate
    ↓
CloudFront → Lambda (Server Function)
    ↓
revalidatePath('/isr-on-demand')
    ↓
Updates DynamoDB cache
    ↓
Sends message to SQS queue
    ↓
Revalidation Function processes queue
    ↓
Cache updated in DynamoDB ✅
```

```
User refreshes page
    ↓
Next.js requests: /_next/data/<build-id>/isr-on-demand.rsc
    ↓
CloudFront routes to Lambda ✅ (CORRECT!)
    ↓
Lambda checks DynamoDB cache
    ↓
Lambda finds revalidated content
    ↓
Lambda regenerates page with new timestamp
    ↓
User sees: 2024-01-01T10:05:00Z ✅
```

## Key Difference

| Request Type                      | Before (Broken) | After (Fixed) |
| --------------------------------- | --------------- | ------------- |
| `/isr-on-demand` (HTML)           | S3              | S3            |
| `/_next/data/*/isr-on-demand.rsc` | S3 ❌           | Lambda ✅     |
| `/api/revalidate`                 | Lambda          | Lambda        |
| `/_next/static/*`                 | S3              | S3            |

## Why This Matters

The `/_next/data/*` requests are how Next.js:

- Fetches data for client-side navigation
- Checks for revalidated content
- Implements ISR and on-demand revalidation

**Without routing these to Lambda, the revalidation logic never runs!**
