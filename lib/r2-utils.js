/**
 * Cloudflare R2 via S3-compatible API (@aws-sdk/client-s3).
 * Lives under /lib (not /api) so Vercel does not count this file as a Serverless Function.
 */
const crypto = require("crypto");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

function isR2Configured() {
  return !!(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_ENDPOINT &&
    process.env.R2_PUBLIC_BASE_URL
  );
}

function normalizeR2Endpoint(raw, bucket) {
  const ep = (raw || "").trim();
  if (!ep || !bucket) return ep;
  try {
    const u = new URL(ep);
    const parts = u.pathname.replace(/^\//, "").split("/").filter(Boolean);
    if (parts.length === 1 && parts[0] === bucket) {
      return u.origin;
    }
  } catch (e) {
    /* ignore */
  }
  return ep;
}

function getR2Client() {
  const bucket = process.env.R2_BUCKET_NAME;
  const endpoint = normalizeR2Endpoint(process.env.R2_ENDPOINT, bucket);
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

function publicUrlForKey(key) {
  const base = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const encoded = String(key)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${base}/${encoded}`;
}

function keyFromR2PublicUrl(url) {
  const base = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (!url || typeof url !== "string" || !base) return null;
  const clean = url.split("?")[0];
  if (!clean.startsWith(base)) return null;
  const path = clean.slice(base.length).replace(/^\//, "");
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function isR2PublicUrl(url) {
  return !!keyFromR2PublicUrl(url);
}

function safeFilename(name) {
  const base = String(name || "file").split(/[/\\]/).pop() || "file";
  const s = base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 160);
  return s || "file";
}

function uploadPrefixForContentType(contentType) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.startsWith("video/")) return "media/videos/";
  if (
    ct.startsWith("image/") ||
    ct === "application/octet-stream" ||
    ct === "image/x-sony-arw" ||
    ct === "image/raw"
  ) {
    return "gallery/";
  }
  return "uploads/";
}

async function fetchIndexJson(indexKey) {
  const url = publicUrlForKey(indexKey);
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  try {
    return JSON.parse(text || "[]");
  } catch {
    return null;
  }
}

async function putJsonKey(key, data) {
  const client = getR2Client();
  const body =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: "application/json; charset=utf-8",
    })
  );
}

async function putBufferKey(key, buffer, contentType) {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    })
  );
  return publicUrlForKey(key);
}

async function deleteObjectKey(key) {
  if (!key) return;
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })
  );
}

async function deleteByPublicUrl(url) {
  const key = keyFromR2PublicUrl(url);
  if (!key) return;
  try {
    await deleteObjectKey(key);
  } catch (e) {
    console.error("R2 delete (best-effort):", e.message || e);
  }
}

async function presignPutUpload(filename, contentType, _size) {
  const prefix = uploadPrefixForContentType(contentType);
  const key = `${prefix}${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeFilename(filename)}`;
  const ct =
    (contentType || "application/octet-stream").split(";")[0].trim() ||
    "application/octet-stream";
  const client = getR2Client();
  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });
  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 3600 });
  return {
    uploadUrl,
    url: publicUrlForKey(key),
    contentType: ct,
  };
}

function formatR2Error(err) {
  const raw = err && (err.message || String(err));
  return raw || "R2 storage request failed.";
}

async function uploadObjectBuffer(buffer, filename, contentType) {
  const prefix = uploadPrefixForContentType(contentType);
  const key = `${prefix}${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeFilename(filename)}`;
  const ct =
    (contentType || "application/octet-stream").split(";")[0].trim() ||
    "application/octet-stream";
  return putBufferKey(key, buffer, ct);
}

module.exports = {
  isR2Configured,
  publicUrlForKey,
  keyFromR2PublicUrl,
  isR2PublicUrl,
  fetchIndexJson,
  putJsonKey,
  putBufferKey,
  deleteByPublicUrl,
  presignPutUpload,
  formatR2Error,
  uploadObjectBuffer,
};
