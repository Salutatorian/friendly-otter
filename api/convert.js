/**
 * POST /api/convert — RAW → JPEG. Downloads from URL, converts, uploads to R2 or Vercel Blob.
 */
const sharp = require("sharp");
const { put } = require("@vercel/blob");
const { isR2Configured, putBufferKey, formatR2Error } = require("./r2-utils");

function getAuth(req, body) {
  const auth = (req.headers.authorization || "").trim();
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.headers["x-admin-password"] || body.password || "";
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body;
  try {
    body = typeof req.body === "object" && req.body ? req.body : JSON.parse(await collectBody(req));
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const pw = getAuth(req, body);
  const adminPw = process.env.ADMIN_PASSWORD || "";
  if (!adminPw || pw !== adminPw) return res.status(401).json({ error: "Unauthorized" });

  const rawUrl = body.rawUrl;
  if (!rawUrl) return res.status(400).json({ error: "Missing rawUrl" });

  if (!isR2Configured() && !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: "Storage not configured. Set R2_* variables or BLOB_READ_WRITE_TOKEN.",
    });
  }

  try {
    const response = await fetch(rawUrl);
    if (!response.ok) throw new Error("Failed to download RAW file: " + response.status);
    const arrayBuf = await response.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuf);

    let jpegBuffer;

    const ext = rawUrl.split("?")[0].split(".").pop().toLowerCase();
    const rawExtensions = ["arw", "sr2", "srf", "dng", "cr2", "cr3", "nef", "orf", "raf", "rw2", "pef", "raw"];

    if (rawExtensions.includes(ext)) {
      const dcraw = require("dcraw");
      const tiffData = dcraw(rawBuffer, { exportAsTiff: true, useCameraWhiteBalance: true });
      jpegBuffer = await sharp(Buffer.from(tiffData))
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    } else {
      jpegBuffer = await sharp(rawBuffer)
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    }

    const key = "gallery/converted-" + Date.now() + ".jpg";

    if (isR2Configured()) {
      const url = await putBufferKey(key, jpegBuffer, "image/jpeg");
      return res.status(200).json({ ok: true, url });
    }

    const blob = await put(key, jpegBuffer, {
      access: "public",
      contentType: "image/jpeg",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return res.status(200).json({ ok: true, url: blob.url });
  } catch (err) {
    console.error("Convert error:", err);
    const msg = isR2Configured() ? formatR2Error(err) : err.message || "Conversion failed";
    return res.status(500).json({ error: msg });
  }
};

function collectBody(req) {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => resolve(buf));
  });
}
