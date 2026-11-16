import {ARTWORK_ATTRIBUTE_DEFINITIONS} from './artwork-attribute-definitions.mjs';
const unique=values=>[...new Set(values)];

/** Link a qualified preference description to a separate arrangement context.
 * Arrangement evidence never changes the preference fit or its denominator. */
export function linkArrangementPatterns(patterns=[],findings=[]){
  return patterns.map(pattern=>{
    if(pattern.summaryEligible!==true||!['qualified','descriptive','descriptive-association'].includes(pattern.status)||!Array.isArray(pattern.attributes)||!pattern.attributes.length)return pattern;
    const preferenceIds=new Set([...(pattern.evidence||[]),...(pattern.support||[]).flatMap(item=>item.workIds||[])]);
    const connections=findings.flatMap(finding=>{
      if(finding?.module!=='arrangement-quality'||finding.notPreferenceEvidence!==true||finding.status!=='descriptive-arrangement'||!['grouped-by-shared-quality','grouped-by-quality-contrast'].includes(finding.relation)||!Array.isArray(finding.sourceRoundIds)||!finding.sourceRoundIds.length||!finding.sourceRoundIds.every(id=>typeof id==='string'&&id.startsWith('scenario:'))||!finding.annotationEvidence?.length||!finding.support?.length)return [];
      const qualityKeys=unique((finding.qualityKeys||[]).filter(key=>pattern.attributes.includes(key))),sharedWorkIds=unique((finding.evidence||[]).filter(id=>preferenceIds.has(id)));
      if(!qualityKeys.length||sharedWorkIds.length<2)return [];
      const labels=qualityKeys.map(key=>ARTWORK_ATTRIBUTE_DEFINITIONS[key]?.label||key).join(' and '),partial=qualityKeys.length!==pattern.attributes.length;
      return [{sourceFindingId:finding.id,qualityKeys,relation:finding.relation,instrument:finding.instrument,sharedWorkIds,sourceRoundIds:[...finding.sourceRoundIds],sourceRecordIds:[...(finding.sourceRecordIds||[])],support:structuredClone(finding.support),counter:structuredClone(finding.counter||[]),annotationEvidence:structuredClone(finding.annotationEvidence),notPreferenceEvidence:true,preferenceCountsUnchanged:true,scope:partial?'one-component-of-combination':'matched-quality',text:finding.relation==='grouped-by-shared-quality'?`${labels}${partial?', one part of this connection,':' also'} helps describe the ${finding.instrument==='museum'?'rooms':'groups'} you arranged.`:`Your arrangement brought contrasting examples of ${labels.toLowerCase()} together, alongside the preference pattern.`}];
    });
    return connections.length?{...pattern,arrangementConnections:connections,arrangementSummary:connections[0].text}:pattern;
  });
}
