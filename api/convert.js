/**
 * POST /api/convert — converts RAW camera files (ARW, SR2, DNG, etc.) to JPEG
 * Accepts a Vercel Blob URL of the uploaded RAW file, downloads it,
 * converts to JPEG via dcraw + sharp, uploads the JPEG to Blob, and
 * returns the new URL.
 *
 * Body: { "rawUrl": "<blob-url>", "password": "<admin-password>" }
 * Returns: { "ok": true, "url": "<jpeg-blob-url>" }
 */

const { put } = require("@vercel/blob");
const sharp = require("sharp");

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

    const filename = "converted-" + Date.now() + ".jpg";
    const blob = await put(filename, jpegBuffer, {
      access: "public",
      contentType: "image/jpeg",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({ ok: true, url: blob.url });
  } catch (err) {
    console.error("Convert error:", err);
    return res.status(500).json({ error: err.message || "Conversion failed" });
  }
};

function collectBody(req) {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => resolve(buf));
  });
}
