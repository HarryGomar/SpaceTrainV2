import {validKind,validScenario,validScenarioDraft} from './scenarios.mjs';

const list=value=>Array.isArray(value)?value:[];
const accepts=check=>{try{return !!check();}catch{return false;}};

// Unavailable records stay in storage and exports. A later catalogue can reopen them.
export function restoreCurationRecords(saved,works){
  const retained={records:[],drafts:[],parkedCurations:[]},records=[],drafts={},parkedCurations=[];
  for(const record of [...list(saved.records),...list(saved.retained?.records)]){
    if(accepts(()=>validScenario(record,works)))records.push(record);else retained.records.push(record);
  }
  const entries=[...Object.entries(saved.drafts&&typeof saved.drafts==='object'?saved.drafts:{}).map(([kind,record])=>({kind,record})),...list(saved.retained?.drafts)];
  for(const entry of entries){
    const {kind,record}=entry||{};
    if(!Object.hasOwn(drafts,kind)&&accepts(()=>validKind(kind)&&record?.kind===kind&&validScenarioDraft(record,works)))drafts[kind]=record;
    else retained.drafts.push(entry);
  }
  for(const record of [...list(saved.parkedCurations),...list(saved.retained?.parkedCurations)]){
    if(accepts(()=>record?.kind==='curate'&&validScenarioDraft(record,works)))parkedCurations.push(record);else retained.parkedCurations.push(record);
  }
  return {records:records.slice(-40),drafts,parkedCurations,retained};
}
