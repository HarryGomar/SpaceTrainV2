# Overall appeal and closing refinement

Fresh journeys use `art-profile-50-v10`. Every new unconditional preference spectrum uses the `overall-appeal-v1` contract from `appeal-scale.mjs`: each painting is rated independently, with continuous integer positions from0 to100 and dislike/neutral/like anchors. The input is not a forced ranking. All four paintings can receive identical high, low or neutral responses.

Captured older questions retain their wording, scales, definitions and answers. An exact repeat copies the original instrument. A relative-preference answer is never relabelled overall appeal. Adaptive directional models select one captured measurement scope at a time. Legacy responses supply within-set order rather than an appeal-intensity weight; overall-appeal sources can supply their within-set point gaps. Neither model produces calibrated preference probabilities.

## Fresh first50

The first18 main quartets contain72 distinct paintings. They include all three new Caravaggios, the added Bruegel, Velázquez, Van Eyck, Renoir and Marc, plus Siqueiros’s Madre niña, Varo, Carrington and other Mexican works. Four famous opening paintings remain the benchmark. The first sorting set uses eight paintings already offered before it, including Blanchard and Tamayo constructions, Mexican portraiture and familiar paintings. Its later return retains the same eight identities.

The direct density, standalone openness and unexpectedness labels give way to three preserved tasks moved earlier: the Tara reveal at25, the sorting return at32 and attention to making at45. A second clarity/interpretation map at43 revisits the Hope/Varo set. The people-importance question remains in the wider source library but is not a fresh first50 slot. The same-subject decision has a genuine earlier Cassatt pair because the maternal quartet retains both Bath and Omnibus alongside Siqueiros and Morisot.

With164 works, later releases are46 and46. Twelve exploratory quartets provide the capacity needed alongside six protected adaptive panels: two exact repeats, one changed-company comparison and three directional challenges. Existing156-work reservations remain42/42 with their original quota scheme. Saved adaptive source objects remain authoritative. `firstRatingSlotCapacity` separates available new-rating places from places occupied by already-rated protected comparisons; `firstRatingTargetMet` reports the actual result.

## Last five questions

`final-refinement.mjs` exports three functions:

```js
buildFinalRefinementRounds({works, offset =0, seed})
isFinalRefinementRound(round)
bindFinalRefinementRound({round, works, rounds, answers, seed})
```

Templates contain valid placeholder identities and `unavailable:true`. They do not contain a fabricated response, a future prediction or a planned answer. The binder accepts actual earlier shown definitions, validates source identities and confirmations, and produces a resolved definition. The host captures it in `shown` when entering that question. Later answers do not refresh a captured definition.

| Slot | Decision | Evidence meaning |
| --- | --- | --- |
|46|Choose up to five favourites from all earlier rated paintings, paged18, highest recorded appeal first.|An explicit bounded collection of favourites; all earlier rated paintings remain available, including score ties. No numeric ranks are inferred from selected or unselected images.|
|47|Rate four earlier paintings together, prioritising explicit favourites.|Overall appeal in new company, not an exact consistency check.|
|48|Compare a provisional descriptor direction with a competing direction where available.|Captured directional checks; no competing hypothesis is invented when earlier evidence is insufficient.|
|49|Revisit an exception or another cross-set comparison.|A prospective comparison with its earlier source values and model snapshot retained.|
|50|Return to an unchanged earlier quartet after a sufficient captured exposure gap.|An exact repeat only when the original instrument and an eight-question gap remain available. Otherwise a labelled new closing comparison.|

The favourite round has `construct:'overall-favourites'`, `selectionMode:'shortlist'`, `explicitFavourites:true`, `maxChoices:5` and `instrumentRevision:'paged-favourites-v1'`. The pager records `presentation` with protocol, pageSize18, visitedPages and activePage. `choiceGridExposure` supplies only the actually opened page groups. Missing or invalid page history remains unknown; it cannot create a new-comparison claim.

A repeat reservation avoids the default first favourite page, not the full available collection. No favourite is removed for the sake of a repeat. If the viewer opens the reserved page or otherwise sees the works too recently, the repeat fails its delay check and becomes a new closing comparison. A confirmed favourite is never silently removed from the next comparison by an obsolete reservation.

Each bound definition stores `evidence.finalRefinement`: protocol, slot, role, source IDs and captured selection ratings. Probes additionally retain hypotheses with exact training responses and feature values, plus explicit pair predictions. `comparisonNovel` means the comparison was not previously co-presented under the recorded history, not that its paintings are unfamiliar. Unknown exposure suppresses that claim. Repeated items, selected features, earlier individual ratings and memory remain dependencies; these outcomes do not establish causal motives or statistical independence.

Insufficient confirmed sources return `unavailable:true` and an explanation. They never produce a substitute answer. Restored definition aliases (`workIds` and `anchorIds`) are updated with the actual bound works so consumers cannot accidentally analyse placeholder identities.

## Verification

The final-refinement and session tests cover missing/unconfirmed/future/legacy sources, exact identity aliases, explicit None, all-rated/tied favourite availability, page exposure, frozen entry snapshots, mixed measurement scopes, captured training provenance, safe repeat fallback, legacy instrument preservation and actual72/46/46 allocation. Historical instrument tests use the publicv8 fixture rather than recreating obsolete questions from the current generator. Synthetic answers in tests are allocation/validation fixtures, not evidence about real people.

Selection is an explicit heuristic. This is not optimal information gain, a validated psychometric instrument or a personality classification.
