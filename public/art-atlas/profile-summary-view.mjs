const colours={'imagined-world':'#786095','dramatic-light':'#9c6333','narrative-detail':'#477d7d','layered-space':'#55759a','human-relationships':'#a25e4d','visible-gesture':'#986a83','geometric-structure':'#667c62','visible-paint-marks':'#ad7442'};
const palette=['#786095','#9c6333','#477d7d','#a25e4d','#55759a'];
export const profileThreadColour=(thread,index=0)=>colours[thread.qualityKey]||palette[index%palette.length];

/** Presentation emphasis follows generated evidence, never a named visitor. */
export function profileSummaryMarkup({summary={},works=[],esc}={}){
  const threads=summary.threads||[],terms=threads.filter(item=>item.title).map((thread,index)=>({text:thread.title,colour:profileThreadColour(thread,index),kind:'quality'}));
  for(const id of summary.workIds||[]){const work=works.find(item=>item.id===id);if(work)terms.push({text:work.shortTitle||work.title,kind:'work'});}
  const highlight=text=>{
    text=String(text||'');const lower=text.toLowerCase();let cursor=0,out='';
    while(cursor<text.length){
      const matches=terms.map(term=>({...term,index:lower.indexOf(term.text.toLowerCase(),cursor)})).filter(term=>term.index>=cursor).sort((a,b)=>a.index-b.index||b.text.length-a.text.length),next=matches[0];
      if(!next){out+=esc(text.slice(cursor));break;}
      out+=esc(text.slice(cursor,next.index));const value=esc(text.slice(next.index,next.index+next.text.length));
      out+=next.kind==='quality'?`<span class="tp-summary-quality" style="--thread-colour:${next.colour}">${value}</span>`:`<strong class="tp-summary-work">${value}</strong>`;cursor=next.index+next.text.length;
    }
    return out;
  };
  const headingThreads=threads.slice(0,2),combined=headingThreads.map(thread=>thread.title).join(' & '),title=combined===summary.title?headingThreads.map((thread,index)=>`<span style="--thread-colour:${profileThreadColour(thread,index)}">${esc(thread.title)}</span>`).join('<span class="tp-title-join"> &amp; </span>'):esc(summary.title||'Art profile');
  return {title,text:highlight(summary.text)};
}
