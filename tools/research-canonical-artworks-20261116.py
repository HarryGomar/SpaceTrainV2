"""Cache public Commons file metadata for reviewed canonical gaps, never label by artist."""
from pathlib import Path
import urllib.request, urllib.parse, json, time, sys
if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
QA=ROOT/'qa-output/canonical-20261116'
QA.mkdir(parents=True,exist_ok=True)
QUERIES={
 'caravaggio-calling-matthew':'Caravaggio Calling Saint Matthew painting',
 'caravaggio-entombment':'Caravaggio Entombment Vatican painting',
 'caravaggio-bacchus':'Caravaggio Bacchus Uffizi',
 'caravaggio-medusa':'Caravaggio Medusa Uffizi',
 'leonardo-last-supper':'Leonardo Last Supper restored painting',
 'michelangelo-creation-adam':'Michelangelo Creation Adam restored',
 'bosch-temptations-lisbon':'Bosch Temptation Anthony Lisbon triptych',
 'bruegel-tower-babel':'Bruegel Tower Babel Vienna',
 'bruegel-netherlandish-proverbs':'Bruegel Netherlandish Proverbs',
 'goya-third-may':'Goya Third May 1808',
 'velazquez-breda':'Velazquez Surrender Breda',
 'rembrandt-prodigal-son':'Rembrandt Return Prodigal Son',
 'holbein-dead-christ':'Holbein Body Dead Christ Tomb Basel',
 'durer-melencolia':'Durer Melencolia I engraving',
 'delacroix-sardanapalus':'Delacroix Death Sardanapalus Louvre',
 'ingres-odalisque':'Ingres Grande Odalisque Louvre',
 'bocklin-isle-dead':'Bocklin Isle Dead 1880 Basel',
 'siqueiros-echo-scream':'Siqueiros Echo Scream',
 'siqueiros-collective-suicide':'Siqueiros Collective Suicide',
 'varo-creation-birds':'Varo Creacion aves',
 'varo-embroidering-mantle':'Varo Bordando manto terrestre',
 'varo-celestial-pabulum':'Varo Papilla estelar',
 'kahlo-two-fridas':'Frida Kahlo Dos Fridas painting',
 'kahlo-broken-column':'Frida Kahlo Broken Column painting',
 'tamayo-dualidad':'Tamayo Dualidad mural',
 'creation-selected':'intitle:"Creation of Adam" filetype:bitmap',
 'bosch-selected':'Bosch Anthony -intitle:detail filetype:bitmap',
}
def fetch(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ArtAtlas/1.0 (museum collection source verification)'}),timeout=50)as r:return r.read()
def search(query):
 p={'action':'query','format':'json','generator':'search','gsrsearch':query,'gsrnamespace':6,'gsrlimit':5,'prop':'imageinfo','iiprop':'url|size|extmetadata','iiurlwidth':3200}
 return json.loads(fetch('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(p)))
if __name__=='__main__':
 for key in sys.argv[1:]or QUERIES:
  file=QA/(key+'-commons.json')
  try:
   data=json.loads(file.read_text(encoding='utf-8'))if file.exists()else search(QUERIES[key])
   file.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
   out=[]
   for p in data.get('query',{}).get('pages',{}).values():
    i=p.get('imageinfo',[{}])[0];e=i.get('extmetadata',{})
    out.append({'title':p['title'],'size':[i.get('width'),i.get('height')],'license':e.get('LicenseShortName',{}).get('value'),'copyrighted':e.get('Copyrighted',{}).get('value')})
   print(json.dumps({'key':key,'results':out},ensure_ascii=False),flush=True)
  except Exception as e:print(json.dumps({'key':key,'error':str(e)}),flush=True)
  time.sleep(.6)
