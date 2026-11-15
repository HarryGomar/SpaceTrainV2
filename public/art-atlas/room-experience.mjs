import { ROOM_BRIEFS, ROOM_QUESTIONS, SLOT_IDS, roomWorkIds, selectedIds } from './scenarios.mjs';

const short = w => w.shortTitle || w.title;
function walls() {
  return `<svg class="brief-walls brief-wide" viewBox="0 0 900 550" preserveAspectRatio="none" aria-hidden="true">
    <path class="room-wall-opening" d="M10 190 V30 H290 V205 M290 265 V450 H10 V250"/>
    <path class="room-wall-study" d="M310 205 V10 H590 V245 M590 305 V510 H310 V265"/>
    <path class="room-wall-return" d="M610 245 V80 H890 V460 H820 V530 H610 V305"/>
    <path class="brief-passages" d="M290 205 H310 M290 265 H310 M590 245 H610 M590 305 H610"/>
    <path class="brief-door" d="M10 190 H50 M50 190 A60 60 0 0 1 10 250 M310 205 H350 M350 205 A60 60 0 0 1 310 265 M610 245 H650 M650 245 A60 60 0 0 1 610 305"/>
    <path class="brief-bench" d="M406 458 H494 M692 474 H770"/>
  </svg><svg class="brief-walls brief-tall" viewBox="0 0 340 1260" preserveAspectRatio="none" aria-hidden="true">
    <path class="room-wall-opening" d="M140 10 H10 V390 H140 M200 390 H330 V10 H200"/>
    <path class="room-wall-study" d="M140 420 H10 V810 H140 M200 810 H330 V420 H200"/>
    <path class="room-wall-return" d="M140 840 H10 V1250 H260 V1210 H330 V840 H200"/>
    <path class="brief-passages" d="M140 390 V420 M200 390 V420 M140 810 V840 M200 810 V840"/>
    <path class="brief-door" d="M140 10 V55 M140 420 V465 M140 840 V885"/>
  </svg>`;
}
function roomHeading(room,index,record,esc) {
  return `<span class="brief-room-number">Room 0${index+1}</span><h2>${esc(room.title)}</h2><p class="brief-prompt">${esc(room.prompt)}</p>`;
}
export function renderRoomExhibition({record:d,selectedId,work,image,esc,top,artButton}) {
  const page=Math.max(0,Math.min(2,d.page||0)),ids=d.offeredIds.slice(page*4,page*4+4),count=selectedIds(d).length;
  return `<section class="lab-active room-exhibition" data-lab-kind="curate">
    ${top('Your museum')}<div class="question-head"><h1 id="question-title">Three rooms. Three different visits.</h1><p>Give each room two works. Review all twelve paintings before the walk-through.</p></div>
    <div id="lab-image-status" class="image-status" role="status" hidden></div>
    <div class="curator-layout brief-curator-layout">
      <aside class="curator-library">
        <div class="library-heading"><span>Available works</span><span>Group ${page+1} / 3</span></div>
        <div class="tray-pagination"><button type="button" class="text-button" data-action="lab-page" data-page="${page-1}" ${page===0?'disabled':''}>← Previous</button><span>${d.presentedIds.length} / 12 presented</span><button type="button" class="text-button" data-action="lab-page" data-page="${page+1}" ${page===2?'disabled':''}>Next group →</button></div>
        <div class="lab-work-grid">${ids.map(id=>`<div class="lab-work ${Object.values(d.layout).includes(id)?'has-placement':''}">${artButton(id)}<div class="lab-work-info"><span>${esc(work(id).country||work(id).artist)}</span><button type="button" class="text-button" data-action="evidence" data-work="${esc(id)}" aria-label="Look closer at ${esc(short(work(id)))}">↗</button></div></div>`).join('')}</div>
        <p class="lab-drag-help" id="lab-selected">Selected: ${esc(short(work(selectedId)))}. Drag it or tap a wall position.</p>
      </aside>
      <div class="museum-board brief-board">
        <div class="room-location-bar"><span id="room-selected-thumb">${image(work(selectedId))}</span><span id="room-selected-title">Place ${esc(short(work(selectedId)))}</span><nav aria-label="Jump to a room">${ROOM_BRIEFS.map((r,i)=>`<button class="text-button" type="button" data-action="lab-room-focus" data-room="${r.id}">0${i+1}<span>${esc(r.title)}</span></button>`).join('')}</nav></div>
        <div class="brief-plan">${walls()}<div class="brief-rooms">${ROOM_BRIEFS.map((room,index)=>`<section class="brief-room brief-room-${room.id}" data-museum-room="${room.id}" aria-label="${esc(room.title)}">
          ${roomHeading(room,index,d,esc)}
          <input class="brief-room-name" aria-label="Optional name for room ${index+1}" data-room-name="${index}" maxlength="40" value="${esc(d.roomNames[index])}" placeholder="Your title, optional">
          <div class="room-hanging">${SLOT_IDS.slice(index*2,index*2+2).map((slot,i)=>{const id=d.layout[slot];return `<div class="wall-place"><button type="button" class="drag-art wall-position" data-action="lab-slot" data-lab-slot="${slot}" ${id?`data-lab-work="${esc(id)}" data-work="${esc(id)}"`:''} aria-pressed="${!!id&&selectedId===id}" aria-label="${esc(room.title)}. Position ${i+1}.${id?' '+esc(short(work(id))):' Place the selected painting here.'}">${id?`<span class="art-visual">${image(work(id))}</span>`:'<span class="empty-wall"><span aria-hidden="true">+</span>Place a work</span>'}</button><div class="wall-caption">${id?`<button class="text-button" type="button" data-action="lab-unhang" data-work="${esc(id)}">Put back</button>`:`<span>0${i+1}</span>`}</div></div>`;}).join('')}</div>
        </section>`).join('')}</div><span class="brief-entrance" aria-hidden="true">→</span></div>
        <p class="floor-caption">${count} of 6 hung · Two works per room · Placement is illustrative, with no original scale.</p>
      </div>
    </div>
    <div class="round-actions"><button class="text-button" type="button" data-action="lab-home">Save and come back later</button><button type="button" class="primary-button" data-action="lab-walkthrough" disabled>Walk through your rooms →</button></div>
    <p class="room-next-note">Next: two quick choices about your visit. Your arrangement stays in view.</p>
  </section>`;
}
export function renderRoomWalkthrough({record:d,work,image,esc,top}) {
  const q=ROOM_QUESTIONS[d.roomStep],selected=d.roomResponses[q.id];
  return `<section class="lab-active room-walkthrough" data-lab-kind="curate">
    ${top('Your museum · Walk-through')}<div class="question-head"><p class="eyebrow">${d.roomStep+1} / 2 · ${esc(q.context)}</p><h1 id="question-title">${esc(q.title)}</h1><p>${esc(q.prompt)}</p></div>
    <div id="lab-image-status" class="image-status" role="status" hidden></div>
    <div class="brief-plan room-visit-plan" data-selected="${esc(selected||'')}">${walls()}<div class="brief-rooms">${ROOM_BRIEFS.map((room,index)=>`<button type="button" class="brief-room brief-room-${room.id} visit-room-choice" data-action="lab-room-response" data-question="${q.id}" data-room="${room.id}" aria-label="Choose ${esc(room.title)}" aria-pressed="${selected===room.id}">
      <span class="brief-room-number">Room 0${index+1}</span><span class="visit-room-title">${esc(room.title)}</span><span class="brief-prompt">${esc(room.prompt)}</span>${d.roomNames[index]?`<span class="visit-room-name">${esc(d.roomNames[index])}</span>`:''}
      <span class="visit-room-art">${roomWorkIds(d,room.id).map(id=>image(work(id))).join('')}</span>
      <span class="room-choice-mark">${selected===room.id?'✓ Selected':'Choose this room'}</span>
    </button>`).join('')}</div></div>
    <div class="round-actions"><button class="text-button" type="button" data-action="${d.roomStep?'lab-room-previous':'lab-room-edit'}">${d.roomStep?'← Previous choice':'← Edit the arrangement'}</button><button type="button" class="primary-button" data-action="${d.roomStep?'lab-finish':'lab-room-next'}" disabled>${d.roomStep?'Read this exhibition':'Next choice'} →</button></div>
  </section>`;
}
export function renderRoomRecord({record:d,work,image,esc}) {
  return `<details class="room-record"><summary>Your rooms and their briefs</summary><div class="room-record-grid">${ROOM_BRIEFS.map((room,index)=>`<section><h2>${esc(room.title)}</h2><p>${esc(room.prompt)}</p>${d.roomNames[index]?`<p class="room-record-name">Your title: ${esc(d.roomNames[index])}</p>`:''}<div>${roomWorkIds(d,room.id).map(id=>`<button type="button" data-action="evidence" data-work="${esc(id)}" aria-label="View ${esc(short(work(id)))}">${image(work(id))}</button>`).join('')}</div></section>`).join('')}</div><p>Last five minutes: ${esc(ROOM_BRIEFS.find(r=>r.id===d.roomResponses.lastMinutes).title)}. Introduction for a new visitor: ${esc(ROOM_BRIEFS.find(r=>r.id===d.roomResponses.guest).title)}.</p></details>`;
}
