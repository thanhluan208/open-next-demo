# Testing Guide: On-Demand ISR

This guide is designed for anyone to easily test and verify that the "On-Demand ISR" (Incremental Static Regeneration) caching system is working correctly in the Next.js application.

You do not need to understand code or AWS infrastructure to perform this test!

---

## 🧪 How to Test the Feature

Follow these steps exactly to verify the system:

**Step 1: Open the Test Page**
Navigate to the deployed application in your web browser and go to the On-Demand ISR demo page:
_URL: `https://<your-cloudfront-domain>/isr-on-demand`_

**Step 2: Note the Current Timestamp**
On the page, you will see a card titled **"On-Demand ISR"**. Inside that card, there is a **Timestamp** displayed (showing the date and exact time).

- Write down or remember the seconds shown in this timestamp.

**Step 3: Test the Cache (The "Freeze" Test)**
Click your browser's **Refresh** button (or press Command+R / Ctrl+R) 3 or 4 times quickly.

- Look at the timestamp again. It should **NOT** have changed.
- _Why?_ Because the server is serving a saved (cached) version of the page, making it lightning-fast.

**Step 4: Trigger the Cache Clear**
Lower down on the page, under the "Interactive Demo" section, there should be a button to **Trigger Revalidation** (or clear the cache).

- Click that button.
- Wait about 2 to 3 seconds for the "success" message or for the system to process the request in the background.

**Step 5: Verify the Update**
Click your browser's **Refresh** button one more time.

- Look at the timestamp on the page.

---

## ✅ Definition of SUCCESS

The system is working perfectly if you see **BOTH** of the following behaviors:

1. **The caching works:** The timestamp stayed exactly the same when you refreshed the page in Step 3. (This proves the CDN and S3 cache are protecting the server).
2. **The manual update works:** After you clicked the Revalidate button in Step 4 and refreshed the page, the timestamp **jumped forward to a new time**, and then "froze" at that new time on subsequent refreshes. (This proves the DynamoDB streams and SQS queues successfully regenerated the page behind the scenes and cleared the CDN!).

---

## ❌ Definition of FAILURE

The system is experiencing an issue if you see **ANY** of the following behaviors:

- **Failure Scenario A (No Caching):** The timestamp changes to a new time _every single time_ you hit refresh, even without clicking the Revalidate button. This means the CDN caching is completely broken and your server is doing unnecessary work.
- **Failure Scenario B (Stuck Cache):** You click the Revalidate button, wait 5+ seconds, hit refresh, and the timestamp _never changes_. It stays stuck on the old time. This usually means the background SQS queues didn't fire, or the CloudFront cache invalidator failed to wipe the old page.

---

## 🔍 Advanced: Verifying via Network Headers (Optional)

If you want absolute, 100% proof that the cache is working correctly, you can look "under the hood" at the hidden messages the server sends directly to your browser. You can do this without any coding experience!

**Step 1: Open Developer Tools**

1. Right-click anywhere on the page and select **Inspect**.
2. A panel will open on the side or bottom of your screen. Click the **Network** tab at the top of that panel.

**Step 2: Refresh the Page**

1. Refresh the page (Command+R / Ctrl+R).
2. Look at the list of files that load in the Network tab. Click the very first one at the top (it's usually named `isr-on-demand`).

**Step 3: Read the Headers**

1. In the side panel that appears, look for the section titled **Response Headers**.
2. Look for the `X-Cache` header:
   - If it says **`Hit from cloudfront`**: The page was served instantly from the CDN cache (Success!).
   - If it says **`Miss from cloudfront`**: The page had to be fetched all the way from the background server/Lambda because the cache was empty or had just been cleared.

**How to fully test with headers:**

1. Refresh the page a few times. You should consistently see `X-Cache: Hit from cloudfront`.
2. Click the **Trigger Revalidation** button.
3. Refresh the page _once_. You should see `X-Cache: Miss from cloudfront` (because we just wiped the old cache!).
4. Refresh the page _again_. It should immediately jump back to `X-Cache: Hit from cloudfront` because the new layout has now been successfully cached.
