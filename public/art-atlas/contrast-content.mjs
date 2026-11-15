// Curated source-linked content. This module selects stimuli; it does not score answers.
export const CONTRAST_CONTENT_REVISION = 'contrast-content-v2';
export const CONTRAST_KINDS = Object.freeze(['keep-leave', 'neighbour', 'chronology', 'same-subject']);
const unique = values => [...new Set(values)];
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const signature = values => JSON.stringify([...values].sort());
const validRange = range => Array.isArray(range) && range.length === 2 && range.every(Number.isFinite) && range[0] <= range[1];
const equalRange = (a, b) => validRange(a) && validRange(b) && a.every((value, index) => value === b[index]);
const clone = value => structuredClone(value);
const httpUrl = value => { try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; } };
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function hash(value) { let n = 2166136261; for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; }
function ordered(ids, salt) { return [...ids].sort((a, b) => hash(salt + '|' + a) - hash(salt + '|' + b) || a.localeCompare(b)); }

export const RELATIONSHIP_OPTIONS = freeze([
  {id:'colour', label:'Colour'}, {id:'subject', label:'Subject'},
  {id:'form', label:'Shapes or composition'}, {id:'marks', label:'Marks or surface'},
  {id:'tradition', label:'Artist or tradition'}, {id:'feeling', label:'The feeling I get'},
  {id:'other', label:'Another connection'}
]);

// Closed catalogue intervals, not confidence bounds. Approximate point dates stay approximate.
const DATE_RECORDS = freeze({
  'study-guo-xi-early-spring': {yearRange:[1072,1072], displayDate:'1072', sourceUrl:'https://digitalarchive.npm.gov.tw/Collection/Detail?dep=P&id=47', approximate:false},
  'study-leonardo-mona-lisa': {yearRange:[1503,1519], displayDate:'1503–19', sourceUrl:'https://collections.louvre.fr/ark:/53355/cl010062370', approximate:true},
  'study-vermeer-milkmaid': {yearRange:[1660,1660], displayDate:'c. 1660', sourceUrl:'https://www.rijksmuseum.nl/en/story/milkmaid-vermeer', approximate:true},
  'study-munch-scream': {yearRange:[1893,1893], displayDate:'1893', sourceUrl:'https://www.nasjonalmuseet.no/en/collection/object/NG.M.00939', approximate:false},
  'study-vermeer-pearl': {yearRange:[1665,1665], displayDate:'c. 1665', sourceUrl:'https://www.mauritshuis.nl/en/our-collection/artworks/670-girl-with-a-pearl-earring', approximate:true},
  'study-hokusai-great-wave': {yearRange:[1830,1832], displayDate:'c. 1830–32', sourceUrl:'https://www.metmuseum.org/art/collection/search/45434', approximate:true},
  'van-gogh-starry-night': {yearRange:[1889,1889], displayDate:'1889', sourceUrl:'https://www.moma.org/collection/works/79802', approximate:false},
  'mondrian-composition': {yearRange:[1927,1927], displayDate:'1927', sourceUrl:'https://www.clevelandart.org/art/1967.215', approximate:false},
  'egypt-young-girl': {yearRange:[25,37], displayDate:'c. 25–37 CE', sourceUrl:'https://www.clevelandart.org/art/1971.137', approximate:true},
  'bosch-garden-delights': {yearRange:[1490,1500], displayDate:'1490–1500', sourceUrl:'https://www.museodelprado.es/en/the-collection/art-work/the-garden-of-earthly-delights-triptych/02388242-6d6a-4e9e-a992-e1311eab3609', approximate:true},
  'study-gentileschi-judith': {yearRange:[1620,1620], displayDate:'c. 1620', sourceUrl:'https://www.uffizi.it/en/artworks/judith-beheading-holofernes', approximate:true},
  'study-wood-american-gothic': {yearRange:[1930,1930], displayDate:'1930', sourceUrl:'https://www.artic.edu/assets/f85bee6b-d18b-5577-a9e6-f429421b4654', approximate:false}
});

export const CONTRAST_CONTENT_BANK = freeze([
  {contentId:'keep-six-landmarks-a', kind:'keep-leave', preferredBatch:0,
    workIds:['van-gogh-starry-night','study-leonardo-mona-lisa','study-hokusai-great-wave','klimt-kiss','mondrian-composition','study-delacroix-liberty'],
    curationNotes:['Six editorial landmark anchors vary in subject, era, composition and making.','A work left out is the relative low choice in this set, not an absolute dislike.']},
  {contentId:'keep-six-landmarks-b', kind:'keep-leave', preferredBatch:1,
    workIds:['study-rembrandt-night-watch','study-waterhouse-shalott','study-van-gogh-self-portrait','study-fan-kuan-travelers','study-marc-blue-horse','study-manet-luncheon-grass'],
    curationNotes:['Six later landmark anchors include a Chinese mountain scene, a self-portrait, an animal and group narratives.','Six pictures do not constitute six independent preference tasks.']},
  {contentId:'keep-six-landmarks-c', kind:'keep-leave', preferredBatch:2,
    workIds:['study-david-marat','study-monet-rouen-sunlight','study-malevich-black-square','study-botticelli-birth-venus','study-gentileschi-judith','study-wood-american-gothic'],
    curationNotes:['Landmark anchors include architecture, sparse nonfiguration and human narratives.','Known history, depicted harm, recognisability and prior exposure are possible alternatives to a visual explanation.']},
  {contentId:'neighbour-starry-night', kind:'neighbour', preferredBatch:0, anchorId:'van-gogh-starry-night',
    workIds:['opening-cma-141639','study-hokusai-great-wave','study-kandinsky-composition-eight','van-gogh-night-cafe'],
    curationNotes:['Candidates permit sky/landscape, curving forms, pictorial rhythm, colour and same-artist connections.','These are possible editorial routes, not an answer key. Ask the viewer which connection they see.']},
  {contentId:'neighbour-milkmaid', kind:'neighbour', preferredBatch:1, anchorId:'study-vermeer-milkmaid',
    workIds:['study-cassatt-child-bath','morisot-reading','study-vermeer-pearl','opening-cma-169545'],
    curationNotes:['Candidates permit an absorbed figure, everyday activity, same artist, patterned arrangement or significant objects.','The Korean scholar screen offers a meaningful object-based connection without a visible person.']},
  {contentId:'neighbour-great-wave', kind:'neighbour', preferredBatch:2, anchorId:'study-hokusai-great-wave',
    workIds:['japanese-waves','monet-water-lilies','turner-burning-parliament','hokusai-mount-fuji'],
    curationNotes:['Candidates permit water subject, moving forms, weather/light, colour or a shared printmaker and series.','Different connections can be equally reasonable. Relatedness is separate from preference.']},
  {contentId:'chronology-spring-to-scream', kind:'chronology', preferredBatch:0,
    workIds:['study-guo-xi-early-spring','study-leonardo-mona-lisa','study-vermeer-milkmaid','study-munch-scream'],
    curationNotes:['Source catalogue intervals do not overlap.','The order concerns when these particular objects were made, not a progression of quality or cultural development.']},
  {contentId:'chronology-pearl-to-mondrian', kind:'chronology', preferredBatch:1,
    workIds:['study-vermeer-pearl','study-hokusai-great-wave','van-gogh-starry-night','mondrian-composition'],
    curationNotes:['Source catalogue intervals do not overlap. Approximate year labels remain approximate.','A correct order records art-history knowledge or an informed guess, not an aesthetic preference.']},
  {contentId:'chronology-ancient-to-gothic', kind:'chronology', preferredBatch:2,
    workIds:['egypt-young-girl','bosch-garden-delights','study-gentileschi-judith','study-wood-american-gothic'],
    curationNotes:['The Roman Egyptian panel and later European/US works have widely separated catalogue intervals.','Differences in preservation and making can affect apparent age. Do not infer a universal visual development.']},
  {contentId:'subject-mountains', kind:'same-subject', preferredBatch:0,
    workIds:['cezanne-mountain','hokusai-mount-fuji'],
    subject:{id:'mountain-landscapes',label:'Two mountain landscapes',description:'Different mountains, pictured in different ways: Sainte-Victoire and Mount Fuji.',reviewed:true,matchLevel:'subject-family',samePersonOrPlace:false},
    curationNotes:['The shared subject is a mountain landscape, not the same mountain or view.','Faceted oil-paint marks and a colour woodblock print offer strong treatment differences.'],
    residualConfounds:['Different place, artist, period, palette, medium, scale and prior familiarity.','A preference does not isolate brushwork, abstraction, country or any other single cause.']},
  {contentId:'subject-portraits', kind:'same-subject', preferredBatch:1,
    workIds:['study-leonardo-mona-lisa','redon-violette'],
    subject:{id:'single-figure-portraits',label:'Two portraits',description:'Different sitters: Mona Lisa and Violette Heymann.',reviewed:true,matchLevel:'subject-family',samePersonOrPlace:false},
    curationNotes:['Both are portraits of individual sitters. This does not claim they show the same person.','A frontal seated figure with a distant setting contrasts with a profile surrounded by blossoms.'],
    residualConfounds:['Different sitter, pose, artist, date, palette, material, setting, scale and fame.','Flower associations and prior knowledge can matter as much as pictorial treatment.']},
  {contentId:'subject-flowers', kind:'same-subject', preferredBatch:2,
    workIds:['study-van-gogh-sunflowers','monet-spring-flowers'],
    fallbackReleaseBatch:1,
    subject:{id:'flower-still-life',label:'Two flower still lifes',description:'Different flowers and arrangements, painted by Van Gogh and Monet.',reviewed:true,matchLevel:'subject-family',samePersonOrPlace:false},
    curationNotes:['Both are flower still lifes. They do not show the same flowers or arrangement.','The 1864 Monet is an early still life, not the later Water Lilies treatment.'],
    residualConfounds:['Different flowers, arrangement, artist, date, palette, lighting and prior familiarity.','The subject match is partial and does not make colour or paint handling causal.']},
  {contentId:'keep-six-landmarks-d', kind:'keep-leave', preferredBatch:3,
    workIds:['study-vermeer-milkmaid','study-raphael-school-athens','study-van-gogh-sunflowers','study-abanindranath-bharat-mata','study-kandinsky-composition-eight','study-bruegel-hunters-snow'],
    curationNotes:['Six landmark anchors include everyday activity, a gathering, flowers, allegory, nonfiguration and a snowy landscape.','These six differ from every work in keep/leave groups A, B and C. Unchosen works remain unordered.']},
  {contentId:'keep-six-landmarks-e', kind:'keep-leave', preferredBatch:4,
    workIds:['study-seurat-grande-jatte','millais-ophelia','matejko-stanczyk','study-guo-xi-early-spring','study-posada-catrina','turner-burning-parliament'],
    curationNotes:['Landmark anchors span Chinese mountain painting, Mexican printmaking and different European scenes.','Subject, narrative knowledge, material, photographed colour and prior exposure remain alternatives.']},
  {contentId:'keep-six-landmarks-f', kind:'keep-leave', preferredBatch:5,
    workIds:['study-munch-scream','study-cassatt-child-bath','study-morisot-cradle','velazquez-las-meninas','opening-cma-141639','opening-cma-92937'],
    curationNotes:['Landmark anchors include a sunset landscape, physical contest, portraits and adult/child scenes.','The two selected extremes provide a bounded relative task, not six independent ratings.']},
  {contentId:'neighbour-blue-horse', kind:'neighbour', preferredBatch:3, anchorId:'study-marc-blue-horse',
    workIds:['rousseau-tiger-buffalo','study-matisse-dance','hokusai-mount-fuji','study-kandinsky-composition-eight'],
    curationNotes:['Candidates permit animal subject, bodily rhythm, large colour areas, outlined shapes or modernist associations.','The viewer may find a different connection or none; these routes are not an answer key.']},
  {contentId:'neighbour-black-square', kind:'neighbour', preferredBatch:4, anchorId:'study-malevich-black-square',
    workIds:['mondrian-composition','opening-cma-169545','cezanne-mountain','onchi-mother-child'],
    curationNotes:['Candidates permit geometry, framed compartments, planar construction, dark shapes or light/dark contrast.','Representational objects and figures can be related to nonfigurative form without sharing a subject or tradition.']},
  {contentId:'neighbour-bharat-mata', kind:'neighbour', preferredBatch:5, anchorId:'study-abanindranath-bharat-mata',
    workIds:['green-tara','study-posada-catrina','redon-violette','study-gentileschi-judith'],
    curationNotes:['Candidates permit prominent human figures, meaningful objects, symbolic context, colour or pictorial arrangement.','Different religious, political, satirical and portrait functions remain specific to each work. A connection does not equate them or identify the viewer\'s beliefs.']},
  {contentId:'chronology-ancient-wave-scream', kind:'chronology', preferredBatch:3,
    workIds:['egypt-young-girl','study-leonardo-mona-lisa','study-hokusai-great-wave','study-munch-scream'],
    curationNotes:['This alternative uses only the existing reviewed date records and strictly disjoint catalogue intervals.','The chronological order is factual metadata for these objects, not an order of quality or development.']},
  {contentId:'chronology-spring-bosch-pearl-gothic', kind:'chronology', preferredBatch:4,
    workIds:['study-guo-xi-early-spring','bosch-garden-delights','study-vermeer-pearl','study-wood-american-gothic'],
    curationNotes:['The existing reviewed intervals remain disjoint in this new combination.','Dates and approximate labels are frozen with the definition and revealed only after the response.']},
  {contentId:'chronology-mona-judith-starry-mondrian', kind:'chronology', preferredBatch:5,
    workIds:['study-leonardo-mona-lisa','study-gentileschi-judith','van-gogh-starry-night','mondrian-composition'],
    curationNotes:['This combination reuses four existing source-checked date records without introducing inferred years.','An approximate catalogue year remains approximate even where stored as a point interval.']},
  {contentId:'subject-waves', kind:'same-subject', preferredBatch:3,
    workIds:['study-hokusai-great-wave','japanese-waves'],
    subject:{id:'wave-scenes',label:'Two wave scenes',description:'Different wave images by Hokusai and Nakamura Hōchū.',reviewed:true,matchLevel:'subject-family',samePersonOrPlace:false},
    curationNotes:['Both depict waves. Hokusai\'s print also includes boats, people and distant Mount Fuji.','Hōchū\'s fan painting has a different shape, surface and later scroll mounting.'],
    residualConfounds:['Boats, visible people, mountain, composition, scale, support, colour and date differ.','The shared wave subject does not isolate movement, narrative or an emotional response.']},
  {contentId:'subject-adults-children', kind:'same-subject', preferredBatch:4,
    workIds:['study-cassatt-child-bath','cassatt-omnibus'],
    subject:{id:'adult-and-child-scenes',label:'Adults with children',description:'An adult washing a child and women travelling with a child, both by Mary Cassatt.',reviewed:true,matchLevel:'subject-family',samePersonOrPlace:false},
    curationNotes:['Both depict adults with a child. The Omnibus includes a mother and nursemaid; do not identify every adult as the mother.','An oil painting and a colour print by the same maker offer a useful comparison while activity and composition still differ.'],
    residualConfounds:['Bathing and public travel, number of adults, viewpoint, pattern, colour, material and date differ.','Provisional visual-density annotations differ, but neither subject matching nor common authorship makes density causal.']},
  {contentId:'subject-object-still-lifes', kind:'same-subject', preferredBatch:5,
    workIds:['still-life-sweets','blanchard-still-life'],fallbackReleaseBatch:1,
    subject:{id:'object-still-life',label:'Two object still lifes',description:'Different arrangements of objects by Juan van der Hamen and María Blanchard.',reviewed:true,matchLevel:'subject-family',samePersonOrPlace:false},
    curationNotes:['Both are object still lifes; they do not depict the same objects or arrangement.','Recognisable sweets and vessels contrast with a Cubist construction of still-life objects.'],
    residualConfounds:['Objects, arrangement, maker, period, palette, lighting, space and surface differ.','A large editorial abstraction gap is available to test; it does not establish abstraction as the cause of a choice.']}
]);

function catalogueFor(works) {
  const counts = new Map();
  for (const work of works) if (text(work?.id)) counts.set(work.id, (counts.get(work.id) || 0) + 1);
  return new Map(works.filter(work => plain(work) && counts.get(work.id) === 1 && text(work.title) && text(work.image) && httpUrl(work.sourceUrl) && work.studyEligible !== false && work.decorativeOnly !== true).map(work => [work.id, work]));
}
function workIdsFor(round) {
  if (Array.isArray(round?.works)) return round.works.map(work => work?.id).filter(text);
  return Array.isArray(round?.workIds) ? round.workIds.filter(text) : [];
}
function anchorIdsFor(round) {
  return unique([...(Array.isArray(round?.anchorWorks) ? round.anchorWorks.map(work => work?.id) : []), ...(Array.isArray(round?.anchorIds) ? round.anchorIds : []), round?.anchorId].filter(text));
}
function ordinaryPreference(round, answer, offered) {
  if (round.kind !== 'spectrum' || round.criterion !== 'preference' || round.evidence?.construct !== 'preference' || round.evidence?.unconditional === false || round.brief || round.evidence?.brief || anchorIdsFor(round).length || answer?.confirmed !== true || answer.criterion !== 'preference') return false;
  if (!['individual-choice','feature-check','unconditional-preference','adaptive-preference'].includes(round.evidence?.family)) return false;
  return Array.isArray(answer.workIds) && answer.workIds.length === offered.length && answer.workIds.every((id, i) => id === offered[i]) && plain(answer.positions) && Object.keys(answer.positions).length === offered.length && offered.every(id => Number.isFinite(answer.positions[id]) && answer.positions[id] >= 0 && answer.positions[id] <= 100);
}
function historyFor(rounds, answers, byId) {
  const counts = new Map(), plannedLastSeen = new Map(), plannedCounts = new Map(), lastSeen = new Map(), lastPossible = new Map(), exposureCounts = new Map(), ordinaryRated = new Set(), usedSets = new Set(), usedContent = new Set(), unknownRoundIds = [];
  rounds.forEach(round => { if (text(round?.id)) counts.set(round.id, (counts.get(round.id) || 0) + 1); });
  rounds.forEach((round, index) => {
    if (!plain(round) || round.unavailable || text(round.id) && counts.get(round.id) > 1) return;
    const offered = workIdsFor(round), all = unique([...offered, ...anchorIdsFor(round)]).filter(id => byId.has(id));
    if (!all.length || new Set(offered).size !== offered.length) return;
    const contentId = round.contentId || round.contrastContentId || round.evidence?.contentId;
    if (text(contentId)) usedContent.add(contentId);
    // Future/planned definitions prevent duplicated bookings, but do not prove exposure.
    usedSets.add(signature(all));
    if (round.evidence?.stimulusVisibility === 'not-shown') return;
    // Specific question definitions provide a planning signal before answers exist.
    // An exercise's offered museum tray is not a plan to present every image in it.
    if (text(round.kind) && round.kind !== 'exercise') {
      for (const id of all) { plannedLastSeen.set(id,index); plannedCounts.set(id,(plannedCounts.get(id) || 0) + 1); }
    }
    const answer = text(round.id) ? answers[round.id] : undefined;
    let presented = [], unknown = [];
    const allowed = new Set(all);
    const clean = ids => unique(ids.filter(id => allowed.has(id)));
    if (Array.isArray(round.presentedIds)) {
      presented = clean(round.presentedIds);
      unknown = clean(Array.isArray(round.exposureUnknownWorkIds) ? round.exposureUnknownWorkIds : []);
    } else if (Array.isArray(answer?.record?.presentedIds)) {
      presented = clean(answer.record.presentedIds);
      unknown = clean(Array.isArray(answer.record.exposureUnknownWorkIds) ? answer.record.exposureUnknownWorkIds : []);
    } else if (round.kind !== 'exercise' && answer?.confirmed === true && Array.isArray(answer.workIds) && signature(answer.workIds) === signature(offered)) {
      presented = all;
    } else {
      unknown = all;
    }
    for (const id of presented) { lastSeen.set(id, index); exposureCounts.set(id, (exposureCounts.get(id) || 0) + 1); }
    for (const id of unknown) lastPossible.set(id, index);
    if (unknown.length) unknownRoundIds.push(round.id || contentId || 'history-' + index);
    if (ordinaryPreference(round, answer, offered)) offered.forEach(id => ordinaryRated.add(id));
  });
  return {plannedLastSeen,plannedCounts,lastSeen,lastPossible,exposureCounts,ordinaryRated,usedSets,usedContent,unknownRoundIds};
}
function sameSubjectReleased(entry, notes, batchIndex) {
  const annotations = new Map((Array.isArray(notes?.annotations) ? notes.annotations : []).filter(row => text(row?.workId)).map(row => [row.workId, row]));
  const firstIds = unique((Array.isArray(notes?.proposedFirst18Panels) ? notes.proposedFirst18Panels : []).flatMap(panel => Array.isArray(panel.workIds) ? panel.workIds : []));
  const hasExplicitPools = firstIds.length > 0;
  if (hasExplicitPools) {
    const available = new Set([...firstIds, ...(batchIndex >= 1 && Array.isArray(notes?.reservePools?.batch2) ? notes.reservePools.batch2 : []), ...(batchIndex >= 2 && Array.isArray(notes?.reservePools?.batch3) ? notes.reservePools.batch3 : [])]);
    if (entry.workIds.some(id => !available.has(id))) return false;
  } else if (Number.isInteger(entry.fallbackReleaseBatch) && entry.fallbackReleaseBatch > batchIndex) return false;
  return entry.workIds.every(id => !Number.isInteger(annotations.get(id)?.reserveUntilBatch) || annotations.get(id).reserveUntilBatch <= batchIndex);
}
function dateEvidenceFor(entry, byId) {
  const records = {};
  for (const id of entry.workIds) {
    const record = DATE_RECORDS[id], work = byId.get(id);
    if (!record || !equalRange(work?.analysis?.yearRange, record.yearRange)) return null;
    records[id] = {...clone(record), catalogueSourceUrl:work.sourceUrl, basis:'Source-checked stored catalogue interval; not a statistical confidence interval.', uncertaintyNote:record.approximate ? 'The museum date is approximate or spans years. A point interval for an approximate year does not make that year certain.' : 'Year as catalogued by the museum.'};
  }
  const sorted = [...entry.workIds].sort((a, b) => records[a].yearRange[0] - records[b].yearRange[0]);
  if (sorted.some((id, i) => i > 0 && records[sorted[i - 1]].yearRange[1] >= records[id].yearRange[0])) return null;
  return {dateEvidence:records, canonicalOrder:sorted};
}
const PROMPTS = freeze({
  'keep-leave': {title:'Keep one. Leave one.',prompt:'Which would you keep, and which would you leave out?',hint:'Choose two different paintings. The other four can stay undecided.',construct:'relative-preference-extremes'},
  neighbour: {title:'Choose a neighbour.',prompt:'Which has the strongest connection to this painting for you?',hint:'Choose one, then tell us what connects them. There is no single correct connection.',construct:'perceived-relatedness'},
  chronology: {title:'Put them in time.',prompt:'Put these works in order of when they were made.',hint:'Start with the earliest. Use Not sure if you do not know.',construct:'art-history-chronology'},
  'same-subject': {title:'One subject. Two treatments.',prompt:'Which do you prefer?',hint:'Choose one, or choose No preference.',construct:'subject-conditioned-preference'}
});

/** Pass preceding round definitions in chronological order; answers or visibility events establish actual exposure. */
export function selectContrastContent({works=[],rounds=[],answers={},seed='contrast-content',kind,batchIndex=0,notes={}}={}) {
  const requestedKind = kind;
  const unavailable = (reason, rejected=[]) => ({status:'unavailable',kind:'contrast',contrastKind:requestedKind,workIds:[],reason,rejected,revision:CONTRAST_CONTENT_REVISION});
  if (!CONTRAST_KINDS.includes(kind)) return unavailable('Unknown contrast kind.');
  const batch = Number.isInteger(batchIndex) && batchIndex >= 0 ? batchIndex : 0;
  const safeRounds = Array.isArray(rounds) ? rounds : [], safeAnswers = plain(answers) ? answers : {}, safeNotes = plain(notes) ? notes : {};
  const byId = catalogueFor(Array.isArray(works) ? works : []), history = historyFor(safeRounds,safeAnswers,byId), rejected = [];
  const candidates = [];
  for (const entry of CONTRAST_CONTENT_BANK.filter(entry => entry.kind === kind)) {
    const allIds = unique([...entry.workIds,...(entry.anchorId ? [entry.anchorId] : [])]);
    let reason = allIds.some(id => !byId.has(id)) ? 'Missing, duplicate or ineligible source-linked work.' : null;
    if (!reason && (history.usedContent.has(entry.contentId) || history.usedSets.has(signature(allIds)))) reason = 'This content or exact artwork set is already in the supplied history.';
    if (!reason && kind === 'same-subject' && !sameSubjectReleased(entry,safeNotes,batch)) reason = 'A genuine preference item is reserved for a later rating allocation.';
    const dates = !reason && kind === 'chronology' ? dateEvidenceFor(entry,byId) : null;
    if (!reason && kind === 'chronology' && !dates) reason = 'Source-checked closed date ranges are missing, changed or overlapping; review before use.';
    if (reason) { rejected.push({contentId:entry.contentId,reason}); continue; }
    const recentFloor = Math.max(0,safeRounds.length - 6);
    const plannedRecentCount = allIds.filter(id => history.plannedLastSeen.has(id) && history.plannedLastSeen.get(id) >= recentFloor).length;
    const mostRecentPlanned = Math.max(-1,...allIds.map(id => history.plannedLastSeen.get(id) ?? -1));
    const plannedCount = allIds.reduce((sum,id) => sum + (history.plannedCounts.get(id) || 0),0);
    const recentCount = allIds.filter(id => history.lastSeen.has(id) && history.lastSeen.get(id) >= recentFloor).length;
    const mostRecent = Math.max(-1,...allIds.map(id => history.lastSeen.get(id) ?? -1));
    const totalExposure = allIds.reduce((sum,id) => sum + (history.exposureCounts.get(id) || 0),0);
    const possibleRecent = allIds.filter(id => (history.lastPossible.get(id) ?? -1) >= recentFloor).length;
    candidates.push({entry,allIds,dates,plannedRecentCount,recentCount,cost:[plannedRecentCount,mostRecentPlanned,recentCount,mostRecent,totalExposure,plannedCount,possibleRecent,Math.abs(entry.preferredBatch-batch),hash(seed+'|'+batch+'|'+entry.contentId)]});
  }
  candidates.sort((a,b) => {for(let i=0;i<a.cost.length;i++)if(a.cost[i]!==b.cost[i])return a.cost[i]-b.cost[i];return a.entry.contentId.localeCompare(b.entry.contentId);});
  if (!candidates.length) return unavailable('No unused eligible source-checked set is available for this format.',rejected);
  const chosen = candidates[0], entry = chosen.entry, allIds = chosen.allIds;
  let workIds = ordered(entry.workIds,seed+'|'+batch+'|'+entry.contentId+'|display');
  if (chosen.dates && signature(workIds) === signature(chosen.dates.canonicalOrder) && workIds.every((id,i) => id === chosen.dates.canonicalOrder[i])) workIds = [...workIds.slice(1),workIds[0]];
  const result = {status:'ready',kind:'contrast',contrastKind:kind,contentId:entry.contentId,revision:CONTRAST_CONTENT_REVISION,workIds,...clone(PROMPTS[kind]),curationNotes:clone(entry.curationNotes),residualConfounds:clone(entry.residualConfounds || ['Subject, maker, format, date, reproduction and prior knowledge can vary.']),sourceUrls:unique([...allIds.map(id => byId.get(id).sourceUrl),...Object.values(chosen.dates?.dateEvidence || {}).map(record => record.sourceUrl)]),sourceStatus:'Reviewed editorial content from the current source-linked study collection.',exposureAudit:{scope:'Supplied session history only; outside exposure is unmeasured.',knownPresentedIds:allIds.filter(id => history.lastSeen.has(id)),noRecordedPresentationIds:allIds.filter(id => !history.lastSeen.has(id) && !history.lastPossible.has(id)),unknownExposureIds:allIds.filter(id => history.lastPossible.has(id)),previousOrdinaryPreferenceIds:allIds.filter(id => history.ordinaryRated.has(id)),plannedQuestionLastIndex:Object.fromEntries(allIds.map(id => [id,history.plannedLastSeen.get(id) ?? null])),plannedQuestionPresentationCounts:Object.fromEntries(allIds.map(id => [id,history.plannedCounts.get(id) || 0])),recentPlannedQuestionOverlap:chosen.plannedRecentCount,plannedSpacingScope:'Specific non-exercise question definitions, including separate anchors. This is planned spacing, not evidence of actual viewing. Museum/exercise offered trays do not update it.',lastKnownPresentationIndex:Object.fromEntries(allIds.map(id => [id,history.lastSeen.get(id) ?? null])),knownPresentationCounts:Object.fromEntries(allIds.map(id => [id,history.exposureCounts.get(id) || 0])),recentKnownOverlap:chosen.recentCount,unknownExposureRoundIds:unique(history.unknownRoundIds),exactSetPreviouslyPlannedOrPresented:false,selectionBasis:'Unused reviewed sets first; then fewer recent planned specific-question presentations, older last planned question, recorded actual recency/exposure, planned question count, possible recent exposure, phase fit and seeded tie-break.',unseenClaim:false},selectionAudit:{eligibleSetCount:candidates.length,rejected,preferredBatch:entry.preferredBatch,actualBatch:batch},limits:['This is editorial stimulus selection, not optimal information gain.','Different tasks over shared pictures remain dependent evidence.','Previous ordinary preference ratings, image exposure, recognition and liking are separate records.','No content set identifies a personality or establishes why a feature caused a preference.']};
  if (entry.anchorId) { result.anchorId = entry.anchorId; result.relationshipOptions = clone(RELATIONSHIP_OPTIONS); result.noCorrectNeighbour = true; }
  if (entry.subject) result.subject = clone(entry.subject);
  if (chosen.dates) Object.assign(result,clone(chosen.dates),{hideDatesUntilFeedback:true,dateUncertainty:'Museum dates can be approximate. Stored intervals are catalogue ranges, not certainty estimates.'});
  return result;
}
