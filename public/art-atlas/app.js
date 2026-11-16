import { createInteractions } from './interactions.mjs';
import {artworkImageAttributes} from './artwork-image.mjs';
import {renderArtworkContext} from './artwork-context.mjs';
import {createArtworkDialog} from './artwork-dialog.mjs';
import { createCurationLab } from './curation.mjs';
import { createDeepStudy } from './deep-study.mjs';
import { analyzeScenarios } from './scenarios.mjs';
import { createOpeningScene } from './opening-scene.mjs';
import {createProfileDetails} from './profile-details.mjs';
import {createProfileReadingTabs} from './profile-intelligence-view.mjs';
import {createProfileResponseTabs} from './profile-response-view.mjs';
import { SCHEMA, ROUND_IDS, FORMATS, AGREEMENT, freshState, pruneAfter, buildRounds, buildProfile, describePoint, validAnswer, sanitizeDraft } from './engine.mjs';

const app = document.getElementById('app');
const STORAGE_KEY = 'art-profile-prototype-v5', COLLECTION_KEY = 'art-profile-collection-v1';
let openingWorks = [];
let works = [], state = freshState(), round = null, draft = {}, imagesReady = false, storageAvailable = true;
let collection = { version: 1, saved: {}, sessions: [] }, collectionFilter = 'saved', viewingSession = null, statementIndex=null,statementSession=null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const workById = id => works.find(w => w.id === id);
const image = (w, extra = '', options={}) => `<img ${artworkImageAttributes(w,options)} data-artwork="${esc(w.id)}" alt="${esc(w.alt)}" ${extra}>`;
const artworkDialog=createArtworkDialog({dialog:document.getElementById('art-dialog'),content:document.getElementById('art-dialog-content'),image,esc,keepButtons,renderContext:renderArtworkContext});
const inputs = createInteractions({ app, getRound: () => round, getDraft: () => draft, ready: () => state.stage==='question'&&imagesReady, image, esc, workById, saveDraft: () => saveDraft(), sync: () => syncRoundImages() });
const imageZoom = w => `<button type="button" class="text-button" data-action="zoom" data-work="${esc(w.id)}">Look closer ↗</button>`;
const workIds = r => r.works.map(w => w.id);
const currentAnswers = () => viewingSession ? collection.sessions.find(s => s.id === viewingSession)?.answers || state.answers : state.answers;
const legacyLabSurface=document.createElement('div');
const lab = createCurationLab({app:legacyLabSurface,getWorks:()=>works,getBaseline:()=>currentAnswers(),getSaved:()=>collection.saved,image,esc,keepButtons,
  inspect:id=>showArtwork(id,true),
  navigate:stage=>{state.stage=stage||'lab';save();render();focusQuestion();},
  showReading:()=>{viewingSession=null;state.stage='result';save();render();focusQuestion();},
  storageChanged:()=>{storageAvailable=false;}
});
const deep=createDeepStudy({app,getWorks:()=>works,image,esc,keepButtons,mode:'journey',getSavedCollection:()=>collection.saved,getSavedExercises:()=>lab.exportData().drafts,getExhibitionFindings:()=>analyzeScenarios(works,lab.records()).findings,navigate:stage=>{state.stage=stage||'study';save();render();focusQuestion();},showArtwork:(id,reveal)=>showArtwork(id,reveal)});
const titleScene=createOpeningScene({app,getWorks:()=>[...works,...openingWorks]});
createProfileDetails({app,showArtwork});
createProfileResponseTabs({app});
createProfileReadingTabs({app});
function persist(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { storageAvailable = false; } }
function save() { persist(STORAGE_KEY, state); }
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.schema === SCHEMA && ['intro', 'question', 'result', 'collection', 'lab', 'study'].includes(saved.stage)) {
      const candidate = { ...freshState(), ...saved, index: Math.max(0, Math.min(ROUND_IDS.length - 1, Math.trunc(Number(saved.index) || 0))), answers: {} };
      for (let i = 0; i < ROUND_IDS.length; i++) {
        const r = buildRounds(works, candidate.answers)[i], a = saved.answers?.[r.id];
        if (a?.skipped) candidate.answers[r.id] = { skipped: true };
        else if (validAnswer(r, a)) candidate.answers[r.id] = a;
        else if (a) candidate.answers[r.id] = sanitizeDraft(r, a);
      }
      state = candidate;
    }
    const kept = JSON.parse(localStorage.getItem(COLLECTION_KEY));
    if (kept?.version === 1) {
      collection.saved = Object.fromEntries(Object.entries(kept.saved || {}).filter(([id, value]) => workById(id) && value && (value.look === true || value.study === true)));
      collection.sessions = Array.isArray(kept.sessions) ? kept.sessions.filter(s => s.schema === SCHEMA && s.id && s.answers && Number.isFinite(s.finishedAt)).slice(-50) : [];
    }
  } catch { /* Older data stays intact. An unavailable store does not prevent a session. */ }
}
function focusQuestion() {
  requestAnimationFrame(() => { const h = app.querySelector('#question-title') || app.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } window.scrollTo({ top: 0, behavior: 'instant' }); });
}
function render() {
  if (state.stage === 'intro') renderIntro();
  else if (state.stage === 'result') renderResult();
  else if (state.stage === 'collection') renderCollection();
  else if (state.stage === 'lab') renderIntro();
  else if (state.stage === 'study') deep.render();
  else renderQuestion(true);
}
function renderIntro() {
  app.innerHTML=deep.opening();
}
function statementsMarkup() {
  if(statementSession!==state.startedAt){statementSession=state.startedAt;statementIndex=null;}
  if(statementIndex===null)statementIndex=Math.max(0,round.statements.findIndex(s=>draft.claims[s.id]===undefined));
  const s=round.statements[statementIndex];
  return `<div class="self-view single-statement"><nav class="statement-pages" aria-label="Statements">${round.statements.map((item,i)=>`<button type="button" data-action="statement-page" data-index="${i}" aria-label="Statement ${i+1}${draft.claims[item.id]!==undefined?', answered':''}" aria-current="${i===statementIndex?'step':'false'}">${i+1}</button>`).join('')}</nav><fieldset class="statement" data-statement="${s.id}"><legend tabindex="-1">${esc(s.text)}</legend><div class="agreement-options">${AGREEMENT.map((label,value)=>`<button type="button" class="agreement-option" data-action="agreement" data-field="${s.id}" data-value="${value}" aria-pressed="${draft.claims[s.id]===value}"><span class="agreement-circle" aria-hidden="true"></span><span>${label}</span></button>`).join('')}</div><p class="statement-status" aria-live="polite">${draft.claims[s.id]===undefined?'Choose the answer closest to your view.':esc(AGREEMENT[draft.claims[s.id]])}${statementIndex===2&&Object.keys(draft.claims).length===3?' · All three answered.':''}</p></fieldset><div class="statement-reference" aria-label="The same four paintings">${round.works.map(w=>`<button type="button" data-action="zoom" data-work="${esc(w.id)}" aria-label="Look closer at this painting">${image(w)}</button>`).join('')}</div></div>`;
}
function roundBody() {
  if (['spectrum', 'match', 'grid'].includes(round.kind)) return inputs.markup();
  if (round.kind === 'statements') return statementsMarkup();
  const w = round.works[0];
  return `<div class="reveal-layout"><figure class="single-art">${image(w)}<figcaption><div class="enlarge-row">${imageZoom(w)}</div></figcaption></figure><div class="reveal-panel"><p class="eyebrow">${esc(w.artist)}</p><h2 class="work-title">${esc(w.title)}</h2><p class="context-note">${esc(w.note)}</p><fieldset class="question-field"><legend>Compared with before the note, are you…</legend><div class="chip-row">${[['more','More curious'],['same','About the same'],['less','Less curious'],['unsure','Not sure']].map(([value, label]) => `<button class="choice-chip" type="button" data-action="context" data-value="${value}" aria-pressed="${draft.change === value}">${label}</button>`).join('')}</div></fieldset><a class="source-link" href="${esc(w.sourceUrl)}" target="_blank" rel="noopener noreferrer">Museum source ↗</a></div></div>`;
}
function draftFor(r) {
  const saved = state.answers[r.id];
  const a = saved && !saved.skipped ? validAnswer(r, saved) ? structuredClone(saved) : sanitizeDraft(r, saved) : sanitizeDraft(r, {});
  a.workIds = workIds(r);
  if (r.id === 'lastLook') a.predicted = r.predicted;
  return a;
}
function canConfirm() { return validAnswer(round, ['spectrum','grid','match'].includes(round.kind) ? { ...draft, confirmed: true } : draft); }
function syncRoundImages() {
  if (state.stage !== 'question') return;
  const images = [...app.querySelectorAll('.round-body img')], failed = images.filter(i => i.complete && i.naturalWidth === 0), pending = images.filter(i => !i.complete);
  imagesReady = images.length > 0 && !failed.length && !pending.length;
  for (const img of images) img.classList.toggle('image-unavailable', failed.includes(img));
  const status = app.querySelector('#image-status');
  if (status) {
    status.hidden = imagesReady;
    const current = `${failed.length}:${pending.length}`, count = new Set(failed.map(i => i.dataset.artwork)).size;
    if (status.dataset.state !== current) { status.dataset.state = current; status.innerHTML = `<span>${failed.length ? `${count} artwork${count === 1 ? '' : 's'} could not load. Retry before answering, or skip this round.` : 'Loading artworks...'}</span>${failed.length ? '<button type="button" class="secondary-button" data-action="retry-images">Retry images</button>' : ''}`; }
  }
  if (['spectrum','grid','match'].includes(round.kind)) inputs.refresh();
  for (const control of app.querySelectorAll('.drag-art, .match-label, [data-action=place-match], .spectrum-hit, .choice-chip, .agreement-option')) control.disabled = !imagesReady || round.kind === 'match' && draft.confirmed;
  for (const control of app.querySelectorAll('[data-action=nudge]')) if (!imagesReady) control.disabled = true;
  const pad = app.querySelector('#response-pad'); if (pad) pad.setAttribute('aria-disabled', String(!imagesReady));
  const next = app.querySelector('[data-action=continue]'); if (next) next.disabled = !imagesReady || !canConfirm();
}
function retryImages() {
  for (const img of app.querySelectorAll('.round-body img')) if (!img.complete || !img.naturalWidth) { img.classList.remove('image-unavailable'); img.src = './' + workById(img.dataset.artwork).image + '?retry=' + Date.now(); }
  syncRoundImages();
}
app.addEventListener('load', syncRoundImages, true); app.addEventListener('error', syncRoundImages, true);
function renderQuestion(focus = false, keepDraft = false) {
  round = buildRounds(works, state.answers)[state.index]; if (!keepDraft) draft = draftFor(round); imagesReady = false;
  const checked = round.kind === 'match' && draft.confirmed, title = checked ? round.field === 'artist' ? 'Here are the artists.' : 'Here are the styles and traditions.' : round.title;
  const hint = checked ? 'Your first matches are saved. Compare them with the answers below.' : round.hint;
  app.innerHTML = `<section class="session" data-round="${round.id}" data-kind="${round.kind}" data-format="${round.format}"><div class="session-meta"><span>${String(state.index + 1).padStart(2, '0')} <span class="meta-divider">/ ${ROUND_IDS.length}</span></span><span>${esc(FORMATS[round.format].name)}</span><span class="progress-dots" role="progressbar" aria-label="Session progress" aria-valuenow="${state.index}" aria-valuemin="0" aria-valuemax="${ROUND_IDS.length}">${ROUND_IDS.map((_, i) => `<i class="${i <= state.index ? 'complete' : ''}"></i>`).join('')}</span></div><div class="question-head"><h1 id="question-title">${esc(title)}</h1><p>${esc(hint)}</p></div><div id="image-status" class="image-status" role="status" aria-live="polite" hidden></div><div class="round-body">${roundBody()}</div><div class="round-actions"><div class="action-side"><button class="text-button" type="button" data-action="back">${state.index === 0 ? 'Introduction' : 'Back'}</button><button class="text-button" type="button" data-action="skip">Skip</button></div><button type="button" class="primary-button" data-action="continue" disabled>${round.kind === 'match' && !draft.confirmed ? 'Check matches' : state.index === ROUND_IDS.length - 1 ? 'View reading' : ['spectrum','grid'].includes(round.kind) ? 'Confirm placements' : 'Continue'} <span aria-hidden="true">→</span></button></div></section>`;
  if (['spectrum','grid','match'].includes(round.kind)) inputs.attach(); syncRoundImages(); if (focus) focusQuestion();
}
function saveDraft() {
  if (JSON.stringify(state.answers[round.id]) !== JSON.stringify(draft)) state.answers = pruneAfter(state.answers, state.index);
  state.answers[round.id] = structuredClone(draft); save();
}
function advance(skip = false) {
  if (!skip && (!imagesReady || !canConfirm())) return;
  if (!skip && round.kind === 'match' && !draft.confirmed) { draft.confirmed = true; saveDraft(); renderQuestion(true, true); return; }
  if (!skip && ['spectrum','grid'].includes(round.kind)) draft.confirmed = true;
  if (skip) { state.answers = pruneAfter(state.answers, state.index); state.answers[round.id] = { skipped: true }; } else saveDraft();
  if (state.index === ROUND_IDS.length - 1) {
    state.stage = 'result'; state.finishedAt = Date.now();
    const id = String(state.startedAt || state.finishedAt);
    collection.sessions = collection.sessions.filter(s => s.id !== id);
    collection.sessions.push({ id, schema: SCHEMA, finishedAt: state.finishedAt, answers: structuredClone(state.answers) });
    collection.sessions = collection.sessions.slice(-50); persist(COLLECTION_KEY, collection);
  } else state.index++;
  save(); render(); if (state.stage === 'result') focusQuestion();
}
function evidenceMarkup(items, label) {
  if (!items?.length) return '';
  const ids = [...new Set(items.flatMap(e => e.workIds))];
  return `<div class="evidence-group"><h4>${label}</h4><div class="evidence-artworks">${ids.map(id => `<button type="button" class="evidence-art" data-action="evidence" data-work="${esc(id)}">${image(workById(id))}<span>${esc(workById(id).shortTitle || workById(id).title)} ↗</span></button>`).join('')}</div>${items.map(e => `<div class="evidence-row"><span class="evidence-round">${esc(e.label)}</span><p>${esc(e.detail)}</p></div>`).join('')}</div>`;
}
function findingMarkup(f, i) {
  return `<article class="finding" data-finding="${esc(f.id)}"><span class="finding-number">${String(i + 1).padStart(2,'0')}</span><div><p class="finding-tag">${f.kind === 'hypothesis' ? 'Possible explanation' : f.kind === 'crosscheck' ? 'Choices × self-description' : f.kind === 'curation' ? 'From your curatorial decisions' : 'Across your responses'}</p>${i ? `<h2>${esc(f.title)}</h2>` : ''}<p class="finding-text">${esc(f.text)}</p><details class="finding-evidence"><summary>See the works &amp; evidence${f.counter.length ? ' · including exceptions' : ''}</summary>${evidenceMarkup(f.support,'Supporting responses')}${evidenceMarkup(f.counter,'What complicates this')}${f.alternatives.length ? `<div class="alternative"><h4>${f.kind === 'hypothesis' ? 'Other explanations' : 'What this leaves open'}</h4>${f.alternatives.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}</details></div></article>`;
}
function keepButtons(w) {
  const kept = collection.saved[w.id] || {};
  return `<div class="keep-actions" data-keep-work="${esc(w.id)}">${[['look','Keep looking'],['study','Study further']].map(([purpose, label]) => `<button type="button" class="text-button keep-button" data-action="keep" data-work="${esc(w.id)}" data-purpose="${purpose}" aria-pressed="${!!kept[purpose]}">${kept[purpose] ? '✓ ' : '+ '}${label}</button>`).join('')}</div>`;
}
function responseTable(answers) {
  const pref = answers.preferenceRank;
  if (!pref || !validAnswer(buildRounds(works, answers)[0], pref)) return '';
  const rows = pref.workIds.map(id => { const w = workById(id); return `<tr><th scope="row"><button type="button" data-action="evidence" data-work="${esc(id)}">${image(w)}<span>${esc(w.title)}</span></button></th><td>${pref.positions[id]}</td><td>${answers.interestRank?.positions?.[id] ?? 'Not answered'}</td><td>${answers.feeling?.points?.[id] ? esc(describePoint(answers.feeling.axis||'feeling',answers.feeling.points[id])) : 'Not answered'}</td><td>${answers.connection?.points?.[id] ? esc(describePoint('connection',answers.connection.points[id])) : 'Not answered'}</td></tr>`; });
  return `<details class="response-overview"><summary>Your four works, side by side</summary><div class="response-table-scroll"><table><thead><tr><th>Work</th><th>Preference</th><th>Curiosity</th><th>Feeling</th><th>Understanding &amp; connection</th></tr></thead><tbody>${rows.join('')}</tbody></table></div><p>Scale positions are your placements, not population scores.</p></details>`;
}
function renderResult() {
  const answers = currentAnswers(), p = buildProfile(works, answers, viewingSession ? [] : lab.records());
  if (!p.enough) { app.innerHTML = `<section class="empty-portrait"><p class="eyebrow">Your reading</p><h1>${esc(p.name)}</h1><p>${esc(p.subtitle)}</p><button type="button" class="primary-button" data-action="${p.scenarioCount?'lab-home':'review'}">${p.scenarioCount?'Try another curatorial exercise':'Revisit the comparisons'} →</button><button type="button" class="text-button" data-action="collection">Your collection ↗</button></section>`; return; }
  const mainEvidence = [...(p.findings[0]?.support || []),...(p.findings[0]?.counter || [])].filter(e => e.roundId !== 'selfView').flatMap(e => e.workIds);
  const heroWorks = [...new Set([...mainEvidence,...p.evidence])].slice(0,3).map(workById), leading = p.findings.slice(0,1), visual = p.findings.find(f => f.kind === 'hypothesis');
  const second = p.findings.find(f => !leading.includes(f) && (leading[0]?.kind !== 'crosscheck' || f.kind !== 'crosscheck'));
  if (second) leading.push(second);
  const third = visual && !leading.includes(visual) ? visual : p.findings.find(f => !leading.includes(f)); if (third) leading.push(third);
  const remaining = p.findings.filter(f => !leading.includes(f)), prediction = p.prediction, predicted = prediction && workById(prediction.predicted), chosen = prediction?.chosen && workById(prediction.chosen);
  const checkLabels = { open:'Still open', mixed:'Depends on the work', fits:'Fits this set', exception:'A limit to the rule', unendorsed:'A local pattern', compatible:'Compatible here', uncommitted:'Left open by you' };
  app.innerHTML = `<section class="portrait" data-result="${esc(p.key)}"><header class="portrait-head"><div class="reading-meta"><p class="eyebrow">Your reading / ${[p.answered ? p.answered + (p.answered===1?' round':' rounds') : '',p.scenarioCount ? p.scenarioCount + (p.scenarioCount===1?' exercise':' exercises') : ''].filter(Boolean).join(' + ')}${viewingSession ? ' / saved session' : ''}</p><button class="text-button" data-action="collection" type="button">Your collection ↗</button></div><h1>${esc(p.name)}</h1><p class="portrait-subtitle">${esc(p.subtitle)}</p><div class="portrait-strip">${heroWorks.map(w => `<div><button type="button" data-action="evidence" data-work="${esc(w.id)}" aria-label="View ${esc(w.title)}">${image(w)}</button>${keepButtons(w)}</div>`).join('')}</div></header><div class="reading">${leading.map(findingMarkup).join('')}${remaining.length ? `<details class="more-findings"><summary>${remaining.length} more connections &nbsp; +</summary>${remaining.map((f,i) => findingMarkup(f,i+leading.length)).join('')}</details>` : ''}</div>${p.checks.length ? `<section class="self-checks"><p class="eyebrow">Your description, checked against your choices</p><h2>Where the two meet.</h2><p class="section-copy">A specific check of these works. A mismatch can reveal an exception to a rule you use to describe your taste.</p>${p.checks.map(c => `<details class="self-check" data-check="${c.id}" data-status="${c.status}"><summary><span>${esc(c.statement)}</span><span class="check-status">${esc(checkLabels[c.status])}</span></summary><p>You answered "${esc(c.answer)}". ${esc(c.detail)}</p>${evidenceMarkup(c.support,'The description & choices')}${evidenceMarkup(c.counter,'Reversing comparisons')}</details>`).join('')}</section>` : ''}${responseTable(answers)}<div class="open-question"><p class="eyebrow">Still open</p><h2>What would distinguish the explanations?</h2><p>${esc(p.unresolved)}</p><p>${esc(p.reflection)}</p></div>${prediction ? `<details class="prediction-note"><summary>A prediction checked against your last choice</summary><p>The model predicted ${esc(predicted.title)}. ${prediction.tied ? 'You placed the two works equally.' : `You chose ${esc(chosen.title)}.`} That prediction used only earlier preference rounds. One comparison is an illustration, not an accuracy score. Earlier statements and notes may also affect a later choice.</p></details>` : ''}<div class="result-actions"><button class="primary-button" type="button" data-action="lab-home">Explore through curation →</button><button class="text-button" type="button" data-action="lab-museums">Museums to explore ↗</button><button class="text-button" type="button" data-action="collection">Your collection</button><button class="text-button" type="button" data-action="download">Download reading ↓</button>${viewingSession ? '' : '<button class="text-button" type="button" data-action="review">Revisit choices</button>'}<button class="text-button" type="button" data-action="restart">New session</button></div><details class="method-note"><summary>Method &amp; artwork sources</summary><p>${esc(p.basis)}</p><p>Matching results describe these labels and remain separate from preference. A short session cannot establish personality, general expertise or accuracy of self-knowledge. The point cloud is a decorative motif, not a population comparison. This prototype has not been psychometrically validated.</p><p>Your responses and collection stay in this browser. Saves for looking and saves for study remain separate. They do not retrain the preference model.</p><ul class="credits">${works.map(w => `<li><a href="${esc(w.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(w.title)}</a>, ${esc(w.artist)}, ${esc(w.date)}. ${esc(w.museum)}, ${esc(w.rights)}.</li>`).join('')}</ul></details>${storageAvailable ? '' : '<p class="storage-note">Browser storage is unavailable. Download your reading to keep it.</p>'}</section>`;
}
function renderCollection() {
  const saved = Object.keys(collection.saved), items = collectionFilter === 'saved' ? works.filter(w => saved.includes(w.id)) : [...works].sort((a,b) => Number(saved.includes(b.id)) - Number(saved.includes(a.id)));
  app.innerHTML = `<section class="collection"><div class="collection-top"><button class="text-button" data-action="return" type="button">← ${state.finishedAt ? 'Your reading' : 'Back'}</button><span>${storageAvailable ? 'Saved in this browser' : 'This session only · storage unavailable'}</span></div><p class="eyebrow">Your art collection</p><h1>Keep what stays with you.</h1><p class="collection-intro">A work you want to live with can be different from one you want to investigate. Keep either reason, or both.</p><div class="collection-toolbar"><div><button class="text-button" data-action="filter" data-value="saved" aria-pressed="${collectionFilter === 'saved'}">Kept · ${saved.length}</button><button class="text-button" data-action="filter" data-value="all" aria-pressed="${collectionFilter === 'all'}">Explore all · ${works.length}</button></div><button class="text-button" data-action="export-collection" type="button">Export collection ↓</button></div>${items.length ? `<div class="collection-gallery">${items.map(w => `<figure class="collection-work"><button class="collection-image" type="button" data-action="evidence" data-work="${esc(w.id)}" aria-label="View ${esc(w.title)}">${image(w)}</button><figcaption><h2>${esc(w.title)}</h2><p>${esc(w.artist)}</p>${keepButtons(w)}</figcaption></figure>`).join('')}</div>` : `<div class="collection-empty"><p>Your collection is open.</p><p>Explore the paintings and keep a few for looking or for study.</p><button class="primary-button" data-action="filter" data-value="all" type="button">Explore paintings →</button></div>`}${collection.sessions.length ? `<div class="collection-history"><h2>Your readings over time.</h2><p>Each session keeps its own evidence. These saved readings do not yet establish a change in taste.</p>${[...collection.sessions].reverse().slice(0,8).map(s => `<button type="button" class="text-button" data-action="saved-reading" data-session="${esc(s.id)}">${esc(new Date(s.finishedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}))} · ${Object.values(s.answers).filter(a => !a.skipped).length} rounds ↗</button>`).join('')}</div>` : ''}<div class="collection-bottom"><button class="text-button" data-action="lab-home" type="button">Arrange an exhibition →</button><button class="text-button" data-action="restart" type="button">Start a new session →</button><p>The collection currently contains ${works.length} museum works. More works can be added with verified images and sources.</p></div></section>`;
}
function toggleKeep(id, purpose) {
  if (!workById(id) || !['look','study'].includes(purpose)) return;
  const old = collection.saved[id] || { addedAt: Date.now() }; old[purpose] = !old[purpose];
  if (!old.look && !old.study) delete collection.saved[id]; else collection.saved[id] = old;
  persist(COLLECTION_KEY, collection);
  for (const element of document.querySelectorAll(`[data-keep-work="${id}"]`)) element.outerHTML = keepButtons(workById(id));
  const count = app.querySelector('[data-action=filter][data-value=saved]'); if (count) count.textContent = 'Kept · ' + Object.keys(collection.saved).length;
  (document.querySelector('dialog[open]') || app).querySelector(`[data-keep-work="${id}"] [data-purpose="${purpose}"]`)?.focus({preventScroll:true});
  if (state.stage === 'collection' && collectionFilter === 'saved' && !collection.saved[id]) renderCollection();
  const live = document.getElementById('collection-status'); if (live) live.textContent = `${workById(id).title}: ${old[purpose] ? 'kept for ' + (purpose === 'look' ? 'looking' : 'study') : 'removed from ' + (purpose === 'look' ? 'looking' : 'study')}.`;
}
function showArtwork(id, reveal = false) {
  const w=state.stage==='study'?deep.getArtwork(id):workById(id);if(!w)return;
  artworkDialog.open(w,{reveal});
}
function downloadFile(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text],{type})), link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function downloadReading() {
  const p = buildProfile(works,currentAnswers(),viewingSession ? [] : lab.records()), lines = ['ART PROFILE',p.name,p.subtitle,''];
  for (const f of p.findings) { lines.push(f.title,f.text); for (const [label, items] of [['Support',f.support],['Exception',f.counter]]) for (const e of items) { lines.push(label + ' / ' + e.label + ': ' + e.detail); for (const id of e.workIds) { const w = workById(id); lines.push(w.title + ', ' + w.artist + '. ' + w.sourceUrl); } } lines.push(...f.alternatives,''); }
  for (const c of p.checks) lines.push(c.statement,'Your response: ' + c.answer,c.detail,'');
  lines.push('Still open',p.unresolved,p.reflection,'',p.basis);
  downloadFile('my-art-profile.txt',lines.join('\n'),'text/plain;charset=utf-8');
}
function onAction(event) {
  if(!works.length)return;
  const control = event.target.closest('[data-action]'); if (!control || control.disabled) return;
  const { action, work, value, field, purpose } = control.dataset;
  if(deep.handle(action,control,event))return;
  if (lab.handle(action,control,event)) return;
  if (state.stage === 'question' && inputs.click(action,control,event)) return;
  if (action === 'title-home') { viewingSession=null;state.stage='intro';save();render();focusQuestion(); }
  if (action === 'title-about') document.getElementById('about-dialog').showModal();
  if (action === 'start') { viewingSession = null; state.stage = 'question'; state.startedAt ||= Date.now(); save(); render(); }
  if(action==='statement-page'&&round?.kind==='statements'){statementIndex=Number(control.dataset.index);app.querySelector('.round-body').innerHTML=statementsMarkup();syncRoundImages();}
  if (action === 'context' || action === 'agreement') {
    if (!imagesReady) return;
    if (action === 'context') draft.change = value; else draft.claims[field] = Number(value);
    saveDraft();
    for (const c of app.querySelectorAll(`[data-action="${action}"]${field ? `[data-field="${field}"]` : ''}`)) c.setAttribute('aria-pressed',String(c.dataset.value === value));
    if (field) app.querySelector(`[data-statement="${field}"] .statement-status`).textContent = AGREEMENT[Number(value)];
    syncRoundImages();
    if(action==='agreement'&&statementIndex<round.statements.length-1){const from=statementIndex;setTimeout(()=>{if(state.stage==='question'&&round?.kind==='statements'&&statementIndex===from){statementIndex++;app.querySelector('.round-body').innerHTML=statementsMarkup();syncRoundImages();app.querySelector('.statement legend')?.focus({preventScroll:true});}},240);}
  }
  if (action === 'retry-images') retryImages();
  if (action === 'continue') advance(); if (action === 'skip') advance(true);
  if (action === 'back') { if (!state.index) state.stage = 'intro'; else state.index--; save(); render(); }
  if (action === 'zoom' || action === 'evidence') showArtwork(work, action === 'evidence' || round?.kind === 'context' || round?.kind === 'match' && draft.confirmed && round.field === 'movement' ? true : round?.kind === 'match' && draft.confirmed ? 'artist' : false);
  if (action === 'review') { viewingSession = null; state.stage = 'question'; state.index = 0; save(); render(); }
  if (action === 'restart') { viewingSession = null; state = freshState(); save(); render(); focusQuestion(); }
  if (action === 'download') downloadReading();
  if (action === 'keep') toggleKeep(work,purpose);
  if (action === 'collection') { viewingSession = null; state.stage = 'collection'; save(); render(); focusQuestion(); }
  if (action === 'filter') { collectionFilter = value; renderCollection(); }
  if (action === 'return') { viewingSession = null; state.stage = state.finishedAt ? 'result' : state.startedAt ? 'question' : 'intro'; save(); render(); focusQuestion(); }
  if (action === 'saved-reading') { viewingSession = control.dataset.session; state.stage = 'result'; render(); focusQuestion(); }
  if (action === 'export-collection') downloadFile('my-art-collection.json',JSON.stringify({ ...collection, exercises:lab.exportData(), sources: Object.keys(collection.saved).map(id => ({ id, title:workById(id).title, artist:workById(id).artist, url:workById(id).sourceUrl })) },null,2),'application/json');
}
app.addEventListener('click',onAction); document.getElementById('art-dialog').addEventListener('click',onAction);
document.querySelector('.site-footer').addEventListener('click',onAction);
for (const dialog of document.querySelectorAll('#about-dialog')) { dialog.querySelector('.dialog-close').addEventListener('click',() => dialog.close()); dialog.addEventListener('click',event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } }); }
document.getElementById('about-button').addEventListener('click',() => document.getElementById('about-dialog').showModal());
document.getElementById('clear-session').addEventListener('click',() => { localStorage.removeItem(STORAGE_KEY); state = freshState(); viewingSession = null; document.getElementById('about-dialog').close(); render(); focusQuestion(); });
document.getElementById('clear-collection').addEventListener('click',() => { localStorage.removeItem(COLLECTION_KEY); collection = {version:1,saved:{},sessions:[]}; viewingSession = null; document.getElementById('about-dialog').close(); render(); focusQuestion(); });
document.getElementById('clear-curation').addEventListener('click',() => { lab.clear(); document.getElementById('about-dialog').close(); render(); focusQuestion(); });
document.getElementById('clear-study').addEventListener('click',()=>{deep.clear();if(state.stage==='study')state.stage='intro';save();document.getElementById('about-dialog').close();render();focusQuestion();});
try {
  const openingRequest=fetch('./opening-artworks.json').then(response=>response.ok?response.json():[]).catch(()=>[]);
  const response = await fetch('./artworks.json'); if (!response.ok) throw new Error('The collection did not load.'); works = await response.json();
  if (!Array.isArray(works) || works.length < 12 || new Set(works.map(w => w.id)).size !== works.length || works.some(w => !w.image || !w.title || !w.artist || !w.features || !w.sourceUrl || typeof w.rights !== 'string' || !w.rights.trim() || w.rights !== 'CC0' && !/^https:\/\//.test(w.rightsUrl||''))) throw new Error('The artwork collection is incomplete.');
  openingWorks=await openingRequest; if(!Array.isArray(openingWorks))openingWorks=[];
  restore(); lab.restore(); await deep.restore(); render(); for (const w of works.filter(w => w.coreQuiz !== false)) { const preload = new Image(); preload.src = './' + w.image; }
} catch (error) { app.innerHTML = `<section class="error-state"><h1>The collection could not open.</h1><p>${esc(error.message)} Reload to try again.</p><button class="primary-button" type="button" id="retry-load">Try again</button></section>`; document.getElementById('retry-load').addEventListener('click',() => location.reload()); }
