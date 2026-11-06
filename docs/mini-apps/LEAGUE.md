# Road to Diamond

A narrow rail on the homepage that shows the ranked Solo/Duo progress of `DippoBippo#cccc` (NA) from Iron to Diamond IV. The whole card links to the account's OP.GG profile: https://op.gg/lol/summoners/na/DippoBippo-cccc (checked on 2026-11-05; the profile exists on NA).

## Where the rank comes from

The card always says which of these it is showing:

| Label on the card | Meaning |
|---|---|
| `Live from Riot · 12 minutes ago` | The API asked Riot within the refresh window. |
| `Saved rank · Riot last answered 3 hours ago` | Riot could not be reached (or the key expired), so the API served its last good answer. |
| `Updated by hand · Nov 5, 2026` | The API is not set up or failed, so the card shows the rank typed into `src/data/league.ts`. |
| `No ranked games this season yet` | Riot returned no Solo/Duo entry (unranked, placements, or just after a season reset). No marker is drawn. |
| `Rank unavailable right now` | No answer and no manual rank. Nothing is guessed. |

**Status today:** live. A Personal API Key is set in Vercel as `RIOT_API_KEY`, and on 2026-11-05 the API returned **Gold II, 63 LP**. The manual rank in `src/data/league.ts` (Gold II, 27 LP from OP.GG) is only the fallback.

## Last champion played

A small round portrait beside the LP shows the champion from the account's most recent ranked Solo/Duo match (queue 420); ARAM, normals and Flex are ignored. It appears only with Riot's answer (live or saved), never with the manual rank, and is hidden if the image fails to load. Its alt text reads "Last played: Wukong, 2 hours ago".

- Match-V5 `GET americas.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?queue=420&count=1`, then `GET …/lol/match/v5/matches/{matchId}` for the account's `championId`. This adds 2 requests per refresh.
- Data Dragon (`ddragon.leagueoflegends.com`, Riot's public static CDN, no key sent) supplies the champion's name and portrait: `api/versions.json`, then `cdn/{version}/data/en_US/champion.json` to map the id. The id is used because some champions have a different internal name, such as Wukong, which is `MonkeyKing`.
- If the match lookup fails, the rank still updates and the last known champion is kept. The site accepts only portrait URLs on Data Dragon.

## Settings

Everything is in `src/data/league.ts`: Riot ID, platform (`NA1`), queue (`RANKED_SOLO_5x5`), goal (`DIAMOND` `IV`), refresh interval (45 minutes), OP.GG URL, mode (`live` or `manual`) and the manual rank. The widget code does not need to change for a new account or goal.

The API has its own copy of the account (`LEAGUE_RIOT_ID`, `LEAGUE_PLATFORM`), so a visitor can never make it look up someone else. If you change the account, change it in both places.

To update the manual rank, edit `manual` (tier, division, LP, and the date you checked) and deploy.

## Progress formula

`src/league/rank.ts` has the formula, and `src/league/rank.test.ts` tests it. Tiers below Master have four divisions (IV to I) of 100 LP each. Counting from Iron IV:

```
steps = tierIndex × 4 + divisionIndex + min(LP, 99) / 100      (Iron = 0 … Emerald = 5; IV = 0 … I = 3)
progress = steps / steps(Diamond IV)                           Diamond IV = 24 steps, clamped to 0…1
```

- Gold II 27 LP = 3×4 + 2 + 0.27 = 14.27 steps, so the card shows 59%.
- 100 LP counts as 0.99, because a pending promotion is not the next division yet.
- Diamond IV or higher, including Master, Grandmaster and Challenger, counts as goal reached. The card then reads "Goal reached" and keeps working.
- If the LP is missing, negative, not a number, or above 100 in a tier that has divisions, it is shown as "LP unavailable" and adds no progress. An unknown tier or division is treated as no rank.

## Turning on live data (free)

Riot's rules (developer.riotgames.com, checked 2026-11-05):

- **Development keys** expire every 24 hours, and Riot says they must not run a public product. Don't use one here.
- **Personal API keys** are for "products that are intended for just the developer or a small private community". Riot's own list of acceptable uses includes "to display your own personal stats for your personal website", which is exactly this. Limits are 20 requests per second and 100 per 2 minutes. This setup uses about 3 requests every 45 minutes.
- **Production keys** are for public apps used by many players. One is not needed here.

Steps:

1. Sign in at https://developer.riotgames.com, go to **Register Product → Personal API Key**, and describe it: "Shows my own ranked Solo/Duo tier on my personal portfolio, sherwinwang.dev. Server-side only, one account, cached for 45 minutes." Wait for approval.
2. In the existing Vercel API project (Root Directory `server`, the same one as Spotify), add these environment variables:
   - `RIOT_API_KEY` = the personal key
   - optionally `LEAGUE_RIOT_ID` (default `DippoBippo#cccc`), `LEAGUE_PLATFORM` (default `na1`) and `LEAGUE_REFRESH_MINUTES` (default 45, never below 10)
3. Redeploy the API, then check it: `curl https://<api-host>/api/league/rank` should return `{"riotId":"DippoBippo#cccc","ranked":true,"tier":"GOLD",…}`.
4. Nothing on the site needs to change. `mode: 'live'` already asks the API and falls back to the manual rank until the API answers.

**Storage:** the API reuses the existing Supabase table `spotify_cache` (RLS on, no policies), so there is no new database. It adds three rows:

- `league-rank`: the public rank
- `league-account`: the PUUID, kept server-side only
- `league-cooldown`: when a Riot rate limit ends

`server/supabase.sql` does not need to change.

## How requests flow

1. The browser calls `GET /api/league/rank` once on load, then again every `refreshMinutes` while the tab is visible.
2. Vercel's edge cache answers repeat visitors for 5 minutes (`s-maxage=300, stale-while-revalidate=600`).
3. The function serves the cached rank while it is younger than the refresh window. After that it asks Riot once:
   - Account-V1 `GET americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` returns the PUUID. This is cached for good, because it never changes.
   - League-V4 `GET na1.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}` returns the entries. The API keeps the `RANKED_SOLO_5x5` one, and returns only tier, division, LP, Riot ID and time.
   - Match-V5 and Data Dragon supply the last champion played (see above).
4. If Riot fails or rejects the key, the API serves the last cached rank marked `stale`. A Riot 429 starts a cooldown for its `Retry-After`, and Riot is not called again until it ends.

The key is sent only from the server, in the `X-Riot-Token` header. It is never in the browser bundle or in git. The public answer contains no key, PUUID, match ID or win/loss record. Nothing scrapes OP.GG; the card only links to it.

## Assets and legal

The rank emblems in `public/league/emblems/` come from Riot's official ranked emblem pack linked from the League developer docs (https://static.developer.riotgames.com/docs/lol/ranked-emblems-latest.zip). They were trimmed and resized to 192 px WebP files, about 10 KB each. The homepage footer carries Riot's required notice that the site is not endorsed by Riot Games.
