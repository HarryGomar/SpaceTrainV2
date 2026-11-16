const unique=values=>[...new Set(values)];
const normal=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();

/** Collection routes show selected works and actual exceptions, without turning a period into a trait. */
export function renderProfileStyles({routes=[],works=[],portrait={},image,esc,evidence=()=>''}={}){
  const byId=new Map(works.map(work=>[work.id,work])),favourites=new Set((portrait.heroWorks||[]).filter(item=>item.basis==='overall-favourites').map(item=>item.workId)),ratings=new Map((portrait.preferenceEvidence?.overallRatings||[]).map(item=>[item.workId,item.score]));
  const belongs=(work,route)=>route.id?.startsWith('tradition-')?normal(work.analysis?.movementKey||work.movement)===route.id.slice(10):route.id?.startsWith('era-')&&Array.isArray(work.analysis?.yearRange)&&work.analysis.yearRange.every(year=>Math.floor(year/100)*100===Number(route.id.slice(4)));
  const sections=routes.filter(route=>Array.isArray(route.workIds)&&route.workIds.some(id=>byId.has(id))).map(route=>{
    const positive=unique(route.workIds).filter(id=>byId.has(id)).slice(0,3),counters=unique((route.counter||[]).flatMap(entry=>entry.workIds||[])).filter(id=>byId.has(id)&&!route.workIds.includes(id)&&belongs(byId.get(id),route)).slice(0,2),selected=route.workIds.filter(id=>favourites.has(id)).length;
    const selectedArtists=unique(route.workIds.map(id=>byId.get(id)?.artist).filter(Boolean)),description=selectedArtists.length===1&&route.workIds.length>=2?`The works you selected here are by ${selectedArtists[0]}.`:selectedArtists.length>1?`Your selected works span ${selectedArtists.length} artists.`:'A connection to explore from the paintings you chose.';
    const art=(id,counter=false)=>{const work=byId.get(id),value=ratings.get(id),label=counter?(value<=35?'Rated lower':'Lower in a comparison'):favourites.has(id)?'Selected favourite':value>=65?'Rated highly':'Chosen in a comparison';return `<figure data-style-role="${counter?'counter':'selected'}"><button type="button" class="tp-art" data-action="deep-art" data-work="${esc(id)}" aria-label="View ${esc(work.shortTitle||work.title)}">${image(work)}</button><figcaption><span class="profile-style-choice">${label}</span>${esc(work.shortTitle||work.title)}<small>${esc(work.artist||'')}</small></figcaption></figure>`;};
    return `<article class="profile-style-reading"><header><p class="tp-kicker">${esc(route.category||'Movement')}</p><h3>${esc(route.title)}</h3><p>${esc(description)}</p>${selected?`<span class="profile-style-count">${selected} selected ${selected===1?'favourite':'favourites'}</span>`:''}${evidence({...route,text:route.reason})}</header><div class="profile-style-works">${positive.map(id=>art(id)).join('')}${counters.map(id=>art(id,true)).join('')}</div></article>`;
  });
  return sections.length?`<section class="tp-avenues profile-style-section"><div class="tp-section-heading"><h2>Movements & periods</h2></div>${sections.join('')}</section>`:'';
}
