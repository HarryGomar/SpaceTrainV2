# Four curated contrast formats

[contrast-content.mjs](../public/art-atlas/contrast-content.mjs) supplies 24 reviewed content sets from the current 99-work study collection, six per format. It selects stimuli and freezes provenance. The response model and renderer own validation, feedback and interpretation. Adding these formats should replace four existing tasks within a 50-interaction block, rather than increase the block length.

The bank uses real existing local images. It introduces no images, downloaded assets, new descriptor values or changes to the main catalogue.

## Integration contract

```js
import {selectContrastContent} from './contrast-content.mjs';

const content = selectContrastContent({
  works, rounds: precedingRounds, answers,
  seed: sessionSeed,
  kind: 'neighbour',
  batchIndex: 0,
  notes: curationNotes
});

if (content.status === 'ready') {
  // The caller builds and saves this definition before the participant answers.
  // Convert content.workIds to works; retain a separate anchorWorks array.
} else {
  // Keep an eligible existing task or record why this format is unavailable.
}
```

Exports are `CONTRAST_CONTENT_REVISION`, `CONTRAST_KINDS`, `CONTRAST_CONTENT_BANK`, `RELATIONSHIP_OPTIONS`, `selectContrastContent` and `selectSubjectBaselinePair`.

All successful results contain:

- `status:'ready'`, `kind:'contrast'`, a canonical `contrastKind`, `contentId` and revision.
- `workIds`, `title`, `prompt`, `hint` and `construct`.
- `curationNotes` and `residualConfounds` as arrays of strings, plus object-level `sourceUrls`.
- An `exposureAudit`, `selectionAudit`, exact-pair `baselineLinks` and interpretation limits.

The four canonical kinds are `keep-leave`, `neighbour`, `chronology` and `same-subject`. Keep/leave has six work IDs. Neighbour has four candidate IDs and a separate `anchorId`; the anchor must remain outside the answer's `workIds` and inside the saved definition's `anchorWorks`. Chronology has four work IDs. Same-subject has two work IDs and a reviewed `subject` object.

Unavailable results contain `status:'unavailable'`, an empty `workIds`, a reason and rejected-set reasons. Missing or exhausted content does not produce a duplicated set, invented comparison or guessed chronology. Six sets per kind support the current200-interaction target with alternatives for spacing. The bank remains finite: a seventh use of a kind needs additional reviewed content or a transparent unavailable fallback. No original content ID was renamed.

The caller should save the chosen definition. It must not rerun selection after seeing an answer, reinterpret a changed set as an exact repeat, or retrofit a prediction.

## What each format records

| Format | Plain question | Observation | Interpretation limit |
| --- | --- | --- | --- |
| Keep one / leave one | Which would you keep, and which would you leave out? | Two distinct relative extremes among six images. | Leaving out a work does not establish dislike. The other four remain unordered. Give the task bounded total weight. |
| Choose a neighbour | Which has the strongest connection to this painting for you? | One perceived relationship with an anchor, or no good neighbour. | Relatedness is separate from preference. Several connections can make sense. |
| Put them in time | Put these works in order of when they were made. | Art-history order or an explicit uncertain response. | Correct chronology is not a taste or intelligence score. Approximate dates stay approximate. |
| Same subject | Which do you prefer? | One subject-conditioned preference, or no preference. | A reviewed subject match does not isolate pictorial treatment or any single visual feature. |

The response model should keep `noPreference`, `noGoodNeighbour` and chronological uncertainty as explicit responses. They are not missing choices and should not be converted into a full ranking.

Neighbour content includes optional relationship tags for colour, subject, shapes/composition, marks/surface, artist/tradition, felt response and another connection. Those are participant reasons. The editorial possibilities in the bank are not correct-answer labels or inferred causes.

## The 24 sets

| Content ID | Works and purpose |
| --- | --- |
| `keep-six-landmarks-a` | Starry Night, Mona Lisa, Great Wave, The Kiss, Mondrian's Composition and Liberty Leading the People. Six familiar anchors with varied subjects and treatments. |
| `keep-six-landmarks-b` | Night Watch, Lady of Shalott, Van Gogh Self-Portrait, Fan Kuan's Travelers, Blue Horse I and Luncheon on the Grass. A later six-landmark group. |
| `keep-six-landmarks-c` | Death of Marat, Monet's Rouen Cathedral, Black Square, Birth of Venus, Gentileschi's Judith and American Gothic. Another distinct six-landmark group. |
| `neighbour-starry-night` | Anchor Starry Night; candidates Twilight in the Wilderness, Great Wave, Composition 8 and The Night Café. Possible sky, rhythm, form, colour or same-artist connections. |
| `neighbour-milkmaid` | Anchor Milkmaid; candidates Child's Bath, Morisot's Reading, Girl with a Pearl Earring and the Korean Books and Scholars' Accoutrements screen. Possible absorbed activity, objects, composition or artist connections. |
| `neighbour-great-wave` | Anchor Great Wave; candidates Hōchū's Waves, Water Lilies, Turner's Burning of Parliament and Red Fuji. Possible water, weather/light, movement or printmaker/series connections. |
| `chronology-spring-to-scream` | Guo Xi's Early Spring, Mona Lisa, Milkmaid and The Scream. |
| `chronology-pearl-to-mondrian` | Girl with a Pearl Earring, Great Wave, Starry Night and Mondrian's Composition. |
| `chronology-ancient-to-gothic` | Roman Egyptian Funerary Portrait of a Young Girl, Garden of Earthly Delights, Gentileschi's Judith and American Gothic. |
| `subject-mountains` | Cézanne's Sainte-Victoire and Hokusai's Red Fuji. Two different mountain landscapes. |
| `subject-portraits` | Mona Lisa and Redon's Violette Heymann. Portraits of two different sitters. |
| `subject-flowers` | Van Gogh's Sunflowers and Monet's Spring Flowers. Different flowers and arrangements within flower still life. |
| `keep-six-landmarks-d` | Milkmaid, School of Athens, Sunflowers, Bharat Mata, Composition 8 and Hunters in the Snow. |
| `keep-six-landmarks-e` | La Grande Jatte, Ophelia, Stańczyk, Guo Xi's Early Spring, La Catrina and Turner's Burning of Parliament. |
| `keep-six-landmarks-f` | The Scream, Child's Bath, The Cradle, Las Meninas, Twilight in the Wilderness and Stag at Sharkey's. |
| `neighbour-blue-horse` | Anchor Blue Horse I; candidates Rousseau's tiger/buffalo scene, Dance, Red Fuji and Composition 8. Possible animal, rhythm, large colour-area, shape or modernist connections. |
| `neighbour-black-square` | Anchor Black Square; candidates Mondrian, the Korean scholar screen, Cézanne's mountain and Onchi's Mother and Child. Possible geometric, compartment, planar or light/dark connections. |
| `neighbour-bharat-mata` | Anchor Bharat Mata; candidates Green Tara, La Catrina, Violette Heymann and Gentileschi's Judith. Possible figure, object, symbol, colour or compositional relationships. |
| `chronology-ancient-wave-scream` | Roman Egyptian Young Girl, Mona Lisa, Great Wave and The Scream. |
| `chronology-spring-bosch-pearl-gothic` | Guo Xi's Early Spring, Garden of Earthly Delights, Girl with a Pearl Earring and American Gothic. |
| `chronology-mona-judith-starry-mondrian` | Mona Lisa, Gentileschi's Judith, Starry Night and Mondrian. |
| `subject-waves` | Hokusai's Great Wave and Hōchū's Waves. The fan painting and woodblock print share waves while boats, people, mountain and format differ. |
| `subject-adults-children` | Cassatt's Child's Bath and In the Omnibus. Adult/child scenes with different people, activities, compositions and media. |
| `subject-object-still-lifes` | Van der Hamen's Still Life with Sweets and Blanchard's Still Life. Different objects and spatial treatments within still life. |

The keep/leave works are all current editorial landmarks. That does not mean every participant recognises them. All36 keep/leave works are distinct across the six groups. The second and third groups draw from later landmark reserves; the other groups offer more alternatives to opening icons. These relative selections must not silently become six ordinary independent preference ratings.

Neighbour and chronology can expose a later preference reserve, as existing familiarity tasks already can. Where practical their candidates use first-block works. Four same-subject alternatives are entirely inside the first64 allocation: mountains, portraits, waves and adults/children. The flower pair includes Monet's later reserve, and the object still-life pair includes Van der Hamen's later reserve, so both are withheld from first-block preference use. With curation notes supplied, the selector enforces the actual cumulative first64, next18 and final17 pools for same-subject choices. Without explicit pools it preserves both sets' baseline release after batch0.

## Reviewed subject matches

Every same-subject object has `subject.reviewed:true`, `matchLevel:'subject-family'` and `samePersonOrPlace:false`. These are editorial checks of the pictured subject, not measured user attributes.

- The mountain pair shows Sainte-Victoire and Mount Fuji. Cézanne's [museum record](https://www.clevelandart.org/art/1958.21) identifies the mountain landscape and oil on fabric. Hokusai's [museum record](https://www.clevelandart.org/art/1930.189) identifies Mount Fuji and a colour woodblock print. Location, artist, era, palette, medium, scale and familiarity remain alternatives.
- The portrait pair shows Mona Lisa and Violette Heymann. The [Louvre record](https://collections.louvre.fr/ark:/53355/cl010062370) identifies Lisa Gherardini. The [CMA record](https://www.clevelandart.org/art/1926.1976) identifies Redon's commissioned portrait and pastel on paper. Sitters, pose, surrounding imagery, material, date and fame differ. The bank does not call Vermeer's Girl with a Pearl Earring a portrait; the [Mauritshuis identifies it as a tronie](https://www.mauritshuis.nl/en/our-collection/artworks/670-girl-with-a-pearl-earring).
- The flower pair shows different arrangements. The [National Gallery record](https://www.nationalgallery.org.uk/paintings/vincent-van-gogh-sunflowers) dates its Sunflowers to 1888. The [CMA record](https://www.clevelandart.org/art/1953.155) identifies Monet's 1864 flower still life. A chosen treatment can still reflect flower species, arrangement, lighting, palette or prior exposure.
- The wave pair uses the [Met's Great Wave](https://www.metmuseum.org/art/collection/search/45434) and [Hōchū's Waves](https://www.clevelandart.org/art/1999.90). The latter is a fan painting later mounted as a hanging scroll, with ink, colour and gold on paper. Hokusai's image adds boats, people and distant Fuji. Their common subject does not control narrative, visible humans or original function.
- The adult/child pair uses [Child's Bath](https://www.artic.edu/artworks/111442/the-child-s-bath) and [In the Omnibus](https://www.clevelandart.org/art/1941.71), both Cassatt. The Omnibus museum record identifies a mother, nursemaid and child, so the label deliberately says adults with children. It does not identify every adult as a mother. Painting versus colour drypoint/aquatint, bathing versus travel and one versus two adults remain substantial differences.
- The object still-life pair uses [Van der Hamen](https://www.clevelandart.org/art/1980.6) and [Blanchard](https://clevelandart.org/art/2026.37), preserving the existing object-level catalogue provenance. The shared still-life family does not imply identical food, vessels or arrangement.

Several reviewed sets can support a tentative treatment-pattern comparison if their actual answers and known descriptors agree. A single pair cannot explain WHY. Keep each pair's subject and remaining alternatives visible; do not turn the shared subject label into a claim that the works were otherwise controlled.

The unchanged .25 descriptor threshold is now reachable on the actual collection. Cézanne/Fuji complexity is .65/.35 and Cassatt Bath/Omnibus is .80/.50. Those are two first64-eligible reviewed sets with four distinct works and a .30 gap in each. The portrait and object-still-life pairs also offer abstraction gaps of .50 and .70. These values remain provisional manual annotations; they are not participant density ratings. Agreement must come from actual choices before the reader can describe a recurrence, and contrary choices must remain visible. No annotation or reader threshold was changed to create these opportunities.

## Rotating arrangement content

[arrangement-stimuli.mjs](../public/art-atlas/arrangement-stimuli.mjs) exports `selectArrangementStimuli({works,batchIndex,kind})`, `ARRANGEMENT_STIMULI_BANK` and its revision. `kind` accepts `sorting`, `difficult-edit`, or the alias `edit`.

Ready results contain `workIds`, `contentId`, `kind`, `rotationIndex`, `preferredRotationIndex`, `sourceUrls`, `curationNotes`, `fallback` and `fallbackReason`. There are four eight-work sorting cohorts and four four-work edit cohorts. The sorting cohorts contain32 distinct works in total, each with4–6 editorial landmarks and several source contexts. The edit cohorts each contain at least two landmarks.

| Rotation | Sorting cohort | Edit cohort |
| --- | --- | --- |
| 0 | Guo Xi, Bharat Mata, Calligraphy and Painting Party, Blue Horse, Mondrian, Redon, Figari, Ōi | Cézanne, Velasco, Red Fuji, Guo Xi |
| 1 | Girl with a Pearl Earring, Fan Kuan, The Scream, Liberty, Tanner's Banjo Lesson, Hiroshige, Herrán, Saudade | Mona Lisa, Girl with a Pearl Earring, Redon, Roman Egyptian Man |
| 2 | Venus, American Gothic, Black Square, Great Wave, Velasco, Korean scholar screen, Green Tara, Blanchard | Sunflowers, Mondrian, Blanchard, Korean scholar screen |
| 3 | The Kiss, Night Watch, Judith, Rouen Cathedral, Child's Bath, Yin Hong birds, Korean bamboo, Ethiopian apostles | Dance, Bellows, Herrán, Chitarman court |

The first sorting definition must be saved at slot8 and reused unchanged at its own slot46. The selector does not replace a shown return with the next rotation. A later block selects a different cohort through its batch index. Four rotations repeat cyclically after that finite bank is exhausted.

If a preferred cohort is incomplete, the selector chooses another complete reviewed cohort with `fallback:true` and explicit reasons. It never fills individual gaps with arbitrary works. If no complete cohort is available, it returns `status:'unavailable'` and an empty work list. Fallback can reuse another block's cohort, so it must not be described as new content. Save the definition before answers and retain source qualifications, including attributed-to Aniko and workshop/circle of Wäldä Maryam.

These are contextual grouping/edit stimuli. They do not add ordinary preference ratings or establish that every offered image was viewed. Rotations reduce one source of repetition while preserving the intended within-block sorting comparison.

## Independent grid and matching variety

`JOURNEY_VARIETY_POLICY`, currently `specific-question-variety-v1`, changes selection only for new independent image grids and artist/style games. It preserves the main18 panel memberships, ordinary64/18/17 reserves, saved question definitions, protected adaptive comparisons and the50-slot schedule.

`JOURNEY_REVISION` is now `art-profile-50-v7`, retaining `JOURNEY_PROTOCOL='art-profile-50-v1'`. This is a revision refresh, not a new response protocol. The existing refresh path retains shown/answered definitions and saved adaptive evidence while replacing eligible unshown questions. The source-binding compatibility list explicitly includes v6 so its original panels and paired follow-ups remain valid after that refresh.

The first familiarity set now includes Friedrich's Wanderer instead of Sunflowers. It retains12 landmark works, and its later keep-selection grid uses exactly those identities. Sorting cohortA uses Calligraphy and Painting Party instead of Catrina, preserving its collaborative authorship and Japanese source context. The other sorting cohorts remain disjoint.

For new grid/match selection, cumulative planned-use counts include preceding specific questions, separate anchors, sorting sets and edit sets. A museum tray offering99 and a text-only statement add no such count. The count is planned usage, not looking time, recognition or actual image viewing. Each previous planned appearance subtracts six heuristic score units within the existing fame/diversity selection rules.

Before applying that score, selection prefers eligible works outside the known immediate neighbours. When a familiarity set will have a later paired keep grid, it considers the known neighbours of both appearances. Main panels are already bound, so familiarityB can avoid the upcoming preference panel and the main panel after its later keep grid. Unselected future contrast content is not guessed in advance.

If a small catalogue cannot supply enough distinct unavoided works, `evidence.varietySelection` reports the selected avoided IDs and a fallback reason. Cached familiarity/keep identities and already bound questions retain priority over a new spacing preference. Existing conservative delay checks for intentional exact returns remain in place.

The final same-seed first50 QA run has227 specific-image appearances across83 unique works, compared with227/80 before this policy and227/79 before the arrangement rotations. Peak appearances fall from seven to six. Deliberate pair linkage adds one collateral adjacent return, Mondrian at026→027: the fixed reviewed KeepA set supplies six opening pair baselines and also contains Mondrian. There is no claim of zero repetition. Counts exclude the museum offered collection and are planning metrics, not observed user behaviour or a guarantee for every seed. The earlier zero-adjacency audit preceded the linkage refinement; current evidence is in ignored `qa-output/contrast-linkage-audit-v7.json`.

## Deliberate earlier pair links

For keep/leave, neighbour and same-subject selection, a valid completed earlier ordinary pair comes first, a planned ordinary opportunity comes second, and the existing spacing costs follow. Within either tier, more covered candidate pairs take priority. Source positions are used only to validate the response, never to choose a set that will manufacture a reversal. Selection records exact source round IDs and whether they were completed or planned. The reading separately checks the latest real eligible pair response and retains its actual direction and gap.

The reviewed first64 now gives these first-block opportunities:

| Later task | Earlier ordinary source | Scope |
| --- | --- | --- |
| Neighbour019 |005, Fuji and Hōchū's Waves | One pair among four candidates; choosing another candidate may leave no preference comparison. |
| Keep/leave027 |001, the four opening icons | Six possible pairs among those four; the other two candidates lack that opening source. |
| Same subject042 |007, Cassatt's Bath and Omnibus | The exact reviewed subject pair. |

An ordinary source set may intentionally return under a different instruction. Its `exposureAudit` calls this a cross-source revisit, while an already used contrast content ID or same-format set is still excluded. A planned source is not a completed answer or evidence of looking. Invalid, skipped, contextual and partial source answers do not acquire completed or planned pair status. An unused set without an eligible source has `baselineFallback:true` and remains a standalone categorical observation.

`selectSubjectBaselinePair` uses the existing ordinary bridge at049,099 and149 to prepare a later unused reviewed subject pair. Both works must already belong to preceding ordinary questions in the released rating pool; categorical choices never supply ranks. The ordinary bridge retains its unconditioned preference prompt and introduces no subject brief. In the three-block release fixture,049 prepares Cézanne/Fuji for092, and099 prepares Mona Lisa/Violette Heymann for142. Captured bridge definitions are never rewritten. Until the ordinary bridge has an actual valid answer, this is only a proposed comparison opportunity. Skipped responses, preserved old schedules and exhausted reviewed sets can prevent a later link.

The exact release fixture retains64/18/17 first ordinary ratings. It gives earlier real pair sources for019/027/042/092/142 when those source responses are completed. The third-block neighbour119 still lacks a pair source and explicitly falls back to standalone data. No selection guarantees a reversal, a sufficient15-point gap, or a profile statement. The150 plan/build benchmark took about1.12seconds in one local Node run; that is a CPU/wall-time sample, not a browser latency guarantee.

Appraisal034 now returns to the already preferred panel8. Its interpretive-openness scale stays unchanged, and panel8 has no separate scene/meaning map. This avoids the former unlabelled same-construct return to panel12 at034 and040. Previously captured034 definitions remain exact.

## Chronology source register

The module stores the following exact intervals and checks them against `work.analysis.yearRange`. It never extracts numeric years from titles, text dates or movement names. Current catalogue intervals must match the reviewed version, and adjacent intervals must be strictly disjoint. An interval change, missing range or overlap requires another reviewed set or an unavailable result.

| Work | Stored interval | Source date and primary evidence |
| --- | --- | --- |
| Guo Xi, Early Spring | 1072–1072 | The [National Palace Museum record](https://digitalarchive.npm.gov.tw/Collection/Detail?dep=P&id=47) gives 1072 and reproduces the dated inscription. |
| Mona Lisa | 1503–1519 | The [Louvre record](https://collections.louvre.fr/ark:/53355/cl010062370) gives 1503 / 1519. |
| Milkmaid | 1660–1660 | The [Rijksmuseum](https://www.rijksmuseum.nl/en/story/milkmaid-vermeer) gives c. 1660. This point value retains an approximate-year warning. |
| The Scream | 1893–1893 | The [Nasjonalmuseet object record](https://www.nasjonalmuseet.no/en/collection/object/NG.M.00939) gives 1893 for this version. |
| Girl with a Pearl Earring | 1665–1665 | The [Mauritshuis record](https://www.mauritshuis.nl/en/our-collection/artworks/670-girl-with-a-pearl-earring) gives c. 1665. This remains approximate. |
| Great Wave | 1830–1832 | The [Met record](https://www.metmuseum.org/art/collection/search/45434) gives ca. 1830–32 for the selected impression. |
| Starry Night | 1889–1889 | [MoMA](https://www.moma.org/collection/works/79802) gives Saint Rémy, June 1889. |
| Mondrian, Composition with Red, Yellow, and Blue | 1927–1927 | The [CMA record](https://www.clevelandart.org/art/1967.215) gives 1927. |
| Funerary Portrait of a Young Girl | 25–37 | The [CMA record](https://www.clevelandart.org/art/1971.137) gives c. 25–37 CE. |
| Garden of Earthly Delights | 1490–1500 | The [Prado object record](https://www.museodelprado.es/en/the-collection/art-work/the-garden-of-earthly-delights-triptych/02388242-6d6a-4e9e-a992-e1311eab3609) and official collection search give 1490–1500. This is an attributed date range, not a certain production span. |
| Gentileschi, Judith Beheading Holofernes | 1620–1620 | The [Uffizi record](https://www.uffizi.it/en/artworks/judith-beheading-holofernes) gives 1620 c. |
| American Gothic | 1930–1930 | AIC's [American Art collection publication](https://www.artic.edu/assets/f85bee6b-d18b-5577-a9e6-f429421b4654) lists American Gothic, 1930, accession 1930.934. This primary publication supplies the date evidence because the object page was blocked during this check. |

The displayed order is seeded and deliberately differs from the canonical chronological order. Save `dateEvidence` and `canonicalOrder` with the definition; keep dates and answer order out of the initial participant view through `hideDatesUntilFeedback:true`. Reveal source dates and uncertainty after Check. The date evidence has source links, display dates, an `approximate` flag and an uncertainty note for every object.

Stored catalogue ranges are not statistical confidence intervals. In particular c. 1660 represented as 1660–1660 does not make the date exact. These tasks use widely separated examples whose reviewed intervals do not overlap. Unknown/open-ended dates, such as Shen Zhou's after1490, are absent. Tara's recent mounting date is not used as its making date.

## Less repetition without false freshness

Selection is deterministic for the same seed, catalogue and chronological history. Catalogue input order does not affect it. The returned display order is seeded separately. Preferred batch labels are soft tie-breakers after exposure costs, except the actual same-subject preference-release gate.

Already booked contrast content IDs and same-format sets are excluded, including a reordered copy. An exact ordinary source pair can deliberately return under a different instruction when it supplies an eligible source link. Planned definitions prevent duplicate bookings but establish no actual viewing. After completed/planned pair-link eligibility, the selector favours:

1. Fewer works in specific planned questions within the last six supplied round positions, then an older last planned question.
2. Less recent recorded actual presentation, then fewer recorded presentations.
3. Fewer total specific planned question appearances.
4. Fewer possible recent presentations with unknown visibility.
5. The intended block and then a seeded tie-break.

An explicit `round.presentedIds` event is preferred. Museum/exercise `answer.record.presentedIds` counts only those recorded works. A confirmed non-exercise answer with the exact work snapshot also establishes a presentation. A definition without such evidence contributes unknown exposure, including an untracked 99-work museum tray. Offering all99 does not prove that all99 were viewed and does not make the content bank impossible to use.

Specific non-exercise question definitions also update a separate planned-spacing record, including their anchor images. `plannedQuestionLastIndex`, `plannedQuestionPresentationCounts` and `recentPlannedQuestionOverlap` describe the intended sequence, even before any answer exists. They do not establish actual viewing. An exercise's offered99 museum tray never resets these planned image positions. This prevents an untracked museum from masking that the opening icons were scheduled one turn ago.

The audit returns planned spacing, known presentations, unknown exposure, no recorded presentation, known presentation counts and last known indices separately. `unseenClaim` is always false because outside exposure is unmeasured. Previously confirmed ordinary preference spectra are counted separately from exposure; contextual, unconfirmed, interest, chronology and relationship responses do not become ordinary preference ratings.

Pass preceding history rather than a future complete journey if you want recency to concern actual past turns. Future definitions can protect a booked set, but their presentation is unknown until an event or answer exists. This is a bounded editorial heuristic. It does not claim optimal information gain or measured public familiarity.

## Verification

Run `node --test tests/art-atlas/contrast-content.test.mjs tests/art-atlas/contrast-linkage.test.mjs tests/art-atlas/arrangement-stimuli.test.mjs tests/art-atlas/stimulus-variety.test.mjs tests/art-atlas/journey.test.mjs`.

The tests cover all24 real contrast sets, stable original IDs,36 different landmark keep/leave works, format contracts, deterministic display order, no mutation, exact-set avoidance, six-use exhaustion, exposure/planning distinctions, all twelve reused date records, preference reserves, and the existing .25 descriptor opportunity. Arrangement tests cover four rotations,32 different sorting works, saved-set reuse, exact reviewed-cohort fallback, missing sources and no mutation. No test requires invented feature values.

The variety and linkage tests check exact main-panel membership, fixed special-task positions, the two source-set substitutions, paired-grid identity, cumulative counts including specific scenes, museum exclusion, small-catalogue fallback, completed-versus-planned pair priority, malformed sources, the exact150 release fixture, frozen034/049/099 definitions and protected adaptive bindings.
