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
  return item.text+(item.arrangementSummary?' '+item.arrangementSummary:'');
}

const axisStrength=axis=>axis.presentationStatus||axis.assessment?.status||(axis.status==='leaning'?'recurring':axis.status==='tentative'?'tentative':axis.status==='mixed'?'balanced':'insufficient');
const axisCount=axis=>count(axis.negativeSetCount)+count(axis.positiveSetCount)+count(axis.mixedSetCount);
function comparisonTally(part,esc){
  const low=count(part.negativeSetCount),high=count(part.positiveSetCount),split=count(part.mixedSetCount),total=low+high+split;
  if(!total)return '<p class="taste-axis-no-contrast">No contrasting groups yet</p>';
  const direction=part.direction||0,left=part.leftLabel||'Lower end',right=part.rightLabel||'Higher end';
  const segment=(side,number)=>Array.from({length:number},()=>`<i data-side="${side}"></i>`).join('');
  const summary=direction?`<strong>${direction<0?low:high} of ${total}</strong> groups favoured <em>${esc(direction<0?left:right)}</em>.`:`<strong>${total} painting ${total===1?'group':'groups'}</strong> compared. ${low&&high?'Choices went both ways.':'No consistent direction yet.'}`;
  return `<div class="taste-axis-balance" data-direction="${direction<0?'low':direction>0?'high':'balanced'}"><p class="taste-axis-balance-summary">${summary}</p><div class="taste-axis-endpoints"><span><b>${low}</b> ${esc(left)}</span><span><b>${high}</b> ${esc(right)}</span></div><div class="taste-axis-segments" style="--comparison-count:${total}" role="img" aria-label="${low} groups favoured ${esc(left)}; ${high} favoured ${esc(right)}; ${split} mixed or close">${segment('low',low)}${segment('split',split)}${segment('high',high)}</div>${split?`<p class="taste-axis-split"><span aria-hidden="true"></span>${split} ${split===1?'group was':'groups were'} mixed or close</p>`:''}</div>`;
}

export function renderTasteAxisIndex({profile={},esc}={}){
  if(!Array.isArray(profile.axes)||!profile.axes.length||!(profile.coverage?.distinctSets>=2))return '';
  return `<nav class="taste-axis-index" aria-label="Visual profile axes">${profile.axes.map(axis=>`<a href="#axis-${esc(axis.key)}" style="--axis-colour:${tones[axis.key]||'#76695d'}"><span>${esc(axis.title)}</span><strong>${esc(['insufficient','not-tested'].includes(axisStrength(axis))?'More comparisons needed':axisDirection(axis))}</strong></a>`).join('')}</nav>`;
}

/** This view receives findings; it never fits a preference model from pictures. */
export function renderTasteAxisProfile({profile={},works=[],image,esc,evidence=()=>''}={}){
  const axes=Array.isArray(profile.axes)?profile.axes:[];
  if(!axes.length)return '';
  const byId=new Map(works.map(work=>[work.id,work]));
  const established=axes.filter(axis=>!['insufficient','not-tested'].includes(axisStrength(axis))),pending=axes.filter(axis=>!established.includes(axis));
  const sourceFor=axis=>({...axis,id:'axis-'+axis.key,module:'visual-axis',title:axis.title,text:axis.summary,alternatives:axis.alternatives||profile.limits||[]});
  function exampleFor(axis){
    const example=axis.support?.find(item=>item.workIds?.length===2&&item.workIds.every(id=>byId.has(id))),ids=unique(example?.workIds||axis.displayWorkIds||[]).filter(id=>byId.has(id)).slice(0,2);
    if(!ids.length)return '';
    return `<div class="taste-axis-example"><p>${example?'One of your comparisons':'Paintings compared'}</p><div class="taste-axis-example-pair">${ids.map((id,index)=>{const work=byId.get(id);return `<figure><span class="taste-axis-example-role" data-preferred="${!!example&&index===0}">${Array.isArray(example?.values)?example.values[index]>50?'Above neutral':example.values[index]<50?'Below neutral':'Neutral':example?(index===0?'Preferred':'Compared with'):'Rated painting'}</span><button type="button" data-action="deep-art" data-work="${esc(id)}" aria-label="View ${esc(short(work))}">${image(work)}</button><figcaption>${esc(short(work))}${Array.isArray(example?.values)?`<small>${example.values[index]} / 100</small>`:''}</figcaption></figure>`;}).join('')}</div>${Number.isFinite(example?.responseGap)?`<p>${example.responseGap}-point appeal gap</p>`:''}</div>`;
  }
  return `<section class="taste-axis-profile" id="profile-axes"><div class="tp-section-heading"><p class="tp-kicker">Across your comparisons</p><h2>Visual profile</h2>${established.length?'<p class="taste-axis-legend"><i aria-hidden="true"></i>One block per painting group</p>':''}</div><div class="taste-axis-grid">${established.map(axis=>{
    const selected=axisDirection(axis),parts=Array.isArray(axis.components)&&axis.components.length>1?axis.components:[axis];
    const strength=axisStrength(axis),strengthLabel={recurring:'Recurring pattern',tentative:'Early tendency',balanced:'No single rule'}[strength]||'More comparisons needed';
    return `<article class="taste-axis-reading" id="axis-${esc(axis.key)}" data-axis-status="${esc(axis.status)}" style="--axis-colour:${tones[axis.key]||'#76695d'}"><header><h3>${esc(axis.title)}</h3><p class="taste-axis-direction">${esc(selected||'No clear direction')}</p><small data-strength="${esc(strength)}">${strengthLabel}</small>${axis.counter?.some(item=>/later|repeated/.test(item.sourceRole||''))?'<p class="taste-axis-later">Later choices included exceptions.</p>':''}</header><div class="taste-axis-tallies">${parts.map(part=>`<div>${parts.length>1?`<p class="taste-axis-component-name">${esc(componentNames[part.feature]||part.feature)}</p>`:''}${comparisonTally(part,esc)}</div>`).join('')}</div><div class="taste-axis-source">${exampleFor(axis)}${evidence(sourceFor(axis))}</div></article>`;
  }).join('')}</div>${pending.length?`<section class="taste-axis-pending"><header><h3>More comparisons needed</h3><p>These axes do not have enough contrasting choices yet.</p></header>${pending.map(axis=>`<article id="axis-${esc(axis.key)}" style="--axis-colour:${tones[axis.key]||'#76695d'}"><h4>${esc(axis.title)}</h4><span>${axisCount(axis)} ${axisCount(axis)===1?'group':'groups'} compared</span>${evidence(sourceFor(axis))}</article>`).join('')}</section>`:''}</section>`;
}

export function renderTasteQualityProfile({profile={},works=[],image,esc,evidence=()=>''}={}){
  const principalIds=new Set(profile.readingSummary?.principalPatternIds||[]),byId=new Map(works.map(work=>[work.id,work])),all=(Array.isArray(profile.patterns)?profile.patterns:[]).filter(item=>(!principalIds.size||principalIds.has(item.id))&&(['qualified','descriptive'].includes(item.status)||item.status==='descriptive-association'&&item.summaryEligible===true)),hasPositiveAdmiration=all.some(item=>item.channel==='admiration-of-making'&&item.direction!==-1);
  const channels=[{id:'appeal',title:'What draws you',colour:'#a05c43',items:all.filter(item=>item.channel!=='admiration-of-making'&&item.direction!==-1)},{id:'admiration',title:'What you admire',colour:'#a08440',items:all.filter(item=>item.channel==='admiration-of-making'&&(!hasPositiveAdmiration||item.direction!==-1))}];
  const renderArt=(id,role,item)=>{const work=byId.get(id),label=role==='explicit-dislike'?'Explicitly disliked, same quality':role==='counter'?'Lower rated, same quality':role==='counterexample'?'A counterexample':role==='favourite-exception'?'Favourite without this quality':role==='favourite'?'Selected favourite':role==='comparison'?'Comparison in this set':'';return work?`<figure data-quality-role="${role||'support'}"><button type="button" data-action="deep-art" data-work="${esc(id)}" aria-label="View ${esc(short(work))}">${image(work)}</button><figcaption>${label?`<span class="taste-quality-counter-label">${esc(label)}</span>`:''}${esc(short(work))}<small>${esc(work.artist||'')}</small>${item&&['explicit-dislike','counterexample','counter'].includes(role)?`<small class="taste-quality-exception-note">${esc(role==='explicit-dislike'?'You explicitly disliked this work despite its '+item.title.toLowerCase()+'.':'This lower-rated work shares '+item.title.toLowerCase()+'; the quality alone does not explain its appeal.')}</small>`:''}</figcaption></figure>`:'';};
  const leadingIds=new Set(profile.readingSummary?.patternIds||[]),presented=new Set(),sections=channels.filter(channel=>channel.items.length).map(channel=>{
    const ranked=[...channel.items].sort((a,b)=>Number(leadingIds.has(b.id))-Number(leadingIds.has(a.id))||Number(b.summaryEligible)-Number(a.summaryEligible)||(b.explanationEvidence?.score||0)-(a.explanationEvidence?.score||0)||(b.priority||0)-(a.priority||0)),byQuality=new Map();
    for(const item of ranked)if(!byQuality.has(item.qualityKey||item.id))byQuality.set(item.qualityKey||item.id,item);
    const items=[],coveredAttributes=new Set();
    for(const item of byQuality.values()){
      if(items.length>=4)break;
      if(!leadingIds.has(item.id)&&item.attributes?.length&&item.attributes.every(key=>coveredAttributes.has(key)))continue;
      items.push(item);for(const key of item.attributes||[])coveredAttributes.add(key);
    }
    items.forEach(item=>presented.add(item.id));
    return `<section class="taste-quality-section" id="profile-${channel.id}-qualities" style="--quality-colour:${channel.colour}"><div class="tp-section-heading"><p class="tp-kicker">Patterns across paintings</p><h2>${channel.title}</h2></div><div class="taste-quality-grid">${items.map(item=>{
      const explicitCounters=new Set(item.explicitDislikesWithQuality||[]),ids=unique(item.displayWorkIds||item.evidence||[]).filter(id=>byId.has(id)).slice(0,item.displayRoles?3:2),counter=ids.some(id=>['explicit-dislike','counterexample','counter','favourite-exception'].includes(item.displayRoles?.[id]))?null:unique([...(item.explicitDislikesWithQuality||[]),...(item.lowerRatedWithQuality||[]),...(item.ratingAssociation?.lowerRatedFavouredWorkIds||[])]).find(id=>byId.has(id)&&!ids.includes(id)),rivals=(item.competingExplanations||[]).map(other=>other.title);
      const basis=item.channel==='explicit-favourites'?'Selected favourites':item.channel==='admiration-of-making'?'Admiration of making':item.channel==='personal-appeal'?'Personal appeal':item.channel==='overall-appeal'?'Overall ratings':'Preference comparisons';
      return `<article class="taste-quality-reading" id="${esc(item.id)}"><header><p class="taste-quality-basis">${basis}${item.explanationEvidence?.kind==='shared-favourites'?' · Shared connection':''}</p><h3>${esc(qualityHeading(item))}</h3></header><p>${esc(qualityExplanation(item))}</p>${rivals.length?`<p class="taste-quality-rival">The same choices also fit ${esc(rivals.join(', '))}. A comparison where these differ would refine this reading.</p>`:''}<div class="taste-quality-works">${ids.map(id=>renderArt(id,item.displayRoles?.[id]||'support',item)).join('')}${counter?renderArt(counter,explicitCounters.has(counter)?'explicit-dislike':'counter',item):''}</div>${evidence(item)}</article>`;
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
  const byId=new Map(works.map(work=>[work.id,work])),findings=(profile.findings||[]).filter(item=>item.summaryEligible!==false&&['exploratory-contrast','explicit-choice-contrast'].includes(item.status)&&item.supportPairs?.length>=2);
  if(!findings.length)return '';
  const cards=findings.slice(0,3).map(item=>{
    const pair=item.supportPairs[0],high=byId.get(pair.highWorkId),low=byId.get(pair.lowWorkId),explicit=item.status==='explicit-choice-contrast';if(!high||!low)return '';
    const figures=[[high,pair.highValue,explicit?'Favourite':item.displayNotes?.[high.id]||'Rated highly'],[low,pair.lowValue,explicit?'Explicitly disliked comparison':item.displayNotes?.[low.id]||'Lower-rated comparison']].map(([work,value,label])=>{
      const notes=item.displayReviewNotes?.[work.id];
      return `<figure><button type="button" data-action="deep-art" data-work="${esc(work.id)}" aria-label="View ${esc(short(work))}">${image(work)}</button><figcaption><span class="taste-quality-counter-label">${esc(label)}${!explicit&&Number.isFinite(value)?` · ${value} / 100`:''}</span>${esc(short(work))}<small>${esc(work.artist||'')}</small>${notes?`<small class="taste-quality-exception-note"><b>Shared quality:</b> ${esc(notes.shared)}</small><small class="taste-quality-exception-note"><b>What differs:</b> ${esc(notes.contrast)}</small>`:''}</figcaption></figure>`;
    }).join('');
    return `<article class="taste-quality-reading" style="--quality-colour:#827097"><header><p class="taste-quality-rival">Possible distinction · ${item.supportPairs.length} selected comparisons</p><h3>${esc(item.title)}</h3></header><p>${esc(item.text)}</p><div class="taste-quality-works">${figures}</div>${item.comparisonNote?`<p class="taste-quality-rival">${esc(item.comparisonNote)}</p>`:''}${evidence(item)}</article>`;
  }).join('');
  return `<section class="taste-quality-section taste-boundaries" id="profile-boundaries"><div class="tp-section-heading"><h2>Possible distinctions to test</h2></div><div class="taste-quality-grid">${cards}</div></section>`;
}

export function renderDeclaredPreferences({profile={},works=[],image,esc,evidence=()=>''}={}){
  const byId=new Map(works.map(work=>[work.id,work])),groups=[{key:'favourites',title:'Favourites',items:profile.explicitFavourites},{key:'dislikes',title:'Dislikes',items:profile.explicitDislikes}].map(group=>({...group,items:[...new Map((group.items||[]).filter(item=>byId.has(item.workId)&&item.sourceRoundIds?.length).map(item=>[item.workId,item])).values()]})).filter(group=>group.items.length);
  if(!groups.length)return '';
  return `<details class="tp-more tp-declarations" data-evidence-title="Favourites & dislikes"><summary>Favourites & dislikes <span aria-hidden="true">↗</span></summary><div class="tp-evidence-body">${groups.map(group=>`<section class="tp-declared-group"><h3>${group.title}</h3><div class="tp-painting-gallery">${group.items.map(item=>{const work=byId.get(item.workId);return `<figure><button class="tp-art" type="button" data-action="deep-art" data-work="${esc(work.id)}" aria-label="View ${esc(short(work))}">${image(work)}</button><figcaption>${esc(short(work))}<small>${esc(work.artist||'')}</small></figcaption>${evidence({...item,id:'declared-'+group.key+'-'+work.id,title:short(work),text:group.title==='Favourites'?'Selected as a favourite.':'Selected as disliked.'})}</figure>`;}).join('')}</div></section>`).join('')}</div></details>`;
}
