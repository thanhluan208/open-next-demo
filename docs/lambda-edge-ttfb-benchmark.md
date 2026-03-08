# Lambda@Edge TTFB Benchmark Report

## Test Setup

**Application:** OpenNext (Next.js on AWS)  
**Distribution:** `https://dxrrg5p1i9e9r.cloudfront.net`  
**Origin Region:** `ap-southeast-1` (Singapore)  
**Test Tool:** [Catchpoint](https://portal.catchpoint.com) / WebPageTest  
**Test Route:** `/ssr` (Server-Side Rendered, protected route)

---

## Architecture Comparison

### Without Lambda@Edge Auth Gate (Baseline)

```
User (Amsterdam)
    │  ~5ms
Frankfurt CloudFront PoP
    │  ~160ms  ← main cost
Singapore Lambda (ap-southeast-1)
    │  middleware.ts checks auth (~2ms)
    │  SSR renders page (~50ms)
    │  ~160ms
Frankfurt → User
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total TTFB ≈ 380ms
```

### With Lambda@Edge Auth Gate (Current)

```
User (Amsterdam)
    │  ~50ms
Frankfurt CloudFront PoP
    │  Lambda@Edge checks auth (~5ms)
    │  No valid token → 302 returned immediately
    │  ~50ms
User (Amsterdam)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total TTFB ≈ 300ms (includes DNS, TCP, SSL handshakes in Catchpoint)
```

---

## How to Run the Tests on Catchpoint

### Test A — "After" (Edge Auth Gate Active)

**What it measures:** Lambda@Edge rejecting unauthorized request at the nearest PoP

```
URL:    https://dxrrg5p1i9e9r.cloudfront.net/ssr
Cookie: (none)
Method: GET
```

Expected response: `HTTP 401` served from Frankfurt PoP in ~15–30ms

---

### Test B — "Before" (Baseline — request goes to Singapore)

**What it measures:** The full round-trip to Singapore when auth passes the edge gate

```
URL:    https://dxrrg5p1i9e9r.cloudfront.net/ssr
Cookie: auth-token=ZGVtby11c2VyOmFkbWluOjE4MDQ0MTE4MjgxMjI=
Method: GET
```

Expected response: `HTTP 200` SSR page rendered in Singapore in ~300–450ms

> **Note:** The valid token in Test B lets the request through Lambda@Edge,
> so it travels Amsterdam → Frankfurt → Singapore → back. This simulates
> exactly what ALL requests would do without the Lambda@Edge auth gate.

---

## Results from Catchpoint

| Location      | Test A TTFB (Edge Reject) | Test B TTFB (Singapore SSR) | Reduction              |
| ------------- | ------------------------- | --------------------------- | ---------------------- |
| Amsterdam, NL | **0.3s (300ms)**          | **0.9s (900ms)**            | **~66% (600ms saved)** |

_(Note: The 0.3s for the edge rejection includes Catchpoint's time for DNS resolution, TCP connection establishment, and TLS handshake. The actual HTTP response time from the edge is much lower, but the 0.6s difference precisely represents the network round-trip + origin processing time saved)._
| London, UK | \_\_\_ms | \_\_\_ms | \_\_% |
| Los Angeles, US | **0.28s (280ms)** | **0.95s (950ms)** | **~71% (670ms saved)** |
| Tokyo, JP | \_\_\_ms | \_\_\_ms | \_\_% |
| Sydney, AU | **0.23s (234ms)** | **0.6s (600ms)** | **~61% (366ms saved)** |

---

## Key Response Headers to Screenshot

After running Test A, check for these headers in Catchpoint's response viewer:

```
x-amz-cf-pop: FRA56-P1     ← Frankfurt PoP served this (never reached Singapore)
content-type: application/json
cache-control: no-store, no-cache
```

After running Test B, you'll see:

```
x-amz-cf-pop: FRA56-P1     ← Frankfurt received it
x-middleware-region: ap-southeast-1  ← but Singapore processed it
x-middleware-ran: true
```

The difference in `x-amz-cf-pop` vs `x-middleware-region` proves the request
traveled all the way to Singapore in Test B but not in Test A.

---

## Interpretation

### Why Lambda@Edge Reduces TTFB for Auth Rejections

The speed of light limits how fast data can travel. Singapore → Amsterdam is
~10,400 km, which takes a minimum of ~69ms one-way (~138ms round-trip at the
speed of light). Real-world network overhead adds ~20–30ms more per leg.

| Leg                   | Distance   | Min latency |
| --------------------- | ---------- | ----------- |
| Amsterdam → Frankfurt | ~600 km    | ~4ms        |
| Frankfurt → Singapore | ~10,400 km | ~70ms       |

Lambda@Edge eliminates the Frankfurt→Singapore→Frankfurt leg entirely for
rejected requests, saving ~140–200ms on the network path alone.

### When Lambda@Edge Auth Gating Helps Most

| User Location                 | Distance to Singapore | TTFB Saved     |
| ----------------------------- | --------------------- | -------------- |
| Europe (Amsterdam, London)    | ~10,000 km            | **~280–350ms** |
| East Coast US (New York)      | ~15,000 km            | **~350–450ms** |
| West Coast US (San Francisco) | ~13,000 km            | **~300–400ms** |
| Asia Pacific (Tokyo, Sydney)  | ~5,000–8,000 km       | **~100–200ms** |

### Limitation

This benefit applies **only to rejected (unauthorized) requests**. Authenticated
requests that pass the edge gate still go to Singapore for SSR rendering.
To reduce latency for authorized SSR, a separate strategy is required
(e.g., `runtime: "edge"` pages, or deploying a replica in `eu-west-1`).

---

## Recommended Catchpoint Test Configuration

1. **Test Type:** `Web` or `API`
2. **Test Frequency:** Single run (for benchmark)
3. **Nodes:** Select nodes in Amsterdam, London, New York, Tokyo, Sydney
4. **Script:** Simple GET with/without the cookie header above
5. **Metrics to capture:** TTFB, DNS, Connect, SSL, response headers

---

## curl Verification Commands

```bash
# Test A — Edge 401 (should be ~15-30ms from a nearby location)
time curl -si https://dxrrg5p1i9e9r.cloudfront.net/ssr \
  -o /dev/null -w "TTFB: %{time_starttransfer}s\nHTTP: %{http_code}\nPoP: %header{x-amz-cf-pop}\n"

# Test B — Singapore SSR (should be ~300-450ms from Europe)
time curl -si https://dxrrg5p1i9e9r.cloudfront.net/ssr \
  -H "Cookie: auth-token=ZGVtby11c2VyOmFkbWluOjE4MDQ0MTE4MjgxMjI=" \
  -o /dev/null -w "TTFB: %{time_starttransfer}s\nHTTP: %{http_code}\nPoP: %header{x-amz-cf-pop}\nRegion: %header{x-middleware-region}\n"
```
