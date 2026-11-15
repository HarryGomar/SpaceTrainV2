import { AXES, describePoint, matchResults } from './engine.mjs';
import { updateArtworkCorners } from './artwork-corners.mjs';

export function createInteractions({ app, getRound, getDraft, ready, image, esc, workById, saveDraft, sync }) {
  let selected = null, suppressClick = false;
  const bound = new WeakSet();
  const label = id => String.fromCharCode(65 + getRound().works.findIndex(w => w.id === id));
  const locked = () => getRound().kind === 'match' && getDraft().confirmed;
  const placed = id => { const r = getRound(), d = getDraft(); return r.kind === 'spectrum' ? d.positions[id] !== undefined : r.kind === 'grid' ? !!d.points[id] : !!d.guesses[id]; };
  const initial = () => getRound().works.find(w => !placed(w.id))?.id || getRound().works[0].id;
  function cycle(direction=1,unplacedOnly=false,from=selected){const list=getRound().works,index=list.findIndex(w=>w.id===from);for(let n=1;n<=list.length;n++){const w=list[(index+direction*n+list.length*2)%list.length];if(!unplacedOnly||!placed(w.id)){select(w.id);return;}}select(from);}
  function source(w, extra = '') {
    const r = getRound(), d = getDraft();
    return `<button type="button" class="drag-art ${extra}" data-action="select-art" data-drag-work="${esc(w.id)}" data-work="${esc(w.id)}" aria-label="Artwork ${label(w.id)}${r.kind === 'spectrum' ? ', ' + (d.positions[w.id] ?? 'not placed') + ' on the scale. Arrow keys adjust by one; Shift by ten.' : r.kind === 'grid' ? '. Drag onto the map or use arrow keys.' : '. Select, then choose a label.'}" aria-pressed="${selected === w.id}"><span class="art-visual">${image(w)}</span><span class="drag-caption"><span>${label(w.id)}</span><span>${placed(w.id) ? 'Placed' : 'Drag to place'}</span></span></button>`;
  }
  function overview() {
    return `<div class="work-overview" aria-label="Your artwork reference group">${getRound().works.map(w => `<div class="reference-work">${source(w, 'reference-art')}</div>`).join('')}</div>`;
  }
  function focusMarkup() {
    const w = workById(selected);
    return `<div class="focus-meta"><span>Artwork ${label(selected)} <span class="meta-divider">/ ${getRound().works.length}</span></span><button class="text-button" data-action="zoom" data-work="${esc(selected)}" type="button">Look closer ↗</button></div>${source(w, 'focus-art')}`;
  }
  function tray() {
    const r = getRound();
    return `<div class="art-tray ${r.works.length === 2 ? 'two-works' : ''}">${r.works.map(w => `<div class="tray-work">${source(w)}<button class="text-button look-button" type="button" data-action="zoom" data-work="${esc(w.id)}">Look closer</button></div>`).join('')}</div>`;
  }
  function spectrumMarkup() {
    const r = getRound(), target = `<div class="placement-column"><div class="spectrum-target" id="spectrum-target"><button type="button" class="spectrum-hit" data-action="place-spectrum" aria-label="Place the selected artwork on the scale"><span class="spectrum-empty">Drop a painting on the line</span></button><div class="spectrum-rail"><span class="spectrum-line"></span><span class="spectrum-mid"></span><div class="spectrum-placements" id="spectrum-placements"></div></div></div><div class="spectrum-labels"><span>${esc(r.scale?.left || (r.criterion === 'interest' ? 'Less curious' : 'Less preferred'))}</span><span>${esc(r.scale?.right || (r.criterion === 'interest' ? 'More curious' : 'More preferred'))}</span></div><div class="fine-controls" id="fine-controls"></div><p class="input-status" id="input-status" aria-live="polite"></p></div>`;
    return r.works.length >= 3 ? `<div class="placement-layout"><div class="focus-column" id="focus-column">${focusMarkup()}</div>${target}${overview()}</div>` : `<div class="spectrum-input">${tray()}${target}</div>`;
  }
  function gridMarkup() {
    const a = AXES[getRound().axis];
    return `<div class="placement-layout map-layout"><div class="focus-column" id="focus-column">${focusMarkup()}</div><div class="placement-column"><div class="map-surround"><span class="map-axis-top">${esc(a.top)}</span><span class="map-axis-left">${esc(a.left)}</span><div id="response-pad" class="response-pad" tabindex="0" role="group" aria-label="Response map. ${esc(a.xName)} increases left to right; ${esc(a.yName)} increases bottom to top." aria-describedby="input-status"><span class="pad-axis horizontal"></span><span class="pad-axis vertical"></span><span class="pad-prompt">Drop a painting here</span><div id="map-placements"></div></div><span class="map-axis-right">${esc(a.right)}</span><span class="map-axis-bottom">${esc(a.bottom)}</span></div><div class="fine-controls" id="fine-controls"></div><p class="input-status" id="input-status" aria-live="polite"></p></div>${overview()}</div>`;
  }
  function matchMarkup() {
    const r = getRound(), d = getDraft();
    if(d.confirmed)return `<div class="matching-input revealed">${matchReviewMarkup()}</div>`;
    return `<div class="matching-input ${d.confirmed ? 'revealed' : ''}">${d.confirmed ? '' : tray()}<div class="match-targets" id="match-targets">${r.options.map(o => `<div class="match-target" data-drop-option="${esc(o.id)}"><div class="match-painting" data-option-art="${esc(o.id)}"></div><button type="button" class="match-label" data-action="place-match" data-option="${esc(o.id)}">${esc(o.label)}</button></div>`).join('')}</div><div class="unsure-target" data-drop-option="unsure"><button type="button" class="text-button" data-action="place-match" data-option="unsure">Not sure about a work? Leave it here.</button><div class="unsure-works" id="unsure-works"></div></div><p class="input-status" id="input-status" aria-live="polite"></p></div>`;
  }
  function matchReviewMarkup(){
    const r=getRound(),d=getDraft(),results=matchResults(r,d);
    return `<div class="match-review-grid">${r.works.map(work=>{const result=results.find(item=>item.workId===work.id),chosen=r.options.find(option=>option.id===result.chosen)?.label,feedback=result.status==='correct'?'Matched':result.status==='unsure'?'Not sure':chosen?'Your match: '+chosen:'No match recorded';return `<figure class="match-review-work" data-review-work="${esc(work.id)}"><div class="match-review-painting">${source(work,'matched-art')}</div><figcaption><strong class="match-review-answer">${esc(result.label)}</strong><span class="match-review-status">${esc(feedback)}</span></figcaption></figure>`;}).join('')}</div><p class="input-status" id="input-status" aria-live="polite">${results.filter(item=>item.status==='correct').length} of ${results.length} matched. The answers are now revealed.</p>`;
  }
  function select(id) {
    selected = id;
    const focus = app.querySelector('#focus-column');
    if (focus) { focus.innerHTML = focusMarkup(); bindSources(); }
    paintSelection(); sync();
  }
  function paintSelection() {
    updateArtworkCorners(app);
    const focused = document.activeElement?.matches('[data-action=nudge]') ? { dx: document.activeElement.dataset.dx, dy: document.activeElement.dataset.dy } : null;
    for (const el of app.querySelectorAll('.drag-art')) {
      const id = el.dataset.dragWork, r = getRound(), d = getDraft();
      el.setAttribute('aria-pressed', String(id === selected));
      if (r.kind === 'spectrum') el.setAttribute('aria-label', `Artwork ${label(id)}, ${d.positions[id] ?? 'not placed'} on the scale. Arrow keys adjust by one; Shift by ten.`);
      if (r.kind === 'grid') el.setAttribute('aria-label', `Artwork ${label(id)}, ${d.points[id] ? describePoint(r.axis,d.points[id]) + ', coordinates ' + d.points[id].join(', ') : 'not placed'}. Arrow keys adjust by one; Shift by ten.`);
    }
    for (const el of app.querySelectorAll('.reference-work')) { const id = el.querySelector('.drag-art').dataset.work; el.classList.toggle('has-placement', placed(id)); el.querySelector('.drag-art').setAttribute('data-placed',String(placed(id))); }
    for (const el of app.querySelectorAll('.tray-work')) { const id = el.querySelector('.drag-art').dataset.work; el.classList.toggle('has-placement',placed(id)); el.querySelector('.drag-caption span:last-child').textContent = placed(id) ? 'Placed' : 'Drag to place'; }
    const next = app.querySelector('[data-action=next-art]');
    if (next) next.disabled = !ready();
    const previous=app.querySelector('[data-action=previous-art]');if(previous)previous.disabled=!ready();
    const fine = app.querySelector('#fine-controls'), r = getRound(), d = getDraft();
    if (fine && r.kind === 'spectrum') fine.innerHTML = `<span>Artwork ${label(selected)} · ${d.positions[selected] ?? 'Not placed'}</span><button type="button" data-action="nudge" data-dx="-1" aria-label="Move artwork ${label(selected)} one step left" ${placed(selected) ? '' : 'disabled'}>−</button><button type="button" data-action="nudge" data-dx="1" aria-label="Move artwork ${label(selected)} one step right" ${placed(selected) ? '' : 'disabled'}>+</button>`;
    if (fine && r.kind === 'grid') fine.innerHTML = `<span>Artwork ${label(selected)} · ${placed(selected) ? esc(describePoint(r.axis, d.points[selected])) : 'Not placed'}</span>${[['←',-1,0,'left'],['↓',0,-1,'down'],['↑',0,1,'up'],['→',1,0,'right']].map(([text, dx, dy, word]) => `<button type="button" data-action="nudge" data-dx="${dx}" data-dy="${dy}" aria-label="Move artwork ${label(selected)} one step ${word}" ${placed(selected) ? '' : 'disabled'}>${text}</button>`).join('')}`;
    if (focused) [...app.querySelectorAll('[data-action=nudge]')].find(el => el.dataset.dx === focused.dx && el.dataset.dy === focused.dy)?.focus({preventScroll:true});
  }
  function status() {
    const r = getRound(), count = r.works.filter(w => placed(w.id)).length, el = app.querySelector('#input-status');
    if(r.kind!=='match'&&el&&app.querySelector('.journey-question')){el.classList.add('sr-only');el.textContent=`${count} of ${r.works.length} artworks placed`;return;}
    if (r.kind !== 'match' && el) el.textContent = `${count} of ${r.works.length} placed. ${count === r.works.length ? 'Adjust any work, then confirm.' : r.works.length === 2 ? 'Drag a painting, or select it and tap the line.' : 'Drag the painting or tap the ' + (r.kind === 'grid' ? 'map' : 'line') + '.'}${r.kind === 'grid' && app.querySelector('.map-location') ? ' Nearby images fan out; dots mark positions.' : ''}`;
  }
  function setPosition(id, value) {
    const d = getDraft(); selected = id;
    d.positions[id] = Math.max(0, Math.min(100, Math.round(value))); d.confirmed = false;
    saveDraft(); paintSpectrum(); sync();
  }
  function spectrumValue(x) { const rect = app.querySelector('.spectrum-rail').getBoundingClientRect(); return (x - rect.left) / rect.width * 100; }
  function paintSpectrum() {
    const r = getRound(), d = getDraft(), holder = app.querySelector('#spectrum-placements');
    if (!holder) return;
    const rail = app.querySelector('.spectrum-rail'), lanes = [];
    const positions = r.works.filter(w => placed(w.id)).sort((a, b) => d.positions[a.id] - d.positions[b.id]);
    holder.innerHTML = positions.map(w => {
      const x = d.positions[w.id] / 100 * rail.clientWidth;
      let lane = lanes.findIndex(values => values.every(v => Math.abs(v - x) >= 60));
      if (lane < 0) { lane = lanes.length; lanes.push([]); } lanes[lane].push(x);
      return `<div class="spectrum-token" style="left:${d.positions[w.id]}%;bottom:${22 + lane * 65}px"><span class="spectrum-stem" style="height:${20 + lane * 65}px"></span>${source(w, 'placed-art')}<span class="position-value">${d.positions[w.id]}</span></div>`;
    }).join('');
    const compact=app.querySelector('.journey-question')&&window.matchMedia('(max-width:600px)').matches;
    app.querySelector('#spectrum-target').style.height = Math.max(compact?110:r.works.length >= 3 ? 215 : 145, lanes.length * 65 + 35) + 'px';
    app.querySelector('.spectrum-empty').hidden = positions.length > 0;
    paintSelection(); status(); bindSources();
  }
  function setPoint(id, point, commit = true) {
    selected = id; const d = getDraft(); d.points[id] = point.map(v => Math.max(0, Math.min(100, Math.round(v)))); d.confirmed = false;
    paintGrid(); if (commit) { saveDraft(); sync(); }
  }
  function gridPoint(x, y) { const b = app.querySelector('#response-pad').getBoundingClientRect(); return [(x - b.left - b.width * .05) / (b.width * .9) * 100, (b.bottom - b.height * .05 - y) / (b.height * .9) * 100]; }
  function paintGrid() {
    const r = getRound(), d = getDraft();
    const ids = r.works.filter(w => placed(w.id));
    const parent = ids.map((_,i) => i), root = i => parent[i] === i ? i : root(parent[i]);
    for (let i=0;i<ids.length;i++) for (let j=i+1;j<ids.length;j++) if (Math.hypot(d.points[ids[i].id][0]-d.points[ids[j].id][0], d.points[ids[i].id][1]-d.points[ids[j].id][1]) < 18) parent[root(j)] = root(i);
    const groups = new Map(); ids.forEach((w,i) => { const key=root(i); groups.set(key,[...(groups.get(key) || []),w.id]); });
    const offsets = new Map();
    const scale = app.querySelector('#response-pad').clientWidth * .009;
    for (const group of groups.values()) {
      const arrangement = group.length === 4 ? [[-26,-26],[26,-26],[-26,26],[26,26]] : group.length === 3 ? [[-26,-20],[26,-20],[0,30]] : group.length === 2 ? [[-25,0],[25,0]] : [[0,0]];
      const center = [0,1].map(dim => group.reduce((sum,id) => sum + d.points[id][dim],0) / group.length);
      group.forEach((id,i) => offsets.set(id,[arrangement[i][0] + (center[0] - d.points[id][0]) * scale, arrangement[i][1] + (d.points[id][1] - center[1]) * scale]));
    }
    app.querySelector('#map-placements').innerHTML = ids.map(w => {
      const p = d.points[w.id], [dx,dy] = offsets.get(w.id);
      return `<div class="map-token" style="left:${5 + p[0] * .9}%;top:${95 - p[1] * .9}%;--map-x:${dx}px;--map-y:${dy}px">${source(w, 'placed-art')}<span class="map-letter">${label(w.id)}</span>${dx || dy ? '<span class="map-location" aria-hidden="true"></span>' : ''}</div>`;
    }).join('');
    app.querySelector('.pad-prompt').hidden = ids.length > 0;
    paintSelection(); status(); bindSources();
  }
  function setMatch(id, option) {
    if (locked()) return;
    const d = getDraft(), old = d.guesses[id];
    const displaced = Object.keys(d.guesses).find(key => key !== id && d.guesses[key] === option && option !== 'unsure');
    if (displaced) { if (old) d.guesses[displaced] = old; else delete d.guesses[displaced]; }
    d.guesses[id] = option; selected = getRound().works.find(w=>d.guesses[w.id]===undefined)?.id||id; d.confirmed = false; saveDraft(); paintMatches(); sync();
  }
  function paintMatches() {
    const r = getRound(), d = getDraft(), results = matchResults(r, d);
    if(d.confirmed){
      const host=app.querySelector('.matching-input');host.classList.add('revealed');if(!host.querySelector('.match-review-grid'))host.innerHTML=matchReviewMarkup();
      paintSelection();bindSources();return;
    }
    const painting = id => {
      const result = results.find(item => item.workId === id);
      return `${source(workById(id), 'matched-art')}${d.confirmed ? `<p class="match-feedback ${result.status}">${result.status === 'correct' ? 'Matched' : (result.status === 'unsure' ? 'Answer: ' : 'Correct: ') + esc(result.label)}</p>` : ''}`;
    };
    for (const target of app.querySelectorAll('[data-option-art]')) {
      const id = Object.keys(d.guesses).find(id => d.guesses[id] === target.dataset.optionArt);
      target.innerHTML = id ? painting(id) : `<span class="drop-placeholder">${d.confirmed ? 'Unused label' : 'Drop here'}</span>`;
    }
    for (const option of r.options) app.querySelector(`[data-action="place-match"][data-option="${option.id}"]`).textContent = (d.confirmed ? Object.values(d.guesses).includes(option.id) ? 'Your match: ' : 'Unused: ' : '') + option.label;
    app.querySelector('#unsure-works').innerHTML = Object.keys(d.guesses).filter(id => d.guesses[id] === 'unsure').map(id => `<div>${painting(id)}</div>`).join('');
    for (const el of app.querySelectorAll('.tray-work')) el.classList.toggle('has-placement', placed(el.querySelector('.drag-art').dataset.work));
    paintSelection();
    app.querySelector('#input-status').textContent = d.confirmed ? `${results.filter(item => item.status === 'correct').length} of ${results.length} matched. The answers are now revealed.` : `${Object.keys(d.guesses).length} of ${r.works.length} placed. Check the matches when ready.`;
    bindSources();
  }
  function dropAt(id, x, y) {
    const r = getRound();
    if (r.kind === 'spectrum') { const b = app.querySelector('#spectrum-target').getBoundingClientRect(); if (x >= b.left - 25 && x <= b.right + 25 && y >= b.top - 20 && y <= b.bottom + 30) { setPosition(id, spectrumValue(x)); return true; } }
    if (r.kind === 'match') for (const target of app.querySelectorAll('[data-drop-option]')) { const b = target.getBoundingClientRect(); if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) { setMatch(id, target.dataset.dropOption); return true; } }
    if (r.kind === 'grid') { const b = app.querySelector('#response-pad').getBoundingClientRect(); if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) { setPoint(id, gridPoint(x, y)); return true; } }
    return false;
  }
  function adjust(id, key, step) {
    const r = getRound(), d = getDraft();
    if (r.kind === 'spectrum') setPosition(id, key === 'Home' ? 0 : key === 'End' ? 100 : (d.positions[id] ?? 50) + (key === 'ArrowLeft' ? -step : step));
    else if (r.kind === 'grid') { const p = [...(d.points[id] || [50, 50])]; if (key === 'ArrowLeft') p[0] -= step; if (key === 'ArrowRight') p[0] += step; if (key === 'ArrowUp') p[1] += step; if (key === 'ArrowDown') p[1] -= step; setPoint(id, p); }
  }
  function bindSources() {
    for (const handle of app.querySelectorAll('[data-drag-work]')) {
      if (bound.has(handle)) continue; bound.add(handle);
      let drag = null, frame;
      const clear = () => { if (frame) cancelAnimationFrame(frame); drag?.ghost?.remove(); handle.classList.remove('is-dragging'); for (const t of app.querySelectorAll('.drag-over')) t.classList.remove('drag-over'); drag = null; };
      const hover = () => {
        if (!drag?.ghost) return;
        const delta = drag.y < 45 ? -8 : drag.y > innerHeight - 45 ? 8 : 0; if (delta) window.scrollBy(0, delta);
        for (const target of app.querySelectorAll('#spectrum-target, #response-pad, [data-drop-option]')) { const b = target.getBoundingClientRect(); target.classList.toggle('drag-over', drag.x >= b.left && drag.x <= b.right && drag.y >= b.top && drag.y <= b.bottom); }
        frame = requestAnimationFrame(hover);
      };
      handle.addEventListener('pointerdown', e => {
        if (!ready() || locked() || e.button !== 0) return;
        const b = handle.getBoundingClientRect(); drag = { startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, width: Math.min(160, b.width), ghost: null };
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove', e => {
        if (!drag) return; drag.x = e.clientX; drag.y = e.clientY;
        if (!drag.ghost && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 7) {
          selected = handle.dataset.dragWork;
          drag.ghost = document.createElement('div'); drag.ghost.className = 'art-drag-ghost'; drag.ghost.setAttribute('aria-hidden', 'true'); drag.ghost.innerHTML = image(workById(selected)); drag.ghost.style.width = drag.width + 'px'; document.body.append(drag.ghost); handle.classList.add('is-dragging'); hover();
        }
        if (drag.ghost) { drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; }
      });
      handle.addEventListener('pointerup', e => {
        if (!drag) return; const moved = !!drag.ghost; clear();
        if (moved) {
          suppressClick = true; setTimeout(() => { suppressClick = false; }, 120);
          const id = handle.dataset.dragWork,hadPlacement=placed(id);
          if (dropAt(id, e.clientX, e.clientY)) { if (getRound().kind !== 'match') {if(!hadPlacement)cycle(1,true,id);else select(id);} }
          else app.querySelector('#input-status').textContent = 'Drop on the line, map or a label to place the work.';
        }
      });
      handle.addEventListener('pointercancel', clear);
      handle.addEventListener('keydown', e => {
        const r = getRound(), keys = r.kind === 'spectrum' ? ['ArrowLeft', 'ArrowRight', 'Home', 'End'] : ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (!ready() || locked() || !['spectrum', 'grid'].includes(r.kind) || !keys.includes(e.key)) return;
        e.preventDefault(); const id = handle.dataset.dragWork;
        if (selected !== id) select(id);
        adjust(id, e.key, e.shiftKey ? 10 : 1);
        (app.querySelector('.focus-art') || app.querySelector(`.tray-work [data-work="${id}"]`))?.focus({ preventScroll: true });
      });
    }
  }
  function attachPad() {
    const pad = app.querySelector('#response-pad'); let dragging = false,fresh=false,padWork=null;
    pad.addEventListener('pointerdown', e => { if (!ready() || e.button !== 0 || e.target.closest('[data-drag-work]')) return; fresh=!placed(selected);padWork=selected;dragging = true; pad.setPointerCapture(e.pointerId); setPoint(selected, gridPoint(e.clientX, e.clientY), false); });
    pad.addEventListener('pointermove', e => { if (dragging) setPoint(selected, gridPoint(e.clientX, e.clientY), false); });
    const end = () => { if (dragging) { dragging = false; saveDraft(); sync();if(fresh)cycle(1,true,padWork); } };
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
    pad.addEventListener('keydown', e => { if (e.target !== pad || !ready() || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key)) return; e.preventDefault(); if (['Enter',' '].includes(e.key)) setPoint(selected, getDraft().points[selected] || [50,50]); else adjust(selected, e.key, e.shiftKey ? 10 : 1); });
  }
  let resizeFrame;
  app.addEventListener('keydown',event=>{if(!app.querySelector('.session,.deep-question')||!['[',']'].includes(event.key)||event.target.matches('input,textarea')||!ready()||!['spectrum','grid','match'].includes(getRound()?.kind))return;event.preventDefault();cycle(event.key==='['?-1:1);});
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (app.querySelector('#response-pad') && getRound()?.kind === 'grid') { paintGrid(); sync(); }
      if (app.querySelector('#spectrum-placements') && getRound()?.kind === 'spectrum') { paintSpectrum(); sync(); }
    });
  });
  return {
    markup() { selected = initial(); return getRound().kind === 'spectrum' ? spectrumMarkup() : getRound().kind === 'grid' ? gridMarkup() : matchMarkup(); },
    attach() { if (getRound().kind === 'spectrum') paintSpectrum(); if (getRound().kind === 'grid') { paintGrid(); attachPad(); } if (getRound().kind === 'match') paintMatches(); bindSources(); },
    refresh() { paintSelection(); },
    click(action, control, event) {
      if (!['select-art','next-art','previous-art','place-spectrum','place-match','nudge'].includes(action)) return false;
      if (!ready() || locked() || suppressClick) return true;
      if (action === 'select-art') {
        const r = getRound(), d = getDraft();
        // An unplaced work can join an existing position. The reference strip always selects.
        if (control.classList.contains('placed-art') && selected && selected !== control.dataset.work && !placed(selected)) {
          const placingId=selected;
          if (r.kind === 'grid') setPoint(selected, d.points[control.dataset.work]);
          else if (r.kind === 'spectrum') setPosition(selected, d.positions[control.dataset.work]);
          else select(control.dataset.work);
          if(r.kind==='grid'||r.kind==='spectrum')cycle(1,true,placingId);
        } else select(control.dataset.work);
      }
      else if (action === 'next-art') cycle(1);
      else if (action === 'previous-art') cycle(-1);
      else if (action === 'nudge') {
        const d = getDraft();
        if (getRound().kind === 'spectrum' && placed(selected)) setPosition(selected, d.positions[selected] + Number(control.dataset.dx));
        if (getRound().kind === 'grid' && placed(selected)) setPoint(selected, [d.points[selected][0] + Number(control.dataset.dx), d.points[selected][1] + Number(control.dataset.dy)]);
      }
      else if (selected && action === 'place-spectrum') {const id=selected,fresh=!placed(id);setPosition(id,event.detail?spectrumValue(event.clientX):50);if(fresh)cycle(1,true,id);}
      else if (selected && action === 'place-match') setMatch(selected, control.dataset.option);
      else app.querySelector('#input-status').textContent = 'Select a painting first, then place it here.';
      return true;
    }
  };
}
