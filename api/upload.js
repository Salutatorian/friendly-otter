/**
 * POST /api/upload — presigned PUT (Cloudflare R2) or Vercel Blob client upload.
 * R2 body: JSON { filename, contentType?, size? } → { uploadUrl, url, contentType }
 * Protected by ADMIN_PASSWORD.
 */
const { handleUpload } = require("@vercel/blob/client");
const { formatBlobError, httpStatusForBlobError } = require("./blob-utils");
const { isR2Configured, presignPutUpload, formatR2Error } = require("./r2-utils");

function getAuth(req) {
  const auth = (req.headers.authorization || "").trim();
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.headers["x-admin-password"] || "";
}

function parseBodyRaw(req) {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => resolve(buf));
  });
}

function nodeRequestToWebRequest(req, bodyText) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "localhost:3000";
  const url = `${protocol}://${host}${req.url}`;
  return new Request(url, {
    method: req.method || "POST",
    headers: req.headers,
    body: bodyText || undefined,
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

  const bodyText = await parseBodyRaw(req);

  if (isR2Configured()) {
    let body;
    try {
      body = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    if (!body.filename || typeof body.filename !== "string") {
      res.status(400).json({ error: "Missing filename" });
      return;
    }
    try {
      const out = await presignPutUpload(
        body.filename,
        body.contentType || "application/octet-stream",
        body.size
      );
      res.status(200).json(out);
    } catch (e) {
      console.error("R2 presign error:", e);
      res.status(500).json({ error: formatR2Error(e) });
    }
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(503).json({
      error:
        "Storage not configured. Add Cloudflare R2 env vars or BLOB_READ_WRITE_TOKEN.",
    });
    return;
  }

  let blobBody;
  try {
    blobBody = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  const request = nodeRequestToWebRequest(req, bodyText);

  try {
    const jsonResponse = await handleUpload({
      body: blobBody,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/x-sony-arw",
          "image/x-sony-sr2",
          "image/x-sony-srf",
          "image/x-arw",
          "image/x-dcraw",
          "image/raw",
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "application/octet-stream",
        ],
        maximumSizeInBytes: 1024 * 1024 * 1024,
        addRandomSuffix: true,
      }),
    });

    res.status(200).json(jsonResponse);
  } catch (e) {
    console.error("Upload token error:", e);
    const raw = String(e?.message || "").toLowerCase();
    const infraFailure =
      /suspended/.test(raw) ||
      e?.name === "BlobStoreSuspendedError" ||
      (raw.includes("not found") && raw.includes("store"));
    const status = infraFailure ? httpStatusForBlobError(e) : 400;
    res.status(status).json({
      error: formatBlobError(e) || "Failed to generate upload token",
    });
  }
};
