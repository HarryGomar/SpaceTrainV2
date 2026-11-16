import test from 'node:test';
import assert from 'node:assert/strict';
import {simplifyActiveInteraction} from '../../public/art-atlas/quiet-interactions.mjs';
import {FAMILIARITY_PROTOCOL,discoveryGridMarkup,validChoiceGrid} from '../../public/art-atlas/discovery-grid.mjs';
import {RECOGNITION_PROTOCOL} from '../../public/art-atlas/recognition-evidence.mjs';
import {validAnswer} from '../../public/art-atlas/engine.mjs';
import {buildProfileIntelligence} from '../../public/art-atlas/profile-intelligence.mjs';

const works=Array.from({length:4},(_,i)=>({id:'q'+i,title:'Painting '+i,artist:'Artist '+i,image:'assets/q'+i+'.jpg',sourceUrl:'https://museum.example/q'+i}));
const familiar={id:'familiar',kind:'choice-grid',selectionMode:'familiarity',works,evidence:{familiarityProtocol:FAMILIARITY_PROTOCOL}};

test('A partial familiarity draft becomes a gallery selection without inferring that the rest are new',()=>{
  const answer={workIds:works.map(w=>w.id),selectionMode:'familiarity',familiarity:{q0:'seen',q1:'new',q2:'unsure'},selectedIds:['q0'],explicitNone:false,unsure:false,confirmed:false},before=structuredClone({round:familiar,answer});
  const update=simplifyActiveInteraction(familiar,answer);assert.deepEqual({round:familiar,answer},before);assert.deepEqual(update.draft.selectedIds,['q0']);assert.equal(update.draft.familiarity,undefined);assert.equal(update.round.evidence.familiarityProtocol,'prior-encounter-selection-v3');assert.ok(validChoiceGrid(update.round,{...update.draft,confirmed:true}));
  const report=buildProfileIntelligence({works,rounds:[update.round],answers:{familiar:{...update.draft,confirmed:true}}});assert.deepEqual(report.recognition.familiarity.map(item=>[item.workId,item.status]),[['q0','seen']]);
  const html=discoveryGridMarkup(update.round,update.draft,{image:()=>'<img>',esc:String});assert.equal((html.match(/class="discovery-work"/g)||[]).length,4);assert.doesNotMatch(html,/fieldset|Painting 1: before today|New to me|Mark unanswered/);assert.match(html,/None of these/);assert.match(html,/Not sure/);
});

test('Completed explicit familiarity and recognition records keep their original protocols and reports',()=>{
  assert.equal(simplifyActiveInteraction(familiar,{confirmed:true}),null);assert.equal(simplifyActiveInteraction(familiar,{skipped:true}),null);
  const round={id:'match',kind:'match',field:'artist',works,options:works.map((w,i)=>({id:'a'+i,label:w.artist})),evidence:{instrumentRevision:RECOGNITION_PROTOCOL}},answer={workIds:works.map(w=>w.id),field:'artist',guesses:Object.fromEntries(works.map((w,i)=>[w.id,'a'+i])),certainty:Object.fromEntries(works.map(w=>[w.id,'guessed'])),confirmed:true};
  const before=structuredClone(answer);assert.equal(simplifyActiveInteraction(round,answer),null);assert.deepEqual(answer,before);assert.ok(validAnswer(round,answer));
  const update=simplifyActiveInteraction(round,{...answer,confirmed:false});assert.equal(update.draft.certainty,undefined);assert.ok(validAnswer(update.round,{...update.draft,confirmed:true}));
});

test('An explicit none remains an answered familiarity question without making all paintings unfamiliar',()=>{
  const round=simplifyActiveInteraction(familiar).round,answer={workIds:works.map(w=>w.id),selectionMode:'familiarity',selectedIds:[],explicitNone:true,unsure:false,confirmed:true};
  const result=buildProfileIntelligence({works,rounds:[round],answers:{[round.id]:answer}});assert.equal(result.recognition.familiarity.length,0);assert.equal(result.categories.find(category=>category.id==='recognition').status,'open');
});
