/**
 * GET    /api/writings — list writings (public)
 * GET    /api/writings?slug=xxx — get single writing by slug (public)
 * POST   /api/writings — add writing (protected by ADMIN_PASSWORD)
 * PATCH  /api/writings — update writing (protected by ADMIN_PASSWORD)
 * DELETE /api/writings — delete writing by id (protected by ADMIN_PASSWORD)
 * Storage: Vercel Blob (writings/index.json) when BLOB_READ_WRITE_TOKEN is set.
 * Fallback: data/writings.json from repo.
 */
const { put } = require("@vercel/blob");
const fs = require("fs");
const path = require("path");
const { readIndexJsonFromBlob } = require("./blob-utils");

const INDEX_PATH = "writings/index.json";

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
    directUrl: process.env.BLOB_WRITINGS_INDEX_URL,
    listPrefix: "writings/",
    indexPathname: INDEX_PATH,
  });
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
    const filePath = path.join(process.cwd(), "data", "writings.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (e) {
    console.error("File read error:", e);
  }
  return [];
}

function toSlug(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "post";
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1, max-age=0, stale-while-revalidate");

  if (req.method === "GET") {
    try {
      let data = await readFromBlob();
      if (data === null) data = readFromFile();
      if (!Array.isArray(data)) data = [];

      const slug = req.url && new URL(req.url, "http://localhost").searchParams.get("slug");
      if (slug) {
        const post = data.find((w) => (w.slug || toSlug(w.title)) === slug);
        if (!post) {
          res.status(404).json({ error: "Post not found" });
          return;
        }
        res.status(200).json(post);
        return;
      }

      res.status(200).json(data);
    } catch (e) {
      console.error("GET writings error:", e);
      res.status(500).json({ error: e.message || "Failed to load writings" });
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
      error: "Blob storage not configured. Add BLOB_READ_WRITE_TOKEN to publish writings.",
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
        res.status(400).json({ error: "Missing id" });
        return;
      }
      const before = items.length;
      items = items.filter((w) => String(w.id) !== String(id));
      if (items.length === before) {
        res.status(404).json({ error: "Writing not found" });
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
        res.status(400).json({ error: "Missing id" });
        return;
      }
      const writing = items.find((w) => String(w.id) === String(id));
      if (!writing) {
        res.status(404).json({ error: "Writing not found" });
        return;
      }
      if (body.title !== undefined) {
        writing.title = String(body.title);
        writing.slug = toSlug(writing.title);
      }
      if (body.date !== undefined) writing.date = String(body.date);
      if (body.time !== undefined) writing.time = String(body.time);
      if (body.category !== undefined) writing.category = String(body.category);
      if (body.excerpt !== undefined) writing.excerpt = String(body.excerpt);
      if (body.body !== undefined) writing.body = String(body.body);
      if (!(await writeToBlob(items))) {
        res.status(500).json({ error: "Failed to save" });
        return;
      }
      res.status(200).json({ ok: true, updated: id });
      return;
    }

    const title = (body.title || "").trim();
    if (!title) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    const slug = toSlug(title);
    const id = String(Date.now());
    const newItem = {
      id,
      slug,
      title,
      date: (body.date || "mar 15, 2026").trim().toLowerCase(),
      time: (body.time || "10:21").trim(),
      category: (body.category || "learning").trim().toLowerCase(),
      excerpt: (body.excerpt || body.body || "").trim(),
      body: (body.body || body.excerpt || "").trim(),
      createdAt: new Date().toISOString(),
    };

    items.unshift(newItem);

    if (!(await writeToBlob(items))) {
      res.status(500).json({ error: "Failed to save" });
      return;
    }

    res.status(200).json({ ok: true, id, slug });
  } catch (e) {
    console.error(req.method + " writings error:", e);
    res.status(500).json({ error: e.message || "Failed" });
  }
};
