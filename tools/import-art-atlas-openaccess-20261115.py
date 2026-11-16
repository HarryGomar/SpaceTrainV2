"""Stage sourced open-access paintings without changing the study catalogue.

Run with py -3.12. All files remain in this repository. Visual scores are supplied
in a separate, manually reviewed ledger, never guessed from artist or movement.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import requests, json, re, hashlib, io, time, math, colorsys, argparse, unicodedata, csv
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'public/art-atlas'
AUDIT=ROOT/'artifacts/art-atlas/collection-extended-20261115'
OUT=SITE/'assets/collection-extended-20261115'
HEAD={'User-Agent':'ArtAtlasCollectionResearch/1.0 (source-bound open-access painting review)'}
CMA='https://openaccess-api.clevelandart.org/api/artworks/'
FIELDS='id,title,accession_number,creation_date,creation_date_earliest,creation_date_latest,culture,technique,department,creators,images,url,share_license_status,creditline,is_highlight,description'
FEATURES=['abstraction','energy','complexity','humanity','narrative','atmosphere','color']

def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def load(path,default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default

def fetch(url):
    for attempt in range(3):
        r=requests.get(url,headers=HEAD,timeout=50)
        if r.status_code==200:return r
        if r.status_code not in [429,500,502,503,504]:r.raise_for_status()
        time.sleep(2+attempt*2)
    r.raise_for_status()

def normal(text):
    return re.sub('[^a-z0-9]+',' ',unicodedata.normalize('NFKD',str(text or '')).encode('ascii','ignore').decode().lower()).strip()

def identity(work):
    return normal(work.get('title'))+'|'+normal(work.get('artist'))

def source_key(url):
    return re.sub(r'^https?://(?:www\.)?','',str(url or '')).rstrip('/')

def creators(row):
    parts=[]
    for creator in row.get('creators') or []:
        text=(creator.get('description') or '').split(' (')[0].strip()
        qualifier=creator.get('qualifier')
        if qualifier and not text.lower().startswith(qualifier.lower()):text=qualifier+' '+text
        if text:parts.append(text)
    return '; '.join(parts) or 'Unidentified artist'

def prepare():
    cache=AUDIT/'cma-painting-records.json'
    rows=load(cache)
    if rows is None:
        rows=[]
        for skip in range(0,5000,1000):
            payload=fetch(CMA+'?type=Painting&cc0&has_image=1&limit=1000&skip='+str(skip)+'&fields='+FIELDS).json()
            rows.extend(payload.get('data',[]))
            if len(rows)>=payload.get('info',{}).get('total',0):break
        write(cache,rows)
    byid={r['id']:r for r in rows}
    study=load(SITE/'artworks.json',[])
    seen_urls={source_key(w.get('sourceUrl')) for w in study}
    seen_titles={identity(w) for w in study}
    seen_ids={w['id'] for w in study}
    candidates=[];excluded=[]
    for opening in load(SITE/'opening-artworks.json',[]):
        row=byid.get(opening.get('sourceId'))
        if not row or row.get('share_license_status')!='CC0' or not row.get('images',{}).get('print',{}).get('url'):
            excluded.append({'id':opening['id'],'reason':'Missing primary CC0 record or print rendition.'});continue
        if opening['id'] in seen_ids or source_key(opening.get('sourceUrl')) in seen_urls or identity(opening) in seen_titles:
            excluded.append({'id':opening['id'],'reason':'Already represented in the study collection.'});continue
        candidate={**opening,'promotion':True,'primaryRecord':row,'largeSourceUrl':row['images']['print']['url']}
        candidates.append(candidate);seen_ids.add(candidate['id']);seen_urls.add(source_key(candidate['sourceUrl']));seen_titles.add(identity(candidate))
    write(AUDIT/'candidate-plan.json',candidates)
    write(AUDIT/'excluded-candidates.json',excluded)
    print(json.dumps({'primaryRecords':len(rows),'promotions':len(candidates),'excluded':len(excluded)}))

def sheet():
    plan=load(AUDIT/'candidate-plan.json',[])
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14)
    small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',12)
    for start in range(0,len(plan),16):
        canvas=Image.new('RGB',(1440,1440),'#f7f5f0');draw=ImageDraw.Draw(canvas)
        for offset,w in enumerate(plan[start:start+16]):
            x=(offset%4)*360;y=(offset//4)*360
            path=SITE/w['image']
            if not path.exists():continue
            with Image.open(path) as original:
                im=ImageOps.exif_transpose(original).convert('RGB');im.thumbnail((336,270))
                canvas.paste(im,(x+12+(336-im.width)//2,y+8+(270-im.height)//2))
            title=f"{start+offset+1:03d} {w['id']}"
            draw.text((x+10,y+283),title,font=small,fill='black')
            text=(w['title'][:47]+'…') if len(w['title'])>48 else w['title']
            draw.text((x+10,y+304),text,font=font,fill='black')
            draw.text((x+10,y+327),w['artist'][:50],font=small,fill='#665f55')
        output=AUDIT/f'contact-{start//16+1:02d}.jpg';canvas.save(output,quality=93)
    print(json.dumps({'sheets':math.ceil(len(plan)/16),'works':len(plan)}))

def download_one(w):
    large=OUT/(w['id']+'-large.jpg');preview=SITE/w['image']
    try:
        if large.exists():
            with Image.open(large) as im:
                if max(im.size)>3200:raise ValueError('Existing large image exceeds the cap')
            return {'id':w['id'],'ok':True,'cached':True}
        response=fetch(w['largeSourceUrl'])
        with Image.open(io.BytesIO(response.content)) as original:
            im=ImageOps.exif_transpose(original).convert('RGB')
            if min(im.size)<350:raise ValueError('Source short dimension is below350 pixels')
            original_size=im.size;im.thumbnail((3200,3200),Image.Resampling.LANCZOS)
            large.parent.mkdir(parents=True,exist_ok=True);im.save(large,quality=90,optimize=True)
            if not w.get('promotion'):
                thumb=im.copy();thumb.thumbnail((640,640),Image.Resampling.LANCZOS);thumb.save(preview,quality=88,optimize=True)
        return {'id':w['id'],'ok':True,'sourceWidth':original_size[0],'sourceHeight':original_size[1],'sourceSha256':hashlib.sha256(response.content).hexdigest(),'sourceBytes':len(response.content)}
    except Exception as error:return {'id':w['id'],'ok':False,'error':str(error)}

def download():
    OUT.mkdir(parents=True,exist_ok=True)
    plan=load(AUDIT/'candidate-plan.json',[]);previous=load(AUDIT/'downloads.json',[]);byid={x['id']:x for x in previous if x.get('ok')}
    todo=[w for w in plan if w['id'] not in byid or not (OUT/(w['id']+'-large.jpg')).exists()]
    with ThreadPoolExecutor(max_workers=5) as pool:
        for future in as_completed([pool.submit(download_one,w) for w in todo]):
            result=future.result();byid[result['id']]=result
            write(AUDIT/'downloads.json',list(byid.values()))
            if len(byid)%20==0:print(json.dumps({'processed':len(byid),'total':len(plan)}),flush=True)
    print(json.dumps({'total':len(byid),'ok':sum(bool(x.get('ok')) for x in byid.values())}))

def palette(im):
    bins=[0]*40;swatches=Counter();im=im.convert('RGB')
    for y in range(64):
        for x in range(64):
            rgb=im.getpixel((min(im.width-1,round((.06+.88*(x+.5)/64)*im.width)),min(im.height-1,round((.06+.88*(y+.5)/64)*im.height))))
            h,s,v=colorsys.rgb_to_hsv(*(c/255 for c in rgb))
            index=36+min(3,math.floor(v*4)) if s<.18 else min(11,math.floor(h*12))*3+min(2,math.floor((s-.18)/.82*3))
            bins[index]+=1;swatches['#'+''.join(f'{int(c//32)*32+16:02x}' for c in rgb)]+=1
    return {'histogram':[round(n/4096,6) for n in bins],'swatches':[c for c,n in swatches.most_common(4)],'method':'HSV histogram, 40 bins; 64x64 samples; 6% edge crop'}

def discover_met():
    """Targeted primary-source availability audit, not automatic quiz inclusion."""
    queries=['Kandinsky','Mondrian','Robert Delaunay','Arthur Dove','Marsden Hartley','Georgia O Keeffe','Paul Klee','Joseph Stella','Charles Demuth','John Marin','Frantisek Kupka','August Macke','Suzanne Valadon','Gabriele Munter','Ferdinand Hodler','Odilon Redon','Cecilia Beaux','Henri Rousseau','The Death of Socrates','Aristotle with a Bust of Homer','The Harvesters','Juan de Pareja','Garden at Sainte-Adresse','Wheat Field with Cypresses','The Card Players','View of Toledo','The Fortune-Teller','The Gulf Stream','Emanuel Leutze','Thomas Cole']
    objects={};queries_audit=[]
    for query in queries:
        url='https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&medium=Paintings&limit=12&q='+requests.utils.quote(query)
        try:
            ids=fetch(url).json().get('objectIDs') or [];queries_audit.append({'query':query,'url':url,'ids':ids})
            def get_object(object_id):
                path=AUDIT/'met-records'/f'{object_id}.json'
                row=load(path)
                if row is None:row=fetch('https://collectionapi.metmuseum.org/public/collection/v1/objects/'+str(object_id)).json();write(path,row)
                return row
            with ThreadPoolExecutor(max_workers=4) as pool:
                for row in pool.map(get_object,ids[:12]):objects[row.get('objectID')]=row
        except Exception as error:queries_audit.append({'query':query,'error':str(error)})
        print(json.dumps({'query':query,'objects':len(objects)}),flush=True)
    usable=[r for r in objects.values() if r.get('isPublicDomain') is True and r.get('primaryImage') and re.search(r'painting|canvas|oil|tempera|watercolor|gouache',str(r.get('objectName'))+' '+str(r.get('medium')),re.I) and not re.search(r'print|engraving|lithograph|woodcut|sculpture',str(r.get('objectName'))+' '+str(r.get('classification')),re.I)]
    write(AUDIT/'met-availability.json',{'queries':queries_audit,'usable':usable})
    print(json.dumps({'usable':len(usable)}))

def discover_nga():
    """Use the museum's public bulk data; only explicitly open primary images."""
    base='https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/'
    objects_path=AUDIT/'nga-painting-records.json';paintings=load(objects_path)
    if paintings is None:
        response=requests.get(base+'objects.csv',headers=HEAD,stream=True,timeout=90);response.raise_for_status();response.raw.decode_content=True
        paintings=[]
        for row in csv.DictReader((line.decode('utf-8-sig')+'\n' for line in response.iter_lines())):
            if row.get('classification','').lower()=='painting':paintings.append(row)
        response.close();write(objects_path,paintings)
        print(json.dumps({'ngaPaintings':len(paintings)}),flush=True)
    images_path=AUDIT/'nga-open-painting-images.json';images=load(images_path)
    if images is None:
        painting_ids={row['objectid'] for row in paintings}
        response=requests.get(base+'published_images.csv',headers=HEAD,stream=True,timeout=90);response.raise_for_status();response.raw.decode_content=True
        images=[]
        for row in csv.DictReader((line.decode('utf-8-sig')+'\n' for line in response.iter_lines())):
            if row.get('openaccess')=='1' and row.get('viewtype')=='primary' and row.get('depictstmsobjectid') in painting_ids:images.append(row)
        response.close();write(images_path,images)
    byid={r['depictstmsobjectid']:r for r in sorted(images,key=lambda r:int(r.get('sequence') or 0),reverse=True)}
    eligible=[{**row,'publishedImage':byid[row['objectid']]} for row in paintings if row['objectid'] in byid]
    write(AUDIT/'nga-availability.json',eligible)
    print(json.dumps({'ngaPaintings':len(paintings),'explicitOpenPrimaryImages':len(eligible)}))

def append_extras():
    plan=load(AUDIT/'candidate-plan.json',[]);study=load(SITE/'artworks.json',[])
    seen_urls={source_key(w.get('sourceUrl')) for w in study+plan};seen_titles={identity(w) for w in study+plan};seen_ids={w['id'] for w in study+plan}
    nga_ids=[52397,121344,150903,46531,46678,37003,32694,46569,61368,42285,135512,204911,157462,52624,1236,60,46,41,1138,33253,83,46114,1179,1225,30228,75206,54191,93464,130555,35080]
    nga={int(row['objectid']):row for row in load(AUDIT/'nga-availability.json',[])}
    extra=[]
    for object_id in nga_ids:
        row=nga[object_id];im=row['publishedImage'];source='https://www.nga.gov/collection/art-object-page.'+str(object_id)+'.html';download_url=im['iiifurl'].rstrip('/')+'/full/!3200,3200/0/default.jpg'
        number=lambda key:int(row[key]) if re.fullmatch('-?[0-9]+',row.get(key,'')) else None
        normalized={'provider':'NGA','id':object_id,'title':row['title'],'url':source,'creation_date':row['displaydate'],'creation_date_earliest':number('beginyear'),'creation_date_latest':number('endyear'),'culture':[],'technique':row['medium'],'creditline':row['creditline'],'creators':[{'description':row['attribution'],'role':'attributed artist as catalogued'}],'share_license_status':'NGA Open Access','is_highlight':False,'publishedImage':im,'originalObjectMetadata':{key:row[key] for key in ['objectid','uuid','accessionnum','attribution','displaydate','beginyear','endyear','classification','parentid','isvirtual']}}
        work_id='extended-nga-'+str(object_id)
        extra.append({'id':work_id,'title':row['title'],'artist':row['attribution'],'date':row['displaydate'],'museum':'National Gallery of Art, Washington','sourceId':object_id,'sourceUrl':source,'image':(OUT/(work_id+'.jpg')).relative_to(SITE).as_posix(),'imageSourceUrl':download_url,'primaryRecord':normalized,'largeSourceUrl':download_url,'promotion':False})
    cma_ids=[128394,84370,83462,128393,154286,150693,171157,135371,111470,157147,154338,147569,455813,150723,170819]
    cma={row['id']:row for row in load(AUDIT/'cma-painting-records.json',[])}
    for object_id in cma_ids:
        row=cma[object_id];work_id='extended-cma-'+str(object_id)
        extra.append({'id':work_id,'title':row['title'],'artist':creators(row),'date':row['creation_date'],'museum':'Cleveland Museum of Art','sourceId':object_id,'sourceUrl':row['url'],'image':(OUT/(work_id+'.jpg')).relative_to(SITE).as_posix(),'imageSourceUrl':row['images']['print']['url'],'primaryRecord':row,'largeSourceUrl':row['images']['print']['url'],'promotion':False})
    added=[];rejected=[]
    for w in extra:
        if w['id'] in seen_ids:continue
        if source_key(w['sourceUrl']) in seen_urls or identity(w) in seen_titles:rejected.append({'id':w['id'],'reason':'Existing canonical artwork source or title/artist identity.'});continue
        added.append(w);seen_ids.add(w['id']);seen_urls.add(source_key(w['sourceUrl']));seen_titles.add(identity(w))
    write(AUDIT/'candidate-plan.json',plan+added);write(AUDIT/'extra-duplicate-exclusions.json',rejected)
    print(json.dumps({'additionalSources':len(added),'totalPlanned':len(plan)+len(added),'duplicates':rejected}))

def finalize():
    plan=load(AUDIT/'candidate-plan.json',[]);ledger=load(ROOT/'tools/openaccess-visual-reviews-20261115.json',{})
    observations=ledger.get('reviews',[]);numbers=[r['n'] for r in observations]
    if len(numbers)!=len(set(numbers)):raise ValueError('Duplicate review number')
    downloads={r['id']:r for r in load(AUDIT/'downloads.json',[])}
    definitions_path=SITE/'artwork-attribute-definitions.mjs'
    # Criteria are kept by exact names in the reviewed ledger. No current shared review file is edited.
    keys=ledger['attributeKeys'];works=[];reviews={};excluded=[];now=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    for observation in observations:
        w=plan[observation['n']-1];record=w['primaryRecord'];work_id=w['id']
        if observation.get('excludeReason'):
            excluded.append({'id':work_id,'reason':observation['excludeReason']});continue
        scores=observation.get('scores','');present=observation.get('present',{});unknown=observation.get('unknown',[])
        if not re.fullmatch('[0-4]{7}',scores) or any(k not in keys for k in list(present)+unknown) or any(k in unknown for k in present):raise ValueError('Incomplete or ambiguous review: '+work_id)
        download=downloads.get(work_id,{})
        if not download.get('ok'):continue
        preview=SITE/w['image'];large=OUT/(work_id+'-large.jpg')
        if not preview.exists() or not large.exists():continue
        preview_bytes=preview.read_bytes();large_bytes=large.read_bytes();preview_sha=hashlib.sha256(preview_bytes).hexdigest();large_sha=hashlib.sha256(large_bytes).hexdigest()
        with Image.open(preview) as im:width,height=im.size;pal=palette(im)
        with Image.open(large) as im:large_width,large_height=im.size
        source_url=record.get('url') or w['sourceUrl'];year0=record.get('creation_date_earliest');year1=record.get('creation_date_latest')
        year_range=[year0,year1] if isinstance(year0,(int,float)) and isinstance(year1,(int,float)) and year0<=year1 else None
        culture=record.get('culture') or w.get('culture') or []
        work={k:v for k,v in w.items() if k not in ['primaryRecord','promotion','largeSourceUrl','decorativeOnly','featureSource','features']}
        work.update({'imageLarge':large.relative_to(SITE).as_posix(),'width':width,'height':height,'largeWidth':large_width,'largeHeight':large_height,'sourceUrl':source_url,'imageSourceUrl':w.get('imageSourceUrl'),'rights':'CC0','rightsUrl':'https://creativecommons.org/publicdomain/zero/1.0/','credit':record.get('creditline') or '', 'creditLine':record.get('creditline') or '', 'country':'; '.join(culture) or 'Unknown','countrySource':'Institution culture/tradition field, not a verified place of execution. Missing culture is unknown.','culture':culture,'movement':'Unknown','movementSource':'No movement assigned by this institutional object record. Unknown remains unknown.','medium':record.get('technique') or w.get('medium',''),'artistKnown':not bool(re.search(r'unidentified|anonymous|unknown',w.get('artist',''),re.I)),'alt':observation['alt'],'note':'','features':{key:int(scores[i])/4 for i,key in enumerate(FEATURES)},'featureSource':'Provisional assistant visual review of this exact local reproduction. Seven deliberately coarse editorial descriptions, not psychological measurements or artist/movement defaults.','featureQuality':'provisional_manual','featureSemanticVersion':'literal-action-setting-v1','recognitionTier':'established' if record.get('is_highlight') else 'discovery','recognitionTierSource':'Editorial stimulus-planning tier; institutional highlights are established anchors, not a measured population familiarity rate.','studyEligible':True,'coreQuiz':False,'decorativeOnly':False,'sourceStatus':'source-verified','sha256':preview_sha,'bytes':len(preview_bytes),'analysis':{'revision':'gallery-descriptors-v1','yearRange':year_range,'yearRangeSource':source_url,'dateApproximate':bool(re.search(r'c\.|circa|about|century',record.get('creation_date',''),re.I)),'movementKey':None,'palette':pal},'provenance':{**w.get('provenance',{}),'provider':'Cleveland Museum of Art Open Access API','recordUrl':CMA+str(record['id']),'institutionRecordUrl':source_url,'downloadUrl':w['largeSourceUrl'],'share_license_status':record.get('share_license_status'),'sourceCulture':culture,'sourceDate':record.get('creation_date'),'creatorAttribution':record.get('creators',[]),'sourceRightsStatement':'The institutional object record designates this image CC0.','sourceImageSha256':download.get('sourceSha256'),'sourceImageBytes':download.get('sourceBytes'),'downloadedWidth':download.get('sourceWidth'),'downloadedHeight':download.get('sourceHeight'),'thumbnailSha256':preview_sha,'largeSha256':large_sha,'largeBytes':len(large_bytes),'largeWidth':large_width,'largeHeight':large_height,'retrievedAt':now,'reuseStatus':'institutional-cc0','promotedFromOpening':bool(w.get('promotion'))}})
        if record.get('provider')=='NGA':
            work['rights']='National Gallery of Art Open Access image'
            work['rightsUrl']='https://www.nga.gov/artworks/free-images-and-open-access'
            work['provenance'].update({'provider':'National Gallery of Art Open Data','recordUrl':'https://github.com/NationalGalleryOfArt/opendata/blob/main/data/objects.csv','imageMetadataUrl':'https://github.com/NationalGalleryOfArt/opendata/blob/main/data/published_images.csv','sourceRightsStatement':'The exact primary published-image row is marked openaccess=1, meaning unrestricted reuse under the NGA image Open Access Policy. The dataset CC0 license is separate.','reuseStatus':'institutional-open-access','openaccess':1,'publishedImage':record['publishedImage'],'originalObjectMetadata':record['originalObjectMetadata']})
        east_asian=bool(re.search(r'China|Japan|Korea|Chinese|Japanese|Korean', '; '.join(culture), re.I))
        himalayan=bool(re.search(r'Nepal|Tibet', '; '.join(culture), re.I))
        south_asian=bool(re.search(r'India|Mughal', '; '.join(culture), re.I))
        western=record.get('provider')=='NGA' or bool(re.search(r'France|Italy|Flanders|Netherlands|England|Germany|Spain|Austria|United States|Venice|Byzantine', '; '.join(culture), re.I))
        later=east_asian or himalayan or south_asian
        work['curationHints']={'version':'collection-expansion-curation-v1','reserveUntilBatch':3 if later else 0,'role':'later-tradition-depth' if later else 'western-comparison' if western else 'collection-depth','regionGrouping':'East Asian traditions' if east_asian else 'Himalayan traditions' if himalayan else 'South Asian traditions' if south_asian else 'Western comparison selection' if western else 'Other sourced tradition','basis':'Editorial study sequencing following the requested Western-classics and Mexico/Latin-America emphasis for rounds1–150. This grouping is not a new claim about creation place, nationality, familiarity or participant taste.'}
        if record.get('provider')=='NGA':
            landmarks={37003,46569,61368,1236,60,46,41,1138,33253,83,46114,1179,1225,30228}
            work['recognitionTier']='landmark' if record['id'] in landmarks else 'established'
            work['recognitionTierSource']='Individual editorial stimulus-planning judgement for this selected painting; not an institutional ranking or measured population familiarity rate.'
        elif not w.get('promotion'):work['recognitionTier']='established'
        works.append(work)
        attributes={key:{'status':'present' if short in present else 'unknown' if short in unknown else 'absent','reason':present.get(short) or ('Fine detail is unresolved at this reviewed reproduction scale.' if short in unknown else 'This criterion was assessed and not observed in this composition under the stated operational definition.'),'evidenceKind':'visual-review'} for short,key in keys.items()}
        review_source_urls=list(dict.fromkeys([source_url,work['provenance']['recordUrl']]+([work['provenance']['imageMetadataUrl']] if work['provenance'].get('imageMetadataUrl') else [])))
        reviews[work_id]={'version':'artwork-attributes-v1','reviewed':True,'reviewerType':'assistant-visual-review','sourceIdentity':{'sourceUrl':source_url,'image':work['image'],'previewSha256':preview_sha},'reviewedAsset':{'image':work['image'],'sha256':preview_sha,'width':width,'height':height,'mediaBinding':'exact-local-preview','compositionMatch':'same-composition','sourceLimited':max(width,height)<800},'sourceUrls':review_source_urls,'reviewMethod':'Assistant inspected the numbered local contact-sheet reproduction and considered all sixteen stated criteria; present observations have explicit visible reasons, uncertain fine detail is unknown, and the remaining criteria were assessed absent. This is editorial image review, not independent human validation.','attributes':attributes,'sourcedContext':[],'contextStatus':'not-documented-in-this-review','reviewedAt':now,'contactSheet':f"contact-{(observation['n']-1)//16+1:02d}.jpg",'contactNumber':observation['n']}
    output={'schemaVersion':1,'status':'staged-reviewed-candidates','reviewerType':'assistant-visual-review','createdAt':now,'count':len(works),'sourceDocs':['https://www.clevelandart.org/open-access-api','https://openaccess-api.clevelandart.org/','https://metmuseum.github.io/','https://github.com/NationalGalleryOfArt/opendata','https://www.nga.gov/artworks/free-images-and-open-access'],'scope':'Candidate additions and opening-image promotions only. Existing quiz works, frozen responses and shared metadata are unchanged.','curationScope':'Predominantly Western classics plus Mexico/Latin America in the first150 rounds. East Asian, South Asian and Himalayan expansion candidates are proposed mainly as later depth; global icons already in the original catalogue can remain earlier. reserveUntilBatch is zero-based, with3 meaning the fourth50-round block.','works':works,'excludedCandidates':excluded,'pendingReviewCount':len(plan)-len(observations)}
    write(ROOT/'artifacts/art-atlas/catalogue-expansion-candidates.json',output)
    write(ROOT/'artifacts/art-atlas/catalogue-expansion-attribute-reviews.json',{'version':'artwork-attributes-v1','reviewerType':'assistant-visual-review','reviewedCount':len(reviews),'definitionsSource':'public/art-atlas/artwork-attribute-definitions.mjs','reviews':reviews})
    print(json.dumps({'reviewedEligible':len(works),'excluded':len(excluded),'pending':output['pendingReviewCount']}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['prepare','sheets','download','finalize','met','nga','extras']);args=parser.parse_args()
    {'prepare':prepare,'sheets':sheet,'download':download,'finalize':finalize,'met':discover_met,'nga':discover_nga,'extras':append_extras}[args.command]()
