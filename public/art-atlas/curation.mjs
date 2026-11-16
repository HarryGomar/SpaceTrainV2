import { SCENARIOS, SLOT_IDS, SLOT_LABELS, REASONS, ROOM_BRIEFS, ROOM_QUESTIONS, hasRoomBriefs, upgradeEmptyExhibition, resetRoomResponses, createScenario, validScenarioDraft, validScenario, validArrangement, moveToSlot, selectedIds, analyzeScenarios } from './scenarios.mjs';
import { museumMatches } from './museums.mjs';
import { updateArtworkCorners } from './artwork-corners.mjs';
import { renderRoomExhibition, renderRoomWalkthrough, renderRoomRecord } from './room-experience.mjs';
import { isGallery,createGalleryRecord,roomName,roomOf,ROOMS,WALLS,CONNECTIONS,GALLERY_PROTOCOL,ROOM_STUDY,ROOM_PROMPTS } from './gallery-model.mjs';
import { createGalleryStudio,renderGallerySnapshot } from './gallery-studio.mjs';
import { createSortingTable,isSorting,analyzeSorting,renderSortingSnapshot } from './sorting-table.mjs';
import { createDifficultEdit,isDifficultEdit,analyzeDifficultEdit,difficultEditWalls } from './difficult-edit.mjs';
import { renderStudioTitle } from './experience-view.mjs';
import { restoreCurationRecords } from './curation-storage.mjs';

const KEY='art-profile-curation-v1';
export function createCurationLab({app,getWorks,getBaseline,getSaved,image,esc,navigate,showReading,keepButtons,storageChanged,inspect}) {
  let data={version:1,view:'home',drafts:{},parkedCurations:[],records:[],museumSaves:[],region:'any',purpose:'look'},active=null,reportId=null,storage=true,suppressClick=false;
  const work=id=>getWorks().find(w=>w.id===id),short=w=>w.shortTitle||w.title;
  const current=()=>data.drafts[data.view];
  const records=()=>data.records.filter(r=>validScenario(r,getWorks()));
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(data));}catch{storage=false;storageChanged?.();}};
  const studio=createGalleryStudio({app,getRecord:current,setRecord:r=>{data.drafts.curate=r;},getWorks,image,esc,save,rerender:()=>render(true),inspect});
  const sorting=createSortingTable({app,getRecord:current,setRecord:r=>{data.drafts.sorting=r;},getWorks,image,esc,save,rerender:()=>render(true),inspect});
  const difficult=createDifficultEdit({app,getRecord:current,setRecord:r=>{data.drafts['difficult-edit']=r;},getWorks,image,esc,save,rerender:()=>render(true),inspect});
  function restore() {
    try {const saved=JSON.parse(localStorage.getItem(KEY));if(saved?.version!==1)return;
      Object.assign(data,restoreCurationRecords(saved,getWorks()));
      data.drafts=Object.fromEntries(Object.entries(data.drafts).map(([kind,r])=>[kind,upgradeEmptyExhibition(r)]));
      data.museumSaves=Array.isArray(saved.museumSaves)?saved.museumSaves.filter(id=>typeof id==='string'):[];
      data.region=['any','Mexico','Europe','Asia','Americas'].includes(saved.region)?saved.region:'any'; data.purpose=saved.purpose==='study'?'study':'look';
      if(['home','report','museums',...SCENARIOS.map(s=>s.id)].includes(saved.view))data.view=saved.view;
      if(data.view==='report')data.view='home';
      if(!saved.galleryCutover&&data.drafts.curate&&!isGallery(data.drafts.curate)){const previous=data.drafts.curate;data.parkedCurations=data.parkedCurations.filter(r=>r.id!==previous.id);data.parkedCurations.push(previous);data.drafts.curate=createGalleryRecord(getWorks(),getBaseline());}
      data.galleryCutover=true;save();
    }catch{/* Keep unavailable or older storage intact. */}
  }
  const ready=()=>{if(isSorting(current()))return sorting.mountedReady();if(isDifficultEdit(current()))return difficult.mountedReady();if(isGallery(current()))return studio.mountedReady();const imgs=[...app.querySelectorAll('.lab-active img')];return imgs.length>0&&imgs.every(i=>i.complete&&i.naturalWidth>0);};
  function imageStatus() {
    if(isSorting(current())&&app.querySelector('.sorting-table')){sorting.sync();return;}
    if(isDifficultEdit(current())&&app.querySelector('.difficult-edit')){difficult.sync();return;}
    if(isGallery(current())&&app.querySelector('.gallery-studio')){studio.sync();return;}
    updateArtworkCorners(app);
    const status=app.querySelector('#lab-image-status');if(!status)return;
    const imgs=[...app.querySelectorAll('.lab-active img')],failed=imgs.filter(i=>i.complete&&!i.naturalWidth),loaded=ready();
    status.hidden=loaded;
    status.innerHTML=loaded?'':failed.length?`An artwork could not load. <button type="button" class="text-button" data-action="lab-retry">Retry images</button>`:'Loading artworks…';
    for(const el of app.querySelectorAll('[data-lab-work],[data-lab-slot],[data-action=lab-page],[data-action=lab-choice],[data-action=lab-unhang],[data-action=lab-reason],[data-action=lab-room-response]'))el.disabled=!loaded || el.dataset.action==='lab-page' && (Number(el.dataset.page)<0 || Number(el.dataset.page)>2);
    const finish=app.querySelector('[data-action=lab-finish]');if(finish)finish.disabled=!loaded||!validScenario(current(),getWorks(),false);
    const walkthrough=app.querySelector('[data-action=lab-walkthrough]');if(walkthrough)walkthrough.disabled=!loaded||!validArrangement(current(),getWorks());
    const next=app.querySelector('[data-action=lab-room-next]');if(next)next.disabled=!loaded||!current()?.roomResponses?.[ROOM_QUESTIONS[current().roomStep].id];
  }
  app.addEventListener('load',()=>imageStatus(),true);app.addEventListener('error',()=>imageStatus(),true);
  window.addEventListener('resize',()=>requestAnimationFrame(()=>updateArtworkCorners(app)));
  function go(view) {data.view=view;active=null;save();navigate();}
  function start(kind,again=false) {
    if(kind==='curate'&&again&&data.drafts.curate)parkCurrentArrangement();
    if(again||!data.drafts[kind])data.drafts[kind]=createScenario(kind,getWorks(),getBaseline(),records());
    data.view=kind;active=null;save();navigate();
  }
  function parkCurrentArrangement() {
    const d=data.drafts.curate;if(!d)return;
    data.parkedCurations=data.parkedCurations.filter(r=>r.id!==d.id);data.parkedCurations.push(structuredClone(d));
  }
  function savedArrangements() {
    return data.parkedCurations.length?`<details class="lab-history"><summary>Your saved arrangements</summary>${data.parkedCurations.map(d=>`<button class="text-button" type="button" data-action="lab-use-arrangement" data-id="${esc(d.id)}">${isGallery(d)?'Connected galleries':hasRoomBriefs(d)?'Room briefs':'Free arrangement'} · ${selectedIds(d).length} hung →</button>`).join('')}</details>`:'';
  }
  function top(label,back='lab-home') {return `<div class="lab-top"><button type="button" class="text-button" data-action="${back}">← ${back==='lab-home'?'Exercises':'Introduction'}</button><span>${esc(label)}</span><button type="button" class="text-button" data-action="lab-reading">Your reading ↗</button></div>`;}
  function homepage() {
    const done=records();
    const historyHtml=[...done].reverse().map(r=>`<button type="button" class="text-button" data-action="lab-report" data-id="${esc(r.id)}">${esc(SCENARIOS.find(s=>s.id===r.kind).short)} · ${esc(new Date(r.finishedAt).toLocaleDateString())} ↗</button>`).join('');
    return renderStudioTitle({scenarios:SCENARIOS,records:done,drafts:data.drafts,historyHtml,savedArrangementHtml:savedArrangements()+(Object.values(data.retained||{}).some(items=>items.length)?'<p>Some saved exercises refer to unavailable works or older formats. Their original records remain in your download.</p><button class="text-button" type="button" data-action="lab-export">Download all exercise records ↓</button>':''),storage,esc});
  }
  function artButton(id,extra='',action='lab-select') {
    const w=work(id),d=current(),slot=d?.kind==='curate'&&SLOT_IDS.find(s=>d.layout[s]===id),chosen=d?.kind!=='curate'&&d?.choiceId===id;
    return `<button type="button" class="drag-art lab-art ${extra}" data-action="${action}" data-work="${esc(id)}" data-lab-work="${esc(id)}" aria-pressed="${d?.kind==='curate'?active===id:chosen}" aria-label="${esc(short(w))}. ${action==='lab-choice'?'Choose this work, or drag it to the response area.':'Select this painting, then a place in the museum. Dragging also works.'}"><span class="art-visual">${image(w)}</span><span class="drag-caption"><span>${esc(short(w))}</span><span>${slot?'Room '+(Math.floor(SLOT_IDS.indexOf(slot)/2)+1):chosen?(d.kind==='edit'?'Goes back':'Chosen'):'Select'}</span></span></button>`;
  }
  function floorWalls() {
    return `<svg class="floor-walls floor-wide" viewBox="0 0 900 340" preserveAspectRatio="none" aria-hidden="true"><path d="M10 140 V10 H890 V330 H10 V200 M300 10 V140 M300 200 V330 M600 10 V140 M600 200 V330"/><path class="floor-door" d="M10 140 H65 M300 140 H355 M600 140 H655 M65 140 A60 60 0 0 1 10 200 M355 140 A60 60 0 0 1 300 200 M655 140 A60 60 0 0 1 600 200"/></svg><svg class="floor-walls floor-tall" viewBox="0 0 340 900" preserveAspectRatio="none" aria-hidden="true"><path d="M140 10 H10 V890 H330 V10 H200 M10 300 H140 M200 300 H330 M10 600 H140 M200 600 H330"/><path class="floor-door" d="M140 10 V65 M140 300 V355 M140 600 V655"/></svg>`;
  }
  function curate() {
    const d=current();if(isGallery(d))return studio.markup();if(!hasRoomBriefs(d))return freeCurate();
    if(d.phase==='walkthrough')return renderRoomWalkthrough({record:d,work,image,esc,top});
    const ids=d.offeredIds.slice((d.page||0)*4,(d.page||0)*4+4);
    if(!active||!d.offeredIds.includes(active))active=ids.find(id=>!Object.values(d.layout).includes(id))||ids[0];
    return renderRoomExhibition({record:d,selectedId:active,work,image,esc,top,artButton});
  }
  function freeCurate() {
    const d=current(),page=Math.max(0,Math.min(2,d.page||0)),ids=d.offeredIds.slice(page*4,page*4+4),count=selectedIds(d).length;
    if(!active||!d.offeredIds.includes(active))active=ids.find(id=>!Object.values(d.layout).includes(id))||ids[0];
    return `<section class="lab-active" data-lab-kind="curate">${top('Your museum')}<div class="legacy-arrangement-note"><p>Keep this free arrangement and try three different room briefs. These placements will stay saved.</p><button type="button" class="text-button" data-action="lab-new-rooms">Open connected galleries →</button></div><div class="question-head"><h1 id="question-title">Build a small exhibition.</h1><p>Make an exhibition you would want to visit. Two works per room. Review all three groups before finishing. This saved arrangement keeps its original free brief.</p></div><div id="lab-image-status" class="image-status" role="status" hidden></div><div class="curator-layout"><aside class="curator-library"><div class="library-heading"><span>Available works</span><span>Group ${page+1} / 3</span></div><div class="lab-work-grid">${ids.map(id=>`<div class="lab-work ${Object.values(d.layout).includes(id)?'has-placement':''}">${artButton(id)}<div class="lab-work-info"><span>${esc(work(id).country||work(id).artist)}</span><button type="button" class="text-button" data-action="evidence" data-work="${esc(id)}" aria-label="Look closer at ${esc(short(work(id)))}">↗</button></div></div>`).join('')}</div><div class="tray-pagination"><button type="button" class="text-button" data-action="lab-page" data-page="${page-1}" ${page===0?'disabled':''}>← Previous</button><span>${d.presentedIds.length} / 12 presented</span><button type="button" class="text-button" data-action="lab-page" data-page="${page+1}" ${page===2?'disabled':''}>Next group →</button></div><p class="lab-drag-help" id="lab-selected">Selected: ${esc(short(work(active)))}. Drag it or tap a wall position.</p></aside><div class="museum-board"><div class="museum-floorplan">${floorWalls()}<div class="museum-rooms">${[0,1,2].map(room=>`<section class="museum-room" aria-label="Room ${room+1}"><label class="room-name"><span>Room 0${room+1}</span><input aria-label="Optional name for room ${room+1}" data-room-name="${room}" maxlength="40" value="${esc(d.roomNames[room])}" placeholder="Name this room, if you like"></label><div class="room-hanging">${SLOT_IDS.slice(room*2,room*2+2).map((slot,i)=>{const id=d.layout[slot];return `<div class="wall-place"><button type="button" class="drag-art wall-position" data-action="lab-slot" data-lab-slot="${slot}" ${id?`data-lab-work="${esc(id)}" data-work="${esc(id)}"`:''} aria-pressed="${!!id&&active===id}" aria-label="${esc(SLOT_LABELS[room*2+i])}${id?'. '+esc(short(work(id))):'. Place the selected painting here.'}">${id?`<span class="art-visual">${image(work(id))}</span>`:`<span class="empty-wall"><span aria-hidden="true">+</span>${slot==='r1a'?'Opening work':slot==='r3b'?'Closing work':'Place a work'}</span>`}</button><div class="wall-caption"><span>${slot==='r1a'?'Opening':slot==='r3b'?'Closing':i===0?'First':'Second'}</span>${id?`<button class="text-button" type="button" data-action="lab-unhang" data-work="${esc(id)}">Put back</button>`:''}</div></div>`;}).join('')}</div></section>`).join('')}</div><span class="floor-entrance" aria-hidden="true"></span></div><p class="floor-caption">${count} of 6 hung · Three rooms, two works each · The plan is illustrative.</p></div></div><div class="round-actions"><button class="text-button" type="button" data-action="lab-home">Save and come back later</button><button type="button" class="primary-button" data-action="lab-finish" disabled>Read this exhibition →</button></div></section>`;
  }
  function mini() {
    const d=current(),s=SCENARIOS.find(s=>s.id===d.kind),chosen=d.choiceId&&work(d.choiceId);
    const anchor=id=>`<figure class="scenario-anchor">${image(work(id))}<figcaption>${esc(short(work(id)))}</figcaption></figure>`;
    const response=`<div class="scenario-response" data-lab-response="true" aria-label="Drop the chosen painting here">${chosen?image(chosen):'<span>Drop a work here<br>or choose one below</span>'}<p>${d.kind==='edit'?'Goes back':d.kind==='bridge'?'Connecting work':'Companion'}</p></div>`;
    return `<section class="lab-active" data-lab-kind="${d.kind}">${top(s.short)}<div class="question-head"><h1 id="question-title">${esc(s.title)}</h1><p>${esc(s.instruction)}</p></div><div id="lab-image-status" class="image-status" role="status" hidden></div><div class="scenario-stage ${d.kind==='bridge'?'three-parts':''}">${d.kind==='edit'?response:anchor(d.anchorIds[0])+response+(d.kind==='bridge'?anchor(d.anchorIds[1]):'')}</div><div class="scenario-choices ${d.kind==='edit'?'three-choices':''}">${d.offeredIds.map(id=>`<div class="lab-work">${artButton(id,'','lab-choice')}<div class="lab-work-info"><span>${esc(work(id).country||work(id).artist)}</span><button type="button" class="text-button" data-action="evidence" data-work="${esc(id)}" aria-label="Look closer at ${esc(short(work(id)))}">↗</button></div></div>`).join('')}</div><fieldset class="scenario-reason"><legend>${d.kind==='edit'?'What guided the edit?':'What makes the connection?'} <span>Optional</span></legend><div class="chip-row">${REASONS.map(reason=>`<button type="button" class="choice-chip" data-action="lab-reason" data-value="${esc(reason)}" aria-pressed="${d.reason===reason}">${esc(reason)}</button>`).join('')}</div></fieldset><div class="round-actions"><button class="text-button" type="button" data-action="lab-home">Save and come back later</button><button type="button" class="primary-button" data-action="lab-finish" disabled>See the connection →</button></div></section>`;
  }
  function report() {
    const record=records().find(r=>r.id===reportId)||records().at(-1);if(!record)return homepage();
    if(isSorting(record)||isDifficultEdit(record))return studioReport(record);
    if(isGallery(record))return galleryReport(record);
    const result=analyzeScenarios(getWorks(),[record]),chosen=selectedIds(record),omitted=record.kind==='curate'?record.offeredIds.filter(id=>!chosen.includes(id)):[];
    return `<section class="lab-report">${top('Your curatorial decisions')}<p class="eyebrow">${esc(SCENARIOS.find(s=>s.id===record.kind).short)}</p><h1>${esc(result.findings[0]?.title||'A record of this choice.')}</h1>${hasRoomBriefs(record)?renderRoomRecord({record,work,image,esc}):''}<div class="exhibition-strip">${chosen.map(id=>`<button type="button" data-action="evidence" data-work="${esc(id)}" aria-label="View ${esc(short(work(id)))}">${image(work(id))}</button>`).join('')}</div>${result.findings.map((f,i)=>`<article class="lab-finding">${i?'<h2>'+esc(f.title)+'</h2>':''}<p>${esc(f.text)}</p><details><summary>Works, evidence and limits</summary>${f.support.map(e=>`<p><span>${esc(e.label)}</span> ${esc(e.detail)}</p>`).join('')}${f.counter.map(e=>`<p>Exception: ${esc(e.detail)}</p>`).join('')}${f.alternatives.map(t=>`<p>${esc(t)}</p>`).join('')}</details></article>`).join('')}${omitted.length?`<details class="omitted-works"><summary>The ${omitted.length} works left out of this exhibition</summary><p>All twelve were presented. Six wall positions were available. A work left out is not recorded as a dislike.</p><div class="exhibition-strip">${omitted.map(id=>`<button type="button" data-action="evidence" data-work="${esc(id)}" aria-label="View ${esc(short(work(id)))}">${image(work(id))}</button>`).join('')}</div></details>`:''}<div class="lab-report-actions"><button type="button" class="primary-button" data-action="lab-reading">See your combined reading →</button><button type="button" class="text-button" data-action="lab-museums">Museums this could lead to ↗</button><button type="button" class="text-button" data-action="lab-again" data-kind="${record.kind}">Try another ${record.kind==='curate'?'exhibition':'choice'}</button><button type="button" class="text-button" data-action="lab-export">Download exercise records ↓</button></div><div class="report-keeps"><p>Keep any of these works for looking or study.</p>${chosen.map(id=>`<div><span>${esc(short(work(id)))}</span>${keepButtons(work(id))}</div>`).join('')}</div></section>`;
  }
  function studioReport(record) {
    const previous=records().filter(r=>r.id!==record.id&&r.finishedAt<=record.createdAt);
    const findings=isSorting(record)?analyzeSorting(getWorks(),record,previous):analyzeDifficultEdit(getWorks(),record,previous);
    const art=id=>`<button type="button" data-action="evidence" data-work="${esc(id)}" aria-label="View ${esc(short(work(id)))}">${image(work(id))}</button>`;
    const strip=ids=>`<div class="exhibition-strip">${ids.map(art).join('')}</div>`;
    const walls=isDifficultEdit(record)?difficultEditWalls(record):null;
    const snapshot=isSorting(record)?renderSortingSnapshot({record,work,image,esc}):`<div class="edit-record"><p class="eyebrow">Your initial edit</p>${strip(walls.initial)}<p class="lab-local-note">You put ${esc(short(work(record.removedId)))} back.</p><p class="eyebrow">The alternative</p>${strip(walls.alternative)}<p class="lab-local-note">${record.compareChoice==='equal'?'You gave both walls equal preference.':record.compareChoice==='alternative'?'You chose the alternative wall.':'You kept your initial wall.'}</p></div>`;
    return `<section class="lab-report studio-report">${top(SCENARIOS.find(s=>s.id===record.kind).short)}<p class="eyebrow">Your arrangement, recorded</p><h1>${esc(findings[0]?.title||'The connections you made.')}</h1>${snapshot}${findings.map((f,i)=>`<article class="lab-finding">${i?'<h2>'+esc(f.title)+'</h2>':''}<p>${esc(f.text)}</p><details><summary>Works, evidence and limits</summary>${f.support.map(e=>`<p><span>${esc(e.label)}</span> ${esc(e.detail)}</p>${strip(e.workIds)}`).join('')}${f.counter.map(e=>`<p>Exception: ${esc(e.detail)}</p>${strip(e.workIds)}`).join('')}${f.alternatives.map(t=>`<p>${esc(t)}</p>`).join('')}</details></article>`).join('')}<div class="lab-report-actions"><button type="button" class="primary-button" data-action="lab-reading">See your combined reading →</button><button type="button" class="text-button" data-action="lab-again" data-kind="${record.kind}">Try another arrangement ↗</button><button type="button" class="text-button" data-action="lab-export">Download exercise records ↓</button></div><div class="report-keeps"><p>Keep a work for looking or study.</p>${record.offeredIds.map(id=>`<div><span>${esc(short(work(id)))}</span>${keepButtons(work(id))}</div>`).join('')}</div></section>`;
  }
  function galleryReport(record) {
    const result=analyzeScenarios(getWorks(),[record]),chosen=selectedIds(record),omitted=record.presentedIds.filter(id=>!chosen.includes(id));
    return `<section class="lab-report gallery-report">${top('Your exhibition')}<p class="eyebrow">${chosen.length} works · ${new Set(chosen.map(id=>roomOf(record,id))).size} galleries</p><h1>${esc(result.findings[0]?.title||'Your arrangement, recorded.')}</h1>${renderGallerySnapshot({record,work,image,esc})}${result.findings.map((f,i)=>`<article class="lab-finding">${i?'<h2>'+esc(f.title)+'</h2>':''}<p>${esc(f.text)}</p><details><summary>Works, evidence and limits</summary>${f.support.map(e=>`<p>${esc(e.detail)}</p><div class="exhibition-strip">${e.workIds.map(id=>`<button type="button" data-action="evidence" data-work="${esc(id)}" aria-label="View ${esc(short(work(id)))}">${image(work(id))}</button>`).join('')}</div>`).join('')}${f.counter.map(e=>`<p>Exception: ${esc(e.detail)}</p>`).join('')}${f.alternatives.map(t=>`<p>${esc(t)}</p>`).join('')}</details></article>`).join('')}<details class="room-record"><summary>Your gallery groups</summary>${ROOMS.filter(r=>chosen.some(id=>roomOf(record,id)===r.id)).map(r=>`<h2>${esc(roomName(record,r.id))}</h2><div class="exhibition-strip">${chosen.filter(id=>roomOf(record,id)===r.id).map(id=>`<button type="button" data-action="evidence" data-work="${esc(id)}" aria-label="View ${esc(short(work(id)))}">${image(work(id))}</button>`).join('')}</div>`).join('')}</details><p class="lab-local-note">${record.presentedIds.length} works were presented in the tray. ${omitted.length} of those were left out. Unseen works are not treated as rejected.</p><div class="lab-report-actions"><button type="button" class="primary-button" data-action="lab-reading">See your combined reading →</button><button type="button" class="text-button" data-action="lab-museums">Museums to explore ↗</button><button type="button" class="text-button" data-action="lab-edit-gallery" data-id="${esc(record.id)}">Add or move works</button><button type="button" class="text-button" data-action="lab-again" data-kind="curate">Make another arrangement</button><button type="button" class="text-button" data-action="lab-export">Download exercise records ↓</button></div><div class="report-keeps">${chosen.map(id=>`<div><span>${esc(short(work(id)))}</span>${keepButtons(work(id))}</div>`).join('')}</div></section>`;
  }
  function museums() {
    const result=museumMatches(getWorks(),records(),getBaseline(),getSaved(),{region:data.region,purpose:data.purpose});
    return `<section class="museum-suggestions">${top('Collection connections')}<p class="eyebrow">Where your choices could lead</p><h1>Museums to explore.</h1><p class="lab-intro">${result.personalized?'Suggestions connected to the works you chose, curated or kept. Each gives a reason and an institutional source.':'Build an exhibition, complete a few quiz rounds or keep works in your collection to get personal connections. You can explore these collections now.'}</p><div class="museum-filters"><div aria-label="Purpose">${[['look','For looking'],['study','For study']].map(([id,label])=>`<button class="text-button" type="button" data-action="lab-purpose" data-value="${id}" aria-pressed="${data.purpose===id}">${label}</button>`).join('')}</div><div aria-label="Location">${[['any','Anywhere'],['Mexico','Mexico'],['Europe','Europe'],['Asia','Asia'],['Americas','Americas']].map(([id,label])=>`<button class="text-button" type="button" data-action="lab-region" data-value="${id}" aria-pressed="${data.region===id}">${label}</button>`).join('')}</div></div><div class="museum-list">${result.items.map((m,i)=>`<article class="museum-suggestion"><span class="museum-index">${String(i+1).padStart(2,'0')}</span><div><p class="eyebrow">${esc(m.city)} · ${esc(m.country)}</p><h2>${esc(m.name)}</h2><p>${esc(m.reason)}</p><p class="museum-collection-fact">${esc(m.fact)}</p>${m.evidence.length?`<div class="museum-evidence">${m.evidence.map(id=>`<button type="button" data-action="evidence" data-work="${esc(id)}">${image(work(id))}<span>${esc(short(work(id)))}</span></button>`).join('')}</div>`:''}<div class="museum-links"><a href="${esc(m.sourceUrl)}" target="_blank" rel="noopener noreferrer">Collection source ↗</a><a href="${esc(m.visitUrl)}" target="_blank" rel="noopener noreferrer">Plan a visit ↗</a><button class="text-button" data-action="lab-save-museum" data-id="${m.id}" type="button" aria-pressed="${data.museumSaves.includes(m.id)}">${data.museumSaves.includes(m.id)?'✓ Saved':'+ Save museum'}</button></div></div></article>`).join('')}</div><details class="museum-method"><summary>How these suggestions work</summary><p>${esc(result.method)}</p><p>Collection facts checked 13 November 2026. A matching artist does not mean the exact painting selected here is held by that museum. Countries describe artworks and destinations, not the viewer's identity.</p></details></section>`;
  }
  function render(keepScroll=false) {
    const y=window.scrollY;
    if(SCENARIOS.some(s=>s.id===data.view)&&!current())data.view='home';
    app.innerHTML=data.view==='home'?homepage():data.view==='curate'?curate():data.view==='sorting'?sorting.markup():data.view==='difficult-edit'?difficult.markup():data.view==='report'?report():data.view==='museums'?museums():mini();
    imageStatus();if(keepScroll)requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}));
  }
  function select(id) {active=id;for(const el of app.querySelectorAll('[data-lab-work]'))el.setAttribute('aria-pressed',String(el.dataset.labWork===id));const status=app.querySelector('#lab-selected');if(status)status.textContent='Selected: '+short(work(id))+'. Drag it or tap a wall position.';const thumb=app.querySelector('#room-selected-thumb'),label=app.querySelector('#room-selected-title');if(thumb)thumb.innerHTML=image(work(id));if(label)label.textContent='Place '+short(work(id));imageStatus();}
  function choose(id) {const d=current();if(!d?.offeredIds.includes(id))return;d.choiceId=id;save();render(true);}
  function place(id,slot) {const d=current();if(!d)return;data.drafts.curate=moveToSlot(d,id,slot);active=id;save();render(true);}
  function finish() {const d=current();if(!ready()||!validScenario(d,getWorks(),false))return;const record={...structuredClone(d),confirmed:true,finishedAt:Date.now()};data.records.push(record);data.records=data.records.slice(-40);delete data.drafts[d.kind];reportId=record.id;data.view='report';save();navigate();}
  function exportData(){return {version:1,retained:structuredClone(data.retained||{records:[],drafts:[],parkedCurations:[]}),records:records(),drafts:[...Object.values(data.drafts),...data.parkedCurations].map(r=>structuredClone(r)),museumSaves:[...data.museumSaves],studioProtocols:{sorting:{id:'sorting-table-v1',positionSpace:'unit-square-v1',aspectRatio:[3,2],instruction:'Put works that belong together near one another. You decide what the groups mean.'},difficultEdit:{id:'difficult-edit-v2',instruction:'Keep three paintings that work together. Put one back.',legacyProtocols:['difficult-edit-v1']}},galleryProtocol:{id:GALLERY_PROTOCOL,rooms:ROOMS,walls:WALLS,connections:CONNECTIONS,roomStudy:{id:ROOM_STUDY,prompts:ROOM_PROMPTS}},roomProtocol:{id:'three-briefs-v1',rooms:ROOM_BRIEFS,visitQuestions:ROOM_QUESTIONS}};}
  function exportRecords(){const blob=new Blob([JSON.stringify(exportData(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='my-art-exhibitions.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  app.addEventListener('input',event=>{const el=event.target;if(el.matches('[data-room-name]')&&current()?.kind==='curate'){current().roomNames[Number(el.dataset.roomName)]=el.value.slice(0,40);save();}});
  let drag=null,frame;
  const clear=()=>{if(frame)cancelAnimationFrame(frame);drag?.ghost?.remove();for(const el of app.querySelectorAll('.drag-over,.is-dragging'))el.classList.remove('drag-over','is-dragging');drag=null;};
  const hover=()=>{if(!drag?.ghost)return;const delta=drag.y<45?-9:drag.y>innerHeight-45?9:0;if(delta)window.scrollBy(0,delta);for(const el of app.querySelectorAll('[data-lab-slot],[data-lab-response]')){const r=el.getBoundingClientRect();el.classList.toggle('drag-over',drag.x>=r.left&&drag.x<=r.right&&drag.y>=r.top&&drag.y<=r.bottom);}frame=requestAnimationFrame(hover);};
  app.addEventListener('pointerdown',event=>{const el=event.target.closest('[data-lab-work]');if(!el||!current()||!ready()||event.button!==0)return;drag={id:el.dataset.labWork,el,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,ghost:null};el.setPointerCapture(event.pointerId);});
  app.addEventListener('pointermove',event=>{if(!drag)return;drag.x=event.clientX;drag.y=event.clientY;if(!drag.ghost&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>7){drag.ghost=document.createElement('div');drag.ghost.className='art-drag-ghost';drag.ghost.setAttribute('aria-hidden','true');drag.ghost.innerHTML=image(work(drag.id));drag.ghost.style.width='130px';document.body.append(drag.ghost);drag.el.classList.add('is-dragging');hover();}if(drag.ghost){drag.ghost.style.left=event.clientX+'px';drag.ghost.style.top=event.clientY+'px';}});
  app.addEventListener('pointerup',event=>{if(!drag)return;const moved=!!drag.ghost,id=drag.id;clear();if(!moved)return;suppressClick=true;setTimeout(()=>suppressClick=false,120);const target=[...app.querySelectorAll('[data-lab-slot],[data-lab-response]')].find(el=>{const r=el.getBoundingClientRect();return event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;});if(!target)return;if(data.view==='curate')place(id,target.dataset.labSlot);else choose(id);});
  app.addEventListener('pointercancel',clear);
  return {
    restore,render,records,clear:()=>{data={version:1,view:'home',drafts:{},parkedCurations:[],records:[],museumSaves:[],region:'any',purpose:'look'};active=null;reportId=null;localStorage.removeItem(KEY);},exportData,
    handle(action,control,event) {
      if(isSorting(current())&&sorting.handle(action,control,event))return true;
      if(isDifficultEdit(current())&&difficult.handle(action,control,event))return true;
      if(isGallery(current())&&studio.handle(action,control,event))return true;
      if(!action?.startsWith('lab-'))return false;
      if(suppressClick)return true;
      if(action==='lab-home')go('home');if(action==='lab-exit'){navigate('intro');return true;}
      if(action==='lab-start')start(control.dataset.kind);if(action==='lab-again')start(control.dataset.kind,true);
      if(action==='lab-new-rooms'&&current()?.kind==='curate'&&!hasRoomBriefs(current())){parkCurrentArrangement();data.drafts.curate=createScenario('curate',getWorks(),getBaseline(),records());go('curate');}
      if(action==='lab-use-arrangement'){const target=data.parkedCurations.find(r=>r.id===control.dataset.id);if(target){parkCurrentArrangement();data.parkedCurations=data.parkedCurations.filter(r=>r.id!==target.id);data.drafts.curate=target;go('curate');}}
      if(action==='lab-museums')go('museums');if(action==='lab-reading'){showReading();return true;}
      if(action==='lab-select'&&ready())select(control.dataset.work);
      if(action==='lab-slot'&&ready()){if(active)place(active,control.dataset.labSlot);else if(control.dataset.work)select(control.dataset.work);}
      if(action==='lab-unhang'&&ready()){const d=current(),slot=SLOT_IDS.find(s=>d.layout[s]===control.dataset.work);if(slot){delete d.layout[slot];data.drafts.curate=resetRoomResponses(d);}active=control.dataset.work;save();render(true);}
      if(action==='lab-page'&&ready()){const d=current(),page=Number(control.dataset.page);if(page>=0&&page<3){d.page=page;const ids=d.offeredIds.slice(page*4,page*4+4);d.presentedIds=[...new Set([...d.presentedIds,...ids])];active=ids[0];save();render(true);}}
      if(action==='lab-choice'&&ready())choose(control.dataset.work);
      if(action==='lab-reason'&&ready()){current().reason=control.dataset.value;save();for(const el of app.querySelectorAll('[data-action=lab-reason]'))el.setAttribute('aria-pressed',String(el.dataset.value===current().reason));}
      if(action==='lab-finish')finish();
      if(action==='lab-room-focus'){app.querySelector(`[data-museum-room="${control.dataset.room}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});}
      if(action==='lab-walkthrough'&&ready()&&hasRoomBriefs(current())&&validArrangement(current(),getWorks())){current().phase='walkthrough';current().roomStep=0;save();navigate();}
      if(action==='lab-room-response'&&ready()&&hasRoomBriefs(current())&&current().phase==='walkthrough'&&control.dataset.question===ROOM_QUESTIONS[current().roomStep].id&&ROOM_BRIEFS.some(r=>r.id===control.dataset.room)){current().roomResponses[control.dataset.question]=control.dataset.room;save();render(true);}
      if(action==='lab-room-next'&&ready()&&hasRoomBriefs(current())&&current().roomResponses.lastMinutes){current().roomStep=1;save();navigate();}
      if(action==='lab-room-previous'&&hasRoomBriefs(current())){current().roomStep=0;save();navigate();}
      if(action==='lab-room-edit'&&hasRoomBriefs(current())){data.drafts.curate=resetRoomResponses(current());save();navigate();}
      if(action==='lab-edit-gallery'){const source=records().find(r=>r.id===control.dataset.id&&isGallery(r));if(source){parkCurrentArrangement();const next=structuredClone(source);next.revises=source.id;next.id='gallery-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);next.createdAt=Date.now();next.confirmed=false;delete next.finishedAt;next.roomStudy=ROOM_STUDY;next.phase='arrange';next.roomStep=0;next.roomResponses={};data.drafts.curate=next;go('curate');}}
      if(action==='lab-report'){reportId=control.dataset.id;go('report');}
      if(action==='lab-export')exportRecords();
      if(action==='lab-region'){data.region=control.dataset.value;save();render(true);}if(action==='lab-purpose'){data.purpose=control.dataset.value;save();render(true);}
      if(action==='lab-save-museum'){const id=control.dataset.id;data.museumSaves=data.museumSaves.includes(id)?data.museumSaves.filter(v=>v!==id):[...data.museumSaves,id];save();control.setAttribute('aria-pressed',String(data.museumSaves.includes(id)));control.textContent=data.museumSaves.includes(id)?'✓ Saved':'+ Save museum';}
      if(action==='lab-retry'){for(const img of app.querySelectorAll('.lab-active img'))if(!img.complete||!img.naturalWidth)img.src='./'+work(img.dataset.artwork).image+'?retry='+Date.now();imageStatus();}
      return true;
    }
  };
}
