/**
 * Multi-request R2 uploads for files larger than Vercel's ~4.5 MB body limit.
 * Chunks are stored under staging/{sessionId}/ then concatenated and moved to gallery/.
 */
const crypto = require("crypto");
const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { getR2Client, uploadObjectBuffer } = require("./r2-utils");

const STAGING_PREFIX = "staging/";
/** Per-chunk cap under Vercel's 4.5 MB request limit. */
const STAGING_CHUNK_BYTES = 4 * 1024 * 1024;
/** Max assembled file (photos / media in admin). */
const STAGING_MAX_FILE_BYTES = 30 * 1024 * 1024;
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
  return `${STAGING_PREFIX}${sid}/part-${String(partIndex).padStart(5, "0")}`;
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
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key,
      Body: buffer,
      ContentType: "application/octet-stream",
    })
  );
}

async function listStagingKeys(sid) {
  const client = getR2Client();
  const prefix = `${STAGING_PREFIX}${sid}/`;
  const keys = [];
  let ContinuationToken;
  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken,
      })
    );
    for (const o of out.Contents || []) {
      if (o.Key) keys.push(o.Key);
    }
    ContinuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

function partIndexFromKey(key) {
  const m = /\/part-(\d+)$/.exec(key || "");
  return m ? parseInt(m[1], 10) : -1;
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
  const keys = await listStagingKeys(sid);
  if (keys.length !== partCount) {
    const e = new Error(
      `Missing parts: expected ${partCount}, found ${keys.length}`
    );
    e.statusCode = 400;
    throw e;
  }
  keys.sort((a, b) => partIndexFromKey(a) - partIndexFromKey(b));
  for (let i = 0; i < keys.length; i++) {
    if (partIndexFromKey(keys[i]) !== i) {
      const e = new Error("Invalid or duplicate staging parts");
      e.statusCode = 400;
      throw e;
    }
  }
  const bufs = [];
  for (const key of keys) {
    bufs.push(await getObjectBuffer(key));
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
