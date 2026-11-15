"""Source-aware collection additions; never changes the live artwork catalogue.

Dependencies are isolated under ignored node_modules/.art-atlas-python.
Use `py -3.10 -m pip install --target node_modules/.art-atlas-python requests pillow beautifulsoup4`.
"""
from pathlib import Path
import sys, json, hashlib, time, re, io, argparse, colorsys, math, unicodedata
from collections import Counter
from urllib.parse import quote, urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'node_modules' / '.art-atlas-python'))
import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageFont, ImageOps
if hasattr(sys.stdout,'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
BASE = ROOT / 'public' / 'art-atlas'
OUT = BASE / 'assets' / 'collection-20261115'
AUDIT = ROOT / 'docs' / 'art-atlas-additions-20261115'
API = 'https://commons.wikimedia.org/w/api.php'
HEADERS = {'User-Agent': 'ArtAtlasCollectionResearch/1.0 (artwork metadata and attributed image review)'}

def fetch(url, params=None):
    response = requests.get(url, params=params, headers=HEADERS, timeout=50)
    if response.status_code == 503:
        time.sleep(2)
        response = requests.get(url, params=params, headers=HEADERS, timeout=50)
    if response.status_code != 200:
        raise RuntimeError(f'HTTP{response.status_code}: {response.url}: {response.text[:80]}')
    return response

def plain(value):
    return BeautifulSoup(value or '', 'html.parser').get_text(' ', strip=True)

def commons(title=None, query=None, limit=10):
    params={'action':'query','format':'json','prop':'imageinfo','iiprop':'url|extmetadata|size','iiurlwidth':2400}
    if title: params['titles']=title if title.startswith('File:') else 'File:'+title
    else: params.update(generator='search',gsrsearch=query,gsrnamespace=6,gsrlimit=limit)
    data=fetch(API, params=params).json()
    return [page for page in data.get('query',{}).get('pages',{}).values() if page.get('imageinfo')]

def save_asset(work_id, url):
    OUT.mkdir(parents=True, exist_ok=True)
    large=OUT/(work_id+'-large.jpg');small=OUT/(work_id+'.jpg')
    if large.exists():
        previous_path=AUDIT/'staged-works.json'
        previous=next((row for row in json.loads(previous_path.read_text(encoding='utf-8')) if row.get('id')==work_id),None) if previous_path.exists() else None
        if not previous:raise RuntimeError('Existing reproduction has no source binding: '+work_id)
        canonical=lambda u:u.split('=')[0] if 'googleusercontent.com/' in u else u
        if canonical(previous['imageSourceUrl'])!=canonical(url):raise RuntimeError('Source image changed; review and import separately: '+work_id)
        if hashlib.sha256(large.read_bytes()).hexdigest()!=previous['largeSha256']:raise RuntimeError('Saved reproduction hash changed: '+work_id)
    if not large.exists():
        response=fetch(url)
        image=ImageOps.exif_transpose(Image.open(io.BytesIO(response.content))).convert('RGB')
        if min(image.size)<150: raise RuntimeError('Reproduction too small: '+str(image.size))
        image.thumbnail((2800,2800),Image.Resampling.LANCZOS)
        image.save(large,quality=94,subsampling=0,optimize=True)
    image=Image.open(large)
    preview=image.copy();preview.thumbnail((640,640),Image.Resampling.LANCZOS);preview.save(small,quality=88,optimize=True)
    return {'image':small.relative_to(BASE).as_posix(),'imageLarge':large.relative_to(BASE).as_posix(),'width':preview.width,'height':preview.height,'largeWidth':image.width,'largeHeight':image.height,'largeSha256':hashlib.sha256(large.read_bytes()).hexdigest(),'largeBytes':large.stat().st_size,'sha256':hashlib.sha256(small.read_bytes()).hexdigest(),'bytes':small.stat().st_size}

def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def discover(queries):
    AUDIT.mkdir(parents=True,exist_ok=True)
    for query in queries:
        try:
            pages=commons(query=query,limit=12)
            save_json(AUDIT/('search-'+re.sub(r'[^a-z0-9]+','-',query.lower()).strip('-')+'.json'),pages)
            print(json.dumps({'query':query,'results':[{'title':p['title'],'license':plain(p['imageinfo'][0].get('extmetadata',{}).get('LicenseShortName',{}).get('value'))} for p in pages]},ensure_ascii=False),flush=True)
        except Exception as error:
            print(json.dumps({'query':query,'error':str(error)},ensure_ascii=False),flush=True)
            if '429' in str(error):break

def google_search(query):
    response=fetch('https://artsandculture.google.com/search/asset/',params={'q':query});response.encoding='utf-8'
    urls=list(dict.fromkeys(re.findall(r'"(/asset/[^"\\<>\s]+/[A-Za-z0-9_-]{10,20})"',response.text)))
    return ['https://artsandculture.google.com'+url for url in urls[:16]]

def google_record(url):
    response=fetch(url);response.encoding='utf-8';soup=BeautifulSoup(response.text,'html.parser')
    image=soup.find('meta',property='og:image')
    if not image: raise RuntimeError('No institution-supplied reproduction: '+url)
    fields={}
    for li in soup.find_all('li'):
        value=li.get_text(' ',strip=True)
        if ':' in value:
            key,content=value.split(':',1)
            if key in ['Title','Creator','Creator Display Name','Painter','Date Created','Date','Date created','Medium','Technique','Technique/Material','Rights','Terms of Use','Provenance','Location Created','Location','Physical Dimensions','Type','Original title','Credit Line','Collection']:
                fields[key]=content.strip()
    partners=[a.get_text(' ',strip=True) for a in soup.find_all('a',href=True) if '/partner/' in a['href'] and a.get_text(' ',strip=True)]
    fields.update(sourceUrl=url,imageSourceUrl=image['content'].split('=')[0]+'=w3200',museum=partners[0] if partners else None,pageTitle=soup.title.get_text() if soup.title else '')
    return fields

def google_discover(queries):
    AUDIT.mkdir(parents=True,exist_ok=True)
    for query in queries:
        try:
            urls=google_search(query);records=[]
            with ThreadPoolExecutor(max_workers=3) as pool:
                for future in as_completed({pool.submit(google_record,url):url for url in urls}):
                    try: records.append(future.result())
                    except Exception as error: print(str(error),flush=True)
            save_json(AUDIT/('google-'+re.sub(r'[^a-z0-9]+','-',query.lower()).strip('-')+'.json'),records)
            print(json.dumps({'query':query,'works':[{'title':r.get('Title'),'artist':r.get('Creator'),'date':r.get('Date Created'),'museum':r.get('museum'),'url':r['sourceUrl']} for r in records]},ensure_ascii=False),flush=True)
        except Exception as error:
            print(json.dumps({'query':query,'error':str(error)},ensure_ascii=False),flush=True)
            if '429' in str(error):break

def contact_sheet(works):
    AUDIT.mkdir(parents=True,exist_ok=True)
    font_path=Path('C:/Windows/Fonts/arial.ttf')
    font=ImageFont.truetype(str(font_path),15)
    for start in range(0,len(works),24):
        batch=works[start:start+24];sheet=Image.new('RGB',(1440,4*270),'#f5f4f1');draw=ImageDraw.Draw(sheet)
        for index,work in enumerate(batch):
            x=(index%6)*240;y=(index//6)*270
            pic=Image.open(BASE/work['image']);pic.thumbnail((222,210),Image.Resampling.LANCZOS)
            sheet.paste(pic,(x+(240-pic.width)//2,y+5+(210-pic.height)//2))
            draw.text((x+9,y+220),f'{start+index+1:02d} '+work['id'].replace('add-','')[:26],font=font,fill='#302d29')
            draw.text((x+9,y+242),work['artist'][:27],font=font,fill='#796956')
        path=AUDIT/f'contact-{start//24+1}.jpg';sheet.save(path,quality=92)
        print(str(path),flush=True)

def stage(refresh_missing=False):
    """Download only identified institutional records; leave unreviewed features absent."""
    plan=json.loads((ROOT/'tools/art-atlas-additions-plan-20261115.json').read_text(encoding='utf-8'))
    review_path=ROOT/'tools/art-atlas-additions-review-20261115.json'
    excluded=json.loads(review_path.read_text(encoding='utf-8')).get('excluded',{}) if review_path.exists() else {}
    cached={}
    for path in AUDIT.glob('google-*.json'):
        for row in json.loads(path.read_text(encoding='utf-8')):
            cached[row['sourceUrl'].split('?')[0].rsplit('/',1)[-1]]=row
    extra_path=AUDIT/'google-additional-records.json'
    if extra_path.exists():
        for row in json.loads(extra_path.read_text(encoding='utf-8')): cached[row['sourceUrl'].split('?')[0].rsplit('/',1)[-1]]=row
    extras=[];pending=[];prepared=[];metadata_limited=False
    for spec in plan:
        if spec['id'] in excluded:continue
        row=cached.get(spec['assetId'])
        if row is None and refresh_missing and not metadata_limited:
            try:
                row=google_record(spec['sourceUrl']);extras.append(row);cached[spec['assetId']]=row
                save_json(extra_path,list({r['sourceUrl']:r for r in list(cached.values()) if r['sourceUrl'].split('?')[0].rsplit('/',1)[-1] in {s['assetId'] for s in plan}}.values()))
                time.sleep(1)
            except Exception as error:
                print(json.dumps({'metadataMissing':spec['id'],'error':str(error)}),flush=True)
                if '429' in str(error): metadata_limited=True
        if row is None:
            pending.append(spec['id']);continue
        reproduction=row['imageSourceUrl'].split('=')[0]+'=w3200' if 'googleusercontent.com/' in row['imageSourceUrl'] else row['imageSourceUrl']
        prepared.append({**spec,'sourceMetadata':row,'sourceUrl':row['sourceUrl'],'imageSourceUrl':reproduction})
    def download(work):
        return {**work,**save_asset(work['id'],work['imageSourceUrl'])}
    works=[]
    with ThreadPoolExecutor(max_workers=2) as pool:
        tasks={pool.submit(download,work):work['id'] for work in prepared}
        for task in as_completed(tasks):
            try:
                work=task.result();works.append(work)
                print(json.dumps({'downloaded':work['id'],'pixels':[work['largeWidth'],work['largeHeight']]}),flush=True)
            except Exception as error: pending.append(tasks[task]);print(json.dumps({'failed':tasks[task],'error':str(error)}),flush=True)
    order={w['id']:i for i,w in enumerate(plan)};works.sort(key=lambda w:order[w['id']])
    save_json(AUDIT/'staged-works.json',works);save_json(AUDIT/'pending.json',pending)
    contact_sheet([{**w,'artist':w['artist']} for w in works])
    print(json.dumps({'readyForVisualReview':len(works),'pending':pending}),flush=True)

def palette(work):
    """Same40-bin definition and rounded pixel-centres as the preserved original generator."""
    image=Image.open(BASE/work['image']).convert('RGB');bins=[0]*40;colors=Counter()
    for y in range(64):
        for x in range(64):
            rgb=image.getpixel((round((x+.5)/64*image.width*.88+image.width*.06),round((y+.5)/64*image.height*.88+image.height*.06)))
            hue,sat,val=colorsys.rgb_to_hsv(*(c/255 for c in rgb))
            index=36+min(3,math.floor(val*4)) if sat<.18 else min(11,math.floor(hue*12))*3+min(2,math.floor((sat-.18)/.82*3))
            bins[index]+=1;colors['#'+''.join(f'{math.floor(c/32)*32+16:02x}' for c in rgb)]+=1
    return {'histogram':[round(n/4096,6) for n in bins],'swatches':[c for c,n in colors.most_common(4)],'method':'HSV histogram, 40 bins; 64x64 samples; 6% edge crop'}

def year_range(raw):
    if not isinstance(raw,str): return None
    years=re.findall(r'(?<!\d)(1[5-9]\d\d|20[0-2]\d)(?!\d)',raw)
    if not years:return None
    years=list(dict.fromkeys(map(int,years)))
    if len(years)>2:return None
    if len(years)==2:return sorted(years)
    if re.search(r'ca\.?|circa|c\.',raw,re.I):return [years[0]-2,years[0]+2]
    return [years[0],years[0]]

def finalize():
    staged=json.loads((AUDIT/'staged-works.json').read_text(encoding='utf-8'))
    review=json.loads((ROOT/'tools/art-atlas-additions-review-20261115.json').read_text(encoding='utf-8'))
    imported=[];unreviewed=[]
    for work in staged:
        if work['id'] in review['excluded']:continue
        annotation=review['works'].get(work['id'])
        if not annotation:unreviewed.append(work['id']);continue
        raw=work['sourceMetadata'];date=raw.get('Date Created') or raw.get('Date') or raw.get('Date created')
        source_rights=raw.get('Rights') or raw.get('Terms of Use')
        rights=('No open reuse license stated in institution record.' if not source_rights else
                source_rights if ('©' in source_rights or 'reserved' in source_rights.lower() or work['id']=='add-watts-hope' or source_rights=='CC0') else
                'No open reuse license established. Source rights/credit: '+source_rights)
        museum=raw.get('museum') or 'Institution record (see source)'
        museum=re.sub(r' (?:CABA, Argentina|Mexico, Mexico|Mexico City, Mexico|Ciudad de México, Mexico|Cuernavaca, Mexico|Chicago, United States|Austin, TX, United States|Washington, United States|Washington, DC, United States|Washington, D.C., United States|Long Beach, United States|San Juan, Puerto Rico|Paris, France|Roma, Italy|Parma, Italy|Prague, Czechia|Torino, Italy|London, United Kingdom|Rovereto, Italy|Jerusalem, Israel|Stockholm, Sweden|Zürich, Switzerland|Essen, Germany|Munich, Germany)$','',museum)
        if 'Nagoya City Art Museum' in museum:museum='Nagoya City Art Museum'
        result={k:work[k] for k in ['id','artist','movement','country','image','imageLarge','width','height','largeWidth','largeHeight','sourceUrl','imageSourceUrl']}
        result.update(title=annotation.get('title') or raw.get('Title') or work['id'],date=date or 'Not dated in source record',medium=raw.get('Medium') or raw.get('Technique') or raw.get('Technique/Material') or 'Not specified in source record',sourceId='gac:'+work['assetId'],museum=museum,rights=rights,rightsUrl=(source_rights if source_rights and source_rights.startswith('https://') else work['sourceUrl']),creditLine=museum+' via Google Arts & Culture'+('. '+source_rights if source_rights else '. No open reuse license stated.'),alt=annotation['alt'],note=annotation['note'],features=dict(zip(review['featureOrder'],annotation['values'])),featureSource=review['basis'],movementSource='Provisional editorial movement/tradition label informed by the institution record and artist practice; not an objective visual measurement.',recognitionTier=annotation['tier'],recognitionTierSource='Editorial curation for stimulus selection; not a population familiarity measure.',countrySource='Editorial artist-practice/tradition grouping; not a nationality claim or a verified place of execution for every work.',analysis={'revision':'gallery-descriptors-v1','yearRange':year_range(date),'movementKey':unicodedata.normalize('NFKD',work['movement']).encode('ascii','ignore').decode().lower(),'palette':palette(work)})
        if result['title']!=raw.get('Title'):result['sourceTitle']=raw.get('Title')
        approximate=bool(date and re.search(r'ca\.?|circa|c\.',date,re.I))
        result['datePrecision']='unknown' if not date else 'circa' if approximate else 'range' if len(set(re.findall(r'\b\d{4}\b',date)))>1 else 'year'
        result['analysis']['yearRangeBasis']='Editorial ±2-year display interval around the source circa year; the institution did not supply closed bounds.' if approximate else 'Source date or closed source interval; not inferred from style.'
        for key in ['practiceCountries','artistBirthCountry','artistNote','mediumNote']:
            if key in work:result[key]=work[key]
        if annotation.get('caveats'):result['stimulusCaveats']=annotation['caveats']
        if raw.get('additionalSourceUrls'):result['additionalSourceUrls']=raw['additionalSourceUrls']
        if raw.get('dateSourceUrl'):result['dateSourceUrl']=raw['dateSourceUrl']
        result['provenance']={'provider':raw.get('imageProvider') or 'Institution-supplied Google Arts & Culture record','metadataUrl':raw.get('imageMetadataUrl') or work['sourceUrl'],'objectRecordUrl':work['sourceUrl'],'assetId':work['assetId'],'downloadUrl':work['imageSourceUrl'],'retrievedAt':'2026-11-15','downloadedWidth':raw.get('sourcePixelDimensions',[work['largeWidth'],work['largeHeight']])[0],'downloadedHeight':raw.get('sourcePixelDimensions',[work['largeWidth'],work['largeHeight']])[1],'largeSha256':work['largeSha256'],'thumbnailSha256':work['sha256'],'largeBytes':work['largeBytes'],'thumbnailBytes':work['bytes'],'transformation':'EXIF orientation respected; RGB JPEG quality94 large derivative at maximum2800px, quality88 preview at maximum640px; no upscaling. Actual available pixels retained.','sourceRightsStatement':source_rights,'reuseStatus':'open-license-stated' if source_rights=='CC0' else 'permission-not-established','visualReview':'Actual local reproduction inspected before manual annotation; contact sheets in docs/art-atlas-additions-20261115.'}
        if work['id'] in ['add-watts-hope','add-rivera-zapatista-landscape']:result['provenance']['downloadUrl']=work['imageSourceUrl'].split('=')[0]+'=s1200'
        imported.append(result)
    save_json(BASE/'collection-additions-20261115.json',imported)
    save_json(AUDIT/'excluded-candidates.json',review['excluded'])
    print(json.dumps({'reviewedImport':len(imported),'awaitingReview':unreviewed}),flush=True)

def audit():
    works=json.loads((BASE/'collection-additions-20261115.json').read_text(encoding='utf-8'))
    own_ids={w['id'] for w in works}
    original=[w for w in json.loads((BASE/'artworks.json').read_text(encoding='utf-8')) if w['id'] not in own_ids]
    opening=json.loads((BASE/'opening-artworks.json').read_text(encoding='utf-8'))
    existing=original+opening
    norm=lambda text:re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',str(text or '')).encode('ascii','ignore').decode().lower())
    identity=lambda w:(norm(w.get('artist')),norm(w.get('title')))
    existing_identities={identity(w):w['id'] for w in existing}
    existing_sources={str(w.get('sourceId')):w['id'] for w in existing if w.get('sourceId') is not None}
    existing_urls={w.get('sourceUrl'):w['id'] for w in existing if w.get('sourceUrl')}
    existing_hashes={hashlib.sha256((BASE/w['image']).read_bytes()).hexdigest():w['id'] for w in existing if (BASE/w.get('image','')).is_file()}
    duplicates=[];hashes=set();sources=set();validation=[]
    for w in works:
        if identity(w) in existing_identities:duplicates.append({'workId':w['id'],'existingId':existing_identities[identity(w)],'basis':'normalized-title-and-artist'})
        if str(w['sourceId']) in existing_sources:duplicates.append({'workId':w['id'],'existingId':existing_sources[str(w['sourceId'])],'basis':'source-id'})
        if w['sourceUrl'] in existing_urls:duplicates.append({'workId':w['id'],'existingId':existing_urls[w['sourceUrl']],'basis':'source-url'})
        for key,expected_hash in [('image',w['provenance']['thumbnailSha256']),('imageLarge',w['provenance']['largeSha256'])]:
            path=BASE/w[key];digest=hashlib.sha256(path.read_bytes()).hexdigest()
            if digest!=expected_hash:validation.append(w['id']+': hash mismatch')
            if digest in existing_hashes:duplicates.append({'workId':w['id'],'existingId':existing_hashes[digest],'basis':'exact-image-hash'})
        if w['provenance']['largeSha256'] in hashes:validation.append(w['id']+': duplicate new reproduction')
        if w['sourceId'] in sources:validation.append(w['id']+': duplicate new object source')
        hashes.add(w['provenance']['largeSha256']);sources.add(w['sourceId'])
        for key,width_key,height_key in [('image','width','height'),('imageLarge','largeWidth','largeHeight')]:
            with Image.open(BASE/w[key]) as image:
                image.verify()
            with Image.open(BASE/w[key]) as image:
                image.load()
                if image.size!=(w[width_key],w[height_key]):validation.append(w['id']+': dimensions mismatch')
    combined=original+works
    tails=lambda rows:{k:{'lowAtMost025':sum(w.get('features',{}).get(k,math.inf)<=.25 for w in rows),'highAtLeast075':sum(w.get('features',{}).get(k,-math.inf)>=.75 for w in rows)} for k in works[0]['features']}
    excluded=json.loads((AUDIT/'excluded-candidates.json').read_text(encoding='utf-8'))
    report={'revision':'collection-additions-20261115','counts':{'additions':len(works),'mexicanPractice':sum(w['country']=='Mexico' for w in works),'mexicanPracticeArtists':len({w['artist'] for w in works if w['country']=='Mexico'}),'artists':len({w['artist'] for w in works}),'originalStudy':len(original),'openingChecked':len(opening),'identitiesCheckedAgainst':len(existing),'combinedStudy':len(combined)},'manualFeatureTails':{'original':tails(original),'additions':tails(works),'combined':tails(combined)},'crossedCoverage':{'abstractAndSparse':sum(w['features']['abstraction']>=.75 and w['features']['complexity']<=.25 for w in works),'abstractAndDense':sum(w['features']['abstraction']>=.75 and w['features']['complexity']>=.75 for w in works),'representationalAndSparse':sum(w['features']['abstraction']<=.35 and w['features']['complexity']<=.35 for w in works)},'datesUnknown':[w['id'] for w in works if w['analysis']['yearRange'] is None],'totalHostedBytes':sum(w['provenance']['largeBytes']+w['provenance']['thumbnailBytes'] for w in works),'largeReproductionPixels':{w['id']:[w['largeWidth'],w['largeHeight']] for w in works},'duplicates':duplicates,'validationErrors':validation,'excluded':excluded,'unfulfilledNamedCandidates':['add-varo-juggler','add-varo-creation-of-the-birds','add-varo-bankers-in-action'],'limits':['Editorial feature values are provisional and not validated measurements.','Most available institutional reproductions contain1200px on the long side; larger primary images retained where acquired.','Country groups artist practice/tradition and does not universally assert nationality or place of execution.','Source copyright and reuse statements are preserved; this is not an open-license image pack.','No claim is made that a work is currently displayed.']}
    save_json(AUDIT/'coverage-audit.json',report)
    print(json.dumps({'counts':report['counts'],'duplicates':duplicates,'validationErrors':validation,'hostedBytes':report['totalHostedBytes']}),flush=True)
    if duplicates or validation:raise RuntimeError('Collection audit failed; inspect coverage-audit.json')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['search','google','hope','sheets','stage','finalize','audit']);parser.add_argument('queries',nargs='*');args=parser.parse_args()
    if args.command=='search': discover(args.queries)
    elif args.command=='google': google_discover(args.queries)
    elif args.command=='stage': stage('refresh-missing' in args.queries)
    elif args.command=='finalize': finalize()
    elif args.command=='audit': audit()
    elif args.command=='hope':
        page=commons(title='Assistants and George Frederic Watts - Hope - Google Art Project.jpg')[0]
        info=page['imageinfo'][0];save_json(AUDIT/'hope-commons.json',page)
        print(json.dumps(save_asset('add-watts-hope',info.get('thumburl') or info['url']),ensure_ascii=False),flush=True)
    else: contact_sheet(json.loads((BASE/'collection-additions-20261115.json').read_text(encoding='utf-8')))
