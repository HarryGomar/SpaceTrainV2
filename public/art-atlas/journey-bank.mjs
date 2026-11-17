import {availableSymbolismContent,buildSymbolismRound} from './symbolism-rounds.mjs';
import {recognitionTier,preferredTier,museumLibraryOrder} from './curation-priority.mjs';
import {AXES} from './engine.mjs';
import {buildStudyRounds} from './question-bank.mjs';
import {SORTING_WORKS} from './sorting-table.mjs';
import {planStimulusPanels,extendStimulusReservations,JOURNEY_BLOCK_LIMIT} from './stimulus-planner.mjs';
import CURATION_NOTES from './curation-notes.json' with {type:'json'};
import {selectContrastContent,selectSubjectBaselinePair} from './contrast-content.mjs';
import {buildContrastRound} from './contrast-rounds.mjs';
import {selectArrangementStimuli} from './arrangement-stimuli.mjs';
import {APPEAL_PROTOCOL,withOverallAppeal,isOverallAppealRound} from './appeal-scale.mjs';
import {COMPARISON_PROTOCOL,withComparisonPreference,isComparisonPreferenceRound} from './comparison-protocol.mjs';
import {CONTINUOUS_PROTOCOL,withContinuousPreference,isContinuousPreferenceRound} from './continuous-preference.mjs';
import {withContextChange} from './context-change.mjs';
import {buildOrdinalClosingRounds,buildOrdinalRefinementRound} from './ordinal-refinement.mjs';
import {buildFinalRefinementRounds} from './final-refinement.mjs';
import {choiceGridExposure,FAMILIARITY_SELECTION_PROTOCOL} from './discovery-grid.mjs';
import {isStudyEligibleArtwork} from './study-eligibility.mjs';
import {CURATION_SEQUENCE,hasRegionalCuration,allowedInCurationStage,isWesternAmericasWork} from './curation-sequence.mjs';
import {isReviewedVisualDescriptor} from './visual-descriptor-semantics.mjs';
import {routeCollection} from './collection-routing.mjs';
import {PANEL_OBJECTIVES,CANONICAL_COMPARISON_OBJECTIVES} from './curation-panel-objectives.mjs';
import {buildDiagnosticRound} from './explanation-followups.mjs';

export const JOURNEY_PROTOCOL='art-profile-50-v1';
export const JOURNEY_REVISION='art-profile-50-v18';
export const JOURNEY_VARIETY_POLICY='specific-question-variety-v2';
export const JOURNEY_LENGTH=50;
export const JOURNEY_MAX_LENGTH=JOURNEY_BLOCK_LIMIT*JOURNEY_LENGTH;
const FEATURES=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
const idAt=index=>'journey-'+String(index+1).padStart(3,'0');
const panelId=(panel,batchIndex)=>'journey-'+(batchIndex?'batch-'+String(batchIndex+1).padStart(3,'0')+'-':'')+'panel-'+String(panel).padStart(2,'0');
const ids=works=>works.map(work=>work.id);
const signature=works=>ids(works).sort().join('|');
const matchingIds=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const reviewed=work=>FEATURES.every(key=>Number.isFinite(work.features?.[key])&&work.features[key]>=0&&work.features[key]<=1||['narrative','atmosphere'].includes(key)&&work.features?.[key]===null);
function instrumentPool(works){
  const eligible=works.filter(reviewed),chosen=new Map();
  // These works bind source-question templates only. Actual journey stimuli are
  // selected independently below and remain attached to their own snapshots.
  for(const field of ['artist','movement']){const labels=new Set();for(const work of eligible){if(!work[field]||labels.has(work[field])||field==='artist'&&(work.artistKnown===false||/unidentified|unknown|anonymous|workshop|circle/i.test(work.artist)))continue;labels.add(work[field]);chosen.set(work.id,work);if(labels.size===4)break;}}
  for(const work of eligible){if(chosen.size>=32)break;chosen.set(work.id,work);}
  return [...chosen.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
const knownDistance=(a,b)=>{
  const keys=FEATURES.filter(key=>isReviewedVisualDescriptor(a,key)&&isReviewedVisualDescriptor(b,key));
  return keys.length?keys.reduce((sum,key)=>sum+Math.abs(a.features[key]-b.features[key]),0)/keys.length:0;
};

// The paired task returns after other paintings and other kinds of decision.
// A panel has one preference task, one other construct, and at most one appraisal.
const P=panel=>({task:'preference',panel});
const C=panel=>({task:'curiosity',panel});
const R=panel=>({task:'response',panel});
const U=panel=>({task:'connection',panel});
const M=panel=>({task:'meaning',panel});
const A=(panel,appraisal)=>({task:'appraisal',panel,appraisal});
const X=task=>({task});
const V=(panel,axis)=>({task:'appraisal-map',panel,axis});
const G=(mode,group)=>({task:'choice-grid',mode,group});
const SCHEDULE=[
  P(1),G('familiarity','a'),P(2),V(1,'achievement'),P(5),V(2,'achievement'),P(4),X('sorting'),G('shortlist','a'),P(3),
  G('familiarity','b'),P(6),P(7),P(8),V(5,'reading'),P(9),X('artist'),X('movement'),V(8,'returnResponse'),P(10),
  V(6,'achievement'),X('difficult-edit'),G('shortlist','b'),P(11),X('symbolism'),P(12),A(10,'surprise'),P(13),V(9,'reading'),P(14),
  X('statement'),X('sorting'),P(15),V(12,'achievement'),X('context'),X('curate'),P(16),V(14,'returnResponse'),P(17),X('symbolism'),
  P(18),G('shortlist','d'),V(8,'reading'),V(15,'returnResponse'),V(17,'achievement'),X('closing'),X('closing'),X('closing'),X('closing'),X('closing')
];
const CONTRAST_SLOTS=new Map([[14,'chronology'],[18,'neighbour'],[26,'keep-leave'],[41,'same-subject']]);
const INITIAL_FAMILIARITY_IDS=['add-van-eyck-arnolfini','study-rembrandt-night-watch','friedrich-wanderer','study-munch-scream','study-wood-american-gothic','study-raphael-school-athens','study-botticelli-birth-venus','millais-ophelia','study-posada-catrina','velazquez-las-meninas','study-bruegel-hunters-snow','hokusai-mount-fuji'];

/** Propose new, unshown panels. Existing saved definitions remain the caller's authority. */
export function createJourneyStimulusPlan({works,rounds=[],answers={},batchIndex=0,seed='journey-batch-'+batchIndex,reservationPlan,adaptivePlan,quotas,firstWorkIds}={}){
  const capturedFirstIds=firstWorkIds||uniqueIds(rounds.filter(round=>round?.evidence?.construct==='preference'&&Number.isInteger(round.evidence.panelNumber)&&(round.evidence.batchIndex??Math.floor((Number(round.id?.slice(8)||1)-1)/50))===0).flatMap(round=>ids(round.works||[])));
  const notes=journeyCurationNotes(works,reservationPlan,{firstWorkIds:capturedFirstIds.length?capturedFirstIds:undefined,startBatch:Math.max(1,batchIndex)}),plannedQuotas=quotas||journeyAdaptiveQuotas(batchIndex,notes.reservePools);
  const active=notes.collectionRouting?new Set(notes.collectionRouting.activeStudyWorkIds):null,planningWorks=active?works.filter(work=>active.has(work.id)):works;
  const result=planStimulusPanels({works:planningWorks,rounds,answers,batchIndex,seed,reservationPlan:reservationPlan?notes.reservePools:undefined,adaptivePlan,curationNotes:notes,quotas:plannedQuotas});if(notes.collectionRouting)result.reservations.collectionRouting=structuredClone(notes.collectionRouting);return result;
}
export function journeyAdaptiveQuotas(batchIndex,reservationPlan){
  const target=reservationPlan?.['batch'+(batchIndex+1)]?.length||0;
  if(target>0&&reservationPlan?.collectionRouting)return {exactRepeats:1,recontextualizations:0,challenges:1,minExplorationShare:16/18};
  if(target>60)return {exactRepeats:1,recontextualizations:0,challenges:1,minExplorationShare:16/18};
  if(target>48)return {exactRepeats:2,recontextualizations:0,challenges:1,minExplorationShare:15/18};
  return target>44?{exactRepeats:2,recontextualizations:1,challenges:3}:batchIndex===2?{exactRepeats:2,recontextualizations:1,challenges:4}:{};
}

/** Fresh classical/Mexican comparisons; an existing reservation remains authoritative. */
export function journeyCurationNotes(works,reservationPlan,{firstWorkIds,startBatch=1}={}){
  const available=new Set(works.map(work=>work.id)),newIds=['add-caravaggio-judith-barberini','add-caravaggio-supper-emmaus-1601','add-caravaggio-taking-christ','add-bruegel-triumph-death','add-velazquez-spinners','add-van-eyck-arnolfini','add-renoir-boating-party','add-marc-animal-destinies'];
  if(!newIds.every(id=>available.has(id))||reservationPlan&&reservationPlan.batch2?.length===42&&reservationPlan.batch3?.length===42){
    if(!reservationPlan)return CURATION_NOTES;
    const notes=structuredClone(CURATION_NOTES);notes.reservePools=extendStimulusReservations({works,firstWorkIds:firstWorkIds||notes.proposedFirst18Panels.flatMap(panel=>panel.workIds),reservationPlan,startBatch,deferEastAsian:hasRegionalCuration(works),curationNotes:notes});return notes;
  }
  const notes=structuredClone(CURATION_NOTES),replacements={3:['study-cassatt-child-bath','study-morisot-cradle','add-siqueiros-madre-nina','cassatt-omnibus'],6:['add-caravaggio-judith-barberini','add-caravaggio-taking-christ','opening-cma-92937','almeida-junior-saudade'],7:['study-seurat-grande-jatte','study-raphael-school-athens','add-caravaggio-supper-emmaus-1601','add-orozco-buffoons'],9:['velazquez-las-meninas','holbein-ambassadors','add-velazquez-spinners','add-van-eyck-arnolfini'],13:['bosch-garden-delights','study-bruegel-hunters-snow','add-bruegel-triumph-death','add-kandinsky-composition-seven'],15:['turner-burning-parliament','study-delacroix-liberty','bonheur-horses','add-marc-animal-destinies'],17:['study-matisse-dance','add-renoir-boating-party','study-tanner-banjo-lesson','add-izquierdo-sorrowful-friday'],18:['add-dali-transparent-simulacrum','add-carrington-dagobert','add-miro-harlequin-carnival','add-rivera-zapatista-landscape']};
  const regional=hasRegionalCuration(works);
  if(regional)Object.assign(replacements,{5:['mondrian-composition','study-kandinsky-composition-eight','add-gerzso-water-mansion','add-pollock-convergence'],11:['cezanne-mountain','friedrich-wanderer','velasco-valley-mexico','req-birkhauser-worlds-wound'],12:['req-brueghel-hearing','req-caravaggio-david-borghese','req-dore-quixote-library','req-rivera-controller-universe'],14:['study-posada-catrina','goya-saturn','ethiopian-apostles','req-patinir-massys-temptations']});
  const canonicalReady=regional&&['canon-leonardo-last-supper','canon-caravaggio-calling-matthew','canon-siqueiros-collective-suicide','canon-siqueiros-echo-scream','canon-kahlo-two-fridas','canon-varo-creation-birds'].every(id=>available.has(id));
  const comparisonsReady=canonicalReady&&['canon-hopper-nighthawks','canon-picasso-guernica','canon-goya-third-may','study-wood-american-gothic','req-rivera-alameda'].every(id=>available.has(id));
  if(canonicalReady)Object.assign(replacements,{13:['bosch-garden-delights','study-bruegel-hunters-snow','goya-saturn','add-kandinsky-composition-seven'],2:['study-vermeer-pearl','study-vermeer-milkmaid','study-rembrandt-night-watch','add-rivera-portrait-frida'],7:['study-raphael-school-athens','canon-leonardo-last-supper','canon-caravaggio-calling-matthew','add-orozco-buffoons'],9:['velazquez-las-meninas','holbein-ambassadors','add-van-eyck-arnolfini','add-hammershoi-room-wife'],14:['study-posada-catrina','add-bruegel-triumph-death','brueghel-sight','req-patinir-massys-temptations'],15:['turner-burning-parliament','study-delacroix-liberty','bonheur-horses','canon-siqueiros-collective-suicide'],16:['millais-ophelia','canon-siqueiros-echo-scream','van-gogh-night-cafe','canon-kahlo-two-fridas'],17:['study-matisse-dance','study-seurat-grande-jatte','study-tanner-banjo-lesson','add-izquierdo-sorrowful-friday'],18:['canon-varo-creation-birds','add-carrington-dagobert','add-miro-harlequin-carnival','add-rivera-zapatista-landscape']});
  if(comparisonsReady)Object.assign(replacements,{11:['cezanne-mountain','friedrich-wanderer','velasco-valley-mexico','study-bruegel-hunters-snow'],13:['bosch-garden-delights','req-rivera-alameda','goya-saturn','canon-goya-third-may'],15:['turner-burning-parliament','canon-picasso-guernica','bonheur-horses','canon-siqueiros-collective-suicide'],16:['van-gogh-night-cafe','canon-hopper-nighthawks','canon-kahlo-two-fridas','study-wood-american-gothic']});
  for(const panel of notes.proposedFirst18Panels){if(replacements[panel.panel]){panel.workIds=replacements[panel.panel];panel.primaryQuestion='Record each painting’s overall appeal; compare different treatments without forcing a rank.';panel.targetFeature=null;panel.targetContrast=null;panel.sharedGround='A deliberate set of different treatments for separate overall liking ratings.';panel.confounds=['Artist, subject, period, material, reproduction and several visual qualities can vary together.'];panel.sourceUrls=panel.workIds.map(id=>works.find(work=>work.id===id)?.sourceUrl).filter(Boolean);delete panel.contrastPairs;}}
  if(canonicalReady){notes.qualityDesign='predeclared-source-quality-crossings-v1';for(const panel of notes.proposedFirst18Panels){const objective=(comparisonsReady?CANONICAL_COMPARISON_OBJECTIVES[panel.panel]:null)||PANEL_OBJECTIVES[panel.panel];panel.galleryTitle=objective.title;panel.comparisonObjectives=structuredClone(objective);panel.primaryQuestion=objective.purposes.join(' ');panel.questionUse='Continuous personal appeal, followed by separately reported judgments where planned.';panel.confounds=uniqueIds([...(panel.confounds||[]),'These are deliberately crossed examples, not randomized isolation of a single visual cause.']);}}
  const first=new Set(notes.proposedFirst18Panels.flatMap(panel=>panel.workIds));
  if(first.size!==72||[...first].some(id=>!available.has(id)))return CURATION_NOTES;
  const routed=regional&&(!reservationPlan||reservationPlan.collectionRouting)?routeCollection(works,reservationPlan?.collectionRouting,notes):null,activeWorks=routed?routed.studyWorks:works;
  if(routed)notes.collectionRouting=routed.metadata;
  const remaining=activeWorks.map(work=>work.id).filter(id=>!first.has(id)),priority=['matejko-stanczyk','brueghel-sight',...activeWorks.filter(work=>work.curationRole==='canonical-priority').map(work=>work.id)],ordered=uniqueIds([...priority.filter(id=>remaining.includes(id)),...(CURATION_NOTES.reservePools?.batch2||[]).filter(id=>remaining.includes(id)),...remaining.sort()]);
  notes.reservePools=extendStimulusReservations({works:activeWorks,firstWorkIds:firstWorkIds||[...first],reservationPlan,startBatch,preferredOrder:ordered,deferEastAsian:regional,curationNotes:notes});if(routed)notes.reservePools.collectionRouting=structuredClone(routed.metadata);notes.maximumLandmarksPerPanel=4;notes.studyDesignRevision=comparisonsReady?'canonical-comparisons-20261117-v1':regional?'overall-appeal-classics-mexico-v2':'overall-appeal-classics-mexico-v1';if(regional)notes.curationSequence=CURATION_SEQUENCE;return notes;
}
const uniqueIds=values=>[...new Set(values)];

/** Distinguish the design proposal from the questions actually bound to a saved first block. */
export function bindJourneyStimulusPlan(selection,rounds){
  const panels=new Map();
  for(const round of rounds){const legacy=/^panel-(\d+)$/.exec(round.evidence?.setId||''),number=round.evidence?.panelNumber||(legacy?Number(legacy[1]):null);if(round.kind==='spectrum'&&round.criterion==='preference'&&round.evidence?.construct==='preference'&&!round.evidence?.repeatOf&&Number.isInteger(number)&&!panels.has(number))panels.set(number,{panelNumber:number,roundId:round.id,workIds:Array.isArray(round.works)?ids(round.works):[...(round.workIds||[])],role:round.evidence?.role||null,journeyRevision:round.evidence?.journeyRevision||null});}
  const boundPanels=[...panels.values()].sort((a,b)=>a.panelNumber-b.panelNumber),mismatches=(selection?.panels||[]).flatMap((panel,index)=>matchingIds(panel.workIds,panels.get(index+1)?.workIds)?[]:[index+1]),exact=selection?.complete===true&&boundPanels.length===18&&!mismatches.length,boundMainWorkIds=[...new Set(boundPanels.flatMap(panel=>panel.workIds))];
  return {version:1,plannerRevision:selection?.revision||null,reservations:structuredClone(selection?.reservations||{batch2:[],batch3:[],scope:'first-preference-ratings'}),bindingStatus:exact?'exact-curated-plan':'saved-or-fallback-bindings',firstPlan:exact?structuredClone(selection):null,boundPanels,boundMainWorkIds,boundMainWorkCount:boundMainWorkIds.length,proposalMismatchPanels:mismatches,scope:'Bound question stimuli, not completed first ratings or observed exposure.'};
}

const APPRAISALS={
  surprise:{construct:'reported-unexpectedness',title:'How unexpected is each painting?',hint:'Place each painting by how surprising it is to you. This is separate from whether you prefer it.',scale:{left:'As expected',right:'Unexpected'},target:'Reported unexpectedness beside independent preference and familiarity.',limits:['Unexpectedness can concern subject, style or presentation. It is not a novelty-seeking trait or an inferred emotion.']},
  density:{
    construct:'perceived-visual-density',
    title:'How much is there to take in?',
    hint:'Rate the amount of visual detail in each painting. This is separate from how much you like it.',
    scale:{left:'Visually sparse',right:'Visually dense'},
    target:'Reported visual density compared with preference for the same paintings.',
    limits:['Density is a reported impression. It is not objective complexity, and the scale does not explain a preference by itself.']
  },
  openness:{
    construct:'interpretive-openness',
    title:'How much does each painting leave open?',
    hint:'Place each painting by how many possible meanings it seems to leave you. An unclear subject can still feel settled in meaning.',
    scale:{left:'One clear reading',right:'Several possible readings'},
    target:'Reported interpretive openness compared with preference and understanding.',
    limits:['Several possible meanings, difficulty understanding and liking are distinct judgments. This is not a measure of tolerance for ambiguity.']
  },
  figures:{
    construct:'importance-of-figures',
    title:'How important are the people in each painting to your reaction?',
    hint:'Think about the people in the painting, rather than how many there are. If there are no people, use the left end.',
    scale:{left:'Not important',right:'Very important'},
    target:'Reported importance of depicted people compared with preference for the same paintings.',
    limits:['This asks for a stated explanation after viewing. It cannot establish what caused the earlier preference. Absence of people is not absence of human meaning.']
  },
  surface:{
    construct:'attention-to-making',
    title:'How much are you looking at how it was made?',
    hint:'Think about paint, marks, lines and composition. Rate your attention to the making of each work.',
    scale:{left:'Little attention to its making',right:'A lot of attention to its making'},
    target:'Reported attention to making compared with preference and felt attention.',
    limits:['Attention to making can coexist with attention to the subject. This is a self-report, not eye tracking or proof of a motive.']
  }
};
const CONTEXT_CLAIM={id:'contextEffect',text:'Learning the story behind a painting rarely changes how much I like it.'};
const LIMITS=[
  'The same paintings return under different instructions. These responses are related observations, not independent replications.',
  'Subject, colour, composition, familiarity and context can vary together. A matching pattern suggests an explanation to test, not a causal motive or a personality type.'
];

function country(work){return work.country||work.origin||'';}
function hash(value){let n=2166136261;for(const char of String(value))n=Math.imul(n^char.charCodeAt(0),16777619)>>>0;return n;}
function specificQuestionIds(round,answer){
  if(!round||round.unavailable||round.kind==='statements'||round.evidence?.stimulusVisibility==='not-shown'||round.kind==='exercise'&&!['sorting','difficult-edit','edit'].includes(round.exerciseKind))return [];
  const paged=choiceGridExposure(round,answer);if(paged)return [...paged.presentedIds];
  return [...new Set([...(round.works||[]).map(work=>work.id),...(round.anchorWorks||[]).map(work=>work.id),...(round.anchorIds||[])].filter(id=>typeof id==='string'))];
}
function selectWorks(pool,size,{uses,lastSeen,index,distinctField,focus,mode='main',panel=1,seed='journey',plannedUses,plannedLastSeen,avoidIds=new Set(),audit}={}){
  const varietyMode=mode==='grid'||mode==='match',selectionLastSeen=varietyMode&&plannedLastSeen?plannedLastSeen:lastSeen;
  const selected=[];
  while(selected.length<size){
    let candidates=pool.filter(work=>!selected.some(other=>other.id===work.id)&&(!distinctField||!selected.some(other=>other[distinctField]===work[distinctField])));
    if(!candidates.length)throw Error('This collection cannot supply distinct works for the planned question.');
    if(varietyMode){const unavoided=candidates.filter(work=>!avoidIds.has(work.id));if(unavoided.length)candidates=unavoided;}
    // An independent question should spend its places on less-used images.
    // Recognition tiers must not remove those candidates before this decision.
    if(varietyMode){
      const spaced=candidates.filter(work=>!selectionLastSeen.has(work.id)||index-selectionLastSeen.get(work.id)>3);
      if(spaced.length)candidates=spaced;
      const leastCumulative=Math.min(...candidates.map(work=>plannedUses?.get(work.id)||0));
      candidates=candidates.filter(work=>(plannedUses?.get(work.id)||0)===leastCumulative);
    }
    const least=Math.min(...candidates.map(work=>uses.get(work.id)||0));
    // Coverage comes before annotated contrast. Unknown attributes never become zero.
    candidates=candidates.filter(work=>(uses.get(work.id)||0)===least);
    const desiredTier=preferredTier(selected.length,mode,panel),tierPool=candidates.filter(work=>recognitionTier(work)===desiredTier);if(!varietyMode&&tierPool.length)candidates=tierPool;
    const desired=focus&&selected.length<2?selected.length===0?'low':'high':null;
    const score=work=>{
      const recent=selectionLastSeen.has(work.id)?Math.min(8,index-selectionLastSeen.get(work.id)):8;
      const artist=selected.some(other=>other.artist===work.artist)?0:3;
      const place=country(work)&&!selected.some(other=>country(other)===country(work))?2:0;
      const movement=selected.some(other=>other.movement===work.movement)?0:1;
      const spread=selected.length?selected.reduce((sum,other)=>sum+knownDistance(work,other),0)/selected.length:0;
      const value=focus&&isReviewedVisualDescriptor(work,focus)?work.features[focus]:undefined;
      const contrast=Number.isFinite(value)&&desired?(desired==='low'?1-value:value)*4:0;
      const recognitionTiePreference=varietyMode&&recognitionTier(work)===desiredTier ? .5 : 0;
      return recent*2+artist+place+movement+spread*3+contrast+recognitionTiePreference;
    };
    candidates.sort((a,b)=>score(b)-score(a)||hash(seed+'|'+a.id)-hash(seed+'|'+b.id)||a.id.localeCompare(b.id));
    selected.push(candidates[0]);
  }
  if(varietyMode&&audit){const selectedAvoidedIds=selected.filter(work=>avoidIds.has(work.id)).map(work=>work.id),recentFallbackWorkIds=selected.filter(work=>selectionLastSeen.has(work.id)&&index-selectionLastSeen.get(work.id)<=3).map(work=>work.id);Object.assign(audit,{policy:JOURNEY_VARIETY_POLICY,scope:'Cumulative planned appearances in specific questions and sorting/edit sets; museum offered trays and text-only statements excluded. Not measured viewing.',avoidWorkIds:[...avoidIds].sort(),selectedAvoidedIds,fallback:selectedAvoidedIds.length>0,fallbackReason:selectedAvoidedIds.length?'The eligible catalogue cannot supply the complete distinct question while avoiding all known neighbouring images.':null,plannedUseCountsBefore:Object.fromEntries(selected.map(work=>[work.id,plannedUses?.get(work.id)||0])),coveragePriority:'least-cumulative-specific-appearances',recognitionPriority:'soft-tie-preference',minimumPreferredRoundDistance:4,recentFallbackWorkIds});}
  selected.forEach(work=>uses.set(work.id,(uses.get(work.id)||0)+1));
  return selected.sort((a,b)=>hash(seed+'|display|'+index+'|'+a.id)-hash(seed+'|display|'+index+'|'+b.id)||a.id.localeCompare(b.id));
}

/** Only shown snapshots are fixed. A fresh journey uses the current sourced catalogue. */
export function buildJourneyRounds(works,answers={},options={}){
  const offset=options.offset??0,batchIndex=options.batchIndex??Math.floor(offset/JOURNEY_LENGTH);
  const preferenceProtocol=options.preferenceProtocol??CONTINUOUS_PROTOCOL,comparisonFirst=preferenceProtocol!==APPEAL_PROTOCOL;
  if(![CONTINUOUS_PROTOCOL,COMPARISON_PROTOCOL,APPEAL_PROTOCOL].includes(preferenceProtocol))throw Error('Unknown painting-preference protocol.');
  if(!Number.isInteger(offset)||offset<0||offset%JOURNEY_LENGTH||!Number.isInteger(batchIndex)||batchIndex<0)throw Error('Journey batches need a non-negative batch index and an offset in steps of fifty.');
  const at=index=>idAt(offset+index),selectionSeed=String(options.seed??'journey-batch-'+batchIndex);
  const schedule=SCHEDULE.map((spec,index)=>preferenceProtocol!==CONTINUOUS_PROTOCOL?spec:index===5?V(2,'attention'):index===16&&batchIndex>0?G('shortlist','c'):index===33?U(12):index===37?V(13,'returnResponse'):spec);
  const pool=[...works].filter(work=>isStudyEligibleArtwork(work)&&typeof work.id==='string'&&work.title&&work.image&&work.sourceUrl).sort((a,b)=>a.id.localeCompare(b.id));
  if(pool.length<12||new Set(ids(pool)).size!==pool.length)throw Error('The journey needs at least twelve distinct, sourced artworks.');
  const regional=hasRegionalCuration(pool),curationNotes=journeyCurationNotes(pool,options.reservationPlan),activeIds=curationNotes.collectionRouting?new Set(curationNotes.collectionRouting.activeStudyWorkIds):null,activeSourcePool=activeIds?pool.filter(work=>activeIds.has(work.id)):pool,stagePool=regional?activeSourcePool.filter(work=>allowedInCurationStage(work,batchIndex,curationNotes)):activeSourcePool,westernPool=stagePool.filter(work=>isWesternAmericasWork(work,curationNotes)||work.id==='study-hokusai-great-wave'),activityPool=regional&&batchIndex<4&&westernPool.length>=12?westernPool:stagePool,initialFamiliarityIds=regional?INITIAL_FAMILIARITY_IDS.map(id=>id==='hokusai-mount-fuji'?'study-van-gogh-self-portrait':id==='study-rembrandt-night-watch'?'study-monet-japanese-footbridge':id):INITIAL_FAMILIARITY_IDS;
  // Bank IDs are backlinks to source instruments, not claims that their old bindings were shown.
  const bank=buildStudyRounds(instrumentPool(pool),200);
  const usedTemplates=new Set();
  const templateFor=predicate=>{
    const template=bank.find(round=>!usedTemplates.has(round.id)&&predicate(round));
    if(!template)throw Error('A source question is unavailable.');
    usedTemplates.add(template.id);return template;
  };
  const history=new Map((options.history||[]).filter(round=>round&&typeof round.id==='string'&&Array.isArray(round.works)).map(round=>[round.id,round]));
  for(const previous of history.values()){
    const number=/^journey-(\d+)$/.exec(previous.id);
    if(number&&Number(number[1])>offset&&Number(number[1])<=offset+JOURNEY_LENGTH&&bank.some(round=>round.id===previous.bankRoundId))usedTemplates.add(previous.bankRoundId);
  }
  const noteCandidates=['holbein-ambassadors','matejko-stanczyk','bosch-garden-delights','redon-violette','tanner-waters'].map(id=>pool.find(work=>work.id===id)).filter(Boolean);
  const priorNotes=new Set([...history.values()].filter(round=>round.kind==='context').flatMap(round=>ids(round.works)));
  const symbolismRounds=new Map(),plannedReveals=[...history.values()],availableNotes=availableSymbolismContent(stagePool);
  for(const [slot,preferredId] of [[24,regional?'add-varo-harmony':'green-tara'],[34,'add-watts-hope'],[39,'holbein-ambassadors']]){
    const used=new Set(plannedReveals.filter(item=>item.kind==='context').flatMap(item=>ids(item.works)));
    const fresh=availableNotes.filter(note=>!used.has(note.workId)),content=(batchIndex===0?fresh.find(note=>note.workId===preferredId):null)||fresh[0];
    const built=buildSymbolismRound({id:at(slot),works:stagePool,rounds:plannedReveals,...(content?{contentId:content.id}:{allowRevisit:true})});
    if(built){symbolismRounds.set(slot,built);plannedReveals.push(built);}
  }
  const noteWork=symbolismRounds.get(34)?.works[0]||noteCandidates.find(work=>!priorNotes.has(work.id))||noteCandidates[batchIndex%noteCandidates.length];
  if(!noteWork)throw Error('The journey needs a sourced painting with an interpretive note.');
  const explicit=Array.isArray(options.panels)?options.panels:options.panels?.panels,automatic=explicit?null:createJourneyStimulusPlan({works:pool,rounds:[...history.values()],answers,batchIndex,seed:selectionSeed,reservationPlan:options.reservationPlan}),supplied=explicit||(automatic?.complete?automatic.panels:null);
  if(supplied&&(!Array.isArray(supplied)||supplied.length!==18))throw Error('An adaptive journey needs eighteen artwork panels.');
  const panels=new Map(),panelSetIds=new Map(),gridPanels=new Map(),gridSelectionAudits=new Map(),gridUses=new Map(),panelUses=new Map(),recognitionUses=new Map(),lastSeen=new Map(),plannedSpecificUses=new Map(),plannedSpecificLastSeen=new Map();
  const registerSpecificQuestion=(round,index)=>{for(const workId of specificQuestionIds(round,answers[round.id])){plannedSpecificUses.set(workId,(plannedSpecificUses.get(workId)||0)+1);if(Number.isInteger(index))plannedSpecificLastSeen.set(workId,Math.max(plannedSpecificLastSeen.get(workId)??-Infinity,index));}};
  // With 54–72 works, each painting can appear in one initial small panel.
  const extra=Math.max(0,Math.min(18,pool.length-54));
  const panelSize=panel=>panel<=extra?4:3;
  for(const round of history.values()){
    const sourceIndex=/^journey-(\d+)$/.exec(round.id);
    if(!sourceIndex||Number(sourceIndex[1])<=offset)registerSpecificQuestion(round,sourceIndex?Number(sourceIndex[1])-1:null);
    if(sourceIndex&&Number(sourceIndex[1])<=offset&&round.kind!=='statements')round.works.forEach(work=>lastSeen.set(work.id,Math.max(lastSeen.get(work.id)??-Infinity,Number(sourceIndex[1])-1)));
    const legacyPanel=/^panel-(\d+)$/.exec(round.evidence?.setId||''),number=round.evidence?.panelNumber||(legacyPanel?Number(legacyPanel[1]):null),sourceBatch=round.evidence?.batchIndex??Math.floor((Number(sourceIndex?.[1]||1)-1)/JOURNEY_LENGTH);
    if((['art-profile-50-v2','art-profile-50-v3','art-profile-50-v4','art-profile-50-v5','art-profile-50-v6','art-profile-50-v7','art-profile-50-v8','art-profile-50-v9','art-profile-50-v10','art-profile-50-v11','art-profile-50-v12','art-profile-50-v13','art-profile-50-v14','art-profile-50-v15','art-profile-50-v16','art-profile-50-v17',JOURNEY_REVISION].includes(round.evidence?.journeyRevision)||legacyPanel)&&sourceBatch===batchIndex&&Number.isInteger(number)&&number>=1&&number<=18&&round.works.every(work=>pool.some(item=>item.id===work.id))&&!panels.has(number)){
      panels.set(number,round.works.map(work=>pool.find(item=>item.id===work.id)));
      if(round.evidence?.setId)panelSetIds.set(number,round.evidence.setId);
      round.works.forEach(work=>panelUses.set(work.id,(panelUses.get(work.id)||0)+1));
    }
  }
  if(!supplied&&batchIndex===0&&!panels.has(1)){const openingIds=['van-gogh-starry-night','study-leonardo-mona-lisa','study-hokusai-great-wave','klimt-kiss'],anchorWorks=openingIds.map(id=>pool.find(work=>work.id===id)).filter(Boolean);if(anchorWorks.length===4){panels.set(1,anchorWorks);anchorWorks.forEach(work=>panelUses.set(work.id,(panelUses.get(work.id)||0)+1));}}
  if(supplied)for(const [index,panel] of supplied.entries()){
    if(!panel||!Array.isArray(panel.workIds)||panel.workIds.length<2||panel.workIds.length>4||new Set(panel.workIds).size!==panel.workIds.length||!panel.workIds.every(id=>pool.some(work=>work.id===id))||panel.construct&&panel.construct!=='preference')throw Error('Adaptive panels need two to four distinct, available preference works.');
    if(!panels.has(index+1))panels.set(index+1,panel.workIds.map(id=>pool.find(work=>work.id===id)));
  }
  for(const previous of history.values())if(previous.kind==='choice-grid'&&previous.evidence?.batchIndex===batchIndex&&previous.evidence?.gridGroup&&previous.works.every(work=>pool.some(other=>other.id===work.id))){gridPanels.set(previous.evidence.gridGroup,previous.works.map(work=>pool.find(other=>other.id===work.id)));gridSelectionAudits.set(previous.evidence.gridGroup,previous.evidence.varietySelection?structuredClone(previous.evidence.varietySelection):{policy:JOURNEY_VARIETY_POLICY,preservedCachedBinding:true,scope:'A previously bound grid identity is preserved before applying new spacing choices.'});}
  const sequence=[],closing=comparisonFirst?buildOrdinalClosingRounds({works:activeSourcePool,offset,seed:selectionSeed,preferenceProtocol}):buildFinalRefinementRounds({works:pool,offset,seed:selectionSeed}),earlyRefinements=new Map(comparisonFirst?[[18,'bridge-high-high'],...(preferenceProtocol===CONTINUOUS_PROTOCOL?[]:[[22,'dislikes']]),[26,'bridge-low-low']]:[]);
  const firstSortingPlan=()=>{
    const earlier=sequence.filter(source=>source.kind==='spectrum'&&source.evidence?.construct==='preference'&&source.evidence.unconditional!==false),offered=new Map(earlier.flatMap(source=>source.works.map(work=>[work.id,work]))),preferred=regional?['van-gogh-starry-night','klimt-kiss','study-hokusai-great-wave','study-vermeer-milkmaid','mondrian-composition','study-kandinsky-composition-eight','add-rivera-portrait-frida','add-tamayo-still-life-foot']:['van-gogh-starry-night','klimt-kiss','study-hokusai-great-wave','study-vermeer-milkmaid','blanchard-still-life','add-tamayo-still-life-foot','add-rivera-portrait-frida','hiroshige-sudden-shower','add-siqueiros-madre-nina','study-cassatt-child-bath'],chosen=uniqueIds([...preferred.filter(id=>offered.has(id)),...offered.keys()]).slice(0,8);
    if(chosen.length<8){const fallback=selectArrangementStimuli({works:activityPool,batchIndex,kind:'sorting'});return {...fallback,fallback:true,fallbackReason:'Fewer than eight distinct earlier appeal paintings were available; the reviewed arrangement rotation was retained.'};}
    return {status:'ready',kind:'sorting',contentId:'earlier-appeal-sorting-'+batchIndex,revision:'earlier-appeal-sorting-v1',batchIndex,workIds:chosen,sourceRoundIds:earlier.filter(source=>source.works.some(work=>chosen.includes(work.id))).map(source=>source.id),sourceUrls:chosen.map(id=>offered.get(id).sourceUrl),curationNotes:['Group eight paintings from the earlier appeal questions. The offered set is linked by exact identities; completed preference evidence remains separate.'],fallback:false,reuseRule:'The later sorting question reuses this exact eight-work set.',scope:'Previously offered appeal paintings, not an inferred favourite set or proof of a completed appeal rating.'};
  };
  const contrastReservations=new Map(),contrastContentAt=localIndex=>{
    if(!contrastReservations.has(localIndex))contrastReservations.set(localIndex,selectContrastContent({works:activityPool,rounds:[...[...history.values()].filter(source=>!/^journey-\d+$/.test(source.id)||Number(source.id.slice(8))<=offset),...sequence],answers,seed:selectionSeed+'-contrast-'+localIndex,kind:CONTRAST_SLOTS.get(localIndex),batchIndex,notes:curationNotes}));
    return contrastReservations.get(localIndex);
  };
  const knownIdsAt=localIndex=>{
    if(localIndex<0||localIndex>=schedule.length)return [];
    const bound=history.get(at(localIndex))||sequence[localIndex];if(bound)return specificQuestionIds(bound);
    if(earlyRefinements.has(localIndex)||localIndex>=45)return [];
    if(CONTRAST_SLOTS.has(localIndex)){const content=contrastContentAt(localIndex);return content?.status==='ready'?uniqueIds([...(content.workIds||[]),...(content.anchorWorks||[]).map(work=>work.id),...(content.anchorIds||[])]):[];}
    const spec=schedule[localIndex];
    if(spec.panel&&panels.has(spec.panel))return ids(panels.get(spec.panel));
    if(spec.task==='context'||spec.task==='symbolism')return [symbolismRounds.get(localIndex)?.works[0]?.id||noteWork.id];
    if(spec.task==='choice-grid'){const group='batch-'+batchIndex+'-grid-'+spec.group;if(gridPanels.has(group))return ids(gridPanels.get(group));if(batchIndex===0&&spec.group==='a'&&initialFamiliarityIds.every(id=>pool.some(work=>work.id===id)))return [...initialFamiliarityIds];}
    if(['sorting','difficult-edit'].includes(spec.task)){const source=spec.task==='sorting'&&localIndex===31?(history.get(at(7))||sequence[7]):null;if(source)return specificQuestionIds(source);const plan=spec.task==='sorting'?firstSortingPlan():selectArrangementStimuli({works:activityPool,batchIndex,kind:spec.task});if(plan.status==='ready')return [...plan.workIds];}
    return [];
  };
  const avoidFor=(localIndex,gridGroup)=>{
    const occurrences=gridGroup?schedule.flatMap((spec,i)=>spec.task==='choice-grid'&&spec.group===gridGroup&&!CONTRAST_SLOTS.has(i)?[i]:[]):[localIndex];
    const neighbours=[...new Set(occurrences.flatMap(i=>[i-1,i+1]).filter(i=>i>=0&&i<schedule.length))];
    return {ids:new Set(neighbours.flatMap(i=>knownIdsAt(i))),roundIds:neighbours.filter(i=>knownIdsAt(i).length).map(at)};
  };
  for(const [index,scheduled] of schedule.entries()){
    let spec=scheduled;
    const id=at(index),globalIndex=offset+index,previous=history.get(id);
    if(previous){
      sequence.push(structuredClone(previous));
      if(previous.kind!=='statements')[...previous.works,...(previous.anchorWorks||[])].forEach(work=>lastSeen.set(work.id,globalIndex));
      registerSpecificQuestion(previous,globalIndex);
      continue;
    }
    if(preferenceProtocol===CONTINUOUS_PROTOCOL){
      const diagnosticKind=index===31?'grouping':([14,17,22,26,49].includes(index)?'appeal-investigation':null);
      if(diagnosticKind){
        const pending=buildDiagnosticRound({works:activeSourcePool,id,kind:diagnosticKind,seed:selectionSeed});
        pending.evidence.diagnostic.policy='appeal-investigation-v1';
        pending.evidence.diagnostic.mode=index===17?'transfer':index===26&&batchIndex<3?'explore':'local';
        sequence.push({...pending,evidence:{...pending.evidence,journeyRevision:JOURNEY_REVISION,batchIndex,selectionSeed}});continue;
      }
    }
    if(index>=45||earlyRefinements.has(index)){const pending=index>=45?closing[index-45]:buildOrdinalRefinementRound({works:activeSourcePool,id,role:earlyRefinements.get(index),slot:0,offset,seed:selectionSeed,preferenceProtocol});sequence.push({...pending,evidence:{...pending.evidence,journeyRevision:JOURNEY_REVISION,batchIndex,selectionSeed}});continue;}
    const contrastKind=CONTRAST_SLOTS.get(index),contrastContent=contrastKind?contrastContentAt(index):null;
    const contrastRound=contrastContent?.status==='ready'?buildContrastRound({works:pool,content:contrastContent,id,batchIndex}):null;
    if(contrastRound)spec={task:'contrast',contrastKind};
    if(spec.panel&&!panels.has(spec.panel))panels.set(spec.panel,selectWorks(pool,panelSize(spec.panel),{
      uses:panelUses,lastSeen,index:globalIndex,seed:selectionSeed,panel:spec.panel,focus:spec.panel===6?'humanity':spec.panel===9?'complexity':spec.panel===12?'abstraction':null
    }));
    const art=panels.get(spec.panel),setId=spec.panel?panelSetIds.get(spec.panel)||panelId(spec.panel,batchIndex):'journey-batch-'+(batchIndex+1)+'-'+spec.task+'-'+(index+1),plannedPanel=supplied?.[spec.panel-1],planMatches=!!plannedPanel&&matchingIds(plannedPanel.workIds,art?ids(art):[]),metadataPanel=planMatches?plannedPanel:null;
    let template,round,evidence;
    if(contrastRound){
      round=contrastRound;evidence={...contrastRound.evidence,newInstrument:true,instrumentRevision:contrastRound.contrastKind+'-v1',selectionMethod:'curated-contrast-content',baselineLinkPlan:structuredClone(contrastContent.baselineLinks),baselineFallback:contrastContent.selectionAudit.baselineFallback,baselineFallbackReason:contrastContent.selectionAudit.baselineFallbackReason,limits:[...contrastContent.limits,...contrastRound.residualConfounds,...LIMITS]};
    }else if(['preference','curiosity','response','connection'].includes(spec.task)){
      template=templateFor(item=>item.evidence.construct===spec.task&&item.evidence.role==='discovery');
      if(spec.task==='preference')round={kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Place the paintings by preference. Equal positions are fine.',scale:{left:'Less preferred',right:'More preferred'},works:art};
      if(spec.task==='curiosity')round={kind:'spectrum',criterion:'interest',title:'How much do you want to understand each painting?',hint:'Rate your wish to investigate. You can be curious about a painting you do not like.',scale:{left:'Little wish to investigate',right:'Strong wish to investigate'},works:[...art].reverse()};
      if(spec.task==='response')round={kind:'grid',axis:'response',title:'Tension and attention.',hint:'Place each painting by the tension you feel and how much it holds your attention. These can move separately.',works:[...art].reverse()};
      if(spec.task==='connection')round={kind:'grid',axis:'connection',title:'What feels clear, and what feels personal?',hint:'Place each painting by how well you understand it and how personally it connects. These can move separately.',works:[...art].reverse()};
      evidence={construct:spec.task,family:spec.task==='preference'?'individual-choice':spec.task==='curiosity'?'interest':spec.task==='response'?'felt-response':'appraisal',role:spec.task==='preference'?'discovery':'check',limits:[...LIMITS,...(template.evidence.limits||[])]};
      if(spec.task==='preference'&&plannedPanel){
        if(plannedPanel.role==='repeat'){
          const repeatOf=plannedPanel.repeatOf||plannedPanel.sourceRoundId,source=history.get(repeatOf)||plannedPanel.promptSnapshot;
          const sourceIds=source?.works?ids(source.works):source?.workIds;
          if(plannedPanel.exactRepeat!==true||typeof repeatOf!=='string'||!source||source.kind!=='spectrum'||source.criterion!=='preference'||source.evidence?.construct!=='preference'||!['individual-choice','feature-check','unconditional-preference','adaptive-preference'].includes(source.evidence?.family)||source.evidence.unconditional===false||source.brief||source.evidence.brief||source.anchorWorks?.length||source.anchorIds?.length||typeof source.title!=='string'||typeof source.hint!=='string'||!Array.isArray(sourceIds)||[...sourceIds].sort().join('|')!==signature(art))throw Error('An exact preference repeat needs the original unconditional prompt and identical artwork set.');
          const sourceNumber=/^journey-(\d+)$/.exec(repeatOf);if(sourceNumber&&Number(sourceNumber[1])>=globalIndex+1)throw Error('A repeat must reference an earlier presentation.');
          round={...round,title:source.title,hint:source.hint,works:[...sourceIds].reverse().map(workId=>pool.find(work=>work.id===workId))};
          if(source.scale)round.scale=structuredClone(source.scale);else delete round.scale;
          evidence={...evidence,role:'repeat',repeatOf,exactRepeat:true,sourceRoundId:repeatOf,presentationOrder:'reversed-from-source',sourcePrompt:{title:source.title,hint:source.hint,criterion:source.criterion,...(source.scale?{scale:structuredClone(source.scale)}:{})},limits:['This deliberately repeats the same unconditional preference question and artwork set. Time, familiarity, earlier context and memory can affect a changed answer.',...LIMITS]};
          if(isContinuousPreferenceRound(source)){evidence.continuousProtocol=CONTINUOUS_PROTOCOL;evidence.measurementScope=source.evidence.measurementScope;evidence.positionMeaning='personal-appeal-level-and-gap';evidence.showNumericScale=true;}else if(isOverallAppealRound(source)){evidence.appealProtocol=source.evidence.appealProtocol;evidence.measurementScope=source.evidence.measurementScope;}else if(isComparisonPreferenceRound(source)){evidence.comparisonProtocol=COMPARISON_PROTOCOL;evidence.measurementScope=source.evidence.measurementScope;evidence.positionMeaning='order-and-exact-ties-only';evidence.showNumericScale=false;}
        }else evidence.role=planMatches&&['probe','recontextualization','challenge'].includes(plannedPanel.role)?'probe':'discovery';
      }
    }else if(spec.task==='appraisal-map'){
      const definitions={attention:{title:'What draws you in? What holds your attention?',hint:'Across: your personal appeal. Up: how much the painting holds your attention right now. Attention can differ from liking.',construct:'reported-attention',sources:['https://doi.org/10.1371/journal.pone.0178899']},achievement:{title:'What do you like? What do you admire?',hint:'Across: how much you like the whole painting. Up: how much you admire the way it was made.',construct:'perceived-achievement',sources:['https://journals.sagepub.com/doi/10.1177/0956797611400915','https://online.ucpress.edu/collabra/article/9/1/87489/197632/The-Effort-Heuristic-Revisited-Mixed-Results-for']},reading:{title:'What is clear? What is left open?',hint:'How clear the scene feels runs across. The number of possible readings runs up.',construct:'scene-and-meaning',sources:['https://pmc.ncbi.nlm.nih.gov/articles/PMC3210939/']},returnResponse:{title:'How does it feel? Would you return?',hint:'Comforting to unsettling runs across. Your wish to return runs up.',construct:'tension-and-return',sources:['https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0178899']}};
      const definition=definitions[spec.axis];round={kind:'grid',axis:spec.axis,axisDefinition:structuredClone(AXES[spec.axis]),title:definition.title,hint:definition.hint,works:[...art].reverse()};
      evidence={construct:definition.construct,family:'reported-appraisal',role:'check',newInstrument:true,instrumentRevision:spec.axis+'-v1',sourceUrls:definition.sources,limits:['Research informs the separate judgments. These exact questions and thresholds remain unvalidated prototype instruments.','These are personal reports about the reproduction; admiration is not objective skill, and return is an intention rather than observed behaviour.',...LIMITS]};
    }else if(spec.task==='choice-grid'){
      const group='batch-'+batchIndex+'-grid-'+spec.group;
      const reusedGrid=gridPanels.has(group);
      if(!reusedGrid){const avoid=avoidFor(index,spec.group),audit={independentNeighbourRoundIds:avoid.roundIds},anchors=spec.mode==='familiarity'&&spec.group==='a'&&batchIndex===0?initialFamiliarityIds.map(id=>pool.find(work=>work.id===id)).filter(Boolean):[];if(anchors.length===12){gridPanels.set(group,anchors);anchors.forEach(work=>gridUses.set(work.id,(gridUses.get(work.id)||0)+1));Object.assign(audit,{policy:JOURNEY_VARIETY_POLICY,fixedFirstFamiliarity:true,scope:'A curated twelve-landmark familiarity set; its paired shortlist preserves exact identities.',avoidWorkIds:[...avoid.ids].sort(),selectedAvoidedIds:anchors.filter(work=>avoid.ids.has(work.id)).map(work=>work.id),fallback:false,plannedUseCountsBefore:Object.fromEntries(anchors.map(work=>[work.id,plannedSpecificUses.get(work.id)||0]))});}else gridPanels.set(group,selectWorks(activityPool,12,{uses:gridUses,lastSeen,index:globalIndex,mode:'grid',seed:selectionSeed+'-'+group,plannedUses:plannedSpecificUses,plannedLastSeen:plannedSpecificLastSeen,avoidIds:avoid.ids,audit}));gridSelectionAudits.set(group,audit);}
      const chosen=gridPanels.get(group),shown=spec.mode==='shortlist'?[...chosen.slice(5),...chosen.slice(0,5)].reverse():chosen;
      round={kind:'choice-grid',selectionMode:spec.mode,maxChoices:shown.length,title:spec.mode==='familiarity'?'Before today, which had you seen?':'Which would you keep?',hint:spec.mode==='familiarity'?'Select the paintings you recognise.':'Select any paintings you would keep. Tap again to change a choice.',works:shown};
      const familiarId=spec.mode==='shortlist'&&['a','b'].includes(spec.group)?at(spec.group==='a'?1:10):null;
      evidence={construct:spec.mode==='familiarity'?'reported-prior-familiarity':'unranked-subset-selection',family:'selection-grid',role:'check',gridGroup:group,setId:group,newInstrument:true,instrumentRevision:spec.mode==='shortlist'?'keep-selection-grid-v2':'familiarity-grid-v1',varietyPolicy:JOURNEY_VARIETY_POLICY,varietySelection:{...structuredClone(gridSelectionAudits.get(group)),reusedCachedIdentity:reusedGrid},...(familiarId?{familiarityRoundId:familiarId}:{}),...(index===46?{lateReturnFallback:{minimumRounds:8,reason:'No nonopening ordinary quartet met the conservative exposure gap.'}}:{}),sourceUrls:['https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.694927/full'],limits:['A familiar painting is self-reported recognition, not expertise.','You may select any number. Unselected paintings are not dislikes or equal ranks.','Unchecked paintings were not marked familiar; this does not prove they have never been seen.',...LIMITS]};
    }else if(spec.task==='bridge-preference'){
      template=templateFor(item=>item.kind==='spectrum'&&item.evidence.construct==='preference');
      const preparation=selectSubjectBaselinePair({works:pool,rounds:[...[...history.values()].filter(source=>!/^journey-\d+$/.test(source.id)||Number(source.id.slice(8))<=offset),...sequence],answers,seed:selectionSeed+'-subject-baseline',batchIndex,notes:curationNotes});
      const a=panels.get(17)||pool.slice(0,4),b=panels.get(18)||pool.slice(4,8),chosen=preparation.status==='ready'?preparation.workIds.map(workId=>pool.find(work=>work.id===workId)):[a[0],b.find(work=>work.id!==a[0].id)||pool.find(work=>work.id!==a[0].id)];
      round={kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Place both paintings by preference. Equal positions are fine.',scale:{left:'Less preferred',right:'More preferred'},works:chosen};
      evidence={construct:'preference',family:'individual-choice',role:'probe',bridgeComparison:true,subjectBaselinePreparation:structuredClone(preparation),...(preparation.status==='ready'?{preparesContrastContentId:preparation.preparesContrastContentId}:{}),limits:['This links works from separate earlier ordinary questions. It is not another discovery set or a registered prediction test.','A prepared source is only a future comparison opportunity until an actual complete answer is recorded. No later choice or numeric rank is assumed.',...LIMITS]};
    }else if(spec.task==='meaning'){
      template=templateFor(item=>item.kind==='grid'&&item.axis==='connection');
      round={kind:'grid',axis:'meaning',title:'Meaning and interpretation.',hint:'Place each painting by how much meaning it seems to suggest and how much you want to explore that meaning.',works:[...art].reverse()};
      evidence={construct:'meaning',family:'interpretive-appraisal',role:'check',questionTarget:'Suggested meaning and interest in interpretation compared with preference for the same paintings.',limits:['This records perceived meaning and interest in interpreting it. It is not a test of a correct interpretation or proof that symbolism caused a preference.',...LIMITS]};
    }else if(spec.task==='appraisal'){
      template=templateFor(item=>item.evidence.family==='contextual-choice');
      const {construct,title,hint,scale,target,limits}=APPRAISALS[spec.appraisal];
      round={kind:'spectrum',criterion:'preference',title,hint,scale:{...scale},works:[...art].reverse()};
      evidence={construct,family:'looking-appraisal',role:'check',questionTarget:target,limits:[...limits,...LIMITS]};
    }else if(spec.task==='statement'){
      template=templateFor(item=>item.kind==='statements');
      round={kind:'statements',title:'Agree or disagree.',hint:'',works:[noteWork],statements:[{...CONTEXT_CLAIM,...(preferenceProtocol===CONTINUOUS_PROTOCOL?{text:'Learning the story behind a painting rarely changes how much I appreciate it.'}:{})}]};
      evidence={construct:'self-description',family:'reported-rule',role:'check',statementTest:'contextEffect',checkId:'journey-context-effect-'+batchIndex,contextRoundId:at(34),referenceOnlyWorkIds:[noteWork.id],stimulusVisibility:'not-shown',limits:['This broad claim is compared with the later response about the note for one painting, under its captured instructions. A single exception does not establish a general trait.',...LIMITS]};
    }else if(spec.task==='artist'||spec.task==='movement'){
      const field=spec.task==='artist'?'artist':'movement';
      template=templateFor(item=>item.kind==='match'&&item.field===field);
      const earlierAppeal=new Set(sequence.filter(item=>!item.unavailable&&item.kind==='spectrum'&&item.criterion==='preference').flatMap(item=>ids(item.works))),tasteLinked=preferenceProtocol===CONTINUOUS_PROTOCOL&&field==='artist';
      const available=activityPool.filter(work=>work[field]&&(field!=='artist'||work.artistKnown!==false&&!/unknown|unidentified|anonymous|workshop|circle/i.test(work.artist))),linked=available.filter(work=>earlierAppeal.has(work.id)),eligible=tasteLinked&&new Set(linked.map(work=>work[field])).size>=4?linked:available;
      const avoid=avoidFor(index),audit={independentNeighbourRoundIds:avoid.roundIds},chosen=selectWorks(eligible,4,{uses:recognitionUses,lastSeen,index:globalIndex,seed:selectionSeed,mode:'match',distinctField:field,plannedUses:plannedSpecificUses,plannedLastSeen:plannedSpecificLastSeen,avoidIds:avoid.ids,audit});
      round={kind:'match',field,title:field==='artist'?'Match the paintings to the artists.':'Match the paintings to a style or tradition.',hint:'Move each painting to a label. Use Not sure when you do not know.',works:chosen,options:[...chosen].reverse().map((work,i)=>({id:field+'-'+i,label:work[field]}))};
      evidence={construct:field==='artist'?'recognition-artist':'recognition-movement',family:'cued-recognition',role:'check',varietyPolicy:JOURNEY_VARIETY_POLICY,varietySelection:audit,...(preferenceProtocol===CONTINUOUS_PROTOCOL?{instrumentRevision:'cued-attribution-v2',selectionMethod:tasteLinked?'taste-linked-artist-check':'cued-label-check',...(tasteLinked?{bindFromShownAppeal:true}:{})}:{}),limits:[...template.evidence.limits]};
    }else if(spec.task==='context'||spec.task==='symbolism'){
      template=templateFor(item=>item.kind==='context');
      round={kind:'context',contextMode:'preference-before-after-v1',title:'Look, then read.',hint:'Rate how much you like the painting before reading its story, then rate it again.',works:[noteWork]};
      evidence={construct:'context-liking-change',family:'context-change',role:'check',checkId:'journey-context-effect-'+batchIndex,claimRoundId:at(30),storyPreviouslyShown:priorNotes.has(noteWork.id),priorMeasureRoundIds:sequence.filter(item=>item.kind!=='statements'&&item.works.some(work=>work.id===noteWork.id)&&['preference','curiosity'].includes(item.evidence.construct)).map(item=>item.id),limits:['Both ratings concern the same reproduction. Reading, repeated viewing, elapsed time and the earlier claim occur together. A changed rating does not isolate the story as a cause.','This is a five-point change in reported liking for one painting, not an estimate of how context changes all preferences.',...(priorNotes.has(noteWork.id)?['This interpretive note has already appeared in this history. It is a revisit, not a new-information comparison.']:[])]};
      const symbolic=symbolismRounds.get(index);
      if(symbolic){template=null;round={...symbolic};evidence={...symbolic.evidence,newInstrument:true,instrumentRevision:symbolic.symbolismProtocol,storyPreviouslyShown:priorNotes.has(symbolic.works[0].id),...(index===34?{checkId:'journey-context-effect-'+batchIndex,claimRoundId:at(30)}:{}),priorMeasureRoundIds:sequence.filter(item=>item.kind==='spectrum'&&item.criterion==='preference'&&item.works.some(work=>work.id===symbolic.works[0].id)).map(item=>item.id)};}
      else if(index!==34){delete evidence.claimRoundId;delete evidence.checkId;}

    }else{
      const kind=spec.task;
      const arrangementPlan=kind==='sorting'?index===31?sequence[7].evidence?.arrangementSelection:firstSortingPlan():kind==='difficult-edit'?selectArrangementStimuli({works:activityPool,batchIndex,kind}):null;
      const sortingAnchors=['van-gogh-starry-night','study-hokusai-great-wave','study-vermeer-pearl','study-munch-scream','klimt-kiss','velazquez-las-meninas','velasco-valley-mexico','study-abanindranath-bharat-mata'].map(id=>pool.find(work=>work.id===id)).filter(Boolean);const editAnchors=['van-gogh-starry-night','monet-water-lilies','study-hokusai-great-wave','study-monet-japanese-footbridge'].map(id=>pool.find(work=>work.id===id)).filter(Boolean);
      const chosen=kind==='sorting'&&index===31?sequence[7].works:arrangementPlan?.status==='ready'?arrangementPlan.workIds.map(id=>pool.find(work=>work.id===id)):kind==='sorting'?sortingAnchors.length===8?sortingAnchors:SORTING_WORKS.map(workId=>pool.find(work=>work.id===workId)).filter(Boolean):kind==='difficult-edit'?editAnchors.length===4?editAnchors:['velasco-valley-mexico','cezanne-mountain','shen-clouds','hokusai-mount-fuji'].map(workId=>pool.find(work=>work.id===workId)).filter(Boolean):activeSourcePool;
      if(chosen.length<(kind==='curate'?12:kind==='sorting'?8:4))throw Error('This collection cannot supply the planned exercise.');
      round={kind:'exercise',exerciseKind:kind,title:kind==='sorting'?'Group the paintings.':kind==='curate'?'Arrange the rooms.':'Remove one painting.',hint:kind==='sorting'?'Drag related paintings together. You can stack them.':kind==='curate'?'Group the paintings across the rooms.':'Keep three paintings on the wall.',works:kind==='curate'?museumLibraryOrder(chosen):chosen};
      evidence={construct:kind,family:'contextual-arrangement',role:index===31?'repeat':'discovery',...(index===31?{repeatOf:at(7)}:{}),...(arrangementPlan?.status==='ready'&&matchingIds(arrangementPlan.workIds,ids(chosen))?{arrangementSelection:structuredClone(arrangementPlan)}:arrangementPlan?{arrangementFallback:arrangementPlan.reason||'The preserved source set remains authoritative.'}:{}),limits:['Grouping or omitting a painting in this arrangement does not establish liking or dislike.']};
    }
    const paired=spec.panel?schedule.flatMap((item,i)=>item.panel===spec.panel&&i!==index?[at(i)]:[]):[];
    const earlier=sequence.filter(item=>spec.panel&&item.evidence.setId===setId).map(item=>item.id);
    if(preferenceProtocol===CONTINUOUS_PROTOCOL&&round.kind==='choice-grid'&&round.selectionMode==='familiarity'){
      round={...round,title:'Which paintings had you seen before today?',hint:'Select any you had seen before Art Atlas. Tap again to undo.'};
      evidence={...evidence,familiarityProtocol:FAMILIARITY_SELECTION_PROTOCOL};
    }
    const priorIds=ids(round.works).filter(workId=>lastSeen.has(workId));
    const adaptiveSelection=metadataPanel?Object.fromEntries(['focus','provisionalHypothesis','provisionalPrediction','holdoutUnit','comparisonNovel','artworksMayBeFamiliar','delay','dependencyGroup'].filter(key=>metadataPanel[key]!==undefined).map(key=>[key,structuredClone(metadataPanel[key])])):null;
    let full={...round,id,format:round.kind,...(template?{bankRoundId:template.id}:{}),evidence:{
      bankRevision:template?.evidence.bankRevision||JOURNEY_PROTOCOL,journeyRevision:JOURNEY_REVISION,batchIndex,selectionSeed,...(regional?{curationSequence:CURATION_SEQUENCE}:{}),
      ...(template?{sourceBankRoundId:template.id,sourceBinding:'journey-selected-works'}:{}),
      setId,...(spec.panel?{panelNumber:spec.panel,pairedRoundIds:paired,priorMeasureRoundIds:earlier}:{}),
      ...evidence,...(contrastContent&&!contrastRound?{contrastFallback:{kind:contrastKind,reason:contrastContent.reason||'The reviewed content did not bind to this catalogue.'}}:{}),labelExposure:batchIndex?'after-earlier-batch-label-games':index<16?'before-journey-label-games':index===16?'first-cued-label-game':'after-journey-label-games',
      selectionMethod:evidence.selectionMethod||(supplied?(metadataPanel?.plannerRevision||automatic?'curated-stimulus-plan':'adaptive-panel-plan'):'coverage-first-source-and-visual-diversity'),...(metadataPanel?{selectionReason:metadataPanel.selectionReason||'Supplied adaptive panel.',evidenceRoundIds:(metadataPanel.evidenceRoundIds||[]).filter(id=>typeof id==='string'),adaptivePanelRole:metadataPanel.role||'discovery',adaptiveSelection,...(metadataPanel.plannerDiagnostic?{plannerDiagnostic:structuredClone(metadataPanel.plannerDiagnostic)}:{}),...(metadataPanel.qualityDiagnostic?{qualityDiagnostic:structuredClone(metadataPanel.qualityDiagnostic)}:{}),...(metadataPanel.editorialBrief?{editorialBrief:structuredClone(metadataPanel.editorialBrief)}:{}),...(metadataPanel.plannerRevision?{stimulusPlannerRevision:metadataPanel.plannerRevision}:{})}:plannedPanel?{panelBindingMismatch:true,proposedWorkIds:[...plannedPanel.workIds]}:{}),priorPlannedWorkIds:priorIds,
      priorExposure:priorIds.length?'some-works-previously-planned':'first-planned-presentation',
      ...(spec.panel?{plannedSetSignature:signature(art)}:{})
    }};
    if(full.kind==='spectrum'&&full.criterion==='preference'&&full.evidence.construct==='preference'&&!full.evidence.repeatOf&&full.evidence.role!=='repeat')full=preferenceProtocol===CONTINUOUS_PROTOCOL?withContinuousPreference(full):comparisonFirst?withComparisonPreference(full):withOverallAppeal(full);
    if(full.kind==='context'&&preferenceProtocol===CONTINUOUS_PROTOCOL)full=withContextChange(full);
    sequence.push(full);
    if(full.kind!=='statements')[...full.works,...(full.anchorWorks||[])].forEach(work=>lastSeen.set(work.id,globalIndex));
    registerSpecificQuestion(full,globalIndex);
  }
  for(const round of sequence)if(!history.has(round.id)&&round.evidence?.panelNumber)round.evidence.pairedRoundIds=sequence.filter(other=>other.id!==round.id&&other.evidence?.setId===round.evidence.setId&&signature(other.works)===signature(round.works)).map(other=>other.id);
  return sequence;
}
