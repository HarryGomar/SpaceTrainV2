const icons={choice:'M4 5h6v14H4zM14 5h6v14h-6z',grid:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',meaning:'M5 6h14v10H9l-4 4zM9 10h6M9 13h4',response:'M3 12c3-8 6-8 9 0s6 8 9 0',making:'M5 19l4-1 11-11-4-4L5 14zM13 6l5 5',link:'M9 15l6-6M7 14H6a4 4 0 0 1 0-8h5M13 18h5a4 4 0 0 0 0-8h-1',curation:'M4 4h16v16H4zM12 4v16M4 12h8M12 10h8',story:'M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zM12 6v14',quote:'M4 5h16v11H10l-5 4v-4H4z',time:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2'};
export const TASK_COLOURS={preference:'#a05c43',curiosity:'#4e6d94',familiarity:'#4e6d94',emotion:'#8c6381',meaning:'#917329',making:'#917329',connection:'#7465a0',curation:'#7465a0',description:'#7f7568'};
export function axisColours(axis){const keys=axis==='achievement'?['preference','making']:axis==='reading'?['curiosity','meaning']:axis==='returnResponse'?['emotion','preference']:axis==='connection'?['curiosity','connection']:axis==='meaning'?['meaning','curiosity']:axis==='preference-curiosity'?['preference','curiosity']:['emotion','curiosity'];return keys.map(key=>TASK_COLOURS[key]);}
export function taskSignal(round={}){
  if(round.kind==='contrast')return round.contrastKind==='chronology'?{key:'familiarity',label:'Dates',icon:'time',terms:['time','order']}:round.contrastKind==='neighbour'?{key:'curation',label:'Connections',icon:'link',terms:['neighbour','connection']}:round.contrastKind==='keep-leave'?{key:'preference',label:'Selection',icon:'choice',terms:['keep','leave']}:{key:'preference',label:'Shared subject',icon:'choice',terms:['subject','treatments','prefer']};
  if(round.kind==='choice-grid')return round.selectionMode==='familiarity'?{key:'familiarity',label:'Familiarity',icon:'eye',terms:['seen','recognise']}:round.evidence?.construct==='overall-favourites'?{key:'preference',label:'Favourites',icon:'grid',terms:['favourites','favourite','choose']}:{key:'preference',label:'First choices',icon:'grid',terms:['keep','choose']};
  if(round.kind==='exercise')return {key:'curation',label:'Curation',icon:'curation',terms:['group','rooms','remove','arrange']};
  if(round.kind==='match')return {key:'familiarity',label:round.field==='artist'?'Artist match':'Style match',icon:'eye',terms:['artists','style','tradition','match']};
  if(round.kind==='context')return round.symbolismProtocol?{key:'meaning',label:'Symbolism',icon:'meaning',terms:['appeal','symbols','meaning']}:{key:'meaning',label:'Before & after',icon:'story',terms:['like','story','read']};
  if(round.kind==='statements')return {key:'connection',label:'Your view',icon:'quote',terms:['agree','disagree']};
  if(round.evidence?.family==='looking-appraisal')return {key:round.evidence.construct==='attention-to-making'?'making':'description',label:round.evidence.construct==='attention-to-making'?'Making':'Visual judgment',icon:'making',terms:['made','figures','detail','open','take in','unexpected','density','crowded']};
  if(round.kind==='grid'){
    if(['reading','meaning'].includes(round.axis))return {key:'meaning',label:'Interpretation',icon:'meaning',terms:['meaning','interpretation','clear','open']};
    if(['achievement','admiration','making'].includes(round.axis))return {key:'making',label:'Admiration',icon:'making',terms:['admire','making','craft','for you']};
    if(round.axis==='returnResponse')return {key:'emotion',label:'Emotion & return',icon:'response',terms:['unsettling','another look','return']};
    if(['surprise','return'].includes(round.axis))return {key:'curiosity',label:'Surprise & return',icon:'eye',terms:['surprising','surprise','return']};
    if(round.axis==='connection')return {key:'connection',label:'Connection',icon:'link',terms:['clear','personal','understand']};
    return {key:'emotion',label:'Emotional response',icon:'response',terms:['tension','emotion','story','feel','attention']};
  }
  if(round.evidence?.construct==='curiosity'||round.criterion==='interest')return {key:'curiosity',label:'Curiosity',icon:'eye',terms:['understand','investigate','curious','return']};
  if(round.evidence?.measurementScope==='overall-appeal'&&round.evidence?.appealProtocol==='overall-appeal-v1')return {key:'preference',label:'Overall rating',icon:'choice',terms:['like','overall','appeal']};
  return {key:'preference',label:'Preference',icon:'choice',terms:['prefer','like','rank','choose']};
}
export function applyTaskSignals(app,round){
  const root=app.querySelector('.deep-question');if(!root||!round)return;
  const signal=taskSignal(round),colour=TASK_COLOURS[signal.key];root.dataset.taskSignal=signal.key;root.style.setProperty('--task-ink',colour);
  const host=round.kind==='statements'?root.querySelector('.deep-statement'):root.querySelector('.question-head,.sorting-head>div,.difficult-question,.gallery-task');if(!host)return;
  let label=host.querySelector(':scope>.task-signal');if(!label){label=app.ownerDocument.createElement('div');label.className='task-signal';host.prepend(label);}
  label.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[signal.icon]||icons.choice}"/></svg><span>${signal.label}</span>`;
  const axes=round.axisDefinition,axisTones=round.axis==='achievement'?['preference','making']:round.axis==='reading'?['curiosity','meaning']:round.axis==='returnResponse'?['emotion','preference']:round.axis==='connection'?['curiosity','connection']:round.axis==='meaning'?['meaning','curiosity']:['emotion','curiosity'];
  if(round.kind==='grid'&&axes){let key=host.querySelector(':scope>.task-axis-key');if(!key){key=app.ownerDocument.createElement('div');key.className='task-axis-key';host.append(key);}key.replaceChildren();for(const [index,name] of [axes.xName,axes.yName].entries()){const span=app.ownerDocument.createElement('span');span.style.color=TASK_COLOURS[axisTones[index]];span.textContent=(index?'↑ ':'↔ ')+name;key.append(span);}for(const el of root.querySelectorAll('.map-axis-left,.map-axis-right'))el.style.color=TASK_COLOURS[axisTones[0]];for(const el of root.querySelectorAll('.map-axis-top,.map-axis-bottom'))el.style.color=TASK_COLOURS[axisTones[1]];}
  const heading=host.querySelector('h1,h2');
  if(heading){const title=heading.textContent,escaped=signal.terms.map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),regex=new RegExp('\\b('+escaped.join('|')+')\\b','gi');heading.replaceChildren();let last=0;for(const match of title.matchAll(regex)){heading.append(title.slice(last,match.index));const mark=app.ownerDocument.createElement('mark');mark.className='task-focus-word';mark.textContent=match[0];heading.append(mark);last=match.index+match[0].length;}heading.append(title.slice(last));}
  const a=round.axisDefinition;for(const el of root.querySelectorAll('.map-axis-left,.map-axis-right,.map-axis-top,.map-axis-bottom,.spectrum-labels'))el.classList.add('task-axis-label');
  if(round.kind==='grid'&&a){const pad=root.querySelector('#response-pad');if(pad)pad.dataset.taskAxis=round.axis;}
}
