import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProfileShareAspects,PROFILE_SHARE_SIZE} from '../../public/art-atlas/profile-share.mjs';

const works=Array.from({length:8},(_,i)=>({id:'s'+i,title:'Painting '+i,artist:'Artist '+i,image:'assets/'+i+'.jpg',sourceUrl:'https://fixture.invalid/'+i,museum:'Fixture collection',rights:'CC0',...(i===0?{imageCredit:'Exact image credit retained'}:{})}));
function portrait(){return {profileSummary:{title:'You tend to favour scenes with depth',text:'Painting 0 appealed more than Painting 1. This distinction held in later comparisons.',findingIds:['depth'],workIds:['s0','s1'],basis:'prospectively-tested-appeal'},coverage:{uniquePreferenceWorks:144,validRounds:150},preferenceEvidence:{explicitFavourites:[],overallRatings:[{workId:'s0',score:85,measurementScope:'personal-appeal-continuous-v1'},{workId:'s1',score:25,measurementScope:'personal-appeal-continuous-v1'}]},observations:[{id:'depth',module:'conditional-appeal',displayWorkIds:['s0','s1'],support:[{roundId:'line',workIds:['s0','s1']}],counter:[],boundary:'The same quality does not explain every choice.',nextQuestion:'Would this distinction hold within one artist?'}],intelligence:{responseLedger:[{roundId:'line',index:0,workIds:['s0','s1'],measurementScope:'personal-appeal-continuous-v1',positions:{s0:85,s1:25}}],categories:[]}};}

test('The one-page share model keeps the earned headline, source scores, artwork identities, credits and actual scope',()=>{
  const p=portrait(),before=structuredClone(p),aspects=buildProfileShareAspects({portrait:p,works}),main=aspects.find(a=>a.id==='profile');
  assert.equal(main.headline,p.profileSummary.title);assert.equal(main.badge,'Checked on later work');assert.deepEqual(main.artworks.map(w=>w.id),['s0','s1']);assert.deepEqual(main.artworks[0].measures,[{label:'Appeal',value:85}]);assert.equal(main.artworks[0].credit,'Exact image credit retained');assert.equal(main.nextQuestion,p.observations[0].nextQuestion);assert.equal(main.size.width,1080);assert.equal(main.size.height,1600);assert.deepEqual(PROFILE_SHARE_SIZE,{width:1080,height:1600});assert.deepEqual(p,before);
  assert.ok(!JSON.stringify(aspects).includes('"responseLedger":'));assert.ok(!JSON.stringify(aspects).includes('"answers":'));
});

test('Positively rated paintings are not relabelled explicit favourites, and declared favourites are unranked',()=>{
  const p=portrait(),positive=buildProfileShareAspects({portrait:p,works}).find(a=>a.id==='paintings');assert.equal(positive.headline,'Paintings that appealed');assert.deepEqual(positive.artworks.map(w=>w.id),['s0']);
  p.preferenceEvidence.explicitFavourites=[{workId:'s1'},{workId:'s2'}];const selected=buildProfileShareAspects({portrait:p,works}).find(a=>a.id==='paintings');assert.equal(selected.headline,'From your favourites');assert.match(selected.lede,/not a ranking/);assert.deepEqual(selected.artworks.map(w=>w.id),['s1','s2']);assert.deepEqual(selected.artworks[0].measures,[]);
});

test('An unmeasured aspect is absent, and a return page retains appeal, tension and wish as separate reports',()=>{
  const p=portrait();assert.equal(buildProfileShareAspects({portrait:p,works}).some(a=>a.id==='return'),false);
  p.observations.push({id:'intelligence-return-beyond-appeal',module:'tension-and-return',title:'Unsettling, yet worth another look',text:'Painting 3 had modest appeal and a strong wish to return.',displayWorkIds:['s3','s4'],support:[{roundId:'appeal',workIds:['s3','s4']},{roundId:'map',workIds:['s3','s4']}],counter:[]});
  p.intelligence.responseLedger.push({roundId:'appeal',index:1,measurementScope:'personal-appeal-continuous-v1',positions:{s3:40,s4:45}},{roundId:'map',index:2,measurementScope:'returnResponse',axisDefinition:{xName:'Felt tension',yName:'Wish to return'},points:{s3:[90,85],s4:[90,10]}});
  const share=buildProfileShareAspects({portrait:p,works,simulation:true}).find(a=>a.id==='return');assert.equal(share.badge,'Simulated answers');assert.deepEqual(share.artworks[0].measures,[{label:'Appeal',value:40},{label:'Felt tension',value:90},{label:'Wish to return',value:85}]);assert.match(share.scopeNote,/reported intention/);assert.ok(share.simulation);
});

test('An empty or partial profile produces no fabricated share page',()=>{
  assert.deepEqual(buildProfileShareAspects({portrait:{},works}),[]);const p=portrait();p.profileSummary.basis='recurring-observed-appeal';assert.equal(buildProfileShareAspects({portrait:p,works})[0].badge,'Recurring in your answers');
});

test('A single named comparison does not gain a recurrence claim in the share introduction',()=>{
  const p=portrait();p.profileSummary.basis='observed-comparisons';p.observations[0].supportingSetCount=1;p.observations[0].recurring=false;
  assert.equal(buildProfileShareAspects({portrait:p,works})[0].lede,p.profileSummary.text);
});

test('The profile share shows actual favourites and a return highlight uses supporting scores only',()=>{
  const p=portrait();
  p.preferenceEvidence.explicitFavourites=[{workId:'s4'},{workId:'s3'}];
  p.heroWorks=[{workId:'s0'},{workId:'s4'},{workId:'s3'}];
  const returning={id:'intelligence-return-beyond-appeal',module:'tension-and-return',title:'Worth another look despite modest appeal',text:'Painting 6 felt unsettling and you wanted to return.',displayWorkIds:['s6','s7'],support:[{roundId:'appeal',workIds:['s6']},{roundId:'return',workIds:['s6']}],counter:[{roundId:'appeal',workIds:['s7']},{roundId:'return',workIds:['s7']}]};
  p.observations.push(returning);
  p.intelligence.categories.push({id:'return',readingTitle:returning.title,primaryFindingId:returning.id,status:'provisional',support:returning.support,counter:returning.counter});
  p.intelligence.responseLedger.push(
    {roundId:'appeal',measurementScope:'personal-appeal-continuous-v1',positions:{s6:59,s7:35}},
    {roundId:'return',measurementScope:'returnResponse',axisDefinition:{xName:'Felt tension',yName:'Wish to return'},points:{s6:[91,89],s7:[36,32]}}
  );
  const [main]=buildProfileShareAspects({portrait:p,works});
  assert.deepEqual(main.gallery.map(w=>w.id),['s4','s3']);
  assert.equal(main.galleryLabel,'Your selected favourites');
  assert.deepEqual(main.highlights[0].examples.map(w=>w.id),['s6']);
  assert.deepEqual(main.highlights[0].examples[0].measures.map(m=>m.value),[59,91,89]);
  const share=buildProfileShareAspects({portrait:p,works}).find(a=>a.id==='return');
  assert.equal(share.artworks.find(w=>w.id==='s7').role,'counterexample');
});

test('Paired map highlights retain both paintings and exact values without repeating the profile headline',()=>{
  const p=portrait();
  const map={id:'intelligence-connection-contrast',module:'connection-and-understanding',measurementScope:'connection-map',title:'Understanding does not settle connection',text:'Painting 5 drew a more personal response than Painting 6.',displayWorkIds:['s5','s6'],support:[{roundId:'paired',workIds:['s5','s6']},{roundId:'early',workIds:['s5','s7']}]};
  p.observations.push(map);
  p.intelligence.categories.push({id:'connection',readingTitle:map.title,primaryFindingId:map.id,status:'supported',support:map.support});
  const definition={xName:'Understanding',yName:'Connection'};
  p.intelligence.responseLedger.push(
    {roundId:'early',index:1,measurementScope:'connection',axisDefinition:definition,points:{s5:[20,40],s7:[25,90]}},
    {roundId:'paired',index:2,measurementScope:'connection',axisDefinition:definition,points:{s5:[98,100],s6:[95,18]}}
  );
  const main=buildProfileShareAspects({portrait:p,works})[0];
  assert.deepEqual(main.highlights[0].examples.map(w=>[w.id,...w.measures.map(m=>m.value)]),[['s5',98,100],['s6',95,18]]);
  Object.assign(p.profileSummary,{title:map.title,text:map.text,findingIds:[map.id],threads:[{id:map.id,title:map.title}]});
  const next=buildProfileShareAspects({portrait:p,works})[0];
  assert.deepEqual(next.threads,[]);
  assert.deepEqual(next.highlights,[]);
});
