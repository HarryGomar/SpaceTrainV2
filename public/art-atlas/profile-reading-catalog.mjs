// Evidence-led reading families, not personality types.
// All artwork examples are illustrative and never findings about the visitor.
export const PROFILE_READING_CATALOG_VERSION=3;
export const PROFILE_READING_CATALOG_SCOPE=Object.freeze({
  "subject": "Patterns in art choices and arrangements",
  "exampleMode": "illustrative",
  "statusMeaning": {
    "implemented": "The mapped analysis can produce this reading when its evidence requirements are met. Availability distinguishes current instruments from retained older records.",
    "planned": "The reading is proposed. Its inputs may already exist, but no mapped analysis currently generates it."
  },
  "limits": [
    "These are reading families, not personality types. A person can have several, none, or an unresolved result.",
    "All examples are illustrative. Actual readings require validated answers, exact work identities and traceable evidence.",
    "The available paintings, their order, prior exposure and the question can affect a choice. Repeated works remain dependent evidence.",
    "A pattern can suggest a further comparison. It does not establish a trait, a causal motive, population rarity or a calibrated probability."
  ],
  "availabilityMeaning": {
    "current": "Supported by current study instruments.",
    "legacy": "Supported for retained earlier instruments; saved coordinates keep their original meaning.",
    "planned": "A proposed reading, not a generated result."
  },
  "sourcePathMeaning": {
    "rootArray": "$ denotes the array returned directly by buildRefinedReadings or buildContrastReadings. Other paths name fields on a result object."
  }
});

export const PROFILE_READING_LENSES=Object.freeze([
  {
    "id": "visual-patterns",
    "title": "Visual patterns",
    "description": "What recurs across different art choices.",
    "readingIds": [
      "human-figures",
      "representation",
      "colour-intensity",
      "density-and-activity",
      "depicted-action",
      "setting-and-atmosphere",
      "shared-subjects"
    ]
  },
  {
    "id": "different-reactions",
    "title": "Preference & feeling",
    "description": "Personal appeal, admiration and the wish to return.",
    "readingIds": [
      "admiration-and-appeal",
      "tension-and-return",
      "curiosity-without-preference",
      "attention-without-preference",
      "tension-and-preference",
      "connection-without-understanding"
    ]
  },
  {
    "id": "meaning-and-context",
    "title": "Symbols & meaning",
    "description": "Scenes, interpretations and the response to context.",
    "readingIds": [
      "story-rating-change",
      "scene-and-interpretation",
      "claim-and-story-comparison",
      "meaning-without-preference",
      "openness-and-preference"
    ]
  },
  {
    "id": "revisiting-choices",
    "title": "Choices & returns",
    "description": "What holds, what changes and what a new comparison tests.",
    "readingIds": [
      "exact-preference-repeat",
      "selection-changes",
      "prospective-feature-check",
      "purpose-changes-choice",
      "comparison-company"
    ]
  },
  {
    "id": "curating-and-grouping",
    "title": "Groups & contrasts",
    "description": "Connections made through arrangement, neighbours and omission.",
    "readingIds": [
      "chosen-groups",
      "pairing-choices",
      "grouping-descriptors",
      "grouping-recurrence",
      "table-and-room-difference",
      "works-left-out"
    ]
  },
  {
    "id": "finding-more",
    "title": "Discovering more",
    "description": "Familiarity, new comparisons and connected collections.",
    "readingIds": [
      "familiarity-and-shortlist",
      "artist-and-tradition-routes",
      "unrated-painting-route",
      "museum-collection-route",
      "recognition-and-preference"
    ]
  }
]);

const portrait=(resultPath,match={})=>({module:'taste-portrait',file:'dist/taste-portrait.mjs',export:'buildTastePortrait',resultPath,match});
const connections=(resultPath,match={})=>({module:'taste-connections',file:'dist/taste-connections.mjs',export:'buildTasteConnections',resultPath,match});
const refined=match=>({module:'reading-patterns-v2',file:'dist/reading-patterns-v2.mjs',export:'buildRefinedReadings',resultPath:'$',resultType:'array',match});
const contrast=match=>({module:'contrast-readings',file:'dist/contrast-readings.mjs',export:'buildContrastReadings',resultPath:'$',resultType:'array',match});
const example=(text,workIds)=>({text,workIds,illustrative:true});

export const PROFILE_READING_CATALOG=Object.freeze([
  {
    id:"human-figures",lensId:"visual-patterns",title:"Human presence",status:"implemented",availability:"current",
    description:"Whether work centred on people recurs in preference comparisons, and where other subjects win instead.",
    example:example("Mona Lisa and Girl with a Pearl Earring led separate comparisons with Black Square and The Great Wave. A later choice of The Great Wave over Mona Lisa challenged a simple rule about figures.",["study-leonardo-mona-lisa","study-vermeer-pearl","study-malevich-black-square","study-hokusai-great-wave"]),
    requiredSignals:["At least two completed preference groups using four different paintings.","Reviewed descriptions of human presence with clear differences between the compared works.","Supporting and opposing choices, with repeated sets counted separately."],
    sources:[portrait("observations",{"id":"taste-pattern-humanity","feature":"humanity"})],
    implementationNote:"Humanity describes the prominence of human presence. It is not a count of people and does not include animals merely because they are figurative subjects.",
    limits:["Human figures, narrative, emotion and style can vary together. The comparisons do not isolate which feature caused a choice."]
  },
  {
    id:"representation",lensId:"visual-patterns",title:"Representation & abstraction",status:"implemented",availability:"current",
    description:"A recurring preference direction across more representational or more abstract paintings, with exceptions retained.",
    example:example("The Birth of Venus came ahead of Black Square, and Girl with a Pearl Earring ahead of Composition 8. Those separate comparisons share a direction towards representation.",["study-botticelli-birth-venus","study-malevich-black-square","study-vermeer-pearl","study-kandinsky-composition-eight"]),
    requiredSignals:["Validated unconditional preference spectra with clear pair gaps.","Known abstraction annotations with contrasts of at least 0.3.","At least two distinct supporting sets using at least four different paintings."],
    sources:[portrait("observations",{"id":"taste-pattern-abstraction","feature":"abstraction"})],
    implementationNote:"The feature analyzer returns its leading qualifying association. Either direction is possible; other aligned descriptors and opposing choices remain visible.",
    limits:["This describes image annotations accompanying choices. Subject, colour and other differences are not held constant."]
  },
  {
    id:"colour-intensity",lensId:"visual-patterns",title:"Colour intensity",status:"implemented",availability:"current",
    description:"A recurring direction towards more intense or more restrained colour in separate preference sets.",
    example:example("The Kiss came ahead of Mona Lisa, and The Starry Night ahead of La Catrina. More intense annotated colour accompanies both choices; it is not the only difference.",["klimt-kiss","study-leonardo-mona-lisa","van-gogh-starry-night","study-posada-catrina"]),
    requiredSignals:["Validated unconditional preference spectra.","Known features.color values and clear contrasts.","The same recurring-set and four-work requirements used for other visual associations."],
    sources:[portrait("observations",{"id":"taste-pattern-color","feature":"color"})],
    implementationNote:"The current feature is colour intensity. This does not identify a favourite hue, palette or colour harmony.",
    limits:["Digital reproductions and coarse editorial descriptors limit the colour comparison. A hue-specific profile needs a different analysis."]
  },
  {
    id:"density-and-activity",lensId:"visual-patterns",title:"Detail & composition",status:"implemented",availability:"current",
    description:"Whether denser compositions or greater visual activity accompany repeated choices, with the two descriptions kept separate.",
    example:example("The Garden of Earthly Delights came ahead of Girl with a Pearl Earring, and The Night Watch ahead of Black Square. Denser compositions connect these choices; other comparisons can challenge that description.",["bosch-garden-delights","study-vermeer-pearl","study-rembrandt-night-watch","study-malevich-black-square"]),
    requiredSignals:["Distinct validated preference sets with clear pair orders.","Known features.complexity or features.energy values.","At least two supporting sets and four different works for the selected feature."],
    sources:[portrait("observations",{"idIn":["taste-pattern-complexity","taste-pattern-energy"]})],
    implementationNote:"Complexity and energy are tested separately. Only a qualifying leading feature is returned; they are not combined into a single score.",
    limits:["Visual density, depicted action and felt tension are different measurements. They can vary together without explaining one another."]
  },
  {
    id:"depicted-action",lensId:"visual-patterns",title:"Action & stillness",status:"implemented",availability:"current",
    description:"Whether scenes with more depicted action recur among your choices.",
    example:example("The Night Watch led a comparison with Girl with a Pearl Earring; The School of Athens led another with Black Square. Depicted action is one possible connection, alongside other differences.",["study-rembrandt-night-watch","study-vermeer-pearl","study-raphael-school-athens","study-malevich-black-square"]),
    requiredSignals:["Several preference comparisons using different paintings.","Known descriptions of depicted action.","At least two supporting groups and four different works, with exceptions retained."],
    sources:[portrait("observations",{"id":"taste-pattern-narrative","feature":"narrative"})],
    implementationNote:"The narrative annotation is depicted action, not symbolism, a viewer’s life story or general narrative preference.",
    limits:["A dramatic subject and a busy composition can overlap. One comparison cannot distinguish them."]
  },
  {
    id:"setting-and-atmosphere",lensId:"visual-patterns",title:"Setting & atmosphere",status:"implemented",availability:"current",
    description:"Whether work with a stronger emphasis on its setting recurs in your choices.",
    example:example("The Starry Night led a comparison with Black Square, and Early Spring led another with Composition 8. A stronger emphasis on setting connects those choices, despite their different colours and methods.",["van-gogh-starry-night","study-malevich-black-square","study-guo-xi-early-spring","study-kandinsky-composition-eight"]),
    requiredSignals:["At least two completed preference groups using four different paintings.","Reviewed descriptions of emphasis on setting, with clear contrasts.","Supporting choices and the comparisons that go against that direction."],
    sources:[portrait("observations",{"id":"taste-pattern-atmosphere","feature":"atmosphere"})],
    implementationNote:"This annotation describes emphasis on setting in the reproduction. It does not measure how atmospheric the viewer feels.",
    limits:["Atmosphere is an editorial image description. It is not a measured emotional response."]
  },
  {
    id:"shared-subjects",lensId:"visual-patterns",title:"Shared subjects",status:"implemented",availability:"current",
    description:"How a subject-matched choice relates to an earlier preference, and whether treatment differences recur across reviewed sets.",
    example:example("Red Fuji came ahead of Mount Sainte-Victoire in an earlier preference comparison. Mount Sainte-Victoire was then chosen in the two-mountain question. The order changed, while the question, company and timing also changed.",["hokusai-mount-fuji","cezanne-mountain"]),
    requiredSignals:["Local reversal route: a completed reviewed same-subject choice and the latest eligible earlier unconditional preference response containing the exact chosen/alternative pair. The earlier clear gap must be at least 15 points in the opposite direction.","Recurring treatment route: at least two distinct reviewed sets with two different chosen works and four different paintings. Each supporting set needs a known chosen-versus-alternatives mean gap of at least 0.25 on density, colour intensity, abstraction or visual activity.","The recurring route needs fewer opposing sets than supporting sets. Repeated sets count once per direction; unknown descriptions supply no recurring-feature support.","Both routes retain exact source IDs, offered sets, the reviewed subject and remaining differences. No-clear-preference, skipped or invalid responses supply no direction."],
    sources:[contrast({"idIn":["contrast-subject-reversal","contrast-subject"],"module":"subject-and-treatment"}),portrait("observations",{"idIn":["contrast-subject-reversal","contrast-subject"],"module":"subject-and-treatment"})],
    implementationNote:"buildContrastReadings emits contrast-subject-reversal for a local cross-source reversal, and contrast-subject only after the recurring descriptor gates pass. The earlier full preference set can differ from the later subject set. Exact questions, sources, aligned counterexamples and residual confounds stay attached. A choice without an earlier source cannot create a reversal reading.",
    limits:["A broad shared subject can still mean different mountains, sitters, flowers or arrangements. It is not an experiment on the same object.","A reversal cannot be assigned to subject framing. The question, company, repeated viewing and timing change together.","Treatment descriptions are provisional editorial annotations. Artist, period, material, familiarity and reproduction remain alternative explanations. A recurring reading needs genuine repeated contrasts, not simply more subject choices.","A preferred treatment does not give the unchosen alternatives numeric ratings or a complete order."]
  },
  {
    id:"admiration-and-appeal",lensId:"different-reactions",title:"Admiration",status:"implemented",availability:"current",
    description:"Where personal appeal separates from admiration for how a work was made.",
    example:example("The Night Watch received more admiration for its making; Black Square was more for this viewer. A second pair can test whether the same split recurs.",["study-rembrandt-night-watch","study-malevich-black-square"]),
    requiredSignals:["A completed achievement map with personal appeal and admiration recorded separately.","Either a map appeal gap of at least 15 points opposite an admiration gap of at least 20, or an earlier exact-set unconditional preference gap of at least 15 opposite that admiration gap.","The earlier preference must precede the map when used. Exact artwork identities, endpoint definitions and opposing comparisons are retained."],
    sources:[refined({"id":"refined-achievement","module":"making-and-taste"}),portrait("observations",{"id":"refined-achievement"})],
    implementationNote:"buildRefinedReadings returns refined-achievement in its root array; buildTastePortrait also includes it in observations. A qualifying earlier preference/admiration reversal takes priority over the map-only route. Grid appeal is not added as an ordinary preference answer. Repeated work sets count once.",
    limits:["Admiration is the viewer's judgment, not objective skill, effort or artistic value.","A single set supports a local comparison. Distinct sets and counterexamples are needed before describing recurrence.","Subject, method, reproduction and personal associations can all contribute to the split."]
  },
  {
    id:"tension-and-return",lensId:"different-reactions",title:"Wanting to return",status:"implemented",availability:"current",
    description:"A wish to return can favour an unsettling work, including one that was not the stronger ordinary preference.",
    example:example("Mona Lisa was preferred overall, but The Scream received the stronger wish to return despite being placed as more unsettling.",["study-leonardo-mona-lisa","study-munch-scream"]),
    requiredSignals:["A completed returnResponse map with felt tension and wish to return.","A stronger wish to return to a work placed as clearly more unsettling.","A separate exact-set preference answer if the reading also compares return intention with preference."],
    sources:[refined({"id":"refined-return","module":"tension-and-return"}),portrait("observations",{"id":"refined-return"})],
    implementationNote:"buildRefinedReadings returns refined-return. It requires the new returnResponse axis and tension-and-return construct. A preference difference is added only when an actual matched ordinary preference exists.",
    limits:["Wish to return is an intention reported here; no later visit or viewing behaviour has been observed.","Comforting/unsettling is this instrument's felt-tension coordinate. Old pleasantness, activation or attention coordinates are not interchangeable.","This does not establish a general preference for discomfort. Counterexamples and reused-set dependencies remain part of the reading."]
  },
  {
    id:"curiosity-without-preference",lensId:"different-reactions",title:"Curiosity",status:"implemented",availability:"legacy",
    description:"A less preferred painting receives a stronger wish to investigate than a preferred one.",
    example:example("Girl with a Pearl Earring came first in preference; La Catrina received the stronger curiosity response. The two answers describe different reactions to the same pair.",["study-vermeer-pearl","study-posada-catrina"]),
    requiredSignals:["A validated discovery preference spectrum.","A validated curiosity spectrum for the exact same work set.","A preference gap of at least 15 and a curiosity gap of at least 15 in the opposite direction."],
    sources:[portrait("observations",{"id":"taste-curiosity"}),connections("crossTaskPatterns",{"kind":"preference-curiosity-contrast"}),connections("responseMaps",{"kind":"preference-curiosity"})],
    implementationNote:"This reading uses the earlier curiosity spectrum, retained for saved records. It is not derived from the current shortlist or wish-to-return map.",
    limits:["A wish to investigate is not a hidden preference, an expertise score or a reason inferred from preference."]
  },
  {
    id:"attention-without-preference",lensId:"different-reactions",title:"Attention",status:"planned",availability:"planned",
    description:"A painting can hold more attention while another is preferred.",
    example:example("Dance came first in preference, while The Garden of Earthly Delights received the higher reported-attention placement.",["study-matisse-dance","bosch-garden-delights"]),
    requiredSignals:["Unconditional preference positions.","A response grid for the exact same work set, using its recorded attention coordinate.","Clear gaps in opposing directions and evidence from both actual questions."],
    sources:[],
    implementationNote:"The earlier response map records reported attention. A dedicated link between that coordinate and preference is not generated by the current portrait modules.",
    limits:["Reported attention is not viewing time or eye tracking. A surprising subject can hold attention for several reasons."]
  },
  {
    id:"tension-and-preference",lensId:"different-reactions",title:"Unsettling favourites",status:"planned",availability:"planned",
    description:"Preference can coexist with more reported tension, rather than always following ease.",
    example:example("The Scream came ahead of The Kiss in preference while also being placed as more tense on the earlier response map.",["study-munch-scream","klimt-kiss"]),
    requiredSignals:["Preference positions for a work pair.","The tension coordinate of a valid response map for that same set.","A clear preference for the work reported as more tense."],
    sources:[],
    implementationNote:"This proposed family concerns the earlier response-map tension coordinate and ordinary preference. It is distinct from the implemented tension-and-return instrument.",
    limits:["Tension is not unpleasantness. This does not establish that someone seeks discomfort or has a general emotional trait."]
  },
  {
    id:"connection-without-understanding",lensId:"different-reactions",title:"Personal connection",status:"planned",availability:"planned",
    description:"Reported connection and reported understanding can differ for the same work.",
    example:example("The Banjo Lesson felt more personal than American Gothic, although it was placed as harder to understand.",["study-tanner-banjo-lesson","study-wood-american-gothic"]),
    requiredSignals:["A valid understanding/connection grid.","Exact recorded axis definitions and work identities.","Preference for those works if the reading also makes a claim about preference."],
    sources:[],
    implementationNote:"Connection-grid answers are collected. Neither of the two mapped portrait modules currently emits this reading.",
    limits:["Personal connection and ease of understanding are self-reports. Neither tests correct interpretation or reveals a personal history."]
  },
  {
    id:"scene-and-interpretation",lensId:"meaning-and-context",title:"Scene & interpretation",status:"implemented",availability:"current",
    description:"How preference relates to a clear scene and to the meanings it leaves open.",
    example:example("Las Meninas was preferred to Girl with a Pearl Earring. Both scenes were marked clear, while Las Meninas was given more possible readings.",["velazquez-las-meninas","study-vermeer-pearl"]),
    requiredSignals:["A completed reading map with scene clarity and interpretive openness.","A separate completed preference comparison for exactly the same artwork set.","Clear coordinate contrasts that distinguish openness within clear scenes, openness with less clarity, or clarity with fewer readings."],
    sources:[refined({"id":"refined-reading","module":"scene-and-meaning"}),portrait("observations",{"id":"refined-reading"})],
    implementationNote:"The reading-patterns-v2 root array returns refined-reading with an explicit patternVariant. This uses axis reading and construct scene-and-meaning; older meaning, connection and one-dimensional openness answers are not recoded.",
    limits:["Scene clarity and possible meanings are personal reports, not tests of correct interpretation.","The relationship does not establish that symbolism caused a preference or measure intelligence or tolerance for ambiguity.","Repeated maps of the same works do not add distinct-set support; preference and appraisal order can affect the comparison."]
  },
  {
    id:"story-rating-change",lensId:"meaning-and-context",title:"Symbolism & appeal",status:"implemented",availability:"current",
    description:"How appeal changes after a sourced note about the symbols in a painting.",
    example:example("Hope moved from 2 to 4 out of 5 after its remaining string was explained. The Ambassadors stayed at 3 out of 5 after the note about its skull.",["add-watts-hope","holbein-ambassadors"]),
    requiredSignals:["A context round with contextMode preference-before-after-v1.","Valid before and after preference values from 0, 25, 50, 75 and 100.","The same workId, a recorded storySeen flag and exact work binding."],
    sources:[portrait("symbolism.responses",{}),portrait("observations",{"module":"symbolism"}),portrait("contextRatings",{})],
    implementationNote:"Typed symbolism questions preserve the note, its sources, the five response choices and both answers. Cross-work counts use the first completed response for each painting. Earlier generic context questions retain their own contextRatings records.",
    limits:["Reading, repeated viewing and elapsed time occur together. A 25-point input change is one response-scale step, not an effect size or a causal estimate."]
  },
  {
    id:"claim-and-story-comparison",lensId:"meaning-and-context",title:"Expectations & context",status:"implemented",availability:"current",
    description:"A broad statement about stories is placed beside a specific later before/after response.",
    example:example("The viewer agreed that stories rarely change their preferences. The Birth of Venus then moved from 3 to 4 out of 5 after a museum note. That is one local exception, not a verdict on the broader claim.",["study-botticelli-birth-venus"]),
    requiredSignals:["The exact contextEffect statement answered before the note.","Reciprocal claimRoundId/contextRoundId links and a shared checkId.","Agreement of at least 3 on the 0–4 scale and a nonzero validated before/after change."],
    sources:[portrait("observations",{"id":"symbolism-context-claim"}),portrait("observations",{"id":"taste-context-rating","variant":"linked claim with agreement >= 3 and a nonzero change"})],
    implementationNote:"This is a claim-linked variant of the same context-rating observation, not an additional independent result.",
    limits:["Rarely allows exceptions. One changed rating does not falsify the broad claim or measure honesty, consistency or self-awareness."]
  },
  {
    id:"meaning-without-preference",lensId:"meaning-and-context",title:"Meaning beyond preference",status:"implemented",availability:"legacy",
    description:"A lower preference can coincide with more suggested meaning or a greater wish to interpret.",
    example:example("The Sleeping Gypsy came first in preference, while The School of Athens suggested more meaning and prompted a greater wish to interpret it.",["study-rousseau-sleeping-gypsy","study-raphael-school-athens"]),
    requiredSignals:["A discovery preference task.","A later meaning grid for the exact same set, using axis meaning.","A clear preference pair and a reversal of at least 20 points on suggested meaning or interpretation interest."],
    sources:[portrait("observations",{"id":"taste-meaning"}),connections("crossTaskPatterns",{"kind":"preference-meaning-contrast"}),connections("responseMaps",{"kind":"preference-meaning"})],
    implementationNote:"This reading uses the earlier meaning map. It remains available for saved records and is not substituted for the new scene-clarity/interpretive-openness map.",
    limits:["Suggested meaning is not symbol recognition or interpretive correctness. The two modules retain different explicit thresholds."]
  },
  {
    id:"openness-and-preference",lensId:"meaning-and-context",title:"Open interpretation",status:"planned",availability:"planned",
    description:"Compare preference with how many possible readings a painting seems to allow.",
    example:example("Hunters in the Snow and The Birth of Venus received similar preference positions, while Hunters in the Snow was placed as leaving more possible interpretations open.",["study-bruegel-hunters-snow","study-botticelli-birth-venus"]),
    requiredSignals:["A preference spectrum.","The interpretive-openness looking appraisal for the same exact works.","Explicit handling of near ties, reported understanding and meaning-grid answers as separate signals."],
    sources:[],
    implementationNote:"This proposed family concerns the earlier one-dimensional interpretive-openness appraisal. The implemented Scene & interpretation family uses the new reading map and a separate matched preference task.",
    limits:["Multiple possible meanings, uncertainty and difficulty understanding are different. No tolerance-for-ambiguity trait follows."]
  },
  {
    id:"exact-preference-repeat",lensId:"revisiting-choices",title:"Choices on return",status:"implemented",availability:"current",
    description:"Which clear pair orders stayed, reversed, narrowed or became clear when the same question returned.",
    example:example("The Great Wave stayed above Mona Lisa when the same question returned. The gap between The Death of Marat and Hunters in the Snow narrowed to a near tie.",["study-hokusai-great-wave","study-leonardo-mona-lisa","study-david-marat","study-bruegel-hunters-snow"]),
    requiredSignals:["Two valid unconditional preference answers linked by repeatOf.","Identical work sets, title, hint and scale.","The original occurs earlier and is not itself a repeat; pair orders use the recorded 15-point clear-gap rule."],
    sources:[portrait("consistency.comparisons",{}),portrait("observations",{"id":"taste-repeat"})],
    implementationNote:"The result distinguishes retained, reversed, both-near-tied, became-near-tied and became-clear pairs. It does not report a general consistency percentage.",
    limits:["Time, familiarity, order, fatigue and memory can contribute. A within-session return does not establish long-term stability."]
  },
  {
    id:"selection-changes",lensId:"revisiting-choices",title:"Selection changes",status:"implemented",availability:"current",
    description:"A later keep/leave decision can reverse an earlier preference between the same two paintings.",
    example:example("The Starry Night came ahead of The Great Wave in an earlier preference comparison. Among six later works, The Great Wave was kept and The Starry Night left out. The other four stayed unranked.",["van-gogh-starry-night","study-hokusai-great-wave"]),
    requiredSignals:["A completed six-work keep/leave decision with two different chosen works.","An earlier complete unconditional preference response containing that exact pair, with the now-left work at least 15 points above the now-kept work.","Original source IDs, order, question and offered sets retained. Each six-work set counts once per direction; later choices that keep the earlier order remain counterevidence."],
    sources:[contrast({"id":"contrast-keep-leave","module":"taste-and-selection"}),portrait("observations",{"id":"contrast-keep-leave","module":"taste-and-selection"})],
    implementationNote:"The analyzer uses the latest eligible earlier preference source containing the actual kept/left pair. It does not require the full earlier set to equal the later six. The reading uses categorical choices alongside actual earlier values, never invented keep/leave ratings.",
    limits:["Keeping and leaving are relative decisions among six. Leaving a painting is not an absolute dislike; the other four remain unranked.","Instructions, surrounding alternatives, repeated viewing and timing change together. The reversal does not identify which change caused it.","A later choice for the same works can supply counterevidence without becoming an independent replication. The 15-point clear-gap rule is provisional."]
  },
  {
    id:"prospective-feature-check",lensId:"revisiting-choices",title:"Testing a pattern",status:"implemented",availability:"current",
    description:"A frozen feature-based prediction meets a later matched, reversed or near-tied preference.",
    example:example("Earlier choices suggested denser compositions. A new direct pair then favoured Girl with a Pearl Earring over The Night Watch, going against that provisional explanation.",["study-vermeer-pearl","study-rembrandt-night-watch"]),
    requiredSignals:["A two-work unconditional adaptive challenge, labelled probe.","A frozen provisional hypothesis, prediction, source answers and feature values.","At least three distinct earlier sets and four named artists; a verified new comparison across earlier presentation records."],
    sources:[portrait("prospectiveChecks",{}),portrait("observations",{"idPrefix":"taste-prospective-"})],
    implementationNote:"prospectiveComparisons revalidates the captured training evidence, feature direction, pair novelty and thresholds. Unknown exercise exposure suppresses the claim.",
    limits:["The paintings may already be familiar. One tested pair neither isolates a cause nor supplies an accuracy percentage or confidence level."]
  },
  {
    id:"purpose-changes-choice",lensId:"revisiting-choices",title:"Purpose & fit",status:"implemented",availability:"legacy",
    description:"An ordinary preference order reverses under an explicit curatorial brief.",
    example:example("The Night Watch led the individual preference comparison. Dance was then chosen to create a stronger contrast beside Black Square.",["study-rembrandt-night-watch","study-matisse-dance","study-malevich-black-square"]),
    requiredSignals:["An earlier discovery preference task.","A later contextual-choice spectrum or anchored spectrum with the exact same alternative set.","Clear pair gaps in opposite directions, with the changed brief retained."],
    sources:[portrait("consistency.contextualDifferences",{}),portrait("observations",{"id":"taste-context"})],
    implementationNote:"Supported for valid contextual spectra, including older study records. The current default journey does not use the removed imagined-gallery-visit questions.",
    limits:["Choosing for a purpose is a different task. A reversal is not an exact-repeat inconsistency or evidence of dislike."]
  },
  {
    id:"comparison-company",lensId:"revisiting-choices",title:"Different company",status:"planned",availability:"planned",
    description:"Check whether a preference between two paintings carries into a new set of alternatives.",
    example:example("The Great Wave led The Starry Night when two portraits joined the comparison. Their order narrowed when other landscapes were offered.",["study-hokusai-great-wave","van-gogh-starry-night"]),
    requiredSignals:["The same work pair rated under an identical unconditional preference prompt.","Different surrounding alternatives recorded on each occasion.","Source order, timing, exposures and near ties retained; the changed full sets must not be labelled exact repeats."],
    sources:[],
    implementationNote:"Adaptive recontextualization can collect these inputs. Neither mapped module currently emits a dedicated changed-company reading.",
    limits:["Different company is only one change between occasions. A shift cannot be assigned to a contrast effect without a controlled design."]
  },
  {
    id:"chosen-groups",lensId:"curating-and-grouping",title:"Chosen groups",status:"implemented",availability:"current",
    description:"Observed room groups and close table groups, with each instrument kept explicit.",
    example:example("The Great Wave, Early Spring and The Starry Night shared a museum room. The grouping is recorded without deciding in advance what connects it.",["study-hokusai-great-wave","study-guo-xi-early-spring","van-gogh-starry-night"]),
    requiredSignals:["A valid finished museum or sorting record with exact artwork identities.","Intentional room membership, or actual positions on the fixed 3:2 sorting board.","For a close table group, every member pair must meet the complete-link near rule."],
    sources:[connections("groups",{"kindIn":["museum-room","sorting-neighbours","recurring-museum","recurring-sorting"]})],
    implementationNote:"Groups retain allWorkIds and totalWorkCount even when display workIds are capped. Room membership and sorting distance are not merged into one scale.",
    limits:["Automatic wall spacing is not a similarity signal. A close group does not establish preference, a category name or a motive."]
  },
  {
    id:"pairing-choices",lensId:"curating-and-grouping",title:"Pairing choices",status:"implemented",availability:"current",
    description:"A painting can be the stronger neighbour for a fixed work even when another candidate was preferred earlier.",
    example:example("The Great Wave led an earlier preference comparison with Composition 8. Composition 8 was later chosen beside The Starry Night, connected through shapes or composition.",["study-hokusai-great-wave","study-kandinsky-composition-eight","van-gogh-starry-night"]),
    requiredSignals:["A completed choice of one neighbour from four candidates beside one separately recorded fixed painting, with the stated connection when offered.","An earlier complete unconditional preference response containing the chosen candidate and another offered candidate, with the other candidate at least 15 points higher.","The fixed painting, exact pairing brief, connection response and both source round IDs retained. No-good-neighbour answers do not supply a reversal.","Each candidate set counts once per direction; earlier preferences aligned with the pairing choice remain counterevidence."],
    sources:[contrast({"id":"contrast-neighbour","module":"taste-and-neighbours"}),portrait("observations",{"id":"contrast-neighbour","module":"taste-and-neighbours"})],
    implementationNote:"The analyzer links only candidates with an actual earlier pair preference. It preserves both opposing and aligned pair relations when the same neighbour choice contains them. The anchor stays attached to the evidence; it is not another preference response.",
    limits:["This asks for a connection to one fixed painting, with no single correct neighbour. It does not rank the candidates by unconditional preference.","An offered candidate that was not chosen is not a dislike. The stated connection is an explanation given for this task, not a demonstrated cause.","The anchor, company, question and timing can all contribute. Reused candidates remain dependent evidence."]
  },
  {
    id:"grouping-descriptors",lensId:"curating-and-grouping",title:"Connections within groups",status:"implemented",availability:"current",
    description:"Test whether recorded colour, date or style relationships help describe an arrangement, alongside alternatives that do not fit.",
    example:example("Early Spring and Travelers Among Mountains formed a close pair. Sampled colour, recorded dates and style labels were checked against the other close and separated pairs.",["study-guo-xi-early-spring","study-fan-kuan-travelers"]),
    requiredSignals:["A valid finished curatorial record.","Known sampled palettes, bounded date ranges, movement labels or reviewed visual descriptors.","The relevant sorting or gallery analyzer's qualifying within-group and alternative-arrangement comparisons."],
    sources:[portrait("curatorialObservations",{"idPattern":"^(gallery-.+-(grouping|local|neighbors)-|sorting-.+-descriptor-)"})],
    implementationNote:"taste-portrait delegates to analyzeScenarios, then retains up to three curatorial findings. The underlying gallery and sorting analyzers supply the descriptor checks.",
    limits:["A grouping description is not a proven organising rule. Convenience, coinciding descriptors, source quality and unmeasured associations can fit the same layout."]
  },
  {
    id:"grouping-recurrence",lensId:"curating-and-grouping",title:"Groups on return",status:"implemented",availability:"current",
    description:"The same paintings remain together, separate, or change relationship on a comparable return.",
    example:example("The School of Athens and The Night Watch shared a room on two attempts with the same collection. The Birth of Venus moved to another room on the second attempt.",["study-raphael-school-athens","study-rembrandt-night-watch","study-botticelli-birth-venus"]),
    requiredSignals:["Two or more valid finished records from the same instrument, protocol and offered set.","Actual observed placement for every pair counted.","For sorting, near and far observations; intermediate distances remain unclassified."],
    sources:[connections("links",{"relationIn":["recurring","changed"]}),connections("counterlinks",{"relation":"changed"}),connections("groups",{"recurring":true})],
    implementationNote:"Recurrence is calculated within comparable cohorts. A missing placement is not treated as separation.",
    limits:["Remembering or deliberately reusing a layout can produce recurrence. Pair counts are dependent and do not form a personality consistency score."]
  },
  {
    id:"table-and-room-difference",lensId:"curating-and-grouping",title:"Table & rooms",status:"implemented",availability:"current",
    description:"A pair can be close in free sorting but separated in a museum arrangement.",
    example:example("Dance and The Scream sat close together on the sorting table, then went into different museum rooms. The changed task provides a different setting for the pair.",["study-matisse-dance","study-munch-scream"]),
    requiredSignals:["A valid sorting record and a valid museum record containing the same pair.","A sorting near relation and different museum room memberships.","Source records and the distinct instruments retained."],
    sources:[connections("crossTaskPatterns",{"kind":"cross-task-placement"})],
    implementationNote:"The current comparison uses the latest valid table and museum records and explicitly sets comparable:false.",
    limits:["A room can serve a curatorial purpose unrelated to table similarity. These are different tasks, not conflicting values on a shared axis."]
  },
  {
    id:"works-left-out",lensId:"curating-and-grouping",title:"What you leave out",status:"implemented",availability:"current",
    description:"Presented works left unhung, and stronger comparisons when a previously preferred work loses a place in a chosen wall.",
    example:example("The Starry Night had the higher individual rating. The final wall comparison kept The Great Wave and left The Starry Night in storage.",["van-gogh-starry-night","study-hokusai-great-wave"]),
    requiredSignals:["Actual presentation records and the completed arrangement, not merely an offered tray.","For an individual-preference comparison, a captured valid earlier rating of the exact pair.","For a difficult edit, the explicit final choice between equal-sized three-work walls."],
    sources:[connections("omissions",{}),portrait("curatorialObservations",{"idPattern":"^(gallery-.+-omission|difficult-edit-.+-preference)$"})],
    implementationNote:"Connections reports observed museum omissions. The stronger preference/fit comparison comes through the delegated gallery or difficult-edit finding when a real baseline exists.",
    limits:["An omission can reflect fit, redundancy or space. It does not establish dislike, and unseen offered paintings remain unknown."]
  },
  {
    id:"familiarity-and-shortlist",lensId:"finding-more",title:"Familiarity & selection",status:"implemented",availability:"current",
    description:"Which shortlisted works were marked familiar beforehand, and which were not.",
    example:example("The shortlist kept Mona Lisa, La Catrina and Bharat Mata. Only Mona Lisa had been marked familiar before today.",["study-leonardo-mona-lisa","study-posada-catrina","study-abanindranath-bharat-mata"]),
    requiredSignals:["A confirmed prior-familiarity grid, including an explicit None when appropriate.","A later confirmed selection linked to that familiarity round and containing the same offered artwork set.","Exact grid identity and the recorded selection capacity retained. An unsure familiarity answer suppresses the reading. Earlier three-work caps are not imposed on new uncapped grids."],
    sources:[refined({"id":"refined-familiarity","module":"familiarity-shortlist"}),portrait("observations",{"id":"refined-familiarity"})],
    implementationNote:"The refined module returns categorical matched-selection comparisons with measures:[], not invented preference numbers. Before-today familiarity is a separate record from artist or movement matching. New v6 grids allow any number from the offered set; frozen earlier grids keep their captured capacity.",
    limits:["Not marked familiar is the recorded earlier response. It does not prove the work was never seen, and familiarity is not expertise.","Unselected works are not disliked or equally ranked. Earlier capped selections restrict what could be chosen; new uncapped grids retain their different instructions.","Fame, subject, presentation, the offered mix and repeated viewing may contribute; overlap does not show that familiarity caused selection."]
  },
  {
    id:"artist-and-tradition-routes",lensId:"finding-more",title:"Artists & traditions",status:"implemented",availability:"current",
    description:"Sourced routes from preferred works, with stronger recurring comparisons distinguished from one-work starting points.",
    example:example("The Starry Night and Sunflowers led different comparisons. That supports comparing more Van Gogh; it does not establish a preference for every Post-Impressionist painting.",["van-gogh-starry-night","study-van-gogh-sunflowers"]),
    requiredSignals:["Preferred seeds backed by clear discovery preference comparisons.","Usable artist or movement metadata, or finite bounded dates.","Tradition/date routes require at least two distinct contrast sets and two works; an artist route can start from one work with that limit stated."],
    sources:[portrait("discovery.artists",{}),portrait("discovery.traditions",{}),portrait("discovery.eras",{})],
    implementationNote:"Artist, tradition and era routes keep different evidence requirements. Century bins are chronological and are not assumed to be shared styles.",
    limits:["A preferred work does not establish a preference for an artist's whole output, a culture or a historical period."]
  },
  {
    id:"unrated-painting-route",lensId:"finding-more",title:"New comparisons",status:"implemented",availability:"current",
    description:"An explicit untested suggestion connected to a work already preferred.",
    example:example("After a preference for Girl with a Pearl Earring, an unrated Milkmaid becomes a useful comparison with another Vermeer. The shared artist does not predict the answer.",["study-vermeer-pearl","study-vermeer-milkmaid"]),
    requiredSignals:["A preferred seed with a clear comparison and sourced identity.","A sourced catalogue work without an unconditional preference response.","A shared artist, a shared catalogue tradition, or at least four known visual descriptors with sufficient similarity."],
    sources:[portrait("discovery.paintings",{})],
    implementationNote:"Suggestions use sourced catalogue works that do not yet have an ordinary preference response. Further portfolio growth needs additional sourced works, rather than relabelling rated paintings as new.",
    limits:["A shared artist, label or descriptor does not guarantee preference. The suggestion carries no calibrated probability."]
  },
  {
    id:"museum-collection-route",lensId:"finding-more",title:"Connected collections",status:"implemented",availability:"current",
    description:"A museum connection supported by a preferred work or an artist represented in its collection.",
    example:example("The Great Wave links one preferred work to The Metropolitan Museum of Art. Girl with a Pearl Earring supplies a different collection route to the Mauritshuis.",["study-hokusai-great-wave","study-vermeer-pearl"]),
    requiredSignals:["A preferred artwork with traceable support.","Its sourced institution metadata, or a supported artist connection in the editorial museum list.","A direct collection or institution URL."],
    sources:[portrait("discovery.museums",{})],
    implementationNote:"The module uses both the editorial museum list and institutions named by new sourced catalogue entries. It is a collection route rather than a global museum ranking.",
    limits:["Collection ownership does not establish current display. Opening times, location, travel suitability and access are not inferred from the profile."]
  },
  {
    id:"recognition-and-preference",lensId:"finding-more",title:"Artist & style recognition",status:"planned",availability:"planned",
    description:"Compare actual artist/style matches with independently recorded preference, without treating either as expertise.",
    example:example("Mona Lisa was correctly matched to Leonardo, while The Night Watch received the stronger preference even though its artist match was left unsure.",["study-leonardo-mona-lisa","study-rembrandt-night-watch"]),
    requiredSignals:["Recorded cued artist or movement matches, including Not sure.","Independent preference answers for the same works.","Known-name attribution flags, option sets, presentation order and prior label exposure."],
    sources:[],
    implementationNote:"Artist/style matching is separate from prior-familiarity grids. Its coverage is recorded, but no matched artist-recognition/preference reading is implemented; the familiarity shortlist does not change this status.",
    limits:["Correct matches can be guesses, and earlier games teach labels. Cued recognition is not general expertise, prior familiarity or a motive inferred from preference."]
  }
]);

export const READING_LENSES=PROFILE_READING_LENSES;
export const READING_FAMILIES=PROFILE_READING_CATALOG;
