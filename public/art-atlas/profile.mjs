import { crossReadings } from './insights.mjs';
import { analyzeScenarios } from './scenarios.mjs';
import { FEATURES, ROUND_IDS, byId, unique, feature, buildRounds, validAnswer, preferenceTasks, fitPreference, describePoint, positionOrder, topIds, positionRank, preferredId, matchResults } from './engine.mjs';

const labels = {
  abstraction: ['more representational images', 'more abstract images'], energy: ['lower visual activity', 'greater visual activity'],
  complexity: ['sparser compositions', 'denser compositions'], humanity: ['less emphasis on human figures', 'more emphasis on human figures'],
  narrative: ['less explicit depicted events', 'more explicit depicted events'], atmosphere: ['less emphasis on setting and atmosphere', 'more emphasis on setting and atmosphere'], color: ['more restrained colour', 'more intense colour']
};
const ev = (roundId, detail, ids) => ({ roundId, label: `Round ${ROUND_IDS.indexOf(roundId) + 1}`, detail, workIds: unique(ids) });
function finding(id, title, text, support, options = {}) {
  return { id, title, text, kind: 'observed', support, counter: [], alternatives: [], ...options, evidence: unique([...support, ...(options.counter || [])].flatMap(e => e.workIds)) };
}
function correlatedFeatures(works, key) {
  return FEATURES.filter(other => other !== key).map(other => {
    const a = works.map(w => feature(w, key)), b = works.map(w => feature(w, other));
    const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
    const covariance = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
    const denom = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0) * b.reduce((s, v) => s + (v - mb) ** 2, 0));
    return { key: other, correlation: denom ? covariance / denom : 0 };
  }).filter(c => Math.abs(c.correlation) > .6);
}
export function visualHypotheses(tasks, works) {
  if (tasks.length < 2) return [];
  const model = fitPreference(tasks), omitted = tasks.map(t => fitPreference(tasks.filter(other => other.id !== t.id)));
  return FEATURES.flatMap((key, k) => {
    const direction = Math.sign(model.beta[k]);
    // Design thresholds, not a statistical confidence claim. Remove whole tasks.
    if (!direction || Math.abs(model.beta[k]) < .12 || omitted.some(m => direction * m.beta[k] < .015)) return [];
    const informative = tasks.map(t => {
      const pairs = t.pairs.filter(p => p.winner && Math.abs(p.d[k]) >= .3);
      return { ...t, pairs, net: pairs.reduce((s, p) => s + p.weight * p.d[k] * direction * (p.gap === undefined ? 1 : p.gap / 100), 0) };
    }).filter(t => t.pairs.length);
    const supports = informative.filter(t => t.net >= .06), against = informative.filter(t => t.net <= -.06);
    const artists = unique(supports.flatMap(t => t.pairs.flatMap(p => [byId(works, p.winner).artist, byId(works, p.loser).artist])));
    if (supports.length < 2 || artists.length < 3) return [];
    const label = labels[key][direction > 0 ? 1 : 0];
    const pack = (t, sign) => {
      const p = [...t.pairs].sort((a, b) => sign * direction * (b.d[k] - a.d[k]))[0];
      return ev(t.id, `${byId(works, p.winner).title} was placed above ${byId(works, p.loser).title}.`, [p.winner, p.loser]);
    };
    const support = supports.map(t => pack(t, 1));
    // An exception inside a ranking remains visible even if that ranking's net agrees.
    const counter = informative.flatMap(t => t.pairs.some(p => direction * p.d[k] <= -.3) ? [pack(t, -1)] : []);
    const alternatives = correlatedFeatures(works, key).map(c => `This collection often combines ${label} with ${labels[c.key][Math.sign(c.correlation) * direction > 0 ? 1 : 0]}. These choices do not isolate the two.`);
    if (!alternatives.length) alternatives.push('Subject, colour, technique and familiarity also vary between these works. This is a possible explanation, not a cause established by the quiz.');
    const text = `A preference for ${label} recurred in ${supports.length} of ${informative.length} rounds with a clear contrast in that feature.${counter.length ? ' Some individual choices went the other way.' : ''} The direction also held when each preference round was removed in turn.`;
    return [finding('visual-' + key, `A possible link: ${label}`, text, support, {
      kind: 'hypothesis', feature: key, direction, counter, alternatives, priority: supports.length - against.length + Math.abs(model.beta[k]),
      next: `Compare works with similar subjects and colour but different levels of ${key === 'energy' ? 'visual activity' : key === 'humanity' ? 'human presence' : key === 'narrative' ? 'depicted action' : key}.`
    })];
  }).sort((a, b) => b.priority - a.priority);
}
export function buildProfile(works, answers, scenarioRecords = []) {
  const clean = {};
  for (let i = 0; i < ROUND_IDS.length; i++) { const r = buildRounds(works, clean)[i]; if (validAnswer(r, answers[r.id])) clean[r.id] = answers[r.id]; }
  const rounds = buildRounds(works, clean), tasks = preferenceTasks(rounds, clean, works);
  const { findings, checks } = crossReadings(works, clean);
  const scenarios = analyzeScenarios(works, scenarioRecords);
  findings.push(...scenarios.findings);
  const positive = unique([...(clean.preferenceRank ? topIds(clean.preferenceRank) : []), ...tasks.filter(t => t.id !== 'preferenceRank').flatMap(t => t.pairs.filter(p => p.winner).map(p => p.winner))]);
  const hypotheses = visualHypotheses(tasks, works), selected = [];
  for (const h of hypotheses) {
    if (selected.every(other => !correlatedFeatures(works, h.feature).some(c => c.key === other.feature))) selected.push(h);
    if (selected.length === 2) break;
  }
  findings.push(...selected);
  const games = rounds.filter(r => r.kind === 'match' && clean[r.id]);
  if (games.length) {
    const results = games.map(r => ({ round: r, items: matchResults(r, clean[r.id]) }));
    const support = results.map(({round: r, items}) => ev(r.id, items.map(item => {
      const w = byId(works, item.workId), guess = r.options.find(o => o.id === item.chosen)?.label;
      return w.title + ': ' + (item.status === 'correct' ? 'matched to ' + item.label : item.status === 'unsure' ? 'left unsure; the label is ' + item.label : 'placed under ' + guess + '; the label is ' + item.label);
    }).join('. ') + '.', items.map(item => item.workId)));
    const summary = results.map(({round: r, items}) => items.filter(item => item.status === 'correct').length + ' of ' + items.length + ' ' + (r.field === 'artist' ? 'artist' : 'style or tradition') + ' matches').join(' and ');
    let text = 'You made ' + summary + '. The names and styles were revealed after your first preferences and response maps.';
    const first = clean.preferenceRank;
    const artistGame = results.find(g => g.round.field === 'artist');
    const high = first && artistGame?.items.find(item => first.positions[item.workId] >= 65 && item.status !== 'correct');
    const low = high && artistGame.items.find(item => first.positions[high.workId] - first.positions[item.workId] >= 15 && item.status === 'correct');
    if (low) text += ' You preferred ' + byId(works, high.workId).title + ', whose artist you did not match, to ' + byId(works, low.workId).title + ', whose artist you matched. The preference order did not follow the matching result for these two works.';
    if (low) support.unshift(ev('preferenceRank', 'Preference positions: ' + first.positions[high.workId] + ' for ' + byId(works, high.workId).title + '; ' + first.positions[low.workId] + ' for ' + byId(works, low.workId).title + '.', [high.workId, low.workId]));
    findings.push(finding('recognition', low ? 'Preference did not follow name matching.' : 'Your artist and style matches.', text, support, { alternatives: ['The options cue recognition and correct guesses can happen by chance. A missed match does not establish unfamiliarity. This small game cannot measure general art expertise. Style and tradition labels are broad and can overlap.'], priority: low ? 7 : 2 }));
  }
  const contexts = ['context', 'contextSecond'].filter(id => clean[id]);
  if (contexts.length) {
    const words = { more: 'increased', same: 'did not change', less: 'reduced', unsure: 'had an uncertain effect on' };
    const support = contexts.map(id => ev(id, 'The note ' + words[clean[id].change] + ' your reported curiosity about ' + byId(works, clean[id].workId).title + '.', [clean[id].workId]));
    const different = contexts.length === 2 && clean.context.change !== clean.contextSecond.change;
    let text = support.map(s => s.detail).join(' ');
    if (different && clean.preferenceRank && clean.preferenceRank.positions[clean.context.workId] > clean.preferenceRank.positions[clean.contextSecond.workId]) {
      text += ' The first note revisited your higher-ranked work; the second revisited a lower-ranked one. Context did not add the same thing to both.';
      support.push(ev('preferenceRank', 'The two note selections came from different ends of your preference order.', contexts.map(id => clean[id].workId)));
    }
    findings.push(finding('context', different ? 'Context added different things to these works.' : 'What the notes added.', text, support, { alternatives: ['This is your report of a change. Reading, repeated viewing and new information happened together, so the note’s causal effect is not isolated.'], priority: different ? 5 : 2 }));
  }
  findings.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  // Keep one main observation for a relationship. Its self-description check contains both signals.
  const visible = findings.filter(f => !(f.id === 'interest-reversal' && findings.some(o => o.id === 'self-curiosity')) && !(f.id === 'felt-energy' && findings.some(o => o.id === 'self-quiet')));
  const enough = tasks.length >= 2 || scenarios.enough, main = visible[0], final = rounds.at(-1);
  const latestScenario=scenarios.records.at(-1);
  const nextCuration=latestScenario?.kind==='sorting'?'Arrange the same eight works again. Check whether the closest pairs stay together when the rest of the table changes. An individual preference comparison would help distinguish similarity from liking.':latestScenario?.kind==='difficult-edit'?'Compare the edited-out work and its replacement individually, then try them beside different neighbours. This could help distinguish individual preference from fit within this wall.':'Arrange the same offered set under the same brief again and compare selection with grouping and room roles. Keeping the works while changing their partners would reveal a different pattern from replacing the works.';
  const prediction = clean.lastLook && final.predicted ? { predicted: final.predicted, chosen: preferredId(clean.lastLook), tied: !preferredId(clean.lastLook), matched: final.predicted === preferredId(clean.lastLook) } : null;
  const basis = 'The reading connects choice-derived patterns with separately reported feelings, curiosity, understanding and self-description. The quiz compares the same four works across tasks before revealing names and notes within that session. Curatorial tasks keep their instructions, offered works, presentation history, selected works and room groupings. Omission is not dislike, and choosing a companion is not an individual preference rating. Guided exhibitions retain the room briefs and separate choices for the viewer and a new visitor. The two visit questions also differ in time constraints. Earlier free arrangements retain their original brief. Each exhibition is one dependent task. Comparisons with alternative pairings are descriptive, not significance tests. Artwork annotations are provisional. Agreement statements and curatorial decisions never train the quiz preference model. Each spectrum counts as one dependent task; spacing supplies a heuristic strength signal, not a calibrated probability. Interpretation thresholds and sensitivity checks are design heuristics, not validated confidence levels or independent cross-validation.';
  return {
    enough, key: main?.id || 'open', name: enough ? main?.title || 'An explanation is still taking shape.' : 'A few more comparisons would help.',
    subtitle: enough ? 'A reading of your choices in different contexts. Each claim keeps its supporting works, exceptions and limits.' : 'Complete a Sorting table, Difficult edit, museum arrangement or two preference rounds to begin a reading.',
    answered: Object.keys(clean).length, scenarioCount: scenarios.records.length, exhibitionCount: scenarios.exhibitions, taskCount: tasks.length, findings: enough ? visible : [], checks: enough ? checks : [], evidence: unique([...positive,...scenarios.evidence]),
    reflection: hypotheses[0]?.next || (scenarios.records.length ? nextCuration : 'Try new works with a similar subject but different visual activity. Keep feeling and preference separate again to see whether the same relationship returns.'),
    unresolved: hypotheses.length ? 'Several features vary together. The visual pattern suggests a possible explanation; it does not establish why you liked the works.' : scenarios.records.length ? 'Grouping, individual preference and fit beside other works can follow different rules. These decisions show relationships in this context. Their causes remain open.' : 'No visual feature met the recurrence and round-removal checks. The relationships between your responses can be described; a visual cause remains open.',
    prediction, basis
  };
}
