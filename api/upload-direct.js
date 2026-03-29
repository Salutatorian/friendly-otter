/**
 * POST /api/upload-direct — same-origin upload to R2 (no browser CORS to r2.cloudflarestorage.com).
 * Body: raw file bytes. Headers: Content-Type, x-upload-filename (URI-encoded name).
 * Max ~4 MB (under Vercel's ~4.5 MB request body limit). Use presigned flow for larger files.
 */
const {
  isR2Configured,
  uploadObjectBuffer,
  formatR2Error,
} = require("./r2-utils");

const MAX_BYTES = 4 * 1024 * 1024;

function getAuth(req) {
  const auth = (req.headers.authorization || "").trim();
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.headers["x-admin-password"] || "";
}

function readBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const pw = getAuth(req);
  const adminPw = process.env.ADMIN_PASSWORD || "";
  if (!adminPw || pw !== adminPw) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!isR2Configured()) {
    res.status(503).json({ error: "R2 not configured" });
    return;
  }

  let rawName = req.headers["x-upload-filename"] || "upload.bin";
  try {
    rawName = decodeURIComponent(rawName);
  } catch (e) {
    rawName = "upload.bin";
  }

  const contentType =
    (req.headers["content-type"] || "application/octet-stream").split(";")[0].trim() ||
    "application/octet-stream";

  try {
    const buffer = await readBodyBuffer(req);
    if (buffer.length > MAX_BYTES) {
      res.status(413).json({
        error: `File too large for direct upload (${MAX_BYTES} bytes max). Use a smaller image or upload from a connection where presigned R2 upload works.`,
      });
      return;
    }
    if (buffer.length === 0) {
      res.status(400).json({ error: "Empty body" });
      return;
    }
    const url = await uploadObjectBuffer(buffer, rawName, contentType);
    res.status(200).json({ url, contentType });
  } catch (e) {
    console.error("upload-direct error:", e);
    res.status(500).json({ error: formatR2Error(e) });
  }
};
