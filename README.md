# The Greater Engine – Personal Site

A minimal personal site with its own HTML for each page: **home**, **about**, **writing** (with a separate page per post), and **photos**. Theme: _The Greater Engine_ — simplicity, black or white, built for distance.

## Structure

- `index.html` – home (name + short intro + links)
- `about.html` – about page
- `blog/index.html` – writing listing (URL stays blog/; label is “writing”)
- `blog/booting-up.html` – example post
- `blog/notes-from-an-easy-run.html` – example post
- `photos.html` – photos page (polaroids, film, digital) + sidebar music player
- `training.html` + `training.js` – training analytics dashboard (Strava data via `/api/training`)
- `server.js` – local dev server; serves static site and Strava-backed `/api/training`
- `styles.css` – layout and light/dark theme
- `script.js` – dark mode toggle (saved in localStorage)
- `music-player.js` – music player logic (prev, play/pause, next, volume)

## Running locally

**Use a local server so dark mode stays consistent on every page** (home, about, blog, photos). If you open HTML files directly with `file://`, the theme may not persist when you switch pages.

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
- **Writing:** Add a new HTML file in `blog/` for each post and add a link in `blog/index.html`.
- **Socials:** Replace the `href="#"` on each link in the header (X, GitHub, LinkedIn, Email) with your real URLs. Add or remove links as needed.
- **Photos:** In `photos.html`, remove the placeholder text inside `.photos-grid` and add polaroid blocks: a div with class `polaroid` and `data-category="polaroids"` (or `film` / `digital`), an `<img>` inside, and optional `<span class="polaroid-caption">Caption</span>`.
- **Music (photos page):** Create an `audio` folder and put your MP3 (or other) files in it. Open `music-player.js` and edit the `TRACKS` array at the top: add objects like `{ src: "audio/your-song.mp3", title: "SONG NAME", art: "images/album.jpg" }`. Optional: add an `images` folder for album art. Play = audio plays and the circle spins; pause = audio stops and the circle stops.

## Dark mode

Use the sun/moon icon in the top-right. The choice is saved in localStorage and applied on every page. For it to persist across home, about, blog, and photos, run the site with `npm run start` (same origin).

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
