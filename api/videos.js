/**
 * GET    /api/videos — list videos (public)
 * POST   /api/videos — add video (protected)
 * PATCH  /api/videos — update video (protected)
 * DELETE /api/videos — delete by id (protected)
 * Storage: Cloudflare R2 or Vercel Blob (media/videos/index.json)
 */
const fs = require("fs");
const path = require("path");
const {
  formatBlobError,
  deleteBlobUrlBestEffort,
  readIndexJsonFromBlob,
  writeIndexJsonToStorage,
  isCloudStorageConfigured,
} = require("./blob-utils");

const INDEX_PATH = "media/videos/index.json";

function getAuth(req) {
  const auth = (req.headers.authorization || "").trim();
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.headers["x-admin-password"] || "";
}

function parseBody(req) {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function readFromBlob() {
  return readIndexJsonFromBlob({
    directUrl: process.env.BLOB_VIDEOS_INDEX_URL,
    listPrefix: "media/videos/",
    indexPathname: INDEX_PATH,
  });
}

async function writeToBlob(data) {
  await writeIndexJsonToStorage(INDEX_PATH, data);
}

function readFromFile() {
  try {
    const filePath = path.join(process.cwd(), "data", "videos.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (e) {
    console.error("File read error:", e);
  }
  return [];
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");

  if (req.method === "GET") {
    try {
      let data = await readFromBlob();
      if (data === null) data = readFromFile();
      if (!Array.isArray(data)) data = [];
      const sortNew = (req.url && new URL(req.url, "http://localhost").searchParams.get("sort")) === "newest";
      if (sortNew) {
        data = [...data].sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
      }
      res.status(200).json(data);
    } catch (e) {
      console.error("GET videos error:", e);
      res.status(500).json({ error: e.message || "Failed to load videos" });
    }
    return;
  }

  if (req.method !== "POST" && req.method !== "DELETE" && req.method !== "PATCH") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const pw = getAuth(req);
  const body = await parseBody(req);
  const adminPw = process.env.ADMIN_PASSWORD || "";
  const password = pw || body.password || "";
  if (!adminPw || password !== adminPw) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!isCloudStorageConfigured()) {
    res.status(503).json({
      error: "Storage not configured. Set R2_* variables or BLOB_READ_WRITE_TOKEN.",
    });
    return;
  }

  try {
    let items = await readFromBlob();
    if (items === null) items = readFromFile();
    if (!Array.isArray(items)) items = [];

    if (req.method === "DELETE") {
      const id = body.id;
      if (!id) {
        res.status(400).json({ error: "Missing video id" });
        return;
      }
      const removed = items.find((v) => String(v.id) === String(id));
      if (!removed) {
        res.status(404).json({ error: "Video not found" });
        return;
      }
      const srcToRemove = removed.src;
      items = items.filter((v) => String(v.id) !== String(id));
      try {
        await writeToBlob(items);
      } catch (e) {
        res.status(e.status || 500).json({ error: e.message || "Failed to save" });
        return;
      }
      await deleteBlobUrlBestEffort(srcToRemove);
      res.status(200).json({ ok: true, deleted: id });
      return;
    }

    if (req.method === "PATCH") {
      const id = body.id;
      if (!id) {
        res.status(400).json({ error: "Missing video id" });
        return;
      }
      const video = items.find((v) => String(v.id) === String(id));
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }
      if (body.title !== undefined) video.title = String(body.title);
      if (body.description !== undefined) video.description = String(body.description);
      const prevSrc = video.src;
      if (body.src !== undefined && body.src) video.src = String(body.src);
      try {
        await writeToBlob(items);
      } catch (e) {
        res.status(e.status || 500).json({ error: e.message || "Failed to save" });
        return;
      }
      if (prevSrc && video.src && prevSrc !== video.src) {
        await deleteBlobUrlBestEffort(prevSrc);
      }
      res.status(200).json({ ok: true, updated: id });
      return;
    }

    const id = String(Date.now());
    const newItem = {
      id,
      src: body.src || "",
      title: (body.title || "").trim() || "Untitled",
      description: (body.description || "").trim(),
      createdAt: new Date().toISOString(),
    };

    items.push(newItem);

    try {
      await writeToBlob(items);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || "Failed to save" });
      return;
    }

    res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error(req.method + " videos error:", e);
    res.status(e.status || 500).json({ error: formatBlobError(e) });
  }
};
