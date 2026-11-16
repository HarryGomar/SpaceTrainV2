import {validChoiceGrid,sanitizeChoiceGrid} from './discovery-grid.mjs';
import {validContrastAnswer,sanitizeContrastDraft} from './contrast-rounds.mjs';
import {isSymbolismRound,validSymbolismAnswer,sanitizeSymbolismDraft} from './symbolism-rounds.mjs';
import {isContextChangeRound,validContextChangeAnswer,sanitizeContextChangeDraft} from './context-change.mjs';
export const SCHEMA = 5;
export const FEATURES = ['abstraction', 'energy', 'complexity', 'humanity', 'narrative', 'atmosphere', 'color'];
export const ROUND_IDS = ['preferenceRank', 'closer', 'feeling', 'interestRank', 'connection', 'probe', 'selfView', 'artistMatch', 'styleMatch', 'context', 'contextSecond', 'lastLook'];
export const FORMATS = {
  spectrum: { name: 'Arrange', description: 'Place paintings along a scale. Adjust their spacing or leave them level.' },
  grid: { name: 'Map', description: 'One painting at a time, with four in view. The axes change between rounds.' },
  statements: { name: 'Take a position', description: 'A few statements about your taste. We compare these with your choices.' },
  match: { name: 'Match', description: 'Move paintings to artist names and styles. Unsure is always an option.' },
  context: { name: 'Read', description: 'See what a short museum note adds to your interest.' }
};
export const STATEMENTS = [
  { id: 'quiet', text: 'I usually prefer art that leaves me feeling calm.' },
  { id: 'curiosity', text: 'The paintings I prefer are also the ones I want to understand.' },
  { id: 'clarity', text: 'I tend to prefer paintings I find easy to understand.' }
];
export const AGREEMENT = ['Disagree', 'Lean against', 'In between', 'Lean towards', 'Agree'];
export const AXES = {
  achievement: {xName:'Personal appeal',yName:'Admiration of making',left:'Not for me',right:'For me',top:'Much to admire',bottom:'Little to admire',xWords:['not for me','little personal appeal','some personal appeal','strong personal appeal','very much for me'],yWords:['little to admire in the making','some admiration of the making','moderate admiration','much to admire','a great deal to admire']},
  reading: {xName:'Scene clarity',yName:'Interpretive openness',left:'Unclear scene',right:'Clear scene',top:'Several readings',bottom:'One reading',xWords:['unclear scene','mostly unclear scene','partly clear scene','mostly clear scene','clear scene'],yWords:['one clear reading','a fairly settled reading','some possible readings','several possible readings','many possible readings']},
  returnResponse: {xName:'Felt tension',yName:'Wish to return',left:'Comforting',right:'Unsettling',top:'Would return',bottom:'Once is enough',xWords:['comforting','mostly comforting','neither comforting nor unsettling','somewhat unsettling','unsettling'],yWords:['once is enough','little wish to return','might return','would return','strong wish to return']},
  meaning: { xName:'Suggested meaning', yName:'Interest in interpretation', left:'Little to interpret', right:'Much to interpret', top:'Want to explore', bottom:'Little interest', xWords:['little to interpret','a little to interpret','some possible meaning','several possible meanings','much to interpret'], yWords:['little interest in interpretation','slight interest in interpretation','some interest in interpretation','strong interest in interpretation','want to explore the meaning'] },
  response: { xName:'Tension', yName:'Involvement', left:'At ease', right:'On edge', top:'Absorbed', bottom:'Unmoved', xWords:['at ease','little tension','some tension','tense','on edge'], yWords:['unmoved','slightly involved','involved','absorbed','fully absorbed'] },
  feeling: { xName: 'Pleasantness', yName: 'Activation', left: 'Unpleasant', right: 'Pleasant', top: 'Activated', bottom: 'At rest', xWords: ['very unpleasant', 'somewhat unpleasant', 'neither pleasant nor unpleasant', 'somewhat pleasant', 'very pleasant'], yWords: ['very restful', 'restful', 'moderately activating', 'activating', 'strongly activating'] },
  attraction: { xName: 'Enjoyment', yName: 'Curiosity', left: 'Little enjoyment', right: 'Strong enjoyment', top: 'Strong curiosity', bottom: 'Little curiosity', xWords: ['very little enjoyment', 'little enjoyment', 'moderate enjoyment', 'strong enjoyment', 'very strong enjoyment'], yWords: ['very little curiosity', 'little curiosity', 'moderate curiosity', 'strong curiosity', 'very strong curiosity'] },
  connection: { xName: 'Understanding', yName: 'Connection', left: 'Hard to understand', right: 'Easy to understand', top: 'Feels personal', bottom: 'Feels distant', xWords: ['very hard to understand', 'hard to understand', 'partly understood', 'easy to understand', 'very easy to understand'], yWords: ['very little personal connection', 'little personal connection', 'some personal connection', 'strong personal connection', 'very strong personal connection'] }
};
export const byId = (works, id) => works.find(w => w.id === id);
export const unique = values => [...new Set(values.filter(Boolean))];
export const feature = (w, key) => Math.max(0, Math.min(1, Number(w?.features?.[key]) || 0));
const ids = r => r.works.map(w => w.id);
export const positionOrder = a => Object.keys(a?.positions || {}).sort((x, y) => a.positions[y] - a.positions[x] || x.localeCompare(y));
export const topIds = a => positionOrder(a).filter(id => a.positions[id] === Math.max(...Object.values(a.positions)));
export const positionRank = (a, id) => 1 + Object.values(a.positions).filter(v => v > a.positions[id]).length;
export const preferredId = a => { const top = topIds(a); return top.length === 1 ? top[0] : null; };
export const validPosition = v => Number.isInteger(v) && v >= 0 && v <= 100;
export const validPoint = p => Array.isArray(p) && p.length === 2 && p.every(validPosition);
export const correctOption = (r, w) => r.options.find(o => o.label === w[r.field])?.id;
export function matchResults(r, a) { return r.works.map(w => ({ workId: w.id, chosen: a.guesses?.[w.id], correct: correctOption(r, w), label: w[r.field], status: a.guesses?.[w.id] === 'unsure' ? 'unsure' : a.guesses?.[w.id] === correctOption(r, w) ? 'correct' : 'missed' })); }
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const difference = (a, b) => FEATURES.map(k => feature(a, k) - feature(b, k));
const sigmoid = n => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, n))));
export function freshState() { return { schema: SCHEMA, stage: 'intro', index: 0, answers: {}, startedAt: null, finishedAt: null }; }
export function pruneAfter(answers, index) { return Object.fromEntries(Object.entries(answers).filter(([key]) => ROUND_IDS.includes(key) && ROUND_IDS.indexOf(key) <= index)); }
export function validAnswer(round, a) {
  if (!a || a.skipped) return false;
  if(isContextChangeRound(round))return validContextChangeAnswer(round,a);
  if(isSymbolismRound(round))return validSymbolismAnswer(round,a);
  if(round.kind==='choice-grid')return validChoiceGrid(round,a);
  if(round.kind==='contrast')return validContrastAnswer(round,a);
  const presented = ids(round), exact = Array.isArray(a.workIds) && a.workIds.join('|') === presented.join('|');
  if (round.kind === 'spectrum') return a.confirmed === true && a.criterion === round.criterion && exact && a.positions && Object.keys(a.positions).length === presented.length && presented.every(id => validPosition(a.positions[id]));
  if (round.kind === 'grid') return a.confirmed === true && exact && (a.axis === round.axis || round.id==='feeling'&&a.axis==='feeling') && a.points && Object.keys(a.points).length === presented.length && presented.every(id => validPoint(a.points[id]));
  if (round.kind === 'statements') {const statements=round.statements||STATEMENTS;return exact && a.claims && Object.keys(a.claims).length === statements.length && statements.every(s => Number.isInteger(a.claims[s.id]) && a.claims[s.id] >= 0 && a.claims[s.id] <= 4);}
  if (round.kind === 'match') {
    const guesses = a.guesses || {}, used = Object.values(guesses).filter(v => v !== 'unsure');
    return a.confirmed === true && exact && a.field === round.field && Object.keys(guesses).length === presented.length && presented.every(id => guesses[id] === 'unsure' || round.options.some(o => o.id === guesses[id])) && new Set(used).size === used.length;
  }
  if (round.kind === 'context') {
    if(round.contextMode==='preference-before-after-v1')return exact&&a.workId===presented[0]&&a.storySeen===true&&[0,25,50,75,100].includes(a.before)&&[0,25,50,75,100].includes(a.after);
    return a.workId === presented[0] && ['more', 'same', 'less', 'unsure'].includes(a.change);
  }
  return false;
}
// Keep a partial answer without turning a missing response into a neutral one.
export function sanitizeDraft(round, answer) {
  const workIds = ids(round), base = { workIds };
  if(isContextChangeRound(round))return sanitizeContextChangeDraft(round,answer);
  if(isSymbolismRound(round))return sanitizeSymbolismDraft(round,answer);
  if(round.kind==='choice-grid')return sanitizeChoiceGrid(round,answer);
  if(round.kind==='contrast')return sanitizeContrastDraft(round,answer||{});
  if (round.kind === 'spectrum') return { ...base, criterion: round.criterion, positions: answer?.criterion === round.criterion ? Object.fromEntries(Object.entries(answer.positions || {}).filter(([id, v]) => workIds.includes(id) && validPosition(v))) : {}, confirmed: false };
  if (round.kind === 'grid') { const axis=round.id==='feeling'&&answer?.axis==='feeling'?'feeling':round.axis;return { ...base, axis, points: answer?.axis === axis ? Object.fromEntries(Object.entries(answer.points || {}).filter(([id, p]) => workIds.includes(id) && validPoint(p))) : {}, confirmed: false }; }
  if (round.kind === 'statements') return { ...base, claims: Object.fromEntries((round.statements||STATEMENTS).filter(s => Number.isInteger(answer?.claims?.[s.id]) && answer.claims[s.id] >= 0 && answer.claims[s.id] <= 4).map(s => [s.id, answer.claims[s.id]])) };
  if (round.kind === 'match') {
    const guesses = {}, used = new Set();
    for (const id of workIds) { const value = answer?.field === round.field && answer.guesses?.[id]; if (value === 'unsure' || round.options.some(o => o.id === value) && !used.has(value)) { guesses[id] = value; if (value !== 'unsure') used.add(value); } }
    return { ...base, field: round.field, guesses, confirmed: false };
  }
  if(round.kind==='context'&&round.contextMode==='preference-before-after-v1')return {...base,workId:workIds[0],...(answer?.workId===workIds[0]&&[0,25,50,75,100].includes(answer.before)?{before:answer.before}:{}),...(answer?.workId===workIds[0]&&answer.storySeen===true?{storySeen:true,stage:'after',...([0,25,50,75,100].includes(answer.after)?{after:answer.after}:{})}:{storySeen:false,stage:'before'})};
  return { ...base, workId: workIds[0] };
}
function diverse(works) {
  const result = [];
  for (const score of [w => feature(w, 'atmosphere') - .4 * feature(w, 'energy'), w => feature(w, 'humanity') + feature(w, 'narrative'), w => feature(w, 'abstraction') + .35 * feature(w, 'color'), w => feature(w, 'complexity') + feature(w, 'energy')]) {
    const available = works.filter(w => !result.includes(w));
    available.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id)); result.push(available[0]);
  }
  return result;
}
function initialPair(works, excluded) {
  const pool = works.filter(w => !excluded.includes(w.id));
  let pair = pool.slice(0, 2), max = -Infinity;
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    const d = difference(pool[i], pool[j]);
    const score = 1.5 * Math.abs(d[3]) - .4 * d.filter((_, k) => k !== 3).reduce((s, v) => s + Math.abs(v), 0) / 6;
    if (score > max) { max = score; pair = [pool[i], pool[j]]; }
  }
  return pair;
}
// A spectrum is one dependent cluster. Soft pair targets retain ties and spacing.
export function preferenceTasks(rounds, answers, works, criterion = 'preference') {
  const tasks = [];
  for (const r of rounds) {
    const a = answers[r.id]; if (!validAnswer(r, a)) continue;
    let pairs = [];
    if (r.kind === 'spectrum' && r.criterion === criterion) {
      const order = positionOrder(a);
      for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) pairs.push([order[i], order[j]]);
    }
    if (pairs.length) tasks.push({ id: r.id, label: `Round ${ROUND_IDS.indexOf(r.id) + 1}`, pairs: pairs.map(([left, right]) => {
      const gap = a.positions[left] - a.positions[right];
      return { left, right, winner: gap ? left : null, loser: gap ? right : null, gap, target: .5 + gap / 200, d: difference(byId(works, left), byId(works, right)), weight: 1 / pairs.length };
    }) });
  }
  return tasks;
}
function solve(matrix, vector) {
  const a = matrix.map((row, i) => [...row, vector[i]]), n = vector.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let i = col + 1; i < n; i++) if (Math.abs(a[i][col]) > Math.abs(a[pivot][col])) pivot = i;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col]; if (Math.abs(divisor) < 1e-10) return vector.map(() => 0);
    for (let j = col; j <= n; j++) a[col][j] /= divisor;
    for (let i = 0; i < n; i++) if (i !== col) { const f = a[i][col]; for (let j = col; j <= n; j++) a[i][j] -= f * a[col][j]; }
  }
  return a.map(row => row[n]);
}
export function fitPreference(tasks) {
  const n = FEATURES.length, ridge = .7; let beta = FEATURES.map(() => 0), hessian;
  for (let iter = 0; iter < 25; iter++) {
    const gradient = beta.map(v => -ridge * v);
    hessian = Array.from({ length: n }, (_, i) => FEATURES.map((_, j) => i === j ? ridge : 0));
    for (const t of tasks) for (const p of t.pairs) {
      const probability = sigmoid(dot(beta, p.d));
      for (let i = 0; i < n; i++) {
        gradient[i] += p.weight * p.d[i] * ((p.target ?? 1) - probability);
        for (let j = 0; j < n; j++) hessian[i][j] += p.weight * probability * (1 - probability) * p.d[i] * p.d[j];
      }
    }
    const delta = solve(hessian, gradient); beta = beta.map((v, i) => v + delta[i]);
    if (Math.max(...delta.map(Math.abs)) < 1e-7) break;
  }
  return { beta, hessian };
}
function adaptivePair(works, excluded, model) {
  const pool = works.filter(w => !excluded.includes(w.id)); let result = pool.slice(0, 2), max = -Infinity;
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    const d = difference(pool[i], pool[j]), p = sigmoid(dot(model.beta, d));
    const information = p * (1 - p) * dot(d, solve(model.hessian, d));
    if (information > max) { max = information; result = [pool[i], pool[j]]; }
  }
  return result;
}
export function buildRounds(works, answers = {}) {
  const quizWorks = works.filter(w => w.coreQuiz !== false);
  if (quizWorks.length < 12) throw new Error('At least twelve verified quiz artworks are required.');
  const gallery = diverse(quizWorks), galleryIds = gallery.map(w => w.id);
  const spectrum = (id, title, hint, art, criterion = 'preference') => ({ id, kind: 'spectrum', format: 'spectrum', criterion, title, hint, works: art });
  const rank = spectrum('preferenceRank', 'Which would you choose to look at?', 'Place each work on the scale. Keep all four in mind. Equal positions are fine.', gallery);
  const anchor = byId(works, validAnswer(rank, answers.preferenceRank) ? positionOrder(answers.preferenceRank)[0] : galleryIds[0]);
  const pair = initialPair(quizWorks, galleryIds);
  const closer = spectrum('closer', 'Which do you prefer?', 'Place both on the same scale. Use the spacing, including equal positions.', pair);
  const interest = spectrum('interestRank', 'Which would you like to understand?', 'Same four works. This time, further right means more curious.', gallery, 'interest');
  // The second note deliberately revisits a lower-ranked work, not another favourite.
  const prefOrder = validAnswer(rank, answers.preferenceRank) ? positionOrder(answers.preferenceRank) : galleryIds;
  const second = byId(works, [...prefOrder].reverse().find(id => id !== anchor.id));
  const preliminary = fitPreference(preferenceTasks([rank, closer], answers, works));
  const probeWorks = adaptivePair(quizWorks, [...galleryIds, ...pair.map(w => w.id)], preliminary);
  const probe = spectrum('probe', 'Which do you prefer?', 'A new pair. Use the same scale, including equal positions if they feel equal.', probeWorks);
  // This final answer cannot affect selection or the prediction for its own pair.
  const beforeFinal = fitPreference(preferenceTasks([rank, closer, probe], answers, works));
  const finalWorks = adaptivePair(quizWorks, [...galleryIds, ...pair.map(w => w.id), ...probeWorks.map(w => w.id)], beforeFinal);
  const scores = finalWorks.map(w => dot(beforeFinal.beta, FEATURES.map(k => feature(w, k))));
  const predicted = Math.abs(scores[0] - scores[1]) < 1e-8 ? null : finalWorks[scores[0] > scores[1] ? 0 : 1].id;
  const matching = (id, field, title, art) => {
    // Each label has one space. Repeated styles in a preference set must not
    // turn the matching game into an impossible one-to-one assignment.
    const seen=new Set(),matchingArt=[...art,...quizWorks].filter(work=>{
      const label=typeof work[field]==='string'?work[field].trim():'';
      if(!label||/^(unknown|unidentified|anonymous)(\b|$)/i.test(label)||field==='artist'&&work.artistKnown===false||seen.has(label))return false;
      seen.add(label);return true;
    }).slice(0,4);
    const labels = unique(matchingArt.map(w => w[field])).sort((a, b) => a.localeCompare(b));
    const options = labels.map((label, i) => ({ id: `${field}-${i}`, label }));
    return { id, kind: 'match', format: 'match', field, title, hint: 'Drag each painting to a label. Or tap a painting, then its label. Leave any you are unsure about.', works: matchingArt, options: [options[2], options[0], options[3], options[1]].filter(Boolean) };
  };
  return [rank, closer,
    { id: 'feeling', kind: 'grid', format: 'grid', axis: answers.feeling?.axis==='feeling'?'feeling':'response', title: answers.feeling?.axis==='feeling'?'How do these works leave you feeling?':'How does each work affect you?', hint: answers.feeling?.axis==='feeling'?'Your saved map uses pleasantness and activation.':'How much tension do you feel, and how much does the work hold your attention?', works: gallery }, interest,
    { id: 'connection', kind: 'grid', format: 'grid', axis: 'connection', title: 'Understanding and connection.', hint: 'New axes. How easy is each work to understand? How personal does it feel?', works: gallery }, probe,
    { id: 'selfView', kind: 'statements', format: 'statements', title: 'How would you describe your taste?', hint: 'Choose the answer that fits your experience. In between and Skip are both fine.', works: gallery, statements: STATEMENTS },
    matching('artistMatch', 'artist', 'Match the paintings to the artists.', gallery),
    matching('styleMatch', 'movement', 'Now match the styles and traditions.', gallery),
    { id: 'context', kind: 'context', format: 'context', title: 'Does the note change your interest?', hint: 'Report the change you notice, if any.', works: [anchor] },
    { id: 'contextSecond', kind: 'context', format: 'context', title: 'Does the note change your interest?', hint: 'A second note. Use the same scale.', works: [second] },
    { ...spectrum('lastLook', 'One last comparison.', 'Place both works on the scale, then see your reading.', finalWorks), predicted }
  ];
}
export function describePoint(axis, point) { const bin = v => Math.max(0, Math.min(4, Math.round(v / 25))); return AXES[axis] && validPoint(point) ? AXES[axis].xWords[bin(point[0])] + '; ' + AXES[axis].yWords[bin(point[1])] : ''; }
export { buildProfile } from './profile.mjs';
