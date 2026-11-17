# Investigating taste through 300 rounds

The quiz now keeps an account of competing explanations, rather than treating a list of correlated qualities as several independent discoveries. A strong response can start an investigation. A broad appeal reading needs recurrence across independent discovery sets and artists, plus an advance prediction that survives a later comparison. Selected transfer checks and ordinary discovery forecasts retain separate evidence roles. A failed prediction keeps the named earlier examples and withdraws the broader account.

The implementation is in `public/art-atlas/taste-inquiry.mjs`. It supplies the same explanation definitions to selection, prospective checking, sensitivity analysis and the profile. The opening release retains ownership of the first 50 paintings and early local investigations. Saved questions retain their original definitions.

## What is worth telling someone

| Reading to investigate | Useful evidence | What remains open |
| --- | --- | --- |
| Layered space draws you into several kinds of scene | Contrasts within landscapes, a contrast within one artist, and previously unrated works in other subjects | An annotation of depth does not identify the participant's route through an image. Artist, edges, subject and familiarity may vary with depth. |
| Visible marks help in landscapes but work differently elsewhere | Separate within-context and outside-context contrasts with known present and absent annotations | A global average may cancel two real directions. The conditional account still needs its own prospective test. |
| Both a sparse work and a scene full of incidents appeal | Keep the two actual responses; compare open expanse against layered space, including a dense work with both | The current reviews do not establish that details supply a readable route. Ask what the participant noticed after their choice, then source-review contrasting compositions before naming that explanation. |
| Some unsettling works earn another look despite modest appeal | Join an earlier anchored appeal response to the same work's later tension and wish-to-return map; include a tense work with little wish to return | Wish to return is a report. Reopening and time spent would be different evidence. |
| A lower-rated painting belongs beside this particular neighbour | Preserve the actual arrangement, brief, offered works and separate appeal response; offer both candidates beside the same group | Placement and omission cannot identify a motive. Both, neither and uncertainty remain available in the existing relatedness question. |

## Three accounts, with separate tests

The global benchmark is a ridge regression over the sixteen source-bound binary qualities. Each discovery set has total weight one. Each fresh work enters once. Unknown qualities use training means for prediction and remain unknown in the explanation model. The coefficients do not become causal explanations. A mean-only benchmark tests whether the regression adds anything beyond a participant's usual rating level.

The local predictive benchmark averages the three closest reviewed training works by different artists. At least eight qualities must be jointly known, and at least two artists must be available. This is a rough similarity benchmark. The existing local investigation selector does the more useful explanatory work around a favourite or dislike by proposing opposing predictions.

The conditional account uses sixteen single-quality questions and eight fixed contextual questions. These include depth inside and outside natural settings, marks in landscapes, open landscapes, material detail with narrative clues, rhythm with distortion, geometry without landscape and light around closely framed figures. Conditions are fixed before an answer record is analysed. A new exception does not cause the system to search arbitrary combinations until one fits.

Each contextual question compares reviewed present and absent driver values within its context. The outside-context counts stay visible. A group supplies one signed mean gap, not six independent confirmations. Gaps below ten remain unresolved. Capped gaps determine nomination; equal directional votes are a sensitivity check. These numerical gates are product hypotheses.

Two ordinary discovery sets per block can carry frozen forecasts after at least three usable discovery sets exist. Their actual later ratings yield set-weighted absolute error for the global, local and mean-only benchmarks. Leading recurring conditional accounts also freeze directional predictions for those same sets. Pair results remain grouped under their source set. Adaptive diagnostic tests have a separate denominator. None of these curated samples estimates accuracy over the whole collection.

## Six blocks and their opportunity costs

| Block | Main work | Flexible questions |
| --- | --- | --- |
| 1–50 | Keep the curated opening, eighteen ordinary appeal panels and its existing local investigation policy | The opening release owns landscape breadth and early follow-ups. The profile can name a concrete possibility without promoting it to a recurring explanation. |
| 51–100 | Keep ordinary discovery dominant and the existing exact-repeat allocation | Slots 68 and 100 seek a disagreement between live accounts. Slot 73 seeks a within-artist distinction. A failed eligibility screen becomes discovery. |
| 101–150 | Preserve declared ordinary cohorts and broad coverage | Slots 118 and 150 test live alternatives; slot 123 seeks a within-artist check. A recurring descriptive headline is available now. Broader wording needs a successful frozen later prediction. |
| 151–200 | Continue discovery and delayed repeats | Slots 168, 173 and 200 pursue the surviving accounts and their boundaries. |
| 201–250 | Expand independent subject and artist coverage | Slots 218, 223 and 250 test transfer, including conditional accounts that survived earlier exceptions. |
| 251–300 | Spend remaining comparisons on unresolved distinctions | Slots 268, 273 and 300 test the remaining live questions. If none is resolvable, broader discovery is the useful next move. |

All blocks remain fifty base interactions. The optional refinement offer retains its ten-question limit and position before the profile. It can use the same inquiry selector. A measured response dissociation can first nominate a typed map; local appeal follow-ups and actual museum-fit opportunities remain available. An optional place is not filled with an ordinary discovery question merely to reach ten.

For a later inquiry, the selector requires at least three discovery sets, two accounts with at least two supporting groups, and recurrence in at least one account. It screens only released, eligible works, respects the neighbouring-question exclusions and prevents repeated appeal pairings. Transfer targets must both be unrated. A within-artist pair needs at least one unrated target and cannot earn a new-artist confirmation. Eight jointly known controls, at most three control differences and at least 75 percent agreement are required. Unknown reviews never provide a match.

The selection score rewards rival disagreement, new artists and a shared reviewed natural-setting status, divided by the cost of two paintings plus additional control differences. Shared natural-setting status is a coarse control, not proof of identical subject matter. The existing sourced same-subject comparisons remain available in the journey. A bounded candidate list keeps selection practical. This is an editorial ranking, not optimal information gain or a calibrated uncertainty estimate.

## Evidence from the shown question to the profile

| Interaction | Captured and validated | Permitted conclusion |
| --- | --- | --- |
| Continuous appeal line | Exact artwork identities, prompt, scale, integer positions, confirmation, gaps and ties | Personal levels and comparative gaps in this instrument |
| Historical relative line | Original question and protocol | Order and exact ties. Its distances never become anchored appeal. |
| Favourite or dislike selection | Explicit selection, visited pages, uncertainty and explicit none | The declared choice. Non-selection supplies neither dislike nor an inferred opposite. |
| Appraisal maps | Exact axis definition, artworks and both coordinates | Admiration, reported attention, understanding, connection, tension and wish to return retain their separate meanings. |
| Sorting or museum arrangement | Actual offered and presented IDs, recorded relationships, positions, brief and choices | Relationships under the recorded task. Neither proximity nor omission supplies another unconditional appeal vote. |
| Sourced note | Exact note and sources, prior question when bound, direct reported appreciation change | Reported change can occur after an earlier appeal of 100. It does not invent an after-rating or a causal effect of context. |
| Recognition | Prior encounter report, attribution guess, certainty, image and label exposure and feedback | Prior recognition, guessed attribution and in-session learning remain separate. An accurate guess is not prior expertise. |
| Prospective inquiry | Training response snapshots, target identities, source-bound quality values, controls and opposed predictions before the answer | A targeted check of particular alternatives. It adds no independent discovery group. A revised source response makes the check historical for the current reading. |

`collectTastePatternSources` validates response instruments and separates fresh discovery from selected or repeated checks. `bindDiagnosticRound` uses actual earlier definitions and the release pool. `freezeAppealForecast` runs immediately before a new question's presentation record is saved. `readTasteInquiryChecks` reads its later answer without refitting the stored prediction. `buildProfileIntelligence` produces the evidence ledger, new readings, forecasts and sensitivity results. `buildTastePortrait` applies the same promotion rule to the older personal-appeal cards.

The ledger retains the actual prompt, scale, source artworks and complete response, including note sources and valid arrangement records. Private study records and screenshots belong in local ignored artifacts, never the committed documentation.

## How a reading changes

A candidate needs three independent supporting sets and preferred examples by at least three artists, with support at least twice the combined opposite and close groups, before it counts as recurring discovery. To earn broader appeal wording it also needs an eligible, successful advance prediction. This can be a selected new-artist transfer or a frozen ordinary discovery forecast with an informative pair by distinct known artists. Each ordinary forecast group supplies one check, never another independent discovery vote. Support must dominate opposing groups at least two to one. A clear contrary ordinary forecast withdraws eligibility even after a successful selected transfer. One within-artist result remains local. A clear prospective reversal withdraws the stronger headline. Recurrence can still earn a concrete retrospective headline without claiming tested transfer. A tie keeps the alternatives open and cannot earn promotion. An exact repeat can weaken an earlier account, but cannot add independent support. Its later gap is computed on the same original supporting artwork subset; a partially fresh source must not silently gain extra previously rated works when repeated.

The profile shows a named comparison and its actual values, where it stops generalising, another plausible route, and a promising account that weakened when one exists. A counterexample stays beside the supporting works. Directly reported distinctions, such as wishing to revisit an unsettling work with moderate appeal, retain their own wording and evidence rather than inheriting the appeal model's thresholds.

Sensitivity removes a whole influential set, withholds a contributing artist, withholds one influential work's review and replaces capped gaps with equal directional votes. The report includes changes in direction, discovery qualification and rank on the same frozen question sample. These checks identify fragility; they do not produce a confidence interval.

## Primary research and design implications

- [Iigaya et al., 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8494016/) tested prediction of personal art preference from interpretable visual features. This motivates a global benchmark. Its predictive result does not validate Art Atlas's annotations or sparse individual explanations.
- [Güçlütürk, Jacobs and van Lier, 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4796011/) found opposite individual complexity preferences behind an aggregate curve in generated grayscale patterns. This supports testing separate accounts instead of assuming a universal optimum. Generated patterns do not establish the same effect in paintings.
- [Song, Kwak and Kim, 2021](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.694927/full) studied familiarity and novelty with behavioural and eye-tracking measures. Their results depend on viewer and artwork properties. Art Atlas therefore records prior encounters separately from image exposure, labels and guesses; it does not infer a familiarity effect from a famous title.
- [The role of expertise and culture in visual art appreciation, 2022](https://pubmed.ncbi.nlm.nih.gov/35739137/) reports two preregistered experiments with culture and art expertise. The variation across participant groups limits universal claims. Art Atlas does not turn a taste response into an expertise or cultural-identity score.
- [The impact of contextual information on aesthetic engagement of artworks, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10017684/) separately measured aesthetic responses under different information conditions. Information type and art experience matter. A participant's report after one note remains a specific reported change, with no untreated counterfactual.
- [Categorizing art: Comparing humans and computers, 2009](https://www.sciencedirect.com/science/article/abs/pii/S0097849309000612) used free sorting under a style brief. Its task illustrates why a sorting relationship must retain the instruction under which it was made. Similarity does not supply liking.
- [Guo and Sanner, 2010](https://proceedings.mlr.press/v9/guo10b.html) describe preference elicitation with an explicit utility and noise model. Art Atlas uses practical disagreement and cost rules without claiming that probabilistic model or optimality.
- [Kossen et al., 2021](https://proceedings.mlr.press/v139/kossen21a.html) distinguish adaptive evaluation from active learning and address selection bias. Art Atlas reports curated discovery forecasts separately from selected diagnostic results and makes no collection-wide accuracy estimate.

## Reproducible verification

Run `npm run test:art-atlas` for the full suite, or `node --test tests/art-atlas/taste-inquiry.test.mjs tests/art-atlas/profile-intelligence.test.mjs tests/art-atlas/journey-300.test.mjs` for the focused behaviour checks. Run `node tools/replay-art-atlas-intelligence.mjs` for seven synthetic trajectories over real questions and paintings. The latter saves ignored local reports and rendered profile pages at 50, 100, 150 and 300.

The trajectories cover layered space, context-dependent mark-making, sparse images alongside organised dense scenes, modest appeal with unsettling return intentions, all ties, an isolated response, and a separate trajectory with genuine delayed reversals. The answers are explicitly simulated. They are useful for finding selection, binding and interpretation errors; they establish no participant-level predictive accuracy or product calibration.

The original production commit also has catalogue-wide fixture and allocation test failures. A disposable baseline copy reproduces those failures. The six-block allocation assertion is corrected here to distinguish a reserved cohort member from a work receiving its first rating. A supplemental early appearance cannot be counted as a second first rating. Declared early ordinary placements continue to have their separate curation tests.

Before adding more psychological language, the next iteration needs human pilot responses, post-choice reports of which difference mattered, reviewed matched comparisons for specific disputed compositions, and a protected broadly sampled evaluation pool. A second session is needed before describing long-term stability. Nothing in the present annotations identifies a visual scan path, an unconscious motive or a population percentile.

## Targeted interaction types

The last flexible place in each later block can now choose what to measure. A directly recorded separation between appeal and admiration, appeal and attention, understanding and connection, or modest appeal and wish to return can nominate another three-work map under that exact instrument. The group contains an actual focus work, a measured boundary where available, and an artwork already rated for appeal but not yet measured on that axis. No unasked answer is predicted.

The router prices six separate judgments over three paintings, prefers a stronger recorded separation and a real measured boundary, prevents repeated focus anchors, and allows one typed check per block. It preserves the source map, axis definition, values and previous appeal responses. These selected maps never become new independent discovery evidence, including in the admiration channel. When no useful typed question is available, the slot can test an appeal explanation or return to discovery.

## Share screens

The profile now has a Share profile control with a preview and four available aspects: overview, paintings, a recorded contrast, and wish to return. An aspect is absent when it lacks source evidence. The overview uses the site's open artwork constellation, coloured quality threads and separate response highlights. Paintings retain their full compositions. The contrast and return screens keep actual axis scores separate. A positive rating is not relabelled an explicit favourite, and declared favourites remain unranked.

The original export used boxed images, divider lines, a report header and a credits block. The user rejected that direction. The replacement follows the actual live profile composition; subsequent user feedback removed the visible credits block and tightened the return screen. Source URLs and image credits remain in the internal share model and existing artwork views. The downloaded PNG contains only the selected reading, with no raw response archive or notes. Generation occurs locally, and native sharing opens only when the user requests it.

The export is 1080 by 1600 pixels. Browser checks exercised preview changes and downloaded each available aspect using simulated answers. Native sharing to an external destination was not exercised. Saved local previews are ignored artifacts.

## Final verification checkpoint

Seven synthetic trajectories completed all six blocks with 18 ordinary appeal panels per block. Rendered profiles were examined at 50, 100, 150 and 300. The genuine reversal trajectory includes an actual delayed repeat of journey-070 at journey-114, with four substantial rating reversals. At 150 the depth trajectory produces “You tend to favour scenes with depth”; the reversal trajectory withdraws that stronger depth reading and instead leads with the separately measured admiration distinction. These are synthetic behaviour checks, not evidence about a real person's taste.

The full suite checkpoint ran 1127 tests: 1100 passed, 26 inherited failures, and one skipped private-data check. Normalised failure names match the reproduced baseline, with no new failures. The build passed. Subsequent share-copy and layout changes have separate focused checks; the final decision trail records their counts. Independent review found and reproduced forecast and recurrence overclaims; regressions cover the corrections. Human pilot calibration, a protected evaluation pool and later-session stability remain outstanding. The current branch is reviewable work, not a new production deployment.
