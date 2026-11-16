import {resolveArtworkMedia} from './artwork-media.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

/** Presentation assets can improve without changing the saved artwork record. */
export function artworkImageAttributes(work,{large=false,responsive=true,sizes='auto, (max-width: 700px) 85vw, 45vw'}={}){
  const media=resolveArtworkMedia(work,{preferLarge:large,responsive:responsive&&!large});
  const sources=media.srcSet?.split(', ').map(source=>'./'+source).join(', ');
  return `src="./${esc(media.src)}"${sources?` srcset="${esc(sources)}" sizes="${esc(sizes)}"`:''}${media.width&&media.height?` width="${media.width}" height="${media.height}"`:''} loading="${large?'eager':'lazy'}" decoding="async"${large&&media.sourceLimited?` style="max-width:min(100%,${media.nativeWidth}px);max-height:min(var(--artwork-max-height,100dvh),${media.nativeHeight}px)"`:''}`;
}

export function setArtworkImage(element,work){
  const media=resolveArtworkMedia(work,{preferLarge:true});
  element.removeAttribute('srcset');element.removeAttribute('sizes');
  element.src='./'+media.src;element.alt=work.alt||work.title;
  if(media.width&&media.height){element.width=media.width;element.height=media.height;}
  element.style.maxWidth=media.sourceLimited?`min(100%,${media.nativeWidth}px)`:'';
  element.style.maxHeight=media.sourceLimited?`min(var(--artwork-max-height,100dvh),${media.nativeHeight}px)`:'';
  element.decoding='async';
  return media;
}
