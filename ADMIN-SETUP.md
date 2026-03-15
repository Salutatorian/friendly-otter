# Admin Photo Upload — Vercel Blob Setup

This guide explains how to use the admin at `/admin` to upload photos directly (no manual JSON edits).

## Vercel Environment Variables

Add these in your Vercel project → **Settings** → **Environment Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | Yes | Password to log in to `/admin`. Set a strong password. |
| `BLOB_READ_WRITE_TOKEN` | Yes (for photos) | Auto-created when you create a Blob store. See below. |

## Vercel Storage Setup (Blob)

1. In the Vercel dashboard, open your project.
2. Go to **Storage** in the sidebar.
3. Click **Create Database** → choose **Blob**.
4. Name it (e.g. "photos-store") and choose **Public** access for uploaded images.
5. Click **Create**. Vercel will automatically add `BLOB_READ_WRITE_TOKEN` to your project env vars.
6. Redeploy your project so the new env var is available.

That’s it. No extra configuration needed.

## Local Development

To test the admin locally:

1. Copy `env.example` to `.env.local`.
2. Add `ADMIN_PASSWORD` (and optionally `BLOB_READ_WRITE_TOKEN` for Blob storage).
3. Get `BLOB_READ_WRITE_TOKEN` from Vercel: Project → Storage → your Blob store → copy the token, or run `vercel env pull` from the project root.
4. Run `npm run dev` and open `http://localhost:3000/admin`.

Without `BLOB_READ_WRITE_TOKEN` locally, the admin project form still works (file-based). The photo form will show an error when submitting because Blob is required for uploads. Add the token to test the full flow.

## Using the Admin

1. Go to `yoursite.com/admin`.
2. Enter your `ADMIN_PASSWORD` and log in.
3. **Add photo:**
   - Choose an image file.
   - Fill in: Title, Location, Date, Time, Caption (optional), Category.
   - Submit. The image is uploaded to Vercel Blob and metadata is saved.
4. Photos appear on the public `/photos` page immediately. No Git commits or manual JSON edits needed.

## How It Works

- **Images** → Stored in Vercel Blob under `photos/photo-{timestamp}.jpg`.
- **Metadata** → Stored in a JSON file in Blob (`gallery/index.json`).
- **GET /api/photos** → Public. Returns the photo list (from Blob or, if empty, from `data/photos.json`).
- **POST /api/upload** → Protected. Requires `ADMIN_PASSWORD` in `Authorization: Bearer` or `x-admin-password` header.
- **POST /api/photos** → Protected. Same auth.
