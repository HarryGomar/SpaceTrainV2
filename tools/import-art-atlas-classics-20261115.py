"""Import the explicitly reviewed eight classic works, leaving existing assets untouched."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import json, urllib.request, urllib.parse, hashlib, io, time, colorsys, math, sys, argparse
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'public/art-atlas'
QA=ROOT/'qa-output/classics-20261115'
OUT=SITE/'assets/classics-20261115'
PLAN=ROOT/'tools/art-atlas-classics-plan-20261115.json'
if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf-8')
def sha(data):return hashlib.sha256(data).hexdigest()
def plain(value):
    import re,html
    return html.unescape(re.sub('<[^>]+>',' ',value or '')).strip()
def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'ArtAtlas/1.0 (public-domain artwork collection and source verification)'})
    with urllib.request.urlopen(req,timeout=45) as response:return response.read(),response.headers.get('Content-Type','')
def palette(image):
    bins=[0]*40;colors=Counter()
    for y in range(64):
        for x in range(64):
            rgb=image.getpixel((round((x+.5)/64*image.width*.88+image.width*.06),round((y+.5)/64*image.height*.88+image.height*.06)))
            hue,sat,val=colorsys.rgb_to_hsv(*(c/255 for c in rgb))
            index=36+min(3,math.floor(val*4)) if sat<.18 else min(11,math.floor(hue*12))*3+min(2,math.floor((sat-.18)/.82*3))
            bins[index]+=1;colors['#'+''.join(f'{math.floor(c/32)*32+16:02x}' for c in rgb)]+=1
    return {'histogram':[round(n/4096,6) for n in bins],'swatches':[c for c,n in colors.most_common(4)],'method':'HSV histogram, 40 bins; 64x64 samples; 6% edge crop'}
def prepare():
    QA.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    plan=json.loads(PLAN.read_text(encoding='utf-8'))
    existing=json.loads((SITE/'artworks.json').read_text(encoding='utf-8'))
    for spec in plan:
        if any(work['id']==spec['id'] for work in existing):raise RuntimeError('Import is append-only; this ID already exists: '+spec['id'])
    params={'action':'query','format':'json','prop':'imageinfo','iiprop':'url|size|extmetadata','iiurlwidth':3840,'iiurlheight':3840,'redirects':1,'titles':'|'.join(spec['commonsTitle'] for spec in plan)}
    data=json.loads(fetch('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params))[0]);(QA/'commons-metadata.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    pages=list(data.get('query',{}).get('pages',{}).values());staged=[]
    for spec in plan:
        page=next((page for page in pages if page['title']==spec['commonsTitle']),None)
        if not page or not page.get('imageinfo'):raise RuntimeError('Missing exact Commons identity '+spec['commonsTitle'])
        info=page['imageinfo'][0];ext=info.get('extmetadata',{})
        license=ext.get('LicenseShortName',{}).get('value');copyrighted=ext.get('Copyrighted',{}).get('value')
        if license!='Public domain' or copyrighted!='False':raise RuntimeError('Individual public-domain reproduction status not verified: '+spec['id'])
        original=info['url'].split('?')[0];thumb=info.get('thumburl',original).split('?')[0]
        source_paths=[thumb,original]
        parts=urllib.parse.urlparse(original).path.split('/');filename=parts[-1]
        for width in [2560,1920]:
            if width<int(info['width']):source_paths.append('https://thumb.wikimedia.org/wikipedia/commons/thumb/'+'/'.join(parts[-3:-1])+'/'+filename+'/'+str(width)+'px-'+filename)
        raw_path=QA/(spec['id']+'-source.jpg');download_url=None
        if raw_path.exists():raw=raw_path.read_bytes();download_url=json.loads((QA/(spec['id']+'-download.json')).read_text())['url']
        else:
            errors=[]
            for url in dict.fromkeys(source_paths):
                try:
                    raw,content_type=fetch(url);im=Image.open(io.BytesIO(raw));im.load()
                    if im.width<500 or im.height<400:raise RuntimeError('Image is too small or not the full reproduction')
                    download_url=url;raw_path.write_bytes(raw);(QA/(spec['id']+'-download.json')).write_text(json.dumps({'url':url,'contentType':content_type}),encoding='utf-8');break
                except Exception as error:errors.append(str(error));time.sleep(.6)
            if not download_url:raise RuntimeError('No verified reproduction '+spec['id']+': '+' | '.join(errors))
        original_image=ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB');source_size=original_image.size
        large_path=OUT/(spec['id']+'-large.jpg');small_path=OUT/(spec['id']+'.jpg')
        if large_path.exists() or small_path.exists():raise RuntimeError('An owned target already exists; verify separately before replacing: '+spec['id'])
        large=original_image.copy();large.thumbnail((3200,3200),Image.Resampling.LANCZOS);large.save(large_path,quality=90,optimize=True)
        for edge in [2400,2000]:
            if large_path.stat().st_size>1000000 and max(large.size)>edge:large=original_image.copy();large.thumbnail((edge,edge),Image.Resampling.LANCZOS);large.save(large_path,quality=90,optimize=True)
        small=original_image.copy();small.thumbnail((800,800),Image.Resampling.LANCZOS);small.save(small_path,quality=88,optimize=True)
        record={key:value for key,value in spec.items() if key not in ['commonsTitle','yearRange','dateApproximate']}
        record.update(image=small_path.relative_to(SITE).as_posix(),imageLarge=large_path.relative_to(SITE).as_posix(),width=small.width,height=small.height,largeWidth=large.width,largeHeight=large.height,imageSourceUrl=download_url,rights='Public domain',rightsUrl=info['descriptionurl']+'#Licensing',creditLine=spec['artist']+'. '+spec['title']+'. '+spec['museum']+'. Faithful public-domain reproduction via Wikimedia Commons.',sourceId=page['pageid'],sourceStatus='source-verified',artistKnown=True,coreQuiz=False,decorativeOnly=False,studyEligible=True,recognitionTier='landmark',recognitionTierSource='Editorial curation for stimulus selection; not a population familiarity measure.',featureSemanticVersion='literal-action-setting-v1',featureQuality='provisional_manual',countrySource='Editorial artist-practice/cultural-tradition grouping, not a verified place of execution or a viewer trait.',movementSource='Editorial art-historical grouping informed by the linked institutional artist and object records; not a measured visual attribute.',analysis={'revision':'gallery-descriptors-v1','yearRange':spec['yearRange'],'dateApproximate':bool(spec.get('dateApproximate')),'yearRangeSource':spec['sourceUrl'],'yearRangeBasis':'Closed institutional catalogue date or date range; approximate point years remain approximate, not confidence intervals.','movementKey':spec['movement'].lower(),'palette':palette(small)})
        record['sha256']=sha(small_path.read_bytes());record['bytes']=small_path.stat().st_size
        record['provenance']={'provider':'Wikimedia Commons faithful public-domain reproduction','recordUrl':info['descriptionurl'],'metadataUrl':info['descriptionurl'],'institutionRecordUrl':spec['sourceUrl'],'sourceFileTitle':page['title'],'commonsPageId':page['pageid'],'originalImageUrl':original,'downloadUrl':download_url,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'metadataArtist':plain(ext.get('Artist',{}).get('value')),'metadataDate':plain(ext.get('DateTimeOriginal',{}).get('value')),'metadataObjectName':plain(ext.get('ObjectName',{}).get('value')),'licenseMetadata':{key:ext[key]['value'] for key in ['LicenseShortName','Copyrighted','AttributionRequired','License','UsageTerms','Credit'] if key in ext},'sourceRightsStatement':'The individually linked Commons file records a faithful public-domain reproduction. Museum photographic terms are separate and are not relabelled CC0.','reuseStatus':'public-domain-faithful-reproduction','sourceImageSha256':sha(raw),'sourceImageBytes':len(raw),'downloadedWidth':source_size[0],'downloadedHeight':source_size[1],'originalFileWidth':info['width'],'originalFileHeight':info['height'],'largeSha256':sha(large_path.read_bytes()),'thumbnailSha256':record['sha256'],'largeBytes':large_path.stat().st_size,'thumbnailBytes':record['bytes'],'transformation':'EXIF orientation respected; whole reproduction and aspect ratio retained. Preview maximum 800px JPEG quality 88; large maximum 3200px JPEG quality 90, reduced to 2400/2000px for a 1MB budget when needed. No upscaling or invented pixels.'}
        staged.append(record);print(json.dumps({'ready':spec['id'],'large':[large.width,large.height],'small':[small.width,small.height],'bytes':record['provenance']['largeBytes']}),flush=True);time.sleep(.8)
    (QA/'staged-works.json').write_text(json.dumps(staged,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    sheet=Image.new('RGB',(1600,900),'white');draw=ImageDraw.Draw(sheet);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
    for index,work in enumerate(staged):
        image=Image.open(SITE/work['image']);image.thumbnail((380,375),Image.Resampling.LANCZOS);x=(index%4)*400;y=(index//4)*450;sheet.paste(image,(x+(400-image.width)//2,y+10));draw.text((x+8,y+390),work['id'].replace('add-','')[:34],fill='black',font=font);draw.text((x+8,y+417),work['date'],fill='black',font=font)
    sheet.save(QA/'classics-contact.jpg',quality=92)
    print('Prepared 8 real reproductions; catalogue is unchanged pending visual review.',flush=True)
def append():
    plan=json.loads(PLAN.read_text(encoding='utf-8'));by_id={spec['id']:spec for spec in plan};staged=json.loads((QA/'staged-works.json').read_text(encoding='utf-8'));works=json.loads((SITE/'artworks.json').read_text(encoding='utf-8'));before=sha((SITE/'artworks.json').read_bytes())
    for record in staged:
        spec=by_id[record['id']]
        if 'features' not in spec or set(spec['features'])!={'abstraction','energy','complexity','humanity','narrative','atmosphere','color'}:raise RuntimeError('Actual-image feature review missing for '+record['id'])
        if any(work['id']==record['id'] or work.get('sourceUrl')==record['sourceUrl'] for work in works):raise RuntimeError('Duplicate ID or source identity: '+record['id'])
        record['features']=spec['features'];record['featureSource']='Manual provisional editorial annotations after inspection of the actual local reproduction. Narrative means depicted action; atmosphere means emphasis on setting. These are not psychometric measurements, participant emotions or causes of a preference.';record['featureReviewReason']=spec['featureReviewReason'];record['provenance']['visualReview']='Actual local reproduction inspected before annotation and catalogue append.'
        works.append(record)
    if sha((SITE/'artworks.json').read_bytes())!=before:raise RuntimeError('Catalogue changed during preparation; no overwrite was made.')
    target=SITE/'artworks.json';temporary=target.with_suffix('.classics-tmp.json');temporary.write_text(json.dumps(works,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temporary.replace(target)
    (QA/'appended-work-ids.json').write_text(json.dumps([work['id'] for work in staged]),encoding='utf-8');print('Appended 8 reviewed works; catalogue total '+str(len(works)))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['prepare','append']);args=parser.parse_args();prepare() if args.phase=='prepare' else append()
