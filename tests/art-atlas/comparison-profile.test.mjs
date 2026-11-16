import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withComparisonPreference,COMPARISON_PROTOCOL,COMPARISON_SCOPE} from '../../public/art-atlas/comparison-protocol.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';
import {validatedProfileEntries,buildPreferenceBasis} from '../../public/art-atlas/profile-evidence.mjs';
import {buildTastePatterns} from '../../public/art-atlas/taste-patterns.mjs';
import {buildTastePortrait} from '../../public/art-atlas/taste-portrait.mjs';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {EARLY_REQUIRED_IDS} from '../../public/art-atlas/curation-sequence.mjs';

function fixture(count=12){
  const works=Array.from({length:count},(_,i)=>({id:'w'+i,title:'Painting '+i,artist:'Artist '+i,sourceUrl:'https://museum.example/'+i,image:'assets/w'+i+'.jpg',sha256:(i+1).toString(16).padStart(64,'0'),features:{abstraction:i%2,energy:.5,complexity:.5,humanity:.5,color:.5}}));
  const round=(id,start=0,mode='ordinal')=>{const r={id,kind:'spectrum',criterion:'preference',title:'Legacy preference',works:works.slice(start,start+4),evidence:{construct:'preference',unconditional:true,family:'individual-choice',role:'discovery'}};return mode==='ordinal'?withComparisonPreference(r):mode==='overall'?withOverallAppeal(r):r;};
  const answer=(r,values)=>({confirmed:true,workIds:r.works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(r.works.map((w,i)=>[w.id,values[i]]))});
  const anchor=(id,negative=false,offered=works)=>({id,kind:'choice-grid',selectionMode:'shortlist',maxChoices:Math.min(5,offered.length),allowUnsure:true,title:negative?'Which do you dislike?':'Your favourites',works:offered,evidence:{construct:negative?'overall-dislikes':'overall-favourites',[negative?'explicitDislikes':'explicitFavourites']:true,anchorComparisonProtocol:COMPARISON_PROTOCOL}});
  const selected=(r,values,unsure=false)=>({confirmed:true,workIds:r.works.map(w=>w.id),selectionMode:'shortlist',selectedIds:values,explicitNone:!values.length&&!unsure,unsure});
  const annotationReviews={version:ARTWORK_ATTRIBUTE_VERSION,reviews:Object.fromEntries(works.map((work,i)=>[work.id,{version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity:{sourceUrl:work.sourceUrl,image:work.image,previewSha256:work.sha256},reviewedAsset:{image:work.image,sha256:work.sha256,width:600,height:450,compositionMatch:'same-composition',mediaBinding:'source-matched'},sourceUrls:[work.sourceUrl],attributes:Object.fromEntries(Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).map(key=>[key,{status:key==='dramatic-light'&&i%2===0?'present':'absent',reason:'Individually reviewed '+key,evidenceKind:'visual-review'}]))}]))};
  return {works,round,answer,anchor,selected,annotationReviews};
}
const basis=f=>buildPreferenceBasis(validatedProfileEntries(f));

test('Ordinal positions at 100 or 0 supply order only, never absolute seeds or hero favourites',()=>{
  const f=fixture(),r=f.round('compare'),args={...f,rounds:[r],answers:{compare:f.answer(r,[100,99,0,0])}},before=structuredClone(args.answers),b=basis(args),portrait=buildTastePortrait(args);
  assert.deepEqual(b.ratings,[]);assert.deepEqual(b.seeds,[]);assert.deepEqual(b.negativeSeeds,[]);assert.equal(b.basis,COMPARISON_SCOPE);assert.deepEqual(portrait.heroWorks,[]);assert.deepEqual(portrait.discovery.artists,[]);assert.deepEqual(portrait.discovery.museums,[]);assert.deepEqual(portrait.preferenceEvidence.overallRatings,[]);assert.deepEqual(args.answers,before);
});

test('Relative-only legacy leaders and genuinely low anchored overall ratings are not invented heroes',()=>{
  const f=fixture(),legacy=f.round('legacy',0,'legacy'),overall=f.round('overall',4,'overall');
  assert.deepEqual(buildTastePortrait({...f,rounds:[legacy],answers:{legacy:f.answer(legacy,[100,0,80,20])}}).heroWorks,[]);
  const result=buildTastePortrait({...f,rounds:[overall],answers:{overall:f.answer(overall,[20,10,0,0])}});assert.deepEqual(result.heroWorks,[]);assert.equal(result.preferenceEvidence.overallRatings.length,4);
});

test('Marked comparison definitions with changed anchors, scope or title fail closed',()=>{
  const f=fixture(),original=f.round('compare');
  for(const mutate of [r=>r.scale.left='Strongly dislike',r=>r.title='A different question',r=>r.evidence.measurementScope='overall-appeal',r=>r.evidence.comparisonProtocol='unknown-order',r=>r.evidence.appealProtocol='overall-appeal-v1']){
    const r=structuredClone(original);mutate(r);const args={...f,rounds:[r],answers:{compare:f.answer(r,[100,50,10,0])}};assert.deepEqual(validatedProfileEntries(args),[]);assert.equal(buildTastePortrait(args).coverage.preferenceTasks,0);
  }
});

test('One-step orders and monotone rescaling leave ordinal quality conclusions and graph observations unchanged',()=>{
  const f=fixture(),rounds=[f.round('a',0),f.round('b',4),f.round('c',8)],answers=values=>Object.fromEntries(rounds.map(r=>[r.id,f.answer(r,values)])),small={...f,rounds,answers:answers([4,3,2,1])},large={...f,rounds,answers:answers([100,80,60,40])},a=buildTastePatterns(small),b=buildTastePatterns(large),pattern=a.ordinal?.patterns.find(p=>p.qualityKey==='dramatic-light'),other=b.ordinal?.patterns.find(p=>p.qualityKey==='dramatic-light');
  assert.ok(pattern);assert.equal(pattern.status,'qualified');assert.equal(pattern.comparisonBasis,COMPARISON_SCOPE);assert.equal(pattern.positiveWorkCount,null);assert.equal(pattern.negativeWorkCount,null);assert.equal(a.appeal.patterns.length,0);assert.equal(a.relative.patterns.length,0);
  for(const key of ['direction','supportingSetCount','opposingSetCount','eligibleSetCount','status','summaryEligible','displayWorkIds','coexplaining'])assert.deepEqual(pattern[key],other[key]);
  assert.deepEqual(pattern.support.map(item=>item.workIds),other.support.map(item=>item.workIds));assert.deepEqual(pattern.counter.map(item=>item.workIds),other.counter.map(item=>item.workIds));
  assert.deepEqual(buildTastePortrait(small).ordinalPreferenceGraph,buildTastePortrait(large).ordinalPreferenceGraph);
});

test('An exact ordinal tie at any position has no directional or positive meaning',()=>{
  const f=fixture(),r=f.round('tie'),at=value=>({...f,rounds:[r],answers:{tie:f.answer(r,[value,value,value,value])}});
  const low=buildTastePortrait(at(0)),high=buildTastePortrait(at(100));assert.equal(low.ordinalPreferenceGraph.coverage.explicitTiePairCount,6);assert.deepEqual(low.ordinalPreferenceGraph,high.ordinalPreferenceGraph);assert.deepEqual(high.heroWorks,[]);assert.equal(buildTastePatterns(at(100)).ordinal.patterns.length,0);
});

test('Repeat suggestions describe exact ties for ordinal questions and retain the original near-tie language for legacy scales',()=>{
  const f=fixture(),current=f.round('current'),legacy=f.round('legacy',0,'legacy'),suggestion=round=>buildTastePortrait({...f,rounds:[round],answers:{[round.id]:f.answer(round,[91,90,0,0])}}).nextSteps.find(step=>step.id==='repeat-preference');
  assert.match(suggestion(current).reason,/exact ties/);assert.doesNotMatch(suggestion(current).reason,/near ties/);assert.match(suggestion(legacy).reason,/near ties/);
});

test('Explicit favourite and dislike declarations retain exact sources and conflicting anchors without using unselected as opposites',()=>{
  const f=fixture(),r=f.round('compare'),fav=f.anchor('fav',false,r.works),dis=f.anchor('dis',true,r.works),args={...f,rounds:[r,fav,dis],answers:{compare:f.answer(r,[1,2,3,4]),fav:f.selected(fav,['w0']),dis:f.selected(dis,['w0','w3'])}},b=basis(args),portrait=buildTastePortrait(args);
  assert.deepEqual(b.seeds,[]);assert.deepEqual(b.dislikes.map(item=>item.workId),['w0','w3']);assert.deepEqual(b.conflictingAnchorWorkIds,['w0']);assert.equal(b.favouriteDeclarations[0].score,null);assert.ok(b.favouriteDeclarations[0].counter.some(item=>item.roundId==='dis'));assert.ok(b.dislikes[0].counter.some(item=>item.roundId==='fav'));assert.equal(b.negativeSeeds.some(item=>item.workId==='w1'),false);assert.deepEqual(portrait.heroWorks,[]);assert.deepEqual(portrait.preferenceEvidence.explicitFavourites,[]);assert.deepEqual(portrait.preferenceEvidence.dislikeRoundIds,['dis']);assert.equal(portrait.ordinalPreferenceGraph.explicitNegative.length,2);
});

test('Unsure anchors preserve previous declarations; explicit none only withdraws that declaration',()=>{
  const f=fixture(),r=f.round('compare'),first=f.anchor('first',false,r.works),later=f.anchor('later',false,r.works),dis=f.anchor('dis',true,r.works),base={...f,rounds:[r,first,later,dis],answers:{compare:f.answer(r,[0,0,0,0]),first:f.selected(first,['w1']),later:f.selected(later,[],true),dis:f.selected(dis,[])}};
  assert.deepEqual(basis(base).favourites.map(item=>item.workId),['w1']);assert.deepEqual(basis(base).negativeSeeds,[]);
  base.answers.later=f.selected(later,[]);assert.deepEqual(basis(base).favourites,[]);assert.deepEqual(basis(base).negativeSeeds,[]);
});

test('New explicit anchors require their flag, actual earlier ordinal identities, and valid offered IDs',()=>{
  const f=fixture(),r=f.round('compare'),fav=f.anchor('fav',false,r.works),args={...f,rounds:[r,fav],answers:{compare:f.answer(r,[4,3,2,1]),fav:f.selected(fav,['w0'])}};
  assert.equal(basis(args).favourites.length,1);
  for(const change of [x=>delete x.rounds[1].evidence.explicitFavourites,x=>x.rounds.reverse(),x=>{x.rounds[1].works=x.rounds[1].works.map(work=>({...work}));x.rounds[1].works[0].sourceUrl='https://different.example';},x=>x.answers.fav.selectedIds=['missing']]){
    const next=structuredClone({works:args.works,rounds:args.rounds,answers:args.answers});change(next);assert.deepEqual(basis(next).favourites,[]);
  }
});

test('A new anchor cannot withdraw an earlier favourite through None when a presented painting has a different source identity',()=>{
  const f=fixture(),comparison=f.round('comparison'),first=f.anchor('first',false,comparison.works),none=f.anchor('none',false,structuredClone(comparison.works));
  for(const key of ['image','sourceUrl','sha256']){
    const changed=structuredClone(none);changed.works[0][key]=key==='sha256'?'f'.repeat(64):'different-'+changed.works[0][key];
    const args={...f,rounds:[comparison,first,changed],answers:{comparison:f.answer(comparison,[4,3,2,1]),first:f.selected(first,['w0']),none:f.selected(changed,[])}};
    assert.deepEqual(basis(args).favourites.map(item=>item.workId),['w0']);assert.deepEqual(basis(args).favouriteRoundIds,['first']);
    assert.deepEqual(buildTastePortrait(args).ordinalPreferenceGraph.explicitPositive.map(item=>item.workId),['w0']);
  }
});

test('Repeat consistency uses exact ties for the new protocol and retains the old 15-point policy',()=>{
  const f=fixture(),source=f.round('source'),repeat={...structuredClone(source),id:'repeat',evidence:{...source.evidence,role:'repeat',repeatOf:'source'}},result=buildTastePortrait({...f,rounds:[source,repeat],answers:{source:f.answer(source,[91,90,0,0]),repeat:f.answer(repeat,[90,91,0,0])}});
  assert.equal(result.consistency.reversed,1);assert.equal(result.consistency.tiePolicy,'exact-tie');assert.equal(result.consistency.comparisons[0].pairs.find(pair=>pair.workIds.join('|')==='w2|w3').status,'tied');
  const legacy=f.round('source',0,'legacy'),oldRepeat={...structuredClone(legacy),id:'repeat',evidence:{...legacy.evidence,role:'repeat',repeatOf:'source'}},old=buildTastePortrait({...f,rounds:[legacy,oldRepeat],answers:{source:f.answer(legacy,[91,90,0,0]),repeat:f.answer(oldRepeat,[90,91,0,0])}});assert.equal(old.consistency.reversed,0);assert.ok(old.consistency.bothNearTied>0);
});

test('An explicit dislike prevents a high older rating from supplying a hero while retaining that earlier counterevidence',()=>{
  const f=fixture(),old=f.round('old',0,'overall'),comparison=f.round('comparison'),dis=f.anchor('dis',true,comparison.works),args={...f,rounds:[old,comparison,dis],answers:{old:f.answer(old,[90,10,10,10]),comparison:f.answer(comparison,[4,3,2,1]),dis:f.selected(dis,['w0'])}},result=buildTastePortrait(args);
  assert.deepEqual(result.heroWorks,[]);assert.equal(result.preferenceEvidence.overallRatings.find(item=>item.workId==='w0').score,90);assert.ok(result.preferenceEvidence.explicitDislikes[0].counter.some(item=>item.roundId==='old'));
});

test('Malformed comparison identities cannot crash the profile or enter the graph',()=>{
  const f=fixture(),r=f.round('bad');r.workIds=5;const args={...f,rounds:[r],answers:{bad:f.answer(r,[4,3,2,1])}};assert.deepEqual(validatedProfileEntries(args),[]);const result=buildTastePortrait(args);assert.equal(result.coverage.preferenceTasks,0);assert.equal(result.ordinalPreferenceGraph.coverage.comparisonRoundCount,0);
});

test('Ordinal quality counterexamples remain in the source sets even with a one-step reversal',()=>{
  const f=fixture(16),rounds=Array.from({length:4},(_,i)=>f.round('p'+i,i*4)),answers=Object.fromEntries(rounds.map((r,i)=>[r.id,f.answer(r,i===3?[1,2,3,4]:[4,3,2,1])])),model=buildTastePatterns({...f,rounds,answers}),pattern=model.ordinal.patterns.find(item=>item.qualityKey==='dramatic-light');
  assert.ok(pattern);assert.equal(pattern.supportingSetCount,3);assert.equal(pattern.opposingSetCount,1);assert.ok(pattern.counter.some(item=>item.roundId==='p3'));assert.equal(pattern.positiveWorkCount,null);
});

test('Explicit favourite connections use the actually presented pool and retain an explicit disliked counterexample',()=>{
  const f=fixture(16),rounds=Array.from({length:4},(_,i)=>f.round('p'+i,i*4)),fav=f.anchor('fav'),dis=f.anchor('dis',true),answers=Object.fromEntries(rounds.map(r=>[r.id,f.answer(r,[4,3,2,1])])),model=buildTastePatterns({...f,rounds:[...rounds,fav,dis],answers:{...answers,fav:f.selected(fav,['w0','w4','w8']),dis:f.selected(dis,['w12'])}}),pattern=model.favouriteConnections.patterns.find(item=>item.qualityKey==='dramatic-light');
  assert.ok(pattern);assert.equal(pattern.summaryEligible,true);assert.equal(pattern.exposureBaseline.baselineBasis,'actually-presented-favourites-pool');assert.equal(pattern.exposureBaseline.presentedPoolKnown,16);assert.equal(pattern.exposureBaseline.totalRated,0);assert.deepEqual(pattern.explicitDislikesWithQuality,['w12']);assert.ok(pattern.counter.some(item=>item.roundId==='dis'&&item.workIds.includes('w12')));assert.match(pattern.text,/explicitly disliked/);
});

test('The latest explicit opposite controls the hero, with both source declarations kept for inspection',()=>{
  const f=fixture(),r=f.round('compare'),dis=f.anchor('dis',true,r.works),fav=f.anchor('fav',false,r.works),args={...f,rounds:[r,dis,fav],answers:{compare:f.answer(r,[1,2,3,4]),dis:f.selected(dis,['w0']),fav:f.selected(fav,['w0'])}},b=basis(args);
  assert.deepEqual(b.heroSeeds.map(item=>item.workId),['w0']);assert.deepEqual(b.dislikes,[]);assert.deepEqual(b.negativeSeeds,[]);assert.ok(b.favourites[0].counter.some(item=>item.roundId==='dis'));assert.deepEqual(b.anchorHistory.find(item=>item.workId==='w0').history.map(item=>[item.roundId,item.type,item.selected]),[['dis','dislike',true],['fav','favourite',true]]);assert.deepEqual(buildTastePortrait(args).preferenceEvidence.explicitFavourites.map(item=>item.workId),['w0']);
  const none=f.anchor('none',false,r.works);args.rounds.push(none);args.answers.none=f.selected(none,[]);const withdrawn=basis(args);assert.deepEqual(withdrawn.heroSeeds,[]);assert.deepEqual(withdrawn.dislikes,[],'Withdrawing a favourite does not restore an older dislike');assert.deepEqual(withdrawn.negativeSeeds,[]);
});

test('Default discovery candidates use the primary collection without filtering an actual world-collection favourite',()=>{
  const f=fixture(16);for(let i=0;i<EARLY_REQUIRED_IDS.length;i++){f.works[11+i].id=EARLY_REQUIRED_IDS[i];f.works[11+i].country='Mexico';}
  f.works[0].country='Japan';for(const i of [4,5,6])f.works[i].artist=f.works[0].artist;f.works[4].studyEligible=false;f.works[4].eligibleForStudy=false;f.works[5].country='Japan';f.works[6].country='Mexico';
  const r=f.round('compare'),fav=f.anchor('fav',false,r.works),result=buildTastePortrait({...f,rounds:[r,fav],answers:{compare:f.answer(r,[4,3,2,1]),fav:f.selected(fav,['w0'])}}),candidates=result.discovery.paintings.map(item=>item.workId);
  assert.deepEqual(result.heroWorks.map(item=>item.workId),['w0'],'Recorded positive evidence is not filtered by regional routing');assert.ok(candidates.includes('w6'));assert.equal(candidates.includes('w5'),false);assert.equal(candidates.includes('w4'),false);assert.ok(result.discovery.artists[0].availableWorkIds.includes('w6'));assert.equal(result.discovery.artists[0].availableWorkIds.includes('w5'),false);
});

test('The full portrait wires a real source-reviewed explicit boundary into its summary',()=>{
  const catalogue=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')),byId=new Map(catalogue.map(work=>[work.id,work])),favIds=['cassatt-omnibus','bonheur-horses','herran-la-ofrenda'],disIds=['mondrian-composition','hokusai-mount-fuji','hiroshige-sudden-shower'],selected=new Set([...favIds,...disIds]),extras=catalogue.filter(work=>!selected.has(work.id)).slice(0,6),works=[...favIds,...disIds].map(id=>byId.get(id)).concat(extras),rounds=Array.from({length:3},(_,i)=>withComparisonPreference({id:'source'+i,kind:'spectrum',criterion:'preference',works:[byId.get(favIds[i]),byId.get(disIds[i]),extras[i*2],extras[i*2+1]],evidence:{construct:'preference',family:'individual-choice',role:'discovery'}})),answers=Object.fromEntries(rounds.map(r=>[r.id,{confirmed:true,criterion:'preference',workIds:r.works.map(work=>work.id),positions:Object.fromEntries(r.works.map(work=>[work.id,50]))}]));
  for(const [id,negative,chosen]of [['fav',false,favIds],['dis',true,disIds]]){const r={id,kind:'choice-grid',selectionMode:'shortlist',maxChoices:negative?works.length:5,allowUnsure:true,works,evidence:{construct:negative?'overall-dislikes':'overall-favourites',[negative?'explicitDislikes':'explicitFavourites']:true,anchorComparisonProtocol:COMPARISON_PROTOCOL}};rounds.push(r);answers[id]={confirmed:true,workIds:works.map(work=>work.id),selectionMode:'shortlist',selectedIds:chosen,explicitNone:false,unsure:false};}
  const portrait=buildTastePortrait({works,rounds,answers}),boundaries=portrait.tasteBoundaries.findings.filter(item=>item.status==='explicit-choice-contrast');assert.ok(boundaries.length,'Synthetic declarations on real reviewed art qualify a conditional contrast');assert.ok(portrait.profileSummary.findingIds.some(id=>boundaries.some(item=>item.id===id)));assert.notEqual(portrait.profileSummary.title,'Art profile');assert.deepEqual(portrait.heroWorks.map(item=>item.workId),favIds);assert.equal(portrait.preferenceEvidence.absoluteScaleAvailable,false);
});
