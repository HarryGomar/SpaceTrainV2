# Visual axes and quality connections

The profile now separates broad visual dimensions, more specific artwork qualities, admiration of the making, and explicit favourites. A local preference winner stays a local winner when the original question used a relative scale. The analysis never turns those older positions into a global list of likes.

`buildTasteAxes({works,rounds,answers})` returns all six visual-axis rows. Each distinguishes a recurring direction, a tentative direction, balanced choices, or insufficient opportunities. Detail and visual activity remain separate components of the detail/composition row. Each row includes supporting, opposing and unresolved artwork-set counts, source rounds, examples and alternatives. Repeated responses can contradict a reading but cannot enlarge its discovery denominator. Action and setting annotations require their captured literal-semantics marker. An unmarked historical value remains unknown.

`buildTastePatterns({works,rounds,answers,annotationReviews,currentWorks})` returns separate `appeal`, `relative`, `admiration`, and `favouriteConnections` channels, plus a combined `patterns` list and linked recommendations. `currentWorks` is optional when captured preview hashes or the sidecar's verified current-asset references resolve the source identity. The complete annotation sidecar is required, including its reference map. The model does not mutate captured metadata or answers.

## Evidence rules

| Basis | Eligible data | What the reading can say |
| --- | --- | --- |
| Within-set visual contrast | Confirmed unconditional preference, under one captured instrument | A reviewed quality repeatedly accompanied the preferred side of comparisons. Legacy data stays relative. |
| Across-set overall ratings | Exact overall-appeal protocol only | A quality accompanied higher overall ratings across the observed catalogue. Equal weighting by artwork set limits a large panel's leverage. Context and other visual qualities remain alternatives. |
| Admiration | The captured achievement map's original vertical labels | A quality accompanied greater admiration of the making. It is analysed separately from liking. |
| Explicit favourites | Confirmed, unranked favourites selection with valid page exposure | A quality recurs among selected favourites. Unselected and unvisited works are not dislikes. |

For within-set directions, a clear comparison requires a response gap of 15 and a numeric descriptor difference of .25. Binary qualities require a reviewed present versus explicit absent contrast. A recurring direction requires three disjoint comparison examples across three artwork sets and three preferred-work artists, plus a two-to-one balance over opposing and mixed sets. Near ties supply no direction. Two distinct later check sets going against an earlier direction prevent a firm summary, without becoming new independent samples.

Across-set associations require at least six reviewed works on each side, three artwork sets on each side, a set-weighted gap of 15, and three high-rated examples across three sets and artists. The 65/35 descriptive bands identify high and low ratings. These thresholds are reporting rules chosen for this prototype. They are not confidence levels, significance tests, norms or predicted probabilities.

The broad axes also report a tentative tendency when at least three supporting directional sets span three disjoint examples and artists, supporting directions outnumber opposing directions by at least two to one, and the margin is at least two sets. Unresolved sets and later conflicting checks stay visible. A tentative direction is excluded from the firm headline. A homogeneous descriptor set supplies no directional vote even when its response positions differ widely. Its exact positions remain in the per-work ledger. A low response in an equally human-focused set cannot establish a preference about human presence. A low position in an all-dense set cannot establish a preference for simple compositions.

Favourites connections require at least three selected works from three artists sharing a reviewed quality. Header eligibility additionally requires a greater concentration among reviewed favourites than among reviewed overall-rated works, with an actual with/without baseline. One selection remains one selection. Its three paintings do not become three independent replications. Lower-rated examples sharing the quality and favourites outside it remain attached to the reading.

Sixteen reviewed qualities and eight declared bundles describe visible content and treatment. The bundles include stories within scenes, light around people, expressive figures, staged human relationships, pattern and structure, and precision and materials. A bundle documents co-occurrence, not a fitted interaction between its parts. Correlated alternatives accompany the comparison evidence. Museum-documented symbolism is separate context; a narrative detail tag does not establish symbolism or allegory.

## Source identity

A current interpretation must match the captured source URL and preview path. Every declared preview-hash alias must agree with the review. A mismatched version, source, image or hash yields unknown, never absence. When the original capture lacks a hash, an independently verified current-asset reference may support a clearly labelled current editorial interpretation. It cannot establish which bytes were shown historically. Both kinds of interpretation remain assistant visual reviews rather than independent human annotation.

Recommendations require the same source-bound quality reviews. They point to actual supporting works carrying the quality and exclude works with recorded exposure or conservative exposure uncertainty. A museum's full offered tray does not become viewed merely because it was available. Unvisited favourites pages remain unviewed when valid page records exist. The result says only that a candidate is not recorded as presented or rated in this quiz. It does not claim that the person has never seen it.

## Fresh v11 schedule and saved studies

The first 50 retains 18 ordinary overall-appeal quartets, 72 distinct initial rating works, all four arrangement tasks and the five answer-bound closing questions. It now has five admiration maps at 4, 6, 21, 34 and 45, covering 20 distinct works. Liking for panel 2 moves to 3, before its admiration map at 6. The former unpaired keep grid and isolated surface self-rating supply the two added matched maps. The first familiarity set uses Arnolfini instead of Pearl to avoid an immediate familiarity/preference repetition.

Actual coverage comes from valid responses. Five, four or three answered maps yield 20, 16 or 12 distinct admired works. A started historical 50-question block retains its entire pending schedule as well as its shown definitions, skips and malformed answer-owned definitions. This prevents a half-completed study from silently acquiring an admiration map whose earlier liking question was replaced. An entirely unstarted block can refresh; its previous plan is archived in `planRevisions`. Saved answer and artwork identities remain unchanged.

The preserved 164-work cohort retains first-rating reservations of 72/46/46. Three deterministic 150-question allocation audits preserve those counts. The independent grid/matching budget is 32 slots per block, compared with 44 before removing the unpaired 12-work grid. With the final v2 descriptors, the audits cover 32 distinct works by 50, 64 by 100, and 88/89/91 by 150 in those independent slots, with a peak of two uses and no reuse within three questions. These are allocation counts from scripted answers, not participant evidence or a psychometric validation.

The current 463-record collection has 460 study-eligible works. Its fresh route retains 72 initial ordinary rating works, then five releases of 64 through 300 questions. Each later block reserves 16 exploratory quartets, one protected exact delayed repeat and one challenge opportunity. When no reviewed directional cue qualifies, the latter becomes a seventeenth exploratory panel with an explicit fallback record and no prediction. High, low and middle repeat focus rotates across blocks. The remaining 68 works form explicit overflow. Smaller collections spread their available new first ratings across the remaining blocks; saved cohort assignments remain authoritative when new artwork arrives. A completed 300-question study leads to the galleries or a separate quiz.

Fresh sequencing favours Western/Americas classics and requested Mexican/Latin American works. East Asian and South Asian/Himalayan practice groupings remain distinct and mostly enter from 201 onward; Great Wave remains an early global anchor. This policy applies to independent grids, matching, sourced context notes and fixed exercise sets as well as ordinary quartets. It is editorial sequencing, never a preference seed or a claim about where each painting was made. The complete current allocation and quality-contrast counts are in [the fresh-route audit](fresh-route-v11.md).

## Active save capacity

With the final v2 provenance, a new active study measured 3,191,602 serialized characters before answers. A scripted completed 300-question study reached 6,957,660 characters. Active studies therefore use IndexedDB, with a small localStorage reference published only after the full database transaction succeeds. Draft events coalesce before serialization; saved records, sources and integer positions remain unchanged. Legacy inline records still open. Missing database records or unsupported references fail closed instead of starting a replacement quiz over the recovery reference.

Session replacement waits for its durable save. Clear invalidates pending writes, preventing a late completion from restoring erased data. Page hide and visibility changes request a best-effort flush; browser termination cannot provide a transaction-completion guarantee. Quota and write failures retain the previous committed snapshot and expose a download action for the live answers.

## Research boundary

[Canal et al., 2019](https://proceedings.mlr.press/v97/canal19a.html) study active paired-comparison selection under an embedding and noise model. That motivates spending comparisons carefully, but the present reporting and selection heuristics do not implement their information-gain guarantees. [Bower and Balzano, 2020](https://proceedings.mlr.press/v119/bower20a.html) model features that become salient in a particular comparison. That motivates retaining the actual alternatives and context rather than treating every reversal as inconsistency. Neither paper validates these artwork annotations, profile families, thresholds or quiz.

Next validation should use independent human attribute reviews, a prospective set of held-out artwork comparisons, and repeated sessions with clear exposure histories. The current models provide inspectable descriptions and counterexamples while that work remains undone.
