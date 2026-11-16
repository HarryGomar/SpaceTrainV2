import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildTastePortrait} from '../../public/art-atlas/taste-portrait.mjs';
import {buildTasteConnections} from '../../public/art-atlas/taste-connections.mjs';
import {buildResponsePortrait,reportedGridMaps} from '../../public/art-atlas/response-portrait.mjs';
import {buildFacetReadings} from '../../public/art-atlas/facet-readings.mjs';
import {buildPreferenceBasis,validatedProfileEntries} from '../../public/art-atlas/profile-evidence.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';
import {AXES} from '../../public/art-atlas/engine.mjs';
import {createGalleryRecord,gallerySlots,placePainting} from '../../public/art-atlas/gallery-model.mjs';
import {createSortingRecord,placeSortingWork} from '../../public/art-atlas/sorting-table.mjs';

function fixture(n=16){
  const works=Array.from({length:n},(_,i)=>({id:'w'+i,title:'Painting '+i,artist:'Artist '+i,movement:'Tradition '+i,museum:'Museum '+i,date:String(1800+i),image:'./art/'+i+'.jpg',sourceUrl:'https://museum.example/objects/'+i,features:{abstraction:.5,energy:.5,complexity:.5,humanity:.5,narrative:.5,atmosphere:.5,color:.5},analysis:{yearRange:[1800+i,1800+i]}}));
  const pref=(id,indexes,overall=true)=>{const round={id,kind:'spectrum',title:'Which do you prefer?',criterion:'preference',works:indexes.map(i=>works[i]),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}};return overall?withOverallAppeal(round):round;};
  const spectrum=(round,values)=>({workIds:round.works.map(work=>work.id),criterion:round.criterion,positions:Object.fromEntries(round.works.map((work,i)=>[work.id,values[i]])),confirmed:true});
  const constructs={achievement:'perceived-achievement',reading:'scene-and-meaning',returnResponse:'tension-and-return'};
  const grid=(id,axis,indexes)=>({id,kind:'grid',axis,title:'Original '+axis+' question',axisDefinition:structuredClone(AXES[axis]),works:indexes.map(i=>works[i]),evidence:{construct:constructs[axis]}});
  const gridAnswer=(round,values)=>({workIds:round.works.map(work=>work.id),axis:round.axis,points:Object.fromEntries(round.works.map((work,i)=>[work.id,values[i]])),confirmed:true});
  const favourites=(id,indexes=works.map((_,i)=>i))=>({id,kind:'choice-grid',selectionMode:'shortlist',maxChoices:Math.min(5,indexes.length),works:indexes.map(i=>works[i]),evidence:{construct:'overall-favourites'}});
  const selection=(round,selected)=>({workIds:round.works.map(work=>work.id),selectionMode:'shortlist',selectedIds:selected.map(i=>works[i].id),explicitNone:selected.length===0,unsure:false,confirmed:true});
  return {works,pref,spectrum,grid,gridAnswer,favourites,selection};
}
const portrait=(f,rounds,answers,extra={})=>buildTastePortrait({works:f.works,rounds,answers,...extra});
const responses=(f,rounds,answers)=>buildResponsePortrait({works:f.works,rounds,answers});
function facets(work,tags){work.analysis.curatorialFacets={version:'curatorial-facets-v1',reviewed:true,tags,sourceUrls:[work.sourceUrl],reviewedImage:work.image,reviewedImageSha256:work.sha256||'1'.repeat(64)};}

test('Legacy set leaders remain comparison history and never become a favourite ranking',()=>{
  const f=fixture();f.works[0].id='z-early';f.works[2].id='a-later';const a=f.pref('early',[0,1],false),b=f.pref('later',[2,3],false),result=portrait(f,[a,b],{early:f.spectrum(a,[51,0]),later:f.spectrum(b,[100,0])});
  assert.deepEqual(result.heroWorks,[]);assert.equal(result.coverage.preferenceTasks,2);assert.equal(result.preferenceEvidence.absoluteScaleAvailable,false);assert.deepEqual(result.preferenceEvidence.overallRatings,[]);
});

test('Exact overall anchors make independently high paintings eligible even without a local win',()=>{
  const f=fixture(),a=f.pref('a',[0,1,2]),b=f.pref('b',[3,4,5]);const result=portrait(f,[a,b],{a:f.spectrum(a,[80,81,79]),b:f.spectrum(b,[99,98,97])});
  assert.equal(result.coverage.uniquePreferredWorks,6);assert.equal(result.heroWorks[0].workId,'w3');assert.equal(result.heroWorks[0].score,99);assert.ok(result.heroWorks.every(item=>item.basis==='overall-appeal'));assert.deepEqual(result.preferenceEvidence.overallRoundIds,['a','b']);
  const wrong={...a,scale:{...a.scale,left:'Less preferred'}};assert.equal(portrait(f,[wrong],{a:f.spectrum(wrong,[80,81,79])}).preferenceEvidence.absoluteScaleAvailable,false);
});

test('Explicit favourites outrank numeric appeal without inventing order within the selected set',()=>{
  const f=fixture(),a=f.pref('a',[0,1,2,3]),chosen=f.favourites('favourites');const result=portrait(f,[a,chosen],{a:f.spectrum(a,[99,90,20,10]),favourites:f.selection(chosen,[2,3])});
  assert.deepEqual(result.heroWorks.slice(0,2).map(item=>item.workId),['w2','w3']);assert.ok(result.heroWorks.slice(0,2).every(item=>item.basis==='overall-favourites'));assert.equal(result.heroWorks[0].score,20);assert.ok(result.heroWorks[0].counter.some(item=>item.roundId==='a'));assert.equal(result.preferenceEvidence.basis,'overall-favourites');
  const later={...chosen,id:'later'};const revised=portrait(f,[a,chosen,later],{a:f.spectrum(a,[99,90,20,10]),favourites:f.selection(chosen,[2,3]),later:f.selection(later,[])});assert.equal(revised.heroWorks[0].workId,'w0');assert.ok(revised.heroWorks.every(item=>item.basis!=='overall-favourites'));assert.equal(revised.discovery.artists.some(item=>item.workIds.includes('w3')),false);
});

test('A generic keep grid, recognition or save is not a favourites declaration; low appeal stays low',()=>{
  const f=fixture(),a=f.pref('a',[0,1,2]),keep={...f.favourites('keep'),evidence:{construct:'unranked-subset-selection'}},result=portrait(f,[a,keep],{a:f.spectrum(a,[20,10,0]),keep:f.selection(keep,[2])},{saved:{w2:{look:true}}});
  assert.deepEqual(result.heroWorks,[]);assert.equal(result.preferenceEvidence.overallRatings.find(item=>item.workId==='w0').score,20);assert.equal(result.coverage.uniquePreferredWorks,0);assert.deepEqual(result.discovery.artists,[]);assert.deepEqual(result.preferenceEvidence.favouriteRoundIds,[]);
});

test('Repeated overall ratings preserve actual history and latest value without independent-work inflation',()=>{
  const f=fixture(),a=f.pref('a',[0,1]),b={...a,id:'b',evidence:{...a.evidence,repeatOf:'a',role:'repeat'}};const entries=validatedProfileEntries({works:f.works,rounds:[a,b],answers:{a:f.spectrum(a,[100,0]),b:f.spectrum(b,[20,80])}}),basis=buildPreferenceBasis(entries);
  assert.equal(basis.ratings.length,2);assert.deepEqual(basis.ratings.find(item=>item.workId==='w0').history,[{roundId:'a',score:100},{roundId:'b',score:20}]);assert.deepEqual(basis.seeds.map(item=>item.workId),['w1']);assert.equal(basis.ratings.find(item=>item.workId==='w0').score,20);
});

test('All supported annotations remain available with exact balances, including co-explanations',()=>{
  const f=fixture();for(let i=0;i<8;i++){f.works[i].features.energy=i%2?.9:.1;f.works[i].features.abstraction=i%2?.9:.1;}
  const a=f.pref('a',[0,1,2,3],false),b=f.pref('b',[4,5,6,7],false),result=portrait(f,[a,b],{a:f.spectrum(a,[100,0,80,20]),b:f.spectrum(b,[100,0,80,20])});
  assert.deepEqual(new Set(result.patternCandidates.map(item=>item.feature)),new Set(['energy','abstraction']));assert.equal(result.observations.filter(item=>item.module==='patterns').length,1);for(const candidate of result.patternCandidates){assert.equal(candidate.discoveryBalance.eligibleSets,2);assert.equal(candidate.discoveryBalance.supportingSets,2);assert.deepEqual(candidate.discoveryBalance.sets.map(set=>set.roundId),['a','b']);}
});

test('High appeal spanning sparse and dense works prevents a simple sparse-preference summary',()=>{
  const f=fixture();for(let i=0;i<8;i++)f.works[i].features.complexity=i%2?.9:.1;const a=f.pref('a',[0,1,2,3]),b=f.pref('b',[4,5,6,7]),result=portrait(f,[a,b],{a:f.spectrum(a,[100,90,80,70]),b:f.spectrum(b,[100,90,80,70])});
  const candidate=result.patternCandidates.find(item=>item.feature==='complexity');assert.ok(candidate);assert.equal(candidate.patternStatus,'range-limited');assert.equal(candidate.positiveEvidenceBalance.spansBothEnds,true);const range=result.observations.find(item=>item.id==='facet-density-range');assert.ok(range);assert.equal(range.sparseWorkIds.length,4);assert.equal(range.denseWorkIds.length,4);assert.equal(result.profileSummary.title,'Art profile');assert.equal(result.themes.some(theme=>theme.id===range.id),false);assert.equal(range.priority,9);assert.deepEqual(range.displayWorkIds,['w0','w1']);assert.equal(range.displayNotes.w0.description,'Sparse composition');assert.equal(range.displayNotes.w1.description,'Dense composition');assert.ok(range.text.includes('Painting 0')&&range.text.includes('Painting 1'));
});

test('Artist, period and tradition routes include opposing works that were never positive seeds',()=>{
  const f=fixture();for(let i=0;i<6;i++){f.works[i].artist=i%2?'Other '+i:'Shared artist';f.works[i].movement=i%2?'Other tradition':'Shared tradition';f.works[i].analysis.yearRange=i%2?[1920,1920]:[1850,1850];}
  const a=f.pref('a',[0,1]),b=f.pref('b',[2,3]),c=f.pref('c',[4,5]),result=portrait(f,[a,b,c],{a:f.spectrum(a,[90,10]),b:f.spectrum(b,[90,10]),c:f.spectrum(c,[10,90])});
  const artist=result.discovery.artists.find(item=>item.title==='Shared artist'),era=result.discovery.eras.find(item=>item.title==='1800–1899'),tradition=result.discovery.traditions.find(item=>item.title==='Shared tradition');
  for(const route of [artist,era,tradition]){assert.ok(route);assert.equal(route.supportingSetCount,2);assert.equal(route.opposingSetCount,1);assert.ok(route.counter.some(item=>item.roundId==='c'&&item.workIds.includes('w4')));}
});

test('Museum routes rank actual favourite holding concentration ahead of the static institution order',()=>{
  const f=fixture();f.works[0].museum='Museo Nacional de Arte';for(const i of [2,4,6])f.works[i].museum='Museo Nacional del Prado';const p=f.pref('p',[0,1]),fav=f.favourites('fav'),result=portrait(f,[p,fav],{p:f.spectrum(p,[80,10]),fav:f.selection(fav,[2,4,6])});
  assert.equal(result.discovery.museums[0].title,'Museo Nacional del Prado');assert.deepEqual(result.discovery.museums[0].heldWorkIds,['w2','w4','w6']);assert.equal(result.discovery.museums[0].heldFavouriteWorkCount,3);assert.ok(result.discovery.museums[0].support.every(item=>item.roundId==='fav'));assert.match(result.discovery.museums[0].alternatives.join(' '),/currently displayed/);
});

test('Discovery lists retain all sourced institutions and rank direct painting connections before incidental catalogue order',()=>{
  const f=fixture(),a=f.pref('a',[0,1,2,3]),b=f.pref('b',[4,5,6,7]);f.works[15].artist=f.works[0].artist;const result=portrait(f,[a,b],{a:f.spectrum(a,[90,85,80,75]),b:f.spectrum(b,[90,85,80,75])});
  assert.equal(result.discovery.museums.length,8);assert.equal(result.discovery.artists.length,8);assert.equal(result.discovery.paintings[0].workId,'w15');assert.equal(result.discovery.paintings[0].basis,'Another work by the same artist');
});

test('All three map instruments retain each actual response and their full original axis definitions',()=>{
  const f=fixture(),rounds=[],answers={};for(let i=0;i<7;i++){const axis=['achievement','reading','returnResponse'][i%3],r=f.grid('g'+i,axis,[0,1]);rounds.push(r);answers[r.id]=f.gridAnswer(r,[[i,100-i],[100-i,i]]);}
  const changed={...f.grid('changed','reading',[0,1]),axisDefinition:{...AXES.reading,xName:'A historical label'}};rounds.push(changed);answers.changed=f.gridAnswer(changed,[[20,80],[80,20]]);
  const maps=reportedGridMaps({works:f.works,rounds,answers}),connections=buildTasteConnections({works:f.works,rounds,answers});assert.equal(maps.length,8);assert.deepEqual(connections.reportedGridMaps,maps);assert.equal(maps[0].points[0].x,0);assert.equal(maps.at(-1).axisDefinition.xName,'A historical label');assert.equal(maps.at(-1).interpretable,false);assert.deepEqual(maps.at(-1).sourceRoundIds,['changed']);assert.equal(responses(f,[changed],answers).observations.length,0);
});

test('Missing, stale, unconfirmed or duplicate grid identities cannot become points or patterns',()=>{
  const f=fixture(),r=f.grid('map','achievement',[0,1]),answer=f.gridAnswer(r,[[0,100],[100,0]]);for(const mutate of [a=>delete a.points.w0,a=>a.points.w0=[null,100],a=>a.workIds.reverse(),a=>a.confirmed=false]){const bad=structuredClone(answer);mutate(bad);assert.deepEqual(reportedGridMaps({works:f.works,rounds:[r],answers:{map:bad}}),[]);}assert.deepEqual(reportedGridMaps({works:f.works,rounds:[r,structuredClone(r)],answers:{map:answer}}),[]);
});

test('A conflicting captured identity alias rejects a whole preference, favourite or grid definition',()=>{
  const f=fixture(),pref=f.pref('pref',[0,1]),grid=f.grid('grid','reading',[0,1]),fav=f.favourites('fav',[0,1,2]);for(const round of [pref,grid,fav])round.workIds=['w9','w10'];const answers={pref:f.spectrum(pref,[90,10]),grid:f.gridAnswer(grid,[[90,90],[10,10]]),fav:f.selection(fav,[0])};const result=portrait(f,[pref,grid,fav],answers);assert.equal(result.coverage.preferenceTasks,0);assert.deepEqual(result.heroWorks,[]);assert.deepEqual(result.reportedGridMaps,[]);assert.deepEqual(validatedProfileEntries({works:f.works,rounds:[pref,grid,fav],answers}),[]);
});

test('Making alignment is a positive pattern with actual separations retained, counted by set rather than pairs',()=>{
  const f=fixture(),a=f.pref('a',[0,1,2]),b=f.pref('b',[3,4,5]),ma=f.grid('ma','achievement',[0,1,2]),mb=f.grid('mb','achievement',[3,4,5]),rounds=[a,ma,b,mb],answers={a:f.spectrum(a,[90,10,65]),b:f.spectrum(b,[90,10,65]),ma:f.gridAnswer(ma,[[90,70],[10,10],[65,100]]),mb:f.gridAnswer(mb,[[90,70],[10,10],[65,100]])};
  const result=portrait(f,rounds,answers),finding=result.observations.find(item=>item.id==='response-making');assert.ok(finding);assert.equal(finding.supportingSetCount,2);assert.equal(finding.counterSetCount,2);assert.equal(finding.setsWithBothDirections,2);assert.ok(finding.counter.some(item=>item.roundId==='ma'&&item.workIds.includes('w2')));assert.equal(result.observations.some(item=>item.id==='refined-achievement'),false);assert.deepEqual(finding.comparisons[0].sourceRoundIds,['a','ma']);
});

test('Return readings include both comforting and unsettling intentions without converting them into preference',()=>{
  const f=fixture(),a=f.grid('a','returnResponse',[0,1,2]),b=f.grid('b','returnResponse',[3,4,5]),answers={a:f.gridAnswer(a,[[10,90],[90,90],[90,10]]),b:f.gridAnswer(b,[[10,90],[90,90],[10,10]])},result=portrait(f,[a,b],answers),finding=result.observations.find(item=>item.id==='response-return-range');
  assert.ok(finding);assert.deepEqual(finding.comfortWorkIds,['w0','w3']);assert.deepEqual(finding.tensionWorkIds,['w1','w4']);assert.equal(finding.supportingSetCount,2);assert.equal(finding.counterWorkCount,2);assert.equal(result.coverage.preferenceTasks,0);assert.deepEqual(result.heroWorks,[]);assert.match(finding.alternatives.join(' '),/not observed repeat viewing/);
});

test('Repeated paintings and renamed legacy coordinates cannot manufacture a broad return range',()=>{
  const f=fixture(),a=f.grid('a','returnResponse',[0,1]),b={...a,id:'b'},answer=f.gridAnswer(a,[[10,90],[90,90]]);assert.equal(responses(f,[a,b],{a:answer,b:{...answer}}).observations.length,0);
  const renamed={...f.grid('renamed','returnResponse',[2,3]),axisDefinition:{...AXES.returnResponse,left:'Low contrast'}};assert.equal(responses(f,[a,renamed],{a:answer,renamed:f.gridAnswer(renamed,[[10,90],[90,90]])}).observations.length,0);
});

test('Reading connects positive exact identities across clear and less explicit scenes with counterexamples',()=>{
  const f=fixture(),p=f.pref('p',[0,1,2]),q=f.pref('q',[3,4,5]),a=f.grid('a','reading',[0,1,2]),b=f.grid('b','reading',[3,4,5]),result=responses(f,[p,a,q,b],{p:f.spectrum(p,[90,90,90]),q:f.spectrum(q,[90,90,10]),a:f.gridAnswer(a,[[90,90],[10,90],[90,10]]),b:f.gridAnswer(b,[[90,90],[10,90],[50,50]])}),finding=result.observations.find(item=>item.id==='response-reading');
  assert.ok(finding);assert.equal(finding.supportingWorkCount,4);assert.equal(finding.counterWorkCount,1);assert.ok(finding.counter.some(item=>item.workIds.includes('w2')));assert.equal(finding.readingBasis,'positive-overall-choices');
});

test('Reviewed facet combinations describe positive works, keep low-scoring counterparts and leave unknowns unknown',()=>{
  const f=fixture();for(const i of [0,1,3,4])facets(f.works[i],['narrative-detail','imagined-world']);facets(f.works[5],['narrative-detail','imagined-world']);const a=f.pref('a',[0,1,2]),b=f.pref('b',[3,4,5]),args={works:f.works,rounds:[a,b],answers:{a:f.spectrum(a,[90,85,80]),b:f.spectrum(b,[90,80,10])}},result=buildFacetReadings(args),finding=result.observations.find(item=>item.id==='facet-stories-worlds');
  assert.ok(finding);assert.equal(finding.supportingWorkCount,4);assert.equal(finding.counterWorkCount,1);assert.equal(result.coverage.reviewedPositiveWorks,4);assert.equal(result.coverage.positiveWorks,5);assert.ok(finding.counter.some(item=>item.workIds.includes('w5')));assert.ok(finding.sourceUrls.every(url=>url.startsWith('https://museum.example/')));assert.equal(finding.summaryEligible,false,'One lower-rated work with the same tags does not separate this connection from lower ratings');assert.deepEqual(result.themes,[]);
  const legacy=args.rounds.map(r=>({...r,evidence:{construct:'preference',family:'individual-choice'}}));assert.deepEqual(buildFacetReadings({...args,rounds:legacy}).observations,[]);
});

test('Reviewed connections can name a summary when actual higher/lower-rated works distinguish them; all100 and broad landscape cannot',()=>{
  const f=fixture();for(const work of f.works)facets(work,[]);for(const i of [0,1,3])facets(f.works[i],['narrative-detail','imagined-world']);const a=f.pref('a',[0,1,2]),b=f.pref('b',[3,4,5]),rounds=[a,b],answers={a:f.spectrum(a,[90,85,10]),b:f.spectrum(b,[90,10,10])},result=portrait(f,rounds,answers);assert.match(result.profileSummary.title,/Stories & imagined worlds/);assert.equal(result.facets.observations[0].summaryEligible,true);assert.equal(result.facets.observations[0].reviewedComparison.lowerRatedWithConnection,0);
  const flat=portrait(f,rounds,{a:f.spectrum(a,[100,100,100]),b:f.spectrum(b,[100,100,100])});assert.equal(flat.profileSummary.title,'Art profile');assert.deepEqual(flat.facets.themes,[]);
  for(const work of f.works)facets(work,['landscape']);const landscape=portrait(f,rounds,answers);assert.equal(landscape.profileSummary.title,'Art profile');assert.ok(landscape.facets.observations.some(item=>item.tags?.includes('landscape')));assert.deepEqual(landscape.facets.themes,[]);
});

test('Live facet additions never annotate an older complete frozen work snapshot retroactively',()=>{
  const f=fixture(),a=structuredClone(f.pref('a',[0,1,2])),b=structuredClone(f.pref('b',[3,4,5]));for(const work of f.works)facets(work,['narrative-detail','imagined-world']);const result=buildFacetReadings({works:f.works,rounds:[a,b],answers:{a:f.spectrum(a,[90,90,90]),b:f.spectrum(b,[90,90,90])}});assert.equal(result.coverage.reviewedPositiveWorks,0);assert.deepEqual(result.observations,[]);
});

test('An unreviewed or mismatched image/source object cannot inherit a reviewed theme',()=>{
  for(const mutate of [w=>delete w.analysis.curatorialFacets.reviewed,w=>w.analysis.curatorialFacets.reviewed=false,w=>w.image='different-reproduction.jpg',w=>w.sourceUrl='https://another.example/art',w=>w.analysis.curatorialFacets.reviewedImageSha256='bad-hash',w=>w.sha256='2'.repeat(64),w=>w.provenance={thumbnailSha256:'2'.repeat(64)}]){
    const f=fixture();for(const work of f.works)facets(work,['narrative-detail','imagined-world']);const a=f.pref('a',[0,1,2]),b=f.pref('b',[3,4,5]);for(const work of f.works)mutate(work);const result=buildFacetReadings({works:f.works,rounds:[a,b],answers:{a:f.spectrum(a,[90,90,90]),b:f.spectrum(b,[90,90,90])}});assert.equal(result.coverage.reviewedPositiveWorks,0);assert.deepEqual(result.observations,[]);
  }
});

test('Low legacy local leaders never acquire positive-overall language in a linked reading',()=>{
  const f=fixture(),a=f.pref('a',[0,1,2],false),b=f.pref('b',[3,4,5],false),ma=f.grid('ma','reading',[0,1,2]),mb=f.grid('mb','reading',[3,4,5]),answers={a:f.spectrum(a,[30,25,0]),b:f.spectrum(b,[30,25,0]),ma:f.gridAnswer(ma,[[90,90],[90,90],[50,50]]),mb:f.gridAnswer(mb,[[90,90],[90,90],[50,50]])},result=responses(f,[a,ma,b,mb],answers),reading=result.observations.find(item=>item.id==='response-reading');assert.ok(reading);assert.equal(reading.readingBasis,'exact-set-local-choices');assert.match(reading.text,/higher positions within their offered sets/);assert.doesNotMatch(reading.text,/positive|positively/);assert.equal(portrait(f,[a,ma,b,mb],answers).profileSummary.basis,'qualified-local-comparisons');
});

test('All rich curatorial findings remain available in priority order, including museum decisions after sorting',()=>{
  const f=fixture();let museum=createGalleryRecord(f.works,{}, {id:'museum',now:1});for(let i=0;i<6;i++){const slot=gallerySlots(museum).find(slot=>slot.roomId===(i<3?'g1':'g3'));museum=placePainting(museum,'w'+i,slot.wallId,slot.t).record;}museum.phase='walkthrough';museum.roomResponses={entryId:'w0',lingerRoomId:'g3',bridgeIds:['w0','w3']};museum.confirmed=true;museum.finishedAt=2;
  let table=createSortingRecord(f.works,{},[],{id:'table',now:3,offeredIds:f.works.slice(0,8).map(work=>work.id)});const positions=[[.12,.2],[.23,.2],[.7,.2],[.81,.2],[.12,.75],[.23,.75],[.7,.75],[.81,.75]];for(let i=0;i<8;i++)table=placeSortingWork(table,'w'+i,positions[i]).record;table.confirmed=true;table.finishedAt=4;
  const result=portrait(f,[],{},{records:[museum,table]});assert.ok(result.curatorialObservations.length>3);assert.ok(result.curatorialObservations.some(item=>item.support.some(source=>source.roundId==='scenario:museum')));for(let i=1;i<result.curatorialObservations.length;i++)assert.ok(result.curatorialObservations[i-1].priority>=result.curatorialObservations[i].priority);
});

const originalPath=new URL('../../artifacts/art-atlas/harry-first-50-original.json',import.meta.url);
test('The privately retained original fifty answers remain legacy local evidence and are never rewritten',{skip:!fs.existsSync(originalPath)},()=>{
  const bytes=fs.readFileSync(originalPath),hash=crypto.createHash('sha256').update(bytes).digest('hex'),run=JSON.parse(bytes),works=run.manifest.catalogue,byId=new Map(works.map(work=>[work.id,work])),rounds=run.rounds.map(round=>({...round,works:(round.workIds||round.works.map(work=>work.id)).map(id=>byId.get(id))})),before=JSON.stringify({works,rounds,answers:run.answers}),result=buildTastePortrait({works,rounds,answers:run.answers,records:run.records||[]});
  assert.ok(result.coverage.preferenceTasks>=18);assert.equal(result.preferenceEvidence.absoluteScaleAvailable,false);assert.deepEqual(result.preferenceEvidence.overallRatings,[]);assert.deepEqual(result.heroWorks,[]);assert.deepEqual(result.facets.observations,[]);assert.equal(JSON.stringify({works,rounds,answers:run.answers}),before);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(originalPath)).digest('hex'),hash);
});
