import fs from 'node:fs';
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/journey-v8-first-50.json',import.meta.url),'utf8'));
export function legacyV8Works(works){return fixture.catalogueIds.map(id=>{const work=structuredClone(works.find(work=>work.id===id));if(!work)throw Error('Missing frozen artwork '+id);if(work.analysis)delete work.analysis.curatorialFacets;return work;});}
/** Actual public v8 question snapshots from dc15275, without any viewer answers. */
export function legacyV8Rounds(works){
  const pool=new Map(legacyV8Works(works).map(work=>[work.id,work]));
  return fixture.rounds.map(snapshot=>({...structuredClone(snapshot),works:snapshot.workIds.map(id=>pool.get(id)),anchorWorks:snapshot.anchorIds.map(id=>pool.get(id))}));
}
