// Item instances have stable IDs. Longer paths extend the same earlier path.
// A repeated artwork is not an independent new stimulus or a personality measure.
import {isStudyEligibleArtwork} from './study-eligibility.mjs';
import {isReviewedVisualDescriptor,FEATURE_SEMANTIC_VERSION} from './visual-descriptor-semantics.mjs';
export const STUDY_LENGTHS = Object.freeze([50,100,150,200,250,300]);
export const STUDY_BANK_REVISION = 'art-study-300-v3';
export const MAX_STUDY_LENGTH=300;
const FEATURES=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
const f=(w,key)=>isReviewedVisualDescriptor(w,key)?w.features[key]:null;
const mean=xs=>xs.reduce((sum,x)=>sum+x,0)/(xs.length||1);
const signature=ws=>ws.map(w=>w.id).sort().join('|');
const idList=ws=>ws.map(w=>w.id);
const separation=(a,b)=>mean(FEATURES.filter(key=>f(a,key)!==null&&f(b,key)!==null).map(key=>Math.abs(f(a,key)-f(b,key))));
const CHOICE_LIMITS=['The artwork attributes are provisional annotations; several properties change together.','These are repeated decisions using one small catalogue, not independent replications or population norms.'];
const MAP_LIMITS=['The map records a reported response to these reproductions. It does not establish a stable trait or a causal motive.','Tension and involvement are distinct from pleasantness and arousal.'];
const CONTEXT_LIMITS=['This is a choice under an explicit brief. It is not automatically an unconditional preference, curiosity score or dislike.','The offered alternatives, repeated viewing and imagined setting can affect the choice.'];

const CONTEXTS = [
  ['repeated-viewing','Which would you keep looking at over several weeks?','Arrange the works for repeated viewing.','Less likely to return to','More likely to return to'],
  ['first-stop','Which would you choose as the first stop in a gallery?','Choose for the start of a visit.','Less likely to start with','More likely to start with'],
  ['study-intent','Which would you spend an afternoon studying?','Choose for sustained study, even if your preference order differs.','Less likely to study','More likely to study'],
  ['return-visit','Which would you come back to see on another day?','Choose for a return visit.','Less likely to revisit','More likely to revisit'],
  ['limited-visit','Five minutes left. Which work gets your time?','Compare the works under the same short time limit.','Less likely to choose','More likely to choose'],
  ['collection-intent','Which would you include in a small collection for yourself?','Choose what belongs in your own collection.','Less likely to include','More likely to include'],
  ['history-interest','Which work would you choose to learn the history of?','Choose for its historical context.','Less interested in its history','More interested in its history'],
  ['technique-interest','Which would you choose to learn how it was made?','Choose for the making of the work.','Less interested in its making','More interested in its making'],
  ['detail-interest','Which would you most want to inspect in greater detail?','Choose for a closer view of the reproduction.','Less likely to inspect','More likely to inspect'],
  ['context-interest','Which would you most want a museum note about?','Choose where more context would be useful to you.','Less interested in a note','More interested in a note'],
  ['discussion-intent','Which would you choose to discuss with another person?','Choose a work for a conversation.','Less likely to discuss','More likely to discuss'],
  ['new-visitor','Someone new to art can see one work. Which would you choose for them?','Choose for that visitor, using only the works offered.','Less likely to show','More likely to show'],
  ['last-stop','Which would you choose as the final stop in a visit?','Choose for the end of a visit.','Less likely to finish with','More likely to finish with'],
  ['current-viewing','Which fits what you want to look at right now?','Answer for this moment. This is kept separate from repeated-viewing intent.','Less fitting right now','More fitting right now'],
  ['unhurried-viewing','Which would you choose when you have no need to hurry?','Choose for an unhurried visit.','Less likely to stay with','More likely to stay with'],
  ['slowing-down','Which would you choose when you want to slow down?','This asks what you would choose for that purpose, not how the work has already made you feel.','Less likely to choose','More likely to choose'],
  ['focus-intent','Which would you choose when you want something to concentrate on?','Choose for that purpose.','Less likely to choose','More likely to choose'],
  ['challenge-intent','Which would you choose when you want to work at understanding something?','Choose for the challenge you want, if any. Equal positions are valid.','Less likely to choose','More likely to choose'],
  ['companion','Which would you hang beside this work?','The work above stays. Choose its companion.','Weaker companion here','Stronger companion here',1],
  ['bridge','Which work would connect these two?','The two works above stay. Choose a work for the transition between them.','Weaker connection here','Stronger connection here',2],
  ['deliberate-contrast','Which would you use to introduce a deliberate contrast?','The work above stays. Choose a contrasting neighbour.','Less useful for this contrast','More useful for this contrast',1],
  ['wall-addition','Which would complete this wall for you?','The two works above stay. Choose what you would add.','Weaker addition here','Stronger addition here',2],
  ['quiet-pair','Which would you pair with this work for a quieter room?','Choose for the room you would find quieter. Image sparsity alone does not define that feeling.','Less fitting for this room','More fitting for this room',1],
  ['entrance-pair','Which would you put beside this work at the entrance?','The work above stays. Choose a pair for the entrance.','Less fitting at the entrance','More fitting at the entrance',1]
];

const SELF_DESCRIPTIONS = [
  ['quiet','I usually prefer art that leaves me feeling calm.','quiet'],
  ['curiosity','The paintings I prefer are also the ones I want to understand.','curiosity'],
  ['clarity','I tend to prefer paintings I find easy to understand.','clarity'],
  ['colour','Colour often decides whether I want to keep looking.'],
  ['people','A human figure makes a work more interesting to me.'],
  ['story','I prefer a work when I can follow what is happening.'],
  ['structure','I usually prefer a clear structure over a crowded composition.'],
  ['familiarity','Recognising an artist changes how much I want to look.'],
  ['history','Learning a work\'s history usually makes me want to stay with it longer.'],
  ['unease','I can prefer a work even when it leaves me uneasy.'],
  ['return','The work I choose first is usually the one I want to return to.'],
  ['company','A work can become more interesting because of what hangs beside it.']
];

function hash(text) {let result=2166136261;for(const c of text)result=Math.imul(result^c.charCodeAt(0),16777619)>>>0;return result;}
function random(seed) {let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
function shuffle(items,seed) {const result=[...items],next=random(seed);for(let i=result.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function quartetSets(pool,count=32) {
  const available=new Map(),next=random(hash(pool.map(w=>w.id).join('|'))),desired=Math.min(1000,pool.length*(pool.length-1)*(pool.length-2)*(pool.length-3)/24);
  for(let attempt=0;attempt<24000&&available.size<desired;attempt++) {
    const chosen=new Set();while(chosen.size<4)chosen.add(Math.floor(next()*pool.length));
    const works=[...chosen].map(i=>pool[i]);available.set(signature(works),works);
  }
  const candidates=[...available.entries()].sort(([a],[b])=>a.localeCompare(b)),seen=new Map(pool.map(w=>[w.id,0])),result=[];
  for(let index=0;index<count;index++) {
    const key=FEATURES[index%FEATURES.length];let best=-Infinity,bestIndex=-1;
    for(let i=0;i<candidates.length;i++) {
      const [,works]=candidates[i],values=works.map(w=>f(w,key)).filter(value=>value!==null),contrast=values.length>=2?Math.max(...values)-Math.min(...values):0;
      const coverage=works.reduce((sum,w)=>sum+1/(1+seen.get(w.id)),0),artists=new Set(works.map(w=>w.artist)).size;
      const spread=mean(works.flatMap((a,i)=>works.slice(i+1).map(b=>separation(a,b))));
      const score=coverage*2+contrast*.5+spread*.5+artists*.04;
      if(score>best+1e-9){best=score;bestIndex=i;}
    }
    const [,chosen]=candidates.splice(bestIndex,1)[0];chosen.forEach(w=>seen.set(w.id,seen.get(w.id)+1));result.push(shuffle(chosen,hash('panel-'+index)));
  }
  return result;
}
function exactPreferenceAnswer(round,answer) {
  return answer?.confirmed===true&&answer.criterion==='preference'&&Array.isArray(answer.workIds)&&answer.workIds.join('|')===idList(round.works).join('|')&&answer.positions&&Object.keys(answer.positions).length===round.works.length&&round.works.every(w=>Number.isInteger(answer.positions[w.id])&&answer.positions[w.id]>=0&&answer.positions[w.id]<=100);
}
function provisionalDirection(rounds,answers,key) {
  const tasks=rounds.filter(r=>r.evidence.construct==='preference'&&r.evidence.role==='discovery'&&r.works.every(work=>f(work,key)!==null)&&exactPreferenceAnswer(r,answers[r.id]));
  const values=tasks.map(r=>{const a=answers[r.id];return mean(r.works.flatMap((left,i)=>r.works.slice(i+1).map(right=>((a.positions[left.id]-a.positions[right.id])/100)*(f(left,key)-f(right,key)))));});
  const value=mean(values),enough=new Set(tasks.map(r=>signature(r.works))).size>=3&&new Set(tasks.flatMap(r=>r.works.map(w=>w.artist))).size>=4;
  return {direction:enough&&Math.abs(value)>=.025?Math.sign(value):0,trainingRoundIds:tasks.map(r=>r.id)};
}
function checkPair(pool,key,used,rounds,answers,index) {
  const estimate=provisionalDirection(rounds,answers,key),pairs=[];
  for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++) {
    const a=pool[i],b=pool[j],pairKey=signature([a,b]);
    const contrast=f(a,key)!==null&&f(b,key)!==null?Math.abs(f(a,key)-f(b,key)):null,other=mean(FEATURES.filter(k=>k!==key&&f(a,k)!==null&&f(b,k)!==null).map(k=>Math.abs(f(a,k)-f(b,k))));
    pairs.push({works:[a,b],key:pairKey,contrast,other,score:contrast===null?-2-.6*other:contrast-.6*other});
  }
  const unseen=pairs.filter(p=>!used.has(p.key)),eligible=unseen.length?unseen:pairs;
  eligible.sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
  const selected=eligible[0],comparisonNovel=!used.has(selected.key);
  const works=shuffle(selected.works,hash('check-'+index)),prediction=comparisonNovel&&estimate.direction&&selected.contrast>=.2?selected.works.slice().sort((a,b)=>estimate.direction*(f(b,key)-f(a,key)))[0].id:null;
  return {works,contrastKey:key,contrast:selected.contrast,otherFeatureDistance:selected.other,provisionalPrediction:prediction,trainingRoundIds:estimate.trainingRoundIds,comparisonNovel,holdoutUnit:comparisonNovel?'new-comparison':null,artworksMayBeFamiliar:true,selectionMethod:selected.contrast===null?'comparison-coverage-without-reviewed-target':'annotated-feature-contrast',...(['narrative','atmosphere'].includes(key)&&selected.contrast!==null?{featureSemanticVersion:FEATURE_SEMANTIC_VERSION}:{}),...(selected.contrast===null?{targetDescriptorUnavailable:true}:{} )};
}
function anchorsFor(pool,choices,count,index) {
  const rest=pool.filter(w=>!choices.some(c=>c.id===w.id));
  return shuffle(rest,hash('anchor-'+index)).slice(0,count);
}
function matchingWorks(pool,field,index) {
  const candidates=field==='artist'?pool.filter(w=>w.artistKnown!==false&&!/unidentified|unknown|anonymous|workshop|circle/i.test(w.artist)):pool;
  const unique=new Map();for(const w of shuffle(candidates,hash('labels-'+index)))if(w[field]&&!unique.has(w[field]))unique.set(w[field],w);
  if(unique.size<4)throw Error('The study needs four distinct '+field+' labels.');
  return [...unique.values()].slice(0,4);
}

/** Later checks can use earlier answers. The UI must freeze a round when first shown. */
export function buildStudyRounds(works,target=50,answers={},options={}) {
  if(!STUDY_LENGTHS.includes(target))throw Error('Choose a 50, 100, 150, 200, 250 or 300-interaction path.');
  if(!answers||typeof answers!=='object'||Array.isArray(answers))answers={};
  const pool=[...works].filter(w=>isStudyEligibleArtwork(w)&&typeof w.id==='string'&&w.features&&w.title&&w.image).sort((a,b)=>a.id.localeCompare(b.id));
  if(pool.length<12||new Set(pool.map(w=>w.id)).size!==pool.length)throw Error('The study needs at least twelve distinct, sourced artworks.');
  if(pool.some(w=>FEATURES.some(key=>!(['narrative','atmosphere'].includes(key)&&w.features[key]===null)&&(!Number.isFinite(w.features[key])||w.features[key]<0||w.features[key]>1))))throw Error('Study planning needs finite supplied descriptors or explicit literal-field nulls; unknown values cannot be treated as zero.');
  const history=new Map((Array.isArray(options?.history)?options.history:[]).filter(r=>r&&typeof r.id==='string'&&Array.isArray(r.works)&&r.works.length&&r.works.every(w=>pool.some(item=>item.id===w.id))).map(r=>[r.id,r]));
  const sets=quartetSets(pool,target>200?57:32),rounds=[],usedPairs=new Set();let repeatIndex=0,checkIndex=0;
  const append=(round,evidence)=>{
    const id='study-'+String(rounds.length+1).padStart(3,'0'),actual=history.get(id)||{...round,id,format:round.kind,evidence:{bankRevision:STUDY_BANK_REVISION,role:'discovery',labelExposure:'before-this-path-label-games',priorExposure:'unknown',...evidence}};
    rounds.push(actual);
    const exposed=[...(actual.works||[]),...(actual.anchorWorks||[])];
    for(let i=0;i<exposed.length;i++)for(let j=i+1;j<exposed.length;j++)usedPairs.add(signature([exposed[i],exposed[j]]));
  };
  for(let block=0;block<4;block++) {
    for(let local=0;local<8;local++) {
      const panel=block*8+local,art=sets[panel],setId='panel-'+String(panel+1).padStart(2,'0');
      append({kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Place each work from less preferred to more preferred. Equal positions are fine.',works:art},{setId,construct:'preference',family:'individual-choice',limits:CHOICE_LIMITS});
      append({kind:'spectrum',criterion:'interest',title:'Which would you like to understand?',hint:'Place each work by how much you want to understand it.',works:art},{setId,construct:'curiosity',family:'interest',limits:['Wanting to understand a work is distinct from preferring it.',...CHOICE_LIMITS]});
      append({kind:'grid',axis:'response',title:'How does each work affect you?',hint:'Tension runs across. How much it holds your attention runs up.',works:art},{setId,construct:'response',family:'felt-response',limits:MAP_LIMITS});
      append({kind:'grid',axis:'connection',title:'Understanding and connection.',hint:'Ease of understanding runs across. Personal connection runs up.',works:art},{setId,construct:'connection',family:'appraisal',limits:['Reported understanding is not a test of correct interpretation.',...MAP_LIMITS.slice(0,1)]});
      if(block<3) {
        const c=CONTEXTS[panel],anchorWorks=anchorsFor(pool,art,c[5]||0,panel);
        append({kind:'spectrum',criterion:'preference',title:c[1],hint:c[2]+' Equal positions are fine.',works:art,anchorWorks,scale:{left:c[3],right:c[4]}},{setId,construct:c[0],family:'contextual-choice',brief:c[1],anchorIds:idList(anchorWorks),limits:CONTEXT_LIMITS});
      }
      if([0,2,4,6].includes(local)) {
        const key=FEATURES[checkIndex%FEATURES.length],binding=checkPair(pool,key,usedPairs,rounds,answers,checkIndex++),{works:pairWorks,...checkEvidence}=binding;
        append({kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Compare this pair directly. Equal positions are fine.',works:pairWorks},{setId:'check-'+checkIndex,construct:'preference',family:'feature-check',role:binding.provisionalPrediction?'counterexample':'check',...checkEvidence,heldOut:binding.comparisonNovel,limits:['This is a new comparison only when its two works have not previously appeared together in this study. The artworks themselves may already be familiar.','The pair is selected by annotated feature contrast. Earlier answers can change the predicted winner, but do not make this a fully adaptive question selector.','Other features still differ; this does not isolate a cause or give an accuracy percentage.',...CHOICE_LIMITS]});
      }
      if([1,3,5].includes(local)) {
        const s=SELF_DESCRIPTIONS[block*3+Math.floor(local/2)];
        append({kind:'statements',title:'How would you describe your taste?',hint:'Answer one statement. Your choices are kept separately.',works:art,statements:[{id:s[0],text:s[1]}]},{setId,construct:'self-description',family:'reported-rule',statementTest:s[2]||null,role:'check',limits:['A broad self-description and choices in one small set can differ. This is not an honesty or self-awareness score.','Statements may influence later choices. Later observations are not blind to the wording.']});
      }
      if(block<3&&[2,5,7].includes(local)||block===3&&local===7) {
        const eligible=rounds.filter(r=>r.evidence.construct==='preference'&&r.evidence.role==='discovery'&&rounds.length-Number(r.id.slice(-3))>=10),original=eligible[(repeatIndex++)%eligible.length];
        append({...original,works:[...original.works].reverse()},{...original.evidence,role:'repeat',repeatOf:original.id,presentationOrder:'reversed',limits:['This repeats the same preference task with the same works in a changed display order. Memory, time, attention and ordering can contribute to a changed answer.','It is a within-session repeat, not independent validation or a stability score.']});
      }
    }
    if(block===3) {
      for(let i=0;i<5;i++) {
        const field=i%2?'movement':'artist',art=matchingWorks(pool,field,i),options=shuffle(art.map((w,j)=>({id:field+'-'+j,label:w[field]})),hash('options-'+i));
        append({kind:'match',field,title:field==='artist'?'Match works to artists.':'Match works to styles or traditions.',hint:'Move each work to a label. Not sure is always an option.',works:art,options},{setId:'labels-'+i,construct:field==='artist'?'recognition-artist':'recognition-movement',family:'cued-recognition',role:'check',labelExposure:i===0?'first-cued-label-game':'after-cued-labels',limits:['These are cued matches with a small offered set. They do not establish general expertise or prior familiarity.','Style and tradition labels are broad editorial categories. Earlier games can teach labels used later.']});
      }
      for(let i=0;i<5;i++) {
        const art=pool[(i*5+2)%pool.length];
        append({kind:'context',title:'What does this note change?',hint:'Read the source note, then report any change in your curiosity.',works:[art]},{setId:'note-'+i,construct:'context-change',family:'reported-context-effect',role:'check',labelExposure:'after-cued-labels',priorMeasureRoundIds:rounds.filter(r=>r.evidence.construct==='curiosity'&&r.works.some(w=>w.id===art.id)).map(r=>r.id),limits:['This is a reported change after reading. New information, repeated viewing and label exposure happen together.','Without a matched control, the note\'s causal effect is unresolved.']});
      }
    }
  }
  // Preserve the established first200-question instruments. The additional100
  // are a suffix with new panel identities, under the original relative scale.
  // They come after the label games, rather than pretending to be blind views.
  if(target>200)for(let panel=32;panel<57;panel++){
    const art=sets[panel],setId='panel-'+String(panel+1).padStart(2,'0'),common={setId,labelExposure:'after-this-path-label-games',limits:CHOICE_LIMITS};
    append({kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Place each work from less preferred to more preferred. Equal positions are fine.',works:art},{...common,construct:'preference',family:'individual-choice'});
    append({kind:'spectrum',criterion:'interest',title:'Which would you like to understand?',hint:'Place each work by how much you want to understand it.',works:art},{...common,construct:'curiosity',family:'interest',limits:['Wanting to understand a work is distinct from preferring it.',...CHOICE_LIMITS]});
    append({kind:'grid',axis:'response',title:'How does each work affect you?',hint:'Tension runs across. How much it holds your attention runs up.',works:art},{...common,construct:'response',family:'felt-response',limits:MAP_LIMITS});
    append({kind:'grid',axis:'connection',title:'Understanding and connection.',hint:'Ease of understanding runs across. Personal connection runs up.',works:art},{...common,construct:'connection',family:'appraisal',limits:['Reported understanding is not a test of correct interpretation.',...MAP_LIMITS.slice(0,1)]});
  }
  return rounds.slice(0,target);
}

export function studyBankSummary(works,target=200) {
  const rounds=buildStudyRounds(works,target),byKind={},byConstruct={};for(const r of rounds){byKind[r.kind]=(byKind[r.kind]||0)+1;byConstruct[r.evidence.construct]=(byConstruct[r.evidence.construct]||0)+1;}
  return {revision:STUDY_BANK_REVISION,interactions:rounds.length,artworks:new Set(rounds.flatMap(r=>idList([...r.works,...(r.anchorWorks||[])]))).size,byKind,byConstruct,repeats:rounds.filter(r=>r.evidence.repeatOf).length,reservedChecks:rounds.filter(r=>r.evidence.heldOut).length};
}
