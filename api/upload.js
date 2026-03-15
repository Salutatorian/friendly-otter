/**
 * POST /api/upload — upload image to Vercel Blob
 * Protected by ADMIN_PASSWORD (header: Authorization: Bearer <password> or x-admin-password)
 */
const { put } = require("@vercel/blob");
const formidable = require("formidable");
const fs = require("fs");
const path = require("path");

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false, maxFileSize: 4 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

function getAuth(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.headers["x-admin-password"] || "";
}

const handler = async (req, res) => {
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
      error: "Blob storage not configured. Create a Blob store in Vercel and add BLOB_READ_WRITE_TOKEN.",
    });
    return;
  }

  try {
    const { fields, files } = await parseForm(req);
    const file = files?.file?.[0] || files?.file;
    if (!file || !file.filepath) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const ext = path.extname(file.originalFilename || "") || ".jpg";
    const safeName = `photo-${Date.now()}${ext}`;
    const blobPath = `photos/${safeName}`;

    const buffer = fs.readFileSync(file.filepath);
    try { fs.unlinkSync(file.filepath); } catch (_) {}

    const blob = await put(blobPath, buffer, {
      access: "public",
      addRandomSuffix: false,
    });

    res.status(200).json({ url: blob.url });
  } catch (e) {
    console.error("Upload error:", e);
    res.status(500).json({ error: e.message || "Upload failed" });
  }
};
handler.config = { api: { bodyParser: false } };
module.exports = handler;
