# Direct change in appreciation

A second bounded appeal rating cannot express an increase when the first response is already at the top. Fresh context questions instead show the painting, reveal the exact sourced note, then ask: **“How much does knowing this change your appreciation?”**

The five choices are Much less, A little less, No change, A little more and Much more. Unsure is separate. Nothing is selected by default. A previous personal-appeal rating of 100 can coexist with Much more; the application does not invent a rating above 100 or a synthetic after-score.

The typed instrument uses `contextMode: reported-context-change-v1` and `contextProtocol: reported-appreciation-change-v1`. A complete answer records the exact work and content IDs, `storySeen: true`, `confirmed: true`, and either a `reportedChange` code of 0, 25, 50, 75 or 100 with `uncertain: false`, or `uncertain: true` without a numeric response. These are ordered choice codes, not calibrated psychological intervals.

The original note, claims, source links and revision remain captured. An optional earlier continuous personal-appeal response is attached only when it was actually confirmed before this note and refers to the same reproduction/source. Its value, question and answer are frozen on entry. The direct question is valid without such a baseline.

The response reports what the viewer says the information adds. Reading, another look, elapsed time and the prompt occur together, so it is not an experimental estimate that the note caused the change. Repeated reports about the same painting do not become additional independent artworks.

Historical before/after symbolism ratings and earlier curiosity-change questions remain distinct. An old maximum-to-maximum response stays unchanged; it is never recoded as a positive direct change. The historical statement-versus-before/after reading remains available for its original sources. The new direct reports have their own result records and do not synthesize that older comparison.

Checks cover maximum baseline plus Much more, valid reporting without a baseline, explicit Unsure versus No change, actual painting→note→response order, confirmation, wrong or unfinished responses, missing typed markers, exact source identity, future-answer exclusion, frozen baselines, source-note round trips and preservation of old 5-to-5 answers.
