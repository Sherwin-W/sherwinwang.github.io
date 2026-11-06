# Review handoff: homepage redesign (Professional / After Hours)

Branch `feature/mini-apps`, uncommitted working tree. Nothing committed, pushed or deployed. Review the working tree including untracked files. Do not modify files, commit or install dependencies. Ignore the unrelated, uncommitted voice-casting files (`src/mbti/casting/`, `mbti/voice-casting/`, `tests/voice-casting.spec.js`, the `vite.config.js` dev plugin).

Spec: the owner's brief, summarized in `DESIGN.md` §4. Supporting docs: `docs/RESUME.md` and `docs/mini-apps/LEAGUE.md`.

## What changed

- `src/pages/Home.jsx`: two labelled sections, each a `BentoGrid`, plus the Riot notice in the footer. `BentoGrid` now renders a `div` and takes `className` and `delayOffset`.
- New cards in `src/components/home/`: `IdentityCard`, `AboutCard`, `ResumeCard`, and `ResumeViewer` (a native `<dialog>`, iframe when `navigator.pdfViewerEnabled !== false`, otherwise a fallback). Styles are in `home.css`.
- Road to Diamond:
  - `src/league/rank.ts`: the formula
  - `src/league/api.ts` and `useRank.ts`: sources and fallback
  - `src/components/league/`: the UI; vertical at 1024px and wider, horizontal below
  - `src/data/league.ts`: config
  - `server/lib/league.ts` and `server/api/league/rank.ts`: Riot Account-V1, then League-V4 by PUUID, cached in the existing `spotify_cache` table
  - `public/league/emblems/`: Riot's official emblems, resized
- Data:
  - `profile.js` became `profile.ts` (new summary, location, links, About text)
  - new `src/data/resume.ts`
  - `projects.js` gained a `section` field; QuestBoard is now a standard tile, and the three old projects have no section
- `Tile.jsx`: the special QuestBoard branch is removed. Hover motion moved to `useTileMotion.ts` (shared with the new cards), and `motion.js` became `motion.ts`.
- Résumé PDF moved to the stable path `public/resume/Sherwin_Wang.pdf`.

## Please check

1. **API security:** the key is used server-side only; visitors cannot pick the account; the public payload has no PUUID or key; the cache, cooldown and `Retry-After` handling are correct; a cached row for a different account is ignored.
2. **Rank formula edge cases:** 100 LP counts as 0.99; apex tiers count as reached; invalid LP is dropped; unranked shows no marker.
3. **Résumé dialog:** focus moves to Close on open and returns to the opener on close; scroll lock; backdrop click; Escape. Escape while focus is inside the PDF iframe does not close it, which is a known browser limit.
4. **Layout:** no overlap or clipping at 1440, 1024, 768, 390 and 320 px; the rail label never leaves the tile; Spotify reserves its height.
5. **Reduced motion and reduced transparency** on the new cards and the dialog.

## Checks run

`npm run lint`, `npm run typecheck`, `npm test` (390 unit tests), `npm run build`, `npm run test:browser` (111 tests). All passed.
