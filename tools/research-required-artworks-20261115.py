"""Cache public source metadata for the bounded required-artwork import."""
from pathlib import Path
import urllib.request, urllib.parse, json, time, sys
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
QA=ROOT/'qa-output/required-20261115'
QA.mkdir(parents=True,exist_ok=True)
def fetch(url):
    request=urllib.request.Request(url,headers={'User-Agent':'ArtAtlas/1.0 source verification (museum artwork prototype)'})
    with urllib.request.urlopen(request,timeout=50) as response:return response.read()
def commons_search(query):
    params={'action':'query','format':'json','generator':'search','gsrsearch':query,'gsrnamespace':6,'gsrlimit':6,'prop':'imageinfo','iiprop':'url|size|extmetadata','iiurlwidth':3200}
    return json.loads(fetch('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)))
QUERIES={
 'david':'Caravaggio David Goliath Borghese',
 'temptations':'Patinir Massys Temptations Anthony',
 'hearing':'Brueghel Rubens Hearing Prado',
 'smell':'Brueghel Rubens Smell Prado',
 'taste':'Brueghel Rubens Taste Prado',
 'touch':'Brueghel Rubens Touch Prado',
 'dore-library':'Dore Quixote library',
 'rivera-universe':'Rivera hombre controlador universo',
 'rivera-alameda':'Rivera Sueno tarde dominical Alameda',
 'rivera-history':'Rivera History Mexico National Palace mural',
 'siqueiros-democracy':'Siqueiros Nueva Democracia',
 'siqueiros-bourgeoisie':'Siqueiros Retrato burguesia',
 'siqueiros-march':'Siqueiros Marcha humanidad',
 'orozco-prometheus':'Orozco Prometheus Pomona',
 'orozco-fire':'Orozco Hombre Fuego',
 'orozco-cortes':'Orozco Cortes Malinche',
}
if __name__=='__main__':
    keys=sys.argv[1:] or list(QUERIES)
    for key in keys:
        path=QA/(key+'-commons-search.json')
        try:
            data=json.loads(path.read_text(encoding='utf-8')) if path.exists() else commons_search(QUERIES[key])
            path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
            summaries=[]
            for page in data.get('query',{}).get('pages',{}).values():
                info=page.get('imageinfo',[{}])[0];ext=info.get('extmetadata',{})
                summaries.append({'title':page['title'],'size':[info.get('width'),info.get('height')], 'url':info.get('url'),'license':ext.get('LicenseShortName',{}).get('value'),'copyrighted':ext.get('Copyrighted',{}).get('value'),'source':ext.get('Credit',{}).get('value','')[:120]})
            print(json.dumps({'key':key,'results':summaries},ensure_ascii=False),flush=True)
        except Exception as error: print(json.dumps({'key':key,'error':str(error)}),flush=True)
        time.sleep(.6)
