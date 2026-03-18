/**
 * GET    /api/projects — list projects (public)
 * POST   /api/projects — add project (protected by ADMIN_PASSWORD)
 * PATCH  /api/projects — update project (protected by ADMIN_PASSWORD)
 * DELETE /api/projects — delete project by id (protected by ADMIN_PASSWORD)
 * Storage: Vercel Blob (projects/index.json) when BLOB_READ_WRITE_TOKEN is set.
 * Fallback: data/projects.json from repo (read-only for GET).
 */
const { put, list } = require("@vercel/blob");
const fs = require("fs");
const path = require("path");

const INDEX_PATH = "projects/index.json";

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
    const { blobs } = await list({ prefix: "projects/" });
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
    const filePath = path.join(process.cwd(), "data", "projects.json");
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
  res.setHeader("Cache-Control", "s-maxage=60");

  if (req.method === "GET") {
    try {
      let data = await readFromBlob();
      if (data === null) data = readFromFile();
      if (!Array.isArray(data)) data = [];
      res.status(200).json(data);
    } catch (e) {
      console.error("GET projects error:", e);
      res.status(500).json({ error: e.message || "Failed to load projects" });
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
      error: "Blob storage not configured. Add BLOB_READ_WRITE_TOKEN for projects.",
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
      items = items.filter((p) => String(p.id) !== String(id));
      if (items.length === before) {
        res.status(404).json({ error: "Project not found" });
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
      const project = items.find((p) => String(p.id) === String(id));
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      if (body.title !== undefined) project.title = String(body.title);
      if (body.description !== undefined) project.description = String(body.description);
      if (body.status !== undefined && ["now", "future", "done"].includes(body.status)) {
        project.status = body.status;
        if (body.status === "done" && !project.endDate) {
          const d = new Date();
          project.endDate = String(d.getFullYear()) + "-" + String(d.getMonth() + 1).padStart(2, "0");
        }
      }
      if (body.startDate !== undefined) project.startDate = body.startDate ? String(body.startDate) : null;
      if (body.endDate !== undefined) project.endDate = body.endDate ? String(body.endDate) : null;
      if (body.type !== undefined && ["life", "code"].includes(body.type)) project.type = body.type;
      if (!(await writeToBlob(items))) {
        res.status(500).json({ error: "Failed to save" });
        return;
      }
      res.status(200).json({ ok: true, updated: id });
      return;
    }

    const title = (body.title || "").trim();
    const id = String(Date.now());
    const status = ["now", "future", "done"].includes(body.status) ? body.status : "now";
    const type = ["life", "code"].includes(body.type) ? body.type : "life";
    const newItem = {
      id,
      title: title || "Untitled",
      description: (body.description || "").trim(),
      status,
      type,
      startDate: body.startDate ? String(body.startDate) : null,
      endDate: body.endDate ? String(body.endDate) : null,
      createdAt: new Date().toISOString(),
    };
    if (status === "now" && !newItem.startDate) {
      const d = new Date();
      newItem.startDate = String(d.getFullYear()) + "-" + String(d.getMonth() + 1).padStart(2, "0");
    }

    items.push(newItem);

    if (!(await writeToBlob(items))) {
      res.status(500).json({ error: "Failed to save" });
      return;
    }

    res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error(req.method + " projects error:", e);
    res.status(500).json({ error: e.message || "Failed" });
  }
};
