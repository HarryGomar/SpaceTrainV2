import test from 'node:test';
import assert from 'node:assert/strict';
import {museumOffer,restrictMuseumDraft,galleryWheelPosition} from '../../public/art-atlas/museum-offer.mjs';
const catalogue='abcdefghij'.split('').map(id=>({id}));
const plan=Array.from({length:7},(_,i)=>({id:'journey-'+(i+1)}));

test('A museum contains earlier shown image questions and actual exercise presentations, not planned or text-only works',()=>{
  const shown={
    'journey-1':{id:'journey-1',kind:'spectrum',workIds:['a','b'],anchorIds:['c']},
    'journey-2':{id:'journey-2',kind:'statements',workIds:['d']},
    'journey-3':{id:'journey-3',kind:'exercise',exerciseKind:'curate',workIds:['d','e','f','g','h']},
    'journey-4':{id:'journey-4',kind:'grid',workIds:['f'],evidence:{stimulusVisibility:'not-shown'}},
    'journey-7':{id:'journey-7',kind:'spectrum',workIds:['i','j']}
  };
  const answers={'journey-3':{record:{offeredIds:['d','e','f','g','h'],presentedIds:['e'],placements:{g:{}}}}};
  assert.deepEqual(museumOffer({catalogue,plan,shown,answers,roundId:'journey-6'}).workIds,['a','b','c','e','g']);
});

test('Restricting an active older tray retains all shown and placed works without changing the original draft',()=>{
  const record={offeredIds:['a','b','c','d'],presentedIds:['b'],labelExposureIds:['c'],placements:{d:{wallId:'wall'}},ui:{selectedId:'a'}};
  const before=structuredClone(record),offer=museumOffer({catalogue,plan,shown:{},answers:{},roundId:'journey-6',currentRecord:record});
  assert.deepEqual(offer.workIds,['b','d']);const changed=restrictMuseumDraft(record,offer.workIds);
  assert.deepEqual(changed.offeredIds,['b','d']);assert.deepEqual(changed.placements,record.placements);assert.equal(changed.ui.selectedId,'b');assert.deepEqual(record,before);
  assert.equal(restrictMuseumDraft({...record,confirmed:true},['b','d']).offeredIds.length,4);
});

test('The mouse wheel moves a wide tray sideways and leaves browser zoom or exhausted edges alone',()=>{
  const geometry={scrollLeft:100,scrollWidth:1200,clientWidth:500};
  assert.equal(galleryWheelPosition({...geometry,deltaY:80}),180);
  assert.equal(galleryWheelPosition({...geometry,deltaX:-40,deltaY:3}),60);
  assert.equal(galleryWheelPosition({...geometry,deltaY:2,deltaMode:1}),132);
  assert.equal(galleryWheelPosition({...geometry,deltaY:1,deltaMode:2}),600);
  assert.equal(galleryWheelPosition({...geometry,scrollLeft:700,deltaY:80}),null);
  assert.equal(galleryWheelPosition({...geometry,deltaY:80,ctrlKey:true}),null);
});
