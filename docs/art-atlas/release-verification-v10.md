# v10 verification

The flow is Start → local artwork catalogue → granular answers and arrangements → saved quiz → evidence-led profile. The app reads static artwork and question modules. Answers remain in browser storage; the profile does not call a model or a remote scoring API.

- 690 Art Atlas checks passed, including the retained original export when privately available. That export is ignored by Git and deployment.
- 38 existing site checks passed. The production build passed.
- A complete browser run exercised all 50 rounds, including matching feedback, multiple connection reasons, overlapping sorting, museum placement, sourced reveals and closing comparisons.
- A second browser run exercised every new appeal quartet and all four favourites pages. Selections persisted across pages, and visiting all pages correctly prevented a falsely delayed repeat.
- At 390 × 844, the appeal screen with four equal maximum ratings and the 18-painting favourites page fit without document overflow. Desktop checks used 1280 × 720.
- Direct pointer changes between response maps retained the same section height and page position. Opening and closing evidence preserved both page position and horizontal alignment.
- Starting a new quiz archived the completed run. Switching to that archive and reloading recovered its original five selected favourites. IndexedDB archives keep older runs out of the active localStorage size limit; failed writes preserve the current run.
- The built homepage matches the existing 970-byte homepage exactly. No homepage navigation entry was added.

These checks establish the implemented behaviour. Descriptive thresholds, artwork annotations and adaptive selection remain explicit heuristics. They do not establish causal motives, a validated personality classification, population rarity or calibrated prediction accuracy.
