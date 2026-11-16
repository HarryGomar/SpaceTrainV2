import test from 'node:test';
import assert from 'node:assert/strict';
import {withContinuousPreference,CONTINUOUS_PROTOCOL} from '../../public/art-atlas/continuous-preference.mjs';
import {withComparisonPreference} from '../../public/art-atlas/comparison-protocol.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';
import {buildTastePortrait} from '../../public/art-atlas/taste-portrait.mjs';
import {buildTasteAxes} from '../../public/art-atlas/taste-axes.mjs';
import {buildTastePatterns} from '../../public/art-atlas/taste-patterns.mjs';
import {buildTasteBoundaries} from '../../public/art-atlas/taste-boundaries.mjs';
import {validatedProfileEntries,buildPreferenceBasis} from '../../public/art-atlas/profile-evidence.mjs';
import {renderProfileEvidence} from '../../public/art-atlas/taste-portrait-parts.mjs';
import {comparisonReadout} from '../../public/art-atlas/profile-comparisons.mjs';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {buildClosingReadings} from '../../public/art-atlas/closing-readings.mjs';
import {buildOrdinalRefinementRound,bindOrdinalRefinementRound,CONTINUOUS_REFINEMENT_PROTOCOL} from '../../public/art-atlas/ordinal-refinement.mjs';

const ids=round=>round.works.map(work=>work.id);
const answer=(round,values)=>({confirmed:true,criterion:'preference',workIds:ids(round),positions:Object.fromEntries(round.works.map((work,index)=>[work.id,values[index]]))});
function fixture(values=[100,2,1,0],count=12,wrap=withContinuousPreference){
  const works=Array.from({length:count},(_,index)=>({id:'level-'+index,title:'Painting '+index,artist:'Artist '+index,sourceUrl:'https://museum.example/'+index,image:'assets/level-'+index+'.jpg',sha256:(index+1).toString(16).padStart(64,'0'),features:{humanity:[1,0,0,1][index%4],energy:(index%4)/3,complexity:.5,abstraction:.5,color:.5}}));
  const rounds=Array.from({length:Math.floor(count/4)},(_,index)=>wrap({id:'journey-'+String(index+1).padStart(3,'0'),kind:'spectrum',criterion:'preference',works:works.slice(index*4,index*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}}));
  const answers=Object.fromEntries(rounds.map(round=>[round.id,answer(round,values)]));
  const annotationReviews={version:ARTWORK_ATTRIBUTE_VERSION,reviews:Object.fromEntries(works.map((work,index)=>[work.id,{version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity:{sourceUrl:work.sourceUrl,image:work.image,previewSha256:work.sha256},reviewedAsset:{image:work.image,sha256:work.sha256,width:600,height:450,compositionMatch:'same-composition',mediaBinding:'source-matched'},sourceUrls:[work.sourceUrl],attributes:Object.fromEntries(Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).map(key=>[key,{status:key==='precise-rendering'||['dramatic-light','human-relationships'].includes(key)&&[0,3].includes(index%4)?'present':'absent',reason:'Reviewed '+key+' on this painting.',evidenceKind:'visual-review'}]))}]))};
  return {works,rounds,answers,annotationReviews};
}
const basis=f=>buildPreferenceBasis(validatedProfileEntries(f));

test('Identical ranks with different gaps change actual rich-quality and broad-axis directions on the continuous scale',()=>{
  const wideTop=fixture([100,2,1,0]),wideBottom=fixture([100,99,98,0]),a=buildTastePatterns(wideTop),b=buildTastePatterns(wideBottom),pattern=profile=>profile.continuous.candidates.find(item=>item.qualityKey==='dramatic-light');
  assert.equal(pattern(a).status,'qualified');assert.equal(pattern(a).direction,1);assert.equal(pattern(b).status,'qualified');assert.equal(pattern(b).direction,-1);
  assert.notDeepEqual(pattern(a).weightBalance,pattern(b).weightBalance);assert.equal(pattern(a).supportingSetCount,3);assert.equal(pattern(b).supportingSetCount,3);
  const axis=f=>buildTasteAxes(f).axes.find(item=>item.key==='human-presence');assert.equal(axis(wideTop).direction,1);assert.equal(axis(wideBottom).direction,-1);
  assert.match(pattern(a).support[0].detail,/point appeal gap/);assert(pattern(a).weightBalance.groupContributions.every(group=>Math.abs(group.contribution)<=.75));
});

test('Tight all-high and all-low groups keep equal gap geometry but opposite absolute reports',()=>{
  const high=fixture([81,84,87,90],4),low=fixture([11,14,17,20],4),a=buildTastePortrait(high),b=buildTastePortrait(low);
  assert.equal(a.heroWorks.length,4);assert.equal(b.heroWorks.length,0);assert.equal(a.preferenceEvidence.negativeWorkIds.length,0);assert.equal(b.preferenceEvidence.negativeWorkIds.length,4);
  assert.equal(a.responseSpacing.coverage.aboveNeutral,4);assert.equal(b.responseSpacing.coverage.belowNeutral,4);assert.equal(a.responseSpacing.sets[0].spread,b.responseSpacing.sets[0].spread);
  assert.match(a.responseSpacing.observations[0].title,/above neutral/);assert.match(b.responseSpacing.observations[0].title,/below neutral/);assert.deepEqual(a.responseSpacing.sets[0].clusters[0].workIds,b.responseSpacing.sets[0].clusters[0].workIds);
});

test('Quiet above-neutral ratings are retained rather than discarded by the older high-rating threshold',()=>{
  const f=fixture([51,52,53,54],4),b=basis(f);assert.equal(b.seeds.length,4);assert(b.seeds.every(item=>item.positive));assert.deepEqual(b.negativeSeeds,[]);
  const neutral=fixture([50,50,50,50],4);assert.deepEqual(basis(neutral).seeds,[]);assert.deepEqual(basis(neutral).negativeSeeds,[]);
});

test('One extreme group cannot create a recurring quality and repeated groups do not enlarge the discovery denominator',()=>{
  const f=fixture([51,50,49,48],16),last=f.rounds.at(-1);f.answers[last.id]=answer(last,[100,99,98,0]);
  const pattern=buildTastePatterns(f).continuous.candidates.find(item=>item.qualityKey==='dramatic-light');assert.notEqual(pattern.status,'qualified');assert.equal(pattern.summaryEligible,false);assert(pattern.weightBalance.groupContributions.every(group=>Math.abs(group.contribution)<=.75));
  const first=fixture([100,2,1,0],4);for(let index=0;index<5;index++){const repeat={...structuredClone(first.rounds[0]),id:'repeat-'+index,evidence:{...first.rounds[0].evidence,role:'repeat',repeatOf:first.rounds[0].id}};first.rounds.push(repeat);first.answers[repeat.id]=answer(repeat,[100,2,1,0]);}
  const model=buildTastePatterns(first);assert.equal(model.coverage.continuousSets,1);assert.equal(model.continuous.candidates.find(item=>item.qualityKey==='dramatic-light').summaryEligible,false);assert.equal(buildTastePortrait(first).responseSpacing.coverage.dependentChecks,5);
});

test('Saved ordinal answers retain order-only invariance and genuine older overall bands remain unchanged',()=>{
  const a=fixture([100,2,1,0],12,withComparisonPreference),b=fixture([100,99,98,0],12,withComparisonPreference),old=fixture([51,52,53,54],4,withOverallAppeal);
  assert.deepEqual(basis(a).ratings,[]);assert.deepEqual(basis(b).seeds,[]);assert.deepEqual(buildTastePatterns(a).ordinal.patterns,buildTastePatterns(b).ordinal.patterns);assert.deepEqual(buildTastePortrait(a).responseSpacing.sets,[]);assert.deepEqual(basis(old).seeds,[]);
});

test('Unknown or altered continuous instruments fail closed rather than falling back to a legacy or ordinal scale',()=>{
  for(const mutate of [round=>round.title='Another question',round=>round.scale.right='More preferred',round=>round.evidence.continuousProtocol='unknown',round=>round.evidence.comparisonProtocol='within-set-preference-order-v1']){const f=fixture([100,80,40,0],4);mutate(f.rounds[0]);assert.deepEqual(validatedProfileEntries(f),[]);assert.deepEqual(buildTastePortrait(f).heroWorks,[]);}
});

test('Continuous source evidence shows real values and gaps, including two positively rated paintings',()=>{
  const f=fixture([91,90,88,86],4),round=f.rounds[0],item={id:'source',support:[{roundId:round.id,workIds:ids(round).slice(0,2),label:'Personal appeal'}]},readout=comparisonReadout(item,f);
  assert.match(readout.displayNote,/1-point appeal gap.*both above neutral/);assert.match(readout.notes[ids(round)[0]][0].text,/91 \/ 100/);assert.match(readout.notes[ids(round)[1]][0].text,/90 \/ 100/);
  const html=renderProfileEvidence({item,...f,image:work=>'<img alt="'+work.title+'">',esc:String});assert.match(html,/91<small> \/ 100/);assert.match(html,/90<small> \/ 100/);assert.doesNotMatch(html,/Order in this group|1 of 4/);
});

test('Source-bound continuous boundaries compare genuinely above- and below-neutral examples under their own protocol',()=>{
  const f=fixture([80,20,30,90]),result=buildTasteBoundaries(f),finding=result.continuousFindings.find(item=>item.sharedQuality==='precise-rendering'&&item.contrastQuality==='human-relationships');
  assert(finding);assert.equal(finding.measurementScope,CONTINUOUS_PROTOCOL);assert.equal(finding.coverage.distinctDiscoverySets,3);assert(finding.supportPairs.every(pair=>pair.highValue>50&&pair.lowValue<50));assert.equal(result.overallFindings.length,0);
  const relative=fixture([80,20,30,90],12,withComparisonPreference);assert.deepEqual(buildTasteBoundaries(relative).continuousFindings,[]);
});

test('Continuous repeats retain level shifts and raw gap changes even when the entire order is unchanged',()=>{
  const f=fixture([10,20,30,40],4),source=f.rounds[0],repeat={...structuredClone(source),id:'returned',evidence:{...source.evidence,role:'repeat',repeatOf:source.id}};f.rounds.push(repeat);f.answers[repeat.id]=answer(repeat,[71,72,73,74]);
  const result=buildTastePortrait(f),comparison=result.consistency.comparisons[0];assert.equal(comparison.meanLevelChange,47.5);assert.equal(comparison.levelChanges.length,4);assert(comparison.pairs.every(pair=>pair.status==='retained'));assert(comparison.pairs.some(pair=>pair.earlierGap!==pair.laterGap));assert.equal(comparison.tiePolicy,'exact-tie');assert.match(result.observations.find(item=>item.id==='taste-repeat-level-spacing').title,/different level of appeal/);
});

test('Gap compression is visible as a response change even when order and mean personal appeal stay fixed',()=>{
  const f=fixture([0,25,75,100],4),source=f.rounds[0],repeat={...structuredClone(source),id:'compressed',evidence:{...source.evidence,role:'repeat',repeatOf:source.id}};f.rounds.push(repeat);f.answers[repeat.id]=answer(repeat,[40,45,55,60]);
  const result=buildTastePortrait(f),observation=result.observations.find(item=>item.id==='taste-repeat-level-spacing');assert(observation);assert.match(observation.title,/same order, closer appeal/i);assert.equal(observation.meanLevelChange,0);assert.equal(observation.earlierSpread,100);assert.equal(observation.laterSpread,20);assert.deepEqual(observation.sourceRoundIds,[source.id,repeat.id]);
});

test('A genuine comparative tendency among uniformly disliked works cannot name a positive taste profile',()=>{
  const f=fixture([30,2,1,0]),pattern=buildTastePatterns(f).continuous.candidates.find(item=>item.qualityKey==='dramatic-light');assert.equal(pattern.status,'qualified');assert.equal(pattern.summaryEligible,false);assert.equal(pattern.absoluteResponseBalance.aboveNeutral,0);assert.equal(pattern.absoluteResponseBalance.belowNeutral,12);assert(pattern.counter.some(item=>/Below neutral/.test(item.detail)));
});

test('The actual continuous closing binder is read with frozen gap weights and actual outcome intensity',()=>{
  const f=fixture([0,25,70,100],32),template=buildOrdinalRefinementRound({works:f.works,id:'journey-050',role:'hypothesis-check',slot:5,preferenceProtocol:CONTINUOUS_PROTOCOL}),bound=bindOrdinalRefinementRound({round:template,works:f.works,rounds:f.rounds,answers:f.answers});
  assert.equal(bound.evidence.finalRefinement.protocol,CONTINUOUS_REFINEMENT_PROTOCOL);assert.equal(bound.evidence.finalRefinement.role,'feature-check');const predicted=bound.evidence.finalRefinement.checks[0].prediction;f.rounds.push(bound);f.answers[bound.id]=answer(bound,bound.works.map(work=>work.id===predicted?91:90));
  const result=buildClosingReadings(f);assert.equal(result.checks.length,1);assert.equal(result.checks[0].gap,1);assert.equal(result.checks[0].primary.weightBasis,'continuous-personal-appeal-gap');assert.equal(result.observations[0].comparisons[0].measures[0].valueMeaning,'personal-appeal-level-and-gap');assert.match(result.observations[0].text,/1-point gap/);
  f.answers[bound.id]=answer(bound,bound.works.map(work=>work.id===predicted?95:5));const wider=buildClosingReadings(f);assert.equal(wider.checks[0].status,result.checks[0].status);assert.equal(wider.checks[0].gap,90);
  for(const round of f.rounds.slice(0,-1))for(const id of ids(round))f.answers[round.id].positions[id]=100-f.answers[round.id].positions[id];assert.deepEqual(buildClosingReadings(f),wider,'Stored training is not refitted from later live edits');
});
