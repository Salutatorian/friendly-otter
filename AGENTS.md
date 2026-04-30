# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

"The Greater Engine" — a vanilla HTML/CSS/JS personal website with a custom Node.js dev server. No framework (React, Next.js, etc.). See `README.md` for full details.

### Running locally

- **`npm run dev`** — starts the Node.js dev server (`server.js`) on port 3000. Serves static files and local API routes (`/api/training`, `/api/projects`, `/api/photos`, `/api/videos`, `/api/auth`).
- **`npm run start`** — static-only mode via `npx serve .` (no API routes).

### Known local dev server limitations

Several API handlers (`api/movies.js`, `api/reading.js`, `api/writings.js`) use Vercel's serverless response API (`res.status().json()`) which is **incompatible** with the local Node.js HTTP server's native `res` object. When these APIs are called locally, **the server crashes with `TypeError: res.status is not a function`**.

Pages that trigger these APIs on load (writing, books, movies) will crash the local dev server. If you need to test those pages locally, avoid triggering their API calls or use `vercel dev` (requires Vercel CLI + linked project).

Pages that work without issues locally: home (`/`), about (`/about`), training (`/training`), tools (`/tools`), photos (`/photos`), videos (`/videos`), portfolio (`/portfolio`), admin (`/admin`).

### No linter or test suite

This project has no ESLint configuration, no TypeScript, and no automated test suite. There are no lint or test commands to run.

### Environment variables

Copy `env.example` to `.env.local` for local dev. Key vars:
- `ADMIN_PASSWORD` — required for admin panel auth
- `R2_*` vars — Cloudflare R2 storage (for admin uploads)
- `STRAVA_*` vars — Strava API (for training dashboard)
- `GOODREADS_USER_ID`, `LETTERBOXD_USERNAME` — optional, have defaults

Without any `.env.local`, the site still works for static pages; dynamic features degrade gracefully.

### Deployment

Production deploys to Vercel. API routes in `api/*.js` deploy as Vercel Serverless Functions. Config in `vercel.json`.
