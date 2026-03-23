/**
 * GET    /api/videos — list videos (public)
 * POST   /api/videos — add video (protected)
 * PATCH  /api/videos — update video (protected)
 * DELETE /api/videos — delete by id (protected)
 * Storage: Vercel Blob (media/videos/index.json)
 */
const { put, list } = require("@vercel/blob");
const fs = require("fs");
const path = require("path");

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
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { blobs } = await list({ prefix: "media/videos/" });
    const index = blobs.find((b) => b.pathname === INDEX_PATH);
    if (!index?.url) return null;
    const res = await fetch(index.url);
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text || "[]");
  } catch {
    return null;
  }
}

async function writeToBlob(data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    await put(INDEX_PATH, JSON.stringify(data, null, 2), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return true;
  } catch (e) {
    console.error("Blob write error:", e);
    return false;
  }
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
  res.setHeader("Cache-Control", "s-maxage=1, max-age=0, stale-while-revalidate");

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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(503).json({
      error: "Blob storage not configured. Add BLOB_READ_WRITE_TOKEN.",
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
      const before = items.length;
      items = items.filter((v) => String(v.id) !== String(id));
      if (items.length === before) {
        res.status(404).json({ error: "Video not found" });
        return;
      }
      if (!(await writeToBlob(items))) {
        res.status(500).json({ error: "Failed to save" });
        return;
      }
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
      if (body.src !== undefined && body.src) video.src = String(body.src);
      if (!(await writeToBlob(items))) {
        res.status(500).json({ error: "Failed to save" });
        return;
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

    if (!(await writeToBlob(items))) {
      res.status(500).json({ error: "Failed to save" });
      return;
    }

    res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error(req.method + " videos error:", e);
    res.status(500).json({ error: e.message || "Failed" });
  }
};
