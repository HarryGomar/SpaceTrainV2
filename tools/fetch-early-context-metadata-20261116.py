"""Cache primary CMA metadata for the bounded early-context gap review."""
import json
import pathlib
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "qa-output" / "early-context-20261116"
OUT.mkdir(parents=True, exist_ok=True)
works = {work["id"]: work for work in json.loads((ROOT / "public/art-atlas/artworks.json").read_text(encoding="utf-8"))}
ids = json.loads((ROOT / "qa-output/context-gaps-20261116.json").read_text(encoding="utf-8"))["ids"]
for work_id in ids:
    work = works[work_id]
    if not work["sourceUrl"].startswith("https://clevelandart.org/art/"):
        continue
    accession = work["sourceUrl"].split("/art/")[1]
    url = "https://openaccess-api.clevelandart.org/api/artworks/?" + urllib.parse.urlencode({"accession_number": accession, "limit": 10})
    request = urllib.request.Request(url, headers={"User-Agent": "ArtAtlasContextResearch/1.0", "Accept": "application/json"})
    cached = OUT / (work_id + ".json")
    if cached.exists():
        result = json.loads(cached.read_text(encoding="utf-8"))
    else:
        with urllib.request.urlopen(request, timeout=25) as response:
            assert response.status == 200
            result = json.load(response)
        cached.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        time.sleep(0.3)
    matches = [record for record in result["data"] if record["accession_number"] == accession]
    assert len(matches) == 1, (work_id, accession)
    record = matches[0]
    keys = ["id", "accession_number", "title", "creation_date", "creation_date_earliest", "creation_date_latest", "technique", "culture", "type", "creators", "description", "fun_fact", "current_location"]
    print(json.dumps({"workId": work_id, "apiUrl": url, **{key: record.get(key) for key in keys}}, ensure_ascii=False))
