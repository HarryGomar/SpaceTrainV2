import {TASK_COLOURS} from './task-signals.mjs';
const labels={"appeal":"Personal appeal","admiration":"Admiration","attention":"Attention","connection":"Connection","return":"Returning","context":"Context","recognition":"Familiarity","grouping":"Your arrangements","company":"Company"};
const statusLabels={"supported":"Recurring","provisional":"Early","mixed":"Mixed","open":"Still open","not-explored":"Unexplored"};
const toneKeys={"appeal":"preference","admiration":"making","attention":"curiosity","connection":"connection","return":"emotion","context":"meaning","recognition":"familiarity","grouping":"curation","company":"curation"};

export function renderProfileIntelligence({intelligence={},works=[],image,esc,evidence=()=>''}={}){
  const categories=Array.isArray(intelligence.categories)?intelligence.categories:[];
  if(!categories.length)return '';
  const readings=categories.filter(category=>['supported','provisional','mixed'].includes(category.status)&&(category.support||[]).length),unresolved=categories.filter(category=>!readings.includes(category));
  const byId=new Map(works.map(work=>[work.id,work])),initial=0;
  function artworkIds(category){
    const sourceIds=[...new Set([...(category.support||[]),...(category.counter||[])].flatMap(row=>row.workIds||[]))];
    const selected=[...new Set(category.displayWorkIds||[])].filter(id=>sourceIds.includes(id)&&byId.has(id));
    return (selected.length?selected:sourceIds.filter(id=>byId.has(id))).slice(0,3);
  }
  function picture(id,peek=false,category={}){
    const work=byId.get(id),title=work.shortTitle||work.title;
    if(peek)return '<span>'+image(work)+'</span>';
    const role=category.displayRoles?.[id],note=category.displayNotes?.[id],label=role==='explicit-dislike'?'Explicitly disliked, same quality':role==='counterexample'?'Exception to this pattern':role==='comparison'?'Comparison in this set':role==='favourite-exception'?'Favourite without this quality':role==='favourite'?'Selected favourite':'';
    return '<figure><button type="button" class="tp-art" data-action="deep-art" data-work="'+esc(id)+'" aria-label="View '+esc(title)+'">'+image(work)+'</button><figcaption>'+(label?'<span class="tp-index-role">'+esc(label)+'</span>':'')+esc(title)+'<small>'+esc(work.artist||'')+'</small>'+(note?'<small class="tp-index-measure">'+esc(note.description)+'<br>'+esc(note.basis)+'</small>':'')+'</figcaption></figure>';
  }
  return '<section class="tp-intelligence" id="profile-refine"><div class="tp-section-heading"><h2>What your responses reveal</h2></div><div class="tp-reading-index">'+readings.map((category,index)=>{
    const ids=typeof image==='function'?artworkIds(category):[],title=category.readingTitle||category.title,color=TASK_COLOURS[toneKeys[category.id]]||TASK_COLOURS.description;
    const source={id:'category-'+category.id,title:category.title,text:category.conclusion,support:category.support||[],counter:category.counter||[],sourceRoundIds:category.sourceRoundIds||[],alternatives:category.limits||[]};
    return '<details class="tp-index-item '+(ids.length?'':'tp-index-no-art')+'" name="profile-reading" id="profile-category-'+esc(category.id)+'" style="--reading-color:'+color+'" data-evidence-status="'+esc(category.status)+'" '+(index===initial?'open':'')+'><summary aria-controls="reading-content-'+esc(category.id)+'"><span class="tp-index-number">'+String(index+1).padStart(2,'0')+'</span><span class="tp-index-title"><small>'+esc(labels[category.id]||category.title)+'</small><span>'+esc(title)+'</span></span><span class="tp-index-peek" aria-hidden="true">'+ids.map(id=>picture(id,true,category)).join('')+'</span><span class="tp-index-status">'+esc(statusLabels[category.status]||category.statusLabel)+'</span><span class="tp-index-arrow" aria-hidden="true">&#8599;</span></summary><div class="tp-index-body" id="reading-content-'+esc(category.id)+'">'+(ids.length?'<div class="tp-index-pictures">'+ids.map(id=>picture(id,false,category)).join('')+'</div>':'')+'<div class="tp-index-copy"><p class="tp-reading-status">'+esc(category.status==='supported'?'A recurring connection':category.statusLabel)+'</p><p class="tp-reading-conclusion">'+esc(category.conclusion)+'</p>'+(source.support.length?evidence(source):'')+(category.relatedReadings||[]).map(reading=>'<div class="tp-reading-further"><p>'+esc(reading.status==='mixed'?'Where an explanation weakened':'Another possibility')+'</p><span>'+esc(reading.text)+'</span>'+evidence(reading)+'</div>').join('')+'<div class="tp-reading-further"><p>A comparison to try</p><span>'+esc(category.nextComparison?.reason||category.nextComparison?.title||'')+'</span></div></div></div></details>';
  }).join('')+'</div>'+(unresolved.length?'<div class="tp-index-unresolved"><p class="tp-kicker">Still to explore</p>'+unresolved.map(category=>'<div id="profile-category-'+esc(category.id)+'" data-evidence-status="'+esc(category.status)+'" style="--reading-color:'+(TASK_COLOURS[toneKeys[category.id]]||TASK_COLOURS.description)+'"><span>'+esc(labels[category.id]||category.title)+'</span><small>'+esc(statusLabels[category.status]||category.statusLabel)+'</small><p>'+esc(category.nextComparison?.reason||category.nextComparison?.title||'')+'</p></div>').join('')+'</div>':'')+'</section>';
}

// The retained export name keeps existing app shells compatible.
export function createProfileReadingTabs({app}){
  app.addEventListener('toggle',event=>{
    const active=event.target;
    if(!active.matches?.('.tp-index-item')||!active.open)return;
    for(const item of active.closest('.tp-reading-index').querySelectorAll('.tp-index-item'))if(item!==active)item.open=false;
  },true);
}
