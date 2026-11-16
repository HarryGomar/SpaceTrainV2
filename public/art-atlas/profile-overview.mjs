/** Select by evidence relevance rather than the order modules happened to run. */
export function selectPrimaryReadings(observations=[],preferredIds=[],limit=6){
  const unique=[...new Map(observations.filter(item=>item&&typeof item.id==='string'&&item.module!=='repeats').map(item=>[item.id,item])).values()];
  const preferred=new Set(preferredIds),breadth=item=>item.supportedSetCount||item.evidenceBalance?.assessedSets||item.distinctSets||0;
  const ranked=unique.sort((a,b)=>Number(preferred.has(b.id))-Number(preferred.has(a.id))||(b.priority||0)-(a.priority||0)||breadth(b)-breadth(a)||a.id.localeCompare(b.id));
  const result=[],perModule=new Map();
  for(const item of ranked){const count=perModule.get(item.module)||0;if(count>=2)continue;result.push(item);perModule.set(item.module,count+1);if(result.length>=limit)break;}
  return result;
}

export function renderProfileIndex({items=[],esc,title}){
  if(!items.length)return '';
  return `<nav class="profile-reading-index" aria-label="Readings in this profile">${items.map(item=>`<a href="#${esc(item.id)}" data-module="${esc(item.module||'arrangement')}"><i aria-hidden="true"></i><span>${esc(title(item)||item.title||'Recorded choice')}</span><span aria-hidden="true">↘</span></a>`).join('')}</nav>`;
}

export function rankCuratorialReadings(findings=[]){
  return [...new Map(findings.filter(item=>item&&typeof item.id==='string').map(item=>[item.id,item])).values()].sort((a,b)=>(b.priority||0)-(a.priority||0)||(b.support?.length||0)-(a.support?.length||0)||a.id.localeCompare(b.id));
}
