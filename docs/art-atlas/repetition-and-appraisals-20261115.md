# Repetition and appraisal audit

This records the earlier v9 allocation audit. The current v10 route, measurement contract and all-rated favourite pager are documented in [final-refinement-v10.md](final-refinement-v10.md). The audit helper now follows v10; its current totals should not be presented as a reproduction of the historical v9 totals below.

The v9 journey spends independent grid and matching places on less-used paintings before applying recognition preferences. Deliberate repeats, familiarity/shortlist links, preference/appraisal links, sourced exercises and the 72/42/42 first-rating reservation remain intact.

## What was causing avoidable repetition

`selectWorks` already recorded cumulative appearances, but it removed candidates outside a hard recognition tier before comparing those counts. Grids requested nine landmark works, and matching requested three. That made the existing cumulative-use penalty unable to consider many less-used paintings. Instrument-local counters also restarted in each block. The new independent selector first avoids its known neighbours and the preceding three questions when possible, then chooses the least cumulatively used eligible paintings. Recognition is a small tie preference among equally used candidates. Field-distinct matching eligibility still applies. Small-pool spacing exceptions are recorded rather than silently claimed as successful avoidance.

The adaptive fallback had the same hard-tier restriction in ordinary exploration. It now ranks by prior presentations plus four units for each already planned appearance before comparing new pairings and editorial recognition weights. Protected exact repeats, recontextualizations and challenge pairs do not pass through this new exploration rule. Curated exploratory comparisons retain descriptor contrasts and geographic coverage, but the historical-presentation cost increases from 0.03 to 2. An image shown repeatedly can therefore yield its place to a slightly less extreme known contrast.

## Measured allocation

These are deterministic allocation audits using the real 156-work catalogue. Each block receives complete within-set preference answers spanning 0–100 in presentation order. The full museum tray is skipped, so availability is not counted as exposure. These are not observed participants or viewing-time measurements. Independent selections count a first grid binding or a matching question; its paired reuse is counted in overall appearances but excluded from independent slots.

| Through round | Independent slots | Distinct paintings before | Distinct paintings after | Peak independent appearances before → after | First preference ratings added |
| --- | ---: | ---: | ---: | --- | ---: |
| 50 | 44 | 44 | 44 | 1 → 1 | 72 |
| 100 | 88 | 67 | 88 | 3 → 1 | 42 |
| 150 | 132 | 81–83 | 105–109 | 4 → 2 | 42 |

The three audited seeds are `reviewed-variety-v5-0`, `editorial-release-audit` and `independent-underuse-audit`, each suffixed by `-0`, `-1`, `-2` for its blocks. At round 150, the number of paintings with more than six total specific-question appearances falls from 22–24 to 11–15. The overall peak falls from 10 to 9 in two paths and stays 10 in the third. All 156 paintings receive a first unconditional preference rating by 150.

The first 50 still has a peak of six or seven appearances. For example, Red Fuji appears in the fixed familiarity/shortlist pair, its preference and exact delayed return, a sourced neighbour exercise, Difficult edit and a prepared bridge comparison. This change does not claim to remove those deliberate or source-constrained repetitions. Altering their sets would require a separate content-design decision.

Reproduce the allocation audit:

```powershell
node --input-type=module -e "import {auditTrajectory} from './tests/art-atlas/helpers/repetition-audit.mjs'; for(const seed of ['reviewed-variety-v5-0','editorial-release-audit','independent-underuse-audit']) console.log(JSON.stringify({seed,metrics:auditTrajectory(seed).metrics}));"
```

## What a density rating contributes

A direct density placement records the viewer's description of a particular reproduction. It does not establish a preference, explain its cause, or reveal a personality trait. Its useful contribution is a matched comparison: does a person repeatedly prefer the works they themselves describe as denser, and where does that relationship fail? This avoids silently replacing the person's perception with an editorial complexity descriptor. A one-set report such as “you called B denser but preferred A” is inspectable evidence, but too little to headline as a discovery.

All original responses, frozen scales and preference/appraisal maps remain available. A density headline now needs at least three pairwise non-overlapping artwork sets under the same frozen question, a consistent set-level direction, and at least four distinct named artists across those three support sets. The actual 15-point preference and 20-point appraisal pair-gap rules remain provisional. Repeats or overlapping sets do not count toward that three-set requirement. Opposing sets and opposing pairs inside supportive sets remain displayed. These are conservative display rules, not statistical independence, causal isolation, significance or confidence estimates.

At one density question per 50, a fresh 50 or 100 cannot produce a density headline. If a shorter route needs every question to yield immediate profile value, this item is a candidate for an optional follow-up rather than an obvious visual-label task. It should not be justified as an immediate hidden insight.

## Saved sessions

The journey revision is `art-profile-50-v9`; the selector policy is `specific-question-variety-v2`, and the planner revision is `curated-stimuli-v3`. History remains authoritative. Shown definitions, answer-owned definitions, raw answers and saved adaptive source snapshots are preserved. The journey builder explicitly recognizes v8 panel bindings so pending matched follow-ups keep the actual shown set. `deep-study.mjs` must also include `art-profile-50-v8` in its legacy panel-binding allowlist before integrating this revision. Existing pending-plan migration updates only unshown, unanswered questions; saved later-block adaptive panels remain the source of their protected roles.

The fresh people appraisal now asks “How important are the people in each painting to your reaction?” with “Not important” and “Very important” endpoints and explicit no-people guidance. Its output label is “Importance of people”. Earlier saved figure wording and scales remain literal source definitions; they are not silently reinterpreted as the new instrument.

## Research limits

[Canal et al., Active Embedding Search via Noisy Paired Comparisons (2019)](https://proceedings.mlr.press/v97/canal19a.html) studies query selection under a specified embedding and response model. It motivates avoiding redundant questions; this implementation does not implement its information-gain bounds, posterior, noise model or validated estimator.

[Bower and Balzano, Preference Modeling with Context-Dependent Salient Features (2020)](https://proceedings.mlr.press/v119/bower20a.html) formalizes comparisons whose salient features depend on the presented pair. It motivates preserving the actual alternatives and separating exact repeats from new contexts. It does not validate these art descriptors, spectrum questions or profile thresholds.
