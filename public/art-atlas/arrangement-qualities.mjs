import {isGallery,validGallery,roomOf,roomName} from './gallery-model.mjs';
import {isSorting,validSorting,sortingDistance} from './sorting-table.mjs';
import {resolveArtworkAttributes} from './taste-patterns.mjs';
import {ARTWORK_ATTRIBUTE_DEFINITIONS} from './artwork-attribute-definitions.mjs';

export const ARRANGEMENT_QUALITIES_PROTOCOL='arrangement-qualities-v1';
export const ARRANGEMENT_QUALITY_THRESHOLDS=Object.freeze({minimumKnownWorks:6,minimumPresent:3,minimumAbsent:3,minimumArtists:3,minimumArtistsPerStatus:2,knownCoverage:.75,roomEffect:.15,sortingEffect:.25,sortingNear:.22,sortingFar:.5,minimumAlternativeAssignments:16,maximumAlternativeAssignments:128,maximumFindingsPerRecord:2});
const T=ARRANGEMENT_QUALITY_THRESHOLDS,keys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS);
const unique=values=>[...new Set(values)],mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const pairs=values=>values.flatMap((a,i)=>values.slice(i+1).map(b=>[a,b]));
const short=work=>work.shortTitle||work.title;
const knownArtist=work=>work?.artistKnown!==false&&typeof work?.artist==='string'&&!/unknown|unidentified|anonymous|workshop|^\s*$/i.test(work.artist)?work.artist.trim().toLowerCase():null;
const sourceId=record=>'scenario:'+record.id;
function evidence(record,workIds,detail,label){return {roundId:sourceId(record),label,workIds:unique(workIds),detail};}
function random(seed){let state=[...seed].reduce((s,c)=>(Math.imul(s,31)+c.charCodeAt(0))>>>0,2166136261);return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
function shuffle(values,next){const output=[...values];for(let i=output.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[output[i],output[j]]=[output[j],output[i]];}return output;}
function alternatives(ids,seed,signature){
  const observed=signature(ids),seen=new Set([observed]),output=[],next=random(seed);
  for(let attempt=0;attempt<4096&&output.length<T.maximumAlternativeAssignments;attempt++){
    const candidate=shuffle(ids,next),key=signature(candidate);if(seen.has(key))continue;seen.add(key);output.push(candidate);
  }
  return output;
}
function disjoint(values,limit=2){
  let best=[];
  function visit(start,selected,used){if(selected.length>best.length)best=selected;if(selected.length===limit)return;for(let i=start;i<values.length;i++){const pair=values[i];if(pair.some(id=>used.has(id)))continue;visit(i+1,[...selected,pair],new Set([...used,...pair]));if(best.length===limit)return;}}
  visit(0,[],new Set());return best;
}
function validRecord(record,works){
  if(!record||typeof record.id!=='string'||!record.id||!Number.isFinite(record.createdAt)||!Number.isFinite(record.finishedAt)||record.finishedAt<record.createdAt||record.confirmed!==true)return false;
  try{return isGallery(record)?validGallery(record,works):isSorting(record)&&validSorting(record,works);}catch{return false;}
}
function inspectedRecord(record,works){
  const museum=isGallery(record),presented=new Set(record.presentedIds),offered=new Set(record.offeredIds);
  const ids=(museum?Object.keys(record.placements):Object.keys(record.positions)).filter(id=>offered.has(id)&&presented.has(id)).sort();
  const byId=new Map(works.map(work=>[work.id,work]));
  const groups=museum?unique(ids.map(id=>roomOf(record,id))).sort().map(roomId=>({roomId,ids:ids.filter(id=>roomOf(record,id)===roomId)})):[];
  return {record,museum,instrument:museum?'museum':'sorting',ids,groups,byId};
}
function qualityOpportunity(info,key,reviews){
  const value=id=>reviews.get(id)?.attributes[key]?.status==='present'?1:reviews.get(id)?.attributes[key]?.status==='absent'?0:null;
  const known=info.ids.filter(id=>value(id)!==null),present=known.filter(id=>value(id)===1),absent=known.filter(id=>value(id)===0);
  const artists=ids=>unique(ids.map(id=>knownArtist(info.byId.get(id))).filter(Boolean));
  const sourceVariation={knownWorks:known.length,presentWorks:present.length,absentWorks:absent.length,unknownWorks:info.ids.length-known.length,artistCount:artists(known).length,presentArtistCount:artists(present).length,absentArtistCount:artists(absent).length};
  const usable=known.length>=T.minimumKnownWorks&&present.length>=T.minimumPresent&&absent.length>=T.minimumAbsent&&known.length/info.ids.length>=T.knownCoverage&&sourceVariation.artistCount>=T.minimumArtists&&sourceVariation.presentArtistCount>=T.minimumArtistsPerStatus&&sourceVariation.absentArtistCount>=T.minimumArtistsPerStatus;
  return {key,value,known,present,absent,sourceVariation,usable};
}
function mismatch(values,opportunity){return mean(values.map(([a,b])=>Math.abs(opportunity.value(a)-opportunity.value(b))));}
function describePair(info,opportunity,pair){return pair.map(id=>short(info.byId.get(id))+' ['+(opportunity.value(id)===1?'reviewed present':'reviewed absent')+']').join(' and ');}
function roomCandidate(info,opportunity){
  const groups=info.groups.map(group=>({...group,known:group.ids.filter(id=>opportunity.value(id)!==null)}));
  if(groups.filter(group=>group.known.length>=2).length<2)return null;
  const ordered=groups.flatMap(group=>group.known),counts=groups.map(group=>group.known.length);
  const unpack=assignment=>{let start=0;return counts.map(count=>{const part=assignment.slice(start,start+count);start+=count;return part;});};
  const signature=assignment=>JSON.stringify(unpack(assignment).map(ids=>[...ids].sort()));
  const score=assignment=>mean(unpack(assignment).filter(ids=>ids.length>=2).map(ids=>mismatch(pairs(ids),opportunity)));
  const distribution=alternatives(ordered,'rooms|'+ordered.join('|')+'|'+counts.join(','),signature).map(score).filter(Number.isFinite);
  const observed=score(ordered),baseline=mean(distribution),effect=baseline===null?0:baseline-observed;
  if(distribution.length<T.minimumAlternativeAssignments||Math.max(...distribution)-Math.min(...distribution)<.1||Math.abs(effect)<T.roomEffect)return null;
  const direction=Math.sign(effect),states=group=>group.known.map(opportunity.value);
  let supporting;
  if(direction>0){
    const present=groups.filter(group=>states(group).filter(value=>value===1).length>=2&&mean(states(group))>=.75).sort((a,b)=>b.known.length-a.known.length)[0];
    const absent=groups.filter(group=>states(group).filter(value=>value===0).length>=2&&mean(states(group))<=.25).sort((a,b)=>b.known.length-a.known.length)[0];
    if(!present||!absent||present.roomId===absent.roomId)return null;supporting=[present,absent];
  }else{
    supporting=groups.filter(group=>states(group).includes(0)&&states(group).includes(1)).sort((a,b)=>b.known.length-a.known.length).slice(0,2);
    if(supporting.length<2)return null;
  }
  const support=supporting.map(group=>evidence(info.record,group.known,roomName(info.record,group.roomId)+': '+group.known.map(id=>short(info.byId.get(id))+' ['+(opportunity.value(id)?'present':'absent')+']').join('; ')+'.','Room membership and reviewed quality'));
  const all=pairs(opportunity.known),contrary=direction>0?all.find(([a,b])=>roomOf(info.record,a)===roomOf(info.record,b)&&opportunity.value(a)!==opportunity.value(b))||all.find(([a,b])=>roomOf(info.record,a)!==roomOf(info.record,b)&&opportunity.value(a)===1&&opportunity.value(b)===1):all.find(([a,b])=>roomOf(info.record,a)===roomOf(info.record,b)&&opportunity.value(a)===opportunity.value(b));
  const counter=contrary?[evidence(info.record,contrary,describePair(info,opportunity,contrary)+(roomOf(info.record,contrary[0])===roomOf(info.record,contrary[1])?' share a room.':' occupy different rooms.')+' The quality does not determine every grouping.','A limit within this arrangement')]:[];
  return {opportunity,direction,effect,support,counter,metrics:{withinRoomMismatch:observed,alternativeMeanMismatch:baseline,alternativeAssignments:distribution.length,roomSizes:groups.map(group=>({roomId:group.roomId,placed:group.ids.length,known:group.known.length})),unknownPlacementPolicy:'Unknown-quality works stay fixed; only known works move among their occupied room slots.'}};
}
function sortingCandidate(info,opportunity){
  const diagonal=Math.hypot(1.5,1),geometry=pairs(opportunity.known).map(ids=>({ids,distance:sortingDistance(info.record.positions[ids[0]],info.record.positions[ids[1]])/diagonal}));
  const near=geometry.filter(pair=>pair.distance<=T.sortingNear).map(pair=>pair.ids),far=geometry.filter(pair=>pair.distance>=T.sortingFar).map(pair=>pair.ids);
  if(near.length<4||far.length<4)return null;
  const slots=[...opportunity.known].sort(),index=new Map(slots.map((id,i)=>[id,i]));
  const score=assignment=>{
    const value=id=>opportunity.value(assignment[index.get(id)]),gap=pair=>Math.abs(value(pair[0])-value(pair[1]));
    return mean(far.map(gap))-mean(near.map(gap));
  };
  const distribution=alternatives(slots,'sorting|'+slots.map(id=>id+':'+info.record.positions[id].join(',')).join('|'),JSON.stringify).map(score);
  const observed=score(slots),baseline=mean(distribution),effect=observed-baseline;
  if(distribution.length<T.minimumAlternativeAssignments||Math.max(...distribution)-Math.min(...distribution)<.1||Math.abs(effect)<T.sortingEffect)return null;
  const direction=Math.sign(effect),same=([a,b])=>opportunity.value(a)===opportunity.value(b);
  const nearSupport=disjoint(near.filter(pair=>same(pair)===(direction>0))),farSupport=disjoint(far.filter(pair=>same(pair)===(direction<0)));
  if(nearSupport.length<2||farSupport.length<2)return null;
  const support=[...nearSupport.map(pair=>evidence(info.record,pair,'Near on the fixed table: '+describePair(info,opportunity,pair)+'.','Near pair and reviewed quality')),...farSupport.map(pair=>evidence(info.record,pair,'Far on the fixed table: '+describePair(info,opportunity,pair)+'.','Far pair and reviewed quality'))];
  const contrary=near.find(pair=>same(pair)!==(direction>0))||far.find(pair=>same(pair)!==(direction<0));
  const counter=contrary?[evidence(info.record,contrary,(near.includes(contrary)?'A near pair: ':'A far pair: ')+describePair(info,opportunity,contrary)+'. This pair runs against the main near-versus-far description.','An exception on the table')]:[];
  return {opportunity,direction,effect,support,counter,metrics:{nearPairCount:near.length,farPairCount:far.length,nearMismatch:mismatch(near,opportunity),farMismatch:mismatch(far,opportunity),alternativeMeanContrast:baseline,alternativeAssignments:distribution.length,positionPolicy:'The actually placed centres on the fixed 3:2 board stay fixed. Known-work identities are reassigned only among those occupied slots; unknowns remain fixed.',nearThreshold:T.sortingNear,farThreshold:T.sortingFar}};
}
function correlated(first,second){
  const ids=first.known.filter(id=>second.value(id)!==null);if(ids.length<6)return false;
  const a=ids.map(first.value),b=ids.map(second.value),ma=mean(a),mb=mean(b),denominator=Math.sqrt(a.reduce((sum,value)=>sum+(value-ma)**2,0)*b.reduce((sum,value)=>sum+(value-mb)**2,0));
  return denominator>0&&Math.abs(a.reduce((sum,value,i)=>sum+(value-ma)*(b[i]-mb),0)/denominator)>=.85;
}
function displayExample(info,candidate){
  const opportunity=candidate.opportunity,shared=candidate.direction>0;
  const choosePair=(first,second)=>{const combinations=first.flatMap(a=>second.filter(b=>b!==a).map(b=>[a,b]));return combinations.find(([a,b])=>knownArtist(info.byId.get(a))!==knownArtist(info.byId.get(b)))||combinations[0]||[];};
  let ids;
  if(info.museum){
    const first=candidate.support[0].workIds,second=shared?candidate.support[1].workIds:first;
    ids=choosePair(first.filter(id=>opportunity.value(id)===1),second.filter(id=>opportunity.value(id)===0));
  }else{
    const near=candidate.support.filter(item=>item.label==='Near pair and reviewed quality');
    ids=(shared?near.find(item=>item.workIds.every(id=>opportunity.value(id)===1)):null)?.workIds||near[0]?.workIds||[];
  }
  const label=ARTWORK_ATTRIBUTE_DEFINITIONS[opportunity.key].label.toLowerCase();
  return {displayWorkIds:ids,displayNotes:Object.fromEntries(ids.map(id=>[id,{description:(info.museum?roomName(info.record,roomOf(info.record,id)):'Near on your sorting table')+' · '+label+' '+(opportunity.value(id)===1?'present':'reviewed absent')}])),displayRoles:Object.fromEntries(ids.map(id=>[id,{role:info.museum?shared?'contrasting-room-quality':'within-room-quality-contrast':'sorting-near-example',qualityStatus:opportunity.value(id)===1?'present':'absent',qualityKey:opportunity.key,sourceRecordId:info.record.id,roomId:info.museum?roomOf(info.record,id):null}]))};
}
function finding(info,candidate,reviews,coinciding){
  const {opportunity,direction,support,counter,metrics}=candidate,key=opportunity.key,label=ARTWORK_ATTRIBUTE_DEFINITIONS[key].label.toLowerCase();
  const place=info.museum?'room groups':'sorting table',shared=direction>0;
  const text=info.museum?shared?
    'You placed several works with '+label+' in one room and several reviewed without it in another. Within-room matches exceed the average of alternative assignments of these same selected works with the same room sizes.':
    'At least two rooms bring together works reviewed with and without '+label+'. This mixing exceeds the average of alternative assignments of these same selected works with the same room sizes.':shared?
    'Near pairs more often match in '+label+' and far pairs more often differ than in alternative assignments to the same occupied table positions. The exact near and far examples remain separate evidence.':
    'Near pairs more often differ in '+label+' while far pairs more often match than in alternative assignments to the same occupied table positions. This describes a contrast in the arrangement.';
  const sourceRoundId=sourceId(info.record),annotationEvidence=opportunity.known.map(id=>({workId:id,qualityKey:key,status:opportunity.value(id)?'present':'absent',reason:reviews.get(id).attributes[key].reason,...reviews.get(id).annotationBasis,sourceUrls:reviews.get(id).sourceUrls}));
  const sourceUrls=unique(annotationEvidence.flatMap(item=>item.sourceUrls));
  return {id:'arrangement-quality-'+encodeURIComponent(info.record.id)+'-'+key,module:'arrangement-quality',kind:'curation',protocol:ARRANGEMENT_QUALITIES_PROTOCOL,status:'descriptive-arrangement',qualityKey:key,qualityKeys:[key],attributes:[key],instrument:info.instrument,
    measurementScope:info.museum?'selected-museum-room-membership':'free-sort-relatedness-proximity',relation:shared?'grouped-by-shared-quality':'grouped-by-quality-contrast',direction,directionMeaning:'+1 describes more quality matching; -1 describes more quality contrast. Neither direction is a liking or dislike.',
    sourceRecordId:info.record.id,sourceRecordIds:[info.record.id],sourceRoundIds:[sourceRoundId],independenceUnit:sourceRoundId,dependentTaskCount:1,
    title:ARTWORK_ATTRIBUTE_DEFINITIONS[key].label+(shared?' helps describe your '+place+'.':' crosses close relationships in your '+place+'.'),text,
    workIds:[...opportunity.known],evidence:unique([...support,...counter].flatMap(item=>item.workIds)),support,counter,annotationEvidence,sourceUrls,sourceVariation:opportunity.sourceVariation,metrics,coincidingQualityKeys:coinciding,...displayExample(info,candidate),
    priority:11,notPreferenceEvidence:true,
    alternatives:[
      'One arrangement is one dependent task. Pair examples and alternative assignments do not create independent responses, a confidence percentage or a significance test.',
      'Reviewed absent describes a visible quality, not a negative preference. Unknown or mismatched source reviews provide no quality value. Offered or unhung works do not enter this grouping comparison.',
      'The selected artworks and occupied room sizes or table positions stay fixed. The alternatives describe this arrangement; they do not control artist, subject, date, palette or personal associations.',
      ...(coinciding.length?['These same placements also align with '+coinciding.map(other=>ARTWORK_ATTRIBUTE_DEFINITIONS[other].label.toLowerCase()).join(', ')+'. Their effects are not separated.']:[]),
      'The quality reviews describe the exact reproductions and are assistant editorial interpretations. They are not independent human validation, museum-authored scores or evidence of why the viewer arranged the works.',
      info.museum?'Room membership is the chosen relationship. Automatic wall positions and unused wall capacity are not additional grouping or dislike evidence.':'Only placed centres supply proximity. Stack order, zoom, cursor position and default empty positions are not preference or attention evidence.'
    ]};
}

/** Describe source-reviewed qualities in actual arrangements, without training taste. */
export function analyzeArrangementQualities({works=[],records=[],annotationReviews={},currentWorks=[]}={}){
  works=Array.isArray(works)?works:[];records=Array.isArray(records)?records:[];currentWorks=Array.isArray(currentWorks)?currentWorks:[];
  const workCounts=new Map();for(const work of works)if(work?.id)workCounts.set(work.id,(workCounts.get(work.id)||0)+1);
  works=works.filter(work=>work&&workCounts.get(work.id)===1);
  const recordCounts=new Map();for(const record of records)if(record?.id)recordCounts.set(record.id,(recordCounts.get(record.id)||0)+1);
  const valid=records.filter(record=>recordCounts.get(record?.id)===1&&validRecord(record,works));
  const reviews=new Map(works.map(work=>[work.id,resolveArtworkAttributes(work,{annotationReviews,currentWorks})]));
  const findings=[],unavailable=[],recordCoverage=[];
  for(const record of valid){
    const info=inspectedRecord(record,works),opportunities=keys.map(key=>qualityOpportunity(info,key,reviews)),usable=opportunities.filter(item=>item.usable);
    const candidates=usable.map(opportunity=>info.museum?roomCandidate(info,opportunity):sortingCandidate(info,opportunity)).filter(Boolean).sort((a,b)=>Math.abs(b.effect)-Math.abs(a.effect)||a.opportunity.key.localeCompare(b.opportunity.key));
    const selected=[];
    for(const candidate of candidates){if(selected.some(other=>correlated(other.opportunity,candidate.opportunity)))continue;selected.push(candidate);if(selected.length===T.maximumFindingsPerRecord)break;}
    for(const candidate of selected)findings.push(finding(info,candidate,reviews,candidates.filter(other=>other!==candidate&&correlated(candidate.opportunity,other.opportunity)).map(other=>other.opportunity.key)));
    recordCoverage.push({sourceRecordId:record.id,instrument:info.instrument,placedPresentedWorks:info.ids.length,qualitiesWithReviewedContrasts:usable.length,qualifyingFindings:selected.length});
    if(!selected.length)unavailable.push({sourceRecordId:record.id,instrument:info.instrument,reason:!usable.length?'No quality has enough reviewed-present and reviewed-absent works, artist variation and source coverage.':'Reviewed contrasts exist, but this arrangement does not meet the descriptive grouping and exception-opportunity rules. Unknown values are not filled in.'});
  }
  return {protocol:ARRANGEMENT_QUALITIES_PROTOCOL,findings,coverage:{validRecords:valid.length,museumRecords:valid.filter(isGallery).length,sortingRecords:valid.filter(isSorting).length,records:recordCoverage},unavailable,limits:['Arrangement quality descriptions remain separate from preference, admiration and choice-model qualification.','Only exact source-bound reviewed qualities contribute. Missing reviews and unknown statuses remain unknown.']};
}
