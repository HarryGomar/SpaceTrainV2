import {hasComparisonMarker} from './profile-evidence.mjs';
import {isContinuousPreferenceRound} from './continuous-preference.mjs';
import {validAnswer} from './engine.mjs';
import {validContrastAnswer, allowsMultipleNeighbourReasons, neighbourRelationshipLabels} from './contrast-rounds.mjs';
import {isComparisonPreferenceRound,responseGapRequired} from './comparison-protocol.mjs';
const orderOnly=round=>isComparisonPreferenceRound(round)&&!isContinuousPreferenceRound(round);

export const CONTRAST_READING_THRESHOLDS = Object.freeze({preferenceGap:15, featureGap:.25, minimumSubjectSets:2});
const unique = values => [...new Set(values)];
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const ids = round => round.works.map(work => work.id);
const signature = round => JSON.stringify([...ids(round)].sort());
const short = work => work.shortTitle || work.title;
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const features = {complexity:['sparser compositions','denser compositions'], color:['restrained colour','more intense colour'], abstraction:['more representational treatment','more abstract treatment'], energy:['quieter compositions','more visual activity']};
const families = new Set(['individual-choice','feature-check','unconditional-preference','adaptive-preference']);
const scope = 'These observations connect recorded decisions under different instructions. They do not establish a personality, a stable motive or the cause of a choice.';
const joinLabels = labels => labels.length < 2 ? labels[0] || '' : labels.slice(0,-1).join(', ') + ' and ' + labels.at(-1);
const comparableGap=item=>orderOnly(item.source.round)?Math.sign(item.gap):item.gap;
function earlierLabel(source,id){
  const value=source.answer.positions[id];
  if(!orderOnly(source.round))return 'Earlier preference: '+value+' / 100';
  const values=source.round.works.map(work=>source.answer.positions[work.id]),rank=1+values.filter(other=>other>value).length;
  return 'Earlier order: '+(values.filter(other=>other===value).length>1?'joint ':'')+rank+' of '+values.length;
}
const sourceRole = entry => entry.round.evidence?.repeatOf ? 'repeated preference' : entry.round.kind === 'spectrum' ? 'earlier preference' : entry.round.contrastKind === 'neighbour' ? 'connection beside a fixed anchor' : entry.round.contrastKind === 'keep-leave' ? 'relative keep and leave choices' : 'subject-matched choice';

function entriesFor(works, rounds, answers) {
  const workCounts = new Map(), roundCounts = new Map();
  for (const work of works) if (text(work?.id)) workCounts.set(work.id, (workCounts.get(work.id) || 0) + 1);
  for (const round of rounds) if (text(round?.id)) roundCounts.set(round.id, (roundCounts.get(round.id) || 0) + 1);
  const known = new Set(works.filter(work => workCounts.get(work?.id) === 1 && text(work.title)).map(work => work.id));
  return rounds.flatMap((round, index) => {
    if (!plain(round) || !text(round.id) || roundCounts.get(round.id) !== 1 || round.unavailable || !Array.isArray(round.works) || round.works.length < 2) return [];
    const offered = ids(round), anchors = (round.anchorWorks || []).map(work => work?.id);
    if (new Set(offered).size !== offered.length || [...offered,...anchors].some(id => !known.has(id))) return [];
    const answer = answers[round.id];
    if (!plain(answer) || answer.skipped) return [];
    let valid = false;
    if (round.kind === 'contrast') valid = validContrastAnswer(round, answer);
    else if (round.kind === 'spectrum' && round.criterion === 'preference' && round.evidence?.construct === 'preference' && (!hasComparisonMarker(round)||isComparisonPreferenceRound(round)) && families.has(round.evidence.family) && round.evidence.unconditional !== false && !anchors.length && !round.anchorIds?.length && !round.brief && !round.evidence?.brief) {
      try { valid = validAnswer(round, answer); } catch { valid = false; }
    }
    return valid ? [{round, answer, index}] : [];
  });
}

function ev(entry, detail, workIds, label) {
  return {roundId:entry.round.id, label:label || entry.round.title, prompt:entry.round.prompt || entry.round.title, detail, workIds:unique(workIds), role:entry.round.evidence?.role || 'discovery', sourceRole:sourceRole(entry), construct:entry.round.evidence?.construct, ...(entry.round.evidence?.repeatOf ? {repeatOf:entry.round.evidence.repeatOf} : {})};
}
function preferenceEvidence(entry, pair) {
  return ev(entry, pair.map(id => `${short(entry.round.works.find(work => work.id === id))}: preference ${entry.answer.positions[id]}`).join('; ') + '.', pair);
}
function previousPreference(preferences, entry, a, b) { return preferences.filter(previous => previous.index < entry.index && ids(previous.round).includes(a) && ids(previous.round).includes(b)).at(-1); }
function distinctSets(values, getEntry = value => value.entry) {
  const seen = new Set();
  return values.filter(value => { const key = signature(getEntry(value).round); if (seen.has(key)) return false; seen.add(key); return true; });
}
function finding(id, module, title, body, support, counter, comparisons, alternatives, rest = {}) {
  return {id,module,title,text:body,kind:'taste',priority:11,support,counter,comparisons,evidence:unique([...support,...counter].flatMap(item => item.workIds)),alternatives:[scope,...alternatives],...rest};
}
function categorical(workIds, notes, sourceRoundIds, role = 'support') { return {kind:'categorical-contrast', workIds, notes, sourceRoundIds, role}; }

function keepLeaveReading(entries, preferences) {
  const linked = entries.filter(entry => entry.round.contrastKind === 'keep-leave').flatMap(entry => {
    const a = entry.answer.keepId, b = entry.answer.leaveId, source = previousPreference(preferences, entry, a, b);
    if (!source) return [];
    const gap = source.answer.positions[a] - source.answer.positions[b];
    return Math.abs(gap) >= responseGapRequired(source.round) ? [{entry,source,a,b,gap}] : [];
  });
  const support = distinctSets(linked.filter(item => item.gap <= -responseGapRequired(item.source.round))), counter = distinctSets(linked.filter(item => item.gap >= responseGapRequired(item.source.round)));
  if (!support.length) return null;
  const sample = support[0], kept = sample.entry.round.works.find(work => work.id === sample.a), left = sample.entry.round.works.find(work => work.id === sample.b);
  const pack = item => [preferenceEvidence(item.source,[item.a,item.b]),ev(item.entry,`Kept ${short(item.entry.round.works.find(work => work.id === item.a))}; left ${short(item.entry.round.works.find(work => work.id === item.b))}. The other four were not ranked.`,ids(item.entry.round))];
  const comparison = (item, role = 'support') => categorical([item.a,item.b], {
    [item.a]:[{role:'earlier-preference',tone:'preference',text:earlierLabel(item.source,item.a)},{role:'keep',tone:'curation',text:'Kept'}],
    [item.b]:[{role:'earlier-preference',tone:'preference',text:earlierLabel(item.source,item.b)},{role:'leave',tone:'curation',text:'Left out'}]
  },[item.source.round.id,item.entry.round.id],role);
  return finding('contrast-keep-leave','taste-and-selection','You kept a work you had ranked lower.',`You had placed ${short(left)} above ${short(kept)}. In the later six-work choice, you kept ${short(kept)} and left ${short(left)}.${support.length > 1 ? ` This change appeared in ${support.length} distinct offered sets.` : ''}${counter.length ? ' Other recorded selections kept the earlier order.' : ''}`,support.slice(0,3).flatMap(pack),counter.slice(0,2).flatMap(pack),[...support.slice(0,2).map(item => comparison(item)),...counter.slice(0,1).map(item => comparison(item,'counter'))],[
    'Keep and leave are relative decisions among six. The other four remain unranked, and leaving a work is not an absolute dislike.',
    'The earlier source contains this exact pair, but its other offered works can differ. The instructions, company, attention and elapsed time changed together.',
    'Each six-work set contributes once per direction. A return to the same set can supply counterevidence, not an independent replication. Linked earlier ratings and repeated pictures remain dependent evidence.',
    'Continuous personal appeal retains its reported values and gaps. Earlier order-only comparisons use order and exact ties; older rating instruments retain their original gap rule. These are not confidence estimates.'
  ],{supportingSetCount:support.length,counterSetCount:counter.length});
}

function neighbourReading(entries, preferences) {
  const records = entries.filter(entry => entry.round.contrastKind === 'neighbour' && entry.answer.neighbourId).flatMap(entry => {
    const a = entry.answer.neighbourId;
    const linked = ids(entry.round).filter(id => id !== a).flatMap(b => {
      const source = previousPreference(preferences, entry, a, b);
      return source ? [{entry,source,a,b,gap:source.answer.positions[a]-source.answer.positions[b]}] : [];
    });
    const reversal = linked.filter(item => item.gap <= -responseGapRequired(item.source.round)).sort((a,b) => comparableGap(a)-comparableGap(b))[0];
    const aligned = linked.filter(item => item.gap >= responseGapRequired(item.source.round)).sort((a,b) => comparableGap(b)-comparableGap(a))[0];
    return [reversal,aligned].filter(Boolean);
  });
  const support = distinctSets(records.filter(item => item.gap < 0)), counter = distinctSets(records.filter(item => item.gap > 0));
  if (!support.length) return null;
  const sample = support[0], work = id => sample.entry.round.works.find(candidate => candidate.id === id), anchor = sample.entry.round.anchorWorks[0];
  const relationships = neighbourRelationshipLabels(sample.entry.round,sample.entry.answer), relationship = joinLabels(relationships);
  const pack = item => {
    const anchor = item.entry.round.anchorWorks[0], chosen = item.entry.round.works.find(work => work.id === item.a), labels = neighbourRelationshipLabels(item.entry.round,item.entry.answer), label = joinLabels(labels);
    return [preferenceEvidence(item.source,[item.a,item.b]),ev(item.entry,`Chose ${short(chosen)} beside ${short(anchor)} under "${item.entry.round.prompt || item.entry.round.title}".${label ? ` Reported connection${labels.length > 1 ? 's' : ''}: ${label}.` : ''} Other candidates were not ranked.`,[anchor.id,...ids(item.entry.round)])];
  };
  const comparison = (item, role = 'support') => categorical([item.a,item.b], {
    [item.a]:[{role:'earlier-preference',tone:'preference',text:earlierLabel(item.source,item.a)},{role:'chosen-neighbour',tone:'curation',text:'Chosen beside '+short(item.entry.round.anchorWorks[0])}],
    [item.b]:[{role:'earlier-preference',tone:'preference',text:earlierLabel(item.source,item.b)},{role:'offered-neighbour',tone:'neutral',text:'Offered, not chosen'}]
  },[item.source.round.id,item.entry.round.id],role);
  return finding('contrast-neighbour','taste-and-neighbours','Your chosen neighbour differed from your earlier preference.',`You preferred ${short(work(sample.b))} to ${short(work(sample.a))}, then chose ${short(work(sample.a))} as the stronger connection to ${short(anchor)}.${relationship ? allowsMultipleNeighbourReasons(sample.entry.round) ? ` You named ${relationship.toLowerCase()} as connections.` : ` You connected them through ${relationship.toLowerCase()}.` : ''}${counter.length ? ' Other recorded comparisons also aligned with earlier preference.' : ''}`,support.slice(0,3).flatMap(pack),counter.slice(0,2).flatMap(pack),[...support.slice(0,2).map(item => comparison(item)),...counter.slice(0,1).map(item => comparison(item,'counter'))],[
    'The neighbour task asks for a connection to one fixed painting. It is not an unconditional preference or an answer with a single correct pairing.',
    'An offered candidate that was not chosen is not a dislike. This reading compares only pairs that had an earlier complete preference response.',
    'The anchor, company, instructions, timing and any earlier knowledge differ. A reported connection is an explanation offered in this task, not a demonstrated cause.',
    'Each candidate set contributes once per direction; a later opposing choice remains counterevidence, not an independent replication. The fixed anchor remains attached to its evidence.',
    ...(records.some(item => allowsMultipleNeighbourReasons(item.entry.round)) ? ['Several reported reasons still describe one pairing decision. They are not separate preference responses or independent supporting observations.'] : [])
  ],{supportingSetCount:support.length,counterSetCount:counter.length});
}

function subjectReversalReading(entries, preferences) {
  const records = entries.filter(entry => entry.round.contrastKind === 'same-subject' && entry.answer.preferredId).flatMap(entry => {
    const a = entry.answer.preferredId;
    const linked = ids(entry.round).filter(id => id !== a).flatMap(b => {
      const source = previousPreference(preferences,entry,a,b);
      return source ? [{entry,source,a,b,gap:source.answer.positions[a]-source.answer.positions[b]}] : [];
    });
    return [
      linked.filter(item => item.gap <= -responseGapRequired(item.source.round)).sort((a,b) => comparableGap(a)-comparableGap(b))[0],
      linked.filter(item => item.gap >= responseGapRequired(item.source.round)).sort((a,b) => comparableGap(b)-comparableGap(a))[0]
    ].filter(Boolean);
  });
  const support = distinctSets(records.filter(item => item.gap < 0)), counter = distinctSets(records.filter(item => item.gap > 0));
  if (!support.length) return null;
  const sample = support[0], work = id => sample.entry.round.works.find(candidate => candidate.id === id);
  const pack = item => [preferenceEvidence(item.source,[item.a,item.b]),ev(item.entry,`${item.entry.round.subject.description || item.entry.round.subject.label} Chose ${short(item.entry.round.works.find(work => work.id === item.a))} under "${item.entry.round.prompt || item.entry.round.title}". The unchosen alternatives were not ranked.`,ids(item.entry.round))];
  const comparison = (item, role = 'support') => ({...categorical([item.a,item.b],{
    [item.a]:[{role:'earlier-preference',tone:'preference',text:earlierLabel(item.source,item.a)},{role:'preferred-treatment',tone:'preference',text:'Chosen in the subject comparison'}],
    [item.b]:[{role:'earlier-preference',tone:'preference',text:earlierLabel(item.source,item.b)},{role:'offered-treatment',tone:'neutral',text:'Offered alternative'}]
  },[item.source.round.id,item.entry.round.id],role),subjectId:item.entry.round.subject.id,subjectLabel:item.entry.round.subject.label});
  return finding('contrast-subject-reversal','subject-and-treatment',sample.entry.round.works.length === 2 ? 'Your two-work choice reversed the earlier order.' : 'Your subject-matched choice reversed an earlier order.',`You placed ${short(work(sample.b))} above ${short(work(sample.a))} in the earlier preference comparison. You then chose ${short(work(sample.a))} in the later ${sample.entry.round.subject.label.toLowerCase()} comparison.${support.length > 1 ? ` A reversal appeared in ${support.length} distinct subject sets.` : ''}${counter.length ? ' Other recorded pair relations kept the earlier preference order.' : ''}`,support.slice(0,3).flatMap(pack),counter.slice(0,2).flatMap(pack),[...support.slice(0,2).map(item => comparison(item)),...counter.slice(0,1).map(item => comparison(item,'counter'))],[
    'This links a later explicit choice to the latest eligible earlier unconditional preference response containing the exact same pair. The earlier full offered set can be larger or different.',
    'The shared-subject brief, offered company, repeated viewing, attention and timing can all change together. The reversal does not show that subject framing caused the choice.',
    'The later choice records a direction, not a numeric strength. No-clear-preference answers supply no direction, and unchosen alternatives remain unranked.',
    ...unique([...support,...counter].flatMap(item => item.entry.round.residualConfounds)),
    'Each subject set contributes once per direction. Aligned and opposing pair relations can coexist inside one set; they are local evidence, not a trait or an independent replication.',
    'Continuous personal appeal retains its reported values and gaps. Earlier order-only comparisons use order and exact ties; older rating instruments retain their original gap rule. These are not confidence estimates.'
  ],{readingBasis:'matched-earlier-preference',supportingSetCount:support.length,counterSetCount:counter.length,priority:11});
}

function subjectReading(entries) {
  const subjects = entries.filter(entry => entry.round.contrastKind === 'same-subject' && entry.answer.preferredId).map(entry => ({entry}));
  if (subjects.length < CONTRAST_READING_THRESHOLDS.minimumSubjectSets) return null;
  const candidates = [];
  for (const key of Object.keys(features)) for (const direction of [-1,1]) {
    const records = subjects.flatMap(({entry}) => {
      const chosen = entry.round.works.find(work => work.id === entry.answer.preferredId), value = chosen.features?.[key];
      if (!Number.isFinite(value) || value < 0 || value > 1) return [];
      const alternatives = entry.round.works.filter(work => work.id !== chosen.id);
      if (alternatives.some(work => !Number.isFinite(work.features?.[key]) || work.features[key] < 0 || work.features[key] > 1)) return [];
      const gaps = alternatives.map(work => value-work.features[key]), gap = mean(gaps), strongest = [...alternatives].sort((a,b) => Math.abs(value-b.features[key])-Math.abs(value-a.features[key]))[0];
      if (Math.abs(gap) < CONTRAST_READING_THRESHOLDS.featureGap || !strongest) return [];
      return [{entry,chosen,other:strongest,gap}];
    });
    const support = distinctSets(records.filter(record => record.gap*direction >= CONTRAST_READING_THRESHOLDS.featureGap)), counter = distinctSets(records.filter(record => record.gap*direction <= -CONTRAST_READING_THRESHOLDS.featureGap));
    if (support.length < 2 || counter.length >= support.length || unique(support.map(record => record.chosen.id)).length < 2 || unique(support.flatMap(record => [record.chosen.id,record.other.id])).length < 4) continue;
    candidates.push({key,direction,support,counter,strength:mean(support.map(record => Math.abs(record.gap)))});
  }
  candidates.sort((a,b) => b.support.length-a.support.length || a.counter.length-b.counter.length || b.strength-a.strength || Object.keys(features).indexOf(a.key)-Object.keys(features).indexOf(b.key));
  const best = candidates[0]; if (!best) return null;
  const label = features[best.key][best.direction > 0 ? 1 : 0], sample = best.support[0];
  const pack = item => ev(item.entry,`${item.entry.round.subject.description || item.entry.round.subject.label} Chose ${short(item.chosen)}; other works were not ranked. Its editorial ${best.key} description is ${item.chosen.features[best.key]}; ${short(item.other)} is ${item.other.features[best.key]}.`,ids(item.entry.round));
  const comparisons = best.support.slice(0,3).map(item => categorical([item.chosen.id,item.other.id], {
    [item.chosen.id]:[{role:'preferred-treatment',tone:'preference',text:'Preferred treatment'}],
    [item.other.id]:[{role:'offered-treatment',tone:'neutral',text:'Offered alternative'}]
  },[item.entry.round.id]));
  const coexplaining = unique(candidates.filter(candidate => candidate.key !== best.key && candidate.support.some(record => best.support.some(other => other.entry.round.id === record.entry.round.id))).map(candidate => features[candidate.key][candidate.direction > 0 ? 1 : 0]));
  return finding('contrast-subject','subject-and-treatment','These choices leaned toward '+label+'.',`Across ${best.support.length} reviewed sets with a shared subject inside each set, your chosen treatments aligned with ${label}. For ${sample.entry.round.subject.label.toLowerCase()}, you chose ${short(sample.chosen)}.${best.counter.length ? ' Other subject-matched choices went against this description.' : ''}`,best.support.slice(0,3).map(pack),best.counter.slice(0,2).map(pack),comparisons,[
    'A shared subject is a broad curatorial match. It can still mean different people, places, flowers or arrangements.',
    'The numeric descriptions are provisional editorial annotations, not participant ratings or isolated causes. The 0.25 contrast threshold is a design rule.',
    ...unique([...best.support,...best.counter].flatMap(record => record.entry.round.residualConfounds)),
    ...(coexplaining.length ? ['These choices also align with '+coexplaining.join(', ')+'. The tasks have not separated those explanations.'] : []),
    'Each reviewed set contributes once per direction. A changed return response can supply counterevidence, not an independent replication. No-clear-preference answers and unchosen alternatives do not become numeric rankings.'
  ],{feature:best.key,direction:best.direction,supportingSetCount:best.support.length,counterSetCount:best.counter.length,competingDescriptions:coexplaining,priority:9});
}

/** No chronology-to-personality finding is produced. Dates remain separate task feedback. */
export function buildContrastReadings({works = [], rounds = [], answers = {}} = {}) {
  if (!Array.isArray(works) || !Array.isArray(rounds) || !plain(answers)) return [];
  const entries = entriesFor(works,rounds,answers), preferences = entries.filter(entry => entry.round.kind === 'spectrum');
  return [keepLeaveReading(entries,preferences),neighbourReading(entries,preferences),subjectReversalReading(entries,preferences),subjectReading(entries)].filter(Boolean).sort((a,b) => b.priority-a.priority);
}
