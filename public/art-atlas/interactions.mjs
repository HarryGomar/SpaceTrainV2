import {isContinuousPreferenceRound} from './continuous-preference.mjs';
import { AXES, describePoint, matchResults } from './engine.mjs';
import { updateArtworkCorners } from './artwork-corners.mjs';
import {isOverallAppealRound} from './appeal-scale.mjs';
import {isComparisonPreferenceRound} from './comparison-protocol.mjs';

export function createInteractions({ app, getRound, getDraft, ready, image, esc, workById, saveDraft, sync }) {
  let selected = null, suppressClick = false, mobileGesture = null, mobileMapStage='painting';
  const bound = new WeakSet();
  const label = id => String.fromCharCode(65 + getRound().works.findIndex(w => w.id === id));
  const locked = () => getRound().kind === 'match' && getDraft().confirmed;
  const placed = id => { const r = getRound(), d = getDraft(); return r.kind === 'spectrum' ? d.positions[id] !== undefined : r.kind === 'grid' ? !!d.points[id] : !!d.guesses[id]; };
  const initial = () => getRound().works.find(w => !placed(w.id))?.id || getRound().works[0].id;
  const mobileSpectrum=()=>getRound()?.kind==='spectrum'&&getRound().works.length>=2&&!!app.querySelector('.journey-question')&&window.matchMedia('(max-width:700px)').matches;
  const mobileMap=()=>getRound()?.kind==='grid'&&!!app.querySelector('.journey-question')&&window.matchMedia('(max-width:700px)').matches;
  const ordinal=()=>isComparisonPreferenceRound(getRound())&&!isContinuousPreferenceRound(getRound());
  function spectrumDescription(id){
    const r=getRound(),d=getDraft(),value=d.positions[id];
    if(!ordinal())return `${value??'not placed'} on the scale. Arrow keys adjust by one; Shift by ten.`;
    if(value===undefined)return 'not placed. Move right for more preferred, left for less. Arrow keys fine-tune the position.';
    const values=r.works.filter(work=>d.positions[work.id]!==undefined).map(work=>d.positions[work.id]),rank=1+values.filter(other=>other>value).length,tied=values.filter(other=>other===value).length>1;
    return `${tied?'Joint preference':'Preference'} order ${rank} of ${values.length} placed paintings. Arrow keys fine-tune the position.`;
  }
  function cycle(direction=1,unplacedOnly=false,from=selected){const list=getRound().works,index=list.findIndex(w=>w.id===from);for(let n=1;n<=list.length;n++){const w=list[(index+direction*n+list.length*2)%list.length];if(!unplacedOnly||!placed(w.id)){select(w.id);return;}}if(selected!==from)select(from);else{paintSelection();sync();}}
  function source(w, extra = '') {
    const r = getRound(), d = getDraft();
    return `<button type="button" class="drag-art ${extra}" data-action="select-art" data-drag-work="${esc(w.id)}" data-work="${esc(w.id)}" aria-label="Artwork ${label(w.id)}${r.kind === 'spectrum' ? ', '+esc(spectrumDescription(w.id)) : r.kind === 'grid' ? '. Drag onto the map or use arrow keys.' : '. Select, then choose a label.'}" aria-pressed="${selected === w.id}"><span class="art-visual">${image(w)}</span><span class="drag-caption"><span>${label(w.id)}</span><span>${placed(w.id) ? 'Placed' : 'Drag to place'}</span></span>${r.kind==='spectrum'&&!ordinal()&&extra.includes('reference-art')?`<span class="reference-rating" aria-hidden="true">${d.positions[w.id]??'—'}</span>`:''}</button>`;
  }
  function overview() {
    return `<div class="work-overview" aria-label="Your artwork reference group">${getRound().works.map(w => `<div class="reference-work">${source(w, 'reference-art')}</div>`).join('')}</div>`;
  }
  function focusMarkup() {
    const w = workById(selected);
    return `<div class="focus-meta"><span class="focus-index-desktop">Artwork ${label(selected)} <span class="meta-divider">/ ${getRound().works.length}</span></span><span class="focus-index-mobile">Painting ${getRound().works.findIndex(work=>work.id===selected)+1} of ${getRound().works.length}</span><button class="text-button focus-zoom" data-action="zoom" data-work="${esc(selected)}" type="button" aria-label="View painting full screen"><span>Look closer</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/></svg></button></div>${source(w, 'focus-art')}`;
  }
  function tray() {
    const r = getRound();
    return `<div class="art-tray ${r.works.length === 2 ? 'two-works' : ''}">${r.works.map(w => `<div class="tray-work">${source(w)}<button class="text-button look-button" type="button" data-action="zoom" data-work="${esc(w.id)}">Look closer</button></div>`).join('')}</div>`;
  }
  function spectrumMarkup() {
    const r = getRound(), overall=isOverallAppealRound(r), target = `<div class="placement-column"><div class="spectrum-target${overall?' overall-appeal-target':''}" id="spectrum-target"><button type="button" class="spectrum-hit" data-action="place-spectrum" aria-label="Place the selected artwork on the scale${overall?'. Every point from 0 to 100 is available. Neutral is 50.':''}"><span class="spectrum-empty">Drop a painting on the line</span></button><div class="spectrum-rail"><span class="spectrum-line"></span><span class="spectrum-mid"></span>${overall?'<span class="appeal-quarter" style="left:25%"></span><span class="appeal-quarter" style="left:75%"></span>':''}<div class="spectrum-placements" id="spectrum-placements"></div></div></div><div class="spectrum-labels${overall?' overall-appeal-labels':''}"><span>${esc(r.scale?.left || (r.criterion === 'interest' ? 'Less curious' : 'Less preferred'))}</span>${overall?`<span class="appeal-neutral">${esc(r.scale.middle)}</span>`:''}<span>${esc(r.scale?.right || (r.criterion === 'interest' ? 'More curious' : 'More preferred'))}</span></div><div class="fine-controls" id="fine-controls"></div><p class="input-status" id="input-status" aria-live="polite"></p></div>`;
    const mobile=`<div class="mobile-spectrum-controls"><input id="mobile-spectrum-range" type="range" min="0" max="100" step="1" value="50" aria-label="Rate the selected painting" aria-describedby="spectrum-scale-labels"></div>`;
    const shared=target.replace('id="spectrum-target">','id="spectrum-target">'+mobile).replace('class="spectrum-labels','id="spectrum-scale-labels" class="spectrum-labels');
    return r.works.length >= 3 ? `<div class="placement-layout spectrum-layout"><div class="focus-column" id="focus-column">${focusMarkup()}</div>${shared}${overview()}</div>` : `<div class="spectrum-input">${tray()}${shared}</div>`;
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
    return `<div class="match-review-grid">${r.works.map(work=>{const result=results.find(item=>item.workId===work.id),chosen=r.options.find(option=>option.id===result.chosen)?.label,correct=result.status==='correct',unsure=result.status==='unsure',feedback=correct?'Correct':unsure?'Not sure':'Incorrect',path=correct?'M5 9l3 3 5-6':unsure?'M5 9h8':'M6 6l6 6M12 6l-6 6';return `<figure class="match-review-work" data-review-work="${esc(work.id)}" data-match-status="${result.status}"><div class="match-review-painting">${source(work,'matched-art')}</div><figcaption><span class="match-review-status"><svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7.25"/><path d="${path}"/></svg>${feedback}</span><strong class="match-review-answer">${correct?'':'<span class="match-answer-prefix">Answer: </span>'}${esc(result.label)}</strong>${!correct&&!unsure&&chosen?`<span class="match-review-guess">You chose ${esc(chosen)}</span>`:''}</figcaption></figure>`;}).join('')}</div><p class="input-status" id="input-status" aria-live="polite">${results.filter(item=>item.status==='correct').length} correct${results.some(item=>item.status==='unsure')?' · '+results.filter(item=>item.status==='unsure').length+' not sure':''} out of ${results.length}. Correct answers are shown under each painting.</p>`;
  }
  function select(id) {
    mobileGesture=null;
    selected = id;
    const focus = app.querySelector('#focus-column');
    if (focus) { focus.innerHTML = focusMarkup(); bindSources(); }
    paintSelection(); sync();
  }
  function paintSelection() {
    updateArtworkCorners(app);
    const focused = document.activeElement?.matches('[data-action=nudge]')&&!document.activeElement.closest('.mobile-spectrum-controls') ? { dx: document.activeElement.dataset.dx, dy: document.activeElement.dataset.dy } : null;
    for (const el of app.querySelectorAll('.drag-art')) {
      const id = el.dataset.dragWork, r = getRound(), d = getDraft();
      el.setAttribute('aria-pressed', String(id === selected));
      if (r.kind === 'spectrum') el.setAttribute('aria-label', `Artwork ${label(id)}, ${spectrumDescription(id)}`);
      if (r.kind === 'grid') el.setAttribute('aria-label', `Artwork ${label(id)}, ${d.points[id] ? describePoint(r.axis,d.points[id]) + ', coordinates ' + d.points[id].join(', ') : 'not placed'}. Arrow keys adjust by one; Shift by ten.`);
    }
    for (const el of app.querySelectorAll('.reference-work')) { const art=el.querySelector('.drag-art'),id=art.dataset.work; el.classList.toggle('has-placement', placed(id)); art.setAttribute('data-placed',String(placed(id)));if(mobileSpectrum()&&placed(id)){art.setAttribute('aria-hidden','true');art.tabIndex=-1;}else{art.removeAttribute('aria-hidden');art.removeAttribute('tabindex');}const rating=el.querySelector('.reference-rating');if(rating)rating.textContent=getDraft().positions[id]??'—'; }
    for (const el of app.querySelectorAll('.tray-work')) { const id = el.querySelector('.drag-art').dataset.work; el.classList.toggle('has-placement',placed(id)); el.querySelector('.drag-caption span:last-child').textContent = placed(id) ? 'Placed' : 'Drag to place'; }
    const next = app.querySelector('[data-action=next-art]');
    if (next) next.disabled = !ready();
    const previous=app.querySelector('[data-action=previous-art]');if(previous)previous.disabled=!ready();
    const fine = app.querySelector('#fine-controls'), r = getRound(), d = getDraft();
    if (fine && r.kind === 'spectrum') fine.innerHTML = `<span>${ordinal()?`Painting ${label(selected)}`:mobileSpectrum()?`Painting ${r.works.findIndex(work=>work.id===selected)+1} · ${d.positions[selected]===undefined?'Not rated':d.positions[selected]+' / 100'}`:`Artwork ${label(selected)} · ${d.positions[selected] ?? 'Not placed'}`}</span><button type="button" data-action="nudge" data-dx="-1" aria-label="Move artwork ${label(selected)} one step left" ${placed(selected) ? '' : 'disabled'}>−</button><button type="button" data-action="nudge" data-dx="1" aria-label="Move artwork ${label(selected)} one step right" ${placed(selected) ? '' : 'disabled'}>+</button>`;
    if (fine && r.kind === 'grid') fine.innerHTML = `<span>Artwork ${label(selected)} · ${placed(selected) ? esc(describePoint(r.axis, d.points[selected])) : 'Not placed'}</span>${[['←',-1,0,'left'],['↓',0,-1,'down'],['↑',0,1,'up'],['→',1,0,'right']].map(([text, dx, dy, word]) => `<button type="button" data-action="nudge" data-dx="${dx}" data-dy="${dy}" aria-label="Move artwork ${label(selected)} one step ${word}" ${placed(selected) ? '' : 'disabled'}>${text}</button>`).join('')}`;
    if(fine&&mobileSpectrum()){
      const value=d.positions[selected];fine.classList.add('mobile-precision');fine.innerHTML=ordinal()?'':`<span>${value===undefined?'Not rated':`${value}<small> / 100</small>`}</span>`;
    }else fine?.classList.remove('mobile-precision');
    syncMobileMap();
    const range=app.querySelector('#mobile-spectrum-range');
    if(range){const value=d.positions[selected],hasValue=value!==undefined;range.disabled=!ready();range.setAttribute('aria-label',`${ordinal()?'Place':'Rate'} painting ${r.works.findIndex(work=>work.id===selected)+1} of ${r.works.length}. Arrow keys adjust by one; Enter moves to the next ${ordinal()?'unplaced':'unrated'} painting.`);range.setAttribute('aria-valuetext',ordinal()?spectrumDescription(selected):hasValue?`${value} of 100`:'Not rated');if(!mobileGesture)range.value=String(hasValue?value:50);const output=app.querySelector('#mobile-spectrum-value');if(output)output.textContent=ordinal()?'':hasValue?`${value} / 100`:'Not rated';const controls=range.closest('.mobile-spectrum-controls');controls.dataset.rated=String(hasValue);for(const button of controls.querySelectorAll('[data-action=nudge]'))button.disabled=!ready()||!hasValue||Number(button.dataset.dx)<0&&value===0||Number(button.dataset.dx)>0&&value===100;}
    if (focused) [...app.querySelectorAll('[data-action=nudge]')].find(el => el.dataset.dx === focused.dx && el.dataset.dy === focused.dy)?.focus({preventScroll:true});
  }
  function syncMobileMap(){
    const layout=app.querySelector('.map-layout');if(!layout)return;
    const mobile=mobileMap();layout.classList.toggle('mobile-map-mode',mobile);layout.dataset.mapStage=mobileMapStage;
    const question=layout.closest('.journey-question');if(question){if(mobile)question.dataset.mobileMapStage=mobileMapStage;else delete question.dataset.mobileMapStage;}
    let toolbar=layout.querySelector('.mobile-map-toolbar');if(!toolbar){toolbar=document.createElement('div');toolbar.className='mobile-map-toolbar';layout.insertBefore(toolbar,layout.querySelector('.placement-column'));}
    if(mobile&&toolbar.dataset.work!==selected){toolbar.dataset.work=selected;toolbar.innerHTML=`<button type="button" data-action="zoom" data-work="${esc(selected)}" aria-label="View painting full screen"><span class="mobile-map-preview">${image(workById(selected))}</span><span>Painting ${getRound().works.findIndex(work=>work.id===selected)+1} of ${getRound().works.length}</span><span aria-hidden="true">↗</span></button>`;for(const img of toolbar.querySelectorAll('img'))img.loading='eager';}
    const prompt=layout.querySelector('.pad-prompt');if(prompt&&mobile)prompt.textContent='Tap or drag to place';
  }
  function status() {
    const r = getRound(), count = r.works.filter(w => placed(w.id)).length, el = app.querySelector('#input-status');
    if(r.kind!=='match'&&el&&app.querySelector('.journey-question')){el.classList.add('sr-only');el.textContent=`${count} of ${r.works.length} artworks placed`;return;}
    if (r.kind !== 'match' && el) el.textContent = `${count} of ${r.works.length} placed. ${count === r.works.length ? 'Adjust any work, then confirm.' : r.works.length === 2 ? 'Drag a painting, or select it and tap the line.' : 'Drag the painting or tap the ' + (r.kind === 'grid' ? 'map' : 'line') + '.'}${r.kind === 'grid' && app.querySelector('.map-location') ? ' Nearby images fan out; dots mark positions.' : ''}`;
  }
  function setPosition(id, value,commit=true) {
    const d = getDraft(); selected = id;
    d.positions[id] = Math.max(0, Math.min(100, Math.round(value))); d.confirmed = false;
    if(commit)saveDraft(); paintSpectrum(); sync();
  }
  function spectrumValue(x) { const rect = app.querySelector('.spectrum-rail').getBoundingClientRect(); return (x - rect.left) / rect.width * 100; }
  function paintSpectrum() {
    const r = getRound(), d = getDraft(), holder = app.querySelector('#spectrum-placements');
    if (!holder) return;
    const mobile=mobileSpectrum(),layout=app.querySelector('.spectrum-layout,.spectrum-input');layout?.classList.toggle('mobile-spectrum-mode',mobile);layout?.classList.toggle('all-placed',r.works.every(w=>placed(w.id)));app.querySelector('.work-overview')?.setAttribute('aria-label',mobile?'Paintings still to place':'Your artwork reference group');
    const compactPhone=mobile&&window.innerHeight<740,rail=app.querySelector('.spectrum-rail'),lanes=[],laneStep=mobile?(compactPhone?34:40):65,tokenBase=mobile?12:22;
    const positions = r.works.filter(w => placed(w.id)).sort((a, b) => d.positions[a.id] - d.positions[b.id]);
    holder.innerHTML = positions.map(w => {
      const x = d.positions[w.id] / 100 * rail.clientWidth;
      let lane = lanes.findIndex(values => values.every(v => Math.abs(v - x) >= (mobile?44:60)));
      if (lane < 0) { lane = lanes.length; lanes.push([]); } lanes[lane].push(x);
      return `<div class="spectrum-token" style="left:${d.positions[w.id]}%;bottom:${tokenBase + lane * laneStep}px"><span class="spectrum-stem" style="height:${tokenBase - 2 + lane * laneStep}px"></span>${source(w, 'placed-art')}${ordinal()?'':`<span class="position-value">${d.positions[w.id]}</span>`}</div>`;
    }).join('');
    const compact=app.querySelector('.journey-question')&&window.matchMedia('(max-width:600px)').matches;
    const height=mobile?Math.max(compactPhone?100:120,lanes.length*laneStep+26):Math.max(compact?110:r.works.length>=3?215:145,lanes.length*65+35);
    app.querySelector('#spectrum-target').style.height=height+'px';layout?.style.setProperty('--spectrum-height',height+'px');
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
    if (displaced) { if (old) d.guesses[displaced] = old; else delete d.guesses[displaced];if(d.certainty)delete d.certainty[displaced]; }
    if(isRecognitionWithCertainty(getRound())){d.certainty||={};delete d.certainty[id];if(option==='unsure')d.certainty[id]='unsure';}
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
          if (dropAt(id, e.clientX, e.clientY)) { if (getRound().kind !== 'match') {if(!hadPlacement&&!mobileMap())cycle(1,true,id);else select(id);} }
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
  function bindMobileSpectrum(){
    const range=app.querySelector('#mobile-spectrum-range');if(!range||bound.has(range))return;bound.add(range);
    const current=()=>mobileGesture&&mobileGesture.roundId===getRound()?.id&&getRound().works.some(work=>work.id===mobileGesture.workId);
    const begin=mode=>{mobileGesture={roundId:getRound().id,workId:selected,fresh:!placed(selected),mode,changed:false};};
    const finish=(advance=false)=>{
      if(!current()||!ready()||!mobileSpectrum()){mobileGesture=null;return;}
      const gesture=mobileGesture,value=Number(range.value);mobileGesture=null;
      if(!gesture.changed)setPosition(gesture.workId,value);else if(gesture.mode==='pointer')saveDraft();
      if(advance&&gesture.fresh)cycle(1,true,gesture.workId);else paintSelection();
    };
    range.addEventListener('pointerdown',event=>{if(!ready()||!mobileSpectrum()||event.button!==0||event.isPrimary===false)return;begin('pointer');});
    range.addEventListener('input',()=>{if(!ready()||!mobileSpectrum())return;if(!mobileGesture)begin('keyboard');if(!current()){mobileGesture=null;return;}mobileGesture.changed=true;setPosition(mobileGesture.workId,Number(range.value),mobileGesture.mode!=='pointer');});
    range.addEventListener('change',()=>{if(mobileGesture?.mode==='pointer')finish(true);});
    range.addEventListener('pointerup',()=>{if(mobileGesture?.mode==='pointer')finish(true);});
    range.addEventListener('pointercancel',()=>{if(current()&&mobileGesture.changed&&mobileGesture.mode==='pointer')saveDraft();mobileGesture=null;paintSelection();});
    range.addEventListener('blur',()=>{if(mobileGesture?.mode==='keyboard')finish(false);});
    range.addEventListener('keydown',event=>{if(!ready()||!mobileSpectrum())return;if(event.shiftKey&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();if(!mobileGesture)begin('keyboard');mobileGesture.changed=true;const value=Math.max(0,Math.min(100,(getDraft().positions[selected]??50)+(event.key==='ArrowLeft'?-10:10)));range.value=String(value);setPosition(selected,value);}else if(event.key==='Enter'){event.preventDefault();if(!mobileGesture)begin('keyboard');finish(true);}});
  }
  function attachPad() {
    const pad = app.querySelector('#response-pad'); let dragging = false,fresh=false,padWork=null;
    pad.addEventListener('pointerdown', e => { if (!ready() || e.button !== 0 || e.target.closest('[data-drag-work]')) return; fresh=!placed(selected);padWork=selected;dragging = true; pad.setPointerCapture(e.pointerId); setPoint(selected, gridPoint(e.clientX, e.clientY), false); });
    pad.addEventListener('pointermove', e => { if (dragging) setPoint(selected, gridPoint(e.clientX, e.clientY), false); });
    const end = () => { if (dragging) { dragging = false; saveDraft(); sync();if(fresh&&!mobileMap())cycle(1,true,padWork); } };
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
    markup() { selected = initial(); mobileMapStage=getRound().kind==='grid'&&getRound().works.every(work=>placed(work.id))?'review':'painting'; return getRound().kind === 'spectrum' ? spectrumMarkup() : getRound().kind === 'grid' ? gridMarkup() : matchMarkup(); },
    attach() { if (getRound().kind === 'spectrum') {paintSpectrum();bindMobileSpectrum();} if (getRound().kind === 'grid') { paintGrid(); attachPad(); } if (getRound().kind === 'match') paintMatches(); bindSources(); },
    refresh() { paintSelection(); },
    mobileMapAction(){if(!mobileMap()||mobileMapStage==='review')return null;return {label:mobileMapStage==='painting'?'Place on map':getRound().works.some(work=>work.id!==selected&&!placed(work.id))?'Next painting':'Review map',disabled:mobileMapStage==='map'&&!placed(selected)};},
    advanceMobileMap(){if(!mobileMap()||mobileMapStage==='review')return false;if(!ready())return true;if(mobileMapStage==='painting')mobileMapStage='map';else if(placed(selected)){const next=getRound().works.find(work=>!placed(work.id));if(next){mobileMapStage='painting';select(next.id);}else mobileMapStage='review';}paintGrid();sync();return true;},
    click(action, control, event) {
      if (!['select-art','next-art','previous-art','place-spectrum','place-match','match-certainty','nudge'].includes(action)) return false;
      if (!ready() || locked() || suppressClick) return true;
      if(action==='match-certainty'){
        const d=getDraft(),id=control.dataset.work,value=control.dataset.value;
        if(isRecognitionWithCertainty(getRound())&&getRound().works.some(work=>work.id===id)&&d.guesses[id]&&['recognised','inferred','guessed'].includes(value)){d.certainty||={};d.certainty[id]=value;d.confirmed=false;saveDraft();paintMatches();sync();}
        return true;
      }
      if (action === 'select-art') {
        // Every artwork thumbnail selects that work. Revisiting a placed work
        // must not give the currently unplaced painting an unintended rating.
        select(control.dataset.work);
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
import {isRecognitionWithCertainty} from './recognition-evidence.mjs';
