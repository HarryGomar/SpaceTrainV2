import {AXES, validAnswer} from './engine.mjs';

export const RESPONSE_ATLAS_VERSION = 1;
export const ATLAS_CLEAR_GAP = 15;

const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const named = value => typeof value === 'string' && value.trim().length > 0;
const unique = values => [...new Set(values)];
const clone = value => structuredClone(value);
const same = (a, b) => a.length === b.length && Array.from(a).every((value, index) => value === b[index]);
const setKey = ids => JSON.stringify([...ids].sort());
const pairs = ids => ids.flatMap((a, i) => ids.slice(i + 1).map(b => [a, b]));
const sourceRole = round => round.evidence?.role || 'legacy';
const text = value => typeof value === 'string' ? value : '';

// Key order is immaterial. Every supplied definition field still contributes.
function canonical(value, path = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {if (!Number.isFinite(value)) throw Error('Nonfinite definition'); return JSON.stringify(value);}
  if ((!plain(value) && !Array.isArray(value)) || path.has(value)) throw Error('Invalid definition');
  const next = new Set(path); next.add(value);
  if (Array.isArray(value)) return '[' + Array.from(value, item => canonical(item, next)).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key], next)).join(',') + '}';
}
function hash(value) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) {result ^= value.charCodeAt(i); result = Math.imul(result, 16777619);}
  return (result >>> 0).toString(36);
}
function axisFor(round, answer) {
  const supplied = Object.hasOwn(round, 'axisDefinition');
  const legacyFeeling = round.id === 'feeling' && answer.axis === 'feeling' && round.axis !== 'feeling';
  if (legacyFeeling && supplied) return null;
  const axisId = legacyFeeling ? 'feeling' : round.axis;
  if (!named(axisId) || answer.axis !== axisId) return null;
  const definition = supplied ? round.axisDefinition : AXES[axisId];
  if (!plain(definition) || !['xName', 'yName', 'left', 'right', 'bottom', 'top'].every(key => named(definition[key]))) return null;
  if (['xWords', 'yWords'].some(key => Object.hasOwn(definition, key) && (!Array.isArray(definition[key]) || !definition[key].length || !Array.from(definition[key]).every(named)))) return null;
  try {
    const signature = canonical({axisId, definition});
    if (Object.hasOwn(answer, 'axisDefinition') && canonical(answer.axisDefinition) !== canonical(definition)) return null;
    return {axisId, axisDefinition: clone(definition), signature, definitionSource: supplied ? 'frozen-round' : 'axis-registry-fallback'};
  } catch {return null;}
}

const featureDefinitions = [
  ['abstraction', 'Abstraction', 'More representational', 'More abstract'],
  ['energy', 'Visual activity', 'Lower visual activity', 'Greater visual activity'],
  ['complexity', 'Compositional density', 'Sparser composition', 'Denser composition'],
  ['humanity', 'Human presence', 'Less human presence', 'More human presence'],
  ['narrative', 'Depicted action', 'Less explicit action', 'More explicit action'],
  ['atmosphere', 'Emphasis on setting', 'Less emphasis on setting', 'More emphasis on setting'],
  ['color', 'Colour intensity', 'More restrained colour', 'More intense colour']
];
function collectionDimensions(works) {
  const result = featureDefinitions.map(([id, title, low, high]) => {
    const values = [], unknownWorkIds = [];
    for (const work of works) {
      const value = work.features?.[id];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {unknownWorkIds.push(work.id); continue;}
      values.push({id: id + ':' + work.id, workId: work.id, value, source: text(work.featureSource) || 'Provisional editorial annotation; source not supplied.', sourceUrl: text(work.sourceUrl) || null});
    }
    return {id, title, kind: 'editorial-feature', domain: [0, 1], low, high, values, unknownWorkIds, provisional: true,
      limits: ['These are coarse editorial descriptions of artworks, not the viewer\'s responses or measured causes of liking.', id === 'color' ? 'Colour intensity is an editorial annotation, not a sampled palette, hue coordinate, or original-object measurement.' : 'Several artwork properties can vary together.']};
  });
  const values = [], unknownWorkIds = [];
  for (const work of works) {
    const range = work.analysis?.yearRange;
    if (!Array.isArray(range) || range.length !== 2 || !range.every(value => typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) || range[0] > range[1]) {unknownWorkIds.push(work.id); continue;}
    values.push({id: 'date:' + work.id, workId: work.id, value: (range[0] + range[1]) / 2, range: [...range], dateLabel: text(work.date), source: text(work.dateSource) || 'Recorded date interval from artwork metadata.', sourceUrl: text(work.sourceUrl) || null, descriptorRevision: text(work.analysis?.revision) || null});
  }
  result.push({id: 'date', title: 'Recorded date', kind: 'date-range', domain: values.length ? [Math.min(...values.map(item => item.range[0])), Math.max(...values.map(item => item.range[1]))] : null,
    low: 'Earlier', high: 'Later', values, unknownWorkIds, provisional: false,
    limits: ['Intervals remain intervals. The midpoint is only a display position, not an exact creation year.', 'Unknown and open-ended dates remain absent. Raw date text is never guessed into a year.', 'A shared date does not establish a shared movement or tradition.']});
  return result;
}

const legacyPreference = new Map([
  ['preferenceRank', ['Which would you choose to look at?', 'Place each work on the scale. Keep all four in mind. Equal positions are fine.']],
  ['closer', ['Which do you prefer?', 'Place both on the same scale. Use the spacing, including equal positions.']],
  ['probe', ['Which do you prefer?', 'A new pair. Use the same scale, including equal positions if they feel equal.']],
  ['lastLook', ['One last comparison.', 'Place both works on the scale, then see your reading.']]
]);
function noBrief(round) {
  return !round.anchorWorks?.length && !round.anchorIds?.length && !round.brief && !round.evidence?.brief && !round.contextMode;
}
function unconditional(round) {
  if (round.kind !== 'spectrum' || round.criterion !== 'preference' || round.evidence?.unconditional === false || !noBrief(round)) return false;
  const construct = round.evidence?.construct, family = round.evidence?.family;
  if (construct !== undefined) return construct === 'preference' && (!family || ['individual-choice', 'feature-check'].includes(family));
  const legacy = legacyPreference.get(round.id);
  return !family && !!legacy && legacy[0] === round.title && legacy[1] === round.hint && !Object.hasOwn(round, 'scale');
}
function curiosity(round) {
  if (round.kind !== 'spectrum' || round.criterion !== 'interest' || !noBrief(round)) return false;
  return round.evidence?.construct === 'curiosity' || !round.evidence?.construct && !round.evidence?.family && round.id === 'interestRank' && round.title === 'Which would you like to understand?' && round.hint === 'Same four works. This time, further right means more curious.' && !Object.hasOwn(round, 'scale');
}

function validEntries(works, rounds, answers) {
  const lookup = new Map(works.map(work => [work.id, work])), counts = new Map(), entries = [], excluded = [];
  for (const round of rounds) if (named(round?.id)) counts.set(round.id, (counts.get(round.id) || 0) + 1);
  for (const raw of rounds) {
    if (!plain(raw) || !['grid', 'spectrum', 'choice-grid'].includes(raw.kind)) continue;
    const fail = reason => excluded.push({roundId: text(raw.id) || null, reason});
    if (!named(raw.id) || counts.get(raw.id) !== 1 || raw.unavailable) {fail('unavailable-or-ambiguous-round'); continue;}
    let offered;
    if (Array.isArray(raw.works)) {
      if (!Array.from(raw.works).every(work => plain(work) && named(work.id))) {fail('invalid-work-identity'); continue;}
      offered = raw.works.map(work => work.id);
      if (Object.hasOwn(raw, 'workIds') && (!Array.isArray(raw.workIds) || !same(offered, raw.workIds))) {fail('conflicting-frozen-work-identities'); continue;}
    } else offered = raw.workIds;
    if (!Array.isArray(offered) || !offered.length || !Array.from(offered).every(named) || new Set(offered).size !== offered.length || offered.some(id => !lookup.has(id))) {fail('unknown-or-duplicate-work-identity'); continue;}
    const answer = Object.hasOwn(answers, raw.id) ? answers[raw.id] : null;
    if (!plain(answer) || answer.confirmed !== true || answer.skipped || !Array.isArray(answer.workIds) || !same(answer.workIds, offered) || Object.hasOwn(answer, 'roundId') && answer.roundId !== raw.id) {fail('missing-unconfirmed-or-mismatched-answer'); continue;}
    if (raw.kind === 'spectrum' && !plain(answer.positions) || raw.kind === 'grid' && !plain(answer.points)) {fail('invalid-response-dictionary'); continue;}
    if (raw.kind === 'grid' && Object.values(answer.points).some(point => !Array.isArray(point) || point.length !== 2 || !Array.from(point).every(value => Number.isInteger(value) && value >= 0 && value <= 100))) {fail('invalid-grid-coordinate'); continue;}
    const round = {...raw, works: offered.map(id => lookup.get(id))};
    let valid = false;
    try {valid = validAnswer(round, answer);} catch {}
    if (!valid) {fail('invalid-answer'); continue;}
    const axis = raw.kind === 'grid' ? axisFor(round, answer) : null;
    if (raw.kind === 'grid' && !axis) {fail('missing-or-conflicting-axis-definition'); continue;}
    entries.push({round, answer, offered: [...offered], axis});
  }
  return {entries, excluded};
}

function personalMaps(entries) {
  const groups = new Map();
  for (const {round, answer, offered, axis} of entries.filter(entry => entry.round.kind === 'grid')) {
    if (!groups.has(axis.signature)) groups.set(axis.signature, {id: 'reported-' + axis.axisId + '-' + hash(axis.signature), title: axis.axisDefinition.xName + ' and ' + axis.axisDefinition.yName,
      kind: 'reported-grid', ...clone(axis), domain: [0, 100], coordinates: {x: 'left-to-right', y: 'bottom-to-top'}, points: [], sourceRoundIds: [], questionDefinitions: [],
      limits: ['Every point is one recorded response under the displayed axes. Repeated works remain separate points.', 'Sharing axes does not make different sets, contexts, or repeated responses independent. No points are averaged and no latent taste dimensions are inferred.']});
    const group = groups.get(axis.signature);
    group.sourceRoundIds.push(round.id);
    group.questionDefinitions.push({roundId: round.id, title: text(round.title), hint: text(round.hint), workIds: [...offered], construct: text(round.evidence?.construct) || null, definitionSource: axis.definitionSource});
    for (const workId of offered) group.points.push({id: round.id + ':' + workId, workId, x: answer.points[workId][0], y: answer.points[workId][1], roundId: round.id, roundTitle: text(round.title), sourceRole: sourceRole(round)});
  }
  return [...groups.values()];
}

function components(nodes, edges, prefix) {
  const adjacency = new Map(nodes.map(node => [node.id, new Set()]));
  for (const edge of edges) {adjacency.get(edge.source).add(edge.target); adjacency.get(edge.target).add(edge.source);}
  const seen = new Set(), result = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const queue = [node.id], workIds = [];
    while (queue.length) {const id = queue.pop(); if (seen.has(id)) continue; seen.add(id); workIds.push(id); queue.push(...adjacency.get(id));}
    workIds.sort();
    const member = new Set(workIds), local = edges.filter(edge => member.has(edge.source) && member.has(edge.target));
    result.push({id: prefix + '-' + hash(setKey(workIds)), workIds, nodeIds: [...workIds], edgeIds: local.map(edge => edge.id), sourceRoundIds: unique(nodes.filter(item => member.has(item.id)).flatMap(item => item.sourceRoundIds))});
  }
  return result;
}
function preferenceGraph(entries, works) {
  const prefs = entries.filter(entry => unconditional(entry.round)), byWork = new Map(works.map(work => [work.id, work])), nodeMap = new Map(), edges = [], comparisons = [];
  for (const {round, answer, offered} of prefs) {
    for (const workId of offered) {
      if (!nodeMap.has(workId)) nodeMap.set(workId, {id: workId, workId, title: text(byWork.get(workId)?.title), sourceRoundIds: []});
      nodeMap.get(workId).sourceRoundIds.push(round.id);
    }
    for (const [a, b] of pairs(offered)) {
      const gap = Math.abs(answer.positions[a] - answer.positions[b]), winner = answer.positions[a] > answer.positions[b] ? a : b, loser = winner === a ? b : a;
      const observation = {id: round.id + ':' + JSON.stringify([a, b]), source: a, target: b, workIds: [a, b], positions: {[a]: answer.positions[a], [b]: answer.positions[b]}, gap,
        relation: gap >= ATLAS_CLEAR_GAP ? 'clear-preference' : gap === 0 ? 'tie' : 'near-tie', roundId: round.id, sourceRoundIds: [round.id], roundTitle: text(round.title), setId: text(round.evidence?.setId) || setKey(offered), sourceRole: sourceRole(round)};
      comparisons.push(observation);
      if (gap >= ATLAS_CLEAR_GAP) edges.push({...observation, source: winner, target: loser, winnerId: winner, loserId: loser});
    }
  }
  const nodes = [...nodeMap.values()], groups = components(nodes, edges, 'clear'), comparisonComponents = components(nodes, comparisons, 'compared');
  for (const node of nodes) {node.componentId = groups.find(group => group.workIds.includes(node.id)).id; node.comparisonComponentId = comparisonComponents.find(group => group.workIds.includes(node.id)).id;}
  return {nodes, edges, comparisons, components: groups, comparisonComponents, connected: nodes.length > 0 && groups.length === 1, comparisonConnected: nodes.length > 0 && comparisonComponents.length === 1,
    clearGap: ATLAS_CLEAR_GAP, sourceRoundIds: prefs.map(entry => entry.round.id), globalRanking: null,
    limits: ['Edges point from a higher placement to a lower placement within one unconditional preference answer, with a gap of at least 15. The threshold is a display rule, not statistical significance.',
      'Components use undirected clear-preference links. comparisonComponents additionally retains co-comparisons with equal or close placements.',
      'Repeated or opposing edges remain separate observations with their original source. Pair counts are not independent evidence counts.',
      'There is no fitted global ranking or global taste distance. Disconnected groups cannot be aligned using these comparisons alone. Even a connected graph needs explicit modelling assumptions before estimating a global ordering.']};
}

function spectrumQuestion(round) {
  return {roundId: round.id, title: text(round.title), hint: text(round.hint), criterion: round.criterion, scale: plain(round.scale) ? clone(round.scale) : null, construct: text(round.evidence?.construct) || null};
}
function matchedPanels(entries) {
  const prefs = entries.filter(entry => unconditional(entry.round)), interests = entries.filter(entry => curiosity(entry.round)), result = [];
  for (const pref of prefs) for (const interest of interests) {
    if (setKey(pref.offered) !== setKey(interest.offered)) continue;
    const x = spectrumQuestion(pref.round), y = spectrumQuestion(interest.round), definition = {xName: 'Preference', yName: 'Curiosity', left: text(x.scale?.left) || 'Less preferred', right: text(x.scale?.right) || 'More preferred', bottom: text(y.scale?.left) || 'Less curious', top: text(y.scale?.right) || 'More curious'};
    result.push({id: 'paired-' + pref.round.id + '-' + interest.round.id, kind: 'matched-preference-curiosity', title: 'Preference and curiosity', axisId: 'preference-curiosity', axisDefinition: definition,
      signature: canonical({x, y, workIds: [...pref.offered].sort()}), domain: [0, 100], coordinates: {x: 'left-to-right', y: 'bottom-to-top'}, sourceRoundIds: [pref.round.id, interest.round.id], questionDefinitions: [x, y], workIds: [...pref.offered],
      points: pref.offered.map(workId => ({id: pref.round.id + ':' + interest.round.id + ':' + workId, workId, x: pref.answer.positions[workId], y: interest.answer.positions[workId], roundId: pref.round.id, roundTitle: text(pref.round.title), preferenceRoundId: pref.round.id, curiosityRoundId: interest.round.id, sourceRoundIds: [pref.round.id, interest.round.id]})),
      limits: ['Both valid responses concern exactly the same artwork set. Original positions and question wording are retained.', 'Each panel uses one preference response and one curiosity response. Different sets and repeated panels are not pooled, averaged, or independent replications.', 'The order of the two questions is retained in source identities, without treating order as a causal effect.']});
  }
  return result;
}
function choiceObservations(entries) {
  return entries.filter(entry => entry.round.kind === 'choice-grid').map(({round, answer, offered}) => ({id: 'choices-' + round.id, roundId: round.id, roundTitle: text(round.title), mode: round.selectionMode, selectionMode: round.selectionMode,
    offeredIds: [...offered], selectedIds: [...answer.selectedIds], unselectedIds: offered.filter(id => !answer.selectedIds.includes(id)), explicitNone: answer.explicitNone === true, unsure: answer.unsure === true,
    unknownWorkIds: answer.unsure === true ? [...offered] : [], sourceRoundIds: [round.id],
    limits: ['This is an unranked choice under its original prompt. Unselected paintings are not assigned low preference or response coordinates.', round.selectionMode === 'familiarity' ? 'Familiarity claims and unsure responses remain separate from preference and expertise.' : 'A shortlist is not a ranking of selected or unselected works.']}));
}

/** Build display data only. No embeddings, missing-response imputation, or inferred personality scores. */
export function buildResponseAtlas({works = [], rounds = [], answers = {}, records = []} = {}) {
  works = Array.isArray(works) ? works : []; rounds = Array.isArray(rounds) ? rounds : []; answers = plain(answers) ? answers : {};
  const counts = new Map(); for (const work of works) if (plain(work) && named(work.id)) counts.set(work.id, (counts.get(work.id) || 0) + 1);
  const validWorks = works.filter(work => plain(work) && named(work.id) && counts.get(work.id) === 1), {entries, excluded} = validEntries(validWorks, rounds, answers);
  const maps = personalMaps(entries), graph = preferenceGraph(entries, validWorks), panels = matchedPanels(entries), choices = choiceObservations(entries);
  return {version: RESPONSE_ATLAS_VERSION, dimensions: collectionDimensions(validWorks), maps, graph, matchedPanels: panels, choices,
    coverage: {catalogueWorks: validWorks.length, excludedCatalogueEntries: works.length - validWorks.length, roundsSeen: rounds.length, validGridRounds: entries.filter(entry => entry.round.kind === 'grid').length,
      gridPoints: maps.reduce((sum, map) => sum + map.points.length, 0), validPreferenceRounds: graph.sourceRoundIds.length, validCuriosityRounds: entries.filter(entry => curiosity(entry.round)).length,
      validChoiceGrids: choices.length, matchedPanels: panels.length, clearPreferenceObservations: graph.edges.length, tiedComparisons: graph.comparisons.filter(item => item.relation === 'tie').length,
      nearTiedComparisons: graph.comparisons.filter(item => item.relation === 'near-tie').length, excludedRounds: excluded, arrangementRecordsSupplied: Array.isArray(records) ? records.length : 0, arrangementRecordsUsed: 0},
    limits: ['Collection dimensions describe artwork metadata. Personal maps describe reported responses. They are separate coordinate systems.', 'The caller must supply the saved catalogue and frozen question definitions for the history being displayed.', 'Arrangement records are outside this response atlas. Room and sorting evidence belongs to its original geometry and instrument.']};
}
