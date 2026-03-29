/**
 * Shared storage helpers: Cloudflare R2 (preferred) or Vercel Blob fallback.
 * Under /lib so Vercel does not deploy this as its own Serverless Function.
 */
const { del, list, put } = require("@vercel/blob");
const {
  isR2Configured,
  fetchIndexJson,
  putJsonKey,
  deleteByPublicUrl,
  isR2PublicUrl,
  formatR2Error,
} = require("./r2-utils");

async function readIndexJsonFromBlob({ directUrl, listPrefix, indexPathname }) {
  if (isR2Configured()) {
    const data = await fetchIndexJson(indexPathname);
    if (data !== null) return data;
    return null;
  }

  const trimmed = typeof directUrl === "string" ? directUrl.trim() : "";
  if (trimmed.startsWith("http")) {
    try {
      const res = await fetch(trimmed);
      if (res.ok) {
        const text = await res.text();
        return JSON.parse(text || "[]");
      }
    } catch (e) {
      console.error("Blob index direct URL fetch error:", e.message || e);
    }
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { blobs } = await list({ prefix: listPrefix });
    const index = blobs.find((b) => b.pathname === indexPathname);
    if (!index?.url) return null;
    const res = await fetch(index.url);
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text || "[]");
  } catch {
    return null;
  }
}

async function writeIndexJsonToStorage(indexPathname, data) {
  if (isR2Configured()) {
    try {
      await putJsonKey(indexPathname, data);
    } catch (e) {
      console.error("R2 index write error:", e);
      const err = new Error(formatR2Error(e));
      err.status = 500;
      throw err;
    }
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const err = new Error(
      "Storage not configured. Add R2_* variables or BLOB_READ_WRITE_TOKEN."
    );
    err.status = 503;
    throw err;
  }
  try {
    await put(indexPathname, JSON.stringify(data, null, 2), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.error("Blob write error:", e);
    const err = new Error(formatBlobError(e));
    err.status = httpStatusForBlobError(e);
    throw err;
  }
}

function isVercelBlobUrl(url) {
  if (!url || typeof url !== "string") return false;
  return (
    url.includes(".blob.vercel-storage.com") ||
    url.includes("public.blob.vercel-storage") ||
    url.includes("vercel-storage.com/blob/")
  );
}

function formatBlobError(err) {
  const raw = err && (err.message || String(err));
  if (!raw) return "Storage request failed.";
  const lower = raw.toLowerCase();
  if (lower.includes("suspended")) {
    return (
      "Vercel Blob store is suspended — uploads are blocked. Fix: Vercel Dashboard → Storage → Blob → open your store and restore it (or create a new store). " +
      "Then add a fresh BLOB_READ_WRITE_TOKEN under Project → Settings → Environment Variables and redeploy."
    );
  }
  if (lower.includes("not found") && lower.includes("store")) {
    return "Blob store not found. Check BLOB_READ_WRITE_TOKEN matches an active Blob store in this Vercel project.";
  }
  return raw;
}

function httpStatusForBlobError(err) {
  const m = (err && err.message) || "";
  if (/suspended/i.test(m) || err?.name === "BlobStoreSuspendedError") return 503;
  return 500;
}

async function deleteBlobUrlBestEffort(url) {
  if (!url || typeof url !== "string") return;
  if (isR2PublicUrl(url) && isR2Configured()) {
    await deleteByPublicUrl(url);
    return;
  }
  if (!isVercelBlobUrl(url)) return;
  try {
    await del(url);
  } catch (e) {
    console.error("Blob delete (best-effort):", e.message || e);
  }
}

function isCloudStorageConfigured() {
  return isR2Configured() || !!process.env.BLOB_READ_WRITE_TOKEN;
}

module.exports = {
  isVercelBlobUrl,
  isR2PublicUrl,
  formatBlobError,
  httpStatusForBlobError,
  deleteBlobUrlBestEffort,
  readIndexJsonFromBlob,
  writeIndexJsonToStorage,
  isCloudStorageConfigured,
  isR2Configured,
};
