# Arrangement data use, 16 November 2026

Grouping answers are analysed and displayed. Before this pass, their descriptions used a narrower vocabulary than the main taste reader, and they contributed mainly to the separate arrangement and connections sections. They were not evidence that a visitor likes every work placed in a coherent group.

This audit followed the current collectors, validators, analysers, portrait builder and rendered profile. Historical saved questions retain their original definitions. The current 50-round plan can bind different content or a documented fallback, so a proposed question is not proof that its response exists.

## Existing flow and limits

| Response family | Recorded data | Computed use | Profile use and limit |
| --- | --- | --- | --- |
| Free sorting | Eight offered identities, actually presented identities, placed centres, layout version, stacking order, earlier museum/sorting references | `sorting-table.mjs:58` onwards describes closest/furthest pairs; palette, movement and date relationships; and selected pair changes against a captured earlier arrangement | `scenarios.mjs:188` calls the latest sorting reader. `taste-connections.mjs:46` also retains groups and pair recurrence across comparable tables. This is relatedness, not a liking score. |
| Museum room membership | Offered/presented works, hung works, rooms, wall positions, placement intent, optional room names | `gallery-analysis.mjs:28` defines palette/date/movement and numerical abstraction, figure focus, action and density comparisons. Alternative assignments preserve the selected pool and room occupancies. Local-room and wall-neighbour findings retain exceptions. | `gallery-model.mjs:108` combines grouping with room decisions. `scenarios.mjs:194` routes them into arrangements. Automatic wall spacing does not count as intentional neighbour choice. |
| Museum walkthrough | Explicit entrance painting, longest-stop room and two chosen cross-room works | `room-study-analysis.mjs` describes entry versus longest stop, cross-room links and selected room-graph contrasts | Longest stop is an imagined allocation of time. It is not measured dwell time, and entry choice is not another individual preference rating. |
| Museum versus earlier preference | Complete eligible earlier source questions and answers captured before arranging; actual presentation/hanging history | `museum-preferences.mjs:21` freezes the source snapshot. Lines37–68 compare omissions or opening choices with an earlier pair order or the appropriate rating instrument. | Only earlier actual answers qualify. A generic museum omission is never a dislike. Older records without this snapshot cannot acquire it from later responses. |
| Difficult edit | Offered wall, removal, retained works, captured source context; historical versions also store a comparison of two walls | `difficult-edit.mjs:143` onwards retains the edit, matched earlier preference and appropriate repeat/alternative comparisons | Fit within a wall and individual preference remain separate. A returned work is not automatically disliked. |
| Neighbour, keep/leave and same-subject tasks | Categorical choices, offered alternatives, optional stated relationship reasons, reviewed subject definition | `contrast-readings.mjs:62` onwards checks exact earlier preference links and reviewed treatment contrasts | Unchosen alternatives do not acquire invented ranks. A reason is the visitor's report, not proof of an unconscious cause. |
| Familiarity and unranked keep grids | Reported prior familiarity and selected subsets with their original offered identities and capacity | `reading-patterns-v2.mjs:145` compares a shortlist with a matched familiarity question. The response atlas preserves the selection. | A generic keep grid is not an explicit favourite declaration. Unmarked familiarity is not proof of never having encountered the work. |
| Artist/style matching and chronology | Guesses, provided labels, stored date intervals and explicit uncertainty | Matching feedback concerns those labels. `contrast-rounds.mjs:185` checks only non-overlapping, non-uncertain date pairs. | `contrast-readings.mjs:185` explicitly produces no chronology-to-personality reading. These tasks do not establish general expertise. |
| Preference, admiration and other appraisals | Original source question, instrument, work identities, values or order, exact ties and repeat identity | `profile-evidence.mjs`, `taste-axes.mjs`, `taste-patterns.mjs`, `looking-appraisals.mjs` and `response-portrait.mjs` retain separate constructs and matched comparisons | The main summary selects qualified quality/choice patterns. Group membership does not create another preference response or increase its qualification count. |
| Context notes, symbolism and self-description | Original prompt/note, before/after reports or reported change, statements and source references | Context/symbolism readers and matched self-description checks connect the separate records | Repetition, supplied information and question wording can all contribute. Change after a note is not an isolated causal effect. A title alone does not establish symbolic content. |
| Closing and later checks | Earlier source evidence, frozen target/check definition and later answer | Closing readers compare the actual earlier and later responses | A targeted follow-up remains related to the evidence that selected it. It is not independent population validation. |

`deep-study.mjs:390` supplies the exercise controllers. `earlierPreferenceOptions` captures only eligible earlier shown-and-answered questions. Its reading path calls `analyzeScenarios`, `buildTastePortrait` and `buildTasteConnections`, then passes arrangements to `renderTastePortrait`.

`taste-portrait-view.mjs` displays up to four higher-priority arrangement observations and keeps the rest in the arrangement ledger. `profile-summary.mjs:23` selects the main taste summary from qualified taste patterns, explicit choice contrasts, visual axes and eligible matched-response themes. Arrangement coherence alone is not an input that qualifies a liking claim.

## Data that had weaker use

- The sorting and museum grouping readers did not import the sixteen source-bound quality reviews. Sorting's feature explanation considered only palette, movement and date. The museum reader considered those and four of the older numerical descriptors. The new reader below fills that specific gap.
- `analyzeScenarios` selects the latest sorting, edit and museum for its principal prose. The connections model retains more historical pair and group records, but these do not all receive a headline.
- A sorting record can capture both an earlier museum and an earlier exact sorting reference. Its prose comparison prefers the museum when both are available. Exact sorting recurrence still exists in the connections model, but the prose need not describe both comparisons.
- Room names are retained and displayed as the visitor's labels. They are not interpreted as latent themes or personality evidence. A visitor's phrase may explain a connection that the artwork descriptors do not capture, but it is not silently classified by keyword.
- Sorting `baselineAnswers` preserves an earlier quiz snapshot, but the sorting reader does not compare the resulting spatial groups with those earlier preference answers. It compares arrangement relationships instead.
- Stack order, zoom, cursor state and most interface state support faithful restoration and controls. They do not indicate preference, attention or an intended hidden coordinate axis. Detail/label exposure records can document presentation, not comprehension or dwell time.
- Saves for looking and saves for study remain intention records. The portrait retains those IDs, overlap and unrated saves. They are not silently treated as individual liking ratings.

An offered museum tray is not evidence that every image was inspected. Current museum eligibility uses earlier shown image questions and actual exercise presentation. Museum omissions use presentation records, with the further limit that presentation does not prove attention. Free wall capacity and deliberate reasons for omitting a work are not measured by the current final layout.

## Implemented in this pass

`arrangement-qualities.mjs` exports:

```js
analyzeArrangementQualities({
  works, records, annotationReviews, currentWorks: []
}) // {findings, coverage, unavailable}
```

The reader uses `resolveArtworkAttributes` from `taste-patterns.mjs`. A work must match the review's source URL, preview path and declared or separately verified current preview checksum. Missing, swapped or unknown reviews remain unknown. The reader never substitutes an artist, movement, title or seven-feature score for a missing quality.

For each criterion, an opportunity needs at least three reviewed-present works, three reviewed-absent works, six known works, 75% known coverage, three named artists overall and two named artists in each status. These are conservative editorial reporting gates, not validated confidence thresholds.

For rooms, only actually hung and presented works enter. Alternative assignments preserve the selected artworks, occupied room sizes and unknown-quality slots. For sorting, the actual 3:2 board centres stay fixed, and known-work identities are reassigned only among their occupied slots. Near/far relationships are explicit provisional rules. Empty initial positions and one tight stack provide no quality separation.

Findings distinguish grouping by a shared quality from grouping by contrast. They retain exact source-record IDs, support, counterexamples, annotation provenance, compared work IDs and coinciding alternative qualities. One arrangement remains one dependent task. They do not generate liking, dislike, causal motivation, a confidence percentage or a personality trait.

The gallery/profile integration can attach a result as contextual convergence or divergence beside an already-qualified taste quality. It must not increase preference counts, change a rating, qualify a taste claim or add an independent replication. The module's direction means matching versus contrast in the arrangement, not positive versus negative preference.

The humanity grouping display was also corrected. A room of landscapes can match through low figure emphasis. The heading now distinguishes lower-focus and higher-focus rooms when that contrast exists, and representative images come from those different rooms with explicit room/focus notes. The coarse descriptor is not a count of people. No artwork annotation was changed to make the display fit.

Finally, `room-study-analysis.mjs` now uses the shared literal-descriptor guard. Pending/v1 action values, explicit unknowns and stale numeric field values cannot create a bridge or room-adjacency explanation. A reviewed-v2 field can still support the appropriate descriptive result.

## Verification

The room guard's new tests failed before the patch and passed after it. The landscape-room versus figure-room test likewise failed against the old heading and missing display roles, then passed with explicitly contrasting representatives. The combined room, grouping, model, connections and new rich-quality suite passes 80 tests.

A read-only replay of the retained historical 50-round session produced seven existing arrangement readings. Its source records included two sorting tasks, one museum and an edit. The new quality reader added five descriptive readings in about 62 ms on this machine: narrative detail in both sorting tables, material detail and close figures in the museum, and layered space in the later sorting table. Each retained an exception. This is local verification of a historical record, not a population accuracy result, a claim that five causes were discovered, or a change to that saved session.

## Remaining high-value improvements

1. Present qualified taste and arrangement relationships together while retaining their different meanings. The current integration uses the new quality keys for this bounded connection; it should show both agreement and exceptions.
2. Give the exact repeated sorting comparison its own short observation when a museum reference also exists. The connections data already preserves it; no new rating or survey is required.
3. Use an ambiguous grouping to choose one later contrast, such as shared story clues versus shared material detail across different artists and periods. Preserve the original grouping and treat the new response as a separately prompted check, not proof of the earlier motive.
4. When an omitted favourite matters, test a concrete replacement under the same room brief and capacity. Existing omission/entry checks are useful; the final layout alone cannot distinguish redundancy, limited space, coherence and dislike.
