# Comparison-first study decisions

Fresh studies ask **“Which do you prefer?”** for each small group. The line retains 101 positions, dragging and one-position adjustments. Its labels are “Less preferred here” and “More preferred here”; numerical positions are hidden. Only order and exact ties enter the new preference models. Moving every painting through a strictly increasing transformation leaves the evidence and query selection unchanged.

A group winner is not automatically liked. Separate selections ask for actual favourites and dislikes, with **None** and **Not sure** available. Admiration, interpretation, familiarity and museum choices keep their own instructions and evidence channels.

## Why use comparisons

[Maystre and Grossglauser (2017)](https://proceedings.mlr.press/v70/maystre17a.html) investigate adaptive pairwise ranking under specified noise and ranking assumptions. This motivates using earlier orders to choose useful subsequent comparisons. Our quartet line, heuristic planner and feature hypotheses are not their algorithm and do not inherit its statistical guarantees.

[Liang, Glover and Hawkins (2026)](https://link.springer.com/article/10.3758/s13428-026-03167-x) compare ranking and best–worst methods for life values. The findings motivate testing comparative elicitation, but neither validate art-taste measurement nor establish this continuous quartet line as a best–worst instrument. A participant pilot is still needed to assess comprehension, fatigue, repeated-choice stability and whether the resulting explanations are useful.

## What is implemented

- Eighteen first-comparison quartets introduce 72 different paintings. Each has one or two declared editorial comparison objectives. The qualities are source-bound visual annotations, not personality factors or isolated causes.
- Five separate admiration maps revisit 20 of those works. The same artwork identities permit preference/admiration comparisons without treating the two judgments as interchangeable.
- Rounds 19 and 27 connect representatives of earlier local orders. Round 23 records an early explicit dislike selection.
- Round 46 offers all 72 actually compared works for up to five favourites. Round 49 offers the **exact captured pool and order** for dislikes. Each question records its own viewed pages; equal available pools do not prove every image was viewed.
- Rounds 47 and 48 compare earlier high/high and high/middle representatives across source groups. These labels describe local order, not absolute liking. Tied groups remain tied candidates.
- Round 50 attempts a new, previously unoffered pair that challenges an earlier directional descriptor hypothesis. Training answers, source identities, feature values, predicted direction and rival explanation are captured before the outcome. If no eligible prediction exists, it uses a sufficiently delayed exact return or an explicitly labelled bridge instead.
- The comparison graph retains disconnected groups, observed frontiers, exact ties, repeated pair observations and contradictory cycles. It provides neither an absolute global ranking nor a probability that an unseen painting will be liked.

The final anchor questions, bridges and checks bind only from valid earlier captured responses. Future plans and later answers cannot train an earlier check. Once entered, a question keeps its bound definition even if an earlier answer changes.

## Collection and contrast audit

The current catalogue has 487 source records. The main collection contains 347, of which 344 are study-eligible; the additional world collection contains 140. This is editorial routing, not a claim about a viewer’s taste or a work’s creation location. Historical responses and saved museum works remain visible regardless of the current default collection.

The first 72 ordinary-comparison works include 71 from Western/American practice contexts and 16 with country recorded as Mexico. The first 100 interactions introduce a fixed ordinary-comparison cohort of 127: 126 Western/American-context works and 30 recorded as Mexico, plus one recorded as Mexico/United States. The Great Wave is the sole early global exception. All named Notion anchors, all Five Senses and all 24 new canonical additions are included by 100; the Doré work retains its representative-impression qualification.

All 16 reviewed visual qualities have at least five direct present/absent opportunities across the first 18 discovery sets. The actual counts and painting identities are in [the first-100 allocation audit](first100-v12-audit.md). A later example route crosses six predeclared pairs of qualities. Four annotation cells help separate correlated explanations; they do not isolate a causal effect because artist, subject, period, reproduction and other properties still vary together.

The main collection’s frozen first-comparison reservations are **72 + 55 + 55 + 54 + 54 + 54** through 300 interactions. Protected exact returns and supported challenge comparisons retain their original work sets. Unsupported predictions become exploration with an explicit fallback reason. A larger or older frozen catalogue can have different retained reservations; its existing pools are not rewritten to fit these current counts.

## Compatibility and saving

Old overall and legacy relative answers retain their original question, scale, positions, catalogue and source bindings. The new method starts a separate study and archives the old active study through the existing guarded save transaction. Previous quizzes can be reviewed without migration or score conversion. If that transaction fails, the last stored original remains active.

The active study is stored through IndexedDB with a small local-storage reference written only after a successful database commit. One deterministic audit serialized approximately 3.52 million characters when fresh, 3.88 million after 50 and 7.56 million after 300. These are fixture-dependent character counts, not a local-storage budget or browser quota guarantee. A test with a 2,048-character local quota verifies a complete database-backed save and restore.

## Verification limits

Regression checks cover exact ties, one-step orders, monotone-rescaling invariance, source/image substitutions, insufficient or future evidence, independent page exposure, hypothesis freezing, graph connectivity and cycles, deliberate spaced repeats, six-block reservations, archival preservation, continuation at 51/100 and 101/150, and forced save failure. These are implementation guarantees. They do not establish psychometric reliability, causal explanations, population percentiles or optimal information gain.
