import fs from 'node:fs/promises';
const titles=['File:Wassily Kandinsky Composition VIII.jpg','File:Henry Ossawa Tanner, The Banjo Lesson (lighter).jpg','File:Henry Ossawa Tanner, The Banjo Lesson (darker).jpg','File:Henri Matisse - Dance II (Hermitage Museum).jpg','File:Henri Matisse - Dance 1910.jpg','File:La Calavera Catrina J Guadalupe Posada.jpg','File:Le Radeau de la Méduse.jpg','File:Théodore Géricault - The Raft of the Medusa - WGA08630.jpg','File:The Raft of the Medusa - Louvre.jpg'];
const url=new URL('https://commons.wikimedia.org/w/api.php');
Object.entries({action:'query',format:'json',prop:'imageinfo',iiprop:'url|size|extmetadata',titles:titles.join('|'),redirects:'1'}).forEach(([key,value])=>url.searchParams.set(key,value));
const response=await fetch(url,{headers:{'User-Agent':'ArtAtlas/1.0 (public-domain artwork media verification)'}}),data=await response.json();
await fs.writeFile('qa-output/study-media/alternate-file-review.json',JSON.stringify(data,null,2));
for(const page of Object.values(data.query?.pages||{})){
  const info=page.imageinfo?.[0],ext=info?.extmetadata||{};
  console.log(JSON.stringify({title:page.title,width:info?.width,height:info?.height,url:info?.url,metadataUrl:info?.descriptionurl,artist:ext.Artist?.value,date:ext.DateTimeOriginal?.value,object:ext.ObjectName?.value,credit:ext.Credit?.value,copyrighted:ext.Copyrighted?.value,license:ext.LicenseShortName?.value,licensecode:ext.License?.value},null,2));
}
