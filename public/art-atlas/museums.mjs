import { feature, buildRounds, validAnswer } from './engine.mjs';
import { selectedIds, validScenario, hasRoomBriefs, roomWorkIds } from './scenarios.mjs';

// Collection facts are sourced. Feature lenses and the matching rule are editorial hypotheses.
export const MUSEUMS = [
  {id:'munal',name:'Museo Nacional de Arte',city:'Mexico City',country:'Mexico',region:'Americas',artists:['José María Velasco','Saturnino Herrán'],countries:['Mexico'],lenses:[['atmosphere',1],['narrative',1],['humanity',1]],focus:'Mexican landscape, nineteenth-century painting and early modern painting.',fact:'MUNAL holds a major José María Velasco collection and painting from colonial, nineteenth-century and modern Mexico.',sourceUrl:'https://www.munal.gob.mx/munal/exposicion-velasco.html',additionalSource:'https://munal.mx/es/tesoros-del-munal',visitUrl:'https://munal.mx/'},
  {id:'mam',name:'Museo de Arte Moderno',city:'Mexico City',country:'Mexico',region:'Americas',artists:['Remedios Varo'],countries:['Mexico'],lenses:[['abstraction',1],['narrative',1],['complexity',1]],focus:'Modern Mexican painting and unexpected pictorial narratives.',fact:'The museum holds a substantial collection of paintings by Remedios Varo.',sourceUrl:'https://inba.gob.mx/prensa/23052/destacan-la-relevancia-de-la-coleccion-de-remedios-varo-en-el-acervo-del-inbal-',visitUrl:'https://mam.inba.gob.mx/'},
  {id:'bellas-artes',name:'Museo del Palacio de Bellas Artes',city:'Mexico City',country:'Mexico',region:'Americas',artists:['Diego Rivera','José Clemente Orozco','David Alfaro Siqueiros','Rufino Tamayo'],countries:['Mexico'],lenses:[['narrative',1],['energy',1],['humanity',1]],focus:'Murals, public narratives and large-scale compositions.',fact:'Its permanent mural collection includes work by Rivera, Orozco, Siqueiros, Tamayo and other muralists.',sourceUrl:'https://inba.gob.mx/prensa/22046/el-museo-del-palacio-de-bellas-artes-ofrece-la-serie-recorrido-virtual-coleccion-permanente',visitUrl:'https://museopalaciodebellasartes.inba.gob.mx/'},
  {id:'kunstmuseum',name:'Kunstmuseum Den Haag',city:'The Hague',country:'Netherlands',region:'Europe',artists:['Piet Mondrian','Theo van Doesburg'],countries:[],lenses:[['abstraction',1],['complexity',-1],['color',1]],focus:'Abstraction, De Stijl and relationships between painting and design.',fact:'Its collection includes Mondrian and other De Stijl artists, with works tracing the move from figuration toward abstraction.',sourceUrl:'https://www.kunstmuseum.nl/en/collections/de-stijl',additionalSource:'https://www.kunstmuseum.nl/en/mondrian',visitUrl:'https://www.kunstmuseum.nl/en'},
  {id:'national-gallery',name:'The National Gallery',city:'London',country:'United Kingdom',region:'Europe',artists:['Claude Monet'],countries:[],lenses:[['atmosphere',1],['energy',-1],['color',1]],focus:'Light, landscape and sustained looking at European painting.',fact:'Its Monet holdings include The Water-Lily Pond and other paintings of his water garden.',sourceUrl:'https://www.nationalgallery.org.uk/paintings/claude-monet-the-water-lily-pond',visitUrl:'https://www.nationalgallery.org.uk/'},
  {id:'tokyo-national',name:'Tokyo National Museum',city:'Tokyo',country:'Japan',region:'Asia',artists:[],countries:['Japan'],lenses:[['atmosphere',1],['energy',-1],['color',-1]],focus:'Japanese painting, ink, screens and the relationship between a work and a room.',fact:'The Japanese Gallery presents painting, calligraphy and painted screens, among other forms.',sourceUrl:'https://www.tnm.jp/modules/r_exhibition/index.php?controller=hall&hid=12&lang=en',additionalSource:'https://www.tnm.jp/modules/r_free_page/?id=95&lang=en',visitUrl:'https://www.tnm.jp/?lang=en'},
  {id:'pinacoteca',name:'Pinacoteca de São Paulo',city:'São Paulo',country:'Brazil',region:'Americas',artists:['Almeida Júnior'],countries:['Brazil'],lenses:[['humanity',1],['narrative',1],['energy',-1]],focus:'Brazilian painting, everyday subjects and intimate figure studies.',fact:'The collection includes Almeida Júnior, including Saudade and Leitura.',sourceUrl:'https://pinacoteca.org.br/programacao/exposicoes/caipiras-das-derrubadas-a-saudade/',additionalSource:'https://acervo.pinacoteca.org.br/online/ficha.aspx?IPR=5220&id=11940&lang=BR&ns=201000',visitUrl:'https://pinacoteca.org.br/'},
  {id:'mnav',name:'Museo Nacional de Artes Visuales',city:'Montevideo',country:'Uruguay',region:'Americas',artists:['Pedro Figari'],countries:['Uruguay'],lenses:[['narrative',1],['humanity',1],['color',1]],focus:'Uruguayan painting, movement and social scenes.',fact:'The national collection includes Pedro Figari and other Uruguayan artists.',sourceUrl:'https://mnav.gub.uy/cms.php?id=coleccion2019',visitUrl:'https://mnav.gub.uy/'},
  {id:'cleveland',name:'Cleveland Museum of Art',city:'Cleveland',country:'United States',region:'Americas',artists:[],countries:['Ethiopia','India','Korea','China','Nepal','Japan'],lenses:[['complexity',1],['narrative',1],['atmosphere',1]],focus:'Comparing painting traditions across regions and periods.',fact:'Its collection includes the Ethiopian diptych and paintings from India, Korea, China and Nepal used in this prototype.',sourceUrl:'https://clevelandart.org/art/2023.4',additionalSource:'https://clevelandart.org/art/1960.211',visitUrl:'https://www.clevelandart.org/'}
].map(m=>({...m,checkedAt:'2026-11-13'}));
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const title=w=>w.shortTitle||w.title;
function choiceSentence(signal,includeArtist=false) {
  const named=title(signal.work)+(includeArtist?' by '+signal.work.artist:'');
  if(signal.label.startsWith('ranked higher for '))return 'You ranked '+named+' higher for '+signal.label.slice('ranked higher for '.length);
  if(signal.label.startsWith('kept for '))return 'You kept '+named+' for '+signal.label.slice('kept for '.length);
  if(signal.label.startsWith('placed in '))return 'You placed '+named+' in '+signal.label.slice('placed in '.length);
  return 'You hung '+named+' in your exhibition';
}
const descriptions={atmosphere:['less focused on setting','focused on setting and atmosphere'],narrative:['less focused on depicted events','focused on depicted events'],humanity:['less focused on human figures','focused on human figures'],abstraction:['representational','abstract'],complexity:['sparsely composed','densely composed'],color:['restrained in colour','colour-intense'],energy:['visually quiet','visually active']};
export function museumMatches(works,records,answers={},saved={},options={}) {
  const purpose=options.purpose==='study'?'study':'look',region=options.region||'any',signals=new Map();
  const add=(id,weight,label)=> {if(!works.some(w=>w.id===id))return;const old=signals.get(id);if(!old || old.weight<weight)signals.set(id,{id,weight,label});};
  const r=buildRounds(works,answers).find(r=>r.id===(purpose==='study'?'interestRank':'preferenceRank')),a=answers[r.id];
  if(validAnswer(r,a)) for(const [id,value] of Object.entries(a.positions)) if(value>=65)add(id,.8+value/100,purpose==='study'?'ranked higher for curiosity':'ranked higher for preference');
  for(const [id,value] of Object.entries(saved)) if(value?.[purpose==='study'?'study':'look'])add(id,1.5,purpose==='study'?'kept for study':'kept for looking');
  const latest=[...records].reverse().find(r=>r.kind==='curate'&&validScenario(r,works));
  if(latest && hasRoomBriefs(latest)) {
    for(const room of purpose==='study'?['study']:['opening','return']) for(const id of roomWorkIds(latest,room))add(id,1.4,room==='study'?'placed in your closer-look room':room==='return'?'placed in your return-visit room':'placed in your first-encounter room');
  } else if(latest && purpose==='look') for(const id of selectedIds(latest))add(id,1.4,'hung in your exhibition');
  const source=[...signals.values()].map(s=>({...s,work:works.find(w=>w.id===s.id)}));
  const museums=MUSEUMS.filter(m=>region==='any'||region==='Mexico'&&m.country==='Mexico'||m.region===region);
  const items=museums.map(m=> {
    const scored=source.map(s=> {
      const artist=m.artists.some(name=>normalize(name)===normalize(s.work.artist));
      const country=m.countries.includes(s.work.country);
      const lens=m.lenses.reduce((sum,[key,dir])=>sum+(dir>0?feature(s.work,key):1-feature(s.work,key)),0)/m.lenses.length;
      return {...s,artist,country,lens,score:s.weight*(lens+(artist?1.5:0)+(country ? .3 : 0))};
    }).sort((a,b)=>b.score-a.score);
    const best=scored[0],direct=scored.find(s=>s.artist),representative=direct||best;
    const key=best && [...m.lenses].sort((a,b)=> (b[1]>0?feature(best.work,b[0]):1-feature(best.work,b[0]))-(a[1]>0?feature(best.work,a[0]):1-feature(best.work,a[0])))[0];
    let reason=m.focus;
    if(direct) reason=`${choiceSentence(direct,true)}. This museum's collection includes work by that artist.`;
    else if(best) {
      const strength=key[1]>0?feature(best.work,key[0]):1-feature(best.work,key[0]);
      reason=strength>=.65?`${choiceSentence(best)}. The work is annotated as ${descriptions[key[0]][key[1]>0?1:0]}. ${m.focus} This is a connection to explore, based on broad artwork annotations.`:`${m.focus} The current choices do not give a strong specific connection here; this remains an exploration option.`;
    }
    const score=scored.length ? scored.reduce((sum,s)=>sum+s.score,0)/scored.length+(direct ? .8 : 0) : 0;
    return {...m,score,reason,evidence:representative?[representative.id]:[],basis:direct?'Artist in the collection':best?'Collection theme':'Explore the collection'};
  }).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name));
  return {items,personalized:source.length>0,purpose,signalCount:source.length,method:'Collection facts come from the linked institutions. Suggestions use a small editorial set of museums and broad artwork annotations, not a validated travel or personality model. Artist connections do not mean the exact selected work is held there. Check the museum’s own site for current displays and visiting details.'};
}
