import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderProfileIntelligence,createProfileReadingTabs} from '../../public/art-atlas/profile-intelligence-view.mjs';

const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const category=(id,status='open')=>({id,title:id,readingTitle:'Reading '+id,status,statusLabel:status==='open'?'Still open':'Recurring evidence',conclusion:'A supported observation, with its limits.',support:[{roundId:'r1',workIds:['a','b']}],counter:[],nextComparison:{title:'A new comparison would separate the alternatives.'}});

test('Every theme stays available while one reading and its actual source paintings are presented',()=>{
  const categories=[category('attention'),category('appeal','supported'),category('company','not-explored')],works=[{id:'a',title:'A',artist:'Painter A'},{id:'b',title:'B',artist:'Painter B'},{id:'unrelated',title:'Unrelated'}];
  categories[1].displayWorkIds=['unrelated','b','a'];
  const dom=new JSDOM(renderProfileIntelligence({intelligence:{categories},works,esc,image:work=>`<img alt="${work.title}">`,evidence:()=>'<details class="tp-evidence"><summary>View the choices</summary>Recorded evidence</details>'})),document=dom.window.document;
  assert.equal(document.querySelectorAll('[role=tab]').length,3);assert.equal(document.querySelectorAll('[role=tabpanel]:not([hidden])').length,1);assert.equal(document.querySelector('[aria-selected=true]').id,'reading-tab-appeal');
  assert.deepEqual([...document.querySelector('#profile-category-appeal').querySelectorAll('[data-work]')].map(el=>el.dataset.work),['b','a']);assert.doesNotMatch(document.body.innerHTML,/data-work="unrelated"/);assert.equal(document.querySelectorAll('.tp-category-grid').length,0);dom.window.close();
});

test('Mouse and keyboard navigation preserve evidence, focus and the open categories',()=>{
  const dom=new JSDOM('<main>'+renderProfileIntelligence({intelligence:{categories:[category('appeal','supported'),category('attention'),category('company','not-explored')]},esc})+'</main>'),app=dom.window.document.querySelector('main');
  createProfileReadingTabs({app});const tabs=[...app.querySelectorAll('[role=tab]')];tabs[1].click();
  assert.equal(app.querySelector('[role=tabpanel]:not([hidden])').id,'profile-category-attention');assert.equal(tabs[0].tabIndex,-1);assert.equal(tabs[1].tabIndex,0);
  tabs[1].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(dom.window.document.activeElement,tabs[2]);assert.equal(app.querySelector('[role=tabpanel]:not([hidden])').id,'profile-category-company');assert.match(app.textContent,/A comparison to try/);
  tabs[2].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));assert.equal(dom.window.document.activeElement,tabs[0]);assert.equal(tabs.filter(tab=>tab.getAttribute('aria-selected')==='true').length,1);dom.window.close();
});
