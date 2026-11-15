import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderTastePortrait} from '../../public/art-atlas/taste-portrait-view.mjs';
import {renderProfileEvidence,readingTitle} from '../../public/art-atlas/taste-portrait-parts.mjs';
import {comparisonReadout} from '../../public/art-atlas/profile-comparisons.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const ids=['almeida-junior-saudade','mondrian-composition'];
const get=id=>works.find(work=>work.id===id);
const round={id:'pref',title:'Which do you prefer?',kind:'spectrum',criterion:'preference',works:ids.map(get)};
const answer={workIds:ids,criterion:'preference',positions:{[ids[0]]:57,[ids[1]]:30},confirmed:true};
const entry={roundId:'pref',label:round.title,detail:'The portrait was preferred to the geometric work.',workIds:ids};
const pattern={id:'pattern',module:'patterns',feature:'humanity',direction:1,supportedSetCount:5,support:[entry],counter:[],alternatives:[]};
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const image=work=>'<img data-work="'+work.id+'">';
const render=item=>renderTastePortrait({portrait:{observations:[item]},works,rounds:[round],answers:{pref:answer},image,esc});

test('A figures finding does not translate visual human presence into a head count',()=>{
  assert.doesNotMatch(readingTitle(pattern),/more people|fewer people/i);
  assert.match(readingTitle(pattern),/figure/i);
});
test('The portrait and Mondrian visibly identify the preferred and comparison roles',()=>{
  const html=render(pattern);
  assert.match(html,/<figure[^>]*data-comparison-work="almeida-junior-saudade"[\s\S]*?data-choice-role="preferred"/);
  assert.match(html,/<figure[^>]*data-comparison-work="mondrian-composition"[\s\S]*?data-choice-role="less-preferred"/);
});
test('An opposing choice labels itself as an exception even after the group heading scrolls away',()=>{
  const html=renderProfileEvidence({item:{...pattern,counter:[entry]},works,rounds:[round],answers:{pref:answer},image,esc});
  assert.match(html,/data-evidence-role="exception"/);
  assert.match(html,/Against this pattern/);
});
test('The curiosity example uses direct labelled choices rather than the unclear rating bars',()=>{
  const item={id:'curiosity',module:'curiosity',support:[entry],counter:[],comparisons:[{workIds:ids,preference:[57,30],curiosity:[14,94]}]};
  const html=render(item);assert.doesNotMatch(html,/tp-measure-track/);assert.match(html,/You preferred this/);assert.match(html,/data-choice-role="curiosity"[^>]*><span aria-hidden="true"><\/span>More curious about this/);
});
test('A changed-purpose reading names the question instead of a generic claim',()=>{
  const context={module:'context',title:'A different purpose can change the choice.',brief:'Which would you keep looking at over several weeks?',contextKind:'longer-looking',preferredWorkId:'klee-carnival',contextWorkId:'mondrian-composition'};
  assert.doesNotMatch(readingTitle(context),/different purpose can change/i);assert.match(readingTitle(context),/longer|weeks|looking/i);
});
test('Equal or nearby placements never become a preferred-versus-lower claim',()=>{
  const item={comparisons:[{workIds:ids,measures:[{key:'preference',label:'Preference',values:[50,51]}]}]};
  const readout=comparisonReadout(item,{works});for(const notes of Object.values(readout.notes)){assert.equal(notes.length,1);assert.equal(notes[0].role,'near-tie');}
});
test('Malformed comparison identities and values do not produce visual claims',()=>{
  for(const pair of [{workIds:ids,preference:[50,Infinity],curiosity:[0,100]},{workIds:[ids[0],ids[0]],preference:[100,0],curiosity:[0,100]},{workIds:ids,preference:[0,100],curiosity:[100]}])assert.equal(comparisonReadout({comparisons:[pair]},{works}),null);
});
test('A story reading shows the original five-point scale without percentage bars',()=>{
  const item={id:'story',module:'context-note',comparisons:[{workIds:[ids[0]],measures:[{key:'preference',label:'Before the story',values:[0]},{key:'context',label:'After the story',values:[100]}]}]};
  const html=render(item);assert.match(html,/<strong>1<small> \/ 5/);assert.match(html,/<strong>5<small> \/ 5/);assert.doesNotMatch(html,/tp-measure-track/);
});
