import Image from "next/image";

export default function ImageTestPage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Image Optimization Test CloudFront</h1>
      <p>
        This page tests if OpenNext image optimization is working correctly
        through CloudFront.
      </p>

      <div
        style={{
          display: "flex",
          gap: "2rem",
          marginTop: "2rem",
          flexWrap: "wrap",
        }}
      >
        {/* Optimized Image */}
        <div
          style={{
            border: "1px solid #ccc",
            padding: "1rem",
            borderRadius: "8px",
          }}
        >
          <h2>Optimized Image</h2>
          <p>
            Should load through <code>/_next/image</code> and be converted to
            WebP/AVIF.
          </p>
          <Image
            src="/test.jpg"
            alt="Optimized Test Image"
            width={400}
            height={300}
            style={{ objectFit: "cover", borderRadius: "4px" }}
          />
        </div>

        {/* Unoptimized Image */}
        <div
          style={{
            border: "1px solid #ccc",
            padding: "1rem",
            borderRadius: "8px",
          }}
        >
          <h2>Unoptimized Image</h2>
          <p>
            Should load the original <code>.jpg</code> directly from S3 assets
            bucket.
          </p>
          <Image
            src="/test.jpg"
            alt="Unoptimized Test Image"
            width={400}
            height={300}
            unoptimized
            style={{ objectFit: "cover", borderRadius: "4px" }}
          />
        </div>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h3>How to test:</h3>
        <ol>
          <li>Open your browser's Developer Tools (F12)</li>
          <li>
            Go to the <b>Network</b> tab and filter by <b>Img</b>
          </li>
          <li>Reload this page</li>
          <li>
            Click on the first image (Optimized) and check its headers:
            <ul>
              <li>
                <b>Type / Content-Type:</b> Should be <code>image/webp</code> or{" "}
                <code>image/avif</code>
              </li>
              <li>
                <b>x-cache:</b> First time will be{" "}
                <code>Miss from cloudfront</code>, reload again and it will be{" "}
                <code>Hit from cloudfront</code>
              </li>
            </ul>
          </li>
          <li>
            Click on the second image (Unoptimized):
            <ul>
              <li>
                It will load the exact original file type (
                <code>image/jpeg</code>)
              </li>
            </ul>
          </li>
        </ol>
      </div>
    </div>
  );
}
