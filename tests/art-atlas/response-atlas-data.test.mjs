import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildResponseAtlas, ATLAS_CLEAR_GAP} from '../../public/art-atlas/response-atlas-data.mjs';
import {AXES, buildRounds} from '../../public/art-atlas/engine.mjs';

const works = Array.from({length: 8}, (_, i) => ({id: 'w' + i, title: 'Work ' + i, artist: 'Artist ' + i, sourceUrl: 'https://museum.example/' + i, features: {abstraction: i / 10, energy: i / 10}, featureSource: 'Provisional test annotation', date: String(1800 + i), analysis: {yearRange: [1800 + i, 1800 + i], revision: 'test'}}));
const art = ids => ids.map(id => works.find(work => work.id === id));
const spectrum = (id, ids, construct = 'preference', extra = {}) => ({id, title: 'Original ' + id, hint: 'Original instruction', kind: 'spectrum', criterion: construct === 'curiosity' ? 'interest' : 'preference', works: art(ids), evidence: {construct, family: construct === 'curiosity' ? 'interest' : 'individual-choice', role: 'discovery'}, ...extra});
const spectrumAnswer = (round, values) => ({workIds: round.works.map(work => work.id), criterion: round.criterion, positions: Object.fromEntries(round.works.map((work, i) => [work.id, values[i]])), confirmed: true});
const grid = (id, ids = ['w0', 'w1'], extra = {}) => ({id, title: 'Map ' + id, hint: 'Original map instruction', kind: 'grid', axis: 'response', works: art(ids), ...extra});
const gridAnswer = (round, points = [[0, 100], [100, 0]]) => ({workIds: round.works.map(work => work.id), axis: round.axis, points: Object.fromEntries(round.works.map((work, i) => [work.id, points[i]])), confirmed: true});
const build = (rounds = [], answers = {}, extra = {}) => buildResponseAtlas({works, rounds, answers, ...extra});

test('An explicit conditional-choice flag excludes a preference-shaped question from the graph',()=>{
  const round=spectrum('conditional',['w0','w1','w2','w3']);round.evidence.unconditional=false;
  const result=build([round],{conditional:spectrumAnswer(round,[100,70,30,0])});
  assert.deepEqual(result.graph.edges,[]);assert.deepEqual(result.graph.nodes,[]);assert.equal(result.graph.globalRanking,null);
});

test('Editorial zero is known, while missing, string, nonfinite, and out-of-range attributes stay unknown', () => {
  const pool = structuredClone(works.slice(0, 5));
  pool[0].features.abstraction = 0;
  delete pool[1].features.abstraction;
  pool[2].features.abstraction = '0.5';
  pool[3].features.abstraction = NaN;
  pool[4].features.abstraction = 1.2;
  const dimension = build([], {}, {works: pool}).dimensions.find(item => item.id === 'abstraction');
  assert.deepEqual(dimension.values.map(item => [item.workId, item.value]), [['w0', 0]]);
  assert.deepEqual(dimension.unknownWorkIds, ['w1', 'w2', 'w3', 'w4']);
  assert.equal(dimension.provisional, true);
  assert.match(dimension.values[0].source, /Provisional/);
});

test('Dates retain actual intervals and raw labels without guessing open dates into exact years', () => {
  const pool = structuredClone(works.slice(0, 5));
  pool[0].analysis.yearRange = [-300, -200]; pool[0].date = 'Third century BCE';
  pool[1].analysis.yearRange = [1915, 1926]; pool[1].date = 'c. 1915–26';
  pool[2].analysis.yearRange = null; pool[2].date = 'after 1490';
  pool[3].analysis.yearRange = ['1900', '1901'];
  pool[4].analysis.yearRange = [1901, 1900];
  const dimension = build([], {}, {works: pool}).dimensions.find(item => item.id === 'date');
  assert.deepEqual(dimension.domain, [-300, 1926]);
  assert.deepEqual(dimension.values.map(item => [item.value, item.range, item.dateLabel]), [[-250, [-300, -200], 'Third century BCE'], [1920.5, [1915, 1926], 'c. 1915–26']]);
  assert.deepEqual(dimension.unknownWorkIds, ['w2', 'w3', 'w4']);
  assert.equal(build([], {}, {works: [{id: 'unknown', date: '1900'}]}).dimensions.find(item => item.id === 'date').domain, null);
});

test('Maps retain original coordinates, original axis names, source questions, and repeated-work responses', () => {
  const a = grid('a'), b = grid('b'), answers = {a: gridAnswer(a), b: gridAnswer(b, [[80, 20], [30, 70]])};
  const result = build([a, b], answers), map = result.maps[0];
  assert.equal(result.maps.length, 1);
  assert.equal(map.axisDefinition.top, 'Absorbed');
  assert.equal(map.axisDefinition.bottom, 'Unmoved');
  assert.deepEqual(map.points.map(point => [point.id, point.workId, point.x, point.y, point.roundTitle]), [['a:w0', 'w0', 0, 100, 'Map a'], ['a:w1', 'w1', 100, 0, 'Map a'], ['b:w0', 'w0', 80, 20, 'Map b'], ['b:w1', 'w1', 30, 70, 'Map b']]);
  assert.deepEqual(map.sourceRoundIds, ['a', 'b']);
  assert.deepEqual(map.coordinates, {x: 'left-to-right', y: 'bottom-to-top'});
});

test('A complete frozen definition takes precedence, and every changed field separates map instruments', () => {
  const original = structuredClone(AXES.response), changed = {...original, top: 'Would return'}, metadataChanged = {...original, revision: 'another-version'};
  const a = grid('a', ['w0', 'w1'], {axisDefinition: original}), b = grid('b', ['w0', 'w1'], {axisDefinition: changed}), c = grid('c', ['w0', 'w1'], {axisDefinition: Object.fromEntries(Object.entries(original).reverse())}), d = grid('d', ['w0', 'w1'], {axisDefinition: metadataChanged});
  const result = build([a, b, c, d], Object.fromEntries([a, b, c, d].map(round => [round.id, gridAnswer(round)])));
  assert.equal(result.maps.length, 3);
  assert.deepEqual(result.maps.find(map => map.axisDefinition.top === 'Absorbed' && !map.axisDefinition.revision).sourceRoundIds, ['a', 'c']);
  assert.deepEqual(result.maps.find(map => map.axisDefinition.top === 'Would return').sourceRoundIds, ['b']);
  assert.ok(result.maps.every(map => map.definitionSource === 'frozen-round'));
});

test('New axis IDs work with complete frozen definitions, while invalid definitions never fall back silently', () => {
  const custom = grid('custom', ['w0', 'w1'], {axis: 'achievement', axisDefinition: {xName: 'Making', yName: 'Admiration', left: 'Little visible control', right: 'Much visible control', bottom: 'Little admiration', top: 'Strong admiration'}});
  assert.equal(build([custom], {custom: gridAnswer(custom)}).maps[0].axisId, 'achievement');
  for (const definition of [null, {}, {...AXES.response, top: ''}, {...AXES.response, xWords: [null]}]) {
    const round = grid('bad', ['w0', 'w1'], {axisDefinition: definition});
    assert.deepEqual(build([round], {bad: gridAnswer(round)}).maps, []);
  }
  const missing = grid('missing', ['w0', 'w1'], {axis: 'not-registered'});
  assert.deepEqual(build([missing], {missing: gridAnswer(missing)}).maps, []);
});

test('Invalid identities, incomplete dictionaries, wrong axes, and unconfirmed grids create no points', () => {
  const round = grid('a'), good = gridAnswer(round);
  for (const mutate of [answer => answer.confirmed = false, answer => answer.skipped = true, answer => answer.workIds.reverse(), answer => answer.axis = 'feeling', answer => delete answer.points.w0, answer => answer.points.w0 = [null, 50], answer => answer.points.w0 = [NaN, 50], answer => answer.points.unknown = [50, 50], answer => answer.roundId = 'another', answer => answer.axisDefinition = AXES.feeling]) {
    const answer = structuredClone(good); mutate(answer);
    assert.equal(build([round], {a: answer}).coverage.gridPoints, 0);
  }
  assert.deepEqual(build([round, structuredClone(round)], {a: good}).maps, []);
  assert.deepEqual(build([{...round, works: [...round.works, round.works[0]]}], {a: good}).maps, []);
  assert.deepEqual(build([{...round, workIds: ['w1', 'w0']}], {a: good}).maps, []);
  assert.deepEqual(build([round], {a: good}, {works: works.filter(work => work.id !== 'w0')}).maps, []);
});

test('Serialized frozen rounds can resolve their exact work IDs without changing their axis definition', () => {
  const round = grid('a', ['w0', 'w1'], {axisDefinition: AXES.feeling}), answer = gridAnswer(round), snapshot = {...round, workIds: ['w0', 'w1']}; delete snapshot.works;
  const result = build([snapshot], {a: answer});
  assert.deepEqual(result.maps[0].axisDefinition, AXES.feeling);
  assert.deepEqual(result.maps[0].points.map(point => point.workId), ['w0', 'w1']);
});

test('Clear graph edges use only within-set gaps at the threshold, retaining ties and near ties separately', () => {
  const a = spectrum('a', ['w0', 'w1', 'w2']), b = spectrum('b', ['w3', 'w4']);
  const result = build([a, b], {a: spectrumAnswer(a, [100, 85, 85]), b: spectrumAnswer(b, [14, 0])});
  assert.equal(ATLAS_CLEAR_GAP, 15);
  assert.deepEqual(result.graph.edges.map(edge => [edge.source, edge.target, edge.gap, edge.roundId]), [['w0', 'w1', 15, 'a'], ['w0', 'w2', 15, 'a']]);
  assert.equal(result.coverage.tiedComparisons, 1);
  assert.equal(result.coverage.nearTiedComparisons, 1);
  assert.equal(result.graph.components.length, 3);
  assert.equal(result.graph.comparisonComponents.length, 2);
  assert.equal(result.graph.connected, false);
  assert.equal(result.graph.globalRanking, null);
  assert.ok(result.graph.edges.every(edge => edge.workIds.every(id => ['w0', 'w1', 'w2'].includes(id))));
});

test('Opposing repeats remain two actual observations, with no cancellation or average ranking', () => {
  const a = spectrum('a', ['w0', 'w1']), b = spectrum('b', ['w1', 'w0'], 'preference', {evidence: {construct: 'preference', family: 'individual-choice', role: 'repeat', repeatOf: 'a'}});
  const result = build([a, b], {a: spectrumAnswer(a, [80, 20]), b: spectrumAnswer(b, [90, 10])});
  assert.deepEqual(result.graph.edges.map(edge => [edge.source, edge.target, edge.sourceRole]), [['w0', 'w1', 'discovery'], ['w1', 'w0', 'repeat']]);
  assert.equal(result.graph.components.length, 1);
  assert.equal(result.graph.connected, true);
  assert.equal(result.graph.globalRanking, null);
  assert.deepEqual(result.graph.nodes[0].sourceRoundIds, ['a', 'b']);
});

test('Context, appraisals, anchors, familiarity, and saves never become unconditional preference graph edges', () => {
  const rounds = [spectrum('first', ['w0', 'w1'], 'first-stop', {evidence: {construct: 'first-stop', family: 'contextual-choice'}}), spectrum('making', ['w0', 'w1'], 'attention-to-making', {evidence: {construct: 'attention-to-making', family: 'looking-appraisal'}}), spectrum('anchor', ['w0', 'w1'], 'preference', {anchorIds: ['w2']}), spectrum('brief', ['w0', 'w1'], 'preference', {evidence: {construct: 'preference', brief: 'For your bedroom'}})];
  const result = build(rounds, Object.fromEntries(rounds.map(round => [round.id, spectrumAnswer(round, [100, 0])])), {records: [{kind: 'curate', placements: {w0: {wallId: 'x', t: 0}}}]});
  assert.deepEqual(result.graph.nodes, []);
  assert.deepEqual(result.graph.edges, []);
  assert.equal(result.coverage.arrangementRecordsUsed, 0);
});

test('A new within-set bridge connects comparison components, without inventing links from common numerical positions', () => {
  const a = spectrum('a', ['w0', 'w1']), b = spectrum('b', ['w2', 'w3']), bridge = spectrum('bridge', ['w1', 'w2']);
  const answers = {a: spectrumAnswer(a, [100, 0]), b: spectrumAnswer(b, [100, 0]), bridge: spectrumAnswer(bridge, [100, 0])};
  assert.equal(build([a, b], answers).graph.comparisonComponents.length, 2);
  const result = build([a, b, bridge], answers);
  assert.equal(result.graph.comparisonComponents.length, 1);
  assert.equal(result.graph.components.length, 1);
  assert.equal(result.graph.edges.length, 3);
  assert.ok(!result.graph.edges.some(edge => edge.source === 'w0' && edge.target === 'w3'));
});

test('Matching preference and curiosity uses exact artwork sets in either task order and keeps original labels', () => {
  const pref = spectrum('pref', ['w0', 'w1', 'w2'], 'preference', {scale: {left: 'Less preferred', right: 'More preferred'}}), interest = spectrum('interest', ['w2', 'w1', 'w0'], 'curiosity', {scale: {left: 'Little wish to investigate', right: 'Strong wish to investigate'}});
  const result = build([interest, pref], {pref: spectrumAnswer(pref, [90, 50, 10]), interest: spectrumAnswer(interest, [90, 50, 10])}), panel = result.matchedPanels[0];
  assert.equal(result.matchedPanels.length, 1);
  assert.deepEqual(panel.points.map(point => [point.workId, point.x, point.y]), [['w0', 90, 10], ['w1', 50, 50], ['w2', 10, 90]]);
  assert.equal(panel.axisDefinition.top, 'Strong wish to investigate');
  assert.deepEqual(panel.sourceRoundIds, ['pref', 'interest']);
  assert.ok(panel.points.every(point => sameIds(point.sourceRoundIds, ['pref', 'interest'])));
});
const sameIds = (a, b) => JSON.stringify(a) === JSON.stringify(b);

test('No partial-set matching, missing-response imputation, or changed construct disguised as interest', () => {
  const pref = spectrum('pref', ['w0', 'w1', 'w2']), interest = spectrum('interest', ['w0', 'w1'], 'curiosity'), appraisal = spectrum('appraisal', ['w0', 'w1', 'w2'], 'curiosity', {evidence: {construct: 'something-else', family: 'appraisal'}});
  const answers = {pref: spectrumAnswer(pref, [90, 50, 10]), interest: spectrumAnswer(interest, [0, 100]), appraisal: spectrumAnswer(appraisal, [0, 50, 100])};
  assert.deepEqual(build([pref, interest, appraisal], answers).matchedPanels, []);
  const exact = spectrum('exact', ['w0', 'w1', 'w2'], 'curiosity');
  const incomplete = spectrumAnswer(exact, [0, 50, 100]); delete incomplete.positions.w0;
  assert.deepEqual(build([pref, exact], {...answers, exact: incomplete}).matchedPanels, []);
});

test('Repeated matched sets produce separately sourced panels rather than averaging their coordinates', () => {
  const p1 = spectrum('p1', ['w0', 'w1']), p2 = spectrum('p2', ['w0', 'w1']), c = spectrum('c', ['w0', 'w1'], 'curiosity');
  const result = build([p1, c, p2], {p1: spectrumAnswer(p1, [100, 0]), p2: spectrumAnswer(p2, [20, 80]), c: spectrumAnswer(c, [0, 100])});
  assert.equal(result.matchedPanels.length, 2);
  assert.deepEqual(result.matchedPanels.map(panel => panel.points.find(point => point.workId === 'w0').x), [100, 20]);
});

test('Choice-grid unsure remains unknown and shortlist choices do not create ranked graph or map data', () => {
  const familiar = {id: 'known', title: 'Seen these?', kind: 'choice-grid', selectionMode: 'familiarity', works: art(['w0', 'w1'])}, shortlist = {...familiar, id: 'keep', selectionMode: 'shortlist', maxChoices: 1};
  const answers = {known: {workIds: ['w0', 'w1'], selectionMode: 'familiarity', selectedIds: [], explicitNone: false, unsure: true, confirmed: true}, keep: {workIds: ['w0', 'w1'], selectionMode: 'shortlist', selectedIds: ['w0'], explicitNone: false, unsure: false, confirmed: true}};
  const result = build([familiar, shortlist], answers);
  assert.deepEqual(result.choices[0].unknownWorkIds, ['w0', 'w1']);
  assert.deepEqual(result.choices[1].selectedIds, ['w0']);
  assert.deepEqual(result.graph.nodes, []);
  assert.deepEqual(result.maps, []);
  assert.deepEqual(result.matchedPanels, []);
  assert.equal(build([familiar], {known: {...answers.known, selectedIds: ['unknown']}}).choices.length, 0);
});

test('Current real catalogue and legacy core instruments preserve identities without live annotation imputation', () => {
  const actual = JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json', import.meta.url), 'utf8')), rounds = buildRounds(actual), pref = rounds.find(round => round.id === 'preferenceRank'), interest = rounds.find(round => round.id === 'interestRank'), map = rounds.find(round => round.id === 'feeling');
  const answers = {preferenceRank: spectrumAnswer(pref, [100, 60, 20, 0]), interestRank: spectrumAnswer(interest, [0, 20, 60, 100]), feeling: gridAnswer(map, [[0, 0], [25, 25], [75, 75], [100, 100]])}, result = buildResponseAtlas({works: actual, rounds: [pref, interest, map], answers});
  assert.equal(result.graph.nodes.length, 4);
  assert.equal(result.matchedPanels.length, 1);
  assert.equal(result.maps[0].points.length, 4);
  assert.ok(result.dimensions.find(dimension => dimension.id === 'date').unknownWorkIds.includes('shen-clouds'));
  assert.ok(result.graph.nodes.every(node => actual.some(work => work.id === node.workId)));
});

test('Ambiguous duplicate catalogue identities and malformed top-level data are rejected without throwing', () => {
  const round = grid('a'), result = build([round], {a: gridAnswer(round)}, {works: [...works, structuredClone(works[0])]});
  assert.equal(result.coverage.excludedCatalogueEntries, 2);
  assert.deepEqual(result.maps, []);
  assert.doesNotThrow(() => buildResponseAtlas({works: null, rounds: 'broken', answers: [], records: null}));
});

test('Sparse coordinates and sparse frozen definitions never become undefined plotted positions', () => {
  const round = grid('a'), answer = gridAnswer(round); answer.points.w0 = new Array(2); answer.points.w0[1] = 50;
  assert.deepEqual(build([round], {a: answer}).maps, []);
  const brokenDefinition = {...AXES.response, xWords: new Array(5)}, broken = {...round, axisDefinition: brokenDefinition};
  assert.deepEqual(build([broken], {a: gridAnswer(round)}).maps, []);
});

test('Legacy unconditional fallback rejects changed instructions and the old feeling shortcut retains actual labels', () => {
  const actual = JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json', import.meta.url), 'utf8')), rounds = buildRounds(actual), pref = rounds.find(round => round.id === 'preferenceRank'), answer = spectrumAnswer(pref, [100, 60, 20, 0]);
  assert.deepEqual(buildResponseAtlas({works: actual, rounds: [{...pref, hint: 'Choose for your bedroom.'}], answers: {preferenceRank: answer}}).graph.nodes, []);
  const legacy = grid('feeling'), saved = {...gridAnswer(legacy), axis: 'feeling'};
  assert.equal(build([legacy], {feeling: saved}).maps[0].axisDefinition.yName, 'Activation');
  assert.deepEqual(build([{...legacy, axisDefinition: AXES.response}], {feeling: saved}).maps, []);
});

test('The atlas is deterministic and cannot mutate the saved history through its output', () => {
  const a = grid('a', ['w0', 'w1'], {axisDefinition: AXES.response}), b = spectrum('b', ['w0', 'w1']), input = {works: structuredClone(works), rounds: structuredClone([a, b]), answers: {a: gridAnswer(a), b: spectrumAnswer(b, [100, 0])}}, before = structuredClone(input), first = buildResponseAtlas(input), second = buildResponseAtlas(input);
  assert.deepEqual(first, second);
  first.maps[0].axisDefinition.top = 'Changed'; first.dimensions[0].values[0].value = .9; first.graph.edges[0].positions.w0 = 2;
  assert.deepEqual(input, before);
});
