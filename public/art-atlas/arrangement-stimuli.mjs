// Source-linked editorial rotations for new, unshown arrangement questions.
export const ARRANGEMENT_STIMULI_REVISION = 'arrangement-stimuli-v1';
const text = value => typeof value === 'string' && value.trim().length > 0;
const clone = value => structuredClone(value);
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function httpUrl(value) { try { return ['http:','https:'].includes(new URL(value).protocol); } catch { return false; } }

export const ARRANGEMENT_STIMULI_BANK = freeze({
  sorting:[
    {contentId:'sorting-contexts-a',workIds:['study-guo-xi-early-spring','study-abanindranath-bharat-mata','calligraphy-party','study-marc-blue-horse','mondrian-composition','redon-violette','figari-candombe-moon','opening-cma-160300'],
      curationNotes:['Landscape, figure, allegory, collaborative art-making, animal and nonfigurative treatments permit different grouping rules.','Chinese, Indian, Uruguayan, Japanese and European contexts are sampling contexts, not national taste categories. Preserve Kyōsai and others as collaborative authorship.']},
    {contentId:'sorting-contexts-b',workIds:['study-vermeer-pearl','study-fan-kuan-travelers','study-munch-scream','study-delacroix-liberty','study-tanner-banjo-lesson','hiroshige-sudden-shower','herran-la-ofrenda','almeida-junior-saudade'],
      curationNotes:['A tronie, landscape, human narratives and rain scene provide a fresh eight-work grouping set.','Source functions and cultural meanings differ. The grouping task has no correct taxonomy.']},
    {contentId:'sorting-contexts-c',workIds:['study-botticelli-birth-venus','study-wood-american-gothic','study-malevich-black-square','study-hokusai-great-wave','velasco-valley-mexico','opening-cma-169545','green-tara','blanchard-still-life'],
      curationNotes:['A new set contrasts human imagery, sparse nonfiguration, a scholar screen and different landscape treatments.','Tibetan devotion, Mexican landscape and Korean chaekgado retain their own contexts. Attribution to Aniko stays qualified.']},
    {contentId:'sorting-contexts-d',workIds:['klimt-kiss','study-rembrandt-night-watch','study-gentileschi-judith','study-monet-rouen-sunlight','study-cassatt-child-bath','birds-spring-willow','bamboos-wind','ethiopian-apostles'],
      curationNotes:['People, architecture, plant subjects and an Ethiopian Orthodox diptych supply another reviewed eight-work set.','The Ethiopian attribution is workshop or circle of Wäldä Maryam. Do not turn the source context into a claim about a viewer.']}
  ],
  'difficult-edit':[
    {contentId:'edit-mountain-views',workIds:['cezanne-mountain','velasco-valley-mexico','hokusai-mount-fuji','study-guo-xi-early-spring'],
      curationNotes:['Four mountain or valley landscapes depict different places and treatments.','The shared broad terrain subject does not hold medium, date, palette, scale or pictured human traces constant.']},
    {contentId:'edit-faces-and-attention',workIds:['study-leonardo-mona-lisa','study-vermeer-pearl','redon-violette','egypt-man-portrait'],
      curationNotes:['Four prominent human figures offer different gazes, settings, materials and functions.','The Vermeer is a tronie; the Egyptian panel is funerary. These are not portraits of the same person or a controlled portrait experiment.']},
    {contentId:'edit-objects-and-construction',workIds:['study-van-gogh-sunflowers','mondrian-composition','blanchard-still-life','opening-cma-169545'],
      curationNotes:['Flower and object imagery sits beside nonfiguration and a Korean scholar screen.','The set can support deliberate formal or thematic contrast; it does not claim that all four depict the same subject.']},
    {contentId:'edit-groups-and-action',workIds:['study-matisse-dance','opening-cma-92937','herran-la-ofrenda','chitarman-tiered-court'],
      curationNotes:['Human groups include dance, a physical contest, flower transport and a Mughal court scene.','Activity, date, artist, original function and reproduction vary. Leaving a work out is a contextual arrangement choice.']}
  ]
});

/** Reuse the first sorting selection for its own later return; never reselect a shown round. */
export function selectArrangementStimuli({works=[],batchIndex=0,kind}={}) {
  const canonicalKind = kind === 'edit' ? 'difficult-edit' : kind;
  const bank = ARRANGEMENT_STIMULI_BANK[canonicalKind];
  const unavailable = (reason,rejected=[]) => ({status:'unavailable',kind:canonicalKind,workIds:[],reason,rejected,revision:ARRANGEMENT_STIMULI_REVISION});
  if (!Array.isArray(bank)) return unavailable('Unknown arrangement kind.');
  const safeWorks = Array.isArray(works) ? works : [], counts = new Map();
  for (const work of safeWorks) if (text(work?.id)) counts.set(work.id,(counts.get(work.id) || 0) + 1);
  const byId = new Map(safeWorks.filter(work => counts.get(work?.id) === 1 && text(work.title) && text(work.image) && httpUrl(work.sourceUrl) && work.studyEligible !== false && work.decorativeOnly !== true).map(work => [work.id,work]));
  const batch = Number.isInteger(batchIndex) && batchIndex >= 0 ? batchIndex : 0;
  const preferred = batch % bank.length, rejected = [];
  for (let step=0;step<bank.length;step++) {
    const rotationIndex = (preferred + step) % bank.length, entry = bank[rotationIndex];
    const missingIds = entry.workIds.filter(id => !byId.has(id));
    if (missingIds.length) { rejected.push({contentId:entry.contentId,reason:'Incomplete source-linked reviewed set.',missingIds}); continue; }
    return {status:'ready',kind:canonicalKind,contentId:entry.contentId,revision:ARRANGEMENT_STIMULI_REVISION,batchIndex:batch,rotationIndex,preferredRotationIndex:preferred,workIds:[...entry.workIds],sourceUrls:entry.workIds.map(id => byId.get(id).sourceUrl),curationNotes:clone(entry.curationNotes),fallback:step>0,fallbackReason:step>0?'The preferred set is incomplete; another complete reviewed rotation was used.':null,rejected,reuseRule:canonicalKind==='sorting'?'Save this eight-work set at the first sorting round and reuse that saved set at its later within-batch return.':'Save this four-work arrangement definition before responding.',scope:'New arrangement stimuli, not ordinary preference ratings or proof of actual exposure.',limits:['The four rotations are finite editorial curation, not a representative sample or an optimal information design.','A later saved sorting return must use its original set, even if catalogue availability changes.','Complete fallback rotations may recur across batches; report fallback rather than claiming new images.']};
  }
  return unavailable('No complete reviewed arrangement rotation is available.',rejected);
}
