# Looking appraisals

`buildLookingAppraisals({works, rounds, answers})` in `public/art-atlas/looking-appraisals.mjs` handles the five standalone looking appraisals separately from unconditional preference.

| Construct | Recorded judgment |
| --- | --- |
| `perceived-visual-density` | Reported amount of visual detail. |
| `interpretive-openness` | Reported number of possible readings. |
| `importance-of-figures` | Stated importance of depicted people to the reaction; displayed as “Importance of people”. |
| `reported-unexpectedness` | How unexpected the reproduction seemed to this viewer. |
| `attention-to-making` | Reported attention to marks, paint, lines and composition. |

These instruments internally retain `criterion: 'preference'` for their spectrum input. That field does not establish what they measure. Eligibility requires the explicit `looking-appraisal` family, a recognized construct, the actual frozen question and scale, exact artwork identities, complete integer positions, and confirmation. They never enter the unconditional-preference graph, preferred-work seeds or discovery fit.

## Returned data

The model returns `responses`, `panels`, `observations`, `coverage` and `limits`.

`responses` retains every valid original question, instruction, full scale object, construct, response order, source round ID and per-artwork position. Zero is an explicit answer. Missing, skipped, unconfirmed, ambiguous or mismatched answers remain absent. Reports without a suitable preference response stay inspectable.

Each exact-set `panel` combines the latest earlier valid unconditional preference with one appraisal. The x coordinate is that preference response; y is the original appraisal response. It retains both source rounds, both questions and scales, actual work IDs and source roles. A repeat or probe can supply a matched preference response without becoming another independent discovery set. Future responses and partial artwork overlaps are excluded. Different sets and repeated panels are never pooled or averaged.

`buildResponseAtlas` appends these panels to `maps` with kind `matched-preference-appraisal` and exposes them separately as `appraisalPanels`. It also returns the complete `lookingAppraisals` model. Existing curiosity panels, preference graph, editorial dimensions, date intervals and original grid definitions retain their separate meanings. Coverage distinguishes grid points from appraisal points.

## Descriptive relationships

A local observation requires a clear preference difference of at least 15 points and an opposite appraisal difference of at least 20 on the original 0–100 input scale. These are provisional design rules, not significance, confidence or psychological cutoffs. An aligned pair in one set does not create a recurring preference explanation.

A recurring observation needs at least two distinct offered sets under the same complete appraisal-definition signature, with more sets leaning in that direction than the opposite. A set's direction compares the numbers of assessable aligned and opposed pairs. Mixed and unassessed sets stay separate. The model retains all aligned and opposed pair IDs in `evidenceBalance.sets`, including opposing pairs inside a supporting set. Displayed counterexamples first represent different affected sets before adding further pairs from one set. Pair counts are dependent observations.

Visual density has a stricter headline rule in version2: at least three supporting artwork sets must share no paintings with each other and contain at least four distinct named artists. One or two density reports, repeated sets, and partially overlapping sets remain in the direct-response ledger and maps but cannot create a density headline. Counterevidence remains visible. These additional display rules do not establish statistical independence or a cause of preference.

Repeated appraisals of the same exact set remain separate reports and maps. Only the latest such report contributes to that set's recurring-direction count. Different questions, instructions, scales or instrument revisions have different signatures. If a supplied question or scale no longer matches the known semantic definition, its literal direct response and map remain available, with its actual wording. It supplies no renamed canonical inference.

At most two appraisal findings enter the portrait. Their evidence names the actual preference and appraisal sources, and their limits retain possible contributions from context, repeated viewing, labels and other artwork differences. No causal motive, objective complexity, eye tracking, ambiguity tolerance, novelty-seeking trait, population percentile or general consistency percentage is inferred.

## Profile presentation

The portrait exposes `lookingAppraisals` and `coverage.lookingAppraisalTasks`. Its stable “Your looking responses” control opens the existing fixed evidence dialog, with actual artwork thumbnails, original questions and endpoints, source rounds, and recorded positions. This is a direct-response ledger, separate from inferred patterns. It does not expand the main page or change its scroll position. Flat all-zero and all-100 reports stay visible without manufacturing a relationship from ties.

Spectrum evidence in `taste-portrait-parts.mjs` now recognizes the appraisal family. It labels these values with their actual question and original scale rather than the internal preference criterion. The rest of the evidence renderer retains its existing behavior.

## Verification

Run `node --test tests/art-atlas/looking-appraisals.test.mjs tests/art-atlas/response-atlas-data.test.mjs tests/art-atlas/taste-portrait.test.mjs tests/art-atlas/profile-comparisons.test.mjs`.

The regressions cover all five real scheduled appraisals changing from 0 to 100, actual portrait/atlas/HTML changes, unchanged preference and date outputs, exact coordinates and source questions, density headline suppression for insufficient or overlapping sets, artist spread, recurring support with within-set counterevidence, dependent repeats, invalid responses, unmatched appraisals, changed frozen scales, latest-prior matching, correct evidence labels, input preservation and singular header grammar. The clearer people question also has a saved-definition compatibility regression.

The main browser pass also verified the earlier partial v6 session: its valid rounds 43 and 50 open in the fixed dialog with original questions, works and values; closing preserves profile width and page scroll.
