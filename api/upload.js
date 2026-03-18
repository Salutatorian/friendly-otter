/**
 * POST /api/upload — client upload token generator for Vercel Blob
 * The browser uploads directly to Blob (bypasses 4.5MB server limit). Supports up to 50MB, including raw formats (Sony ARW, SR2, SRF, etc.).
 * Protected by ADMIN_PASSWORD (header: Authorization: Bearer <password> or x-admin-password)
 */
const { handleUpload } = require("@vercel/blob/client");

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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(503).json({
      error:
        "Blob storage not configured. Create a Blob store in Vercel and add BLOB_READ_WRITE_TOKEN.",
    });
    return;
  }

  const bodyText = await parseBodyRaw(req);
  const body = bodyText ? JSON.parse(bodyText) : {};
  const request = nodeRequestToWebRequest(req, bodyText);

  try {
    const jsonResponse = await handleUpload({
      body,
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
        maximumSizeInBytes: 50 * 1024 * 1024,
        addRandomSuffix: true,
      }),
    });

    res.status(200).json(jsonResponse);
  } catch (e) {
    console.error("Upload token error:", e);
    res.status(400).json({ error: e.message || "Failed to generate upload token" });
  }
};
