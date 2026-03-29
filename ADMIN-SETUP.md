# Admin uploads — Cloudflare R2 (recommended) or Vercel Blob

The admin at `/admin` uploads images and videos directly to storage and keeps JSON indexes for photos, videos, projects, and writings.

## Option A: Cloudflare R2 (recommended)

### 1. Bucket and public URL

1. Cloudflare → **R2** → create a bucket (e.g. `greater-engine-assets`).
2. Bucket **Settings** → enable **Public Development URL** (or attach a **Custom Domain**).
3. **Settings → General** → copy the **S3 API** value. If it ends with `/your-bucket-name`, the app still works: the code normalizes the endpoint.

### 2. R2 API token

**R2** → **Manage R2 API Tokens** → **Create Account API token** with **Object Read & Write** (not read-only). Save **Access Key ID** and **Secret Access Key** (secret is shown once).

### 3. CORS (required for browser uploads)

Bucket **Settings** → **CORS Policy**. Add a rule so the browser can **PUT** files to the presigned URL. Example (replace origins with your real site and local dev):

```json
[
  {
    "AllowedOrigins": [
      "https://your-domain.vercel.app",
      "https://your-custom-domain.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

**Important:**

- Do **not** put **`OPTIONS`** in `AllowedMethods` — Cloudflare’s policy validator rejects it. Use only methods [documented for R2](https://developers.cloudflare.com/r2/buckets/cors/) (e.g. `GET`, `PUT`, `HEAD`, `DELETE`). The browser’s preflight still works when `PUT` and headers are allowed.
- Prefer **`AllowedHeaders`: `["Content-Type"]`** (matches this app’s upload). You can use `"*"` only if the dashboard accepts it.
- Each origin must be **exact** (e.g. `https://thegreaterengine.xyz`) — **no trailing slash**, **no path**, **no comma inside the quotes**.
- The `PUT` uses **`*.r2.cloudflarestorage.com`**; `AllowedOrigins` is still **only your website’s origin**, not R2’s host.

Without CORS, uploads fail after `/api/upload` returns (the `PUT` to R2 is blocked by the browser).

### 3b. If the dashboard CORS looks correct but uploads still show “NetworkError”

Apply the same policy through the **S3 API** (sometimes fixes issues the UI does not):

1. Ensure `R2_*` variables are in `.env.local` (same as Vercel), or export them in your shell.
2. Optionally set `R2_CORS_ORIGINS` to a comma-separated list (no spaces), e.g. `https://thegreaterengine.xyz,http://localhost:3000`.
3. From the project root run:

```bash
npm run set-r2-cors
```

4. Wait ~30 seconds, hard-refresh `/admin`, try again.

The script uses `AllowedHeaders: ["*"]` (valid on the S3 API even when the dashboard JSON is picky).

### 4. Vercel environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | Yes | Password for `/admin`. |
| `R2_ACCESS_KEY_ID` | Yes (R2) | From Account API token. |
| `R2_SECRET_ACCESS_KEY` | Yes (R2) | From Account API token. |
| `R2_BUCKET_NAME` | Yes (R2) | Bucket name, e.g. `greater-engine-assets`. |
| `R2_ENDPOINT` | Yes (R2) | `https://<account-id>.r2.cloudflarestorage.com` (or full URL from dashboard; path stripped if it matches the bucket). |
| `R2_PUBLIC_BASE_URL` | Yes (R2) | Public base **without** trailing slash, e.g. `https://pub-xxxxx.r2.dev` or your custom domain root. |

Redeploy after saving variables.

### How R2 mode works

- **`POST /api/upload`** — Returns `{ uploadUrl, url, contentType }`. The admin **PUT**s the file to `uploadUrl`, then uses `url` in the gallery JSON.
- **Indexes** — `gallery/index.json`, `media/videos/index.json`, `projects/index.json`, `writings/index.json` are read via `R2_PUBLIC_BASE_URL/<key>` (no Blob `list()`).
- **Deletes** — Removing a photo/video/project media deletes the object in R2 when the stored URL matches `R2_PUBLIC_BASE_URL`.

---

## Option B: Vercel Blob (fallback)

If **any** of the `R2_*` variables are missing, the app uses **Vercel Blob** when `BLOB_READ_WRITE_TOKEN` is set.

| Variable | Description |
|----------|-------------|
| `BLOB_READ_WRITE_TOKEN` | From Vercel **Storage → Blob**. |
| `BLOB_PHOTOS_INDEX_URL` | Optional. Public URL of `gallery/index.json` to skip `list()` on reads. |
| `BLOB_VIDEOS_INDEX_URL` | Optional. Same for `media/videos/index.json`. |
| `BLOB_PROJECTS_INDEX_URL` | Optional. Same for `projects/index.json`. |
| `BLOB_WRITINGS_INDEX_URL` | Optional. Same for `writings/index.json`. |

See [Vercel Blob pricing](https://vercel.com/docs/storage/vercel-blob/usage-and-pricing). **`del()`** does not count as an advanced operation.

---

## Local development

- Copy `env.example` to `.env.local` and fill in `ADMIN_PASSWORD` plus either **all `R2_*`** or **`BLOB_READ_WRITE_TOKEN`**.
- Production uploads are normally tested on **Vercel** (`vercel deploy` / Git push). The static dev server may not expose `/api/*` unless you use **`vercel dev`** from the project root.

---

## Using the admin

1. Open `yoursite.com/admin` and log in with `ADMIN_PASSWORD`.
2. Add photos, videos, projects, or writings; files go to R2 (or Blob), and lists update immediately on the public pages (no manual JSON edits for normal use).
