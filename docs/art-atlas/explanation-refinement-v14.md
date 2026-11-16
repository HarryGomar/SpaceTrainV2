# Art Atlas: explanation refinement, v14

Date: 2026-11-16. Baseline verified against local HEAD and the production deployment: `463b3fad9de70949f73a6921a0540ab6e1abed5d`.

This release follows the agreed direction: substantial explanations supported by exact choices and exceptions, with less resolved categories visible as questions to refine. Existing response exports remain private. No personal answers are included here or in the regression fixtures.

## Measurement and evidence

The continuous appeal protocol retains each painting's absolute position, neutral anchor, all adjacent gaps, exact ties, and compact clusters. A lower painting in an all-positive set is still positive. The evidence ledger preserves the original coordinates and instrument. Historical order-only answers retain order and exact ties; their distances do not become liking intensity. A five-point diagnostic reporting threshold is an editorial rule, not estimated measurement error or statistical significance.

The wider response layer validates statements, attribution, explicit familiarity, context responses and relationship checks separately from preference. Admiration, reported attention, understanding, personal connection, unease, return intention and relatedness do not become interchangeable votes. Collection saves remain intentions for looking or studying.

Qualified comparative explanations rank ahead of a lightly enriched feature among favourites. Artwork examples prioritise actual positive responses and explicit favourites, retain a comparison from the same source question, and display explicit disliked counterexamples. Closely overlapping explanations are identified as rivals. Existing qualification and counterevidence gates remain authoritative; the ordering score is editorial, not confidence.

Up to three principal quality explanations are displayed. Nine categories remain visible: appeal, admiration, attention, connection, return, context, recognition, grouping and company. Each reports recurring evidence, an early indication, an unresolved result, or missing measurement, followed by a next comparison. These labels describe available evidence rather than population confidence.

## Fresh first 50 and 100

The 18 ordinary appeal panels and 72 distinct first-block paintings are retained. Changes replace weaker or repetitive tasks rather than extending the block.

| Round | New use | Replaced use |
| --- | --- | --- |
| 6 | Personal appeal and reported attention | A second early admiration map |
| 15, 18, 27 | Answer-selected comparisons between competing quality explanations | Chronology, an additional movement exercise, and a generic comparison between low-rated works |
| 17 | Taste-linked artist attribution with recognised/inferred/guessed/unsure reports | Attribution without reported certainty |
| 32 | A follow-up selected from the actual earlier sorting | Repeating the same sorting set |
| 34 | Understanding and personal connection | An additional admiration map |
| 38 | Unease and return for the Bosch/Bruegel/Goya/Kandinsky panel | Unease and return for the neighbouring panel |

The first block still has three admiration maps, two clarity/interpretation maps, two unease/return maps, three sourced context reveals and the favourite/dislike refinements. The second block uses the same measurement distinctions and three quality-check opportunities with its own selected artworks and actual earlier history. The wider route still extends to 300.

New familiarity grids distinguish seen before today, new before today and unsure for each painting. Unchecked works in old grids remain unknown. New artist attribution asks how each answer was chosen. Correct guesses are not recognition; cued matching and elimination are not general expertise. Exposure history distinguishes images, artist labels, movement labels, notes and uncertain label exposure. Rendered feedback does not prove attention, comprehension or pre-quiz knowledge.

Fresh context statements now concern appreciation, matching the direct change question. Captured statements about liking remain about liking. Increased appreciation need not imply increased liking. A single exception to a matching "rarely" claim does not establish inconsistency. Direct change answers never generate an after-rating.

## Curation diagnostic

The first panel containing Bosch now crosses reviewed secondary story clues with impossible imagery:

| Painting | Secondary story clues | Impossible imagery |
| --- | --- | --- |
| Bosch, The Garden of Earthly Delights | Present | Present |
| Bruegel, Hunters in the Snow | Present | Absent |
| Goya, Saturn Devouring His Son | Absent | Present |
| Kandinsky, Composition VII | Absent | Absent |

"Secondary story clues" means incidents, objects or relationships beyond the main motif. Saturn has a central narrated action; its annotation does not mean "no story." The Triumph of Death moves to the neighbouring panel. The first 72 identities, early Caravaggios, Varo, Siqueiros and the Western/Mexican emphasis remain represented. Existing saved definitions remain authoritative.

This is a more informative crossing, not a controlled experiment: artist, period, colour, subject, medium, reproduction and many other features still vary. The historic erroneous sparse-composition reading cannot be attributed to Bosch having a low complexity annotation: its descriptor was already high. The historical all-dense quartet provided no density contrast, and example selection and wording also weakened that reading. Old coordinates are not retroactively upgraded to absolute liking.

## Selecting and reading follow-ups

Quality checks require at least three actual earlier discovery groups and two supported candidate directions. The binder selects an earlier-rated pair never previously offered together, for which the two candidate explanations predict different choices. It prefers fewer other reviewed differences. If the catalogue cannot supply such a pair, the task explicitly falls back to ordinary appeal or stays unavailable; no prediction is manufactured.

For example, earlier choices may fit both secondary story clues and layered space. A new comparison can put a clue-rich, spatially shallow painting against a spatially layered painting without those secondary clues. A substantial gap favours one frozen prediction in this comparison; a tie or small gap leaves the distinction open. A result favouring absence is described as "without" that quality. This is a new comparison of familiar works, not validation on unseen paintings or another independent discovery group.

Grouping checks use a valid completed sorting with meaningful spread and a nearby pair. Both anchors must carry two reviewed qualities. The two candidate companions must respectively carry one quality and lack the other. Users can choose either, both, neither or uncertainty. One selection supports a relationship to investigate; it does not prove the original grouping motive or the companion's appeal. A single undifferentiated stack is insufficient.

The exact source questions, captured answers, reviewed qualities, alternatives and predictions are frozen before presentation. Later edits or annotation revisions do not rewrite that captured prediction. Artwork source/reproduction identity remains checked, including provenance hash aliases. Evidence displays the original group or frozen training answers beside the result. Malformed sources, swapped companion predictions and mismatched reproductions fail closed.

## What remains a hypothesis or a gap

- These questions, thresholds, ranking weights and selection heuristics need product evaluation. The research supporting distinct aesthetic responses does not validate this exact profile model.
- One opening attention map and one connection map usually justify specific examples or an early indication, not a broad stable claim. Later sets can establish recurrence.
- Grouping follow-ups currently contrast source-bound visual qualities. Colour, period, movement and familiarity remain plausible competing explanations; the selector does not yet estimate information gain across all of them.
- A changed response beside different paintings requires a deliberately repeated, matched company comparison. The current opening does not establish that effect. Its category remains visible with the missing comparison explained.
- Response gaps are reported scale distances, not literal ratios of liking or confidence. Repeated paintings remain related evidence.

## Verification

Regression coverage includes absolute-positive clusters versus absolute-negative clusters, ordinal compatibility, uncertainty, source identity, frozen checks after edits, provenance hashes, malformed diagnostics, rival polarity, grouping without preference votes, context construct alignment, first-block coverage and continued saved journeys. DOM checks cover per-painting familiarity controls and matching review behaviour. Opening tests cover exact pointer coordinates, reduced motion, resizing, energy fading and bounded deformation.

Production builds and both application test suites are checked before publication. A restricted local browser connection prevented a visual localhost preview; this is tracked separately from DOM and mathematical interaction tests.

Release verification: 1,055 Art Atlas checks passed, with one optional private-export replay skipped; all 38 main-site tests passed. The production build passed. Deterministic legacy panel and pair plans were compared with the deployed planner, including a full 300-round plan and an exhausted comparison window: results were identical. Bounded caches retain public planning inputs and artwork IDs, never answers or predictions.
