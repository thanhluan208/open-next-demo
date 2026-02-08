# ISR vs On-Demand ISR: Understanding the Differences

## 🤔 **Should On-Demand ISR Have TTL?**

**Short Answer**: No, they are **different strategies** for different use cases.

## 📊 **Comparison Table**

| Feature                  | Normal ISR                     | On-Demand ISR                     |
| ------------------------ | ------------------------------ | --------------------------------- |
| **Revalidation Trigger** | Time-based (TTL)               | Manual API call                   |
| **Configuration**        | `export const revalidate = 60` | `export const revalidate = false` |
| **When to Regenerate**   | After TTL expires              | When you call `revalidatePath()`  |
| **Automatic Updates**    | ✅ Yes                         | ❌ No                             |
| **Control**              | ❌ No control over timing      | ✅ Full control                   |
| **Use Case**             | Predictable, periodic updates  | Event-driven updates              |

## 🎯 **Normal ISR (Time-Based Revalidation)**

### Configuration:

```typescript
export const revalidate = 60; // Revalidate every 60 seconds

async function getData() {
  const data = await fetchFromAPI();
  return data;
}

export default async function ISRPage() {
  const data = await getData();
  return <div>{data}</div>;
}
```

### How It Works:

1. Page is generated at build time
2. **After 60 seconds**, the next visitor triggers regeneration
3. Stale content is served while regenerating (stale-while-revalidate)
4. Fresh content is cached and served to subsequent visitors
5. **Repeats automatically** every 60 seconds

### Best For:

- ✅ Content that updates on a **predictable schedule**
- ✅ News sites (update every few minutes)
- ✅ Product listings (update hourly)
- ✅ Weather data (update every 10 minutes)
- ✅ Stock prices (update every minute)

## 🎯 **On-Demand ISR (Manual Revalidation)**

### Configuration:

```typescript
export const revalidate = false; // No automatic revalidation

async function getData() {
  const data = await fetchFromAPI();
  return data;
}

export default async function OnDemandISRPage() {
  const data = await getData();
  return <div>{data}</div>;
}
```

### How It Works:

1. Page is generated at build time
2. **Stays cached forever** (no TTL)
3. You manually call `revalidatePath('/page')` when content changes
4. Page is regenerated immediately
5. **Only updates when you trigger it**

### Best For:

- ✅ Content that updates **unpredictably**
- ✅ CMS-driven content (update when editor publishes)
- ✅ Blog posts (update when author edits)
- ✅ Product pages (update when inventory changes)
- ✅ User profiles (update when user edits)

## 🔄 **Can You Combine Both?**

**Yes!** You can have **both** time-based AND on-demand revalidation:

```typescript
export const revalidate = 3600; // Revalidate every hour (fallback)

async function getData() {
  const data = await fetchFromAPI();
  return data;
}

export default async function HybridPage() {
  const data = await getData();
  return <div>{data}</div>;
}
```

### Hybrid Behavior:

- **Automatic**: Regenerates every hour (TTL)
- **Manual**: Can also trigger via `revalidatePath()` anytime
- **Best of both worlds**: Regular updates + immediate updates when needed

### Use Cases for Hybrid:

- ✅ E-commerce: Update hourly + immediate update on stock change
- ✅ News: Update every 5 minutes + immediate update for breaking news
- ✅ Social media: Update every minute + immediate update on new post

## 📝 **Recommendation for Your Demo**

For your **demo page** (`/isr-on-demand`), I recommend:

### Option 1: Pure On-Demand (Current)

```typescript
export const revalidate = false; // No TTL
```

**Pros**:

- Clear demonstration of on-demand revalidation
- Shows full control over when updates happen
- No automatic updates to confuse the demo

**Cons**:

- Page never updates unless manually triggered

### Option 2: Hybrid Approach

```typescript
export const revalidate = 300; // 5 minutes as fallback
```

**Pros**:

- Demonstrates both patterns
- Page updates even if user forgets to trigger
- More realistic real-world scenario

**Cons**:

- Might confuse demo users (did it update from TTL or manual trigger?)

## 🎓 **Real-World Examples**

### E-commerce Product Page

```typescript
// Hybrid: Update hourly + on inventory change
export const revalidate = 3600; // 1 hour

async function getProduct(id: string) {
  const product = await db.products.findById(id);
  return product;
}

export default async function ProductPage({ params }) {
  const product = await getProduct(params.id);
  return <ProductDetails product={product} />;
}

// Webhook from inventory system:
// POST /api/revalidate
// { "path": "/products/123" }
```

### Blog Post

```typescript
// Pure on-demand: Only update when author edits
export const revalidate = false;

async function getPost(slug: string) {
  const post = await cms.getPost(slug);
  return post;
}

export default async function BlogPost({ params }) {
  const post = await getPost(params.slug);
  return <Article post={post} />;
}

// CMS webhook on publish/edit:
// POST /api/revalidate
// { "path": "/blog/my-post" }
```

### News Homepage

```typescript
// Time-based: Update every 2 minutes
export const revalidate = 120;

async function getLatestNews() {
  const news = await newsAPI.getLatest();
  return news;
}

export default async function NewsHome() {
  const news = await getLatestNews();
  return <NewsList news={news} />;
}

// No manual revalidation needed - automatic updates
```

## 🎯 **Decision Matrix**

| Question                         | Answer | Recommendation               |
| -------------------------------- | ------ | ---------------------------- |
| Do updates happen on a schedule? | Yes    | Use TTL (normal ISR)         |
| Do updates happen unpredictably? | Yes    | Use on-demand ISR            |
| Need both scheduled + immediate? | Yes    | Use hybrid (TTL + on-demand) |
| Content rarely changes?          | Yes    | Use on-demand only           |
| Content changes constantly?      | Yes    | Use SSR instead              |

## 💡 **Key Insight**

**On-Demand ISR is NOT "ISR without TTL"** - it's a **different pattern**:

- **Normal ISR** = "Update this page every X seconds"
- **On-Demand ISR** = "Update this page when I tell you to"
- **Hybrid** = "Update every X seconds, but also when I tell you to"

## ✅ **My Recommendation for Your Demo**

Keep it **pure on-demand** (`revalidate = false`) because:

1. **Clear demonstration**: Shows the on-demand pattern clearly
2. **User control**: Timestamp only changes when user clicks button
3. **Educational**: Teaches the difference between ISR and on-demand ISR
4. **No confusion**: No automatic updates to muddy the waters

If you want to show **both patterns**, create separate demo pages:

- `/isr` - Time-based (already exists with `revalidate = 60`)
- `/isr-on-demand` - Manual only (`revalidate = false`)
- `/isr-hybrid` - Both (`revalidate = 300` + manual trigger)

## 📚 **Summary**

| Pattern            | Config                  | When to Use             |
| ------------------ | ----------------------- | ----------------------- |
| **Time-based ISR** | `revalidate = 60`       | Predictable updates     |
| **On-demand ISR**  | `revalidate = false`    | Event-driven updates    |
| **Hybrid ISR**     | `revalidate = 60` + API | Both scheduled + events |

**For your demo**: Stick with `revalidate = false` to clearly demonstrate on-demand revalidation! ✅
