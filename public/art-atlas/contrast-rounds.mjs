import {updateArtworkCorners} from './artwork-corners.mjs';

// Categorical art decisions. These answers never become invented numeric ratings.
export const CONTRAST_PROTOCOL = 'contrast-rounds-v1';
export const NEIGHBOUR_REASONS_PROTOCOL = 'contrast-neighbour-reasons-v2';
export const CONTRAST_KINDS = Object.freeze(['keep-leave', 'neighbour', 'chronology', 'same-subject']);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const unique = values => [...new Set(values)];
const ids = round => Array.isArray(round?.works) ? round.works.map(work => work?.id) : [];
const exact = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
const sameIds = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && new Set(a).size === a.length && new Set(b).size === b.length && a.every(id => b.includes(id));
const url = value => { try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; } };
const range = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && value[0] <= value[1];
const clone = value => structuredClone(value);
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const short = work => work.shortTitle || work.title;
const constructs = Object.freeze({'keep-leave':'set-extremes', neighbour:'contextual-neighbour', chronology:'chronological-order', 'same-subject':'subject-matched-preference'});
export const allowsMultipleNeighbourReasons = round => round?.contrastKind === 'neighbour' && round.evidence?.protocol === NEIGHBOUR_REASONS_PROTOCOL;

/** Reported labels describe one pairing decision, never separate preference observations. */
export function neighbourRelationshipIds(round, answer) {
  const allowed = (Array.isArray(round?.relationshipOptions) ? round.relationshipOptions : []).filter(option => text(option?.id)).map(option => option.id);
  return allowsMultipleNeighbourReasons(round)
    ? unique((Array.isArray(answer?.relationshipIds) ? answer.relationshipIds : []).filter(id => allowed.includes(id)))
    : allowed.includes(answer?.relationshipId) ? [answer.relationshipId] : [];
}
export function neighbourRelationshipLabels(round, answer) {
  return neighbourRelationshipIds(round, answer).map(id => round.relationshipOptions.find(option => option.id === id).label);
}

function validWorks(works) {
  return Array.isArray(works) && works.every(work => plain(work) && text(work.id) && text(work.title) && text(work.image) && url(work.sourceUrl)) && new Set(works.map(work => work.id)).size === works.length;
}

export function validContrastDefinition(round) {
  if (!plain(round) || round.kind !== 'contrast' || !CONTRAST_KINDS.includes(round.contrastKind) || !text(round.id) || !text(round.title) || typeof round.hint !== 'string' || round.unavailable || !validWorks(round.works)) return false;
  const offered = ids(round), kind = round.contrastKind;
  if (offered.length !== ({'keep-leave':6, neighbour:4, chronology:4}[kind] || offered.length) || kind === 'same-subject' && ![2,4].includes(offered.length)) return false;
  if (!Array.isArray(round.sourceUrls) || !round.sourceUrls.length || !round.sourceUrls.every(url)) return false;
  if (!(round.evidence?.protocol === CONTRAST_PROTOCOL || kind === 'neighbour' && round.evidence?.protocol === NEIGHBOUR_REASONS_PROTOCOL) || round.evidence?.construct !== constructs[kind] || !text(round.evidence?.contentId)) return false;
  if (kind === 'neighbour') {
    if (!validWorks(round.anchorWorks) || round.anchorWorks.length !== 1 || offered.includes(round.anchorWorks[0].id)) return false;
    if (round.relationshipOptions !== undefined && (!Array.isArray(round.relationshipOptions) || !round.relationshipOptions.length || round.relationshipOptions.some(option => !text(option?.id) || !text(option?.label)) || new Set(round.relationshipOptions.map(option => option.id)).size !== round.relationshipOptions.length)) return false;
  } else if (round.anchorWorks?.length) return false;
  if (kind === 'same-subject' && (!plain(round.subject) || round.subject.reviewed !== true || !text(round.subject.id) || !text(round.subject.label) || !Array.isArray(round.residualConfounds) || !round.residualConfounds.length || !round.residualConfounds.every(text))) return false;
  if (kind === 'chronology') {
    if (!plain(round.dateEvidence) || !exact(Object.keys(round.dateEvidence).sort(), [...offered].sort())) return false;
    if (offered.some(id => !plain(round.dateEvidence[id]) || !range(round.dateEvidence[id].yearRange) || !url(round.dateEvidence[id].sourceUrl))) return false;
  }
  return true;
}

/** Bind only fully sourced content. Missing identities fail without substitutions. */
export function buildContrastRound({works, content, id, batchIndex = 0} = {}) {
  if (!Array.isArray(works) || !plain(content) || content.status !== 'ready' || !CONTRAST_KINDS.includes(content.contrastKind) || !text(id) || !Array.isArray(content.workIds)) return null;
  const counts = new Map();
  for (const work of works) if (text(work?.id)) counts.set(work.id, (counts.get(work.id) || 0) + 1);
  const byId = new Map(works.filter(work => counts.get(work?.id) === 1).map(work => [work.id, work]));
  if (content.workIds.some(workId => !byId.has(workId)) || content.anchorId && !byId.has(content.anchorId)) return null;
  const round = {
    id, kind:'contrast', format:'contrast', contrastKind:content.contrastKind,
    contentId:content.contentId, title:content.contrastKind==='same-subject'&&content.subject?.label?content.subject.label:content.title || content.prompt, prompt:content.prompt || content.title,
    hint:content.contrastKind==='same-subject'?'Choose the painting you prefer, or choose No clear preference.':content.hint || '', works:content.workIds.map(workId => clone(byId.get(workId))),
    anchorWorks:content.anchorId ? [clone(byId.get(content.anchorId))] : [],
    sourceUrls:clone(content.sourceUrls || []), curationNotes:clone(content.curationNotes || []),
    residualConfounds:clone(content.residualConfounds || []),
    evidence:{protocol:content.contrastKind === 'neighbour' ? NEIGHBOUR_REASONS_PROTOCOL : CONTRAST_PROTOCOL, contentId:content.contentId, construct:constructs[content.contrastKind], family:'contrast-decision', role:'discovery', batchIndex, unconditional:false, sourceUrls:clone(content.sourceUrls || [])}
  };
  for (const key of ['subject','dateEvidence','relationshipOptions','exposureAudit']) if (content[key] !== undefined) round[key] = clone(content[key]);
  if (round.contrastKind === 'chronology') round.hideDatesUntilFeedback = true;
  return validContrastDefinition(round) ? round : null;
}

/** Opt-in migration for the active unfinished question only. The host stores archive unchanged. */
export function upgradeActiveNeighbourRound(round, answer, {active = false, now = Date.now()} = {}) {
  const unchanged = {changed:false, round, draft:answer};
  if (!active || !validContrastDefinition(round) || round.contrastKind !== 'neighbour' || round.evidence.protocol !== CONTRAST_PROTOCOL || !Number.isFinite(now)) return unchanged;
  if (answer !== undefined && answer !== null && !plain(answer)) return unchanged;
  if (answer?.skipped || answer?.confirmed !== undefined && answer.confirmed !== false) return unchanged;
  if (plain(answer) && Object.keys(answer).length && (answer.contrastKind !== 'neighbour' || !exact(answer.workIds, ids(round)))) return unchanged;
  if (answer?.noGoodNeighbour !== undefined && typeof answer.noGoodNeighbour !== 'boolean' || answer?.neighbourId != null && !ids(round).includes(answer.neighbourId)) return unchanged;
  if (answer?.relationshipIds !== undefined || answer?.relationshipId != null && (!ids(round).includes(answer.neighbourId) || answer.noGoodNeighbour === true || !round.relationshipOptions?.some(option => option.id === answer.relationshipId))) return unchanged;
  const previous = sanitizeContrastDraft(round, answer || {}), upgraded = clone(round);
  upgraded.evidence.protocol = NEIGHBOUR_REASONS_PROTOCOL;
  const draft = sanitizeContrastDraft(upgraded, {...previous, relationshipIds:previous.relationshipId ? [previous.relationshipId] : []});
  return {changed:true, round:upgraded, draft, archive:{reason:'neighbour-multiple-reasons', revisedAt:now, question:clone(round), hadAnswer:answer !== undefined, answer:answer === undefined ? null : clone(answer)}};
}

/** Sanitizing leaves a question unanswered. It never supplies a missing response. */
export function sanitizeContrastDraft(round, answer = {}) {
  const offered = ids(round), kind = round?.contrastKind;
  answer = plain(answer) && answer.contrastKind === kind && exact(answer.workIds,offered) ? answer : {};
  const draft = {workIds:[...offered], contrastKind:kind, confirmed:false};
  if (kind === 'keep-leave') {
    draft.keepId = offered.includes(answer.keepId) ? answer.keepId : null;
    draft.leaveId = offered.includes(answer.leaveId) && answer.leaveId !== draft.keepId ? answer.leaveId : null;
    draft.selectionPhase = answer.selectionPhase === 'leave' ? 'leave' : 'keep';
  } else if (kind === 'neighbour') {
    draft.neighbourId = offered.includes(answer.neighbourId) ? answer.neighbourId : null;
    draft.noGoodNeighbour = !draft.neighbourId && answer.noGoodNeighbour === true;
    if (allowsMultipleNeighbourReasons(round)) draft.relationshipIds = draft.neighbourId && !draft.noGoodNeighbour ? neighbourRelationshipIds(round, answer) : [];
    else if (Array.isArray(round.relationshipOptions)) draft.relationshipId = round.relationshipOptions.some(option => option.id === answer.relationshipId) ? answer.relationshipId : null;
  } else if (kind === 'chronology') {
    draft.orderedIds = sameIds(answer.orderedIds, offered) ? [...answer.orderedIds] : [...offered];
    draft.uncertainIds = Array.isArray(answer.uncertainIds) ? unique(answer.uncertainIds.filter(id => offered.includes(id))) : [];
    draft.activeId = offered.includes(answer.activeId) ? answer.activeId : null;
    // The initial displayed order is a starting arrangement, not a submitted answer.
    draft.orderReviewed = answer.orderReviewed === true;
  } else if (kind === 'same-subject') {
    draft.preferredId = offered.includes(answer.preferredId) ? answer.preferredId : null;
    draft.noPreference = !draft.preferredId && answer.noPreference === true;
  }
  return draft;
}

export function validContrastAnswer(round, answer) {
  if (!validContrastDefinition(round) || !plain(answer) || answer.confirmed !== true || answer.skipped || answer.contrastKind !== round.contrastKind || !exact(answer.workIds, ids(round))) return false;
  const offered = ids(round);
  if (round.contrastKind === 'keep-leave') return offered.includes(answer.keepId) && offered.includes(answer.leaveId) && answer.keepId !== answer.leaveId;
  if (round.contrastKind === 'neighbour') {
    if (typeof answer.noGoodNeighbour !== 'boolean' || !((offered.includes(answer.neighbourId) && !answer.noGoodNeighbour) || answer.neighbourId === null && answer.noGoodNeighbour)) return false;
    if (allowsMultipleNeighbourReasons(round)) {
      if (Object.hasOwn(answer, 'relationshipId') || !Array.isArray(answer.relationshipIds) || new Set(answer.relationshipIds).size !== answer.relationshipIds.length || answer.relationshipIds.some(id => !round.relationshipOptions?.some(option => option.id === id))) return false;
      return answer.noGoodNeighbour || !round.relationshipOptions?.length ? answer.relationshipIds.length === 0 : answer.relationshipIds.length > 0;
    }
    if (answer.noGoodNeighbour) return answer.relationshipId === undefined || answer.relationshipId === null;
    return !round.relationshipOptions?.length || round.relationshipOptions.some(option => option.id === answer.relationshipId);
  }
  if (round.contrastKind === 'chronology') return sameIds(answer.orderedIds, offered) && Array.isArray(answer.uncertainIds) && new Set(answer.uncertainIds).size === answer.uncertainIds.length && answer.uncertainIds.every(id => offered.includes(id)) && answer.orderReviewed === true;
  return typeof answer.noPreference === 'boolean' && (offered.includes(answer.preferredId) && !answer.noPreference || answer.preferredId === null && answer.noPreference);
}

export function moveChronology(orderedIds, workId, targetIndex) {
  if (!Array.isArray(orderedIds) || new Set(orderedIds).size !== orderedIds.length || !orderedIds.includes(workId) || !Number.isInteger(targetIndex)) return [...(orderedIds || [])];
  const result = orderedIds.filter(id => id !== workId);
  result.splice(Math.max(0, Math.min(result.length, targetIndex)), 0, workId);
  return result;
}

/** Pure actions also support touch, keyboard and a parent-owned event dispatcher. */
export function handleContrastAction(round, previous, action, payload = {}) {
  const next = sanitizeContrastDraft(round, previous), workId = payload.workId || payload.work;
  if (action === 'contrast-mode' && round.contrastKind === 'keep-leave' && ['keep','leave'].includes(payload.mode)) next.selectionPhase = payload.mode;
  if (action === 'contrast-pick' && ids(round).includes(workId)) {
    if (round.contrastKind === 'keep-leave') {
      const field = next.selectionPhase === 'leave' ? 'leaveId' : 'keepId', other = field === 'keepId' ? 'leaveId' : 'keepId';
      next[field] = next[field] === workId ? null : workId;
      if (next[field] === next[other]) next[other] = null;
      if (field === 'keepId' && next.keepId && !next.leaveId) next.selectionPhase = 'leave';
    } else if (round.contrastKind === 'neighbour') {
      next.neighbourId = next.neighbourId === workId ? null : workId;
      next.noGoodNeighbour = false;
      if (allowsMultipleNeighbourReasons(round)) next.relationshipIds = [];
      else next.relationshipId = null;
    } else if (round.contrastKind === 'same-subject') {
      next.preferredId = next.preferredId === workId ? null : workId;
      next.noPreference = false;
    } else if (round.contrastKind === 'chronology') next.activeId = workId;
  }
  if (action === 'contrast-none') {
    if (round.contrastKind === 'neighbour') { next.neighbourId = null; next.noGoodNeighbour = !next.noGoodNeighbour; if (allowsMultipleNeighbourReasons(round)) next.relationshipIds = []; else next.relationshipId = null; }
    if (round.contrastKind === 'same-subject') { next.preferredId = null; next.noPreference = !next.noPreference; }
  }
  if (action === 'contrast-relationship' && round.contrastKind === 'neighbour' && next.neighbourId) {
    if (allowsMultipleNeighbourReasons(round)) {
      if (round.relationshipOptions?.some(option => option.id === payload.relationshipId)) next.relationshipIds = next.relationshipIds.includes(payload.relationshipId) ? next.relationshipIds.filter(id => id !== payload.relationshipId) : [...next.relationshipIds, payload.relationshipId];
    } else next.relationshipId = round.relationshipOptions?.some(option => option.id === payload.relationshipId) ? payload.relationshipId : null;
  }
  if (round.contrastKind === 'chronology') {
    if (action === 'contrast-move' && ids(round).includes(workId)) {
      const current = next.orderedIds.indexOf(workId), target = Number.isInteger(payload.targetIndex) ? payload.targetIndex : current + (payload.direction === 'later' ? 1 : -1);
      next.orderedIds = moveChronology(next.orderedIds, workId, target);
      next.activeId = workId;
      next.orderReviewed = true;
    }
    if (action === 'contrast-uncertain' && ids(round).includes(workId)) { next.uncertainIds = next.uncertainIds.includes(workId) ? next.uncertainIds.filter(id => id !== workId) : [...next.uncertainIds, workId]; next.activeId = workId; next.orderReviewed = true; }
    if (action === 'contrast-all-uncertain') { next.uncertainIds = next.uncertainIds.length === ids(round).length ? [] : ids(round); next.orderReviewed = true; }
    if (action === 'contrast-reviewed') next.orderReviewed = !next.orderReviewed;
  }
  return next;
}

/** Pair judgments use catalogue intervals. Overlap and stated uncertainty stay unscored. */
export function chronologyFeedback(round, answer) {
  if (round?.contrastKind !== 'chronology' || !validContrastAnswer(round, answer)) return null;
  const pairs = [], offered = ids(round), order = answer.orderedIds;
  for (let i = 0; i < offered.length; i++) for (const b of offered.slice(i + 1)) {
    const a = offered[i], ar = round.dateEvidence[a].yearRange, br = round.dateEvidence[b].yearRange;
    const earlierId = ar[1] < br[0] ? a : br[1] < ar[0] ? b : null;
    const status = !earlierId ? 'overlap' : answer.uncertainIds.includes(a) || answer.uncertainIds.includes(b) ? 'uncertain' : order.indexOf(earlierId) < order.indexOf(earlierId === a ? b : a) ? 'correct' : 'reversed';
    pairs.push({workIds:[a,b], earlierId, status});
  }
  const count = status => pairs.filter(pair => pair.status === status).length;
  return {pairs, correct:count('correct'), reversed:count('reversed'), uncertain:count('uncertain'), overlap:count('overlap'), assessed:count('correct') + count('reversed'), dates:offered.map(id => ({workId:id, ...clone(round.dateEvidence[id])})), limits:['This checks the date order of these objects, not preference or general art expertise.','Overlapping catalogue intervals have no scored order. Pairs involving an uncertain placement are also unscored.']};
}

export function contrastAnswerSummary(round, answer) {
  if (!validContrastAnswer(round, answer)) return null;
  const common = {roundId:round.id, contrastKind:round.contrastKind, workIds:ids(round), anchorIds:(round.anchorWorks || []).map(work => work.id), prompt:round.title, construct:round.evidence.construct};
  if (round.contrastKind === 'keep-leave') return {...common, keepId:answer.keepId, leaveId:answer.leaveId, unrankedIds:ids(round).filter(id => id !== answer.keepId && id !== answer.leaveId)};
  if (round.contrastKind === 'neighbour') return {...common, neighbourId:answer.neighbourId, noGoodNeighbour:answer.noGoodNeighbour, ...(allowsMultipleNeighbourReasons(round) ? {relationshipIds:[...answer.relationshipIds]} : {relationshipId:answer.relationshipId || null}), unchosenIds:ids(round).filter(id => id !== answer.neighbourId)};
  if (round.contrastKind === 'chronology') return {...common, orderedIds:[...answer.orderedIds], uncertainIds:[...answer.uncertainIds], feedback:chronologyFeedback(round, answer)};
  return {...common, preferredId:answer.preferredId, noPreference:answer.noPreference, unrankedIds:ids(round).filter(id => id !== answer.preferredId), subject:clone(round.subject), residualConfounds:[...round.residualConfounds]};
}

const circle = (action, label, selected, attributes = '') => `<button type="button" class="contrast-circle" data-action="${action}" aria-pressed="${selected}" ${attributes}><span aria-hidden="true"></span>${label}</button>`;
function selectedRole(round, draft, id) {
  if (round.contrastKind === 'keep-leave') return draft.keepId === id ? 'keep' : draft.leaveId === id ? 'leave' : '';
  if (round.contrastKind === 'neighbour') return draft.neighbourId === id ? 'neighbour' : '';
  if (round.contrastKind === 'same-subject') return draft.preferredId === id ? 'preferred' : '';
  return draft.activeId === id ? 'active' : '';
}
function dateLabel(record) { return record.displayDate || (record.yearRange[0] === record.yearRange[1] ? String(record.yearRange[0]) : record.yearRange.join('–')); }
function feedbackMarkup(round, draft, esc) {
  const result = chronologyFeedback(round, draft);
  if (!result) return '';
  const note = result.assessed ? result.reversed ? 'The dates show a different order.' : 'Your order matches the recorded dates.' : 'The museum dates are shown above.';
  return `<p class="contrast-feedback-note">${note}${result.uncertain ? ' Uncertain works are left unscored.' : ''}${result.overlap ? ' Overlapping date ranges stay open.' : ''}</p>`;
}
function relationshipMarkup(round, draft, esc) {
  const multiple = allowsMultipleNeighbourReasons(round), selected = neighbourRelationshipIds(round, draft);
  return round.contrastKind === 'neighbour' && draft.neighbourId && round.relationshipOptions?.length ? `<div class="contrast-relationship" data-reason-selection="${multiple ? 'multiple' : 'single'}"><span>What connects them?</span>${multiple ? '<span class="contrast-multiple-hint">Choose all that apply.</span>' : ''}<div role="group" aria-label="${multiple ? 'Connections — choose all that apply' : 'Connection'}">${round.relationshipOptions.map(option => circle('contrast-relationship', esc(option.label), selected.includes(option.id), `data-relationship-id="${esc(option.id)}"`)).join('')}</div></div>` : '';
}

/** Body only. The host owns the title, progress, Skip and Continue controls. */
export function renderContrastRound(round, answer = {}, {image, esc = html} = {}) {
  if (!validContrastDefinition(round) || typeof image !== 'function') return '<p class="contrast-unavailable">This artwork set is unavailable.</p>';
  const confirmed = validContrastAnswer(round, answer), draft = {...sanitizeContrastDraft(round, answer), confirmed}, kind = round.contrastKind;
  const chronology = kind === 'chronology', byId = new Map(round.works.map(work => [work.id, work])), ordered = chronology ? draft.orderedIds.map(id => byId.get(id)) : round.works;
  const art = (work, index) => {
    const role = selectedRole(round, draft, work.id), label = role === 'keep' ? 'Keep' : role === 'leave' ? 'Leave' : role === 'neighbour' ? 'Neighbour' : role === 'preferred' ? 'Selected' : '';
    return `<figure class="contrast-work" data-work="${esc(work.id)}" data-choice="${role}"><button type="button" class="contrast-image-button" data-action="contrast-pick" data-work="${esc(work.id)}" aria-label="${chronology ? 'Select position ' : 'Choose painting '}${index + 1}" aria-pressed="${!!role}"${chronology ? ' aria-keyshortcuts="ArrowLeft ArrowRight"' : ''}><span class="contrast-picture art-visual">${image(work)}</span></button><figcaption><span class="contrast-work-position"${chronology ? '' : ' hidden'}>${index + 1}</span><span class="contrast-choice-label" aria-live="polite">${label}</span>${chronology ? `<span class="contrast-order-tools"><button type="button" data-action="contrast-move" data-work="${esc(work.id)}" data-direction="earlier" aria-label="Move painting ${index + 1} earlier"${index === 0 || confirmed ? ' disabled' : ''}>←</button><button type="button" data-action="contrast-move" data-work="${esc(work.id)}" data-direction="later" aria-label="Move painting ${index + 1} later"${index === ordered.length - 1 || confirmed ? ' disabled' : ''}>→</button></span>` : ''}</figcaption>${chronology ? circle('contrast-uncertain', 'Not sure', draft.uncertainIds.includes(work.id), `data-work="${esc(work.id)}"${confirmed ? ' disabled' : ''}`) : ''}${chronology ? `<div class="contrast-date" aria-hidden="${!confirmed}">${confirmed ? `<span>${esc(short(work))}</span><a href="${esc(round.dateEvidence[work.id].sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(dateLabel(round.dateEvidence[work.id]))}</a>` : ''}</div>` : ''}</figure>`;
  };
  let tools = '', anchor = '', description = '';
  if (kind === 'keep-leave') tools = `<div class="contrast-modes" role="group" aria-label="Choose what to select">${circle('contrast-mode', 'Keep one', draft.selectionPhase === 'keep', 'data-mode="keep"')}${circle('contrast-mode', 'Leave one', draft.selectionPhase === 'leave', 'data-mode="leave"')}<span class="contrast-task-status" role="status">${draft.keepId && draft.leaveId ? 'The other four stay unranked.' : draft.keepId ? 'Now leave one.' : 'Choose one to keep.'}</span></div>`;
  if (kind === 'neighbour') {
    const work = round.anchorWorks[0];
    anchor = `<figure class="contrast-anchor"><span class="contrast-anchor-label">Pair with</span><div class="contrast-anchor-picture">${image(work)}</div></figure>`;
    tools = circle('contrast-none', 'No good neighbour here', draft.noGoodNeighbour) + `<div class="contrast-relationship-slot">${relationshipMarkup(round, draft, esc)}</div>`;
  }
  if (kind === 'same-subject') {
    description = `<p class="contrast-subject-note">${esc(round.subject.description || round.subject.label)}</p>`;
    tools = circle('contrast-none', 'No clear preference', draft.noPreference);
  }
  if (chronology) tools = `<div class="contrast-chronology-tools">${circle('contrast-reviewed', 'Use this order', draft.orderReviewed, confirmed ? 'disabled' : '')}${circle('contrast-all-uncertain', 'Unsure about all four', draft.uncertainIds.length === ids(round).length, confirmed ? 'disabled' : '')}<span class="contrast-change-slot" aria-hidden="${!confirmed}">${circle('contrast-change','Change order',false,confirmed ? '' : 'disabled')}</span><span class="contrast-task-status">${confirmed ? '' : 'Drag, use the arrows, or select and press ← →.'}</span></div><div class="contrast-feedback" aria-live="polite">${feedbackMarkup(round, draft, esc)}</div>`;
  return `<section class="contrast-round" data-contrast-id="${esc(round.id)}" data-contrast-kind="${kind}" data-confirmed="${confirmed}">${description}${kind === 'keep-leave' ? tools : ''}<div class="contrast-layout">${anchor}<div class="contrast-pictures" style="--contrast-count:${ordered.length}">${ordered.map(art).join('')}</div></div>${kind !== 'keep-leave' ? `<div class="contrast-tools">${tools}</div>` : ''}<p class="contrast-image-status" role="status" hidden></p></section>`;
}

/** Parent delegates contrast-* data actions to handle(). No global click listener is installed. */
export function createContrastController({app, round, draft:initial = {}, image, esc = html, saveDraft = () => {}, sync:hostSync = () => {}, notify = () => {}} = {}) {
  let draft = {...sanitizeContrastDraft(round, initial), confirmed:validContrastAnswer(round, initial)}, disposed = false, root = null, drag = null, suppressClick = false;
  const cleanups = [], offered = ids(round), anchorIds = (round.anchorWorks || []).map(work => work.id), byId = new Map(round.works.map(work => [work.id, work]));
  const query = () => app?.querySelectorAll ? [...app.querySelectorAll('.contrast-round')].find(element => element.dataset.contrastId === round.id) || null : app?.querySelector?.('.contrast-round');
  function mountedReady() {
    const element = query();
    if (!element) return false;
    const pictures = [...element.querySelectorAll('.contrast-picture img,.contrast-anchor-picture img')];
    if (pictures.length !== offered.length + anchorIds.length) return false;
    return sameIds(pictures.map(img => img.dataset.artwork), [...offered,...anchorIds]) && pictures.every(img => img.complete && img.naturalWidth > 0);
  }
  function sync() {
    root = query(); if (!root || disposed) return false;
    root.dataset.confirmed = String(draft.confirmed === true);
    if (round.contrastKind === 'chronology' && !exact([...root.querySelectorAll('.contrast-work')].map(element => element.dataset.work),draft.orderedIds)) for (const id of draft.orderedIds) { const node = [...root.querySelectorAll('.contrast-work')].find(element => element.dataset.work === id); if (node) root.querySelector('.contrast-pictures').appendChild(node); }
    [...root.querySelectorAll('.contrast-work')].forEach((node, index) => {
      const id = node.dataset.work, role = selectedRole(round, draft, id), button = node.querySelector('.contrast-image-button');
      node.dataset.choice = role;
      button?.setAttribute('aria-pressed', String(!!role));
      button?.setAttribute('aria-label',(round.contrastKind === 'chronology' ? 'Select position ' : 'Choose painting ')+(index+1));
      if (button) button.disabled = draft.confirmed && round.contrastKind === 'chronology';
      const label = node.querySelector('.contrast-choice-label'); if (label) label.textContent = ({keep:'Keep',leave:'Leave',neighbour:'Neighbour',preferred:'Selected'}[role] || '');
      const position = node.querySelector('.contrast-work-position'); if (position) position.textContent = index + 1;
      node.querySelector('[data-action="contrast-uncertain"]')?.setAttribute('aria-pressed', String(draft.uncertainIds?.includes(id) === true));
      node.querySelectorAll('[data-action="contrast-move"]').forEach(control => { control.disabled = draft.confirmed || control.dataset.direction === 'earlier' && index === 0 || control.dataset.direction === 'later' && index === offered.length - 1; control.setAttribute('aria-label','Move painting '+(index+1)+' '+control.dataset.direction); });
      if (round.contrastKind === 'chronology') {
        const uncertainty = node.querySelector('[data-action="contrast-uncertain"]'); if (uncertainty) uncertainty.disabled = draft.confirmed;
        const date = node.querySelector('.contrast-date');
        if (date) { date.setAttribute('aria-hidden',String(!draft.confirmed)); date.innerHTML = draft.confirmed ? `<span>${esc(short(byId.get(id)))}</span><a href="${esc(round.dateEvidence[id].sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(dateLabel(round.dateEvidence[id]))}</a>` : ''; }
      }
    });
    root.querySelectorAll('[data-action="contrast-mode"]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.mode === draft.selectionPhase)));
    root.querySelector('[data-action="contrast-none"]')?.setAttribute('aria-pressed', String(round.contrastKind === 'neighbour' ? draft.noGoodNeighbour : draft.noPreference));
    const relationshipSlot = root.querySelector('.contrast-relationship-slot');
    if (relationshipSlot) {
      if (relationshipSlot.dataset.relationshipWork !== (draft.neighbourId || '')) { relationshipSlot.innerHTML = relationshipMarkup(round, draft, esc); relationshipSlot.dataset.relationshipWork = draft.neighbourId || ''; }
      relationshipSlot.querySelectorAll('[data-action="contrast-relationship"]').forEach(control => control.setAttribute('aria-pressed',String(neighbourRelationshipIds(round, draft).includes(control.dataset.relationshipId))));
    }
    root.querySelector('[data-action="contrast-reviewed"]')?.setAttribute('aria-pressed', String(draft.orderReviewed === true));
    root.querySelector('[data-action="contrast-all-uncertain"]')?.setAttribute('aria-pressed', String(draft.uncertainIds?.length === offered.length));
    root.querySelectorAll('[data-action="contrast-reviewed"],[data-action="contrast-all-uncertain"]').forEach(control => { control.disabled = draft.confirmed; });
    if (round.contrastKind === 'keep-leave') { const status = root.querySelector('.contrast-task-status'); if (status) status.textContent = draft.keepId && draft.leaveId ? 'The other four stay unranked.' : draft.keepId ? 'Now leave one.' : 'Choose one to keep.'; }
    const feedback = root.querySelector('.contrast-feedback'); if (feedback) feedback.innerHTML = feedbackMarkup(round, draft, esc);
    if (round.contrastKind === 'chronology') {
      const change = root.querySelector('[data-action="contrast-change"]'); if (change) change.disabled = !draft.confirmed;
      root.querySelector('.contrast-change-slot')?.setAttribute('aria-hidden',String(!draft.confirmed));
      const hint = root.querySelector('.contrast-task-status'); if (hint) hint.textContent = draft.confirmed ? '' : 'Drag, use the arrows, or select and press ← →.';
    }
    const pictures = [...root.querySelectorAll('.contrast-picture img,.contrast-anchor-picture img')], failed = pictures.some(img => img.complete && !img.naturalWidth), status = root.querySelector('.contrast-image-status');
    if (status) { status.hidden = !failed; status.textContent = failed ? 'A painting could not load. Reload the images before confirming.' : ''; }
    updateArtworkCorners(root);
    return mountedReady();
  }
  function emit(next) { draft = next; saveDraft(clone(draft)); sync(); hostSync(clone(draft)); return draft; }
  function handle(action, control = {}, event) {
    if (!action?.startsWith('contrast-') || disposed) return false;
    if (suppressClick && action === 'contrast-pick') { suppressClick = false; return true; }
    const payload = control.dataset || control;
    if (action === 'contrast-change') { emit({...sanitizeContrastDraft(round, draft), confirmed:false}); return true; }
    if (draft.confirmed && round.contrastKind === 'chronology') return true;
    if (action === 'contrast-confirm') { confirm(); return true; }
    const next = handleContrastAction(round, draft, action, {workId:payload.workId || payload.work, mode:payload.mode, direction:payload.direction, targetIndex:Number.isInteger(payload.targetIndex) ? payload.targetIndex : undefined, relationshipId:payload.relationshipId});
    emit(next); event?.preventDefault?.(); return true;
  }
  function confirm() {
    const answer = {...sanitizeContrastDraft(round, draft), confirmed:true};
    if (!mountedReady() || !validContrastAnswer(round, answer)) { notify('Complete this decision and wait for the paintings to load.'); return null; }
    return clone(emit(answer));
  }
  function endDrag() { if (!drag) return; drag.ghost?.remove(); try { drag.control.releasePointerCapture(drag.pointerId); } catch {} drag = null; }
  function mount() {
    root = query(); if (!root || disposed || root.dataset.contrastMounted === 'true') return sync();
    root.dataset.contrastMounted = 'true';
    const listen = (name, callback, capture = false) => { root.addEventListener(name, callback, capture); cleanups.push(() => root?.removeEventListener(name, callback, capture)); };
    listen('load', () => { sync(); hostSync(clone(draft)); }, true);
    listen('error', () => { sync(); hostSync(clone(draft)); }, true);
    const view = root.ownerDocument?.defaultView;
    if (view) { const onResize = () => sync(); view.addEventListener('resize',onResize); cleanups.push(() => view.removeEventListener('resize',onResize)); }
    if (round.contrastKind === 'chronology') {
      listen('keydown', event => {
        const control = event.target.closest?.('.contrast-image-button');
        if (event.key === 'Escape') { endDrag(); return; }
        if (!control || draft.confirmed || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
        event.preventDefault(); const workId = control.dataset.work, direction = ['ArrowRight','ArrowDown'].includes(event.key) ? 'later' : 'earlier';
        emit(handleContrastAction(round, draft, 'contrast-move', {workId, direction})); control.focus({preventScroll:true});
      });
      listen('pointerdown', event => {
        const control = event.target.closest?.('.contrast-image-button');
        if (!control || draft.confirmed || event.button !== 0) return;
        drag = {control, workId:control.dataset.work, pointerId:event.pointerId, x:event.clientX, y:event.clientY, moved:false, ghost:null};
        try { control.setPointerCapture(event.pointerId); } catch {}
      });
      listen('pointermove', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7) return;
        event.preventDefault();
        if (!drag.moved) { drag.moved = true; const img = drag.control.querySelector('img'); if (img) { drag.ghost = img.cloneNode(); drag.ghost.className = 'contrast-drag-ghost'; drag.ghost.removeAttribute('id'); root.ownerDocument.body.appendChild(drag.ghost); } }
        if (drag.ghost) { drag.ghost.style.left = `${event.clientX}px`; drag.ghost.style.top = `${event.clientY}px`; }
      });
      listen('pointerup', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const current = drag, target = root.ownerDocument.elementFromPoint(event.clientX, event.clientY)?.closest?.('.contrast-work');
        if (current.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; },0); if (target && root.contains(target)) emit(handleContrastAction(round, draft, 'contrast-move', {workId:current.workId, targetIndex:draft.orderedIds.indexOf(target.dataset.work)})); }
        endDrag();
      });
      listen('pointercancel', endDrag);
    }
    return sync();
  }
  return {markup:() => renderContrastRound(round, draft, {image,esc}), sync:mount, mountedReady, handle, confirm, getDraft:() => clone(draft), dispose:() => { disposed = true; endDrag(); cleanups.splice(0).forEach(cleanup => cleanup()); }};
}
