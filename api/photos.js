/**
 * GET    /api/photos — list photos (public)
 * POST   /api/photos — add photo (protected by ADMIN_PASSWORD)
 * PATCH  /api/photos — update photo (protected by ADMIN_PASSWORD)
 * DELETE /api/photos — delete photo by id (protected by ADMIN_PASSWORD)
 * Storage: Vercel Blob (gallery/index.json) when BLOB_READ_WRITE_TOKEN is set.
 * Fallback: data/photos.json from repo.
 */
const { put, list } = require("@vercel/blob");
const fs = require("fs");
const path = require("path");

const INDEX_PATH = "gallery/index.json";

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
    const { blobs } = await list({ prefix: "gallery/" });
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
    const filePath = path.join(process.cwd(), "data", "photos.json");
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

      const sortBy = (req.url && new URL(req.url, "http://localhost").searchParams.get("sort")) || "";
      if (sortBy === "date") {
        function parseSortDate(p) {
          let d = (p.date || "").trim();
          let t = (p.time || "").trim();
          if (!d && !t && p.meta) {
            const parts = String(p.meta).split(/\s{2,}/);
            if (parts[1]) d = parts[1].trim();
            if (parts[2]) t = parts[2].trim();
          }
          if (d) {
            const str = t ? d + " " + t : d;
            const parsed = new Date(str);
            if (!isNaN(parsed.getTime())) return parsed.getTime();
          }
          if (p.createdAt) return new Date(p.createdAt).getTime();
          return 0;
        }
        data = [...data].sort((a, b) => parseSortDate(b) - parseSortDate(a));
      }

      res.status(200).json(data);
    } catch (e) {
      console.error("GET photos error:", e);
      res.status(500).json({ error: e.message || "Failed to load photos" });
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
      error:
        "Blob storage not configured. Create a Blob store in Vercel and add BLOB_READ_WRITE_TOKEN.",
    });
    return;
  }

  try {
    let items = await readFromBlob();
    if (items === null) items = readFromFile();
    if (!Array.isArray(items)) items = [];

    if (req.method === "DELETE") {
      const id = body.id || (req.url && new URL(req.url, "http://localhost").searchParams.get("id"));
      if (!id) {
        res.status(400).json({ error: "Missing photo id" });
        return;
      }
      const before = items.length;
      items = items.filter((p) => String(p.id) !== String(id));
      if (items.length === before) {
        res.status(404).json({ error: "Photo not found" });
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
        res.status(400).json({ error: "Missing photo id" });
        return;
      }
      const photo = items.find((p) => String(p.id) === String(id));
      if (!photo) {
        res.status(404).json({ error: "Photo not found" });
        return;
      }
      if (body.title !== undefined) photo.title = String(body.title);
      if (body.alt !== undefined) photo.alt = String(body.alt);
      if (body.meta !== undefined) photo.meta = String(body.meta);
      if (body.date !== undefined) photo.date = String(body.date);
      if (body.time !== undefined) photo.time = String(body.time);
      if (body.caption !== undefined) photo.caption = String(body.caption);
      if (body.category !== undefined)
        photo.category = ["polaroids", "film", "digital"].includes(body.category) ? body.category : photo.category;
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
      alt: body.alt || "",
      title: body.title || "",
      meta: body.meta || "",
      date: body.date || "",
      time: body.time || "",
      caption: body.caption || "",
      category: ["polaroids", "film", "digital"].includes(body.category)
        ? body.category
        : "digital",
      createdAt: new Date().toISOString(),
    };

    items.push(newItem);

    if (!(await writeToBlob(items))) {
      res.status(500).json({ error: "Failed to save" });
      return;
    }

    res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error(req.method + " photos error:", e);
    res.status(500).json({ error: e.message || "Failed" });
  }
};
