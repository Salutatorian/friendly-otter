/**
 * POST /api/upload
 * - Cloudflare R2 + JSON: presign | stagingInit | stagingComplete
 * - Cloudflare R2 + binary: direct file (≤ ~4.4 MB) or staging part (x-staging-token)
 * - Vercel Blob: JSON client upload body (handleUpload)
 * Protected by ADMIN_PASSWORD.
 */
const { handleUpload } = require("@vercel/blob/client");
const { formatBlobError, httpStatusForBlobError } = require("../lib/blob-utils");
const {
  isR2Configured,
  presignPutUpload,
  formatR2Error,
} = require("../lib/r2-utils");
const {
  readBodyBuffer,
  sendR2DirectResponse,
} = require("../lib/r2-direct-upload");
const {
  initStagingUpload,
  putStagingPart,
  finalizeStagingUpload,
} = require("../lib/r2-staging-upload");

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

  const bodyBuf = await readBodyBuffer(req);
  const ctype = primaryContentType(req);
  const r2JsonRequest = ctype === "application/json";

  if (isR2Configured()) {
    if (r2JsonRequest) {
      let body;
      try {
        body = bodyBuf.length ? JSON.parse(bodyBuf.toString("utf8")) : {};
      } catch {
        res.status(400).json({ error: "Invalid JSON body" });
        return;
      }

      if (body.action === "stagingInit") {
        try {
          const out = initStagingUpload(
            body.filename,
            body.contentType,
            body.fileSize
          );
          res.status(200).json(out);
        } catch (e) {
          const code = e.statusCode || 400;
          res.status(code).json({ error: e.message || "Staging init failed" });
        }
        return;
      }

      if (body.action === "stagingComplete") {
        try {
          const out = await finalizeStagingUpload(body.token);
          res.status(200).json(out);
        } catch (e) {
          console.error("R2 staging finalize error:", e);
          const code = e.statusCode || 500;
          res
            .status(code)
            .json({ error: e.message || formatR2Error(e) });
        }
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

    const stagingTok = req.headers["x-staging-token"];
    if (stagingTok) {
      const partRaw = req.headers["x-staging-part-index"];
      const partIndex = parseInt(partRaw, 10);
      if (!Number.isInteger(partIndex) || partIndex < 0) {
        res.status(400).json({ error: "Invalid x-staging-part-index" });
        return;
      }
      try {
        await putStagingPart(stagingTok, partIndex, bodyBuf);
        res.status(200).json({ ok: true });
      } catch (e) {
        console.error("R2 staging part error:", e);
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || formatR2Error(e) });
      }
      return;
    }

    let rawName = req.headers["x-upload-filename"] || "upload.bin";
    try {
      rawName = decodeURIComponent(rawName);
    } catch (e) {
      rawName = "upload.bin";
    }
    const objectType =
      ctype && ctype !== "application/octet-stream"
        ? ctype
        : "application/octet-stream";
    await sendR2DirectResponse(res, bodyBuf, rawName, objectType);
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
    blobBody = bodyBuf.length ? JSON.parse(bodyBuf.toString("utf8")) : {};
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  const request = nodeRequestToWebRequest(req, bodyBuf.toString("utf8"));

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
