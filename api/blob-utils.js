/**
 * Shared Vercel Blob helpers for API routes.
 */
const { del, list } = require("@vercel/blob");

/**
 * Load a public JSON index from Blob.
 * If `directUrl` is set, fetches that URL only (no list() — saves Advanced Operations).
 * Otherwise uses list() + fetch (one list per call — counts as Advanced).
 * @see https://vercel.com/docs/storage/vercel-blob/usage-and-pricing
 */
async function readIndexJsonFromBlob({ directUrl, listPrefix, indexPathname }) {
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

/** Best-effort delete; logs failures but does not throw (index already updated). */
async function deleteBlobUrlBestEffort(url) {
  if (!isVercelBlobUrl(url)) return;
  try {
    await del(url);
  } catch (e) {
    console.error("Blob delete (best-effort):", e.message || e);
  }
}

module.exports = {
  isVercelBlobUrl,
  formatBlobError,
  httpStatusForBlobError,
  deleteBlobUrlBestEffort,
  readIndexJsonFromBlob,
};
