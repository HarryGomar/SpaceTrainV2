import test from 'node:test';
import assert from 'node:assert/strict';
import {renderProfileEvidence,readingTitle,readingTitleMarkup,renderTasteConnections} from '../../public/art-atlas/taste-portrait-parts.mjs';
const works=[{id:'a',title:'A painting',artist:'Painter A'},{id:'b',title:'B painting',artist:'Painter B'}];
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const image=work=>'<img data-work="'+work.id+'">';
const round={id:'pref',kind:'spectrum',criterion:'preference',title:'Preference',works};
const answer={workIds:['a','b'],criterion:'preference',positions:{a:0,b:90},confirmed:true};
const item={title:'A comparison',support:[{roundId:'pref',label:'Your preference',detail:'Original recorded evidence',workIds:['a','b']}],alternatives:[]};
const render=(overrides={})=>renderProfileEvidence({item,works,rounds:[round],answers:{pref:answer},image,esc,...overrides});

test('Evidence preserves zero and actual recorded values with explicit preference labels',()=>{
  const html=render();assert.match(html,/<strong>0<small> \/ 100/);assert.match(html,/<strong>90<small> \/ 100/);assert.match(html,/>Preference</);assert.match(html,/aria-haspopup="dialog"/);assert.doesNotMatch(html,/width:|tp-measure-track/);
});
test('Incomplete or out-of-range responses do not become evidence bars',()=>{
  for(const bad of [{...answer,confirmed:false},{...answer,positions:{a:1000,b:90}},{...answer,positions:{a:30}}]){
    const html=render({answers:{pref:bad}});assert.doesNotMatch(html,/profile-evidence-value/);assert.match(html,/Original recorded evidence/);
  }
});
test('Frozen evidence stays frozen when the current answer has changed',()=>{
  const frozen={...item,support:[{...item.support[0],label:'Earlier source · frozen values',detail:'Frozen preference A: 20; B: 80.'}]};
  const html=render({item:frozen});assert.match(html,/Frozen preference A: 20; B: 80/);assert.doesNotMatch(html,/profile-evidence-value/);
});
test('Curiosity has its own semantic tone and label',()=>{
  const html=render({rounds:[{...round,criterion:'interest'}],answers:{pref:{...answer,criterion:'interest'}}});assert.match(html,/data-tone="curiosity"/);assert.match(html,/>Curiosity</);assert.doesNotMatch(html,/>Preference</);
});
test('Headlines say what the person preferred and highlight the same words',()=>{
  const finding={module:'patterns',feature:'humanity',direction:1};assert.equal(readingTitle(finding),'Human figures recurred in these choices.');assert.match(readingTitleMarkup(finding,esc),/<span class="profile-highlight">Human figures<\/span>/);
});
test('No completed connection evidence produces no placeholder groups or invented map',()=>{
  assert.equal(renderTasteConnections({connections:{},works,image,esc,evidence:()=>''}), '');
});
test('Observed groups keep actual identities, source counts and honest truncated totals',()=>{
  const html=renderTasteConnections({connections:{groups:[{id:'g',label:'Room 1',recurring:true,instrument:'museum',evidenceCount:2,workIds:['a','b'],totalWorkCount:7,support:[]}]},works,image,esc,evidence:()=>'<details class="proof"></details>'});
  assert.match(html,/A group you kept together/);assert.match(html,/2 museum arrangements/);assert.match(html,/2 of 7 works shown/);assert.match(html,/data-work="a"/);assert.match(html,/data-work="b"/);assert.doesNotMatch(html,/personality|percentile/);
});
test('A meaning response map keeps meaning labels when no curiosity map is available',()=>{
  const html=renderTasteConnections({connections:{responseMaps:[{kind:'preference-meaning',label:'Meaning',points:[{workId:'a',x:0,y:100}],support:[]}]},works,image,esc,evidence:()=>''});
  assert.match(html,/data-axis="meaning"/);assert.match(html,/Meaning and preference/);assert.match(html,/More to interpret/);assert.match(html,/left:8%;bottom:92%/);assert.doesNotMatch(html,/More curious|Curiosity runs up|Liked and curious/);
});
