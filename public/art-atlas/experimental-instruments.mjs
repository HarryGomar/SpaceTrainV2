// Research and product proposals only. Importing this catalogue changes no quiz,
// stored answer, axis definition or profile calculation.
export const EXPERIMENTAL_INSTRUMENT_VERSION=1;
export const REFINEMENT_NAMES=Object.freeze({
  profile:['Taste & attention','Making & materials','Meaning & stories','Choices & returns','Groups & contrasts','Space & presence'],
  preferenceLabel:'Your choice',
  preferenceEndpoints:{left:'Not for me',right:'For me'},
  namingLimit:'These are proposed interface labels, not validated psychological scales. Test their interpretation with visitors before adoption.'
});

export const INSTRUMENT_SOURCES=Object.freeze([
  {id:'carbon-2017',kind:'primary-study',title:'Art Perception in the Museum: How We Spend Time and Space in Art Exhibitions',url:'https://pubmed.ncbi.nlm.nih.gov/28321289/',supports:'Observed visits and returns in a particular Richter exhibition; viewing distance varied with canvas size.',limit:'Museum observation does not validate a browser duration score or imply that returning means greater preference.'},
  {id:'song-2021',kind:'primary-study',title:'Familiarity and Novelty in Aesthetic Preference',url:'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.694927/full',supports:'Familiarity/novelty preference varied with painting content, complexity and art experience.',limit:'No universal familiarity benefit or novelty-seeking trait follows from a shortlist.'},
  {id:'hawley-dolan-2011',kind:'primary-study',title:'Seeing the Mind Behind the Art',url:'https://journals.sagepub.com/doi/10.1177/0956797611400915',supports:'Collected personal preference and better-art judgments separately in paired abstract images.',limit:'This does not validate an objective skill axis or the exact wording proposed here.'},
  {id:'kruger-2004',kind:'primary-study',title:'The effort heuristic',url:'https://www.sciencedirect.com/science/article/pii/S0022103103000659',supports:'Manipulated information about production effort and measured evaluations of artistic objects.',limit:'Do not invent production times or infer actual skill from perceived effort.'},
  {id:'ziano-2023',kind:'primary-replication',title:'The Effort Heuristic Revisited',url:'https://online.ucpress.edu/collabra/article/9/1/87489/197632/The-Effort-Heuristic-Revisited-Mixed-Results-for',supports:'Preregistered replications produced mixed results; the painting effect was supported but smaller.',limit:'Effort is a possible influence to test, not an established explanation for this visitor.'},
  {id:'jakesch-2009',kind:'primary-study',title:'Finding meaning in art: Preferred levels of ambiguity in art appreciation',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC3210939/',supports:'Manipulated matching/nonmatching verbal information and compared appreciation and interest.',limit:'The manipulation is different from a self-reported clarity/openness grid.'},
  {id:'muth-2013',kind:'primary-study',title:'The Aesthetic Aha: On the pleasure of having insights into Gestalt',url:'https://www.experimental-psychology.de/ccc/docs/pubs/MuthCarbon2013.pdf',supports:'Perceptual insights in difficult two-tone images predicted subsequent gains in preference.',limit:'Mooney-face insight is not equivalent to understanding a painting, resolving a symbol or learning a story.'},
  {id:'knoos-2021',kind:'primary-study',title:'Aesthetic Experience of Representational Art',url:'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.613391/full',supports:'Naming historical inaccuracies lowered preference; explanatory information compensated for that effect in the studied paintings.',limit:'Information content matters. A story is not guaranteed to improve a response.'},
  {id:'kriegeskorte-2012',kind:'primary-method',title:'Inverse MDS: Inferring Dissimilarity Structure from Multiple Item Arrangements',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC3404552/',supports:'Multiple overlapping arrangements can collect contextual perceptual-similarity information efficiently.',limit:'A wall, story sequence or bridge choice does not automatically supply metric similarity or a validated profile.'},
  {id:'schindler-2017',kind:'primary-scale-development',title:'Measuring aesthetic emotions: A review of the literature and a new assessment tool',url:'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0178899',supports:'Developed AESTHEMOS with 21 two-item subscales across a differentiated set of aesthetic emotions.',limit:'A renamed single slider is not a validated AESTHEMOS subscale. Feelings evoked in the viewer differ from feelings depicted in the painting.'},
  {id:'carbon-2020',kind:'primary-study',title:'Ecological Art Experience',url:'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2020.00800/full',supports:'Studied large projected paintings with assigned and self-chosen viewing distances.',limit:'A browser image and a size label cannot reproduce physical scale, distance or museum presence.'},
  {id:'nummenmaa-2023',kind:'primary-study',title:'Bodily feelings and aesthetic experience of art',url:'https://www.utupub.fi/bitstream/handle/10024/186254/Bodily%20feelings%20and%20aesthetic%20experience%20of%20art.pdf?sequence=1',supports:'Related reported bodily maps, art-evoked feelings, visual annotations and eye movements across experiments.',limit:'A body map is a report of sensation. It is not measured physiology, diagnosis or evidence of an unconscious motive.'},
  {id:'artemis-2021',kind:'primary-dataset',title:'ArtEmis: Affective Language for Visual Art',url:'https://openaccess.thecvf.com/content/CVPR2021/html/Achlioptas_ArtEmis_Affective_Language_for_Visual_Art_CVPR_2021_paper.html',supports:'Pairs artwork emotion annotations with grounded verbal explanations.',limit:'Annotators describe their own reactions; an aggregate label does not determine the current visitor\'s emotion.'},
  {id:'wikiart-2018',kind:'primary-dataset',title:'WikiArt Emotions',url:'https://aclanthology.org/L18-1197/',supports:'Crowdsourced artwork-emotion annotations, including title-related presentation conditions.',limit:'Use for stimulus and wording exploration, not as a normative answer key for an individual.'},
  {id:'pcnar-2025',kind:'primary-dataset',title:'Penn Center for Neuroaesthetics Artwork Repository',url:'https://neuroaesthetics.med.upenn.edu/assets/user-content/documents/publications/pecnar.pdf',dataUrl:'https://github.com/vstradag/TRT',supports:'320 works including underrepresented cultural categories, normed by 814 participants, with specific aesthetic impacts and expert context descriptions.',limit:'Group norms can guide diverse stimulus sampling; they are not representative population scores for this app\'s visitors. Image permissions need separate verification.'},
  {id:'ennahli-2026',kind:'primary-dataset',title:'Subjective norms of paintings: Integrating perceptual, cognitive, and emotional dimensions',url:'https://link.springer.com/article/10.3758/s13428-026-03107-9',supports:'144 paintings rated by 361 European Portuguese native speakers on 11 dimensions, with qualitative descriptions.',limit:'Useful for stimulus contrasts and qualitative prompts. Language/sample-specific norms do not validate universal profile labels.'}
]);

export const EXPERIMENTAL_INSTRUMENTS=Object.freeze([
  {
    id:'familiarity-shortlist-grid-v1',title:'A familiar face, a fresh choice',priority:'next',format:'multi-select-grid',status:'proposal',
    prompts:[{phase:'familiarity',text:'Before today, which of these had you seen?'},{phase:'shortlist',text:'Which would you keep? Choose up to three.'}],
    controls:{familiarity:['Select any','None of these','Not sure'],shortlist:['Select up to three','None of these'],confirmRequired:true},
    constructs:['reported-prior-familiarity','capped-contextual-selection'],
    protocol:'Show twelve equal-prominence works without names. Confirm familiarity, separate the next phase with other works and tasks, then reshuffle the same set for the shortlist.',
    reading:{title:'Recognition and choice can separate',example:'Two of the three paintings you kept were ones you had not seen before today.',requires:['Exact offered IDs, selected IDs, explicit confirmation, capacity and grid order.','The complete earlier familiarity response for the matched set.'],followUp:'Compare one familiar and one unfamiliar work with roughly matched subject and presentation.'},
    support:'Familiarity is an established measured variable. The twelve-work capped grid and resulting reading are product hypotheses.',
    sourceIds:['song-2021','ennahli-2026'],
    limits:['The cap censors choice: unselected is not disliked or equally ranked.','Prior familiarity is not artist knowledge or expertise. Showing a work here does not make it familiar before today.','Fame, subject, source quality, selection capacity and repeated exposure can explain a familiar/unfamiliar difference.']
  },
  {
    id:'first-return-choice-v1',title:'First choice, considered choice',priority:'next',format:'choice-return',status:'proposal',
    prompts:[{phase:'first',text:'Choose the painting you prefer.'},{phase:'return',text:'Look at both again. Choose the painting you prefer.'}],
    controls:{choices:['Painting A','No preference','Painting B'],optionalStrength:{left:'A, clearly',middle:'No preference',right:'B, clearly'}},
    constructs:['initial-pair-preference','later-pair-preference'],
    protocol:'Capture an unforced initial choice. Later offer the same full images with the same question, equal inspection opportunity and reversed position. Record elapsed exposure; do not impose a speed test.',
    reading:{title:'An early choice changed after another look',example:'You first chose Mount Fuji; after revisiting the same pair, you chose Shen Zhou. The original order stayed intact for two other pairs.',requires:['Exact repeated pair and identical preference wording.','Both confirmed answers, exposure order and available image resolution.'],followUp:'Repeat with a new pair and a different set of paintings before describing a broader return pattern.'},
    support:'Museum returns and exposure effects motivate the comparison. The browser protocol is not a validated sustained-preference scale.',
    sourceIds:['carbon-2017','song-2021'],
    exampleWorkIds:['hokusai-mount-fuji','shen-clouds'],
    limits:['Inspection, memory, elapsed time and position all change. A switch cannot be attributed to deeper understanding.','Returning is not necessarily stronger preference; longer time is not automatically attention.']
  },
  {
    id:'edit-counterfactual-v1',title:'The difficult edit',priority:'next',format:'wall-edit',status:'existing-interaction-extension',
    prompts:[{phase:'edit',text:'Remove one painting. Keep the other three together.'},{phase:'compare',text:'Which three-work wall works better?'}],
    controls:{edit:['Drag one to storage','Undo'],compare:['Wall A','No preference','Wall B']},
    constructs:['contextual-removal','counterfactual-wall-choice'],
    protocol:'Keep layout, image size and kept-work count equal. The alternative restores the removed work and removes one other. Link only a real earlier preference for the exact pair.',
    reading:{title:'A preferred work can lose its place in a group',example:'Velasco had the higher individual rating, but the wall you chose kept Cézanne after both versions were available.',requires:['Presented quartet, initial removal and explicit final wall choice.','A captured earlier pair preference when making the individual-versus-group comparison.'],followUp:'Offer a new wall with one shared work and different companions.'},
    support:'The task gives observable contextual choices. Its profile interpretation is a product hypothesis, not validated by similarity-arrangement research.',
    sourceIds:['kriegeskorte-2012'],exampleWorkIds:['velasco-valley-mexico','cezanne-mountain'],
    limits:['Omission is not dislike. Redundancy, available space and the imposed wall can contribute.','One edit does not identify a stable curatorial style.']
  },
  {
    id:'group-bridge-v1',title:'Find the connection',priority:'next',format:'group-and-bridge',status:'proposal',
    prompts:[{phase:'group',text:'Put the paintings that belong together near each other.'},{phase:'bridge',text:'Add one painting that connects these two groups.'},{phase:'contrast',text:'Now add one that creates a deliberate contrast.'}],
    controls:{group:['Free placement'],bridge:['Choose one','No good connection'],contrast:['Choose one','No useful contrast']},
    constructs:['reported-similarity-arrangement','contextual-bridge-choice','deliberate-contrast-choice'],
    protocol:'Use overlapping subsets, not the same full tray. Freeze anchors and compare the chosen bridge with unchosen alternatives; keep contrast decisions separate.',
    reading:{title:'Your groups and your bridges use different connections',example:'Similar palettes described the close groups, while your chosen bridge connected two different palettes through a shared scene.',requires:['Actual group membership or intentional table distances.','Frozen anchors, candidate alternatives, bridge/contrast instructions and known descriptors.'],followUp:'Keep the anchor relationship and change candidate works, including a colour-matched but scene-mismatched option.'},
    support:'Overlapping arrangement methods are supported for perceptual dissimilarity. Bridge/contrast inference is a product extension.',
    sourceIds:['kriegeskorte-2012'],
    limits:['Do not infer a metric from automatic wall spacing or force hidden axes on a free arrangement.','A matched descriptor is one possible description, not the reason proved to guide the user.']
  },
  {
    id:'story-choice-v2',title:'What the story changes',priority:'next',format:'before-after-note',status:'existing-interaction-extension',
    prompts:[{phase:'before',text:'How does this painting sit with you?'},{phase:'note',text:'Read the story, then look again.'},{phase:'after',text:'How does this painting sit with you now?'}],
    axes:[{id:'personal-appeal',label:'Your response',left:'Not for me',right:'For me'}],
    controls:{scale:['Not for me','Mostly not for me','In between','Mostly for me','For me']},
    constructs:['appeal-before-context','appeal-after-context'],
    protocol:'Capture the same scale before and after a short sourced interpretive note. Preserve note version, whether it was already known and whether the work had been seen.',
    reading:{title:'A story changed one response, not every response',example:'The Ambassadors moved up one step after its skull was explained; a note about another work left your response unchanged.',requires:['Both explicit ratings, exact note identity, storySeen and workId.','More than one story comparison before describing a recurring context pattern.'],followUp:'Use another work with a making note rather than a symbolic explanation; do not assume both notes have the same effect.'},
    support:'Experiments show that the content and explanation in supplementary information can matter. The short product note needs its own evaluation.',
    sourceIds:['knoos-2021','jakesch-2009'],exampleWorkIds:['holbein-ambassadors'],
    limits:['Without a control condition, reading, repetition, time and prompt influence cannot be separated.','Different stories can lower, raise or leave a rating unchanged.']
  },
  {
    id:'achievement-appeal-v1',title:'Admiration and personal taste',priority:'next',format:'two-axis-placement',status:'proposal',
    prompts:[{phase:'place',text:'Separate your taste from what you admire in the making.'}],
    axes:[{id:'personal-appeal',label:'For you',left:'Not for me',right:'For me'},{id:'perceived-achievement',label:'The making',bottom:'Little to admire in the making',top:'A lot to admire in the making'}],
    constructs:['personal-appeal','perceived-achievement'],
    protocol:'Place one painting at a time, with a small reference group. Do not name an objective skill scale or tell the user that time spent equals quality.',
    reading:{title:'Admiration is not always the deciding factor',example:'You admired the making of The Ambassadors more, while Violette was more for you. That split recurred in another set.',requires:['Both independent coordinates for the exact paintings.','An earlier unconditional choice or explicit appeal coordinate.','Several distinct works before describing a repeated split.'],followUp:'Compare another technically intricate and another economical work without revealing artist or production information.'},
    support:'Preference and quality judgments have been measured separately. This exact achievement/appeal grid is unvalidated; effort findings include mixed replications.',
    sourceIds:['hawley-dolan-2011','kruger-2004','ziano-2023'],exampleWorkIds:['holbein-ambassadors','redon-violette'],
    limits:['Perceived achievement is not actual technical difficulty, effort, expertise or artistic value.','A lower achievement rating can reflect reproduction quality or an unfamiliar method.']
  },
  {
    id:'literal-clarity-openness-v1',title:'A clear scene, an open meaning',priority:'next',format:'two-axis-placement',status:'proposal',
    prompts:[{phase:'place',text:'Separate what is happening from what it might mean.'}],
    axes:[{id:'literal-clarity',label:'What is happening',left:'Unclear',right:'Clear'},{id:'interpretive-openness',label:'Possible meanings',bottom:'One clear reading',top:'Several possible readings'}],
    constructs:['reported-scene-clarity','reported-interpretive-openness'],
    protocol:'Use scenes with clear depicted actions and scenes with uncertain actions. Ask about personal reading, without a correctness test or a symbolic answer key.',
    reading:{title:'Open meanings can appeal without an obscure scene',example:'Your preferred scenes were easy to follow but left several readings open. Harder-to-follow scenes did not receive the same preference.',requires:['Clarity and openness coordinates.','Independent preferences for the same works.','Contrasting cases rather than only famous symbolic paintings.'],followUp:'Offer a clear scene with little ambiguity and an obscure scene with an obvious theme.'},
    support:'Ambiguity can affect appreciation under specific experimental manipulations. This grid distinguishes two proposed reports; it is not a validated ambiguity scale.',
    sourceIds:['jakesch-2009','ennahli-2026'],exampleWorkIds:['matejko-stanczyk','velazquez-las-meninas'],
    limits:['Clear depiction does not imply one meaning; multiple meanings do not imply confusion.','Do not infer openness to experience, intelligence or tolerance for uncertainty.']
  },
  {
    id:'surprise-and-choice-v1',title:'Unexpected, but for you?',priority:'later',format:'single-response-with-matched-choice',status:'proposal',
    prompts:[{phase:'surprise',text:'How unexpected is this painting to you?'}],
    axes:[{id:'reported-unexpectedness',label:'Unexpectedness',left:'As expected',right:'Very unexpected'}],
    constructs:['reported-unexpectedness'],
    protocol:'Collect an ordinary choice first, then the unexpectedness report on the same work. Offer Already seen as a separate fact, not the opposite endpoint.',
    reading:{title:'Surprise and preference do not always travel together',example:'The most unexpected work was not selected, while another unexpected work became a clear preference.',requires:['An independent preference response.','Unexpectedness and prior familiarity reported separately.','At least one unexpected preferred and one unexpected unpreferred work for the contrast.'],followUp:'Compare a familiar work with surprising content against an unfamiliar work with an expected scene.'},
    support:'Aesthetic-emotion research distinguishes surprise from other reactions. The proposed one-item report is not a validated subscale.',
    sourceIds:['schindler-2017','artemis-2021'],
    limits:['Unexpected can refer to subject, style, material or context. An optional grounded detail can distinguish those meanings.','No novelty-seeking trait or reward mechanism is inferred.']
  },
  {
    id:'detail-reinterpretation-v1',title:'A detail changes the picture',priority:'next',format:'detail-mark-and-return',status:'proposal',
    prompts:[{phase:'mark',text:'Mark a detail that changes how you read the painting.'},{phase:'return',text:'Now choose between these paintings again.'}],
    controls:{mark:['Place one point','Nothing changed','Already noticed'],detailType:['A figure or gesture','An object','Paint or line','Colour or light','Something else']},
    constructs:['reported-reinterpretation','grounded-detail-selection','post-inspection-preference'],
    protocol:'Keep the full painting visible beside the detail. Capture the initial preference, the marked region, and the later identical preference prompt. Never manufacture a symbolic meaning.',
    reading:{title:'New details changed some choices and left others intact',example:'Noticing the skull changed your reading of The Ambassadors and its later position; another newly noticed detail changed the reading without changing the preference.',requires:['Before/after preference and exact work bindings.','User-marked detail, already-noticed response and note/cue exposure.'],followUp:'Use an uncued new painting; distinguish finding a detail from being taught where to look.'},
    support:'Perceptual insight and grounded explanations motivate the task. Narrative or symbolic reinterpretation in paintings is a product extension of that evidence.',
    sourceIds:['muth-2013','artemis-2021'],exampleWorkIds:['holbein-ambassadors'],
    limits:['A Mooney-face insight study does not establish that a symbolic reveal works the same way.','Zoom, resolution, repetition and instruction may contribute to a later choice.']
  },
  {
    id:'material-detail-v1',title:'Surface and whole',priority:'later',format:'whole-detail-comparison',status:'proposal',
    prompts:[{phase:'inspect',text:'Choose one detail to see at full resolution.'},{phase:'return',text:'Choose the painting you prefer.'}],
    controls:{inspect:['One of four equal-sized detail windows','Keep the whole view']},
    constructs:['inspection-selection','preference-after-detail-access'],
    protocol:'Offer equally sharp, equally sized windows covering marks, texture and depicted detail. Record which was opened without treating viewing time as eye tracking. Repeat the same preference question.',
    reading:{title:'Some preferences strengthened when the surface became visible',example:'A painting moved ahead after a paint-surface detail was opened, while a narrative detail on another work changed little.',requires:['Initial and later identical preference prompts.','Actual detail coordinates, resolution and access records.','Control works with no extra detail or different detail types.'],followUp:'Offer the same size/resolution upgrade without highlighting a particular material feature.'},
    support:'Grounded visual explanations support recording what a visitor points to. This inspection-to-preference protocol remains speculative.',
    sourceIds:['artemis-2021','kruger-2004','ziano-2023'],
    limits:['Opening a detail is an inspection choice, not proof of material interest or a cause of preference.','Equal crop size does not equal equal information; frame edges and sharpness can bias the choice.']
  },
  {
    id:'size-reveal-v1',title:'The scale you did not expect',priority:'later',format:'dimension-reveal-and-choice',status:'proposal',
    prompts:[{phase:'before',text:'Choose the painting you prefer.'},{phase:'reveal',text:'See the recorded dimensions.'},{phase:'after',text:'With that scale in mind, choose again.'}],
    controls:{reveal:['Verified size beside a consistent human silhouette','Show dimensions in centimetres']},
    constructs:['preference-before-size-information','preference-after-size-information'],
    protocol:'Use institution-verified dimensions and distinguish the image from a physical-scale simulation. Keep the reproduced image size equal across the two preference questions.',
    reading:{title:'Knowing its scale changed the choice',example:'A small print stayed preferred on screen, while a large painting gained after its recorded dimensions were shown.',requires:['Verified physical dimensions, source URL and reveal version.','Same prompt and image presentation before and after size information.','Prior familiarity and whether the real size was already known.'],followUp:'Repeat with a small work whose detail is easy to miss and a large work with a simple composition.'},
    support:'Real and projected size/distance have been studied. A dimension-reveal comparison measures information about scale, not the physical experience itself.',
    sourceIds:['carbon-2017','carbon-2020'],
    limits:['Screen size, device, posture and visual angle differ. A silhouette cannot recreate standing before the work.','Do not name an embodied-presence or awe trait from this task.']
  }
]);

export const OPTIONAL_RESEARCH_BRANCH=Object.freeze({
  id:'reported-body-map-v1',title:'Optional physical response',defaultJourney:false,
  prompt:'Did you notice a physical sensation while looking?',
  endpoints:{left:'None',right:'Strong sensation'},
  interaction:'Only after an affirmative response, offer an optional body location and plain sensation label. Keep Skip and No sensation equally visible.',
  sourceIds:['nummenmaa-2023'],
  construct:'Reported bodily sensation during this viewing',
  limit:'No physiological, emotional-diagnosis or personality inference. This is an advanced research option, not a recommended default response map.'
});

export const EXPERIMENTAL_METHOD_LIMITS=Object.freeze([
  'These entries are proposals or extensions. Their inclusion does not register a live axis, change stored definitions or implement a profile reading.',
  'Keep new instrument IDs and captured endpoint definitions. Never rename an old coordinate and reinterpret its saved answers.',
  'Preference, shortlist membership, admiration, familiarity, perceived meaning and felt intensity remain distinct records.',
  'Use overlap to compare exact works across tasks, while giving most new rounds different paintings. A purposeful return must state its comparison unit.',
  'A profile sentence requires a linked contrast, an exception and an explanation left open. Do not merely repeat an endpoint as a discovery.',
  'Select stimuli using diverse source cultures and known descriptors. Norms and model-generated labels guide sampling, not a visitor\'s correct response.',
  'Dataset availability does not imply permission to reuse every artwork image. Continue using verified institutional image sources.'
]);
