import REVIEWS from './artwork-attribute-reviews.json' with {type:'json'};
import {resolveArtworkAttributes} from './artwork-quality-review.mjs';
import {isReviewedVisualDescriptor} from './visual-descriptor-semantics.mjs';

const themes=[
  {keys:['narrative-detail','imagined-world'],title:'Story clues and imagined worlds',description:'Compare secondary story clues with fantastical bodies and settings. They can appear together or separately.'},
  {keys:['dramatic-light','visible-gesture'],title:'Light and bodily action',description:'Compare selective light and shadow with the gestures of figures. Notice which carries the scene.'},
  {keys:['geometric-structure','visible-paint-marks'],title:'Structure and the painted surface',description:'Look between geometric divisions and visible marks. A structured composition can still have an active surface.'},
  {keys:['expressive-distortion','precise-rendering'],title:'Altered forms and precise detail',description:'Compare recognisable detail with stretched or altered forms. Precision and distortion can coexist.'},
  {keys:['layered-space','material-detail'],title:'Rooms, distance and material detail',description:'Compare the organisation of depicted space with the treatment of tangible objects and surfaces.'},
  {keys:['human-relationships','theatrical-staging'],title:'Human company and staged encounters',description:'Compare visible exchanges between people with the way a scene is staged. Several figures alone do not establish a relationship.'}
];
const axes=[
  ['abstraction','Recognisable forms and abstraction','Compare how far each image retains recognisable objects and how far it works through abstract forms.'],
  ['complexity','Sparse and dense compositions','Compare the amount of visual information and the space around it. Density can come from objects, figures or marks.'],
  ['energy','Quiet and active compositions','Follow the lines, shapes and marks that make an image visually active or restrained.'],
  ['humanity','Figures and their surroundings','Compare the prominence of people with the space, objects or forms around them.'],
  ['color','Restrained and intense colour','Compare the intensity of colour across different subjects and treatments.']
];

/** Browsing arrangements only: never proposed quiz rounds or preference evidence.
 * Every reserved work appears once. Unknown reviews never become absent cells. */
export function groupReservedPaintings(works,{block=2}={}){
  const remaining=new Map(works.map(work=>[work.id,work])),reviews=new Map(works.map(work=>[work.id,resolveArtworkAttributes(work,{annotationReviews:REVIEWS})?.attributes])),uses=new Map(),groups=[];
  while(remaining.size){
    const size=remaining.size===5?3:Math.min(4,remaining.size),available=[...remaining.values()];let best=null;
    for(const theme of themes){
      const buckets=new Map();
      for(const work of available){const values=theme.keys.map(key=>reviews.get(work.id)?.[key]?.status);if(values.some(value=>!['present','absent'].includes(value)))continue;const key=values.join('|');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(work);}
      if(buckets.size<3||size<3)continue;
      const chosen=[];
      for(const bucket of buckets.values()){
        const work=bucket.find(work=>!chosen.some(other=>other.artist===work.artist))||bucket[0];chosen.push(work);if(chosen.length===size)break;
      }
      for(const work of available)if(chosen.length<size&&!chosen.includes(work)&&theme.keys.every(key=>['present','absent'].includes(reviews.get(work.id)?.[key]?.status)))chosen.push(work);
      if(chosen.length!==size)continue;
      const score=buckets.size*10+new Set(chosen.map(work=>work.artist)).size-(uses.get(theme.title)||0)*5;
      if(!best||score>best.score)best={...theme,chosen,score};
    }
    if(!best){
      for(const [key,title,description]of axes){
        const known=available.filter(work=>isReviewedVisualDescriptor(work,key)).sort((a,b)=>a.features[key]-b.features[key]||a.id.localeCompare(b.id));
        if(known.length<size||size<2)continue;
        const spread=known.at(-1).features[key]-known[0].features[key];if(spread<.35)continue;
        const chosen=Array.from({length:size},(_,i)=>known[Math.round(i*(known.length-1)/(size-1))]),score=spread*10-(uses.get(title)||0)*2;
        if(!best||score>best.score)best={title,description,chosen,score};
      }
    }
    best||={title:'A closer look at different treatments',description:'Look at how each painting handles its subject, space and surface. Which differences matter to you?',chosen:available.slice(0,size)};
    uses.set(best.title,(uses.get(best.title)||0)+1);
    const number=groups.length+1;
    groups.push({id:'browse:block'+block+':'+number,kind:'gallery-comparison',number,label:'Set '+String(number).padStart(2,'0'),title:best.title,description:best.description,scope:'Gallery arrangement; actual quiz comparisons adapt to earlier answers.',works:best.chosen});
    for(const work of best.chosen)remaining.delete(work.id);
  }
  return groups;
}
