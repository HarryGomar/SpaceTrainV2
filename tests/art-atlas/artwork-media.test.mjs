import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {resolveArtworkMedia} from '../../public/art-atlas/artwork-media.mjs';
import {imageDimensions} from '../../scripts/art-atlas/import-study-media.mjs';

const site=new URL('../../public/art-atlas/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('study-image-sources.json',site),'utf8'));
const works=JSON.parse(fs.readFileSync(new URL('artworks.json',site),'utf8'));
const byId=new Map(works.map(work=>[work.id,work]));

test('The original99 media audit accounts for every source without rewriting small assets',()=>{
  assert.equal(manifest.originalCatalogueSize,99);assert.equal(Object.keys(manifest.entries).length,97);assert.equal(manifest.summary.largeImages,97);
  const accounted=[...Object.keys(manifest.entries),...manifest.failures.map(row=>row.workId)];
  assert.equal(accounted.length,99);assert.equal(new Set(accounted).size,99);
  for(const entry of Object.values(manifest.entries)){
    const work=byId.get(entry.workId);assert.ok(work,entry.workId);assert.deepEqual(entry.sourceIdentity,{sourceUrl:work.sourceUrl,image:work.image,imageSourceUrl:work.imageSourceUrl||null});
    const small=fs.readFileSync(new URL(work.image,site));assert.equal(crypto.createHash('sha256').update(small).digest('hex'),entry.smallImageSha256);assert.equal(small.length,entry.smallImageBytes);
    assert.ok(['CC0','Public domain'].includes(entry.rights));assert.ok(entry.rightsUrl.startsWith('https://'));assert.ok(entry.provenance.metadataUrl.startsWith('https://'));assert.ok(entry.provenance.downloadUrl.startsWith('https://'));
  }
});

test('Every hosted large file is real decodable image data with matching dimensions, bytes and hash',()=>{
  let bytesTotal=0;const hashes=new Set();
  for(const entry of Object.values(manifest.entries)){
    const bytes=fs.readFileSync(new URL(entry.imageLarge,site)),dimensions=imageDimensions(bytes);
    assert.equal(dimensions.width,entry.largeWidth,entry.workId);assert.equal(dimensions.height,entry.largeHeight,entry.workId);assert.equal(dimensions.mime,'image/jpeg');
    assert.equal(bytes.length,entry.provenance.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.provenance.sha256);
    assert.equal(bytes.readUInt16BE(bytes.length-2),0xffd9,'A hosted JPEG must end with its complete-image marker.');hashes.add(entry.provenance.sha256);
    assert.ok(Math.max(entry.largeWidth,entry.largeHeight)<=3200);assert.ok(entry.largeWidth<=entry.provenance.downloadedWidth&&entry.largeHeight<=entry.provenance.downloadedHeight);
    assert.ok(entry.largeWidth*entry.largeHeight>entry.smallWidth*entry.smallHeight,entry.workId);assert.match(entry.provenance.transformation,/quality90/);assert.match(entry.provenance.transformation,/no upscaling/);bytesTotal+=bytes.length;
  }
  assert.equal(hashes.size,97);assert.equal(bytesTotal,manifest.summary.totalBytes);assert.ok(bytesTotal<100000000,'The original99 hosted derivatives stay within the requested60–100MB budget.');
});

test('Twilight details use the verified large reproduction while maps retain the small image by default',()=>{
  const work=byId.get('opening-cma-141639'),entry=manifest.entries[work.id],small=resolveArtworkMedia(work),detail=resolveArtworkMedia(work,{preferLarge:true});
  assert.equal(small.src,work.image);assert.equal(small.width,480);assert.equal(small.height,300);assert.equal(small.srcSet,undefined);
  assert.equal(detail.src,entry.imageLarge);assert.equal(detail.width,entry.largeWidth);assert.equal(detail.height,entry.largeHeight);assert.ok(detail.width>=2000);assert.equal(detail.matchedLargeSource,true);assert.equal(detail.mediaBinding,'source-matched-study-map');
  const responsive=resolveArtworkMedia(work,{responsive:true});assert.equal(responsive.src,work.image);assert.equal(responsive.srcSet,work.image+' 480w, '+entry.imageLarge+' '+entry.largeWidth+'w');
});

test('A current-ID match cannot upgrade a frozen record with a different source or reproduction',()=>{
  const work=byId.get('opening-cma-141639');
  for(const changed of [{...work,sourceUrl:'https://museum.example/another-work'},{...work,image:'assets/frozen-other.jpg'},{...work,imageSourceUrl:'https://museum.example/another-image.jpg'}]){
    const result=resolveArtworkMedia(changed,{preferLarge:true,responsive:true});assert.equal(result.src,changed.image);assert.equal(result.matchedLargeSource,false);assert.equal(result.srcSet,undefined);assert.equal(result.sourceLimited,true);assert.equal(result.nativeWidth,changed.width);
  }
});

test('New verified records can carry an explicit local large image without joining the original99 mapping',()=>{
  const work={id:'new-record',image:'assets/new-small.jpg',width:600,height:450,imageLarge:'assets/new-large.jpg',largeWidth:2400,largeHeight:1800},detail=resolveArtworkMedia(work,{preferLarge:true,responsive:true});
  assert.equal(detail.src,work.imageLarge);assert.equal(detail.mediaBinding,'explicit-record');assert.equal(detail.nativeWidth,2400);assert.equal(detail.sourceLimited,false);assert.equal(detail.srcSet,'assets/new-small.jpg 600w, assets/new-large.jpg 2400w');
  detail.src='mutation';assert.equal(resolveArtworkMedia(work,{preferLarge:true}).src,work.imageLarge);
});

test('Invalid explicit paths/dimensions retain the local small image and native-size cap',()=>{
  for(const large of [{imageLarge:'https://external.example/image.jpg',largeWidth:2400,largeHeight:1800},{imageLarge:'assets/../private.jpg',largeWidth:2400,largeHeight:1800},{imageLarge:'assets/good.jpg',largeWidth:-1,largeHeight:1800},{imageLarge:'assets/good.jpg',largeWidth:2400.5,largeHeight:1800}]){
    const work={id:'source-limited',image:'assets/small.jpg',width:956,height:640,...large},result=resolveArtworkMedia(work,{preferLarge:true,responsive:true});assert.equal(result.src,work.image);assert.equal(result.nativeWidth,956);assert.equal(result.nativeHeight,640);assert.equal(result.sourceLimited,true);assert.equal(result.srcSet,undefined);
  }
  assert.equal(resolveArtworkMedia(null).src,'');
});
