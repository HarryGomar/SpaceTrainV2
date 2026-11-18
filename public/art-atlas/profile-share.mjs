import {profileThreadColour} from './profile-summary-view.mjs';
import {TASK_COLOURS} from './task-signals.mjs';
import {CONTINUOUS_PROTOCOL} from './continuous-preference.mjs';
const unique=a=>[...new Set(a.filter(Boolean))],short=w=>w.shortTitle||w.title;
const sentences=(text,count=2)=>(String(text||'').match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)||[]).slice(0,count).join(' ').trim();
const compact=(text,max=280)=>{text=String(text||'').replace(/\s+/g,' ').trim();return text.length<=max?text:text.slice(0,max-1).replace(/\s+\S*$/,'')+'…';};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const headlineKey=text=>String(text||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const highlightKinds={
  appeal:['Personal appeal','preference'],admiration:['Admiration','making'],attention:['Attention','curiosity'],
  connection:['Connection','connection'],return:['Returning','emotion']
};
export const PROFILE_SHARE_SIZE=Object.freeze({width:1080,height:1600});

/** A share page uses the earned reading and its actual source responses. It
 * contains no raw answer archive, inferred personality type or population rank. */
export function buildProfileShareAspects({portrait={},works=[],simulation=false}={}){
  const byId=new Map(works.map(w=>[w.id,w]));
  const ledger=new Map((portrait.intelligence?.responseLedger||[]).map(row=>[row.roundId,row]));
  const observations=portrait.observations||[],summary=portrait.profileSummary||{};
  const byFinding=new Map(observations.map(observation=>[observation.id,observation]));
  const metrics=[{label:'paintings compared',value:portrait.coverage?.uniquePreferenceWorks||0},{label:'responses recorded',value:portrait.coverage?.validRounds||0}].filter(m=>m.value>0);
  const identity=id=>{const w=byId.get(id);return w?{id:w.id,title:short(w),artist:w.artist||'',image:w.image,sourceUrl:w.sourceUrl,credit:w.imageCredit||[w.museum,w.rights].filter(Boolean).join(' · ')}:null;};
  function cards(finding,{includeCounter=false}={}){
    const support=finding?.support||[];
    const evidence=includeCounter?[...support,...(finding?.counter||[])]:support;
    const sourceIds=unique(evidence.flatMap(row=>row.workIds||[]));
    const chosen=unique([...(finding?.displayWorkIds||[]).filter(id=>sourceIds.includes(id)),...sourceIds]).filter(id=>byId.has(id)).slice(0,2);
    const shared=chosen.length===2?evidence.filter(row=>chosen.every(id=>row.workIds?.includes(id))):[];
    const isMap=row=>row?.axisDefinition&&(finding?.measurementScope?.endsWith('-map')
      ? row.measurementScope===finding.measurementScope.slice(0,-4)
      : finding?.module==='tension-and-return'?row.measurementScope==='returnResponse':true);
    const matchedMap=shared.map(row=>ledger.get(row.roundId)).find(row=>isMap(row)&&chosen.every(id=>row.points?.[id]));
    return chosen.map(id=>{
      const supporting=support.some(row=>row.workIds?.includes(id));
      const ownEvidence=(supporting?support:evidence).filter(row=>row.workIds?.includes(id));
      const sources=ownEvidence.map(row=>ledger.get(row.roundId)).filter(Boolean),measures=[];
      const map=matchedMap||sources.find(row=>isMap(row)&&row.points?.[id]);
      const line=sources.find(row=>row.measurementScope===CONTINUOUS_PROTOCOL&&Number.isFinite(row.positions?.[id]));
      if(line&&!['achievement','attention'].includes(map?.measurementScope))measures.push({label:'Appeal',value:line.positions[id]});
      if(map){const d=map.axisDefinition;for(const [i,label]of [d.xName,d.yName].entries())if(!measures.some(m=>m.label.toLowerCase()===label.toLowerCase()))measures.push({label,value:map.points[id][i]});}
      return {...identity(id),measures:measures.slice(0,3),...(!supporting?{role:'counterexample'}:{})};
    });
  }
  const base={metrics,simulation,footer:'A personal reading of these comparisons',size:{...PROFILE_SHARE_SIZE}},aspects=[];
  const primary=summary.findingIds?.map(id=>byFinding.get(id)).find(Boolean)
    ||summary.threads?.map(thread=>byFinding.get(thread.id)).find(Boolean);
  let mainCards=cards(primary);
  if(!mainCards.length)mainCards=unique([...(summary.workIds||[]),...(portrait.heroWorks?.map(w=>w.workId)||[]),...(portrait.preferenceEvidence?.negativeWorkIds||[]),...(portrait.preferenceEvidence?.overallRatings||[]).map(r=>r.workId)]).filter(id=>byId.has(id)).slice(0,2).map(id=>({...identity(id),measures:(portrait.preferenceEvidence?.overallRatings||[]).some(r=>r.workId===id&&r.measurementScope==='personal-appeal-continuous-v1')?[{label:'Appeal',value:portrait.preferenceEvidence.overallRatings.find(r=>r.workId===id&&r.measurementScope==='personal-appeal-continuous-v1').score}]:[]}));
  if(mainCards.length&&summary.text)aspects.push({...base,id:'profile',label:'Your profile',eyebrow:'Your Art Atlas',headline:summary.title||'Your Art Atlas',lede:compact(sentences(summary.text,2),310),accent:profileThreadColour(primary||{}),scopeNote:primary?.counter?.length?'A different result: '+primary.counter[0].detail:primary?.boundary||sentences(primary?.alternatives?.[0]||'',1),nextQuestion:portrait.intelligence?.categories?.find(c=>c.nextComparison?.roundId)?.nextComparison?.reason||primary?.nextQuestion||'',artworks:mainCards,badge:simulation?'Simulated answers':summary.basis==='prospectively-tested-appeal'?'Checked on later work':summary.basis==='recurring-observed-appeal'?'Recurring in your answers':summary.basis==='direct-response-reading'?'Your reported response':'From your answers'});
  const favourites=unique((portrait.preferenceEvidence?.explicitFavourites||[]).map(w=>w.workId)).filter(id=>byId.has(id));
  const positive=(portrait.preferenceEvidence?.overallRatings||[]).filter(r=>r.measurementScope==='personal-appeal-continuous-v1'&&r.score>=65&&byId.has(r.workId)).sort((a,b)=>b.score-a.score),chosen=favourites.length?favourites:unique(positive.map(r=>r.workId));
  if(chosen.length)aspects.push({...base,id:'paintings',label:'Your paintings',eyebrow:'Paintings to keep close',headline:favourites.length?'From your favourites':'Paintings that appealed',lede:favourites.length?'Paintings you explicitly chose as favourites. Their arrangement here is not a ranking.':'These paintings received positive personal-appeal ratings.',badge:simulation?'Simulated answers':favourites.length?'Selected by you':'Personally rated',artworks:chosen.slice(0,6).map(id=>({...identity(id),measures:favourites.length?[]:[{label:'Appeal',value:positive.find(r=>r.workId===id).score}]})),scopeNote:favourites.length?`${favourites.length} explicitly selected favourite${favourites.length===1?'':'s'}.`:'An appeal rating is separate from an explicit favourite choice.',nextQuestion:''});
  const contrast=observations.find(observation=>{
    if(!['making-and-taste','attention-and-appeal','connection-and-understanding'].includes(observation.module))return false;
    const [first,second]=observation.displayWorkIds||[];
    return first&&second&&observation.support?.some(row=>{
      const source=ledger.get(row.roundId);
      return row.workIds?.includes(first)&&row.workIds.includes(second)&&source?.axisDefinition&&source.points?.[first]&&source.points?.[second];
    });
  });
  if(contrast)aspects.push({...base,id:'contrast',label:'A revealing contrast',eyebrow:'Two judgments, different answers',headline:contrast.title,lede:compact(sentences(contrast.text,2),310),badge:simulation?'Simulated answers':'A recorded contrast',artworks:cards(contrast),scopeNote:contrast.alternatives?.find(s=>/report|not a test|different/i.test(s))||'These are separate judgments under the original questions.',nextQuestion:''});
  const returnCategory=portrait.intelligence?.categories?.find(category=>category.id==='return');
  const returning=observations.find(o=>o.id===returnCategory?.primaryFindingId)
    ||observations.find(o=>o.module==='tension-and-return'&&o.id?.includes('return-beyond-appeal'))
    ||observations.find(o=>o.module==='tension-and-return'&&o.support?.length&&o.displayWorkIds?.length);
  if(returning)aspects.push({...base,id:'return',label:'Worth another look',eyebrow:'What invites a return',headline:returning.title,lede:compact(sentences(returning.text,2),310),badge:simulation?'Simulated answers':'Your reported wish',artworks:cards(returning,{includeCounter:true}),scopeNote:'Wish to return is your reported intention, separate from appeal and from an observed return visit.',nextQuestion:returning.nextQuestion||''});
  const illustratedRating=mainCards.find(work=>positive.some(rating=>rating.workId===work.id))?.id;
  const galleryIds=(favourites.length?favourites:unique([illustratedRating,...chosen,...(portrait.heroWorks||[]).map(w=>w.workId)]).filter(id=>byId.has(id))).slice(0,5);
  const main=aspects.find(a=>a.id==='profile');
  if(main){
    main.accent=profileThreadColour(summary.threads?.[0]||primary||{});
    const headings=new Set([headlineKey(summary.title)]);
    const threads=[...(summary.threads||[]),...(portrait.favouriteSummary?.threads||[])];
    main.threads=threads.flatMap((thread,index)=>{
      const title=headlineKey(thread.title);
      if(!title||headings.has(title))return [];
      headings.add(title);
      const detail=thread.knownFavouriteCount
        ?`${thread.supportingWorkCount} of ${thread.knownFavouriteCount} reviewed favourites`
        :thread.supportingSetCount?`${thread.supportingSetCount} comparison groups`:'';
      return detail?[{title:thread.title,colour:profileThreadColour(thread,index),detail}]:[];
    }).slice(0,3);
    main.gallery=galleryIds.length?galleryIds.map(identity):main.artworks;
    main.galleryLabel=favourites.length?(favourites.length>galleryIds.length?`${galleryIds.length} of your ${favourites.length} selected favourites`:'Your selected favourites'):galleryIds.length?(galleryIds.every(id=>chosen.includes(id))?'Paintings you rated highly':'Paintings that appealed'):'One of your comparisons';
    const categories=portrait.intelligence?.categories||[];
    main.highlights=categories.flatMap(category=>{
      if(!Object.hasOwn(highlightKinds,category.id)||!['supported','provisional'].includes(category.status))return [];
      const finding=byFinding.get(category.primaryFindingId)
        ||{...category,module:category.id==='return'?'tension-and-return':undefined};
      if(category.id==='appeal'&&!finding.recurring)return [];
      const title=category.readingTitle||category.title,key=headlineKey(title);
      if(!key||headings.has(key)||category.primaryFindingId&&summary.findingIds?.includes(category.primaryFindingId))return [];
      const examples=cards(finding).filter(work=>work.measures.length>=(category.id==='appeal'?1:2));
      if(!examples.length)return [];
      if(category.id==='return'&&!examples.some(work=>['Felt tension','Wish to return'].every(label=>
        work.measures.some(measure=>measure.label===label&&measure.value>=65))))return [];
      headings.add(key);
      const [label,tone]=highlightKinds[category.id];
      return [{label,title,colour:TASK_COLOURS[tone],status:category.status,examples}];
    }).sort((a,b)=>Number(b.status==='supported')-Number(a.status==='supported')).slice(0,3);
    main.exception=primary?.status==='mixed'?compact(sentences(primary.counter?.[0]?.detail,1),170):'';
  }
  for(const a of aspects){
    a.threads||=[];a.highlights||=[];
    if(a.id==='paintings'){a.gallery=a.artworks.slice(0,5);a.galleryLabel=favourites.length?'Selected favourites · unranked':'Positively rated by you';a.accent='#55759a';}
    if(a.id==='contrast'){a.accent=TASK_COLOURS[contrast.module==='connection-and-understanding'?'connection':contrast.module==='attention-and-appeal'?'curiosity':'making'];a.lede=sentences(contrast.text,1);}
    if(a.id==='return')a.accent=TASK_COLOURS.emotion;
  }
  return aspects.filter(a=>a.artworks.length);
}

function wrapped(ctx,text,width,size,weight=400){
  ctx.font=`${weight} ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  const lines=[];let line='';for(const word of String(text||'').split(/\s+/)){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;
}
function textBlock(ctx,text,{x,y,width,size=28,lineHeight=size*1.35,maxLines=4,color='#292c2a',weight=400}={}){
  ctx.fillStyle=color;const lines=wrapped(ctx,text,width,size,weight);const shown=lines.slice(0,maxLines);if(lines.length>maxLines)shown[maxLines-1]=shown[maxLines-1].replace(/\s+\S*$/,'')+'…';shown.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));return y+shown.length*lineHeight;
}
function loadArtwork(url){return new Promise((resolve,reject)=>{const image=new Image(),timer=setTimeout(()=>reject(Error('Image loading timed out')),8000);image.crossOrigin='anonymous';image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);reject(Error('Artwork preview unavailable'));};image.src=url;});}

/** A portrait from the site's own type, coloured threads and open constellation. */
export async function renderProfileShareCanvas({aspect,document=globalThis.document,imageBase=document.baseURI,loadImage=loadArtwork}={}){
  await document.fonts?.ready;
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1600;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image export is unavailable in this browser.');
  const paper='#faf9f6',ink='#292c2a',soft='#847b6e',accent=aspect.accent||'#786095';
  ctx.textBaseline='top';ctx.fillStyle=paper;ctx.fillRect(0,0,1080,1600);
  const centre=(text,y,size=24,color=ink,width=920,maxLines=3)=>{
    let lines=wrapped(ctx,text,width,size);while(size>18&&lines.length>maxLines){size--;lines=wrapped(ctx,text,width,size);}ctx.textAlign='center';ctx.fillStyle=color;
    lines.slice(0,maxLines).forEach((line,i)=>ctx.fillText(line,540,y+i*size*1.2));ctx.textAlign='left';
    return y+Math.min(lines.length,maxLines)*size*1.2;
  };
  centre(aspect.id==='profile'?'Your Art Atlas':aspect.eyebrow,72,21,soft);
  let size=aspect.gallery?84:68;while(size>48&&wrapped(ctx,aspect.headline,920,size).length>(aspect.gallery?2:3))size-=2;
  const heading=wrapped(ctx,aspect.headline,920,size),headingY=128;
  const coloured=/depth|space|layers|brushwork|structure|light|stories|story|favourites|appealed|admiration|attention|connection|return|look|making/i;
  for(let i=0;i<Math.min(3,heading.length);i++){
    const words=heading[i].split(' '),width=ctx.measureText(heading[i]).width;let x=(1080-width)/2;
    for(const word of words){ctx.fillStyle=coloured.test(word)?accent:ink;ctx.fillText(word,x,headingY+i*size*1.08);x+=ctx.measureText(word+' ').width;}
  }
  let y=headingY+Math.min(3,heading.length)*size*1.08+30;
  y=centre(aspect.lede,y,26,soft,870,3);
  const gallery=aspect.gallery||aspect.artworks,images=await Promise.all(gallery.map(async w=>{try{return await loadImage(new URL(w.image,imageBase).href);}catch{return null;}}));
  function picture(index,x,top,width,height,{caption=true,measures=false}={}){
    const work=gallery[index],image=images[index];if(!work)return;
    let bottom=top+height;
    if(image){const scale=Math.min(width/image.width,height/image.height),w=image.width*scale,h=image.height*scale;ctx.drawImage(image,x+(width-w)/2,top+(height-h)/2,w,h);}
    else textBlock(ctx,'Artwork unavailable',{x,y:top+height/2,width,size:18,color:soft});
    if(caption){ctx.textAlign='center';const titleLines=wrapped(ctx,work.title,width,18);ctx.fillStyle=ink;titleLines.slice(0,2).forEach((line,i)=>ctx.fillText(line,x+width/2,bottom+14+i*23));bottom+=14+Math.min(2,titleLines.length)*23;ctx.fillStyle=soft;ctx.font='400 15px Inter, system-ui, sans-serif';ctx.fillText(compact(work.artist,46),x+width/2,bottom+3);if(work.role==='counterexample'){ctx.fillStyle=accent;ctx.fillText('A different response',x+width/2,bottom+23);bottom+=20;}ctx.textAlign='left';}
    if(measures){const ms=work.measures||[],mw=width/ms.length,my=bottom+48;for(let j=0;j<ms.length;j++){const m=ms[j],mx=x+j*mw;const colour=/appeal/i.test(m.label)?TASK_COLOURS.preference:/attention|understanding/i.test(m.label)?TASK_COLOURS.curiosity:/admiration|making/i.test(m.label)?TASK_COLOURS.making:/connection/i.test(m.label)?TASK_COLOURS.connection:TASK_COLOURS.emotion;textBlock(ctx,String(m.value),{x:mx,y:my,width:mw-10,size:51,color:colour,maxLines:1});textBlock(ctx,m.label,{x:mx,y:my+62,width:mw-12,size:17,lineHeight:23,color:soft,maxLines:2});}}
  }
  if(aspect.gallery){
    if(aspect.threads.length){const ts=aspect.threads,total=ts.length,tw=900/total;for(let i=0;i<total;i++){const t=ts[i];ctx.textAlign='center';const lines=wrapped(ctx,t.title,tw-30,25);ctx.fillStyle=t.colour;lines.slice(0,2).forEach((line,n)=>ctx.fillText(line,90+tw*(i+.5),y+24+n*30));ctx.fillStyle=soft;ctx.font='400 17px Inter, system-ui, sans-serif';ctx.fillText(t.detail,90+tw*(i+.5),y+30*Math.min(2,lines.length)+33);ctx.textAlign='left';}y+=135;}
    else y+=45;
    centre(aspect.galleryLabel,y,18,soft);const top=y+45,count=gallery.length;
    if(count>=4){
      const roomy=aspect.id==='paintings',sideHeight=roomy?290:170,row=roomy?405:250;
      picture(0,333,top+(roomy?85:40),414,roomy?550:350);
      picture(1,72,top,225,sideHeight);picture(2,783,top,225,sideHeight);
      picture(3,72,top+row,225,sideHeight);if(count>4)picture(4,783,top+row,225,sideHeight);
      y=top+(roomy?790:510);
    }else if(count===3){picture(0,328,top+20,424,410);picture(1,72,top+105,220,285);picture(2,788,top+105,220,285);y=top+525;}
    else{const w=count===1?650:435;for(let i=0;i<count;i++)picture(i,count===1?215:72+i*501,top,w,430);y=top+535;}
    const hs=aspect.highlights||[];
    if(hs.length){
      const start=Math.max(y+24,1050),colWidth=900/hs.length;
      y=start;
      for(let i=0;i<hs.length;i++){
        const highlight=hs[i],x=90+i*colWidth,width=colWidth-28;
        let baseline=textBlock(ctx,highlight.label,{x,y:start,width,size:18,color:highlight.colour,maxLines:1});
        baseline=textBlock(ctx,highlight.title,{x,y:baseline+10,width,size:26,lineHeight:30,color:highlight.colour,maxLines:3});
        for(const work of highlight.examples){
          baseline=textBlock(ctx,work.title,{x,y:baseline+12,width,size:18,lineHeight:22,color:ink,weight:500,maxLines:2});
          baseline=textBlock(ctx,work.measures.map(m=>m.label+' '+m.value).join(' · '),{x,y:baseline+2,width,size:16,lineHeight:20,color:soft,maxLines:3});
        }
        y=Math.max(y,baseline);
      }
    }
    if(aspect.exception)centre(aspect.exception,Math.max(y,1390),19,soft,880,2);
  }else{
    const top=Math.max(430,y+55),count=Math.min(2,gallery.length),width=count===1?680:432;
    for(let i=0;i<count;i++)picture(i,count===1?200:78+i*492,top,width,540,{measures:true});
    if(aspect.id==='return')centre('Wish to return is a reported intention.',1360,20,soft);
  }
  centre('Art Atlas'+(aspect.simulation?' · Simulated answers':''),1550,18,soft);
  return canvas;
}

export function openProfileShare({portrait,works,aspects=buildProfileShareAspects({portrait,works}),document=globalThis.document,imageBase=document.baseURI}={}){
  if(!aspects.length)return null;
  const dialog=document.createElement('dialog');dialog.className='profile-share-dialog';
  dialog.innerHTML=`<div class="profile-share-shell"><header><div><p class="tp-kicker">Art Atlas</p><h2>Share your profile</h2></div><button type="button" class="text-button" data-share-close aria-label="Close share preview">Close ×</button></header><div class="profile-share-controls" role="group" aria-label="Choose what to share">${aspects.map((a,i)=>`<button type="button" data-share-aspect="${esc(a.id)}" aria-pressed="${i===0}">${esc(a.label)}</button>`).join('')}</div><div class="profile-share-preview"><img alt="Preview of your one-page Art Atlas" hidden></div><p class="profile-share-status" role="status">Preparing your image…</p><footer><span>One page. Only the part you choose.</span><button class="text-button" type="button" data-share-download disabled>Download image</button><button class="primary-button" type="button" data-share-native hidden disabled>Share ↗</button></footer></div>`;
  document.body.append(dialog);let active=aspects[0],blob=null,url=null,generation=0;
  const preview=dialog.querySelector('img'),status=dialog.querySelector('[role=status]'),download=dialog.querySelector('[data-share-download]'),native=dialog.querySelector('[data-share-native]');
  async function draw(aspect){const current=++generation;active=aspect;blob=null;download.disabled=native.disabled=true;status.textContent='Preparing your image…';try{const canvas=await renderProfileShareCanvas({aspect,document,imageBase}),next=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(current!==generation||!dialog.isConnected)return;if(!next)throw Error('The image could not be exported.');if(url)URL.revokeObjectURL(url);blob=next;url=URL.createObjectURL(blob);preview.src=url;preview.hidden=false;preview.alt=aspect.label+' · '+aspect.headline;download.disabled=false;const file=new File([blob],'art-atlas-'+aspect.id+'.png',{type:'image/png'});native.hidden=!(globalThis.navigator?.canShare?.({files:[file]}));native.disabled=native.hidden;status.textContent=aspect.simulation?'Preview uses simulated answers.':'Ready to share or download.';}catch(error){if(current===generation)status.textContent='The image could not be prepared. Close this preview and try again.';}}
  dialog.addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-share-close'))dialog.close();if(button.dataset.shareAspect){for(const b of dialog.querySelectorAll('[data-share-aspect]'))b.setAttribute('aria-pressed',String(b===button));await draw(aspects.find(a=>a.id===button.dataset.shareAspect));}if(button.hasAttribute('data-share-download')&&blob){const link=document.createElement('a');link.href=url;link.download='art-atlas-'+active.id+'.png';link.click();}if(button.hasAttribute('data-share-native')&&blob){try{await navigator.share({files:[new File([blob],'art-atlas-'+active.id+'.png',{type:'image/png'})],title:'My Art Atlas'});}catch(error){if(error.name!=='AbortError')status.textContent='Sharing was unavailable. You can still download the image.';}}});
  dialog.addEventListener('close',()=>{generation++;if(url)URL.revokeObjectURL(url);dialog.remove();},{once:true});dialog.showModal();void draw(active);return dialog;
}
