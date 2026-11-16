const unique=values=>[...new Set(values)];
const tones={'human-presence':'#a05c43','representation-abstraction':'#576f91',colour:'#a08440','detail-composition':'#827097','action-stillness':'#9b687c','setting-atmosphere':'#687b8a'};
const short=work=>work.shortTitle||work.title;
const negativeQualityTitles={'pattern-rhythm':'Less repetition','dramatic-light':'Less dramatic lighting','visible-paint-marks':'Less visible brushwork','geometric-structure':'Less geometric structure','precise-rendering':'Less precise rendering','material-detail':'Less material detail','theatrical-staging':'Less theatrical staging','imagined-world':'Less fantastical imagery'};
const qualityHeading=item=>item.direction===-1?(negativeQualityTitles[item.qualityKey]||'Beyond '+item.title.toLowerCase()):item.title;
const mixedLabels={'human-presence':'Figures & other subjects','representation-abstraction':'Figurative & abstract',colour:'Restrained & intense','detail-composition':'Spare & detailed','action-stillness':'Still & active','setting-atmosphere':'Subjects & settings'};
const axisDirection=axis=>axis.readingLabel||axis.assessment?.label||(axis.status==='leaning'?(axis.direction<0?axis.leftLabel:axis.rightLabel):axis.status==='mixed'?(axis.positiveSetCount>0&&axis.negativeSetCount>0?mixedLabels[axis.key]||'No single direction':'No clear split'):'More evidence needed');
const count=value=>Number.isInteger(value)&&value>=0?value:0;
const componentNames={complexity:'Detail',energy:'Visual movement'};
const qualityDescriptions={'scenes-within-scenes':'story clues across layers of space','precisely-imagined':'impossible imagery rendered with precision','light-and-figures':'close figures picked out by dramatic light','distortion-and-gesture':'distorted forms and emphatic gestures','structure-and-rhythm':'geometric order and repeated shapes','staged-relationships':'encounters between people staged as a scene','stories-and-worlds':'story clues within fantastical imagery','precise-materials':'precise rendering of fabric, metal and other surfaces','narrative-detail':'clues beyond the main subject','dramatic-light':'selective light and deep shadow','visible-gesture':'emphasised bodily gestures','human-relationships':'visible exchanges between people','imagined-world':'fantastical imagery','intimate-figures':'human figures seen close up','landscape':'substantial natural settings','expressive-distortion':'conspicuously altered forms','geometric-structure':'geometric shapes that organise the composition','precise-rendering':'precise edges and detail','visible-paint-marks':'conspicuous brushwork or drawn marks','theatrical-staging':'stage-like arrangements','material-detail':'finely described material surfaces','open-expanse':'large open fields of space or colour','layered-space':'several distinct layers of space','pattern-rhythm':'repeated shapes and visual rhythm'};
function qualityExplanation(item){
  const description=qualityDescriptions[item.qualityKey];
  if(item.channel==='explicit-favourites'&&description&&item.supportingWorkCount&&item.exposureBaseline?.selectedTotal)return `${item.supportingWorkCount} of your ${item.exposureBaseline.selectedTotal} selected favourites share ${description}.`;
  return item.text;
}

function comparisonTally(part,esc){
  const low=count(part.negativeSetCount),high=count(part.positiveSetCount),split=count(part.mixedSetCount),total=low+high+split;
  if(!total)return '<p class="taste-axis-no-contrast">More contrasting paintings needed</p>';
  const direction=part.direction||part.candidateDirection||0;
  const dots=number=>`<span class="taste-axis-votes" aria-hidden="true">${Array.from({length:number},()=>'<i></i>').join('')}</span>`;
  return `<div class="taste-axis-counts" aria-label="${total} comparison groups"><div data-side="low" data-leading="${direction<0}"><strong>${low}</strong>${dots(low)}<span>${esc(part.leftLabel||'Lower end')}</span></div><div data-side="high" data-leading="${direction>0}"><strong>${high}</strong>${dots(high)}<span>${esc(part.rightLabel||'Higher end')}</span></div><div data-side="split"><strong>${split}</strong>${dots(split)}<span>Close or split</span></div></div>`;
}

export function renderTasteAxisIndex({profile={},esc}={}){
  if(!Array.isArray(profile.axes)||!profile.axes.length||!(profile.coverage?.distinctSets>=2))return '';
  return `<nav class="taste-axis-index" aria-label="Visual profile axes">${profile.axes.map(axis=>`<a href="#axis-${esc(axis.key)}" style="--axis-colour:${tones[axis.key]||'#76695d'}"><span>${esc(axis.title)}</span><strong>${esc(axisDirection(axis))}</strong></a>`).join('')}</nav>`;
}

/** This view receives findings; it never fits a preference model from pictures. */
export function renderTasteAxisProfile({profile={},works=[],image,esc,evidence=()=>''}={}){
  const axes=Array.isArray(profile.axes)?profile.axes:[];
  if(!axes.length)return '';
  const byId=new Map(works.map(work=>[work.id,work]));
  return `<section class="taste-axis-profile" id="profile-axes"><div class="tp-section-heading"><p class="tp-kicker">Across your comparisons</p><h2>Visual profile</h2><p class="taste-axis-legend"><i aria-hidden="true"></i> One dot per painting group</p></div><div class="taste-axis-grid">${axes.map(axis=>{
    const selected=axisDirection(axis),parts=Array.isArray(axis.components)&&axis.components.length>1?axis.components:[axis];
    const source={...axis,id:'axis-'+axis.key,module:'visual-axis',title:axis.title,text:axis.summary,alternatives:axis.alternatives||profile.limits||[]};
    const example=axis.support?.find(item=>item.workIds?.filter(id=>byId.has(id)).length===2),ids=unique(example?.workIds||axis.displayWorkIds||[]).filter(id=>byId.has(id)).slice(0,2);
    const strength=axis.presentationStatus||axis.assessment?.status||(axis.status==='leaning'?'recurring':axis.status==='mixed'?'balanced':'insufficient');
    const strengthLabel={recurring:'Recurring tendency',tentative:'Early tendency',balanced:'No dominant direction',insufficient:'Still open','not-tested':'Still open'}[strength]||'Still open';
    return `<article class="taste-axis-reading" id="axis-${esc(axis.key)}" data-axis-status="${esc(axis.status)}" style="--axis-colour:${tones[axis.key]||'#76695d'}"><header><h3>${esc(axis.title)}</h3><p class="taste-axis-direction">${esc(selected||'Still open')}</p><small>${strengthLabel}</small></header><div class="taste-axis-tallies">${parts.map(part=>`<div>${parts.length>1?`<p class="taste-axis-component-name">${esc(componentNames[part.feature]||part.feature)}</p>`:''}${comparisonTally(part,esc)}</div>`).join('')}</div><div class="taste-axis-source"><div class="taste-axis-examples">${ids.map(id=>{const work=byId.get(id);return `<button type="button" data-action="deep-art" data-work="${esc(id)}" aria-label="View ${esc(short(work))}">${image(work)}</button>`;}).join('')}</div>${evidence(source)}</div></article>`;
  }).join('')}</div></section>`;
}

export function renderTasteQualityProfile({profile={},works=[],image,esc,evidence=()=>''}={}){
  const byId=new Map(works.map(work=>[work.id,work])),all=(Array.isArray(profile.patterns)?profile.patterns:[]).filter(item=>['qualified','descriptive'].includes(item.status)||item.status==='descriptive-association'&&item.summaryEligible===true),hasPositiveAdmiration=all.some(item=>item.channel==='admiration-of-making'&&item.direction!==-1);
  const channels=[{id:'appeal',title:'What draws you',colour:'#a05c43',items:all.filter(item=>item.channel!=='admiration-of-making'&&item.direction!==-1)},{id:'admiration',title:'What you admire',colour:'#a08440',items:all.filter(item=>item.channel==='admiration-of-making'&&(!hasPositiveAdmiration||item.direction!==-1))}];
  const renderArt=(id,role)=>{const work=byId.get(id);return work?`<figure data-quality-role="${role||'support'}"><button type="button" data-action="deep-art" data-work="${esc(id)}" aria-label="View ${esc(short(work))}">${image(work)}</button><figcaption>${role==='counter'?'<span class="taste-quality-counter-label">Lower rated, same quality</span>':''}${esc(short(work))}<small>${esc(work.artist||'')}</small></figcaption></figure>`:'';};
  const leadingIds=new Set(profile.readingSummary?.patternIds||[]),presented=new Set(),sections=channels.filter(channel=>channel.items.length).map(channel=>{
    const ranked=[...channel.items].sort((a,b)=>Number(leadingIds.has(b.id))-Number(leadingIds.has(a.id))||Number(b.summaryEligible)-Number(a.summaryEligible)||Number(b.bundle)-Number(a.bundle)||(b.priority||0)-(a.priority||0)),byQuality=new Map();
    for(const item of ranked)if(!byQuality.has(item.qualityKey||item.id))byQuality.set(item.qualityKey||item.id,item);
    const items=[],coveredAttributes=new Set();
    for(const item of byQuality.values()){
      if(items.length>=4)break;
      if(!leadingIds.has(item.id)&&item.attributes?.length&&item.attributes.every(key=>coveredAttributes.has(key)))continue;
      items.push(item);for(const key of item.attributes||[])coveredAttributes.add(key);
    }
    items.forEach(item=>presented.add(item.id));
    return `<section class="taste-quality-section" id="profile-${channel.id}-qualities" style="--quality-colour:${channel.colour}"><div class="tp-section-heading"><p class="tp-kicker">Patterns across paintings</p><h2>${channel.title}</h2></div><div class="taste-quality-grid">${items.map(item=>{
      const ids=unique(item.displayWorkIds||item.evidence||[]).filter(id=>byId.has(id)).slice(0,2),counter=unique([...(item.lowerRatedWithQuality||[]),...(item.ratingAssociation?.lowerRatedFavouredWorkIds||[])]).find(id=>byId.has(id)&&!ids.includes(id));
      const basis=item.channel==='explicit-favourites'?'Selected favourites':item.channel==='admiration-of-making'?'Admiration of making':item.channel==='overall-appeal'?'Overall ratings':'Preference comparisons';
      return `<article class="taste-quality-reading" id="${esc(item.id)}"><header><p class="taste-quality-basis">${basis}</p><h3>${esc(qualityHeading(item))}</h3></header><p>${esc(qualityExplanation(item))}</p><div class="taste-quality-works">${ids.map(id=>renderArt(id,'support')).join('')}${counter?renderArt(counter,'counter'):''}</div>${evidence(item)}</article>`;
    }).join('')}</div></section>`;
  });
  const remaining=(Array.isArray(profile.patterns)?profile.patterns:[]).filter(item=>!presented.has(item.id)&&['qualified','mixed','descriptive','descriptive-association'].includes(item.status));
  const ledger=remaining.length?`<details class="tp-more taste-quality-ledger" data-evidence-title="All quality readings"><summary>All quality readings <span aria-hidden="true">↗</span></summary><div class="tp-evidence-body">${remaining.map(item=>`<article><p class="tp-kicker">${item.channel==='admiration-of-making'?'Admiration':'Preference comparisons'} · ${item.status==='mixed'?'Mixed evidence':item.direction<0?'Higher ratings without this quality':item.channel==='explicit-favourites'?'Shared by selected favourites':'Recorded pattern'}</p><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p>${evidence(item)}</article>`).join('')}</div></details>`:'';
  return sections.join('')+ledger;
}

export function renderTasteQualityRecommendations({recommendations=[],works=[],image,esc,evidence=()=>''}={}){
  const byId=new Map(works.map(work=>[work.id,work]));
  const routes=[...new Map(recommendations.filter(route=>byId.has(route.workId)).map(route=>[route.workId,route])).values()].slice(0,6);
  if(!routes.length)return '';
  return `<section class="taste-quality-recommendations" id="profile-quality-discovery"><div class="tp-section-heading"><p class="tp-kicker">From these patterns</p><h2>More with these qualities</h2></div><div class="taste-recommendation-grid">${routes.map(route=>{const work=byId.get(route.workId);return `<article><figure><button type="button" data-action="deep-art" data-work="${esc(work.id)}" aria-label="View ${esc(short(work))}">${image(work)}</button><figcaption>${esc(short(work))}<small>${esc(work.artist||'')}</small></figcaption></figure><p>${esc(route.reason)}</p>${evidence({...route,id:route.id||'quality-route-'+route.workId,title:short(work),text:route.reason,alternatives:route.alternatives||route.limits||[]})}</article>`;}).join('')}</div></section>`;
}

export function renderTasteBoundaries({profile={},works=[],image,esc,evidence=()=>''}={}){
  const byId=new Map(works.map(work=>[work.id,work])),findings=(profile.findings||[]).filter(item=>item.status==='exploratory-contrast'&&item.supportPairs?.length>=2);
  if(!findings.length)return '';
  return `<section class="taste-quality-section taste-boundaries" id="profile-boundaries"><div class="tp-section-heading"><h2>What separates the choices</h2></div><div class="taste-quality-grid">${findings.slice(0,3).map(item=>{const pair=item.supportPairs[0],high=byId.get(pair.highWorkId),low=byId.get(pair.lowWorkId);if(!high||!low)return '';return `<article class="taste-quality-reading" style="--quality-colour:#827097"><header><h3>${esc(item.title)}</h3></header><p>${esc(item.text)}</p><div class="taste-quality-works">${[[high,pair.highValue,'Rated highly'],[low,pair.lowValue,'Rated lower']].map(([work,value,label])=>`<figure><button type="button" data-action="deep-art" data-work="${esc(work.id)}" aria-label="View ${esc(short(work))}">${image(work)}</button><figcaption><span class="taste-quality-counter-label">${label} · ${value} / 100</span>${esc(short(work))}<small>${esc(work.artist||'')}</small></figcaption></figure>`).join('')}</div>${evidence(item)}</article>`;}).join('')}</div></section>`;
}
