// A reviewable design proposal. This file does not generate, refresh or mutate
// any live journey, saved answer, artwork annotation or prediction.
export const STUDY_DESIGN_VERSION='first-150-proposal-v1';
export const FIRST_BLOCK_MAP_PANELS=Object.freeze([1,3,5,6,8,9,11,12,14,15]);
export const FIRST_BLOCK_PANEL_SHAPES=Object.freeze(Array.from({length:18},(_,index)=>({panel:index+1,size:FIRST_BLOCK_MAP_PANELS.includes(index+1)?4:3})));

export const STUDY_BLOCKS=Object.freeze([
  {
    id:'benchmark',range:[1,50],title:'Establish a benchmark',status:'proposal',
    purpose:'Sample broad taste and separate personal appeal, admiration, interpretation and return intention.',
    allocation:{mainPreferencePanels:18,additionalPreferenceChecks:2,responseMaps:10,imageGrids:6,lookingAppraisals:6,curatorialTasks:4,labelGames:2,contextComparisons:1,agreementQuestions:1},
    mainPanelRoles:{discovery:18},mapAllocation:{achievement:4,reading:3,returnResponse:3},gridAllocation:{familiarity:2,shortlist:4},
    artworkTargets:{newToPreference:64,cumulativeRatedWorks:64,landmarks:38,supportingWorks:26},
    firstPanelIds:['study-leonardo-mona-lisa','study-hokusai-great-wave','study-vermeer-pearl','van-gogh-starry-night'],
    selectionRules:['Ten map-linked quartets and eight triads.','Usually two landmark works at most per panel; the opening quartet is the four-icon exception.','Mix crossed visual contrasts with broad, less targeted comparisons.','Record origin, period, tradition, artist, medium and fame imbalance rather than naming one as the cause.'],
    additionalCheck:'Proposed round47 exact return replaces the unmatched shortlistE and preserves round49 bridge. Return only to a non-opening quartet whose four works each have at least eight intervening planned presentations; avoid the immediately preceding sorting anchors and recent maps. Preserve the full original prompt and scale, reverse work order and record repeatOf. If no quartet is eligible, keep shortlistE. A relative high/low/middle claim needs the actual source answer, never a planning guess.',
    reserveGate:'The additional bridge should use already-rated main works if the64new-rating target is to stay exact. Otherwise report added preference works and update reserve counts explicitly.',
    curatorialBriefs:['Sort eight shared works by the connections the viewer sees.','Edit one quartet, then compare equal-sized three-work walls.','Arrange a broader museum collection with an open brief.','Return to the same sorting works with changed tray order.'],
    profileCheckpoint:'A provisional visual pattern, its exceptions, and exact matched-task contrasts. No requirement to finish a later block.'
  },
  {
    id:'separate-explanations',range:[51,100],title:'Separate explanations',status:'proposal',
    purpose:'Compare alternatives that distinguish a visual feature from artist, subject, period, familiarity and regional origin.',
    allocation:{mainPreferencePanels:18,additionalPreferencePairs:9,responseMaps:8,imageGrids:6,lookingAppraisals:2,curatorialTasks:3,labelGames:2,contextComparisons:2,agreementQuestions:0},
    mainPanelRoles:{exploration:11,repeat:3,recontextualization:2,challenge:2},mapAllocation:{achievement:3,reading:3,returnResponse:2},gridAllocation:{familiarity:2,shortlist:4},
    artworkTargets:{newToPreference:18,cumulativeRatedWorks:82,landmarks:6,supportingWorks:12},
    additionalPairBriefs:[{count:2,purpose:'Same artist or close treatment, different subject.'},{count:2,purpose:'Similar subject, different treatment or compositional density.'},{count:2,purpose:'Similar pictorial relation across different origins, with residual differences retained.'},{count:2,purpose:'A previously rated pair inside changed company or as a direct pair.'},{count:1,purpose:'A delayed exact repeat of a previously direct near-tied pair.'}],
    selectionRules:['Place the eight new maps on eligible discovery panels, not on repeats or checks that the current matched-task reading excludes.','Preserve genuine exact-repeat prompt snapshots; a pair removed from a quartet is not an exact full-set repeat.','Test relative high, low and middle works with new alternatives. Do not rename them absolute likes or dislikes.','Use participant-reported familiarity, not fame tier, when comparing recognition with selection.'],
    curatorialBriefs:['Sort a shared subset without category labels.','Arrange a museum set deliberately crossed by colour, date and tradition.','Edit an individually preferred quartet and compare the counterfactual wall.'],
    contextBriefs:['A sourced interpretive note.','A sourced making or material note on another work.'],
    profileCheckpoint:'Which explanations still fit after more comparable contrasts, which fail, and which remain entangled.'
  },
  {
    id:'challenge-and-transfer',range:[101,150],title:'Challenge and transfer',status:'proposal',
    purpose:'Freeze promising explanations, then search for counterexamples and transfer across underrepresented periods and origins.',
    allocation:{mainPreferencePanels:18,additionalPreferencePairs:11,responseMaps:6,imageGrids:5,lookingAppraisals:3,curatorialTasks:3,labelGames:1,contextComparisons:3,agreementQuestions:0},
    mainPanelRoles:{exploration:11,repeat:2,recontextualization:1,challenge:4},mapAllocation:{achievement:2,reading:2,returnResponse:2},gridAllocation:{familiarity:1,shortlist:4},
    artworkTargets:{newToPreference:17,cumulativeRatedWorks:99,landmarks:6,supportingWorks:11},
    additionalPairBriefs:[{count:4,purpose:'Transfer a candidate contrast to works outside the source period or origin.'},{count:2,purpose:'Repeat a pair with different companions, retaining the changed comparison set.'},{count:3,purpose:'Delayed exact repeats of clear and near-tied direct pairs.'},{count:2,purpose:'Similar values on the candidate feature but different subjects or other features, testing model incompleteness.'}],
    selectionRules:['Freeze the predicted winner, feature values, training answers and source sets before each prospective pair is answered.','Use new comparisons, not necessarily unseen paintings. Unknown co-presentation suppresses the prospective claim.','Choose works likely to challenge the explanation as well as works likely to follow it.','Keep an exploration floor so the profile cannot collapse into a filter bubble.','If no eligible challenge is available, use a coverage comparison and record why; do not manufacture a prediction.'],
    curatorialBriefs:['Repeat a comparable sorting subset and examine retained and changed pairs.','Build a transfer museum with known descriptors deliberately crossed.','Test one preferred work among new companions, then compare the equal-sized alternative.'],
    contextBriefs:['A new interpretive note.','A new making note.','A previously read note, explicitly marked as a revisit rather than new information.'],
    profileCheckpoint:'A profile with named evidence, surviving contrasts, counterexamples and unresolved explanations. No accuracy or trait score.'
  }
]);

export const RATING_RESERVE_PROPOSAL=Object.freeze({
  unit:'not-yet-given-an-ordinary-preference-response',
  globalUnseenClaim:false,
  explanation:'The public atlas, earlier grids and museum trays can expose a reserved work. Reserve status alone does not establish that it is unseen or unfamiliar.',
  batch2:['study-rembrandt-night-watch','study-waterhouse-shalott','study-van-gogh-self-portrait','study-fan-kuan-travelers','study-marc-blue-horse','study-manet-luncheon-grass'],
  batch3:['study-david-marat','study-monet-rouen-sunlight','study-malevich-black-square','study-botticelli-birth-venus','study-gentileschi-judith','study-wood-american-gothic'],
  supportingReserveTargets:{batch2:12,batch3:11},
  status:'Candidate reserve IDs supplied by the artwork coverage audit; final curated panel bindings must be validated against actual eligibility and prior answers.'
});

export const DIAGNOSTIC_COMPARISONS=Object.freeze([
  {
    id:'figures-by-conflict',title:'Figures and action',preferredFormat:'quartet',
    workIds:['monet-water-lilies','rousseau-tiger-buffalo','almeida-junior-saudade','opening-cma-92937'],
    proposedCells:['No human focus / quieter scene','No human focus / physical conflict','Human focus / quieter scene','Human focus / physical conflict'],
    question:'How much do you prefer each painting?',followUpAxis:'returnResponse',
    separates:'A rule about figures from a rule about visual or depicted activity.',
    sharedGround:'The coverage audit identifies all four as oil paintings on textile supports.',
    residualConfounds:['Artists, eras, palettes, countries, subject and reproduction still differ.','Physical conflict is a curatorial description, not an experimentally isolated factor.'],
    supportedReading:'Ordinary feature balance plus an exact-set tension/return comparison when valid.',status:'approximate-curatorial-cross'
  },
  {
    id:'figures-by-density',title:'Figures and density',preferredFormat:'quartet',
    workIds:['mondrian-composition','study-kandinsky-composition-eight','morisot-reading','herran-la-ofrenda'],
    proposedCells:['Nonfigurative / sparse','Nonfigurative / dense','Figural / sparser','Figural / dense'],
    question:'How much do you prefer each painting?',followUpAxis:'achievement',
    separates:'Human presence from compositional density and perceived achievement.',
    sharedGround:'The coverage audit identifies all four as oil-on-canvas works.',
    residualConfounds:['Colour, artist, time, cultural context and depicted events still vary.','The cells are approximate editorial groupings, not matched laboratory stimuli.'],
    supportedReading:'Preference associations and an independent admiration comparison, with all competing features retained.',status:'approximate-curatorial-cross'
  },
  {
    id:'artist-by-subject',title:'An artist, different subjects',preferredFormat:'direct-pair',
    workIds:['study-van-gogh-self-portrait','study-van-gogh-sunflowers'],
    question:'Which painting do you prefer?',
    separates:'A proposed preference for figures from a route to work by one artist.',
    sharedGround:'Same named artist and broadly related treatment; creator labels hidden by default.',
    residualConfounds:['Fame, colour, surface treatment, mood and object type can differ.','The viewer may recognise the artist or work without labels.'],
    supportedReading:'A descriptive within-artist comparison; it does not isolate the artist or subject as a cause.',status:'diagnostic-comparison'
  },
  {
    id:'origin-by-subject',title:'Subject across origins',preferredFormat:'quartet',
    workIds:['velasco-valley-mexico','herran-la-ofrenda','shen-clouds','hua-yan-children-garden'],
    proposedCells:['Mexican landscape emphasis','Mexican figure/event emphasis','Chinese landscape emphasis','Chinese figure/event emphasis'],
    question:'How much do you prefer each painting?',followUpAxis:'reading',
    separates:'A broad origin label from repeated landscape/figure choices.',
    sharedGround:'Two subject contrasts within each of two production-context strata.',
    residualConfounds:['Dates, mediums, traditions, palettes and particular subjects are not equated.','A country or regional stratum is a sampling label, not a unified style.'],
    supportedReading:'Potential transfer of a visual or subject relationship, rather than a country-preference score.',status:'approximate-curatorial-cross'
  },
  {
    id:'monochrome-print-transfer',title:'Prints across traditions',preferredFormat:'direct-pair',
    workIds:['study-posada-catrina','onchi-mother-child'],
    question:'Which painting or print do you prefer?',
    separates:'A response to restrained colour from a response to a single tradition.',
    sharedGround:'Monochrome print examples with prominent figural content.',
    residualConfounds:['Technique, satire, family subject, composition, era and familiarity still differ.'],
    supportedReading:'An exploratory comparison that can guide a later more comparable set, not a national or cultural trait.',status:'diagnostic-comparison'
  }
]);

export const STUDY_DESIGN_GATES=Object.freeze([
  'This proposal is not the live scheduler. Later-block format budgets require phase-aware dispatch instead of looping the current first fifty.',
  'A three- or four-work placement gives dependent pair observations, not three or six independent replications.',
  'The current feature-association threshold requires two distinct supporting sets and four different works; prospective checks require stricter frozen evidence.',
  'The current scene and return readings need a valid exact-set ordinary preference when making a preference comparison. Do not substitute grid appeal, shortlist membership or an excluded probe.',
  'Map-linked discovery quartets should be allocated deliberately; repeating a preference set does not create a new discovery set.',
  'Keep original endpoint definitions and prompts. A new instruction or subset is not an exact repeat of a larger earlier question.',
  'Store work exposure, pair co-presentation, names/notes revealed and unknown exposure separately from whether a preference was answered.',
  'The numerical allocations and matching rules are design heuristics. No optimal information gain, calibrated confidence or validated personality interpretation is claimed.'
]);

export const STUDY_DESIGN_SOURCES=Object.freeze([
  {id:'toubia-2004',url:'https://stuff.mit.edu/~hauser/Papers/Toubia_Hauser_Simester%20Polyhedral%20Adaptive%20CBC%20JMR.pdf',supports:'Adaptive question design can be evaluated against fixed and random alternatives in a specified preference model.',limit:'The product profiles and utility assumptions differ from historical artworks; this app does not implement or inherit that optimality result.'},
  {id:'guo-sanner-2010',url:'https://proceedings.mlr.press/v9/guo10b.html',supports:'Multiattribute pairwise query selection can account for noise, cost and model-specific value of information.',limit:'The Bayesian utility representation and update rule are not our seven hand-reviewed artwork descriptors.'},
  {id:'jamieson-nowak-2011',url:'https://proceedings.neurips.cc/paper/2011/hash/6c14da109e294d1e8155be8aa4b1ce8e-Abstract.html',supports:'Adaptive ranking can reduce queries under a specified low-dimensional geometry.',limit:'Its reference-point distance assumptions and ranking guarantees have not been established for this art task.'},
  {id:'iigaya-2021',url:'https://pubmed.ncbi.nlm.nih.gov/34017097/',supports:'Preference prediction can use mixtures of low- and high-level image features.',limit:'This does not validate our feature annotations, thresholds or causal readings.'},
  {id:'song-2021',url:'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.694927/full',supports:'Familiarity/novelty preference depends on artwork content, complexity and art experience.',limit:'Fame tier and recognition checkboxes cannot be treated as a universal familiarity effect.'},
  {id:'cutting-2003',url:'https://link.springer.com/content/pdf/10.3758/BF03196493.pdf',supports:'Cultural and experimental exposure can relate to preference in a particular Impressionist corpus.',limit:'Recognition is not a complete exposure history; the historical corpus does not provide global art norms.'},
  {id:'kriegeskorte-mur-2012',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC3404552/',supports:'Overlapping arrangements provide contextual perceptual-dissimilarity evidence.',limit:'A museum room and free sorting remain different instruments; wall geometry is not automatically preference or metric similarity.'},
  {id:'lapis-2025',url:'https://openaccess.thecvf.com/content/CVPR2025W/CVEU/html/Maerten_LAPIS_A_novel_dataset_for_personalized_image_aesthetic_assessment_CVPRW_2025_paper.html',supports:'Personalized artwork-aesthetic data and model failures provide a relevant benchmark direction.',limit:'Dataset/model results do not supply a validated individual profile or license to infer personal attributes from paintings.'}
]);
