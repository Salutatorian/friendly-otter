/**
 * Multi-request R2 uploads for files larger than Vercel's ~4.5 MB body limit.
 * Chunks are stored under staging/{sessionId}/ then concatenated and moved to gallery/.
 */
const crypto = require("crypto");
const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const {
  getR2Client,
  uploadObjectBuffer,
  formatR2Error,
} = require("./r2-utils");

/**
 * Temporary chunk prefix (must be writable by your R2 API token).
 * Override with R2_STAGING_PREFIX if your token is restricted (e.g. only `gallery/polaroids/*`).
 */
function getStagingPrefix() {
  const raw = (process.env.R2_STAGING_PREFIX || "").trim();
  const base = raw || "gallery/_staging";
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/`;
}
/** Per-chunk cap under Vercel's ~4.5 MB limit (2 MiB — safer with proxies / framing). */
const STAGING_CHUNK_BYTES = 2 * 1024 * 1024;
/** Max assembled file (photos / media in admin). */
const STAGING_MAX_FILE_BYTES = 15 * 1024 * 1024;
const TOKEN_TTL_SEC = 2 * 60 * 60;

function stagingSecret() {
  return process.env.ADMIN_PASSWORD || "";
}

function signStagingToken(payload) {
  const secret = stagingSecret();
  if (!secret) throw new Error("ADMIN_PASSWORD required for staging uploads");
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

function verifyStagingToken(token) {
  if (!token || typeof token !== "string") {
    const e = new Error("Missing upload token");
    e.statusCode = 400;
    throw e;
  }
  const dot = token.indexOf(".");
  if (dot < 1) {
    const e = new Error("Invalid upload token");
    e.statusCode = 400;
    throw e;
  }
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const secret = stagingSecret();
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const e = new Error("Invalid upload token");
    e.statusCode = 403;
    throw e;
  }
  let payload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );
  } catch {
    const e = new Error("Invalid upload token");
    e.statusCode = 400;
    throw e;
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) {
    const e = new Error("Upload session expired");
    e.statusCode = 400;
    throw e;
  }
  return payload;
}

function partKey(sid, partIndex) {
  return `${getStagingPrefix()}${sid}/part-${String(partIndex).padStart(5, "0")}`;
}

function expectedPartSize(fileSize, partCount, partIndex) {
  if (partIndex < 0 || partIndex >= partCount) return -1;
  if (partIndex === partCount - 1) {
    return fileSize - partIndex * STAGING_CHUNK_BYTES;
  }
  return STAGING_CHUNK_BYTES;
}

function initStagingUpload(filename, contentType, fileSize) {
  const fsz = Number(fileSize);
  if (!Number.isFinite(fsz) || fsz <= 0) {
    const e = new Error("Invalid fileSize");
    e.statusCode = 400;
    throw e;
  }
  if (fsz > STAGING_MAX_FILE_BYTES) {
    const e = new Error(
      `File too large for chunked upload (max ${STAGING_MAX_FILE_BYTES} bytes). Use a smaller file or presigned upload.`
    );
    e.statusCode = 400;
    throw e;
  }
  const fn = String(filename || "").trim();
  if (!fn) {
    const e = new Error("Missing filename");
    e.statusCode = 400;
    throw e;
  }
  const ct = (contentType || "application/octet-stream").split(";")[0].trim();
  const partCount = Math.ceil(fsz / STAGING_CHUNK_BYTES);
  const sid = crypto.randomBytes(16).toString("hex");
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const token = signStagingToken({
    sid,
    fileSize: fsz,
    filename: fn,
    contentType: ct,
    partCount,
    exp,
  });
  return {
    token,
    partSize: STAGING_CHUNK_BYTES,
    partCount,
    maxFileBytes: STAGING_MAX_FILE_BYTES,
  };
}

async function putStagingPart(tokenStr, partIndex, buffer) {
  const p = verifyStagingToken(tokenStr);
  const { sid, fileSize, partCount } = p;
  if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= partCount) {
    const e = new Error("Invalid part index");
    e.statusCode = 400;
    throw e;
  }
  const need = expectedPartSize(fileSize, partCount, partIndex);
  if (buffer.length !== need) {
    const e = new Error(
      `Part ${partIndex} must be ${need} bytes (got ${buffer.length})`
    );
    e.statusCode = 400;
    throw e;
  }
  const client = getR2Client();
  const Key = partKey(sid, partIndex);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key,
        Body: buffer,
        ContentType: "application/octet-stream",
      })
    );
  } catch (e) {
    const raw = String(e && (e.message || e.Code || e.name) || e);
    const denied = /AccessDenied|access denied/i.test(raw) || e?.name === "AccessDenied";
    const err = new Error(
      denied
        ? "R2 denied writing a staging chunk (PutObject). In Cloudflare → R2 → API tokens, use Object Read & Write on this whole bucket (not a narrower path). Or set env R2_STAGING_PREFIX to a prefix your token is allowed to write (e.g. gallery/polaroids/.chunks), then redeploy."
        : formatR2Error(e)
    );
    err.statusCode = denied ? 403 : 500;
    throw err;
  }
}

async function getObjectBuffer(key) {
  const client = getR2Client();
  const out = await client.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })
  );
  const chunks = [];
  for await (const chunk of out.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function finalizeStagingUpload(tokenStr) {
  const p = verifyStagingToken(tokenStr);
  const { sid, fileSize, filename, contentType, partCount } = p;
  /** Deterministic keys — no ListObjectsV2 (many R2 tokens deny s3:ListBucket). */
  const keys = [];
  for (let i = 0; i < partCount; i++) {
    keys.push(partKey(sid, i));
  }
  const bufs = [];
  for (let i = 0; i < keys.length; i++) {
    try {
      bufs.push(await getObjectBuffer(keys[i]));
    } catch (e) {
      const raw = String(e && (e.message || e.Code || e.name) || e);
      const denied = /AccessDenied|access denied/i.test(raw);
      const msg = denied
        ? "R2 denied reading a staging part (check API token can GetObject on this bucket or gallery/*)."
        : `Missing or unreadable upload part ${i} (${raw})`;
      const err = new Error(msg);
      err.statusCode = denied ? 403 : 400;
      throw err;
    }
  }
  const full = Buffer.concat(bufs);
  if (full.length !== fileSize) {
    const e = new Error("Assembled size does not match declared file size");
    e.statusCode = 400;
    throw e;
  }
  const url = await uploadObjectBuffer(full, filename, contentType);
  const client = getR2Client();
  for (const key of keys) {
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
        })
      );
    } catch (e) {
      console.error("staging cleanup:", key, e.message || e);
    }
  }
  const ct =
    (contentType || "application/octet-stream").split(";")[0].trim() ||
    "application/octet-stream";
  return { url, contentType: ct };
}

module.exports = {
  STAGING_CHUNK_BYTES,
  STAGING_MAX_FILE_BYTES,
  initStagingUpload,
  putStagingPart,
  finalizeStagingUpload,
};
