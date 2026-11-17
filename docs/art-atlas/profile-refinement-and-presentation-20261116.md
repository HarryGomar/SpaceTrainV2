# Profile refinement and presentation

This change follows the explanation and question-selection work in `8251c23`,
the painting-first familiarity correction in `fc4f7c2`, and the reading layout
in `d97ab1e`. It contains no personal response export or private replay data.

## What changed in the analysis before this update

- Comparative explanations take priority over a small enrichment among selected
  favourites. Shared favourites remain descriptive evidence, not independent
  replications.
- Evidence selection prioritises real favourites and positive support, retains
  same-set comparisons, and exposes explicit dislikes and counterexamples.
- Overlapping explanations remain rivals. Targeted checks freeze their source
  answers, artwork reviews and opposing predictions before the response.
- Sorting can select a subsequent companion comparison from an actual group.
  Group membership does not become a preference vote.
- Continuous appeal preserves levels, exact ties and gap sizes. Historical
  order-only coordinates retain their original interpretation. These recording
  and scoring capabilities partly predate this work; they were not introduced
  from scratch in this session.
- Direct context responses retain their selected change category and the exact
  note. There is no invented after-rating or general inconsistency diagnosis.

## Optional questions after the first 50

`profile-refinement.mjs` selects an optional question only when earlier responses
supply an interpretable uncertainty. The invitation explains the next question's
purpose. The user chooses whether to start and can return to the reading at any
time. Ten presented questions is a hard ceiling, not a target.

Available routes are:

1. A source-bound quality comparison where two supported explanations predict
   opposite choices. The existing diagnostic binder supplies the frozen sources
   and predictions. At most two extra checks address the same pair of hypotheses.
2. A companion comparison for an earlier nontrivial sorting group that has not
   already received that relationship check.
3. A different set of paintings for an observed attention/appeal,
   connection/understanding, comfort/return, or admiration/appeal distinction.
   This requires an existing low-first-axis/high-second-axis response and fewer
   than two measured sets on that map. Previously recorded appeal helps select
   the works; it does not supply the missing response. No extra map is added
   merely because a category exists in the profile.

The selector rejects the diagnostic binder's generic appeal fallback. It stops
when no eligible comparison remains. Priorities and thresholds are editorial
rules; this is not an optimal information-gain algorithm or a calibrated estimate
of how much accuracy another question will add.

The original plan stays in blocks of 50 through 300. Optional definitions are
stored separately in `profileRefinement.plan`; their answers and presentations
use the existing local storage and export machinery. Analysis inserts them after
round 50 and before round 51. Continuing to 100 preserves that history and uses
it in subsequent selection and exposure records. A paused draft resumes the same
captured question. Extra diagnostic responses remain dependent checks, rather
than new discovery votes.

## Reading and interaction presentation

- A visual index replaces the theme tabs. All nine categories remain visible,
  with restrained construct colours, confidence wording, painting previews and
  native expandable rows. Larger source paintings and evidence open in place.
- Context summaries omit zero-count prose, explain appreciation in plain language
  and retain uncertain reports in the summary's evidence. Admiration wording
  explains the judgment about how a painting was made without assuming that
  admiration differs from liking in that person's ratings.
- Phone spacing has a final shared stylesheet. The line retains all integer
  points and exact ties, including two-work comparisons, without boxed +/-
  controls. Equal-position tokens use separate visual lanes. Longer context
  notes can scroll without covering the action area.
- Animation draws on every browser animation frame, removing the irregular
  cadence of the previous 75 Hz threshold. A short input filter attenuates small
  pointer noise; entry and resizing still latch directly to the pointer.

## Limits and verification

The automated checks cover evidence identity, frozen diagnostic sources, ties,
integer precision, optional-question stopping, draft restoration, the preserved
50/100 schedule, and inclusion of extra answers in the reading. Browser checks
cover the visual index and task layouts at desktop and two phone sizes.

These checks establish implementation behavior. They do not demonstrate that
people find the readings more accurate or revealing. Artwork annotations remain
editorial interpretations. Grouping checks do not yet cover every possible
colour, date, movement or material explanation. The new optional flow does not
add a controlled test of changing a painting's company, and attention remains a
reported response rather than measured viewing time.
