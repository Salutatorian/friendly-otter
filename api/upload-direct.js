/**
 * POST /api/upload-direct — same-origin R2 upload (legacy path).
 * Prefer POST /api/upload with a non-JSON body (same behavior).
 */
const { isR2Configured, formatR2Error } = require("../lib/r2-utils");
const {
  readBodyBuffer,
  sendR2DirectResponse,
} = require("../lib/r2-direct-upload");

function getAuth(req) {
  const auth = (req.headers.authorization || "").trim();
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.headers["x-admin-password"] || "";
}

function primaryContentType(req) {
  return (req.headers["content-type"] || "application/octet-stream")
    .split(";")[0]
    .trim()
    .toLowerCase();
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

  const ctype = primaryContentType(req);
  const objectType =
    ctype && ctype !== "application/octet-stream"
      ? ctype
      : "application/octet-stream";

  try {
    const buffer = await readBodyBuffer(req);
    await sendR2DirectResponse(res, buffer, rawName, objectType);
  } catch (e) {
    console.error("upload-direct error:", e);
    res.status(500).json({ error: formatR2Error(e) });
  }
};
