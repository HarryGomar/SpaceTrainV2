import {recognitionTier,recognitionWeight} from './curation-priority.mjs';
import { validAnswer } from './engine.mjs';
import {isReviewedVisualDescriptor,FEATURE_SEMANTIC_VERSION} from './visual-descriptor-semantics.mjs';
import {APPEAL_PROTOCOL,isOverallAppealRound} from './appeal-scale.mjs';
import {choiceGridExposure} from './discovery-grid.mjs';
import {isStudyEligibleArtwork} from './study-eligibility.mjs';

const FAMILIES = new Set(['individual-choice', 'feature-check', 'unconditional-preference', 'adaptive-preference']);
const FEATURES = ['abstraction', 'energy', 'complexity', 'humanity', 'narrative', 'atmosphere', 'color'];
const LIMITS = [
  'Selection uses design heuristics, not a validated optimal-information algorithm.',
  'High, low and middle describe a position within one offered set. They are not absolute likes or dislikes.',
  'Exact repeats remain dependent observations. They cannot provide a reliability percentage.',
  'A work compared with new alternatives is a new contextual comparison, not an exact consistency check.',
  'A new comparison can contain familiar artworks. Several visual properties may still vary together.'
];
const unique = values => [...new Set(values)];
const pairKey = (a, b) => JSON.stringify([a, b].sort());
const setKey = ids => JSON.stringify([...ids].sort());
const pairs = ids => ids.flatMap((a, i) => ids.slice(i + 1).map(b => [a, b]));
const mean = values => values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
const finiteFeature = isReviewedVisualDescriptor;
const literalFeature = key => key==='narrative'||key==='atmosphere';
function hash(value) { let n = 2166136261; for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; }
const boundedInt = (value, fallback, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, Math.trunc(value))) : fallback;

function roundIds(round) {
  return Array.isArray(round?.works) ? round.works.map(w => typeof w === 'string' ? w : w?.id) : Array.isArray(round?.workIds) ? [...round.workIds] : [];
}
export function preferenceMeasurementKey(round){
  if(isOverallAppealRound(round))return APPEAL_PROTOCOL;
  const scale=round?.scale;
  return 'legacy-relative:'+JSON.stringify({title:round?.title||'',hint:round?.hint||'',scale:scale&&typeof scale==='object'?Object.fromEntries(Object.keys(scale).sort().map(key=>[key,scale[key]])):null});
}
function anchorIds(round) { return unique([...(Array.isArray(round.anchorIds) ? round.anchorIds : []), ...(Array.isArray(round.anchorWorks) ? round.anchorWorks : []).map(w => typeof w === 'string' ? w : w?.id)]).filter(Boolean); }
function preferenceRecord(round, index, answers, byId) {
  const evidence = round?.evidence;
  if (!round || round.unavailable || round.kind !== 'spectrum' || round.criterion !== 'preference' || evidence?.construct !== 'preference' || !FAMILIES.has(evidence.family) || evidence.unconditional === false || round.brief || evidence.brief || anchorIds(round).length) return null;
  const workIds = roundIds(round);
  if (workIds.length < 2 || workIds.length > 8 || unique(workIds).length !== workIds.length || workIds.some(id => !byId.has(id))) return null;
  if(round.workIds!==undefined&&(!Array.isArray(round.workIds)||round.workIds.join('|')!==workIds.join('|')))return null;
  const answer = answers[round.id];
  const definition = { ...round, works: workIds.map(id => byId.get(id)) };
  if (!answer || answer.confirmed !== true || !Array.isArray(answer.workIds)||answer.workIds.join('|')!==workIds.join('|')||!answer.positions||Array.isArray(answer.positions)||Object.keys(answer.positions).length!==workIds.length||workIds.some(id=>!Number.isInteger(answer.positions[id]))||answer.roundId!==undefined&&answer.roundId!==round.id||evidence.appealProtocol===APPEAL_PROTOCOL&&!isOverallAppealRound(round)||!validAnswer(definition, answer)) return null;
  const measurementScope=preferenceMeasurementKey(round);
  return { round, index, workIds, answer, measurementScope, signature:measurementScope+'|'+setKey(workIds) };
}
function focusFor(record, band) {
  const ordered = record.workIds.map(id => ({ id, value: record.answer.positions[id] })).sort((a, b) => a.value - b.value || a.id.localeCompare(b.id));
  const first = ordered[0], last = ordered.at(-1), range = last.value - first.value;
  if (range < 20) return null;
  let item;
  if (band === 'relative-high' && last.value - ordered.at(-2).value >= 10) item = last;
  if (band === 'relative-low' && ordered[1].value - first.value >= 10) item = first;
  if (band === 'middle') item = ordered.filter(p => p.value - first.value >= 10 && last.value - p.value >= 10).sort((a, b) => Math.abs(a.value - (last.value + first.value) / 2) - Math.abs(b.value - (last.value + first.value) / 2) || a.id.localeCompare(b.id))[0];
  if (!item) return null;
  return { workId: item.id, band, sourceRoundId: record.round.id, positionWithinSource: item.value, sourceRange: range, comparedWith: ordered.filter(p => p.id !== item.id).map(p => ({ workId: p.id, gap: item.value - p.value })) };
}
function promptSnapshot(record) {
  const r = record.round;
  const evidence = Object.fromEntries(['construct','family','role','setId','batchIndex','journeyRevision','bankRevision','repeatOf','dependencyGroup','appealProtocol','measurementScope'].filter(key => r.evidence[key] !== undefined).map(key => [key, structuredClone(r.evidence[key])]));
  return {
    id: r.id, kind: 'spectrum', criterion: 'preference', title: typeof r.title==='string'?r.title:'Which do you prefer?', hint: typeof r.hint==='string'?r.hint:'Place the works from less preferred to more preferred. Equal positions are fine.',
    ...(r.scale ? { scale: structuredClone(r.scale) } : {}), workIds: [...record.workIds], evidence
  };
}

function directionalHypotheses(records, byId) {
  // Repeated judgements of the same set never manufacture additional source sets.
  const distinct = [...new Map(records.map(r => [r.signature, r])).values()];
  const artists = unique(distinct.flatMap(r => r.workIds).map(id => byId.get(id)).filter(w => w.artistKnown !== false && w.artist && !/unknown|unidentified|anonymous/i.test(w.artist)).map(w => w.artist.trim().toLowerCase()));
  if (distinct.length < 3 || artists.length < 4) return [];
  const cues = FEATURES.flatMap(key => {
    const groups = distinct.flatMap(record => {
      if(literalFeature(key)&&record.workIds.some(id=>!finiteFeature(byId.get(id),key)))return [];
      const observations = pairs(record.workIds).flatMap(([a, b]) => {
        const wa = byId.get(a), wb = byId.get(b), gap = record.answer.positions[a] - record.answer.positions[b];
        if (!finiteFeature(wa, key) || !finiteFeature(wb, key) || Math.abs(gap) < 10) return [];
        const weight=record.measurementScope===APPEAL_PROTOCOL?Math.min(1,Math.abs(gap)/50):1;
        return [Math.sign(gap) * (wa.features[key] - wb.features[key]) * weight];
      });
      return observations.length ? [{ value: mean(observations), record }] : [];
    });
    const featureArtistCount=literalFeature(key)?unique(groups.flatMap(({record})=>record.workIds).map(id=>byId.get(id)).filter(w=>w.artistKnown!==false&&w.artist&&!/unknown|unidentified|anonymous/i.test(w.artist)).map(w=>w.artist.trim().toLowerCase())).length:artists.length;
    const score = mean(groups.map(g => g.value)), direction = Math.sign(score);
    const supporting = groups.filter(g => Math.sign(g.value) === direction && Math.abs(g.value) >= .025);
    if (groups.length < 3 || featureArtistCount < 4 || Math.abs(score) < .035 || supporting.length < 2) return [];
    return [{ feature: key, direction, score, measurementScope:groups[0].record.measurementScope, ...(literalFeature(key)?{featureSemanticVersion:FEATURE_SEMANTIC_VERSION}:{}), supportingRoundIds: supporting.map(g => g.record.round.id), trainingRoundIds: groups.map(g => g.record.round.id), trainingEvidence: groups.map(({record}) => ({ roundId: record.round.id, workIds: [...record.workIds], criterion: 'preference', confirmed: true, measurementScope:record.measurementScope, positions: structuredClone(record.answer.positions), featureValues: Object.fromEntries(record.workIds.filter(id => finiteFeature(byId.get(id), key)).map(id => [id, byId.get(id).features[key]])), ...(literalFeature(key)?{featureSemanticVersions:Object.fromEntries(record.workIds.map(id=>[id,byId.get(id).featureSemanticVersion]))}:{}) })), featureBasis: 'Supplied catalogue descriptors at planning time; only known values are included.', sourceSetCount: groups.length, artistCount: featureArtistCount }];
  });
  return cues.sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || a.feature.localeCompare(b.feature)).map(cue=>({ ...cue,weightBasis:cue.measurementScope===APPEAL_PROTOCOL?'within-set-appeal-gap':'within-set-order-only', method: 'Heuristic average of signed, within-set feature contrasts under one captured measurement scope. One contribution per distinct artwork set. Legacy relative positions supply direction without treating their distance as appeal intensity.', limits: ['The feature was selected after observing earlier choices. Correlated properties, artists and subjects remain alternative explanations.', 'The numerical score is an internal selection weight, not confidence or probability.'] }));
}

export function summarizePreferenceHypotheses({works=[],rounds=[],answers={},measurementScope}={}){
  const byId=new Map(works.map(work=>[work.id,work])),records=rounds.flatMap((round,index)=>{const record=preferenceRecord(round,index,answers,byId);return record&&!round.evidence?.repeatOf&&!['repeat','probe','check','counterexample','heldout','holdout'].includes(round.evidence?.role)?[record]:[];}),scope=measurementScope||(records.some(record=>record.measurementScope===APPEAL_PROTOCOL)?APPEAL_PROTOCOL:records.at(-1)?.measurementScope);
  return directionalHypotheses(records.filter(record=>record.measurementScope===scope),byId);
}

/**
 * Plans preference panels for a later batch. `rounds` must be actual shown
 * definitions in chronological order, never an unshown future plan.
 */
export function planAdaptivePanels({ works, rounds = [], answers = {}, batchIndex = 1, seed = 'art-profile', panelCount = 18, quotas = {}, measurementScope } = {}) {
  const pool = [...new Map((Array.isArray(works) ? works : []).filter(w => isStudyEligibleArtwork(w) && typeof w.id === 'string' && w.id).map(w => [w.id, w])).values()].sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(pool.map(w => [w.id, w]));
  const shown = Array.isArray(rounds) ? rounds : [];
  const answerMap = answers && typeof answers === 'object' ? answers : {};
  const count = boundedInt(panelCount, 18, 0, 200), batch = boundedInt(batchIndex, 1, 0, 100000);
  const minGap = boundedInt(quotas.minRoundGap, 8, 8, 10000);
  const minExplorationShare = Math.max(.6, Math.min(1, Number.isFinite(quotas.minExplorationShare) ? quotas.minExplorationShare : .6));
  const minExplore = Math.ceil(count * minExplorationShare), reservedBudget = count - minExplore;
  const requested = {
    repeat: boundedInt(quotas.exactRepeats, Math.round(count / 6), 0, count),
    recontextualization: boundedInt(quotas.recontextualizations, Math.round(count / 9), 0, count),
    challenge: boundedInt(quotas.challenges, Math.round(count / 9), 0, count)
  };
  const targets = { repeat: 0, recontextualization: 0, challenge: 0 };
  for (let remaining = reservedBudget; remaining > 0;) {
    let added = false;
    for (const role of Object.keys(targets)) if (targets[role] < requested[role] && remaining > 0) { targets[role]++; remaining--; added = true; }
    if (!added) break;
  }
  const exposures = Object.fromEntries(pool.map(w => [w.id, 0])), lastExposure = new Map(), seenPairs = new Set(), unknownExposure = new Set(), unknownExposureRounds = [];
  shown.forEach((r, index) => {
    if (!r || r.unavailable) return;
    const paged=choiceGridExposure(r,answerMap[r.id]);
    const explicitPresented = Array.isArray(r.presentedIds)||!!paged;
    const explicitGroups = Array.isArray(r.coPresentedGroups);
    const presented = unique([...(explicitPresented ? r.presentedIds||paged.presentedIds : roundIds(r)), ...anchorIds(r)]).filter(id => byId.has(id));
    for (const id of presented) { exposures[id]++; lastExposure.set(id, index); }
    const groups = explicitGroups ? r.coPresentedGroups.filter(Array.isArray).map(group => unique(group).filter(id => byId.has(id))) : paged?paged.coPresentedGroups.map(group=>unique(group).filter(id=>byId.has(id))):[presented];
    for (const group of groups) for (const [a, b] of pairs(group)) seenPairs.add(pairKey(a, b));
    const unresolved = unique([...(Array.isArray(r.exposureUnknownWorkIds) ? r.exposureUnknownWorkIds : []), ...(r.kind === 'exercise' && !explicitGroups ? presented : []),...(r.evidence?.explicitFavourites&&!paged&&!explicitPresented?roundIds(r):[])]).filter(id => byId.has(id));
    if (unresolved.length) { unresolved.forEach(id => unknownExposure.add(id)); unknownExposureRounds.push(r.id); }
  });
  const eligible = shown.flatMap((r, index) => { const record = preferenceRecord(r, index, answerMap, byId); return record ? [record] : []; });
  const records = [...new Map(eligible.map(r => [r.signature, r])).values()];
  const delayed = record => {
    const latest = Math.max(...record.workIds.map(id => lastExposure.get(id) ?? record.index));
    const sourceBatch = Number(record.round.evidence?.batchIndex);
    const boundary = Number.isInteger(sourceBatch) && sourceBatch >= 0 && sourceBatch < batch;
    const gap = shown.length - latest - 1;
    return gap >= minGap || boundary ? { minimumRounds: minGap, interveningRoundCount: gap, sourceRoundIndex: record.index, lastArtworkExposureIndex: latest, sourceBatchIndex: Number.isInteger(sourceBatch) ? sourceBatch : null, targetBatchIndex: batch, basis: boundary ? 'later-batch' : 'intervening-shown-rounds' } : null;
  };
  const jitter = (value, salt = '') => hash(`${seed}|${batch}|${salt}|${value}`) / 4294967296;
  const repeatRecords = [], repeatUsed = new Set(), repeatWorks = new Set();
  const repeatBands = ['relative-high', 'relative-low', 'middle'];
  for (let i = 0; i < targets.repeat; i++) {
    const band = repeatBands[(i+Math.max(0,batch-1)) % repeatBands.length];
    const candidates = records.filter(r => delayed(r) && !repeatUsed.has(r.signature) && !r.workIds.some(id => repeatWorks.has(id)));
    candidates.sort((a, b) => (focusFor(b, band) ? 100 : 0) - (focusFor(a, band) ? 100 : 0) || mean(a.workIds.map(id => exposures[id])) - mean(b.workIds.map(id => exposures[id])) || jitter(a.round.id, 'repeat') - jitter(b.round.id, 'repeat'));
    const source = candidates[0];
    if (!source) break;
    repeatUsed.add(source.signature); source.workIds.forEach(id => repeatWorks.add(id));
    repeatRecords.push({ source, band, focus: focusFor(source, band) });
  }
  const roleQueue = [];
  for (let i = 0; i < Math.max(...Object.values(targets), 0); i++) for (const role of Object.keys(targets)) if (i < targets[role]) roleQueue.push(role);
  const slots = new Map();
  roleQueue.forEach((role, i) => {
    const position = count <= 4 ? i + minExplore : 2 + Math.ceil((i + 1) * (count - 3) / (roleQueue.length + 1));
    slots.set(Math.min(count - 1, position), role);
  });
  const reservedUntil = new Map(); let repeatSlot = 0;
  for (const [index, role] of slots) if (role === 'repeat') {
    const record = repeatRecords[repeatSlot++];
    if (record) for (const id of record.source.workIds) reservedUntil.set(id, index);
  }
  const activeMeasurementScope=measurementScope||(eligible.some(record=>record.measurementScope===APPEAL_PROTOCOL)?APPEAL_PROTOCOL:eligible.at(-1)?.measurementScope),modelRecords=eligible.filter(record=>record.measurementScope===activeMeasurementScope);
  const hypothesis = directionalHypotheses(modelRecords, byId)[0]||null, usedPairs = new Set(seenPairs), uses = Object.fromEntries(pool.map(w => [w.id, 0]));
  const lastPlanned = new Map(), panels = [], fallbackReasons = [], usedFocus = new Set();
  let repeatCursor = 0, recontextCursor = 0;
  const available = index => pool.filter(w => !(reservedUntil.get(w.id) > index) && uses[w.id] < 2);
  const novelty = ids => pairs(ids).filter(([a, b]) => !usedPairs.has(pairKey(a, b))).length;
  const freshCost = (work, index) => exposures[work.id] * 3 + uses[work.id] * 12 + (lastPlanned.get(work.id) === index - 1 ? 100 : 0);
  function exploration(index) {
    const picked = [], relaxed = available(index).length < 2;
    const candidates = relaxed ? pool : available(index);
    const size = Math.min(3, candidates.length);
    for (let i = 0; i < size; i++) {
      const rest = candidates.filter(w => !picked.includes(w));
      const spaced=rest.filter(work=>lastPlanned.get(work.id)!==index-1),availableRest=spaced.length?spaced:rest;
      const leastUse=Math.min(...availableRest.map(work=>exposures[work.id]+uses[work.id]*4));
      const ranked=availableRest.filter(work=>exposures[work.id]+uses[work.id]*4===leastUse);
      ranked.sort((a, b) => {
        const score = w => -freshCost(w, index) + recognitionWeight(w) + picked.filter(other => !usedPairs.has(pairKey(w.id, other.id))).length * 5 + picked.filter(other => other.artist !== w.artist).length * .6 + picked.filter(other => other.country !== w.country).length * .3 + jitter(w.id, `explore-${index}`) * .2;
        return score(b) - score(a) || a.id.localeCompare(b.id);
      });
      picked.push(ranked[0]);
    }
    return picked.length >= 2 ? { workIds: picked.map(w => w.id), role: 'exploration', construct: 'preference', selectionReason: 'Prefer less-presented works before recognition tiers, with a four-appearance cost for each use already planned in this block. Among equally used candidates, prefer new pairings and artist and country variety. Exact repeats and diagnostic probes retain their own stimuli. Relative ratings from different sets are not pooled as absolute preference.', evidenceRoundIds: [], exposureCapRelaxed: relaxed,selectionPolicy:'underused-before-recognition-v1' } : null;
  }
  function repeat(index) {
    const selected = repeatRecords[repeatCursor++];
    if (!selected) return null;
    const { source, focus } = selected;
    if (source.workIds.some(id => lastPlanned.has(id) && index - lastPlanned.get(id) - 1 < minGap)) return null;
    return { workIds: [...source.workIds].reverse(), role: 'repeat', construct: 'preference', exactRepeat: true, repeatOf: source.round.id, sourceRoundId: source.round.id, promptSnapshot: promptSnapshot(source), dependencyGroup: source.round.evidence?.dependencyGroup || source.round.evidence?.repeatOf || source.round.evidence?.setId || source.round.id, focus: focus || { band: 'level-or-mixed', sourceRoundId: source.round.id }, delay: delayed(source), selectionReason: focus ? `Repeat the same prompt and complete artwork set after a gap, including a previously ${focus.band.replace('relative-', '')} position. Only presentation order changes.` : 'Repeat the same prompt and artwork set after a gap. No strong high, low or middle position was inferred.', evidenceRoundIds: [source.round.id] };
  }
  function recontextualization(index) {
    const bands = ['relative-high', 'relative-low', 'middle'];
    const band = bands[(recontextCursor++ + Math.max(0, batch - 1) * 2) % bands.length];
    const candidates = records.flatMap(source => {
      const focus = focusFor(source, band);
      return focus && delayed(source) && !usedFocus.has(focus.workId) && !(reservedUntil.get(focus.workId) > index) && uses[focus.workId] < 2 && lastPlanned.get(focus.workId) !== index - 1 ? [{ source, focus }] : [];
    }).sort((a, b) => freshCost(byId.get(a.focus.workId), index) - freshCost(byId.get(b.focus.workId), index) || jitter(a.focus.workId, 'focus') - jitter(b.focus.workId, 'focus'));
    for (const { source, focus } of candidates) {
      const companions = available(index).filter(w => !source.workIds.includes(w.id));
      companions.sort((a, b) => Number(usedPairs.has(pairKey(a.id, focus.workId))) - Number(usedPairs.has(pairKey(b.id, focus.workId))) || freshCost(a, index) - freshCost(b, index) || jitter(a.id, 'companion') - jitter(b.id, 'companion'));
      if (!companions.length) continue;
      usedFocus.add(focus.workId);
      return { workIds: [focus.workId, ...companions.slice(0, 2).map(w => w.id)], role: 'recontextualization', construct: 'preference', focus, delay: delayed(source), selectionReason: `Return to one previously ${band.replace('relative-', '')} work beside different alternatives. This tests a new comparison, not consistency of the original answer.`, evidenceRoundIds: [source.round.id], artworksMayBeFamiliar: true };
    }
    return null;
  }
  function challenge(index) {
    const candidates = pairs(available(index).map(w => w.id)).filter(([a, b]) => !usedPairs.has(pairKey(a, b)) && !unknownExposure.has(a) && !unknownExposure.has(b));
    if (!candidates.length) return null;
    const cue = hypothesis;
    const landmarkPairs=!cue?candidates.filter(workIds=>workIds.every(id=>recognitionTier(byId.get(id))==='landmark')):[];
    const anchoredPairs=!cue?candidates.filter(workIds=>workIds.some(id=>recognitionTier(byId.get(id))==='landmark')):[];
    const scored = (landmarkPairs.length?landmarkPairs:anchoredPairs.length?anchoredPairs:candidates).map(workIds => {
      const [a, b] = workIds.map(id => byId.get(id));
      const complete = cue && finiteFeature(a, cue.feature) && finiteFeature(b, cue.feature);
      const contrast = complete ? Math.abs(a.features[cue.feature] - b.features[cue.feature]) : 0;
      const otherGaps = cue ? FEATURES.filter(k => k !== cue.feature && finiteFeature(a, k) && finiteFeature(b, k)).map(k => Math.abs(a.features[k] - b.features[k])) : [];
      return { workIds, contrast, score: (contrast >= .25 ? contrast * 5 - mean(otherGaps) * 2 : -5) - (freshCost(a, index) + freshCost(b, index)) * .1 + jitter(setKey(workIds), 'challenge') * .1 };
    }).sort((a, b) => b.score - a.score || setKey(a.workIds).localeCompare(setKey(b.workIds)));
    const selected = scored[0], supported = cue && selected.contrast >= .25;
    const predicted = supported ? [...selected.workIds].sort((a, b) => cue.direction * (byId.get(b).features[cue.feature] - byId.get(a).features[cue.feature]) || a.localeCompare(b))[0] : null;
    return { workIds: selected.workIds, role: supported ? 'challenge' : 'exploration', subtype: 'new-comparison', construct: 'preference', comparisonNovel: true, holdoutUnit: 'new-comparison', artworksMayBeFamiliar: true, provisionalHypothesis: supported ? { ...structuredClone(cue), testFeatureValues: Object.fromEntries(selected.workIds.map(id => [id, byId.get(id).features[cue.feature]])), ...(literalFeature(cue.feature)?{testFeatureSemanticVersions:Object.fromEntries(selected.workIds.map(id=>[id,byId.get(id).featureSemanticVersion]))}:{}) } : null, provisionalPrediction: predicted, evidenceRoundIds: supported ? [...cue.trainingRoundIds] : [], selectionReason: supported ? `A previously unshown pair probes the earlier directional pattern for ${cue.feature}. Other visual properties and subjects still differ.` : 'A previously unshown pairing expands coverage. Earlier evidence did not support a feature-direction prediction.' };
  }
  for (let index = 0; index < count && pool.length >= 2; index++) {
    const requestedRole = slots.get(index) || 'exploration';
    let panel = requestedRole === 'repeat' ? repeat(index) : requestedRole === 'recontextualization' ? recontextualization(index) : requestedRole === 'challenge' ? challenge(index) : exploration(index);
    if(panel&&panel.role!==requestedRole&&requestedRole!=='exploration')fallbackReasons.push({panelIndex:index,requestedRole,actualRole:panel.role,reason:requestedRole==='challenge'?'Earlier evidence did not support a reviewed feature-direction prediction; used a new comparison as exploration instead.':panel.selectionReason});
    if (!panel) { if (requestedRole !== 'exploration') fallbackReasons.push({ panelIndex: index, requestedRole, reason: 'No eligible delayed source or safe available comparison; used exploration instead.' }); panel = exploration(index); }
    if (!panel) break;
    panel.panelIndex = index;
    panel.newPairCount = novelty(panel.workIds);
    panel.existingPairCount = pairs(panel.workIds).length - panel.newPairCount;
    panels.push(panel);
    for (const id of panel.workIds) { uses[id]++; lastPlanned.set(id, index); }
    for (const [a, b] of pairs(panel.workIds)) usedPairs.add(pairKey(a, b));
  }
  const actual = Object.fromEntries(['exploration', 'repeat', 'recontextualization', 'challenge'].map(role => [role, panels.filter(p => p.role === role).length]));
  const selectedWorkIds = pool.filter(w => uses[w.id] > 0).map(w => w.id);
  return {
    panels,
    coverage: { catalogueSize: pool.length, requestedPanelCount: count, selectedPanelCount: panels.length, selectedWorkIds, previouslyUnseenSelectedIds: selectedWorkIds.filter(id => exposures[id] === 0), exposureBefore: exposures, exposureUnknownWorkIds: [...unknownExposure].sort(), exposureUnknownRoundIds: unique(unknownExposureRounds), plannedUses: uses, eligiblePreferenceRoundIds: eligible.map(r => r.round.id), distinctPreferenceSetCount: records.length,activeMeasurementScope,modelSourceRoundIds:modelRecords.map(record=>record.round.id),measurementScopes:unique(eligible.map(record=>record.measurementScope)), actualRoles: actual, quotas: { minimumExplorationShare: minExplorationShare, minimumExplorationPanels: minExplore, requested, targets, minimumRoundGap: minGap }, explorationShare: panels.length ? actual.exploration / panels.length : 0, fallbackReasons, shortageReason: pool.length < 2 && count ? 'At least two available artworks are required for a comparison.' : null },
    method: 'Seeded exposure balancing, stratified exact repeats, separate recontextualisation and prospective new-comparison probes. Rankings are compared only within their original sets.',
    limits: [...LIMITS]
  };
}
