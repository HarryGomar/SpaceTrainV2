// Editorial families for exploring actual reading models, not personality types.
export const DEFAULT_TASTE_FAMILY='stories-within-scenes';
export const TASTE_FAMILY_RESEARCH=Object.freeze([
  {title:'Leder et al. · Aesthetic appreciation and judgments',url:'https://bpspsychub.onlinelibrary.wiley.com/doi/10.1348/0007126042369811',basis:'A theoretical model separating perceptual analysis, interpretation, evaluation and context.'},
  {title:'Iigaya et al. · Visual features and art preference',url:'https://www.nature.com/articles/s41562-021-01124-6',basis:'An empirical feature-based preference model; it does not validate the editorial family names used here.'}
]);
const source=(qualityKey,path)=>({module:'taste-patterns',file:'public/art-atlas/taste-patterns.mjs',export:'buildTastePatterns',resultPath:path,match:{qualityKey}});
const signals=['A recurring direction across at least three different painting groups and three artists.','Reviewed examples of the visible quality, including paintings without it.','The preferences that support the connection and those that challenge it.','Favourites can show a shared quality without ranking the selected paintings.'];
const technical=[
  'Source-bound artwork-attributes-v1 reviews with explicit present/absent/unknown status; missing or mismatched reviews are unknown.',
  'A qualified within-set direction needs three distinct discovery sets, six disjoint paintings and three preferred-work artists. Tentative and conflicting results keep their actual status.',
  'Across-set high/low associations use only the exact overall-appeal instrument with the current evidence and coverage gates. Legacy relative positions remain within their original sets.',
  'An explicit-favourites connection is descriptive and unranked. Its offered/rated baseline, selected exceptions and lower-rated presences remain visible; it is not three independent replications.'
];
function family({id,title,description,qualityKeys,exampleText,exampleClaims,limits}){
  return {id,lensId:'visual-patterns',title,description,status:'implemented',availability:'current',attributes:[...new Set(exampleClaims.flatMap(claim=>claim.attributes))],qualityKeys,
    example:{text:exampleText,workIds:exampleClaims.map(claim=>claim.workId),illustrative:true,claims:exampleClaims},
    requiredSignals:[...technical],userSignals:[...signals],userLimits:limits,limits:[...limits,'These are editorial groupings of reviewed image descriptions. The research supports investigating multiple contributing qualities, not validated personality categories or a causal explanation of an individual choice.'],
    sources:qualityKeys.flatMap(key=>['appeal.patterns','relative.patterns','favouriteConnections.patterns'].map(path=>source(key,path))),researchSources:TASTE_FAMILY_RESEARCH,researchNote:'These studies motivate looking at several qualities together. They do not validate these family names as personality types.',
    implementationNote:'Each mapped quality is evaluated under its own actual evidence channel and requirements. Several matching model records are related interpretations, not independent replications. Illustrations describe the paintings, not the visitor.'};
}

export const TASTE_FAMILY_DEFINITIONS=Object.freeze([
  family({id:'stories-within-scenes',title:'Stories within scenes',description:'Clues distributed through rooms, objects and layers of space.',qualityKeys:['scenes-within-scenes'],
    exampleText:'Las Meninas sets figures across a room, doorway and mirror. The Garden of Earthly Delights spreads incidents through foregrounds and distant spaces. Both invite looking between parts of a scene.',
    exampleClaims:[{workId:'velazquez-las-meninas',attributes:['narrative-detail','layered-space']},{workId:'bosch-garden-delights',attributes:['narrative-detail','layered-space']}],
    limits:['Several clues do not prove that a scene has one correct reading.','The same connection can appear in a painting you dislike.']}),
  family({id:'light-and-drama',title:'Light & drama',description:'Selective light and deep shadow organising figures and encounters.',qualityKeys:['light-and-figures','dramatic-light'],
    exampleText:'The Supper at Emmaus and The Banjo Lesson direct light toward nearby figures and hands while keeping surrounding areas darker. Their subjects and interactions remain different.',
    exampleClaims:[{workId:'add-caravaggio-supper-emmaus-1601',attributes:['dramatic-light','intimate-figures']},{workId:'study-tanner-banjo-lesson',attributes:['dramatic-light','intimate-figures']}],
    limits:['A dark palette alone does not establish dramatic lighting.','Lighting, subject and bodily action can change together.']}),
  family({id:'fantastical-worlds',title:'Fantastical worlds',description:'Impossible bodies, unusual creatures and physically uncanny settings.',qualityKeys:['imagined-world','precisely-imagined','stories-and-worlds'],
    exampleText:'Harmony combines a carefully constructed room with uncanny bodies and objects. The Giant Egg of Dagobert brings fantastic creatures and impossible relationships into a busy scene.',
    exampleClaims:[{workId:'add-varo-harmony',attributes:['imagined-world']},{workId:'add-carrington-dagobert',attributes:['imagined-world']}],
    limits:['A mythical title or religious subject alone does not establish visible fantasy.','Fantastical imagery does not reveal a viewer’s beliefs or personality.']}),
  family({id:'relationships-in-scenes',title:'Human relationships',description:'Exchanges of gaze, touch, guidance or confrontation within a scene.',qualityKeys:['human-relationships','staged-relationships'],
    exampleText:'Las Meninas organises attention among its figures. The Supper at Emmaus presents a close encounter through responding hands and faces. Human presence alone is a broader, different description.',
    exampleClaims:[{workId:'velazquez-las-meninas',attributes:['human-relationships','theatrical-staging']},{workId:'add-caravaggio-supper-emmaus-1601',attributes:['human-relationships','theatrical-staging']}],
    limits:['People sharing a picture do not necessarily show an interaction.','Choosing these scenes does not measure empathy or sociability.']}),
  family({id:'expressive-figures',title:'Expressive figures',description:'Altered bodily forms combined with emphatic gestures.',qualityKeys:['distortion-and-gesture'],
    exampleText:'The Scream bends a figure and surrounding forms into emphatic curves. Dance repeats stretched bodies and linked gestures. Distortion and depicted action remain separate qualities within that connection.',
    exampleClaims:[{workId:'study-munch-scream',attributes:['expressive-distortion','visible-gesture']},{workId:'study-matisse-dance',attributes:['expressive-distortion','visible-gesture']}],
    limits:['Distortion is a description of depicted forms, not the viewer’s emotional state.','Strong gestures can accompany other differences in colour and composition.']}),
  family({id:'pattern-and-structure',title:'Pattern & structure',description:'Repeated motifs organised by grids, regular divisions or shaped colour fields.',qualityKeys:['structure-and-rhythm'],
    exampleText:'Composition with Red, Yellow, and Blue uses straight divisions and repeated rectangular relationships. Composition 8 creates a different rhythm through circles, lines and angled shapes.',
    exampleClaims:[{workId:'mondrian-composition',attributes:['geometric-structure','pattern-rhythm']},{workId:'study-kandinsky-composition-eight',attributes:['geometric-structure','pattern-rhythm']}],
    limits:['Repetition can appear in figurative scenes as well as abstract paintings.','A structured image does not imply that the viewer needs order.']}),
  family({id:'brushwork-and-marks',title:'Brushwork',description:'Strokes, dabs and painted marks that remain conspicuous as marks.',qualityKeys:['visible-paint-marks'],
    exampleText:'The Starry Night makes directional strokes conspicuous across sky and land. Water Lilies keeps separate painted marks visible across a pond surface. Visible brushwork is distinct from reported admiration of the making.',
    exampleClaims:[{workId:'van-gogh-starry-night',attributes:['visible-paint-marks']},{workId:'monet-water-lilies',attributes:['visible-paint-marks']}],
    limits:['A reproduction can hide or exaggerate individual marks.','Visible marks do not establish effort, skill or your admiration of either.']}),
  family({id:'precision-and-materials',title:'Precision & materials',description:'Controlled detail differentiating cloth, skin, plants, metal and other surfaces.',qualityKeys:['precise-materials'],
    exampleText:'The Ambassadors differentiates instruments, textiles and skin. Ophelia gives plants, water and clothing their own detailed treatment. These are visible surfaces, separate from judgments of artistic skill.',
    exampleClaims:[{workId:'holbein-ambassadors',attributes:['precise-rendering','material-detail']},{workId:'millais-ophelia',attributes:['precise-rendering','material-detail']}],
    limits:['Precise description is not a grade of artistic quality.','Detail may accompany a story, subject or palette that also matters to the choice.']}),
  family({id:'space-and-setting',title:'Space & setting',description:'Depth, natural settings and open expanses, considered as distinct qualities.',qualityKeys:['layered-space','landscape','open-expanse'],
    exampleText:'The Valley of Mexico places foreground terrain before a distant city and mountains. Wanderer above the Sea of Fog separates a near figure and rocks from a broad receding setting.',
    exampleClaims:[{workId:'velasco-valley-mexico',attributes:['layered-space','landscape']},{workId:'friedrich-wanderer',attributes:['layered-space','landscape']}],
    limits:['Depth, natural setting and open space are checked separately.','A pictured setting does not establish whether you felt calm or wanted to return.']}),
  {id:'symbols-and-allegory',lensId:'meaning-and-context',title:'Symbols & allegory',status:'implemented',availability:'current',description:'Museum-documented details and interpretations beside your response before and after reading.',
    example:{text:'Hope pairs a blindfolded figure with a lyre retaining one string. The Ambassadors includes a distorted skull. Their museum notes document particular readings; visible detail alone does not establish a viewer’s interpretation.',workIds:['add-watts-hope','holbein-ambassadors'],illustrative:true,claims:[],documentarySources:[{workId:'add-watts-hope',url:'https://artsandculture.google.com/asset/hope-george-frederic-watts/CgGv3RqPFUZk4A?hl=en'},{workId:'holbein-ambassadors',url:'https://www.nationalgallery.org.uk/paintings/catalogues/foister-2024/the-ambassadors'}]},
    requiredSignals:['An actual sourced interpretive note, its source URLs and limits, frozen with the original painting and question.','A valid same-painting before/after appeal response with the note actually opened. Separate notes and returns keep their source identity.','Visible attribute tags, a title or a movement label cannot substitute for documentary symbolism or the viewer’s answer.'],
    userSignals:['A museum-sourced note about a particular painting.','Your response to that painting before and after reading.','The note and original answers kept with the painting.'],userLimits:['A documented interpretation is not proof that you noticed it before the note.','Repeated viewing and the note happen together; a changed rating does not isolate their effects.'],limits:['Documentary interpretation, perceived possible meanings and visible image descriptions are separate evidence.','A local before/after change does not establish symbolic sensitivity or why the work appealed.'],
    sources:[{module:'symbolism-readings',file:'public/art-atlas/symbolism-readings.mjs',export:'buildSymbolismReadings',resultPath:'$',resultType:'array',match:{module:'symbolism'}}],researchSources:[TASTE_FAMILY_RESEARCH[0]],researchNote:'Interpretive context is kept separate from visible qualities and from the viewer’s reported response.',implementationNote:'Uses sourced symbolism-reveal readings only. It never derives symbolism from a visual tag, family name, unknown artist or generic personality language.'}
]);

export function defaultProfileReading(readings=[],hash=''){
  const id=String(hash).replace(/^#/,'');return readings.find(item=>item.id===id)||readings.find(item=>item.id===DEFAULT_TASTE_FAMILY)||readings[0]||null;
}
