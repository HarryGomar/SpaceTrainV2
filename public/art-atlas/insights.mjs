import { ROUND_IDS, STATEMENTS, AGREEMENT, byId, unique, describePoint } from './engine.mjs';

export const evidence = (roundId, detail, workIds) => ({ roundId, label: `Round ${ROUND_IDS.indexOf(roundId) + 1}`, detail, workIds: unique(workIds) });
export function makeFinding(id, title, text, support, options = {}) {
  return { id, title, text, kind: 'observed', support, counter: [], alternatives: [], ...options, evidence: unique([...support, ...(options.counter || [])].flatMap(e => e.workIds)) };
}
const short = w => w.shortTitle || w.title;
const margin = 12; // Editorial thresholds for legible differences, not measurement error estimates.
function comparisons(ids, first, second, secondMargin = margin) {
  const result = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const x = ids[i], y = ids[j];
    if (Math.abs(first[x] - first[y]) < margin || Math.abs(second[x] - second[y]) < secondMargin) continue;
    const [a, b] = first[x] > first[y] ? [x, y] : [y, x];
    result.push({ a, b, direction: Math.sign(second[a] - second[b]), strength: Math.abs(first[a] - first[b]) + Math.abs(second[a] - second[b]) });
  }
  return result.sort((a, b) => b.strength - a.strength);
}
const scores = (points, dim, sign = 1) => Object.fromEntries(Object.entries(points).map(([id, p]) => [id, p[dim] * sign]));
function pattern(pairs) {
  const support = pairs.filter(p => p.direction > 0), counter = pairs.filter(p => p.direction < 0);
  const enough = pairs.length >= 2 && unique(pairs.flatMap(p => [p.a, p.b])).length >= 3;
  return { support, counter, direction: !enough ? null : support.length && counter.length ? 0 : support.length ? 1 : -1 };
}
export function crossReadings(works, clean) {
  const findings = [], checks = [], pref = clean.preferenceRank?.positions, interest = clean.interestRank?.positions;
  const feel = clean.feeling?.points, feelAxis=clean.feeling?.axis||'feeling', connection = clean.connection?.points;
  const ids = Object.keys(pref || {}), w = id => byId(works, id);
  const prefEv = pair => evidence('preferenceRank', `${short(w(pair.a))}: ${pref[pair.a]}. ${short(w(pair.b))}: ${pref[pair.b]} on the preference scale.`, [pair.a, pair.b]);
  const gridEv = (roundId, axis, points, pair) => evidence(roundId, [pair.a, pair.b].map(id => `${short(w(id))}: ${describePoint(axis, points[id])} [${points[id].join(', ')}]`).join('. '), [pair.a, pair.b]);
  const curiosityEv = pair => evidence('interestRank', `${short(w(pair.a))}: ${interest[pair.a]}. ${short(w(pair.b))}: ${interest[pair.b]} on the curiosity scale.`, [pair.a, pair.b]);
  const scope = 'These are comparisons within one set of four. Repeated viewing and the question wording may affect them. They do not establish a general rule or a cause.';
  const patterns = {};
  if (pref && interest) {
    const p = patterns.curiosity = pattern(comparisons(ids, pref, interest)), reverse = p.counter[0], same = p.support[0];
    if (reverse) {
      const a = w(reverse.a), b = w(reverse.b);
      let text = `You chose ${short(a)} over ${short(b)}, but wanted to understand ${short(b)} more. What you would choose to look at and what you would investigate are different here.`;
      const support = [prefEv(reverse), curiosityEv(reverse)];
      if (connection && connection[b.id][0] <= 35 && connection[a.id][0] >= 60) {
        text += ` You also found ${short(b)} harder to understand. Its uncertainty may be part of its interest, even though it did not make it your preference.`;
        support.push(gridEv('connection', 'connection', connection, reverse));
      }
      findings.push(makeFinding('interest-reversal', 'Some works invite study more than preference.', text, support, { counter: same ? [prefEv(same), curiosityEv(same)] : [], alternatives: [scope, 'Difficulty, novelty and the subject may all contribute to curiosity. These comparisons cannot separate them.'], priority: 11 }));
    } else if (same) findings.push(makeFinding('interest-alignment', 'Curiosity followed preference in this set.', `The works you placed higher for preference also tended to be the ones you wanted to understand. There was no clear reversal among the separated placements. Ties and small differences remain open.`, [prefEv(same), curiosityEv(same)], { alternatives: [scope], priority: 4 }));
    else findings.push(makeFinding('interest-alignment', 'The two scales leave the relationship open.', 'Tied positions or small differences leave too little separation to compare preference with curiosity. They are kept as you placed them.', [evidence('preferenceRank', 'Tied positions and small differences are not treated as clear preferences.', ids), evidence('interestRank', 'No clear comparison crossed the interpretation threshold on both scales.', ids)], { alternatives: [scope], priority: 1 }));
  }
  if (pref && feel && feelAxis==='feeling') {
    const pairs = comparisons(ids, pref, scores(feel, 0), 20), exception = pairs.find(p => p.direction < 0 && feel[p.a][0] <= 40 && feel[p.b][0] >= 60);
    if (exception) findings.push(makeFinding('pleasantness-gap', 'Pleasantness did not decide this preference.', `You preferred ${short(w(exception.a))} to ${short(w(exception.b))}, even though the first felt less pleasant. A pleasing feeling is not a sufficient explanation for this choice.`, [prefEv(exception), gridEv('feeling', 'feeling', feel, exception)], { alternatives: ['An unpleasant response can coexist with interest in a subject or appreciation of its treatment. This observation does not identify which reason mattered to you.'], priority: 10 }));
    const p = patterns.quiet = pattern(comparisons(ids, pref, scores(feel, 1, -1), 20));
    if (p.direction !== null && p.direction !== 0) {
      const calm = p.direction === 1, pair = (calm ? p.support : p.counter)[0], opposite = (calm ? p.counter : p.support)[0];
      findings.push(makeFinding('felt-energy', calm ? 'Calmer responses went with preference.' : 'The more activating works held your preference.', `${short(w(pair.a))} was preferred to ${short(w(pair.b))}, and left you feeling ${calm ? 'calmer' : 'more activated'}. The other clear comparisons in this set went in the same direction. This concerns your felt response, rather than how busy the painting looks.`, [prefEv(pair), gridEv('feeling', 'feeling', feel, pair)], { counter: opposite ? [prefEv(opposite), gridEv('feeling', 'feeling', feel, opposite)] : [], alternatives: [scope], priority: 6 }));
    }
    const visuallyBusy = ids.find(id => w(id).features.energy >= .65 && feel[id][1] <= 35 && pref[id] >= 60);
    const quieter = visuallyBusy && ids.find(id => w(id).features.energy <= w(visuallyBusy).features.energy - .3 && feel[id][1] >= feel[visuallyBusy][1] + 20 && pref[visuallyBusy] >= pref[id] + margin);
    if (quieter) {
      const pair = { a: visuallyBusy, b: quieter };
      findings.push(makeFinding('activity-response', 'A busy image can still feel calm to you.', `You preferred ${short(w(visuallyBusy))}, which is annotated as visually active, yet found it calmer than ${short(w(quieter))}. The artwork's visual activity and the energy you feel in response are different signals.`, [prefEv(pair), gridEv('feeling', 'feeling', feel, pair)], { kind: 'hypothesis', counter: [], alternatives: ['Visual activity is a provisional editorial annotation. Subject, composition and prior associations may explain the difference in feeling.'], priority: 8 }));
    }
  }
  if(pref&&feel&&feelAxis==='response') {
    const p=patterns.quiet=pattern(comparisons(ids,pref,scores(feel,0,-1),20));
    if(p.direction!==null&&p.direction!==0){const calm=p.direction===1,pair=(calm?p.support:p.counter)[0];findings.push(makeFinding('felt-tension',calm?'Less tension accompanied preference.':'Tension did not prevent preference.',`You preferred ${short(w(pair.a))} to ${short(w(pair.b))}, while reporting ${calm?'less':'more'} tension. The other clear comparisons in this set went in the same direction.`,[prefEv(pair),gridEv('feeling','response',feel,pair)],{priority:6,alternatives:[scope,'Tension and involvement are distinct from pleasantness and arousal. This map does not measure either of those older dimensions.']}));}
    const reversal=comparisons(ids,pref,scores(feel,1),20).find(p=>p.direction<0);
    if(reversal)findings.push(makeFinding('involvement-preference','What absorbs you can differ from what you prefer.',`You preferred ${short(w(reversal.a))}, but ${short(w(reversal.b))} held more of your attention. Involvement alone does not explain that preference order.`,[prefEv(reversal),gridEv('feeling','response',feel,reversal)],{priority:10,alternatives:[scope,'Attention can reflect curiosity, difficulty, subject or personal associations. These choices do not isolate the reason.']}));
    const busy=ids.find(id=>w(id).features.energy>=.65&&feel[id][0]<=35&&pref[id]>=60),other=busy&&ids.find(id=>w(id).features.energy<=w(busy).features.energy-.3&&feel[id][0]>=feel[busy][0]+20&&pref[busy]>=pref[id]+margin);
    if(other){const pair={a:busy,b:other};findings.push(makeFinding('activity-response','A busy image can leave you at ease.',`You preferred ${short(w(busy))}, annotated as visually active, while reporting less tension than for ${short(w(other))}. Image activity and your tension response separated here.`,[prefEv(pair),gridEv('feeling','response',feel,pair)],{priority:8,kind:'hypothesis',alternatives:['Visual activity is a coarse editorial annotation. It is not the tension you reported.']}));}
  }
  if (pref && connection) {
    patterns.clarity = pattern(comparisons(ids, pref, scores(connection, 0), 20));
    const strong = [...ids].sort((a, b) => pref[b] - pref[a]).find(id => pref[id] >= 60 && connection[id][0] <= 35 && connection[id][1] >= 65);
    const lower = strong && ids.find(id => pref[strong] - pref[id] >= margin);
    if (lower) {
      const pair = { a: strong, b: lower };
      findings.push(makeFinding('connection-without-clarity', 'A connection can come before an explanation.', `You placed ${short(w(strong))} above ${short(w(lower))} while finding it hard to understand and personally resonant. Being able to explain this work was not a condition of choosing it over the other.`, [prefEv(pair), gridEv('connection', 'connection', connection, pair)], { alternatives: ['The response is specific to this work. Personal associations and the depicted subject remain possible explanations.'], priority: 9 }));
    }
  }
  if (clean.selfView) for (const statement of STATEMENTS) {
    const rating = clean.selfView.claims[statement.id], p = patterns[statement.id];
    let status = 'open', detail = 'There are too few clearly separated placements to test this description in this set.';
    if (p?.direction !== null && p?.direction !== undefined) {
      if (p.direction === 0) { status = 'mixed'; detail = 'Some comparisons follow this rule and others reverse it. The rule depends on which works are compared.'; }
      else if (rating >= 3) { status = p.direction === 1 ? 'fits' : 'exception'; detail = p.direction === 1 ? 'Your description and the clear comparisons point in the same direction here.' : 'The clear comparisons went against this description in this set. That suggests a limit to the rule, rather than an error about yourself.'; }
      else if (rating <= 1) { status = p.direction === 1 ? 'unendorsed' : 'compatible'; detail = p.direction === 1 ? 'This set followed a rule you did not endorse as a description of your taste. A local pattern can differ from your wider experience.' : 'The comparisons did not follow the rule you declined to endorse. That is compatible with your description, without establishing an opposite rule.'; }
      else { status = 'uncommitted'; detail = `You left the statement in between. The clear comparisons ${p.direction === 1 ? 'followed' : 'went against'} it in this set.`; }
    }
    const support = [evidence('selfView', `"${statement.text}" Your response: ${AGREEMENT[rating]}.`, ids)];
    if(statement.id==='quiet'&&feelAxis==='response')detail+=' This comparison uses reported tension, which is only one aspect of feeling calm.';
    const pack = pair => [prefEv(pair), statement.id === 'curiosity' ? curiosityEv(pair) : statement.id === 'quiet' ? gridEv('feeling', feelAxis, feel, pair) : gridEv('connection', 'connection', connection, pair)];
    const following = p?.support[0], reversing = p?.counter[0];
    if (following) support.push(...pack(following));
    const counter = reversing ? pack(reversing) : [];
    checks.push({ id: statement.id, statement: statement.text, answer: AGREEMENT[rating], status, detail, support, counter });
    if (rating >= 3 && reversing) {
      const specific = statement.id === 'quiet' ? `You preferred ${short(w(reversing.a))} even though it left you ${feelAxis==='response'?'more tense':'more activated'} than ${short(w(reversing.b))}.` : statement.id === 'curiosity' ? `You preferred ${short(w(reversing.a))}, but were more curious about ${short(w(reversing.b))}.` : `You preferred ${short(w(reversing.a))} while finding it harder to understand than ${short(w(reversing.b))}.`;
      const findingSupport = [support[0],...pack(reversing)], findingCounter = following ? pack(following) : [];
      findings.push(makeFinding('self-' + statement.id, statement.id === 'quiet' ? 'Your rule about calm has an exception.' : statement.id === 'curiosity' ? 'Your stated rule misses a split in these choices.' : 'Understanding explains only part of this preference.', `${specific} You ${rating === 4 ? 'agreed' : 'leaned towards agreeing'} with "${statement.text}" ${p.direction === 0 ? 'Other comparisons supported your description, so the pattern depends on the work.' : 'This set shows a limit to that description.'}`, findingSupport, { counter: findingCounter, kind: 'crosscheck', alternatives: [scope, 'A broad self-description and one small set can differ for reasonable reasons. This is not a measure of honesty or self-awareness.'], priority: 12 }));
    }
  }
  return { findings, checks };
}
