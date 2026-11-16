"""Prepare required artwork candidates without changing the live catalogue."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import urllib.request, urllib.parse, json, hashlib, sys, io, time, re, html, colorsys, math
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter
if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'public/art-atlas'
QA=ROOT/'qa-output/required-20261115'
OUT=SITE/'assets/required-20261115'
PLAN=ROOT/'tools/required-artworks-plan-20261115.json'
TARGET=ROOT/'artifacts/art-atlas/required-expansion-candidates.json'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def plain(raw):return html.unescape(re.sub('<[^>]+>',' ',raw or '')).strip()
def fetch(url):
    request=urllib.request.Request(url,headers={'User-Agent':'ArtAtlas/1.0 (artwork metadata and reproduction verification)'})
    with urllib.request.urlopen(request,timeout=60) as response:return response.read(),response.headers.get('Content-Type','')
def palette(image):
    bins=[0]*40;colors=Counter()
    sample=image.resize((64,64),Image.Resampling.LANCZOS)
    for rgb in sample.getdata():
        hue,sat,val=colorsys.rgb_to_hsv(*(c/255 for c in rgb))
        index=36+min(3,math.floor(val*4)) if sat<.18 else min(11,math.floor(hue*12))*3+min(2,math.floor((sat-.18)/.82*3))
        bins[index]+=1;colors['#'+''.join(f'{math.floor(c/32)*32+16:02x}' for c in rgb)]+=1
    return {'histogram':[round(n/4096,6) for n in bins],'swatches':[c for c,n in colors.most_common(4)],'method':'HSV histogram, 40 bins; 64x64 whole-image resampling; no inferred emotion.'}
def all_metadata():
    pages={}
    for path in QA.glob('*metadata.json'):
        try:
            data=json.loads(path.read_text(encoding='utf-8'))
            pages.update({p['title']:p for p in data.get('query',{}).get('pages',{}).values() if p.get('imageinfo')})
        except (ValueError,TypeError):pass
    for path in QA.glob('*commons-search.json'):
        try:
            data=json.loads(path.read_text(encoding='utf-8'))
            for p in data.get('query',{}).get('pages',{}).values():
                if p.get('imageinfo'):pages.setdefault(p['title'],p)
        except (ValueError,TypeError):pass
    return pages
def prepare_one(spec,pages):
    page=pages.get(spec.get('commonsTitle'));info=page['imageinfo'][0] if page else None
    if spec.get('commonsTitle') and not info:raise RuntimeError('Exact Commons identity not cached: '+spec['commonsTitle'])
    ext=info.get('extmetadata',{}) if info else {}
    license=ext.get('LicenseShortName',{}).get('value')
    if spec.get('rightsMode')=='public-domain-faithful' and (license!='Public domain' or ext.get('Copyrighted',{}).get('value')!='False'):raise RuntimeError('Faithful public-domain reproduction status missing for '+spec['id'])
    original=(info['url'] if info else spec.get('sourceDocumentUrl',spec.get('downloadUrl'))).split('?utm_')[0]
    candidates=[spec['downloadUrl']] if spec.get('downloadUrl') else []
    if info:candidates.extend([info.get('thumburl',original).split('?utm_')[0],original])
    raw_path=QA/(spec['id']+'-source.bin');download_path=QA/(spec['id']+'-download.json')
    document_evidence=None
    if spec.get('documentImage'):
        from pypdf import PdfReader
        document_path=QA/spec['documentImage']['cachedDocument']
        if not document_path.exists():document_path.write_bytes(fetch(spec['sourceDocumentUrl'])[0])
        page_number=spec['documentImage']['page'];image_index=spec['documentImage'].get('index',0)
        embedded=PdfReader(document_path).pages[page_number-1].images[image_index]
        raw=embedded.data;download={'url':spec['sourceDocumentUrl']+'#page='+str(page_number),'contentType':'image/jpeg','extraction':'Original embedded image object, without rendering the page or generating pixels.'}
        document_evidence={'sourceDocumentUrl':spec['sourceDocumentUrl'],'sourceDocumentSha256':sha(document_path.read_bytes()),'page':page_number,'imageIndex':image_index,'imageName':embedded.name,'embeddedImageSha256':sha(raw)}
        raw_path.write_bytes(raw);download_path.write_text(json.dumps(download,indent=2),encoding='utf-8')
    elif raw_path.exists():raw=raw_path.read_bytes();download=json.loads(download_path.read_text(encoding='utf-8'))
    else:
        errors=[]
        for url in dict.fromkeys(candidates):
            try:
                raw,content_type=fetch(url)
                if not content_type.startswith('image/'):raise RuntimeError('Non-image content type '+content_type)
                image=Image.open(io.BytesIO(raw));image.load()
                if max(image.size)<1000:raise RuntimeError('Source is smaller than 1000 pixels')
                download={'url':url,'contentType':content_type};raw_path.write_bytes(raw);download_path.write_text(json.dumps(download,indent=2),encoding='utf-8');break
            except urllib.error.HTTPError as error:
                if error.code==429:raise RuntimeError(spec['id']+': rate-limited; stop this source attempt and retry later')
                errors.append(str(error))
            except Exception as error:errors.append(str(error))
        else:raise RuntimeError(spec['id']+': '+' | '.join(errors))
    image=ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
    large=image.copy();large.thumbnail((3200,3200),Image.Resampling.LANCZOS)
    preview=image.copy();preview.thumbnail((800,800),Image.Resampling.LANCZOS)
    large_path=OUT/(spec['id']+'-large.jpg');preview_path=OUT/(spec['id']+'.jpg')
    # Only task-owned deterministic derivatives are written. Existing catalogue files stay untouched.
    large.save(large_path,quality=90,optimize=True);preview.save(preview_path,quality=88,optimize=True)
    work={k:v for k,v in spec.items() if k not in ['commonsTitle','downloadUrl','rightsMode','yearRange','dateBasis','documentImage']}
    work.update(image=preview_path.relative_to(SITE).as_posix(),imageLarge=large_path.relative_to(SITE).as_posix(),width=preview.width,height=preview.height,largeWidth=large.width,largeHeight=large.height,sha256=sha(preview_path.read_bytes()),bytes=preview_path.stat().st_size,imageSourceUrl=download['url'],sourceStatus='source-verified',artistKnown=True,coreQuiz=False,decorativeOnly=False,studyEligible=True,featureSemanticVersion='literal-action-setting-v1',featureQuality='provisional_manual',recognitionTierSource='Editorial curation for stimulus selection; not a population familiarity measure.',countrySource='Editorial cultural/practice context, not a verified artist nationality or place of execution.',movementSource='Editorial context classification with linked source evidence; not a measured visual descriptor.')
    work['studyEligible']=spec.get('studyEligible',True)
    work['eligibleForStudy']=spec.get('eligibleForStudy',work['studyEligible'])
    if spec['rightsMode']=='public-domain-faithful':
        work['rights']='Public domain';work['rightsUrl']=info['descriptionurl']+'#Licensing'
        work['creditLine']=spec['artist']+'. '+spec['title']+'. '+spec['museum']+'. Faithful public-domain reproduction via Wikimedia Commons.'
    elif info:
        work['rights']='Photograph: '+str(license)+'. Underlying artwork: no open reuse license established.'
        work['rightsUrl']=info['descriptionurl']+'#Licensing';work['creditLine']=plain(ext.get('Artist',{}).get('value'))+'. Photograph of '+spec['artist']+', '+spec['title']+'. '+str(license)+'.'
    else:
        work['rights']='No open reuse license established for the underlying artwork or institutional reproduction.'
        work['rightsUrl']=spec['sourceUrl'];work['creditLine']=spec['artist']+'. '+spec['title']+'. Reproduction supplied by '+spec['museum']+'.'
    work['analysis']={'revision':'gallery-descriptors-v1','yearRange':spec.get('yearRange'),'yearRangeSource':spec['sourceUrl'],'yearRangeBasis':spec.get('dateBasis','Closed date/interval recorded by linked institutional source; no style-based date inference.'),'movementKey':spec['movement'].lower(),'palette':palette(preview)}
    work['provenance']={'provider':'Wikimedia Commons' if info else 'Primary institution / rights-holder source','recordUrl':info['descriptionurl'] if info else spec['sourceUrl'],'institutionRecordUrl':spec['sourceUrl'],'sourceFileTitle':page['title'] if page else None,'commonsPageId':page['pageid'] if page else None,'downloadUrl':download['url'],'originalImageUrl':original,'sourceImageSha256':sha(raw),'sourceImageBytes':len(raw),'downloadedWidth':image.width,'downloadedHeight':image.height,'thumbnailSha256':work['sha256'],'largeSha256':sha(large_path.read_bytes()),'thumbnailBytes':work['bytes'],'largeBytes':large_path.stat().st_size,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'licenseMetadata':{k:ext[k]['value'] for k in ['LicenseShortName','Copyrighted','LicenseUrl','License','UsageTerms','AttributionRequired'] if k in ext},'reuseStatus':'public-domain-faithful-reproduction' if spec['rightsMode']=='public-domain-faithful' else 'permission-not-established-for-underlying-work','rightsScope':'Photographer licensing does not grant an open license to the depicted modern painting. Museum photos are not relabelled CC0.','viewScope':spec.get('viewScope','whole-work'),'transformation':'EXIF orientation respected, complete downloaded composition and aspect ratio preserved. Preview maximum800px JPEG quality88; large maximum3200px JPEG quality90. No upscaling or invented pixels.','sourceLimited':max(image.size)<2000}
    if document_evidence:work['provenance']['documentImageExtraction']=document_evidence
    if info:work['provenance'].update(originalFileWidth=info.get('width'),originalFileHeight=info.get('height'))
    time.sleep(1.5)
    return work
def prepare():
    QA.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    plan=json.loads(PLAN.read_text(encoding='utf-8'));pages=all_metadata();works=[];failures=[]
    with ThreadPoolExecutor(max_workers=1) as executor:
        pending={executor.submit(prepare_one,spec,pages):spec for spec in plan if not spec.get('pending')}
        for future in as_completed(pending):
            spec=pending[future]
            try:
                work=future.result();works.append(work);print(json.dumps({'ready':work['id'],'size':[work['largeWidth'],work['largeHeight']],'bytes':work['provenance']['largeBytes']}),flush=True)
            except Exception as error:failures.append({'id':spec['id'],'error':str(error)});print(json.dumps(failures[-1]),flush=True)
    order={s['id']:i for i,s in enumerate(plan)};works.sort(key=lambda w:order[w['id']])
    (QA/'staged-works.json').write_text(json.dumps(works,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');(QA/'failures.json').write_text(json.dumps(failures,ensure_ascii=False,indent=2),encoding='utf-8')
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
    for sheet_index in range(math.ceil(len(works)/8)):
        sheet=Image.new('RGB',(1600,1000),'white');draw=ImageDraw.Draw(sheet)
        for index,work in enumerate(works[sheet_index*8:sheet_index*8+8]):
            im=Image.open(SITE/work['image']);im.thumbnail((380,405));x=index%4*400;y=index//4*500;sheet.paste(im,(x+(400-im.width)//2,y+8));draw.text((x+8,y+424),work['id'].replace('req-','')[:38],fill='black',font=font);draw.text((x+8,y+452),work.get('viewScope','whole-work'),fill='black',font=font)
        sheet.save(QA/f'contact-{sheet_index+1}.jpg',quality=92)
    print(json.dumps({'prepared':len(works),'failed':failures,'catalogueChanged':False}),flush=True)
if __name__=='__main__':prepare()
