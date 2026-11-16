# Continuous personal appeal

The current fresh quiz asks **“How much do these appeal to you?”** on the existing painting line. Its anchors are **Strongly dislike · Neutral · Strongly like**. Every integer position from 0 to 100 remains available, including dragging, keyboard adjustment and one-point nudges.

The instruction is: “Rate each painting for yourself. They can all be high, low or equal. Larger gaps mean a stronger difference in appeal.” This captures two related signals:

- **Personal level:** four paintings near the right are four positive responses. The lowest of those four is not a dislike. Four near the left are negative responses even though one may be locally preferred.
- **Difference:** 98 versus 97 is a smaller recorded difference than 98 versus 10. Both have an order; they do not receive identical fitting weight. Equal positions retain an exact tie, whose personal level can be high, low or neutral.

The coordinates express the viewer’s own anchored response. They are not population scores, probabilities, calibrated confidence or a demonstrated interval measurement of liking.

## Implementation contract

`continuous-preference.mjs` defines the separate `personal-appeal-continuous-v1` instrument. Recognition requires its exact marker, scope, title, instruction and three anchors, with no contradictory overall or ordinal marker. The shared overall and comparison predicates accept this known instrument because it supports both capabilities. Callers that mean **order only** explicitly exclude it.

The measurement key remains distinct from older overall and ordinal instruments. Adaptive fitting uses signed descriptor differences weighted by the raw personal-appeal gap divided by 100, with one bounded contribution per distinct source set. It does not pool old relative coordinates into personal levels. This weighting is an explicit design heuristic, not a statistical guarantee or an estimated confidence.

The graph stores personal levels, source round IDs, exact ties and per-pair gaps alongside its recorded directions. Its separate recorded-level ordering may compare works across groups using this same anchored instrument. A component frontier still describes only the comparisons actually observed. Earlier responses remain in the ledger when a later response changes.

Later questions use anchored high, low and near-neutral responses where available. If a requested band does not exist, the fallback is recorded rather than calling a locally lowest favourite a dislike. Gap size affects fitted hypotheses and the choice of later checks. Exact returns retain the original prompt, scale and source protocol.

## Experience retained

The curated 72 first-comparison paintings, 127-work ordinary cohort through 100, 344-work main study pool, five admiration maps, museum exercises and six-block reservations are unchanged. Favourites at 46 and dislikes at 49 use the same captured pool, with their own page-view records. These explicit declarations add information beyond how much a work appealed in an earlier encounter. They permit None and Not sure.

The final checks freeze training responses, descriptor values and predictions before the outcome. New continuous checks retain their actual response gaps. A small positive gap is a small recorded difference, even if its order follows a prediction. It does not become a confidence percentage or proof of a cause.

Sourced-note questions now ask directly: **“How much does knowing this change your appreciation?”** The choices are Much less, A little less, No change, A little more and Much more, with a separate Unsure. The painting appears before the note is revealed. An actual earlier personal-appeal answer is captured when available, but a second absolute rating is not required: someone who already rated the painting 100 can still report Much more appreciation. No after-score is calculated. Older before/after answers retain their original meaning.

## Phone presentation

The shared painting line retains the same 101 positions. Paintings awaiting a response occupy a small tray; a placed painting appears on the line rather than twice in the selector. The compact adjustment control preserves one-point changes and ten-point keyboard changes.

Two-axis questions show the painting first and then the map. Placement stays editable until the viewer chooses the next painting. A completed map opens in review. These stages change presentation only: the same original axes, artwork identities and two-dimensional points are saved. Image readiness checks the representations shown at each stage, so hidden lazy-loading copies cannot prevent progress.

The painting viewer fills a phone viewport and supports fit, zoom and pan. It receives the actual shown artwork, including a frozen historical reproduction, and restores scroll and focus on closing. Inspection does not change any answer.

## Saved responses

Captured order-only questions retain order-only meaning. Captured older overall questions retain their original anchors and reporting rules. Neither acquires the new marker or a new interpretation.

The fresh method archives the old active quiz through the guarded save transaction and starts a separate quiz. The archive retains source identities, all positions, pending definitions and saved answers. A failed transaction leaves the last stored original intact. Previous quizzes remain accessible from the profile footer.

## Research and verification

[Maystre and Grossglauser (2017)](https://proceedings.mlr.press/v70/maystre17a.html) motivate adaptive comparison selection under stated ranking and noise assumptions; their guarantees do not apply to this heuristic implementation. [Liang, Glover and Hawkins (2026)](https://link.springer.com/article/10.3758/s13428-026-03167-x) compare ranking and best–worst methods for life values. That study does not validate an art-appeal slider or justify discarding its intended personal-level signal.

The useful design decision is to retain personal level and relative difference while using occasional adaptive comparisons and explicit selections to check the resulting explanation. A participant pilot must still assess instruction comprehension, scale use, fatigue, repeat stability and the usefulness of the final reading.

Regression cases cover all-high versus all-low groups with identical orders; equal high, low and neutral responses; all 101 positions; same orders with different gap weights and different eligible checks; anchored extreme selection; strict source/protocol separation; unchanged old ordinal rescaling behavior; frozen prospective sources; same-pool signed declarations; continuation and archival save failure.
