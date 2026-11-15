import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url)),app=path.join(root,'public/art-atlas');
const read=name=>JSON.parse(fs.readFileSync(path.join(app,name),'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(app,name),JSON.stringify(value,null,2)+'\n');
const base=read('artworks.json').filter(work=>!work.id.startsWith('add-')),added=read('collection-additions-20261115.json').map(work=>({...work,coreQuiz:false,studyEligible:true,featureSemanticVersion:'literal-action-setting-v1'}));
if(base.length!==99||added.length!==57)throw Error('This reviewed import requires the original99 and final57 records.');
const reviewPath=path.join(app,'descriptor-review-20261115.json'),review=fs.existsSync(reviewPath)?JSON.parse(fs.readFileSync(reviewPath)):null;
if(review)for(const work of base){const row=review.entries[work.id];if(!row)throw Error('Missing reviewed descriptor '+work.id);work.features={...work.features,narrative:row.narrative,atmosphere:row.atmosphere};work.featureAnnotationVersion=review.revision;work.descriptorReview={revision:review.revision,sourceImage:row.image,reason:row.reason,previousValues:row.oldValues};}
if(review)for(const work of base)work.featureSemanticVersion='literal-action-setting-v1';
const works=[...base,...added],byId=new Map(works.map(work=>[work.id,work]));
if(byId.size!==works.length)throw Error('Duplicate artwork ID');
const features=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
for(const work of works)if(features.some(key=>!Number.isFinite(work.features?.[key])||work.features[key]<0||work.features[key]>1))throw Error('Unreviewed feature '+work.id);

// Each quartet has a stated comparison purpose. It does not isolate a cause.
const definitions=[
  ['Four landmarks',null,['van-gogh-starry-night','study-leonardo-mona-lisa','study-hokusai-great-wave','klimt-kiss'],'Establish an initial preference order across recognisable works from different traditions.'],
  ['Portraits & presence',null,['study-vermeer-pearl','study-vermeer-milkmaid','egypt-man-portrait','add-rivera-portrait-frida'],'Compare posed faces, a working figure and a funerary portrait without translating figure prominence into a head count.'],
  ['Care & closeness','abstraction',['study-cassatt-child-bath','study-morisot-cradle','cassatt-omnibus','onchi-mother-child'],'Compare related adult-and-child subjects across a woodcut, a print and paintings.'],
  ['Colour & objects','color',['study-van-gogh-sunflowers','opening-cma-141639','blanchard-still-life','add-tamayo-still-life-foot'],'Check whether intense colour wins across flowers, a sunset, fragmented objects and Tamayo’s still life.'],
  ['Landscape & movement','energy',['hokusai-mount-fuji','hiroshige-sudden-shower','japanese-waves','farmer-autumn'],'Compare visual movement within Japanese landscape and wave imagery rather than using region as the only distinction.'],
  ['Stillness & action','narrative',['monet-water-lilies','opening-cma-92937','rousseau-tiger-buffalo','almeida-junior-saudade'],'Place explicit conflict beside quiet water and a still figure. Compare action separately from human presence.'],
  ['Groups of figures','complexity',['study-seurat-grande-jatte','study-raphael-school-athens','chitarman-tiered-court','add-orozco-buffoons'],'Compare ordered public gatherings with Orozco’s compact ink figures, retaining differences of medium and purpose.'],
  ['Symbols & imagined scenes',null,['study-munch-scream','study-rousseau-sleeping-gypsy','add-watts-hope','add-varo-harmony'],'Record preferences before revealing Hope’s remaining string or Varo’s account of the musical stave.'],
  ['Interiors & objects',null,['velazquez-las-meninas','holbein-ambassadors','add-carrington-dagobert','opening-cma-169545'],'Compare a court interior, a symbolic portrait, Carrington’s invented interior and a Korean screen of objects.'],
  ['Planes & fields','color',['study-malevich-black-square','add-rothko-orange-yellow','add-newman-prometheus-bound','add-herrera-cobalt-white'],'Compare restrained and saturated fields within sparse abstraction, rather than making abstraction synonymous with crowded marks.'],
  ['Mountain landscapes','humanity',['cezanne-mountain','friedrich-wanderer','velasco-valley-mexico','shen-clouds'],'Compare four mountain settings with different degrees of figure prominence, pictorial treatment and scale.'],
  ['Geometry & gesture','complexity',['mondrian-composition','study-kandinsky-composition-eight','add-gerzso-water-mansion','add-pollock-convergence'],'Compare sparse geometry, layered planes and dense gestural marks within abstraction.'],
  ['Dense compositions','abstraction',['bosch-garden-delights','study-bruegel-hunters-snow','nepal-chakrasamvara-mandala','add-kandinsky-composition-seven'],'Compare dense images with and without a recognisable world, while keeping religious, narrative and palette differences visible.'],
  ['Devotional & symbolic images','color',['study-posada-catrina','goya-saturn','ethiopian-apostles','green-tara'],'Compare monochrome and coloured symbolic images across different uses and traditions. Their meanings are not assumed from preference.'],
  ['Movement & structure','energy',['turner-burning-parliament','study-delacroix-liberty','bonheur-horses','add-merida-time-space'],'Compare compositional activity in depicted events and Mérida’s geometric arrangement, keeping physical action separate.'],
  ['Colour & drama','color',['millais-ophelia','study-gericault-raft','van-gogh-night-cafe','add-kahlo-borderline'],'Compare different colour treatments in scenes with people. Felt tension is asked separately.'],
  ['Private & public figures',null,['study-matisse-dance','figari-candombe-moon','study-tanner-banjo-lesson','add-izquierdo-sorrowful-friday'],'Compare collective movement, a private lesson and a devotional arrangement without treating a choice as a social trait.'],
  ['Spaces & shapes','abstraction',['add-dali-transparent-simulacrum','study-guo-xi-early-spring','add-miro-harlequin-carnival','add-rivera-zapatista-landscape'],'Compare a mountain landscape and an empty dreamlike interior with invented spaces in Cubism and Surrealism.']
];
const firstIds=definitions.flatMap(row=>row[2]);
if(new Set(firstIds).size!==72||firstIds.some(id=>!byId.has(id)))throw Error('The first72 need distinct available identities: '+firstIds.filter(id=>!byId.has(id)).join(','));
const notes=read('curation-notes.json'),previousAnnotations=new Map(notes.annotations.map(row=>[row.workId,row]));
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const era=range=>!Array.isArray(range)?null:(range[0]+range[1])/2<1300?'before1300':(range[0]+range[1])/2<1600?'1300-1599':(range[0]+range[1])/2<1800?'1600-1799':(range[0]+range[1])/2<1850?'1800-1849':(range[0]+range[1])/2<1900?'1850-1899':(range[0]+range[1])/2<=1955?'1900-1955':'after1955';
const region=work=>previousAnnotations.get(work.id)?.regionKey||(/mexico|brazil|uruguay|guatemala/.test(normalize(work.country))?'latin-america':/united states/.test(normalize(work.country))?'north-america':/china|japan|korea/.test(normalize(work.country))?'east-asia':/india|nepal|tibet/.test(normalize(work.country))?'south-asia-and-himalayas':/egypt|ethiopia/.test(normalize(work.country))?'africa':work.country?'europe':null);
const remaining=works.filter(work=>!firstIds.includes(work.id)),target=Math.min(44,Math.ceil(remaining.length/2)),selected=[],counts=new Map();
const categories=work=>[region(work),work.country,work.analysis?.movementKey,era(work.analysis?.yearRange),work.artist,...features.map(key=>key+':'+(work.features[key]<=.25?'low':work.features[key]>=.75?'high':'middle'))].filter(Boolean);
const score=work=>categories(work).reduce((total,key)=>total+1/(1+(counts.get(key)||0)),0);
while(selected.length<target&&remaining.length){remaining.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));const work=remaining.shift();selected.push(work);for(const key of categories(work))counts.set(key,(counts.get(key)||0)+1);}
const batch2=selected.map(work=>work.id),batch3=remaining.slice(0,44).map(work=>work.id),batch4=remaining.slice(44).map(work=>work.id);
const panelFor=id=>definitions.findIndex(row=>row[2].includes(id))+1;
notes.annotations=works.map(work=>{
  const previous=previousAnnotations.get(work.id),panel=panelFor(work.id),reserve=panel?0:batch2.includes(work.id)?1:batch3.includes(work.id)?2:3;
  return {...(previous||{}),workId:work.id,importanceTier:previous?.importanceTier||(work.recognitionTier==='landmark'?'canonical-anchor':'tradition-anchor'),recognitionTier:work.recognitionTier||'established',recognitionTierSource:work.recognitionTierSource||'Editorial curation, not population recognition.',regionKey:region(work),regionSource:previous?.regionSource||work.countrySource,eraKey:era(work.analysis?.yearRange),yearRange:work.analysis?.yearRange||null,countryAsStored:work.country||null,traditionKey:work.analysis?.movementKey||normalize(work.movement),traditionAsStored:work.movement,subjectFamily:previous?.subjectFamily||null,sourceUrls:[work.sourceUrl],featuresKnown:true,featureBasis:work.featureSource||'Provisional editorial descriptions.',reserveUntilBatch:reserve,reserveScope:'First ordinary preference ratings only. Other tasks can show the same images earlier.',firstPanel:panel||null,roleNotes:panel?definitions[panel-1][3]:'Additional work for a later comparison; it is not assumed to be unfamiliar.',stimulusRoles:panel?['initial-comparison','cross-task-follow-up']:['later-first-rating','same-artist-or-movement-check']};
});
notes.schemaVersion=2;notes.catalogueSize=works.length;notes.panelSizes=Array(18).fill(4);notes.maximumLandmarksPerPanel=3;notes.annotationStatus='Provisional editorial descriptors. The first99 action and setting scores have a separate literal-descriptor review; saved studies retain their captured metadata.';
notes.sourceBasis=[
  'artworks.json contains 156 study works, including 57 source-checked additions recorded in collection-additions-20261115.json.',
  'opening-artworks.json contains 255 separate decorative works. The opening uses 411 distinct works across both catalogues.',
  'The original 99 study reproductions have a literal-action/setting review in descriptor-review-20261115.json. The additions have image-checked editorial descriptions and source records.',
  'Object source URLs, image credits, actual source dimensions and rights statements remain in the source manifests. These records do not establish reproduction permission.'
];
notes.proposedFirst18Panels=definitions.map(([galleryTitle,targetFeature,workIds,primaryQuestion],index)=>({panel:index+1,workIds,galleryTitle,targetFeature,contrastPairs:[[workIds[0],workIds[1]],[workIds[2],workIds[3]]],primaryQuestion,questionUse:'Ordinary preference first. Later tasks ask separate judgments about the same images.',sharedGround:galleryTitle,confounds:['Artist, date, medium, colour, familiarity and personal associations can vary together. These are comparative stimuli, not a causal control.'],status:'reviewed-editorial-comparison',sourceUrls:workIds.map(id=>byId.get(id).sourceUrl)}));
notes.reservePools={batch2,batch3,...(batch4.length?{batch4}:{})};
notes.reservationConvention='These pools delay first ordinary preference ratings. They do not assert that an image or label has never been shown elsewhere.';
const tails=pool=>Object.fromEntries(features.map(key=>[key,{low:pool.filter(work=>work.features[key]<=.25).length,middle:pool.filter(work=>work.features[key]>.25&&work.features[key]<.75).length,high:pool.filter(work=>work.features[key]>=.75).length}]));
const quadrant=pool=>({sparseRepresentational:pool.filter(work=>work.features.abstraction<=.25&&work.features.complexity<=.25).length,denseRepresentational:pool.filter(work=>work.features.abstraction<=.25&&work.features.complexity>=.75).length,sparseAbstract:pool.filter(work=>work.features.abstraction>=.75&&work.features.complexity<=.25).length,denseAbstract:pool.filter(work=>work.features.abstraction>=.75&&work.features.complexity>=.75).length});
const coverage={revision:'collection-coverage-20261115-v1',catalogueSize:works.length,addedCount:added.length,firstComparisonWorks:72,reservedFirstRatings:{batch2:batch2.length,batch3:batch3.length,batch4:batch4.length},descriptorRevision:review?.revision||'review-pending',marginalTails:tails(works),first50MarginalTails:tails(firstIds.map(id=>byId.get(id))),abstractionDensityCross:quadrant(works),mexicanPractice:works.filter(work=>work.country==='Mexico').length,movements:[...new Set(works.map(work=>work.movement))].sort(),scope:'Thresholds describe this provisional annotated catalogue, not a population or equal-sized aesthetic categories.'};
notes.coverage=coverage;
const names=new Map();for(const work of works){const key=normalize(work.artist)+'|'+normalize(work.title),group=names.get(key)||[];group.push(work);names.set(key,group);}for(const group of names.values())if(group.length>1)for(const work of group)work.shortTitle=work.title+' ('+work.date+')';
write('artworks.json',works);write('curation-notes.json',notes);write('collection-coverage-20261115.json',coverage);
console.log(JSON.stringify({catalogue:works.length,first:72,batch2:batch2.length,batch3:batch3.length,batch4:batch4.length,descriptorRevision:coverage.descriptorRevision,tails:coverage.marginalTails,cross:coverage.abstractionDensityCross},null,2));
