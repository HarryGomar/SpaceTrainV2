// Editorial selection roles, not measured public familiarity or artistic value.
const landmarkIds=new Set(['monet-water-lilies','mondrian-composition','hokusai-mount-fuji','hiroshige-sudden-shower','cezanne-mountain','van-gogh-starry-night','klimt-kiss','bosch-garden-delights','velazquez-las-meninas','holbein-ambassadors','millais-ophelia','goya-saturn','friedrich-wanderer','matejko-stanczyk','turner-burning-parliament']);
const discoveryIds=new Set(['ethiopian-apostles','bengal-todi-ragini','chitarman-tiered-court','joseon-seven-jeweled-mountain','hua-yan-children-garden','nepal-chakrasamvara-mandala','collection-egypt-man-portrait','collection-egypt-young-girl']);
export function recognitionTier(work){return ['landmark','established','discovery'].includes(work?.recognitionTier)?work.recognitionTier:landmarkIds.has(work?.id)?'landmark':discoveryIds.has(work?.id)||work?.artistKnown===false?'discovery':'established';}
export function recognitionWeight(work){return {landmark:2,established:.5,discovery:0}[recognitionTier(work)];}
export function preferredTier(slot,mode='main',panel=1){if(mode==='grid')return slot<9?'landmark':'established';if(mode==='match')return slot<3?'landmark':'established';return slot<2?'landmark':slot===2?'established':panel%3===0?'discovery':'landmark';}
export function museumLibraryOrder(works){
  const opening=['van-gogh-starry-night','study-leonardo-mona-lisa','study-hokusai-great-wave','klimt-kiss','study-vermeer-pearl','study-munch-scream','velasco-valley-mexico','study-posada-catrina','study-van-gogh-sunflowers','millais-ophelia','velazquez-las-meninas','study-wood-american-gothic'];
  const priority=work=>{const index=opening.indexOf(work.id);return index<0?100-recognitionWeight(work):index;};
  return [...works].sort((a,b)=>priority(a)-priority(b));
}
