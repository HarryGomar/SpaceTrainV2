import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {AXES} from '../../public/art-atlas/engine.mjs';
import {renderProfileResponseMaps,createProfileResponseTabs} from '../../public/art-atlas/profile-response-view.mjs';
import {selectPrimaryReadings,rankCuratorialReadings} from '../../public/art-atlas/profile-overview.mjs';
import {renderTastePortrait} from '../../public/art-atlas/taste-portrait-view.mjs';

const works=['a','b','c','d'].map(id=>({id,title:'Work '+id,artist:'Artist '+id}));
const image=work=>'<img alt="'+work.title+'" data-work="'+work.id+'">';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const maps=['achievement','reading','returnResponse'].map((axis,index)=>({id:'map-'+index,roundId:'journey-00'+(index+1),axis,title:'Question '+index,axisDefinition:AXES[axis],points:works.map((work,n)=>({workId:work.id,x:n?33*n:0,y:n?100-30*n:100}))}));

test('Every current response map keeps its actual labels and all original painting coordinates',()=>{
  const dom=new JSDOM(renderProfileResponseMaps({maps,works,image,esc})),document=dom.window.document;
  assert.equal(document.querySelectorAll('[role="tab"]').length,3);
  assert.equal(document.querySelectorAll('.profile-response-panel').length,3);
  assert.equal(document.querySelectorAll('.profile-response-point').length,12);
  for(const [index,map] of maps.entries()){
    const panel=document.querySelector('#response-panel-'+index);assert.ok(panel.textContent.includes(map.axisDefinition.xName));assert.ok(panel.textContent.includes(map.axisDefinition.yName));
    assert.equal(panel.querySelector('.profile-response-point').style.left,'8%');assert.equal(panel.querySelector('.profile-response-point').style.bottom,'92%');
    assert.equal(panel.querySelectorAll('.profile-response-values figure').length,4,'Overlapping placements still have four inspectable paintings and exact values');
  }
  assert.equal(renderProfileResponseMaps({maps:[{...maps[0],points:[{workId:'missing',x:50,y:50}]}],works,image,esc}),'');
  dom.window.close();
});

test('Switching and keyboard navigation retain the same panels and all input source nodes',()=>{
  const dom=new JSDOM('<main>'+renderProfileResponseMaps({maps,works,image,esc})+'</main>'),app=dom.window.document.querySelector('main');
  createProfileResponseTabs({app});const panels=[...app.querySelectorAll('[role="tabpanel"]')],tabs=[...app.querySelectorAll('[role="tab"]')],firstImage=panels[0].querySelector('img');
  tabs[1].click();assert.equal(panels[1].hidden,false);assert.equal(panels[0].hidden,true);assert.equal(tabs[1].getAttribute('aria-selected'),'true');
  tabs[1].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(panels[2].hidden,false);assert.equal(dom.window.document.activeElement,tabs[2]);
  tabs[2].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(panels[0].hidden,false);assert.equal(panels[0].querySelector('img'),firstImage,'No page rerender is needed to change a map');
  dom.window.close();
});

test('Substantive museum findings outrank generic sorting output regardless of source order',()=>{
  const findings=[{id:'geometry',priority:3},{id:'comparison',priority:9},{id:'museum',priority:12},{id:'bridge',priority:13}];
  assert.deepEqual(rankCuratorialReadings(findings).map(item=>item.id),['bridge','museum','comparison','geometry']);
  const picked=selectPrimaryReadings([{id:'weak',module:'patterns',priority:5},{id:'return',module:'response',priority:12},{id:'making',module:'making',priority:11}],[],2);
  assert.deepEqual(picked.map(item=>item.id),['return','making']);
});

test('The full profile keeps readings beyond seven and never promotes one weak feature to its identity',()=>{
  const observations=Array.from({length:14},(_,index)=>({id:'reading-'+index,module:'module-'+index,title:'Specific conclusion '+index,text:'Actual explanation '+index,priority:14-index,support:[],counter:[]}));
  const html=renderTastePortrait({portrait:{observations,profileSummary:{title:'Scenes & atmosphere',text:'Two supported themes.',findingIds:['reading-0','reading-1']}},works,image,esc});
  assert.ok(html.includes('Scenes &amp; atmosphere'));assert.ok(html.includes('Actual explanation 13'));
  assert.ok(html.includes('All readings'));assert.ok(!html.includes('A possible preference for simpler compositions'));
});

test('A range illustration shows the contrasting named paintings, without turning both favourites into an order',()=>{
  const finding={id:'contrast',module:'choice-range',title:'Both restraint and detail',text:'Work a and Work c.',priority:9,evidence:['a','b','c','d'],displayWorkIds:['a','c'],displayNotes:{a:{description:'Sparse composition',basis:'Explicit favourite'},c:{description:'Dense composition',basis:'Positive overall appeal'}},support:[]};
  const html=renderTastePortrait({portrait:{observations:[finding]},works,image,esc}),dom=new JSDOM(html),article=dom.window.document.querySelector('[data-insight="contrast"]');
  assert.deepEqual([...article.querySelectorAll('[data-comparison-work]')].map(el=>el.dataset.comparisonWork),['a','c']);
  assert.match(article.textContent,/Sparse composition/);assert.match(article.textContent,/Dense composition/);assert.ok(!article.textContent.includes('You preferred this'));dom.window.close();
});
