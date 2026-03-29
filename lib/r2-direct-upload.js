/**
 * Same-origin R2 upload (buffer → PutObject). Shared by POST /api/upload (binary) and /api/upload-direct.
 * Max size stays under Vercel's ~4.5 MB request body limit.
 */
const { uploadObjectBuffer, formatR2Error } = require("./r2-utils");

/** ~4.5 MiB minus headroom for headers / encoding. */
const R2_DIRECT_MAX_BYTES = Math.floor(4.5 * 1024 * 1024) - 65536;

function readBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function sendR2DirectResponse(res, buffer, rawName, contentType) {
  if (buffer.length > R2_DIRECT_MAX_BYTES) {
    res.status(413).json({
      error: `File too large for direct upload (${R2_DIRECT_MAX_BYTES} bytes max). Use a smaller file or fix R2 bucket CORS for presigned PUT.`,
    });
    return;
  }
  if (buffer.length === 0) {
    res.status(400).json({ error: "Empty body" });
    return;
  }
  try {
    const url = await uploadObjectBuffer(buffer, rawName, contentType);
    res.status(200).json({ url, contentType });
  } catch (e) {
    console.error("R2 direct buffer upload error:", e);
    res.status(500).json({ error: formatR2Error(e) });
  }
}

module.exports = {
  R2_DIRECT_MAX_BYTES,
  readBodyBuffer,
  sendR2DirectResponse,
};
