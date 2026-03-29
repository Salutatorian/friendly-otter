# The Greater Engine – Personal Site

A minimal personal site with its own HTML for each page: **home**, **about**, **writing** (with a separate page per post), **books** (Goodreads), and **photos**. Theme: _The Greater Engine_ — simplicity, black or white, built for distance.

## Structure

- `index.html` – home (name + short intro + links)
- `about.html` – about page
- `writing/index.html` – writing listing (URL: /writing/)
- `writing/booting-up.html` – example post
- `admin/index.html` – admin UI (add projects, photos; requires `ADMIN_PASSWORD` in .env.local)
- `data/projects.json` – content added via admin (commit to deploy). Photos/media use Cloudflare R2 or Vercel Blob (see [ADMIN-SETUP.md](ADMIN-SETUP.md)).
- `books.html` – books page (synced from Goodreads via `/api/reading`)
- `photos.html` – photos page (polaroids, film, digital) + sidebar music player
- `training.html` + `training.js` – training analytics dashboard (Strava data via `/api/training`)
- `server.js` – local dev server; serves static site and Strava-backed `/api/training`
- `styles.css` – layout and light/dark theme
- `script.js` – dark mode toggle (saved in localStorage)
- `music-player.js` – music player logic (prev, play/pause, next, volume)

## Running locally

**Use a local server so dark mode stays consistent on every page** (home, about, writing, photos). If you open HTML files directly with `file://`, the theme may not persist when you switch pages.

**Static only (no Strava):**
```bash
npm run start
```
Then open the URL shown (e.g. `http://localhost:3000`).

**With Strava training data:**  
Copy `env.example` to `.env.local` and fill in your Strava values (Client ID, Client Secret, Refresh Token). Then run:
```bash
npm run dev
```
Open `http://localhost:3000/training.html`. The dashboard will load real data from Strava. Do not commit `.env.local` (it is in `.gitignore`).

## Customizing

- **Home:** Edit your name and tagline in `index.html`.
- **About:** Edit the three blocks in `about.html`.
- **Writing:** Add a new HTML file in `writing/` for each post and add a link in `writing/index.html`.
- **Socials:** Replace the `href="#"` on each link in the header (X, GitHub, LinkedIn, Email) with your real URLs. Add or remove links as needed.
- **Photos:** Add photos via the admin at `/admin` — upload images, enter title, location, date, time, and category. Storage is **R2** or **Vercel Blob** depending on env vars. See [ADMIN-SETUP.md](ADMIN-SETUP.md).
- **Music (photos page):** Create an `audio` folder and put your MP3 (or other) files in it. Open `music-player.js` and edit the `TRACKS` array at the top: add objects like `{ src: "audio/your-song.mp3", title: "SONG NAME", art: "images/album.jpg" }`. Use the `images/` folder for album art only — do not use it for the photo gallery.

## Dark mode

Use the sun/moon icon in the top-right. The choice is saved in localStorage and applied on every page. For it to persist across home, about, writing, and photos, run the site with `npm run start` (same origin).

## Training dashboard (Strava)

The training page shows analytics from your Strava activities (cycling, running, swimming). To use it:

1. Copy `env.example` to `.env.local`.
2. In [Strava API settings](https://www.strava.com/settings/api), copy your **Client ID** and **Client Secret**. After authorizing your app, use the **Refresh token** (not the short-lived access token).
3. Put them in `.env.local`:
   - `STRAVA_CLIENT_ID=...`
   - `STRAVA_CLIENT_SECRET=...`
   - `STRAVA_REFRESH_TOKEN=...`
4. Run `npm run dev` and open `http://localhost:3000/training.html`.

The server refreshes the Strava access token and fetches the last year of activities, then returns aggregated data for the charts and consistency grid. If `/api/training` is unavailable (e.g. you use `npm run start` instead of `npm run dev`), the training page falls back to placeholder data.

## Books (Goodreads)

The books page at `/books` displays three Goodreads shelves: **Currently reading**, **Want to read**, and **Done reading** (with star ratings on hover). It fetches all three RSS feeds and shows cover, title, and—for completed books—your rating. Your user ID is hardcoded as default (`199403748`); to use a different account, add `GOODREADS_USER_ID=your_id` to `.env.local`. Run with `npm run dev` so `/api/reading` is available.

## Movies (Letterboxd)

The movies page at `/movies` displays films from your [Letterboxd](https://letterboxd.com/) diary RSS feed. It fetches recent activity (watched films with ratings and posters). Default username is `joshuawaldo`; to use a different account, add `LETTERBOXD_USERNAME=your_username` to `.env.local`. Run with `npm run dev` so `/api/movies` is available. On Vercel, the API route deploys automatically.

## Push changes to GitHub

When you’ve made changes and want to sync them to GitHub:

```bash
git add .
git commit -m "Describe your change"
git push
```

## Media storage (R2 or Vercel Blob)

Uploads and gallery JSON are stored in **Cloudflare R2** when all **`R2_*`** env vars are set (see [ADMIN-SETUP.md](ADMIN-SETUP.md)). Otherwise the app falls back to **Vercel Blob** if **`BLOB_READ_WRITE_TOKEN`** is set. You must configure **CORS** on the R2 bucket so the browser can `PUT` to presigned URLs.

## Vercel Blob troubleshooting (fallback only)

If you use Blob and uploads fail with **“This store has been suspended”**, fix the store in **Vercel → Storage → Blob** and refresh **`BLOB_READ_WRITE_TOKEN`**, then redeploy.

**Hobby / Advanced Operations:** [`list()`](https://vercel.com/docs/storage/vercel-blob/usage-and-pricing), [`put()`](https://vercel.com/docs/storage/vercel-blob/usage-and-pricing), and [`copy()`](https://vercel.com/docs/storage/vercel-blob/usage-and-pricing) count as advanced ops. Optional **`BLOB_*_INDEX_URL`** vars skip `list()` on reads. **`del()`** does not count against that quota.
