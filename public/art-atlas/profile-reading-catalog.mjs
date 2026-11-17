import {TASTE_FAMILY_DEFINITIONS} from './taste-family-definitions.mjs';
// Evidence-led reading families, not personality types.
// All artwork examples are illustrative and never findings about the visitor.
export const PROFILE_READING_CATALOG_VERSION=6;
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
    "title": "Taste connections",
    "description": "Specific connections across paintings, alongside broader visual comparisons.",
    "readingIds": [
      "stories-within-scenes",
      "light-and-drama",
      "fantastical-worlds",
      "relationships-in-scenes",
      "expressive-figures",
      "pattern-and-structure",
      "brushwork-and-marks",
      "precision-and-materials",
      "space-and-setting",
      "human-figures",
      "representation",
      "colour-intensity",
      "density-and-activity",
      "depicted-action",
      "setting-and-atmosphere",
      "chosen-work-connections",
      "range-in-positive-choices",
      "reported-density",
      "shared-subjects"
    ]
  },
  {
    "id": "different-reactions",
    "title": "Taste & feeling",
    "description": "Personal appeal, admiration and the wish to return.",
    "readingIds": [
      "admiration-and-appeal",
      "tension-and-return",
      "attention-to-making",
      "people-and-reaction",
      "unexpectedness-and-preference",
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
      "symbols-and-allegory",
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
      "favourites-and-ratings",
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

const portrait=(resultPath,match={})=>({module:'taste-portrait',file:'public/art-atlas/taste-portrait.mjs',export:'buildTastePortrait',resultPath,match});
const connections=(resultPath,match={})=>({module:'taste-connections',file:'public/art-atlas/taste-connections.mjs',export:'buildTasteConnections',resultPath,match});
const refined=match=>({module:'reading-patterns-v2',file:'public/art-atlas/reading-patterns-v2.mjs',export:'buildRefinedReadings',resultPath:'$',resultType:'array',match});
const contrast=match=>({module:'contrast-readings',file:'public/art-atlas/contrast-readings.mjs',export:'buildContrastReadings',resultPath:'$',resultType:'array',match});
const axis=key=>({module:'taste-axes',file:'public/art-atlas/taste-axes.mjs',export:'buildTasteAxes',resultPath:'axes',match:{key}});
const example=(text,workIds)=>({text,workIds,illustrative:true});

// Product copy is separate from the detailed analytical requirements below.
const userCopy={
  'human-figures':{
    userSignals:['Choices across several groups of paintings.','Comparisons between work centred on people and work with less human presence.','Examples that go against the pattern, as well as those that support it.'],
    userLimits:['People may come with other qualities you enjoy, such as expressive faces or a story.','These choices do not represent every painting of people.']
  },
  representation:{
    userSignals:['Choices across several different groups.','Paintings that differ clearly in how closely they depict recognisable things.','Both supporting choices and exceptions.'],
    userLimits:['Subject, colour and artist can change alongside representation.','A few comparisons do not speak for all figurative or abstract art.']
  },
  'colour-intensity':{
    userSignals:['Choices between paintings with stronger and more restrained colour.','The same direction appearing in different groups.','Other colour choices that challenge that direction.'],
    userLimits:['Reproductions and screens can alter colour.','Colour intensity does not tell us your favourite hue or combination of colours.']
  },
  'density-and-activity':{
    userSignals:['Choices across several groups, with different amounts of detail or movement.','A recurring connection between those differences and your choices.','Preferred paintings that do not fit that connection.'],
    userLimits:['Detail and movement are considered separately.','Enjoying a spare painting does not rule out enjoying a dense one.']
  },
  'depicted-action':{
    userSignals:['Choices between scenes with more bodily action and scenes with less.','The connection appearing across different paintings.','Exceptions that show where that connection stops helping.'],
    userLimits:['A crowded composition does not necessarily show more action.','Other differences between the paintings may matter to your choice.']
  },
  'setting-and-atmosphere':{
    userSignals:['Choices between paintings that give their setting different amounts of emphasis.','Examples from several groups.','Paintings you preferred despite a different emphasis on setting.'],
    userLimits:['The setting in a picture and the feeling it gives you are separate things.','A connection in this collection does not establish a preference for every landscape.']
  },
  'shared-subjects':{
    userSignals:['Choices between paintings of a broadly shared subject.','An earlier preference for the same paintings, if a change of choice is described.','Several different examples before describing a recurring way of treating a subject.'],
    userLimits:['Similar subjects can still differ in colour, style, artist and composition.','The other paintings and the question being asked can affect a choice.']
  },
  'admiration-and-appeal':{
    userSignals:['Separate answers about personal appeal and admiration for the making.','The same paintings in both answers.','Examples where admiration and appeal agree, alongside examples where they separate.'],
    userLimits:['Admiration is your judgment, not a grade of artistic quality.','Admiration and liking can agree for some paintings and differ for others.']
  },
  'tension-and-return':{
    userSignals:['Your placements between comforting and unsettling.','A separate answer about which paintings you would return to.','Several examples at both ends before describing a wish to return to both comfort and tension.'],
    userLimits:['Wanting to return is not the same as actually returning later.','An unsettling painting need not be unpleasant or disliked.']
  },
  'scene-and-interpretation':{
    userSignals:['Your answers about how clear each scene is and how many readings it allows.','Separate choices about which of those paintings you prefer.','Different examples, including those that do not follow the same connection.'],
    userLimits:['A clear scene can still allow several interpretations.','These answers do not judge whether an interpretation is correct.']
  },
  'story-rating-change':{
    userSignals:['Your direct answer about how much knowing the note changes your appreciation.','The exact painting and sourced note that you opened.','An earlier personal-appeal answer, when one was actually recorded; older quizzes retain their original before-and-after ratings.'],
    userLimits:['The direct response can be Much more even if an earlier appeal rating was already at the top.','Reading and looking again happen together. A reported change does not prove that the note alone caused it.']
  },
  'claim-and-story-comparison':{
    userSignals:['An earlier answer about whether stories usually change your preferences.','A later before-and-after response to a particular painting.','The earlier statement and the later response kept together.'],
    userLimits:['A broad description of your taste can have exceptions.','One changed rating does not show how often a story matters.']
  },
  'exact-preference-repeat':{
    userSignals:['The same paintings returning under the same question.','Your answers on both occasions.','Clear choices and close calls kept distinct.'],
    userLimits:['Memory, order, mood and time can affect the second answer.','A return within this study does not establish long-term stability.']
  },
  'selection-changes':{
    userSignals:['A painting you chose to keep and another you chose to leave.','An earlier preference between those same two paintings.','The other choices and the purpose of each question kept visible.'],
    userLimits:['Leaving a painting out does not mean you dislike it.','A different group or purpose can lead to a different choice.']
  },
  'prospective-feature-check':{
    userSignals:['A possible explanation drawn from several earlier choices.','A prediction recorded before you answered the later comparison.','The actual result, including exceptions and any competing explanation.'],
    userLimits:['An explanation can fit one comparison and miss another.','A new pairing can contain paintings you already know.']
  },
  'chosen-groups':{
    userSignals:['A completed museum arrangement or sorting table.','The paintings you actually placed together.','Their positions and room choices kept as you made them.'],
    userLimits:['A group need not have just one connection.','Placing works together does not say that they are equally liked.']
  },
  'pairing-choices':{
    userSignals:['The neighbour you chose for a particular painting.','Any connections you selected, such as colour, subject or composition.','An earlier preference between the candidates, if the reading describes a different choice.'],
    userLimits:['Choosing a neighbour asks a different question from choosing a favourite.','The unchosen candidates are not necessarily disliked.']
  },
  'grouping-descriptors':{
    userSignals:['The groups you made in a completed arrangement.','Known connections in colour, date, style or composition.','Other groups and separated paintings that challenge a suggested connection.'],
    userLimits:['Several connections can fit the same group.','Convenience and personal associations can matter too.']
  },
  'grouping-recurrence':{
    userSignals:['At least two arrangements made with the same collection.','The groups and separations you actually chose on each occasion.','Paintings whose relationship changed as well as those kept together.'],
    userLimits:['You may remember or deliberately change an earlier arrangement.','A repeated grouping is not an overall score for consistency of taste.']
  },
  'table-and-room-difference':{
    userSignals:['The same paintings placed in a sorting table and a museum.','A pair kept close on the table but put in different rooms.','Both arrangements available to inspect.'],
    userLimits:['Rooms can serve a different purpose from a sorting table.','A different placement need not contradict your preference.']
  },
  'works-left-out':{
    userSignals:['A completed arrangement and the paintings you actually saw.','The works you kept and those you left outside it.','A real earlier preference if the reading compares liking with what you chose to hang.'],
    userLimits:['Space, repetition or fit can explain an omission.','Unseen paintings do not count as rejected, and an omission is not a dislike.']
  },
  'familiarity-and-shortlist':{
    userSignals:['An earlier answer about which paintings were familiar.','A later selection from those same paintings.','Your original answers, including None or Not sure.'],
    userLimits:['Not marked familiar does not prove a painting has never been seen.','Familiarity is different from expertise, and selection is different from ranking.']
  },
  'artist-and-tradition-routes':{
    userSignals:['Paintings you rated highly or chose as favourites.','Reliable artist, style or date information for those works.','Other choices that go against a suggested artist or period connection.'],
    userLimits:["One painting does not represent an artist's whole output.",'A broad period or tradition can contain very different work.']
  },
  'unrated-painting-route':{
    userSignals:['A painting you preferred, with that choice still available to inspect.','Another sourced work you have not yet rated here.','A clear connection through the artist, tradition or visual treatment.'],
    userLimits:['A shared artist or subject does not guarantee that you will like the other work.','This is a comparison to try rather than a promise about your taste.']
  },
  'museum-collection-route':{
    userSignals:['Paintings you chose, rated highly or named as favourites.','A sourced link to a museum collection or to an artist represented there.','The actual works behind each museum connection.'],
    userLimits:['A work belonging to a collection does not guarantee that it is on display.','Check the museum directly before planning a visit.']
  },
  'chosen-work-connections':{
    userSignals:['Several paintings you rated highly or chose as favourites.','A sourced visual connection across different artists or styles.','Paintings that challenge that connection, alongside examples that support it.'],
    userLimits:['Shared visual features suggest a connection; they do not prove why you prefer a painting.','A common subject in this collection may explain part of a pattern.']
  },
  'range-in-positive-choices':{
    userSignals:['Several spare paintings and several denser ones that you liked.','Your actual ratings or explicit favourites for each.','Examples from both ends shown together.'],
    userLimits:['Detail can matter without ruling out other kinds of painting.','This keeps both ends in the picture rather than naming a single type for your taste.']
  },
  'attention-to-making':{
    userSignals:['Your answer about attention to paint, marks, lines and composition.','A separate preference for the same paintings if the two responses are compared.','Examples where those answers agree or differ.'],
    userLimits:['Paying attention to the making is different from admiring it.','Reported attention is not a measurement of viewing time.']
  },
  'favourites-and-ratings':{
    userSignals:['A favourites selection you confirmed.','Earlier liking ratings for the same paintings, if a difference is described.','Only paintings you actually saw among the favourites options.'],
    userLimits:['Selected favourites are not ranked among themselves.','A painting not selected as a favourite is not necessarily disliked.']
  }
};

export const PROFILE_READING_CATALOG=Object.freeze([
  ...TASTE_FAMILY_DEFINITIONS,
  {
    id:"human-figures",lensId:"visual-patterns",title:"Human presence",status:"implemented",availability:"current",
    description:"Whether work centred on people recurs in preference comparisons, and where other subjects win instead.",
    example:example("Mona Lisa and Girl with a Pearl Earring led separate comparisons with Black Square and The Great Wave. A later choice of The Great Wave over Mona Lisa challenged a simple rule about figures.",["study-leonardo-mona-lisa","study-vermeer-pearl","study-malevich-black-square","study-hokusai-great-wave"]),
    requiredSignals:["At least three distinct discovery sets, six different paintings and three named artists among preferred examples.","Reviewed descriptions of human presence, with clear response and image contrasts. Repeats and probes remain dependent checks.","Supporting, opposing and mixed sets retain their actual balance. A tentative direction is not promoted to a recurring summary."],
    sources:[axis('human-presence')],
    implementationNote:"Humanity describes the prominence of human presence. It is not a count of people and does not include animals merely because they are figurative subjects.",
    limits:["Human figures, narrative, emotion and style can vary together. The comparisons do not isolate which feature caused a choice."]
  },
  {
    id:"representation",lensId:"visual-patterns",title:"Representation & abstraction",status:"implemented",availability:"current",
    description:"A recurring preference direction across more representational or more abstract paintings, with exceptions retained.",
    example:example("The Birth of Venus came ahead of Black Square, and Girl with a Pearl Earring ahead of Composition 8. Those separate comparisons share a direction towards representation.",["study-botticelli-birth-venus","study-malevich-black-square","study-vermeer-pearl","study-kandinsky-composition-eight"]),
    requiredSignals:["Validated unconditional preference spectra with clear pair gaps.","Known abstraction differences of at least0.25, and a response difference of at least15 on the original scale.","At least three distinct discovery sets, six different paintings and three named preferred-work artists. Tentative directions and opposing sets retain their status."],
    sources:[axis('representation-abstraction')],
    implementationNote:"Every qualifying feature candidate remains available, with supporting, opposing and mixed set counts. Candidates sharing the same supporting pairs can share one displayed observation; neither their pair counts nor display priority are confidence.",
    limits:["This describes image annotations accompanying choices. Subject, colour and other differences are not held constant."]
  },
  {
    id:"colour-intensity",lensId:"visual-patterns",title:"Colour intensity",status:"implemented",availability:"current",
    description:"A recurring direction towards more intense or more restrained colour in separate preference sets.",
    example:example("The Kiss came ahead of Mona Lisa, and The Starry Night ahead of La Catrina. More intense annotated colour accompanies both choices; it is not the only difference.",["klimt-kiss","study-leonardo-mona-lisa","van-gogh-starry-night","study-posada-catrina"]),
    requiredSignals:["Validated unconditional preference spectra.","Known colour-intensity values and clear contrasts.","Three distinct discovery sets, six different paintings and three named preferred-work artists. Supporting, mixed and opposing sets remain visible."],
    sources:[axis('colour')],
    implementationNote:"The current feature is colour intensity. This does not identify a favourite hue, palette or colour harmony.",
    limits:["Digital reproductions and coarse editorial descriptors limit the colour comparison. A hue-specific profile needs a different analysis."]
  },
  {
    id:"density-and-activity",lensId:"visual-patterns",title:"Detail & composition",status:"implemented",availability:"current",
    description:"Whether denser compositions or greater visual activity accompany repeated choices, with the two descriptions kept separate.",
    example:example("The Garden of Earthly Delights came ahead of Girl with a Pearl Earring, and The Night Watch ahead of Black Square. Denser compositions connect these choices; other comparisons can challenge that description.",["bosch-garden-delights","study-vermeer-pearl","study-rembrandt-night-watch","study-malevich-black-square"]),
    requiredSignals:["Distinct validated preference sets with clear pair orders.","Known complexity and visual-activity values assessed separately.","At least three distinct discovery sets, six different paintings and three named preferred-work artists. A combined direction needs agreement between the components; exceptions and tentative results remain visible."],
    sources:[axis('detail-composition')],
    implementationNote:"Complexity and energy are tested separately; all qualified candidates retain their own balance. Positive overall choices at both ends qualify a one-ended direction rather than being hidden by it. No density identity or combined score is assigned.",
    limits:["Visual density, depicted action and felt tension are different measurements. They can vary together without explaining one another."]
  },
  {
    id:"depicted-action",lensId:"visual-patterns",title:"Action & stillness",status:"implemented",availability:"current",
    description:"Whether scenes with more depicted action recur among your choices.",
    example:example("The Night Watch led a comparison with Girl with a Pearl Earring; The School of Athens led another with Black Square. Depicted action is one possible connection, alongside other differences.",["study-rembrandt-night-watch","study-vermeer-pearl","study-raphael-school-athens","study-malevich-black-square"]),
    requiredSignals:["Several preference comparisons using different paintings.","Known literal descriptions of depicted action, rather than inferred symbolism.","At least three distinct discovery sets, six different paintings and three named preferred-work artists, with opposing and mixed sets retained."],
    sources:[axis('action-stillness')],
    implementationNote:"The narrative annotation is depicted action, not symbolism, a viewer’s life story or general narrative preference.",
    limits:["A dramatic subject and a busy composition can overlap. One comparison cannot distinguish them."]
  },
  {
    id:"setting-and-atmosphere",lensId:"visual-patterns",title:"Setting & atmosphere",status:"implemented",availability:"current",
    description:"Whether work with a stronger emphasis on its setting recurs in your choices.",
    example:example("The Starry Night led a comparison with Black Square, and Early Spring led another with Composition 8. A stronger emphasis on setting connects those choices, despite their different colours and methods.",["van-gogh-starry-night","study-malevich-black-square","study-guo-xi-early-spring","study-kandinsky-composition-eight"]),
    requiredSignals:["At least three distinct discovery sets, six different paintings and three named preferred-work artists.","Reviewed literal descriptions of emphasis on setting, with clear contrasts.","Supporting, opposing and mixed choices retained. A tentative direction is separate from a recurring summary."],
    sources:[axis('setting-atmosphere')],
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
    description:"Where appeal and admiration accompany one another, and which paintings separate them.",
    example:example("The Night Watch received more admiration for its making; Black Square was more for this viewer. A second pair can test whether the same split recurs.",["study-rembrandt-night-watch","study-malevich-black-square"]),
    requiredSignals:["A completed achievement map with its original personal-appeal and admiration axes.","An aligned recurring reading needs two distinct artwork sets and at least four different works, with clear local appeal/preference orders and admiration differences. Opposing pairs, including those in supportive sets, remain visible.","A local split can be shown from a clear map difference or a genuine earlier exact-set preference. The earlier preference must precede the map; a grid appeal coordinate is not another unconditional preference answer."],
    sources:[portrait("observations",{"idIn":["response-making","refined-achievement"]}),refined({"id":"refined-achievement","module":"making-and-taste"})],
    implementationNote:"The response-making reading combines alignment with exact exceptions and counts each actual artwork set once per direction. A set can support both. The older local split remains available when the recurring positive reading does not qualify.",
    limits:["Admiration is the viewer's judgment, not objective skill, effort or artistic value.","A single set supports a local comparison. Distinct sets and counterexamples are needed before describing recurrence.","Subject, method, reproduction and personal associations can all contribute to the split."]
  },
  {
    id:"tension-and-return",lensId:"different-reactions",title:"Wanting to return",status:"implemented",availability:"current",
    description:"Comforting and unsettling paintings can both invite a return; the works that do not are kept alongside that pattern.",
    example:example("Mona Lisa was preferred overall, but The Scream received the stronger wish to return despite being placed as more unsettling.",["study-leonardo-mona-lisa","study-munch-scream"]),
    requiredSignals:["A completed returnResponse map with the exact felt-tension and wish-to-return meanings.","A two-sided return reading needs at least two different comforting works and two different unsettling works with a stronger wish to return, spanning at least two artwork sets. Same-work repeats cannot supply that range.","A local unsettling-return comparison remains available. A preference difference is added only with a separate genuine matched preference response."],
    sources:[portrait("observations",{"idIn":["response-return-range","refined-return"]}),refined({"id":"refined-return","module":"tension-and-return"})],
    implementationNote:"The broader reading preserves both tension ends and once-is-enough counterexamples. Every original map remains available separately; old activation or pleasantness axes are not renamed.",
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
    id:"attention-without-preference",lensId:"different-reactions",title:"Attention",status:"implemented",availability:"current",
    description:"Reported attention and personal appeal can separate, including different attention at similar appeal.",
    example:example("Dance came first in preference, while The Garden of Earthly Delights received the higher reported-attention placement.",["study-matisse-dance","bosch-garden-delights"]),
    requiredSignals:["A valid personal-appeal/reported-attention map with exact recorded axis definitions.","Known work identities and source-bound responses.","Either reported attention with limited appeal, or a clear attention gap between similarly appealing works."],
    userSignals:["Personal appeal and reported attention for the same paintings.","Examples with similar appeal but noticeably different attention, or attention despite limited appeal."],
    userLimits:["Reported attention is not measured viewing time.","One comparison suggests a distinction; more varied examples test whether it recurs."],
    sources:[portrait("observations",{module:"attention-and-appeal"})],
    implementationNote:"Current reported-attention maps pair personal appeal and reported attention on exact work identities. The analysis can report high attention with limited appeal, or different attention at similar appeal; one map set remains provisional.",
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
    id:"connection-without-understanding",lensId:"different-reactions",title:"Personal connection",status:"implemented",availability:"current",
    description:"Reported connection and reported understanding can differ for the same work.",
    example:example("The Banjo Lesson felt more personal than American Gothic, although it was placed as harder to understand.",["study-tanner-banjo-lesson","study-wood-american-gothic"]),
    requiredSignals:["A valid understanding/connection grid.","Exact recorded axis definitions and work identities.","Preference for those works if the reading also makes a claim about preference."],
    userSignals:["Your reported understanding and personal connection for the same paintings.","A clear separation between those responses, with the exact choices retained."],
    userLimits:["Connection does not establish correct interpretation.","Subject, memories and familiarity can contribute without being identified by this answer."],
    sources:[portrait("observations",{module:"connection-and-understanding"})],
    implementationNote:"Source-bound understanding/connection maps now generate personal connection without easy understanding and contrasts between similarly understandable works. These are direct reports, not tests of correct interpretation.",
    limits:["Personal connection and ease of understanding are self-reports. Neither tests correct interpretation or reveals a personal history."]
  },
  {
    id:"scene-and-interpretation",lensId:"meaning-and-context",title:"Scene & interpretation",status:"implemented",availability:"current",
    description:"How preference relates to a clear scene and to the meanings it leaves open.",
    example:example("Las Meninas was preferred to Girl with a Pearl Earring. Both scenes were marked clear, while Las Meninas was given more possible readings.",["velazquez-las-meninas","study-vermeer-pearl"]),
    requiredSignals:["A completed reading map with scene clarity and interpretive openness.","A separate completed preference comparison for exactly the same artwork set.","Clear coordinate contrasts that distinguish openness within clear scenes, openness with less clarity, or clarity with fewer readings."],
    sources:[refined({"id":"refined-reading","module":"scene-and-meaning"}),portrait("observations",{"idIn":["response-reading","refined-reading"]})],
    implementationNote:"The positive connection requires several different positively rated/favourite works across map sets, or explicitly labelled exact-set local leaders for a legacy reading. Clear scenes and possible readings remain separate coordinates. Older meaning, connection and one-dimensional openness answers are never recoded.",
    limits:["Scene clarity and possible meanings are personal reports, not tests of correct interpretation.","The relationship does not establish that symbolism caused a preference or measure intelligence or tolerance for ambiguity.","Repeated maps of the same works do not add distinct-set support; preference and appraisal order can affect the comparison."]
  },
  {
    id:"story-rating-change",lensId:"meaning-and-context",title:"Context & appreciation",status:"implemented",availability:"current",
    description:"What you report the sourced note adds to your appreciation, even when the painting already had maximum appeal.",
    example:example("Hope already had an appeal rating of 100. After the note about its remaining string, the viewer reported Much more appreciation. The Ambassadors received No change after its note. Neither response invents a new appeal score.",["add-watts-hope","holbein-ambassadors"]),
    requiredSignals:["A confirmed reported-context-change-v1 question with its exact reported-appreciation-change-v1 marker, painting and sourced note.","The note was revealed before one of five direct change responses, or an explicit Unsure; uncertainty is separate from No change.","An optional earlier continuous personal-appeal snapshot must match the painting source. Historical preference-before-after-v1 ratings remain a separate supported route."],
    sources:[portrait("reportedContextChanges.responses",{}),portrait("reportedContextChanges.observations",{}),portrait("symbolism.responses",{}),portrait("observations",{"module":"symbolism"}),portrait("contextRatings",{})],
    implementationNote:"Direct change records preserve the source note, response category, uncertainty and any real earlier baseline without synthesizing an after-rating. Older typed symbolism and generic before/after records retain their original measures. Cross-work summaries do not treat repeated notes about the same painting as independent artworks.",
    limits:["Reading, repeated viewing and elapsed time occur together. Direct change is a self-report, not a causal effect or a computed after-score.","The five change codes identify ordered response choices; their spacing is not a calibrated psychological interval. An old 5-to-5 rating remains unchanged under its original instrument."]
  },
  {
    id:"claim-and-story-comparison",lensId:"meaning-and-context",title:"Expectations & context",status:"implemented",availability:"legacy",
    description:"A broad statement about stories is placed beside a specific later before/after response.",
    example:example("The viewer agreed that stories rarely change their preferences. The Birth of Venus then moved from 3 to 4 out of 5 after a museum note. That is one local exception, not a verdict on the broader claim.",["study-botticelli-birth-venus"]),
    requiredSignals:["The exact contextEffect statement answered before the note.","Reciprocal claimRoundId/contextRoundId links and a shared checkId.","Agreement of at least 3 on the 0–4 scale and a nonzero validated before/after change."],
    sources:[portrait("observations",{"id":"symbolism-context-claim"}),portrait("observations",{"id":"taste-context-rating","variant":"linked claim with agreement >= 3 and a nonzero change"})],
    implementationNote:"This historical before/after route is a claim-linked variant of the same context-rating observation, not an additional independent result. Current direct appreciation-change responses have their own reading; this older claim-linked rule is not applied to them.",
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
    id:"openness-and-preference",lensId:"meaning-and-context",title:"Open interpretation",status:"implemented",availability:"legacy",
    description:"Compare preference with how many possible readings a painting seems to allow.",
    example:example("Hunters in the Snow and The Birth of Venus received similar preference positions, while Hunters in the Snow was placed as leaving more possible interpretations open.",["study-bruegel-hunters-snow","study-botticelli-birth-venus"]),
    requiredSignals:["A preference spectrum.","The interpretive-openness looking appraisal for the same exact works.","Explicit handling of near ties, reported understanding and meaning-grid answers as separate signals."],
    sources:[portrait("lookingAppraisals.responses",{"construct":"interpretive-openness"}),portrait("observations",{"module":"looking-appraisals","construct":"interpretive-openness"})],
    implementationNote:"Retained one-dimensional openness answers remain literal reports. A recognised frozen scale and actual matched preference can supply an aligned or opposing relationship. This earlier instrument is distinct from the current reading map.",
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
    description:"Earlier provisional explanations meet a new comparison, including a rival explanation or an unresolved near tie.",
    example:example("Earlier choices suggested denser compositions. A new direct pair then favoured Girl with a Pearl Earring over The Night Watch, going against that provisional explanation.",["study-vermeer-pearl","study-rembrandt-night-watch"]),
    requiredSignals:["A complete valid two-work adaptive challenge or four-work closing comparison, explicitly bound before its outcome.","A captured provisional explanation and prediction supported by at least three distinct earlier artwork sets and four named artists, with complete frozen answers and known feature values under one measurement scope.","Rival predictions must actually oppose the primary direction. A claimed new pair must pass earlier actual presentation checks, including opened favourites pages and museum exposure. Missing page/exercise metadata cannot prove novelty.","Pairs within one four-work response remain dependent. A pair without verified new-pair status can supply a labelled descriptive recheck rather than independent validation."],
    sources:[portrait("prospectiveChecks",{}),portrait("closingRefinement.checks",{}),portrait("observations",{"module":"closing-checks"}),portrait("observations",{"idPrefix":"taste-prospective-"})],
    implementationNote:"Both readers validate captured earlier definitions and values rather than refitting explanations after the outcome. Four-work closing answers can compare a primary description with its rival. Matched, reversed and near-tied outcomes stay distinct; no accuracy percentage is calculated.",
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
    implementationNote:"The portrait delegates to the validated gallery and sorting analyzers and retains every qualifying curatorial finding, sorted by priority. A visual preview does not remove later source findings.",
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
    implementationNote:"Every valid shared-pair table/museum comparison remains available with its exact source records and comparable:false. Different instruments are not used to manufacture a consistency score.",
    limits:["A room can serve a curatorial purpose unrelated to table similarity. These are different tasks, not conflicting values on a shared axis."]
  },
  {
    id:"works-left-out",lensId:"curating-and-grouping",title:"What you leave out",status:"implemented",availability:"current",
    description:"Presented works left unhung, and stronger comparisons when a previously preferred work loses a place in a chosen wall.",
    example:example("The Starry Night had the higher individual rating. The final wall comparison kept The Great Wave and left The Starry Night in storage.",["van-gogh-starry-night","study-hokusai-great-wave"]),
    requiredSignals:["Actual presentation records and the completed arrangement, not merely an offered tray.","For an individual-preference comparison, a captured valid earlier rating of the exact pair.","New difficult edits use one intentional keep-three/leave-one decision. Older completed two-wall comparisons retain their own original questions and answers."],
    sources:[connections("omissions",{}),portrait("curatorialObservations",{"idPattern":"^(gallery-.+-omission|difficult-edit-.+-(preference|decision))$"})],
    implementationNote:"Observed omissions remain a ledger until real independent earlier preference supports a connection. New single edits cannot create a supposed consistency insight by asking the same removal twice.",
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
    requiredSignals:["Explicit favourites, positive responses on the exact overall-appeal instrument, or clearly labelled legacy within-set leaders.","Usable artist or movement metadata, or finite bounded dates.","Tradition/date routes need several positively chosen works or two distinct supporting comparison sets. Artist routes can start from one work, with that limit stated. Opposing sets and lower choices are retained."],
    sources:[portrait("discovery.artists",{}),portrait("discovery.traditions",{}),portrait("discovery.eras",{})],
    implementationNote:"Routes are ranked by actual positive/favourite work evidence rather than catalogue order. Supporting and opposing distinct-set counts can overlap. A low-rated work by the same artist remains counterevidence even when it was never a preferred seed; century bins are chronology, not shared style.",
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
    implementationNote:"Both sourced catalogue institutions and the editorial list remain available. Direct holding concentration ranks explicit favourites before other positive works, then artist-only connections. No first-three institutional cutoff hides later supported routes; this remains a collection connection rather than a ranking of every museum.",
    limits:["Collection ownership does not establish current display. Opening times, location, travel suitability and access are not inferred from the profile."]
  },
  {
    id:"chosen-work-connections",lensId:"visual-patterns",title:"Connections among chosen works",status:"implemented",availability:"current",
    description:"Specific reviewed connections among positively chosen paintings, across differences in artist, date and composition.",
    example:example("Hope, The Garden of Earthly Delights and Las Meninas offer narrative clues in very different compositions. A connection can include these works while retaining lower-rated paintings with similar clues.",["add-watts-hope","bosch-garden-delights","velazquez-las-meninas"]),
    requiredSignals:["At least three different positively chosen works across two artwork sets, or a qualified explicit favourites selection. Legacy relative placements cannot supply positive overall ratings.","Each used work needs its own captured facet review, exact reviewed reproduction, source record and checksum. Missing or mismatched reviews stay unknown.","Connections can combine narrative detail with imagined worlds, dramatic light with near-view figures, or landscape with layered space. Lower-rated works sharing those descriptions and positive choices outside them remain visible.","A named summary needs a connection shared by explicit favourites or a descriptive concentration compared with known lower-rated works. Simply offering many landscapes does not create a landscape identity."],
    sources:[portrait("facets.observations",{"module":"curatorial-themes"}),portrait("themes",{"basis":"reviewed-facets-of-positive-choices"})],
    implementationNote:"Facet descriptions concern the artworks. They are not generated from the user's answers, and the current sidecar cannot annotate an older frozen catalogue retroactively. A connection can remain an observation without qualifying to name a profile.",
    limits:["The offered mix can make a subject common among positive choices. Known higher/lower-rated work counts and unknown coverage remain part of the evidence.","An unassigned tag is an editorial non-assignment, not proof that a painting has no meaning or emotion. Shared descriptions do not establish why it appealed."]
  },
  {
    id:"range-in-positive-choices",lensId:"visual-patterns",title:"Range within your choices",status:"implemented",availability:"current",
    description:"A positive set can include both spare and dense paintings, qualifying a one-direction explanation.",
    example:example("Both Hope and The Garden of Earthly Delights belong among the positively chosen works. Their different densities prevent reducing that whole set to a preference for simple compositions.",["add-watts-hope","bosch-garden-delights"]),
    requiredSignals:["Explicit favourites or ratings at least 65 on the exact overall-appeal instrument, not high placements on a legacy relative spectrum.","At least two different positively chosen sparse works and two dense works, using known descriptors. They must span different sets or belong to one explicit favourites selection.","The visible contrasting paintings must match the examples actually named. Repeated works do not add positive artworks."],
    sources:[portrait("observations",{"id":"facet-density-range","module":"choice-range"})],
    implementationNote:"This qualifies a simple density explanation and stays available beside richer connections. It never names the profile or supplies an archetype; all-high answers cannot acquire an identity from this breadth alone.",
    limits:["The density annotation is provisional. Enjoying both ends does not prove that detail never matters, or identify another cause of liking."]
  },
  {
    id:"reported-density",lensId:"visual-patterns",title:"Reported visual detail",status:"implemented",availability:"legacy",
    description:"Earlier ratings of how much there was to take in, kept separate from editorial density and from preference.",
    example:example("The Garden of Earthly Delights was placed as having more to take in than Hope. A separate preference response determines whether those two orders agree.",["bosch-garden-delights","add-watts-hope"]),
    requiredSignals:["A complete retained looking-appraisal answer under its original visual-density question and scale.","A genuine earlier exact-set preference if a relationship is shown. Original reported numbers remain inspectable even without that source.","A density headline needs three non-overlapping supporting sets and at least four named artists. Repeats and overlapping sets cannot manufacture that threshold."],
    sources:[portrait("lookingAppraisals.responses",{"construct":"perceived-visual-density"}),portrait("observations",{"module":"looking-appraisals","construct":"perceived-visual-density"})],
    implementationNote:"Current v10 no longer asks this one-off question. Earlier saved answers remain literal reports; they are not renamed as making, scene clarity or a measured objective property.",
    limits:["A person's reported visual detail and an editorial image annotation are different evidence. Neither alone reveals why a work was liked."]
  },
  {
    id:"attention-to-making",lensId:"different-reactions",title:"Looking at the making",status:"implemented",availability:"current",
    description:"Attention to paint, marks, lines and composition beside a separately recorded preference.",
    example:example("The viewer paid more attention to the making of Composition 8 while preferring The Starry Night. The making response remains a separate appraisal.",["study-kandinsky-composition-eight","van-gogh-starry-night"]),
    requiredSignals:["A complete attention-to-making looking appraisal under the exact recorded question and scale.","An earlier valid preference for the same actual set if the reading connects the two answers.","Clear paired differences for a local relationship, or qualified recurring sets with opposing choices retained. A flat appraisal is only a direct report."],
    sources:[portrait("lookingAppraisals.responses",{"construct":"attention-to-making"}),portrait("observations",{"module":"looking-appraisals","construct":"attention-to-making"})],
    implementationNote:"The current journey retains this appraisal. Attention to making is distinct from the achievement map's admiration judgment, and from viewing time or eye tracking.",
    limits:["Looking closely at marks does not establish craftsmanship, effort or admiration. It is not automatically another preference answer."]
  },
  {
    id:"people-and-reaction",lensId:"different-reactions",title:"People & your reaction",status:"implemented",availability:"legacy",
    description:"Earlier reports of how much the figures mattered to a reaction, under their original wording.",
    example:example("The people mattered more in the response to The Banjo Lesson than in a response to The Great Wave. Those reports are kept beside, rather than substituted for, preference.",["study-tanner-banjo-lesson","study-hokusai-great-wave"]),
    requiredSignals:["A complete retained importance-of-figures appraisal, with the original question, scale and exact paintings.","A matched earlier preference if a qualified relationship is generated. Unrecognised older wording stays a direct report rather than silently acquiring a newer interpretation.","Supporting and opposing choices, with no figures-present versus figures-important substitution."],
    sources:[portrait("lookingAppraisals.responses",{"construct":"importance-of-figures"}),portrait("observations",{"module":"looking-appraisals","construct":"importance-of-figures"})],
    implementationNote:"This earlier one-off instrument is not generated by fresh v10. The editorial humanity descriptor measures a different thing and cannot overwrite its answers.",
    limits:["Importance to a reaction, number of people, and human presence are distinct. A single answer cannot establish a preference for figurative art."]
  },
  {
    id:"unexpectedness-and-preference",lensId:"different-reactions",title:"Unexpectedness & preference",status:"implemented",availability:"legacy",
    description:"Earlier surprise ratings can agree with preference or follow a different order.",
    example:example("The Sleeping Gypsy was more unexpected, while The Kiss was preferred in the separate comparison. Surprise was a reported reaction, not an inferred appetite for novelty.",["study-rousseau-sleeping-gypsy","klimt-kiss"]),
    requiredSignals:["A retained reported-unexpectedness looking appraisal under its original scale.","An actual earlier preference for the exact same artwork set to connect their orders.","A qualified local reversal or recurring direction; otherwise the direct response remains available without a headline."],
    sources:[portrait("lookingAppraisals.responses",{"construct":"reported-unexpectedness"}),portrait("observations",{"module":"looking-appraisals","construct":"reported-unexpectedness"})],
    implementationNote:"The current journey no longer asks this one-off question. Old surprise ratings remain distinct from familiarity grids, new-pair exposure and interpretation maps.",
    limits:["Unexpected is not the same as unfamiliar. No novelty-seeking trait or population rarity follows."]
  },
  {
    id:"favourites-and-ratings",lensId:"revisiting-choices",title:"Favourites & earlier ratings",status:"implemented",availability:"current",
    description:"An explicit, unranked favourites selection can refine what the earlier overall ratings suggested.",
    example:example("Hope was explicitly selected as a favourite while a higher-rated alternative stayed outside that selection. Both original decisions remain visible.",["add-watts-hope","study-leonardo-mona-lisa"]),
    requiredSignals:["A confirmed overall-favourites shortlist with the actual offered identities and its five-choice capacity. Generic keep grids and collection saves do not qualify.","For new paged questions, valid opened-page records. An unvisited page is not a non-selection and cannot revoke an earlier favourite.","A refinement comparison additionally needs captured earlier values on the exact overall-appeal scale, their actual earlier source definitions and a clear difference. Only actually presented unselected alternatives can supply it."],
    sources:[portrait("heroWorks",{"basis":"overall-favourites"}),portrait("closingRefinement.favouriteRefinements",{})],
    implementationNote:"Explicit favourites take priority in the visual selection; their offered order is only display order. They are not ranked among themselves. Without them, comparable overall ratings may supply highest-rated examples; legacy local leaders stay labelled separately.",
    limits:["Not selected as a favourite does not mean disliked. An explicit None does not invent favourites.","A categorical favourite and a continuous rating are different decisions. A difference is not a false answer or proof that taste changed."]
  },
  {
    id:"recognition-and-preference",lensId:"finding-more",title:"Artist & style recognition",status:"implemented",availability:"current",
    description:"Compare actual artist/style matches with independently recorded preference, without treating either as expertise.",
    example:example("Mona Lisa was correctly matched to Leonardo, while The Night Watch received the stronger preference even though its artist match was left unsure.",["study-leonardo-mona-lisa","study-rembrandt-night-watch"]),
    requiredSignals:["Recorded cued artist or movement matches, including Not sure.","Independent preference answers for the same works.","Known-name attribution flags, option sets, presentation order and prior label exposure."],
    userSignals:["Your artist or movement matches, including guesses and uncertainty.","Separate personal responses to the same paintings.","Earlier labels shown in the quiz, so learning stays distinguishable from prior knowledge."],
    userLimits:["A correct answer can be a guess.","Attribution knowledge is separate from liking and does not establish general expertise."],
    sources:[portrait("observations",{module:"recognition-and-taste"})],
    implementationNote:"Matching certainty, correctness and prior label exposure are linked to separate personal responses. Uncertain attribution of liked works and correctly recognised but negatively received works remain provisional observations; earlier quiz feedback is separated from prior knowledge.",
    limits:["Correct matches can be guesses, and earlier games teach labels. Cued recognition is not general expertise, prior familiarity or a motive inferred from preference."]
  }
].map(item=>({...item,...(userCopy[item.id]||{})})));

export const READING_LENSES=PROFILE_READING_LENSES;
export const READING_FAMILIES=PROFILE_READING_CATALOG;
