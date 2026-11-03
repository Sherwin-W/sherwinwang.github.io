# Setup: Spotify Last Played

You do these steps; nothing here can be done from the repo. Never commit any value below.

## 1. Spotify app

1. https://developer.spotify.com/dashboard → Create app. Enable **Web API**.
2. Add redirect URI exactly: `http://127.0.0.1:8888/callback` (loopback only; used by the local script).
3. Note the Client ID and Client Secret.
4. Spotify's developer-mode rules change over time (it has required the app owner to have Premium and limits users). Check the dashboard and current policy; if the API returns 403, that is the likely cause. Your own account is the only one that needs access.

## 2. Authorize once, locally

```bash
SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node server/scripts/spotify-auth.mjs
```

Open the printed URL, approve, and copy the printed `SPOTIFY_REFRESH_TOKEN`. Scopes requested: `user-read-currently-playing`, `user-read-recently-played` only. The script uses PKCE and a random `state`, binds to 127.0.0.1, and exits after one callback. There is no OAuth endpoint on the deployed API.

## 3. Supabase cache (optional but recommended)

Run `server/supabase.sql` in a Supabase project (the Quest Board one works, or a new free project). It creates `spotify_cache` with RLS enabled and no policies. The API uses the service-role key to keep the last good track so the tile survives Spotify outages.

## 4. Vercel project

1. New Project → import this repo → **Root Directory: `server`**, framework: Other.
2. Environment variables (Production): `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `ALLOWED_ORIGINS`.
3. Optionally add a domain such as `api.sherwinwang.dev` (CNAME at Porkbun to the value Vercel shows).
4. Check: `curl https://<api-host>/api/spotify/last-played` returns track JSON.

## 5. Point the site at it

Set `VITE_API_BASE_URL=https://<api-host>` when building the site (`.env.production.local`, not committed). With it unset, the Spotify tile is hidden. Then deploy as usual (only when you approve).

## Local development

- Site: `VITE_API_BASE_URL=http://localhost:3000 npm run dev` (API from `cd server && npx vercel dev`, with a `server/.env.local`).
- Tests need no credentials: `npm test`, `npm run test:browser` (mocks the API; run `npx playwright install chromium` once).

## Behaviour notes

- Edge cache: 30 s fresh, 60 s stale-while-revalidate. Browser polls every 45 s only while the tab and tile are visible.
- On Spotify failure the API serves the last cached track (marked `stale`, never "playing"); the browser also keeps its last track in localStorage.
- Public payload: track id, title, artists, album, art URL, links, timestamps. Links are rebuilt from the validated 22-character id on both sides.
