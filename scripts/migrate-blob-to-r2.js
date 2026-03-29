/**
 * Copy all objects from Vercel Blob → Cloudflare R2 (same pathname = same key).
 * Rewrites Vercel Blob URLs inside .json bodies to R2_PUBLIC_BASE_URL.
 *
 * Prereqs (env): BLOB_READ_WRITE_TOKEN, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *               R2_BUCKET_NAME, R2_ENDPOINT, R2_PUBLIC_BASE_URL
 *
 * Usage (repo root):
 *   node scripts/migrate-blob-to-r2.js           # run migration
 *   node scripts/migrate-blob-to-r2.js --dry-run # list only
 *
 * Loads .env.local when present (does not override existing env vars).
 *
 * Downloads use @vercel/blob get() with your token (plain fetch() often gets HTTP 403
 * when the store requires auth or is over quota for anonymous reads).
 */
const fs = require("fs");
const path = require("path");
const { list, get } = require("@vercel/blob");
const { putBufferKey, isR2Configured, formatR2Error } = require("../lib/r2-utils");

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq < 1) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = val;
  });
}

function contentTypeForPathname(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

function r2BaseUrl() {
  return (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
}

async function collectAllBlobs(prefixFilter) {
  const out = [];
  let cursor;
  do {
    const opts = {
      limit: 1000,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    };
    if (cursor) opts.cursor = cursor;
    if (prefixFilter) opts.prefix = prefixFilter;
    const page = await list(opts);
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

function collectBlobOrigins(blobs) {
  const origins = new Set();
  for (const b of blobs) {
    const u = b.url || b.downloadUrl;
    if (!u) continue;
    try {
      origins.add(new URL(u).origin);
    } catch {
      /* ignore */
    }
  }
  return [...origins];
}

function rewriteBlobUrls(text, origins, r2Base) {
  let out = text;
  for (const o of origins) {
    if (out.includes(o)) out = out.split(o).join(r2Base);
  }
  return out;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const prefixArg = process.argv.find((a) => a.startsWith("--prefix="));
  const prefixFilter = prefixArg ? prefixArg.slice("--prefix=".length) : "";

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Missing BLOB_READ_WRITE_TOKEN");
    process.exit(1);
  }
  if (!isR2Configured()) {
    console.error(
      "R2 not fully configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT, R2_PUBLIC_BASE_URL"
    );
    process.exit(1);
  }

  const r2Base = r2BaseUrl();
  if (!r2Base) {
    console.error("R2_PUBLIC_BASE_URL is empty");
    process.exit(1);
  }

  console.log(
    dryRun ? "[dry-run] Listing blobs…" : "Listing blobs (this can take a while)…"
  );
  const blobs = await collectAllBlobs(prefixFilter || undefined);
  if (blobs.length === 0) {
    console.log("No blobs found.");
    process.exit(0);
  }

  const blobOrigins = collectBlobOrigins(blobs);
  if (blobOrigins.length === 0) {
    console.error("Could not derive any blob URL origins from list result.");
    process.exit(1);
  }
  console.log(`Blob origin(s): ${blobOrigins.join(", ")}`);
  console.log(`R2 public base: ${r2Base}`);
  console.log(`Objects: ${blobs.length}`);
  if (dryRun) {
    blobs.slice(0, 50).forEach((b) => console.log(`  - ${b.pathname} (${b.size} B)`));
    if (blobs.length > 50) console.log(`  … and ${blobs.length - 50} more`);
    console.log("[dry-run] Done. Remove --dry-run to upload.");
    process.exit(0);
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i];
    const key = b.pathname;
    if (!key) {
      console.warn(`Skip row ${i}: no pathname`);
      fail++;
      continue;
    }
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    /** Full URL from list() is correctly encoded (spaces etc.); pathname alone can break get(). */
    const getTarget = b.url || b.downloadUrl || key;
    try {
      let buf = null;
      let lastErr = null;
      for (const access of ["public", "private"]) {
        try {
          const g = await get(getTarget, { token, access });
          if (g && g.statusCode === 200 && g.stream) {
            buf = await streamToBuffer(g.stream);
            break;
          }
        } catch (e) {
          lastErr = e;
        }
      }
      if (!buf) {
        console.error(
          `FAIL get ${key}:`,
          lastErr ? lastErr.message || lastErr : "no body (check Blob quota / store status)"
        );
        fail++;
        continue;
      }
      let body = buf;
      let ct = contentTypeForPathname(key);
      if (key.toLowerCase().endsWith(".json")) {
        const text = buf.toString("utf8");
        const rewritten = rewriteBlobUrls(text, blobOrigins, r2Base);
        body = Buffer.from(rewritten, "utf8");
        if (rewritten !== text) {
          console.log(`  (rewrote URLs in JSON) ${key}`);
        }
      }
      await putBufferKey(key, body, ct);
      ok++;
      if ((i + 1) % 10 === 0 || i === blobs.length - 1) {
        console.log(`Progress: ${i + 1}/${blobs.length} (${ok} ok, ${fail} failed)`);
      }
    } catch (e) {
      console.error(`FAIL ${key}:`, formatR2Error(e) || e.message || e);
      fail++;
    }
  }

  console.log(`Done. Uploaded: ${ok}, failed: ${fail}`);
  if (fail > 0) {
    if (ok === 0 && fail === blobs.length) {
      console.error(
        "\nAll downloads failed. On Hobby, Vercel Blob often returns 403 on reads when you are over usage limits (see Storage → your store → usage).\n" +
          "Fix: upgrade the project to Pro, wait for your billing period reset, or download files from the Blob “Browser” in the dashboard and upload to R2 manually.\n"
      );
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
