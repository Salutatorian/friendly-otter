/**
 * Apply R2 bucket CORS via S3 API (PutBucketCors).
 * The Cloudflare dashboard editor sometimes differs from what the S3 API accepts;
 * this matches patterns that fix browser presigned PUT + preflight.
 *
 * Usage (from repo root, with R2_* in environment):
 *   node scripts/set-r2-cors.js
 *
 * Or set R2_CORS_ORIGINS=comma,separated,origins (no spaces after commas, or encode carefully)
 */
const fs = require("fs");
const path = require("path");
const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2].replace(/^["']|["']$/g, "").trim();
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

function normalizeR2Endpoint(raw, bucket) {
  const ep = (raw || "").trim();
  if (!ep || !bucket) return ep;
  try {
    const u = new URL(ep);
    const parts = u.pathname.replace(/^\//, "").split("/").filter(Boolean);
    if (parts.length === 1 && parts[0] === bucket) return u.origin;
  } catch (e) {
    /* ignore */
  }
  return ep;
}

function defaultOrigins() {
  const fromEnv = process.env.R2_CORS_ORIGINS;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return [
    "https://thegreaterengine.xyz",
    "https://friendly-otter-c3x058x6y-salutatorians-projects.vercel.app",
    "https://friendly-otter-git-main-salutatorians-projects.vercel.app",
    "http://localhost:3000",
  ];
}

async function main() {
  loadEnvLocal();
  const bucket = process.env.R2_BUCKET_NAME;
  const endpoint = normalizeR2Endpoint(process.env.R2_ENDPOINT, bucket);
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    console.error(
      "Missing R2_BUCKET_NAME, R2_ENDPOINT, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY."
    );
    process.exit(1);
  }

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const origins = defaultOrigins();
  console.log("Applying CORS for origins:", origins.join(", "));

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag", "Content-Length"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );

  console.log("PutBucketCors OK. Wait ~30s, then try admin upload again.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
