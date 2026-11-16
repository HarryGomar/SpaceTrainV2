const labels={appeal:'Personal appeal',admiration:'Admiration',attention:'Attention',connection:'Connection',return:'Returning',context:'Context',recognition:'Familiarity',grouping:'Your arrangements',company:'Company'};
const statuses={supported:'Recurring',provisional:'Early',open:'Still open','not-explored':'Unexplored'};
const unique=items=>[...new Set(items)];

/** A reading at a time, with every unfinished theme still in view. */
export function renderProfileIntelligence({intelligence={},works=[],image,esc,evidence=()=>''}={}){
  const categories=Array.isArray(intelligence.categories)?intelligence.categories:[];
  if(!categories.length)return '';
  const byId=new Map(works.map(work=>[work.id,work])),initial=Math.max(0,categories.findIndex(category=>category.status==='supported'));
  const pictures=category=>{
    if(typeof image!=='function')return '';
    const sourceIds=unique([...(category.support||[]),...(category.counter||[])].flatMap(row=>row.workIds||[]));
    const preferred=unique(category.displayWorkIds||[]).filter(id=>sourceIds.includes(id)&&byId.has(id));
    const selected=preferred.length?preferred:sourceIds.filter(id=>byId.has(id));
    const ids=selected.slice(0,2);if(!ids.length)return '';
    return `<div class="tp-reading-pictures">${ids.map(id=>{const work=byId.get(id),title=work.shortTitle||work.title;return `<figure><button type="button" class="tp-art" data-action="deep-art" data-work="${esc(id)}" aria-label="View ${esc(title)}">${image(work)}</button><figcaption>${esc(title)}<small>${esc(work.artist||'')}</small></figcaption></figure>`;}).join('')}</div>`;
  };
  return `<section class="tp-intelligence" id="profile-refine"><div class="tp-section-heading"><p class="tp-kicker">The connections and their limits</p><h2>Looking closer</h2></div><div class="tp-reading-explorer"><div class="tp-reading-nav" role="tablist" aria-label="Themes in your reading" aria-orientation="vertical">${categories.map((category,index)=>`<button type="button" role="tab" id="reading-tab-${esc(category.id)}" aria-controls="profile-category-${esc(category.id)}" aria-selected="${index===initial}" tabindex="${index===initial?0:-1}" data-reading-index="${index}"><span>${esc(labels[category.id]||category.title)}</span><small>${esc(statuses[category.status]||category.statusLabel)}</small></button>`).join('')}</div><div class="tp-reading-panels">${categories.map((category,index)=>{
    const source={id:'category-'+category.id,title:category.title,text:category.conclusion,support:category.support||[],counter:category.counter||[],sourceRoundIds:category.sourceRoundIds||[],alternatives:category.limits||[]};
    return `<article class="tp-reading-panel" id="profile-category-${esc(category.id)}" role="tabpanel" aria-labelledby="reading-tab-${esc(category.id)}" data-evidence-status="${esc(category.status)}" ${index===initial?'':'hidden inert'}><div class="tp-reading-copy"><p class="tp-reading-status">${esc(category.status==='supported'?'A recurring connection':category.statusLabel)}</p><h3>${esc(category.readingTitle||category.title)}</h3><p class="tp-reading-conclusion">${esc(category.conclusion)}</p>${source.support.length?evidence(source):''}<div class="tp-reading-further"><p>A comparison to try</p><span>${esc(category.nextComparison?.title||'Another comparison would help refine this reading.')}</span></div></div>${pictures(category)}</article>`;
  }).join('')}</div></div></section>`;
}

export function createProfileReadingTabs({app}){
  function select(button,focus=false){
    const root=button.closest('.tp-reading-explorer');if(!root)return;
    const tabs=[...root.querySelectorAll('[data-reading-index]')],index=tabs.indexOf(button);if(index<0)return;
    for(const tab of tabs){const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
    for(const [i,panel]of [...root.querySelectorAll('.tp-reading-panel')].entries()){panel.hidden=i!==index;panel.inert=i!==index;}
    if(focus)button.focus({preventScroll:true});
  }
  app.addEventListener('click',event=>{const tab=event.target.closest('[data-reading-index]');if(tab)select(tab);});
  app.addEventListener('keydown',event=>{
    const tab=event.target.closest('[data-reading-index]');if(!tab||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const tabs=[...tab.closest('[role="tablist"]').querySelectorAll('[data-reading-index]')],index=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+tabs.length)%tabs.length;
    select(tabs[next],true);
  });
}
