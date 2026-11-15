import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRounds, buildProfile, pruneAfter, validAnswer, sanitizeDraft, validPoint, FORMATS, FEATURES, ROUND_IDS, preferenceTasks, fitPreference, preferredId, correctOption, matchResults, STATEMENTS } from '../../public/art-atlas/engine.mjs';
import { visualHypotheses } from '../../public/art-atlas/profile.mjs';
const works = JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json', import.meta.url), 'utf8'));
function session(pool = works, direction = 1, reverseInterest = true) {
  const answers = {}, score = w => direction * (w.features.energy + .2 * w.features.color);
  for (let i = 0; i < ROUND_IDS.length; i++) {
    const r = buildRounds(pool, answers)[i], sorted = [...r.works].sort((a, b) => score(b) - score(a));
    if(r.id==='feeling')r.axis='feeling';
    const a = { workId: r.works[0].id, workIds: r.works.map(w => w.id) };
    if (r.kind === 'spectrum') {
      if (r.criterion === 'interest' && reverseInterest) sorted.reverse();
      Object.assign(a, { criterion: r.criterion, positions: Object.fromEntries(sorted.map((w, i) => [w.id, Math.round((1 - i / (sorted.length - 1)) * 20) * 5])), confirmed: true });
    }
    if (r.kind === 'grid') Object.assign(a, { axis: r.axis, points: Object.fromEntries(r.works.map(w => [w.id, [Math.round(100 * (1 - w.features.energy)), Math.round(100 * w.features.energy)]])), confirmed: true });
    if (r.kind === 'statements') a.claims = Object.fromEntries(STATEMENTS.map(s => [s.id, 2]));
    if (r.kind === 'match') Object.assign(a, { field: r.field, guesses: Object.fromEntries(r.works.map(w => [w.id, correctOption(r, w)])), confirmed: true });
    if (r.kind === 'context') a.change = 'more';
    assert.ok(validAnswer(r, a), 'fixture valid: ' + r.id); answers[r.id] = a;
  }
  return answers;
}
const synthetic = works.map((w, i) => ({ ...w, id: 'work-' + i, artist: 'Artist ' + i, movement: 'Style ' + i, features: Object.fromEntries(FEATURES.map(k => [k, k === 'energy' ? i / 15 : .5])) }));
test('The expanded catalogue keeps the original sixteen and verifies local images and open rights', () => {
  assert.equal(works.filter(w=>w.coreQuiz!==false).length,16); assert.ok(works.length>=27); assert.equal(new Set(works.map(w => w.id)).size,works.length);
  assert.ok(works.filter(w=>w.country==='Mexico').length>=3);
  for (const w of works) {
    assert.ok(['CC0','Public domain'].includes(w.rights));
    if(w.rights==='CC0') assert.match(w.sourceUrl, /^https:\/\/(www\.)?(?:clevelandart\.org\/art\/|metmuseum\.org\/art\/collection\/search\/|nga\.gov\/artworks\/)/);
    else assert.match(w.rightsUrl,/^https:\/\/commons\.wikimedia\.org\/wiki\//);
    const bytes = fs.readFileSync(new URL('../../public/art-atlas/' + w.image, import.meta.url));
    assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8); assert.ok(bytes.length > 1000);
  }
});
test('Twelve rounds introduce five formats, with two and four-work spectra and both games', () => {
  const r = buildRounds(works); assert.deepEqual(r.map(r => r.id), ROUND_IDS); assert.equal(Object.keys(FORMATS).length, 5);
  assert.deepEqual(r.filter(r => r.kind === 'spectrum').map(r => r.works.length), [4, 2, 4, 2, 2]);
  assert.deepEqual(r.filter(r => r.kind === 'grid').map(r => r.axis), ['response', 'connection']);
  assert.ok(r.filter(r => r.kind === 'grid').every(r => r.works.length === 4));
  assert.deepEqual(r.filter(r => r.kind === 'match').map(r => r.field), ['artist', 'movement']);
  assert.ok(r.findIndex(r => r.id === 'interestRank') < r.findIndex(r => r.kind === 'match'));
  assert.ok(r.findIndex(r => r.id === 'styleMatch') < r.findIndex(r => r.kind === 'context'));
  for (const item of r) assert.equal(new Set(item.works.map(w => w.id)).size, item.works.length);
});
test('Spectrum positions need explicit confirmation and every presented artwork', () => {
  const r = buildRounds(works)[0], a = session().preferenceRank;
  assert.equal(validAnswer(r, { ...a, confirmed: false }), false);
  const partial = structuredClone(a); delete partial.positions[r.works[0].id]; assert.equal(validAnswer(r, partial), false);
  assert.equal(validAnswer(r, { ...a, positions: { ...a.positions, extra: 50 } }), false);
  assert.equal(validAnswer(r, { ...a, workIds: [...a.workIds].reverse() }), false);
  assert.equal(validAnswer(r, { ...a, positions: { ...a.positions, [r.works[0].id]: 101 } }), false);
  assert.equal(buildProfile(works, { preferenceRank: { ...a, confirmed: false } }).enough, false);
});
test('Equal placements create no invented winner or preference direction', () => {
  const a = session();
  for (const [id, answer] of Object.entries(a)) if (answer.positions) for (const work of Object.keys(answer.positions)) answer.positions[work] = 50;
  const tasks = preferenceTasks(buildRounds(works, a), a, works);
  assert.equal(preferredId(a.closer), null); assert.ok(tasks.every(t => t.pairs.every(p => p.target === .5 && p.winner === null)));
  assert.deepEqual(fitPreference(tasks).beta, FEATURES.map(() => 0));
  const p = buildProfile(works, a); assert.ok(p.enough); assert.equal(p.findings.filter(f => f.kind === 'hypothesis').length, 0);
  assert.match(p.findings.find(f => f.id === 'interest-alignment').text, /Tied positions/);
});
test('Spectrum spacing changes comparison strength while one spectrum stays one task', () => {
  const a = session(), rounds = buildRounds(works, a), tasks = preferenceTasks(rounds, a, works), four = tasks[0];
  assert.equal(tasks.length, 4); assert.equal(four.pairs.length, 6); assert.ok(Math.abs(four.pairs.reduce((s, p) => s + p.weight, 0) - 1) < 1e-10);
  const b = structuredClone(a), ids = b.closer.workIds; b.closer.positions = { [ids[0]]: 45, [ids[1]]: 55 };
  const weak = fitPreference(preferenceTasks([rounds[1]], b, works)).beta;
  b.closer.positions = { [ids[0]]: 0, [ids[1]]: 100 };
  const strong = fitPreference(preferenceTasks([rounds[1]], b, works)).beta;
  assert.ok(Math.hypot(...strong) > Math.hypot(...weak)); assert.deepEqual(visualHypotheses([four], works), []);
});
test('Matching validates complete, unique options and scores actual labels', () => {
  const a = session(), r = buildRounds(works, a).find(r => r.id === 'artistMatch');
  assert.equal(matchResults(r, a.artistMatch).filter(x => x.status === 'correct').length, 4);
  const b = structuredClone(a.artistMatch), [x, y] = r.works.map(w => w.id);
  [b.guesses[x], b.guesses[y]] = [b.guesses[y], b.guesses[x]];
  assert.equal(matchResults(r, b).filter(x => x.status === 'correct').length, 2);
  b.guesses[x] = 'unsure'; assert.ok(validAnswer(r, b)); assert.equal(matchResults(r, b).find(item => item.workId === x).status, 'unsure');
  b.guesses[x] = b.guesses[y]; assert.equal(validAnswer(r, b), false);
  assert.equal(validAnswer(r, { ...a.artistMatch, confirmed: false }), false);
});
test('Curiosity, affect, matching and context stay outside the preference fit', () => {
  const a = session(), b = structuredClone(a);
  for (const id of Object.keys(b.interestRank.positions)) b.interestRank.positions[id] = 100 - b.interestRank.positions[id];
  b.feeling.points = Object.fromEntries(b.feeling.workIds.map(id => [id,[100,100]])); b.artistMatch.guesses = Object.fromEntries(b.artistMatch.workIds.map(id => [id, 'unsure'])); b.context.change = 'less'; b.selfView.claims = {quiet:4,curiosity:4,clarity:4};
  const model = answers => fitPreference(preferenceTasks(buildRounds(works, answers), answers, works)).beta;
  assert.deepEqual(model(a), model(b));
});
test('Opposite controlled choices invert a recurring visual explanation', () => {
  for (const sign of [1, -1]) {
    const f = buildProfile(synthetic, session(synthetic, sign)).findings.find(f => f.id === 'visual-energy');
    assert.ok(f); assert.equal(f.direction, sign); assert.ok(f.support.length >= 2);
  }
});
test('Preference/curiosity reversals use separate scales and check an endorsed description', () => {
  const a = session(synthetic);
  let p = buildProfile(synthetic,a), f = p.findings.find(f => f.id === 'interest-reversal'); assert.ok(f); assert.ok(f.support.some(e => e.roundId === 'preferenceRank')); assert.ok(f.support.some(e => e.roundId === 'interestRank'));
  a.selfView.claims.curiosity = 4; p = buildProfile(synthetic,a); f = p.findings.find(f => f.id === 'self-curiosity');
  assert.ok(f); assert.equal(p.checks.find(c => c.id === 'curiosity').status,'exception');
  assert.ok(f.support.some(e => e.roundId === 'selfView')); assert.ok(f.support.some(e => e.roundId === 'interestRank'));
  assert.equal(p.findings.filter(f => ['interest-reversal','self-curiosity'].includes(f.id)).length,1);
});
test('Evidence refers to actual answered rounds and presented works', () => {
  const a = session(), p = buildProfile(works, a), rounds = buildRounds(works, a);
  for (const f of p.findings) for (const e of [...f.support, ...f.counter]) {
    const r = rounds.find(r => r.id === e.roundId); assert.ok(validAnswer(r, a[r.id]));
    for (const id of e.workIds) assert.ok(r.works.some(w => w.id === id));
  }
  const recognition = p.findings.find(f => f.id === 'recognition'); assert.match(recognition.text, /4 of 4 artist/); assert.match(recognition.alternatives.join(' '), /chance/);
  assert.doesNotMatch(p.findings.map(f => f.text).join(' '), /your personality|deep down|percentile|rare type/i);
});
test('Editing upstream answers invalidates later responses; skipped sessions stay open', () => {
  const a = session(); assert.deepEqual(Object.keys(pruneAfter(a, 0)), ['preferenceRank']);
  assert.deepEqual(buildProfile(works, Object.fromEntries(ROUND_IDS.map(id => [id, { skipped: true }]))).findings, []);
  assert.equal(buildProfile(works, { preferenceRank: a.preferenceRank }).enough, false);
});
test('The final prediction cannot use its own answer and can report a tie', () => {
  const a = session(), before = buildRounds(works, a)[11], other = before.works.find(w => w.id !== before.predicted).id;
  a.lastLook.positions = Object.fromEntries(before.works.map(w => [w.id, w.id === other ? 100 : 0]));
  assert.equal(buildRounds(works, a)[11].predicted, before.predicted); assert.equal(buildProfile(works, a).prediction.matched, false);
  for (const id of a.lastLook.workIds) a.lastLook.positions[id] = 50;
  assert.equal(buildProfile(works, a).prediction.tied, true);
});
test('An exception inside a supporting spectrum is still shown', () => {
  const art = ['work-15', 'work-4', 'work-12', 'work-0'].map(id => synthetic.find(w => w.id === id));
  const r = { id: 'preferenceRank', kind: 'spectrum', criterion: 'preference', works: art };
  const answer = { criterion: 'preference', confirmed: true, workIds: art.map(w => w.id), positions: { 'work-15': 100, 'work-4': 75, 'work-12': 55, 'work-0': 0 } };
  const task = preferenceTasks([r], { preferenceRank: answer }, synthetic)[0];
  const pair = (id, win, lose) => ({ id, pairs: [{ winner: win, loser: lose, d: FEATURES.map(k => synthetic.find(w => w.id === win).features[k] - synthetic.find(w => w.id === lose).features[k]), target: 1, weight: 1 }] });
  const f = visualHypotheses([task, pair('probe', 'work-14', 'work-1'), pair('lastLook', 'work-13', 'work-2')], synthetic).find(f => f.feature === 'energy');
  assert.ok(f); assert.ok(f.counter.some(e => e.roundId === 'preferenceRank'));
  assert.deepEqual(f.counter.find(e => e.roundId === 'preferenceRank').workIds, ['work-4', 'work-12']);
});

test('Fine placements retain one-step differences and incomplete maps stay incomplete', () => {
  const a = session(), r = buildRounds(works,a).find(r => r.id === 'feeling'), id = r.works[0].id;
  a.feeling.points[id] = [13,87]; assert.ok(validAnswer(r,a.feeling)); assert.ok(validPoint([14,87]));
  assert.equal(validPoint([13.5,87]),false); assert.equal(validPoint([13,101]),false);
  assert.equal(validAnswer(r,{...a.feeling,confirmed:false}),false);
  const partial = structuredClone(a.feeling); delete partial.points[r.works[1].id];
  assert.equal(validAnswer(r,partial),false); const restored = sanitizeDraft(r,partial);
  assert.deepEqual(restored.points[id],[13,87]); assert.equal(Object.keys(restored.points).length,3);
  assert.equal(restored.confirmed,false); assert.equal(restored.points[r.works[1].id],undefined);
  const scale = buildRounds(works)[0], answer = a.preferenceRank;
  answer.positions[scale.works[0].id] = 53; assert.ok(validAnswer(scale,answer));
  answer.positions[scale.works[0].id] = 54; assert.ok(validAnswer(scale,answer));
});

test('A missing statement is not a neutral answer and partial restoration rejects unknown claims', () => {
  const a = session(), r = buildRounds(works,a).find(r => r.kind === 'statements');
  assert.ok(validAnswer(r,a.selfView)); delete a.selfView.claims.quiet; assert.equal(validAnswer(r,a.selfView),false);
  a.selfView.claims.unknown = 2; a.selfView.claims.clarity = 99;
  assert.deepEqual(sanitizeDraft(r,a.selfView).claims,{curiosity:2});
});

test('One four-work set cannot become several independent replications', () => {
  const a = session(synthetic), p = buildProfile(synthetic,a), quiet = p.checks.find(c => c.id === 'quiet');
  assert.ok(quiet); assert.doesNotMatch(quiet.detail,/independent|percent|confidence/i);
  for (const id of Object.keys(a.feeling.points)) a.feeling.points[id] = [50,50];
  const sparse = buildProfile(synthetic,a); assert.equal(sparse.checks.find(c => c.id === 'quiet').status,'open');
  assert.equal(sparse.findings.some(f => f.id === 'felt-energy' || f.id === 'self-quiet'),false);
});

test('Declining a rule does not imply believing its opposite', () => {
  const a = session(synthetic); a.selfView.claims.quiet = 0;
  const check = buildProfile(synthetic,a).checks.find(c => c.id === 'quiet');
  assert.equal(check.status,'compatible'); assert.match(check.detail,/without establishing an opposite rule/);
  assert.equal(buildProfile(synthetic,a).findings.some(f => f.id === 'self-quiet'),false);
});

test('Reported calm is kept distinct from annotated visual activity', () => {
  const a = session(synthetic), pref = a.preferenceRank.positions;
  for (const id of a.feeling.workIds) a.feeling.points[id] = [50,100 - Math.round(100 * synthetic.find(w => w.id === id).features.energy)];
  const p = buildProfile(synthetic,a), f = p.findings.find(f => f.id === 'activity-response');
  assert.ok(f); assert.equal(f.kind,'hypothesis'); assert.match(f.alternatives.join(' '),/editorial/);
  const pair = f.support.find(e => e.roundId === 'preferenceRank').workIds; assert.ok(pref[pair[0]] > pref[pair[1]]);
});

test('Evidence from self-description checks also points only to actual answered works', () => {
  const a = session(); a.selfView.claims = {quiet:4,curiosity:4,clarity:4};
  const p = buildProfile(works,a), rounds = buildRounds(works,a);
  for (const c of p.checks) for (const e of [...c.support,...c.counter]) {
    const r = rounds.find(r => r.id === e.roundId); assert.ok(validAnswer(r,a[r.id]));
    for (const id of e.workIds) assert.ok(r.works.some(w => w.id === id));
  }
});

test('Notes cannot manufacture a preference difference when all positions are tied', () => {
  const a = session();
  for (const id of a.preferenceRank.workIds) a.preferenceRank.positions[id] = 50;
  // Rebuild dependent note selections after changing the upstream response.
  const rounds = buildRounds(works,a);
  for (const id of ['context','contextSecond']) { const r=rounds.find(r=>r.id===id); a[id]={workId:r.works[0].id,workIds:r.works.map(w=>w.id),change:id==='context'?'more':'less'}; }
  const context = buildProfile(works,a).findings.find(f=>f.id==='context');
  assert.ok(context); assert.doesNotMatch(context.text,/higher-ranked|lower-ranked|different ends/);
});

test('An exception finding supports its own claim and keeps rule-following choices as qualifications', () => {
  const a = session(), ids = a.preferenceRank.workIds;
  a.preferenceRank.positions = Object.fromEntries(ids.map((id,i)=>[id,[83,30,60,95][i]]));
  a.feeling.points = Object.fromEntries(ids.map((id,i)=>[id,[[72,76],[80,25],[65,80],[20,20]][i]]));
  a.selfView.claims.quiet = 4;
  const f = buildProfile(works,a).findings.find(f=>f.id==='self-quiet'); assert.ok(f);
  const [x,y] = f.support.find(e=>e.roundId==='preferenceRank').workIds;
  assert.ok(a.preferenceRank.positions[x]>a.preferenceRank.positions[y]); assert.ok(a.feeling.points[x][1]>a.feeling.points[y][1]);
  const [c,d] = f.counter.find(e=>e.roundId==='preferenceRank').workIds;
  assert.ok(a.preferenceRank.positions[c]>a.preferenceRank.positions[d]); assert.ok(a.feeling.points[c][1]<a.feeling.points[d][1]);
});
