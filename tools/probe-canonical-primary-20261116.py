from pathlib import Path
import urllib.request,json,re,html,sys
if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf8')
QA=Path(__file__).resolve().parents[1]/'qa-output/canonical-20261116'
URLS={
 'malba':'https://s3-sa-east-1.amazonaws.com/malba/wp-content/uploads/2020/03/Cuadernillo-Remedios-Varo.pdf',
 'wendi':'https://gallerywendinorris.com/exhibitions/83-remedios-varo-indelible-fables/',
 'mna':'https://mna.inah.gob.mx/historia_detalle.php?id=3',
 'two-fridas':'https://artsandculture.google.com/asset/the-two-fridas-frida-kahlo/zAHG4EZ1WrwVYg',
 'broken-column':'https://artsandculture.google.com/asset/the-broken-column/EgGMbMFBQrAe3Q',
 'femsa':'https://coleccionfemsa.com/',
 'met-melencolia':'https://collectionapi.metmuseum.org/public/collection/v1/objects/336228',
 'louvre-sardanapalus':'https://collections.louvre.fr/ark:/53355/cl010065757',
 'nmwa-call':'https://nmwa.org/art/collection/la-llamada-call/',
 'femsa-search':'https://coleccionfemsa.com/wp-json/wp/v2/search?search=Papilla&per_page=20',
 'femsa-search-html':'https://coleccionfemsa.com/?s=Papilla',
 'malba-essay':'https://s3-sa-east-1.amazonaws.com/malba/wp-content/uploads/2020/03/Victoria-Cirlot-Varo-Recuerda.pdf',
 'wendi-release':'https://gallerywendinorris.com/usr/documents/exhibitions/press_release_url/83/indelible-fables-media-alert-final.pdf',
 'wendi-publication':'https://gallerywendinorris.com/publications/17/',
 'inah-dualidad':'https://www.inah.gob.mx/boletines/el-museo-nacional-de-antropologia-celebra-60-aniversario-con-brios-fortalecidos-en-su-mision-divulgativa',
 'commons-exact':'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=3200&titles=File%3AMichelangelo%20-%20Creation%20of%20Adam.jpg%7CFile%3AMichelangelo%2C%20Creation%20of%20Adam%2006.jpg%7CFile%3AThe%20Temptation%20of%20Saint%20Anthony%2C%20ca.%201495-1515.jpg%7CFile%3AHieronymus%20Bosch%20051.jpg',
 'commons-exact-2':'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=3200&titles=File%3AMichelangelo%20-%20Creation%20of%20Adam%20%28cropped%29.jpg%7CFile%3ATemptation%20of%20Saint%20Anthony.jpg',
 'wendi-creation':'https://gallerywendinorris.com/news/16-hyperallergic-remedios-varo-in-a-sphere-of/',
 'wendi-strange':'https://gallerywendinorris.com/news/20-hyperallergic-remedios-varos-strange-and-mysterious-universes-in-varos-work-there-is-often-a-sense/',
 'dolores':'https://museodoloresolmedo.org.mx/',
 'femsa-papilla':'https://coleccionfemsa.com/obra/papilla-estelar/',
 'femsa-varo':'https://coleccionfemsa.com/artistas/remedios-varo/',
 'femsa-varo-inverted':'https://coleccionfemsa.com/artistas/varo-remedios/',
 'femsa-artists':'https://coleccionfemsa.com/artistas/',
}
if __name__=='__main__':
 if '--links' in sys.argv:
  from bs4 import BeautifulSoup
  for name in ['femsa','femsa-search-html','wendi-publication','dolores']:
   p=QA/(name+'.source')
   if not p.exists():continue
   s=BeautifulSoup(p.read_text(encoding='utf8'), 'html.parser')
   print(name,list(dict.fromkeys(a.get('href')for a in s.find_all('a',href=True)if any(t in str(a).lower()for t in ['colec','acervo','varo','frida','artista','papilla','mantle']))),flush=True)
  sys.exit(0)
 if '--images' in sys.argv:
  for name in ['wendi-creation','wendi-strange','inah-dualidad','wendi-release','femsa-search-html']:
   p=QA/(name+'.source')
   if not p.exists():continue
   text=p.read_text(encoding='utf8',errors='ignore')
   paths=re.findall(r'(?:https?://|/)[^\s<>"\']+\.(?:jpe?g|png)',text,re.I)
   unique={x.split('/usr/')[-1].split('/wp-content/')[-1].split('/images/')[-1]:html.unescape(x)for x in paths}
   print(name,list(unique.values()),flush=True)
  sys.exit(0)
 if '--inspect' in sys.argv:
  from pypdf import PdfReader
  from PIL import Image
  import io
  r=PdfReader(QA/'malba.source')
  for i,p in enumerate(r.pages):print('MALBA page',i+1,[(x.name,Image.open(io.BytesIO(x.data)).size)for x in p.images],flush=True)
  text=(QA/'wendi.source').read_text(encoding='utf8')
  print('Wendi documents',re.findall(r'href=["\']([^"\']+(?:pdf|publications)[^"\']*)["\']',text))
  sys.exit(0)
 for key in sys.argv[1:]or URLS:
  url=URLS[key];file=QA/(key+'.source')
  try:
   if not file.exists():
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ArtAtlas/1.0 (institutional source research)'}),timeout=30)as r:raw=r.read()
    file.write_bytes(raw)
   raw=file.read_bytes();text=raw.decode('utf8','ignore')
   images=list(dict.fromkeys(html.unescape(x).replace('\\u003d','=') for x in re.findall(r'https?[^\s<>"\\]+(?:\.jpg|\.png|googleusercontent.com[^\s<>"\\]+)',text)))
   print(json.dumps({'key':key,'bytes':len(raw),'images':images[:16],'relativeImages':re.findall(r'(?:src|data-src)=["\']([^"\']+)["\']',text)[:12]},ensure_ascii=False),flush=True)
  except Exception as e:print(json.dumps({'key':key,'error':str(e)}),flush=True)
