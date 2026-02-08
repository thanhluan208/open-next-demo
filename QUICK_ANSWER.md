# Quick Answer: Vercel vs AWS ISR Behavior

## The Core Issue

```typescript
// This code:
export default function Page() {
  const timestamp = new Date().toISOString();
  return <div>{timestamp}</div>;
}
```

### On Vercel: ✅ Works

- Vercel **automatically** knows to regenerate the page
- Their proprietary cache system handles it
- No async needed

### On AWS/OpenNext: ❌ Doesn't Work

- OpenNext sees this as "truly static" (no async)
- The HTML is pre-built and stored in S3
- `revalidatePath()` updates cache metadata but doesn't regenerate
- Same HTML is served forever

## The Solution

```typescript
// Change to this:
async function getData() {
  const timestamp = new Date().toISOString();
  return { timestamp };
}

export default async function Page() {
  const { timestamp } = await getData();
  return <div>{timestamp}</div>;
}
```

### Why This Works on AWS:

- OpenNext sees the `async` keyword
- Knows the page can be regenerated
- On `revalidatePath()`, it calls the function again
- New timestamp is generated ✅

### Why This Still Works on Vercel:

- Vercel doesn't care either way
- Both patterns work on Vercel
- But only the async pattern is portable

## Analogy

Think of it like this:

**Vercel** = Automatic car

- You just press the gas, it handles the gears
- Easy, but you're locked into that car

**OpenNext** = Manual car

- You need to shift gears explicitly
- More work, but works with any manual car

## Bottom Line

**For portable code that works everywhere:**

- Always use `async function` for data fetching
- Even if it's just generating a timestamp
- This works on Vercel AND AWS AND anywhere else

**Vercel-specific code:**

- Can skip the async
- Simpler, but only works on Vercel
- Vendor lock-in
