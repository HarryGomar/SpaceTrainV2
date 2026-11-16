import fs from 'node:fs';
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/legacy-v11-first50.json',import.meta.url),'utf8'));
/** Public v11 definitions/source records only. No viewer answers are included. */
export const legacyV11Works=()=>structuredClone(fixture.works);
export function legacyV11Rounds(){const byId=new Map(fixture.works.map(work=>[work.id,work]));return fixture.rounds.map(snapshot=>({...structuredClone(snapshot),works:snapshot.workIds.map(id=>structuredClone(byId.get(id))),anchorWorks:(snapshot.anchorIds||[]).map(id=>structuredClone(byId.get(id)))}));}
