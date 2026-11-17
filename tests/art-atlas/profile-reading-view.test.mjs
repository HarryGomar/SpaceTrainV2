import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderProfileIntelligence,createProfileReadingTabs} from '../../public/art-atlas/profile-intelligence-view.mjs';

const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const category=(id,status='open')=>({id,title:id,readingTitle:'Reading '+id,status,statusLabel:status==='open'?'Still open':'Recurring evidence',conclusion:'A supported observation, with its limits.',support:[{roundId:'r1',workIds:['a','b']}],counter:[],nextComparison:{title:'A new comparison would separate the alternatives.'}});

test('The coloured visual index keeps all themes and displays only source-bound paintings',()=>{
  const categories=[category('attention'),category('appeal','supported'),category('company','not-explored')],works=[{id:'a',title:'A',artist:'Painter A'},{id:'b',title:'B',artist:'Painter B'},{id:'unrelated',title:'Unrelated'}];
  categories[1].displayWorkIds=['unrelated','b','a'];
  const dom=new JSDOM(renderProfileIntelligence({intelligence:{categories},works,esc,image:work=>'<img alt="'+work.title+'">',evidence:()=>'<details class="tp-evidence"><summary>View the choices</summary>Recorded evidence</details>'})),document=dom.window.document;
  assert.equal(document.querySelectorAll('.tp-index-item').length,3);assert.equal(document.querySelectorAll('.tp-index-item[open]').length,1);assert.equal(document.querySelector('.tp-index-item[open]').id,'profile-category-appeal');
  assert.deepEqual([...document.querySelector('#profile-category-appeal').querySelectorAll('[data-work]')].map(el=>el.dataset.work),['b','a']);assert.doesNotMatch(document.body.innerHTML,/data-work="unrelated"/);
  assert.equal(document.querySelector('#profile-category-company .tp-index-status').textContent,'Unexplored');assert.match(document.querySelector('#profile-category-company').textContent,/A comparison to try/);dom.window.close();
});

test('Opening a theme preserves its evidence and leaves the remaining themes available',()=>{
  const dom=new JSDOM('<main>'+renderProfileIntelligence({intelligence:{categories:[category('appeal','supported'),category('attention'),category('company','not-explored')]},esc,evidence:()=>'<details class="tp-evidence"><summary>View the choices</summary>Recorded evidence</details>'})+'</main>'),app=dom.window.document.querySelector('main');
  createProfileReadingTabs({app});const items=[...app.querySelectorAll('.tp-index-item')];items[1].open=true;items[1].dispatchEvent(new dom.window.Event('toggle'));
  assert.deepEqual(items.map(item=>item.open),[false,true,false]);assert.equal(items[1].querySelector('summary').getAttribute('aria-controls'),items[1].querySelector('.tp-index-body').id);
  const evidence=items[1].querySelector('.tp-evidence');evidence.open=true;evidence.dispatchEvent(new dom.window.Event('toggle'));assert.equal(items[1].open,true);assert.equal(evidence.open,true);
  items[2].open=true;items[2].dispatchEvent(new dom.window.Event('toggle'));assert.deepEqual(items.map(item=>item.open),[false,false,true]);assert.equal(evidence.open,true,'Source details survive switching themes');assert.equal(app.querySelectorAll('.tp-index-item>summary').length,3);dom.window.close();
});
