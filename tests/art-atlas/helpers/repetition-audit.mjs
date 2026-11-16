import fs from 'node:fs';
import {buildJourneyRounds,createJourneyStimulusPlan} from '../../../public/art-atlas/journey-bank.mjs';
import {bindFinalRefinementRound,isFinalRefinementRound} from '../../../public/art-atlas/final-refinement.mjs';
import {choiceGridExposure} from '../../../public/art-atlas/discovery-grid.mjs';

export const works=JSON.parse(fs.readFileSync(new URL('../../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const notes=JSON.parse(fs.readFileSync(new URL('../../../public/art-atlas/curation-notes.json',import.meta.url),'utf8'));
export const questionIds=round=>[...new Set([...(round.works||[]).map(work=>work.id),...(round.anchorWorks||[]).map(work=>work.id),...(round.anchorIds||[])])];
export const isSpecific=round=>!round.unavailable&&round.kind!=='statements'&&round.evidence?.stimulusVisibility!=='not-shown'&&!(round.kind==='exercise'&&!['sorting','difficult-edit','edit'].includes(round.exerciseKind));
export const ordinary=round=>!round.unavailable&&round.kind==='spectrum'&&round.criterion==='preference'&&round.evidence?.construct==='preference'&&round.evidence?.unconditional!==false&&round.evidence?.family==='individual-choice';

export function auditRounds(rounds,answers={}){
  const counts=new Map(),independent=[];
  const capturedIds=round=>round.evidence?.explicitFavourites?choiceGridExposure(round,answers[round.id])?.presentedIds||[]:questionIds(round);
  for(const [index,round] of rounds.entries()){
    if(['choice-grid','match'].includes(round.kind)&&!isFinalRefinementRound(round)&&!round.evidence?.varietySelection?.reusedCachedIdentity&&!round.evidence?.varietySelection?.preservedCachedBinding)independent.push({index,round});
    if(isSpecific(round))for(const id of capturedIds(round))counts.set(id,(counts.get(id)||0)+1);
  }
  const gridCounts=new Map();for(const {round} of independent)for(const id of questionIds(round))gridCounts.set(id,(gridCounts.get(id)||0)+1);
  const near3=independent.flatMap(({index,round})=>questionIds(round).flatMap(id=>rounds.slice(Math.max(0,index-3),index).flatMap(other=>isSpecific(other)&&capturedIds(other).includes(id)?[{workId:id,roundId:round.id,priorRoundId:other.id}]:[])));
  return {roundCount:rounds.length,distinctSpecific:counts.size,totalSpecific:[...counts.values()].reduce((a,b)=>a+b,0),peakSpecific:Math.max(0,...counts.values()),independentSelections:independent.length,independentSlots:[...gridCounts.values()].reduce((a,b)=>a+b,0),distinctIndependent:gridCounts.size,peakIndependent:Math.max(0,...gridCounts.values()),near3Independent:near3.length,over6:[...counts.values()].filter(n=>n>6).length};
}

// A scripted complete preference response supplies highs, lows and a middle.
// Museum trays are skipped: catalogue availability is not an actual exposure.
// These are deterministic allocation audits, not a model of real participants.
export function auditTrajectory(seed='reviewed-variety-v5-0',batchCount=3){
  const rounds=[],answers={},blocks=[],metrics=[];let reservationPlan;
  for(let batchIndex=0;batchIndex<batchCount;batchIndex++){
    const plan=createJourneyStimulusPlan({works,rounds,answers,batchIndex,seed:seed+'-'+batchIndex,reservationPlan});reservationPlan??=plan.reservations;
    const block=buildJourneyRounds(works,answers,{history:rounds,batchIndex,offset:batchIndex*50,seed:seed+'-'+batchIndex,panels:plan});
    const entered=[];
    for(const template of block){let round=isFinalRefinementRound(template)?bindFinalRefinementRound({round:template,works,rounds:[...rounds,...entered].filter(source=>!source.unavailable),answers}):template;
      if(ordinary(round))answers[round.id]={confirmed:true,criterion:'preference',workIds:round.works.map(work=>work.id),positions:Object.fromEntries(round.works.map((work,index)=>[work.id,Math.round(100*index/(round.works.length-1))]))};
      if(round.evidence.explicitFavourites&&!round.unavailable)answers[round.id]={confirmed:true,workIds:round.works.map(work=>work.id),presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0},selectionMode:'shortlist',selectedIds:round.works.slice(0,5).map(work=>work.id),explicitNone:false,unsure:false};
      if(round.kind==='exercise'&&round.exerciseKind==='curate')round={...round,presentedIds:[],coPresentedGroups:[]};entered.push(round);
    }
    rounds.push(...entered);blocks.push({plan,rounds:entered});metrics.push({...auditRounds(rounds,answers),firstRatings:plan.coverage.firstRatingWorkIds.length});
  }
  return {rounds,answers,blocks,metrics};
}
