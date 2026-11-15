# Art Atlas collection revision

Branch: art-atlas-collection-20261115. The application is in public/art-atlas/. Publish under the existing /art-atlas/ route, without a homepage or navigation entry. Preserve the separate localhost prototype and saved studies.

## Collection and curation

The study now has 156 works, including 57 additions. The additions include 25 works by Mexican artists and artists working in Mexico, four by Remedios Varo, and Watts' Hope. The opening combines the study collection with 255 separate decorative works, for 411 distinct paintings.

The first 50 rounds contain 18 main preference quartets with 72 distinct works. Hope and Varo's Harmony are in the eighth set. The next two blocks each introduce 42 previously unrated works in ordinary preference questions. These reservations concern first preference ratings, not first exposure in every activity. Deliberate repeats and cross-task comparisons remain separate.

The seven visual descriptors have both low and high examples. Strong abstraction increased from five to 34 works. Sparse representation remains less covered than dense representation, so this is not an equally balanced stimulus space. collection-coverage-20261115.json reports all marginal tails and abstraction/density cross counts. Artist, date, medium, recognition and colour can still vary together. The curated groups are not causal controls.

Run node scripts/art-atlas/curate-expansion-20261115.mjs to reproduce the merged catalogue, curated sets, reservations and coverage audit. Source records and actual image reviews are documented in art-atlas-additions-20261115.md.

## Descriptor correction

The original action scores sometimes described an implied story, and setting sometimes described mood. The labels shown to users described visible action and setting instead. All 99 original reproductions received a separate literal-descriptor review. Current works carry literal-action-setting-v1.

Saved artwork metadata, answers and question definitions remain unchanged. Older action and setting annotations cannot support new claims using the literal labels. The semantic guard covers profile candidates, adaptive training, held-out checks and museum grouping. Other recorded descriptors remain usable when present.

## Symbolism

Three sourced before/after appeal exercises occupy rounds 35, 40 and 48 in a fresh first block. Hope, The Ambassadors and Green Tara use the same five response categories before and after the note. The initial answer locks when the note opens. Later blocks choose further available sourced notes rather than repeating those three automatically.

The profile shows each painting's recorded before/after ratings, links to earlier preferences when an actual matched comparison exists, and retains the exact note in its evidence panel. A changed single-painting rating does not establish a new rank against an untested painting. One changed response can qualify an earlier self-description, but does not prove dishonesty or establish a stable personality trait. Repeated ratings of one painting do not count as independent replications. Reading, repeated exposure and elapsed time occur together, so the reading reports change rather than claiming the note caused it.

## Images and maps

The original 99 small reproductions retain their bytes. A separate manifest provides 97 larger verified reproductions. Twilight in the Wilderness now has a 3200 × 1998 hosted file, replacing the 480 × 300 derivative in enlarged views. Source-limited works retain their actual available pixels and enlargement limits. See art-atlas-study-media.md.

At zoom levels of 125% and above, every distinct work gets a photograph. Different works at the same coordinates separate locally. Original coordinates remain available, and selection reveals the offset to the recorded position. Repeated placements of the same work at the same position can remain grouped. Image corners follow the reproduction's aspect ratio. The horizontal and vertical selectors exclude the other selected dimension and provide a swap control.

The general map and gallery are titled The collection. Personal responses and comparisons have separate navigation. Method notes sit in About this map. The profile explorer uses Preference & feeling and Symbols & meaning, removes internal Earlier/Proposed badges, and hides unsupported proposed readings.

## Verification and release

The application has 568 passing Node checks. The existing personal site has 38 passing tests. Profile rendering and export resolve the saved plan once. Captured questions trigger no prospective replanning. Later pending checks use their correct saved block, with strict source matching and no future-answer training. A native profile transition completed in 493 ms after the fix. The production Vite build succeeds with the existing large-chunk warning. Browser checks cover a completed 50-round test study, all three symbolism exercises, fixed evidence panels without a scroll jump, continuation to round 51, all 156 map photographs at zoom, axis swapping, four Varo search results, high-resolution enlargement, and a 390 × 844 round layout without overflow.

Stage the reviewed production source without assigning domains. Verify deployed modules, manifests, image hashes and missing-asset 404s, then publish to harrygomar.com/art-atlas/. Confirm the production alias points to the reviewed commit and homepage bytes remain unchanged. Keep deployment records and screenshots under ignored artifacts/art-atlas/. Raw import caches are excluded from both Git and Vercel uploads.
