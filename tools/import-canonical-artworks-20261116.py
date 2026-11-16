"""Prepare local canonical reproductions without touching existing catalogue bytes."""
from pathlib import Path
import importlib.util,json,sys,hashlib,time,math
from concurrent.futures import ThreadPoolExecutor,as_completed
from PIL import Image,ImageDraw,ImageFont
if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'public/art-atlas';QA=ROOT/'qa-output/canonical-20261116';OUT=SITE/'assets/canonical-20261116'
spec=importlib.util.spec_from_file_location('required_import_helpers',ROOT/'tools/import-required-artworks-20261115.py')
helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)
helpers.QA=QA;helpers.OUT=OUT
QA.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
def prepare():
 plan=json.loads((ROOT/'tools/canonical-artworks-plan-20261116.json').read_text(encoding='utf8'))
 pages={}
 for p in QA.glob('*commons*.json'):
  for item in json.loads(p.read_text(encoding='utf8')).get('query',{}).get('pages',{}).values():
   if item.get('imageinfo'):pages[item['title']]=item
 selected=set(sys.argv[1:])
 existing=json.loads((QA/'staged-works.json').read_text(encoding='utf8'))if selected and (QA/'staged-works.json').exists()else[]
 works=[w for w in existing if w['id']not in selected];failures=[]
 def one(s):
  if s.get('rightsMode')=='cc0-photo-public-domain-work':
   info=pages[s['commonsTitle']]['imageinfo'][0]
   if info.get('extmetadata',{}).get('LicenseShortName',{}).get('value')!='CC0':raise ValueError('CC0 photograph waiver not established')
  w=helpers.prepare_one(s,pages)
  w['featureSemanticVersion']='pending-individual-visual-review'
  w['analysis']['revision']='canonical-candidates-20261116-v1'
  w['curationRole']='canonical-priority';w['curationRoleSource']='Editorial stimulus priority, not visitor liking or measured population recognition.'
  if s.get('dateApproximate'):w['analysis']['dateApproximate']=True
  if s.get('rightsMode')=='cc0-photo-public-domain-work':
   w.update(rights='CC0',rightsUrl='https://creativecommons.org/publicdomain/zero/1.0/')
   w['creditLine']=helpers.plain(pages[s['commonsTitle']]['imageinfo'][0]['extmetadata'].get('Artist',{}).get('value'))+'. '+s['artist']+', '+s['title']+'. Photograph supplied under CC0; historical underlying work separately identified.'
   w['provenance']['reuseStatus']='cc0-photograph-of-public-domain-era-work'
  if s.get('rightsMode')=='institutional-cc0':
   w.update(rights='CC0',rightsUrl='https://www.metmuseum.org/policies/image-resources')
   w['provenance']['reuseStatus']='institutional-cc0-open-access'
  return w
 with ThreadPoolExecutor(max_workers=2)as executor:
  futures={executor.submit(one,s):s for s in plan if not s.get('pending')and(not selected or s['id']in selected)}
  for future in as_completed(futures):
   s=futures[future]
   try:
    w=future.result();works.append(w);print(json.dumps({'ready':w['id'],'size':[w['largeWidth'],w['largeHeight']],'bytes':w['provenance']['largeBytes']}),flush=True)
   except Exception as e:failures.append({'id':s['id'],'error':str(e)});print(json.dumps(failures[-1]),flush=True)
 order={s['id']:i for i,s in enumerate(plan)};works.sort(key=lambda w:order[w['id']])
 (QA/'staged-works.json').write_text(json.dumps(works,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 (QA/'failures.json').write_text(json.dumps(failures,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
 for sheet_index in range(math.ceil(len(works)/8)):
  sheet=Image.new('RGB',(1600,1100),'white');draw=ImageDraw.Draw(sheet)
  for i,w in enumerate(works[sheet_index*8:sheet_index*8+8]):
   im=Image.open(SITE/w['imageLarge']);im.thumbnail((384,440));x=i%4*400;y=i//4*550
   sheet.paste(im,(x+(400-im.width)//2,y));draw.text((x+8,y+455),w['id'].replace('canon-','')[:40],fill='black',font=font);draw.text((x+8,y+483),str(w['largeWidth'])+'x'+str(w['largeHeight']),fill='black',font=font)
  sheet.save(QA/f'contact-{sheet_index+1}.jpg',quality=92)
 print(json.dumps({'ready':len(works),'failed':failures,'pending':[s['id']for s in plan if s.get('pending')],'catalogueChanged':False}),flush=True)
if __name__=='__main__':prepare()
