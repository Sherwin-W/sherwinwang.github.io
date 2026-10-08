# sherwinwang.dev

Personal portfolio: a glass bento grid built with React 18, Vite 5 and Framer Motion.

- **Home** (`/`): bento tiles driven by `src/data/projects.js` and `src/data/profile.js`. Quest Board and Sketchbook open in a new tab; the other projects expand in place.
- **Sketchbook** (`/sketchbook/`): a second Vite entry (`sketchbook/index.html`) that mounts the interactive drawing canvas from `src/playable/`. It is a static page, so it works when loaded directly or refreshed.
- **Theme**: light/dark toggle. It follows the system until you choose, then remembers the choice (`localStorage` key `theme`) on both pages.

Design direction lives in `DESIGN.md`. Task history and handoffs for the redesign are in `docs/glass-bento/`; the earlier playable-portfolio work is in `docs/playable-portfolio/`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (`node --test`) |
| `npm run test:browser` | Playwright tests (starts the dev server on port 4173) |
| `npm run deploy` | Build and publish `dist/` to the `gh-pages` branch |

`npm run test:browser` regenerates some evidence files in `docs/playable-portfolio/`; restore them with Git if you do not want those changes.

## Deployment

The site is served by GitHub Pages from the `gh-pages` branch at https://sherwinwang.dev. `public/CNAME` is copied into every build so a deploy never removes the custom domain. `base` is `/` in `vite.config.js`.

The previous static site (Machine Learning Engineer pages) is preserved on the `legacy-static` branch and the `legacy-static-2026-03-13` tag.
