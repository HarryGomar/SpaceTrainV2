# Art Atlas

Art Atlas is served from `/art-atlas/`. Its editable modules, styles, museum-source metadata and images are in `public/art-atlas/`. Vite copies that directory into the deployment unchanged. The personal homepage, navigation and project list do not link to it.

The Vercel configuration redirects `/art-atlas` to `/art-atlas/` so relative file URLs stay inside the app. Its directory is excluded from the personal site's SPA fallback. Missing Art Atlas files must return 404 instead of the homepage.

The study starts with 50 rounds and can continue in further blocks of 50. The first 18 ordinary preference sets use 64 distinct works. Later blocks reserve 18 and 17 additional works for first preference ratings. Other activities can show those works earlier. The museum catalogue contains 99 sourced works; another 255 appear only in the opening animation.

Answers and collections remain in browser storage. The deployment contains no saved user responses, exports, credentials or QA fixtures. Shown questions retain their original metadata and response scales when the unshown schedule is revised.

Validation commands:

```sh
npm test
npm run test:art-atlas
npm run build
```

Release checks cover the bare-path redirect, all four entry pages, JSON/module content types, all 354 artwork URLs, the start-to-profile-to-next-block flow, gallery search and artwork enlargement, maps, mobile layout and the existing homepage. Deployment uses the existing `harrygomars-projects/space-train` project.

The repository includes the complete 498-check app suite plus three route and packaging checks under `tests/art-atlas/` and `tests/art-atlas.test.mjs`. The protocol notes describe [looking appraisals](art-atlas-looking-appraisals.md) and [linked contrast rounds](art-atlas-contrast-rounds.md). The input scales and curatorial descriptors remain provisional, rather than validated psychological measures.
