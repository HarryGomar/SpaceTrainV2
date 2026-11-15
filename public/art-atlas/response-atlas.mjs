import {axisColours} from './task-signals.mjs';
import {createAtlasPicker} from './atlas-picker.mjs';
import {atlasPointMarkup,updateAtlasPointDisplay} from './atlas-points.mjs';
import {createAtlasNavigation,clampAtlasView,atlasScreenToWorld} from './atlas-navigation.mjs';
import {buildResponseAtlas} from './response-atlas-data.mjs';
import {restoreStudyRound} from './deep-study.mjs';
import {AXES} from './engine.mjs';
const app=document.querySelector('#atlas'),esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const picker=createAtlasPicker(app);
const short=work=>work?.shortTitle||work?.title||'';
const roundLabel=id=>/^journey-\d+$/.test(id||'')?'Round '+Number(id.slice(8)):'Original question';
let works=[],atlas,mode='collection',mapId='',roundId='',xId='abstraction',yId='complexity',selectedId=null,zoom=1,pan=[0,0],photos=true,currentPoints=[],currentEdges=[],currentAxes=null;
let plotWidth=1000,plotHeight=680,navigation=null,pointFrame=null,currentGroups=new Map();
const get=id=>works.find(work=>work.id===id),pointKey=point=>point.id||point.workId;
const pointPosition=point=>[32+point.x/100*(plotWidth-64),plotHeight-32-point.y/100*(plotHeight-64)];
const pointOptions=()=>({get,selectedId,mode,zoom,photos,position:pointPosition,pointKey,roundLabel,esc});
function resetView(){zoom=1;pan=[0,0];selectedId=null;}
function shell(){app.innerHTML=`<header class="atlas-top"><a href="./">← Art Atlas</a><nav aria-label="Atlas views">${[['responses','Your responses'],['collection','Collection map'],['comparisons','Your comparisons']].map(([id,label])=>`<button type="button" data-mode="${id}" aria-pressed="${mode===id}">${label}</button>`).join('')}</nav><a href="./profiles.html">Profiles ↗</a></header><div class="atlas-heading"><h1>Your art atlas.</h1><p id="atlas-intro"></p></div><div class="atlas-controls"></div><section class="atlas-workspace"><div class="atlas-main"><div class="atlas-map-frame"><span class="atlas-y-high"></span><span class="atlas-x-low"></span><div class="atlas-drawing"><svg id="atlas-svg" viewBox="0 0 1000 680" role="group" tabindex="0" aria-label="Interactive painting map" aria-describedby="atlas-navigation-help"><defs><marker id="atlas-arrow" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5" fill="#9e8a72"/></marker><clipPath id="atlas-clip"><rect x="0" y="0" width="1000" height="680"/></clipPath></defs><g clip-path="url(#atlas-clip)"><g id="atlas-view"></g></g></svg><div class="atlas-zoom" role="group" aria-label="Map zoom"><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="reset" aria-label="Reset map to 100 percent" title="Reset view">100%</button><button type="button" data-zoom="in" aria-label="Zoom in">+</button></div></div><span class="atlas-x-high"></span><span class="atlas-y-low"></span></div><div class="atlas-map-tools"><span id="atlas-count"></span><div><button type="button" data-photos aria-pressed="true">Paintings</button></div></div><p class="atlas-map-note"></p><span id="atlas-navigation-help" class="atlas-sr-only">Scroll or pinch to zoom. Drag to pan. When the map is focused, use plus, minus or zero to reset.</span></div><aside class="atlas-detail" aria-live="polite"></aside></section><footer class="atlas-footer"><button type="button" data-method>About this map ↗</button><a href="./paintings.html">Paintings ↗</a><a href="./">Back to the study →</a></footer>`;renderControls();bindPlot();}
function renderControls(){
  for(const button of app.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
  const controls=app.querySelector('.atlas-controls'),intro=app.querySelector('#atlas-intro');
  if(mode==='collection'){
    intro.textContent='Explore the collection through its subjects, composition and colour.';app.style.setProperty('--x','#7f7568');app.style.setProperty('--y','#7f7568');
    controls.innerHTML=`<label><span class="axis-dot x"></span>Across<select id="atlas-x">${atlas.dimensions.map(d=>`<option value="${d.id}" ${d.id===xId?'selected':''}>${esc(d.title)}</option>`).join('')}</select></label><label><span class="axis-dot y"></span>Up<select id="atlas-y">${atlas.dimensions.map(d=>`<option value="${d.id}" ${d.id===yId?'selected':''}>${esc(d.title)}</option>`).join('')}</select></label><p>Artwork descriptions · not your ratings</p>`;
  }else if(mode==='responses'){
    intro.textContent='Your placements, with the original questions and scales.';
    const maps=[...atlas.maps,...atlas.matchedPanels];if(!maps.some(map=>map.id===mapId))mapId=(maps.find(map=>['achievement','reading','returnResponse'].includes(map.axisId))||maps[0])?.id||'';
    const map=maps.find(map=>map.id===mapId),sources=map?.sourceRoundIds||[],tones=axisColours(map?.axisId);app.style.setProperty('--x',tones[0]);app.style.setProperty('--y',tones[1]);
    controls.innerHTML=maps.length?`<label>Map<select id="atlas-map">${maps.map(map=>`<option value="${esc(map.id)}" ${map.id===mapId?'selected':''}>${esc(map.title)}</option>`).join('')}</select></label>${map.kind==='matched-preference-curiosity'?`<label>Paintings<select id="atlas-paired">${atlas.matchedPanels.map(panel=>`<option value="${esc(panel.id)}" ${panel.id===mapId?'selected':''}>${panel.sourceRoundIds.map(roundLabel).map(esc).join(' + ')}</option>`).join('')}</select></label>`:`<label>Question<select id="atlas-round"><option value="">All placements in this map</option>${sources.map(id=>`<option value="${esc(id)}" ${id===roundId?'selected':''}>${esc(roundLabel(id))}</option>`).join('')}</select></label>`}`:'<p>No completed maps yet</p>';
  }else{
    intro.textContent='The painting comparisons you actually made.';
    controls.innerHTML=`<p>${atlas.graph.nodes.length} paintings · ${atlas.graph.sourceRoundIds.length} preference rounds · ${atlas.graph.comparisonComponents.length} comparison groups</p><label>Group<select id="atlas-component"><option value="">All comparison groups</option>${atlas.graph.comparisonComponents.map((component,index)=>`<option value="${esc(component.id)}" ${component.id===roundId?'selected':''}>Group ${index+1} · ${component.workIds.length} paintings</option>`).join('')}</select></label>`;
  }
  const previews=Object.fromEntries(atlas.matchedPanels.map(map=>[map.id,{label:map.sourceRoundIds.map(roundLabel).join(' + '),images:map.workIds.map(get).filter(Boolean).map(work=>({src:'./'+work.image,title:short(work)}))}]));
  picker.decorate(controls,Object.fromEntries(atlas.dimensions.map(d=>[d.id,d.low+' → '+d.high])),previews);renderPlot();
}
const normalise=(value,domain)=>domain&&domain[1]!==domain[0]?(value-domain[0])/(domain[1]-domain[0]):.5;
function collectPoints(){
  currentEdges=[];const previousWins=new Set(atlas.graph.edges.map(edge=>edge.source));
  if(mode==='collection'){
    const x=atlas.dimensions.find(d=>d.id===xId),y=atlas.dimensions.find(d=>d.id===yId),ys=new Map(y.values.map(v=>[v.workId,v]));
    currentAxes={xName:x.title,yName:y.title,left:x.kind==='date-range'?x.domain?.[0]:x.low,right:x.kind==='date-range'?x.domain?.[1]:x.high,bottom:y.kind==='date-range'?y.domain?.[0]:y.low,top:y.kind==='date-range'?y.domain?.[1]:y.high};
    return x.values.filter(value=>ys.has(value.workId)).map(value=>({id:'collection:'+value.workId,workId:value.workId,x:normalise(value.value,x.domain)*100,y:normalise(ys.get(value.workId).value,y.domain)*100,rawX:value.value,rawY:ys.get(value.workId).value,ledComparison:previousWins.has(value.workId)}));
  }
  if(mode==='responses'){
    const map=[...atlas.maps,...atlas.matchedPanels].find(map=>map.id===mapId);currentAxes=map?.axisDefinition||null;
    return (map?.points||[]).filter(point=>!roundId||point.roundId===roundId||point.sourceRoundIds?.includes(roundId));
  }
  currentAxes=null;const groups=atlas.graph.comparisonComponents.filter(group=>!roundId||group.id===roundId),cols=Math.ceil(Math.sqrt(groups.length||1)),rows=Math.ceil(groups.length/cols),points=[];
  groups.forEach((group,index)=>{const cx=(index%cols+.5)/cols*100,cy=(Math.floor(index/cols)+.5)/rows*100,rx=37/cols,ry=35/rows;group.workIds.forEach((workId,i)=>{const angle=i/group.workIds.length*Math.PI*2;points.push({id:'graph:'+workId,workId,x:cx+Math.cos(angle)*rx,y:cy+Math.sin(angle)*ry,componentId:group.id});});});
  const visible=new Set(points.map(point=>point.workId));currentEdges=atlas.graph.edges.filter(edge=>visible.has(edge.source)&&visible.has(edge.target));return points;
}
function renderPlot(detail=true){
  const box=app.querySelector('.atlas-drawing').getBoundingClientRect();plotWidth=Math.max(200,box.width);plotHeight=Math.max(200,box.height);app.querySelector('#atlas-svg').setAttribute('viewBox',`0 0 ${plotWidth} ${plotHeight}`);const clip=app.querySelector('#atlas-clip rect');clip.setAttribute('width',plotWidth);clip.setAttribute('height',plotHeight);
  const bounded=clampAtlasView({zoom,pan},{width:plotWidth,height:plotHeight});zoom=bounded.zoom;pan=bounded.pan;
  currentPoints=collectPoints();app.dataset.mode=mode;
  app.querySelector('.atlas-y-high').innerHTML=currentAxes?`<strong>${esc(currentAxes.yName)} ↑</strong><span>${esc(currentAxes.top)}</span>`:'';
  app.querySelector('.atlas-y-low').textContent=currentAxes?.bottom||'';app.querySelector('.atlas-x-low').textContent=currentAxes?.left||'';
  app.querySelector('.atlas-x-high').innerHTML=currentAxes?`<strong>${esc(currentAxes.xName)} →</strong><span>${esc(currentAxes.right)}</span>`:'';
  const position=pointPosition;
  const positions=new Map(currentPoints.map(point=>[point.workId,position(point)]));
  const lines=currentEdges.map(edge=>{const a=positions.get(edge.source),b=positions.get(edge.target),active=selectedId&&[edge.source,edge.target].some(id=>'graph:'+id===selectedId);return `<path class="atlas-edge ${active?'selected':''}" marker-end="url(#atlas-arrow)" d="M${a[0]} ${a[1]}L${b[0]-(b[0]-a[0])/Math.max(1,Math.hypot(b[0]-a[0],b[1]-a[1]))*24} ${b[1]-(b[1]-a[1])/Math.max(1,Math.hypot(b[0]-a[0],b[1]-a[1]))*24}"/>`;}).join('');
  const groups=new Map();for(const point of currentPoints){const key=Math.round(point.x*10)+':'+Math.round(point.y*10);groups.set(key,[...(groups.get(key)||[]),point]);}
  currentGroups=groups;const circles=atlasPointMarkup(groups,pointOptions());
  const left=position({x:0,y:50}),right=position({x:100,y:50}),top=position({x:50,y:100}),bottom=position({x:50,y:0});
  const axes=currentAxes?`<g class="atlas-axis-guides" aria-hidden="true"><path class="atlas-axis-x" d="M${left[0]} ${left[1]}H${right[0]}M${right[0]-5} ${right[1]-3}L${right[0]} ${right[1]}L${right[0]-5} ${right[1]+3}"/><path class="atlas-axis-y" d="M${bottom[0]} ${bottom[1]}V${top[1]}M${top[0]-3} ${top[1]+5}L${top[0]} ${top[1]}L${top[0]+3} ${top[1]+5}"/></g>`:'';
  app.querySelector('#atlas-view').innerHTML=axes+lines+circles;transform();
  app.querySelector('#atlas-count').textContent=currentPoints.length+(mode==='collection'?' of '+works.length:'')+' '+(mode==='responses'?'recorded placements':'paintings');
  app.querySelector('.atlas-map-note').textContent=mode==='collection'?'Positions describe the paintings. Rust marks a work that led one of your comparisons. Zoom for more images.':mode==='responses'?'Each point is a recorded placement. Select it for the painting and its question. Zoom for more images.':'Arrows show higher to lower placements within a question. Separate groups have not been directly compared. Distances have no taste meaning.';
  if(!currentPoints.length)app.querySelector('#atlas-view').innerHTML=`<text x="${plotWidth/2}" y="${plotHeight/2}" text-anchor="middle" class="atlas-empty">${mode==='collection'?'No recorded positions on these dimensions.':mode==='comparisons'?'Your comparisons will appear here.':'Your completed placements will appear here.'}</text>`;
  if(detail)renderDetail();
}
function renderDetail(){
  const point=currentPoints.find(p=>pointKey(p)===selectedId),host=app.querySelector('.atlas-detail');
  if(!point){host.innerHTML='<div class="atlas-detail-empty"><p>Select a painting.</p><span>Explore its position, source and your recorded choices.</span></div>';return;}
  const work=get(point.workId),node=atlas.graph.nodes.find(node=>node.workId===point.workId),overlap=currentPoints.filter(other=>Math.abs(other.x-point.x)<.1&&Math.abs(other.y-point.y)<.1),edges=atlas.graph.edges.filter(edge=>edge.workIds.includes(work.id)),questions=(node?.sourceRoundIds||[...new Set(edges.map(edge=>edge.roundId))]).map(id=>edges.find(edge=>edge.roundId===id)||{roundId:id,tied:true});
  host.innerHTML=`<button class="atlas-inspect" type="button" data-inspect-work="${esc(work.id)}" aria-label="View ${esc(short(work))} larger"><img class="atlas-detail-image" src="./${esc(work.image)}" alt="${esc(work.alt)}"><span>Look closer ↗</span></button><h2>${esc(short(work))}</h2><p>${esc(work.artist)}${work.date?' · '+esc(work.date):''}</p>${mode==='responses'?`<div class="atlas-values"><div><span>${esc(currentAxes.xName)}</span><strong>${point.x}<small>/100</small></strong></div><div><span>${esc(currentAxes.yName)}</span><strong>${point.y}<small>/100</small></strong></div></div><p class="atlas-source-question">${esc(roundLabel(point.roundId))} · ${esc(point.roundTitle)}</p>`:mode==='collection'?`<div class="atlas-descriptor-list"><p>${esc(currentAxes.xName)} <strong>${xId==='date'?esc(work.date):point.rawX<.34?'Low':point.rawX>.66?'High':'Middle'}</strong></p><p>${esc(currentAxes.yName)} <strong>${yId==='date'?esc(work.date):point.rawY<.34?'Low':point.rawY>.66?'High':'Middle'}</strong></p></div><small>Visual descriptions are provisional annotations. Date positions use the midpoint of a recorded interval.</small>`:`<p class="atlas-source-question">Compared in ${questions.length} recorded ${questions.length===1?'round':'rounds'}.</p><div class="atlas-comparison-list">${questions.slice(0,8).map(edge=>`<p>${esc(roundLabel(edge.roundId))}<br><span>${edge.tied?'No clear preference order in this comparison.':esc(short(get(edge.source)))+' ranked above '+esc(short(get(edge.target)))}</span></p>`).join('')}</div>`}${overlap.length>1?`<div class="atlas-overlaps"><span>${overlap.length} placements at this position</span>${overlap.map(other=>`<button type="button" data-point="${esc(pointKey(other))}" aria-pressed="${pointKey(other)===selectedId}">${esc(short(get(other.workId)))}${other.roundId?' · '+esc(roundLabel(other.roundId)):''}</button>`).join('')}</div>`:''}<a href="${esc(work.sourceUrl)}" target="_blank" rel="noopener noreferrer">Collection source ↗</a>`;
}
function transform(){
  app.querySelector('#atlas-view').setAttribute('transform',`translate(${plotWidth/2+pan[0]} ${plotHeight/2+pan[1]}) scale(${zoom}) translate(${-plotWidth/2} ${-plotHeight/2})`);
  app.querySelector('#atlas-svg').style.cursor=zoom>1?'grab':'default';
  const reset=app.querySelector('[data-zoom=reset]');reset.textContent=Math.round(zoom*100)+'%';reset.setAttribute('aria-label','Reset map to 100 percent'+'; current zoom '+Math.round(zoom*100)+' percent');app.querySelector('[data-zoom=out]').disabled=zoom<=1;app.querySelector('[data-zoom=in]').disabled=zoom>=8;
}
function updatePointView(){if(pointFrame!==null)return;pointFrame=requestAnimationFrame(()=>{pointFrame=null;const host=app.querySelector('#atlas-view');if(host)updateAtlasPointDisplay(host,currentGroups,pointOptions());});}
function bindPlot(){
  navigation?.destroy();navigation=createAtlasNavigation({element:app.querySelector('.atlas-drawing'),getSize:()=>({width:plotWidth,height:plotHeight}),getView:()=>({zoom,pan}),setView:(view,{zoomChanged})=>{zoom=view.zoom;pan=view.pan;transform();if(zoomChanged)updatePointView();},onGestureEnd:updatePointView});
  new ResizeObserver(()=>{const box=app.querySelector('.atlas-drawing').getBoundingClientRect();if(Math.abs(box.width-plotWidth)>1||Math.abs(box.height-plotHeight)>1)renderPlot();}).observe(app.querySelector('.atlas-drawing'));
}
function inspectArtwork(id){
  const work=get(id);if(!work)return;let dialog=document.querySelector('#atlas-art-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='atlas-art-dialog';dialog.className='atlas-art-dialog';dialog.setAttribute('aria-labelledby','atlas-art-title');document.body.append(dialog);dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-close-art]'))dialog.close();});dialog.addEventListener('close',()=>document.documentElement.classList.remove('atlas-dialog-open'));}
  dialog.innerHTML=`<header><div><h2 id="atlas-art-title">${esc(short(work))}</h2><p>${esc(work.artist)}${work.date?' · '+esc(work.date):''}</p></div><button type="button" data-close-art aria-label="Close artwork">×</button></header><img src="./${esc(work.image)}" alt="${esc(work.alt)}"><a href="${esc(work.sourceUrl)}" target="_blank" rel="noopener noreferrer">Collection source ↗</a>`;document.documentElement.classList.add('atlas-dialog-open');dialog.showModal();
}
app.addEventListener('click',event=>{
  if(event.target.closest('.atlas-drawing')&&!event.target.closest('[data-zoom]')&&navigation?.consumeClick()){event.preventDefault();event.stopPropagation();return;}
  const m=event.target.closest('button[data-mode]');if(m){mode=m.dataset.mode;roundId='';resetView();renderControls();return;}
  let point=event.target.closest('[data-point]');
  if(event.target.closest('#atlas-svg')&&!point?.classList.contains('has-thumbnail')){
    const svg=app.querySelector('#atlas-svg'),box=svg.getBoundingClientRect(),[x,y]=atlasScreenToWorld([(event.clientX-box.left)/box.width*plotWidth,(event.clientY-box.top)/box.height*plotHeight],{zoom,pan},{width:plotWidth,height:plotHeight});
    const nearest=[...svg.querySelectorAll('[data-point]')].map(el=>({el,distance:Math.hypot(Number(el.dataset.mapX)-x,Number(el.dataset.mapY)-y)})).sort((a,b)=>a.distance-b.distance)[0];point=nearest?.distance<=40/zoom*plotWidth/box.width?nearest.el:null;
  }
  if(point){selectedId=point.dataset.point;renderPlot();return;}
  const z=event.target.closest('[data-zoom]');if(z){if(z.dataset.zoom==='reset')navigation.reset();else navigation.zoomAt(z.dataset.zoom==='in'?1.35:1/1.35);return;}
  const inspect=event.target.closest('[data-inspect-work]');if(inspect){inspectArtwork(inspect.dataset.inspectWork);return;}
  if(event.target.closest('[data-photos]')){photos=!photos;event.target.closest('button').setAttribute('aria-pressed',String(photos));renderPlot();return;}
  if(event.target.closest('[data-method]')){const d=document.querySelector('#atlas-method'),limits=mode==='collection'?[...atlas.dimensions.find(d=>d.id===xId).limits,...atlas.dimensions.find(d=>d.id===yId).limits]:mode==='comparisons'?atlas.graph.limits:([...atlas.maps,...atlas.matchedPanels].find(map=>map.id===mapId)?.limits||[]);d.querySelector('div').innerHTML=[...new Set(limits)].map(text=>`<p>${esc(text)}</p>`).join('');d.showModal();}
});
app.addEventListener('change',event=>{const {id,value}=event.target;if(id==='atlas-x')xId=value;if(id==='atlas-y')yId=value;if(id==='atlas-map'||id==='atlas-paired'){mapId=value;roundId='';}if(id==='atlas-round'||id==='atlas-component')roundId=value;resetView();renderControls();});
app.addEventListener('keydown',event=>{const point=event.target.closest('[data-point]');if(point&&['Enter',' '].includes(event.key)){event.preventDefault();selectedId=point.dataset.point;renderPlot();[...app.querySelectorAll('[data-point]')].find(el=>el.dataset.point===selectedId)?.focus({preventScroll:true});}});
const method=document.querySelector('#atlas-method');method.querySelector('button').addEventListener('click',()=>method.close());
try{
  const response=await fetch('./artworks.json');if(!response.ok)throw Error('Catalogue unavailable');const current=await response.json();let saved=null;try{saved=JSON.parse(localStorage.getItem('art-profile-journey-v1'));}catch{}
  const captured=Array.isArray(saved?.manifest?.catalogue)?saved.manifest.catalogue:[];works=[...new Map([...current,...captured].map(work=>[work.id,work])).values()];
  const rounds=Object.values(saved?.shown||{}).map(snapshot=>restoreStudyRound(snapshot.kind==='grid'&&!snapshot.axisDefinition&&saved?.manifest?.axisDefinitions?.[snapshot.axis]?{...snapshot,axisDefinition:saved.manifest.axisDefinitions[snapshot.axis]}:snapshot,works)).filter(Boolean);
  atlas=buildResponseAtlas({works,rounds,answers:saved?.answers||{}});if(atlas.maps.length||atlas.matchedPanels.length)mode='responses';shell();
}catch{app.innerHTML='<p class="atlas-loading">The collection could not load. <a href="./maps.html">Try again</a></p>';}
