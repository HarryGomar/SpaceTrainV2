"""Apply the recorded editorial review to current catalogue objects only."""
from pathlib import Path
import hashlib, json

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'public/art-atlas'
VERSION = 'curatorial-facets-v1'
DEFINITIONS = {
    'narrative-detail': {
        'label': 'Story clues',
        'definition': 'Secondary incidents, objects or relationships offer clues beyond the focal pose. A sparse symbolic image can qualify.',
        'excludes': 'Visual busyness alone, a suggestive title alone, or the mere presence of a person.'},
    'imagined-world': {
        'label': 'Imagined worlds',
        'definition': 'Visibly fantastical or physically uncanny bodies, objects or settings appear in the reproduction.',
        'excludes': 'Religious or historical subject matter alone, unusual colour, or expressive distortion alone.'},
    'dramatic-light': {
        'label': 'Dramatic light',
        'definition': 'Strong selective illumination and deep shadow materially stage the subject or setting.',
        'excludes': 'A dark palette alone, presumed mood, or ordinary diffuse daylight.'},
    'layered-space': {
        'label': 'Layers of space',
        'definition': 'Distinct spatial stages, frames, mirrors, doorways or recessed compartments organise the view.',
        'excludes': 'Any overlap, every use of perspective, or overlapping abstract planes without a readable setting.'},
    'geometric-structure': {
        'label': 'Geometric structure',
        'definition': 'Salient regular shapes, straight lines, grids or clearly shaped colour fields organise the composition.',
        'excludes': 'All abstraction, gestural marks alone, an isolated triangular mountain, or ordinary room perspective.'},
    'visible-gesture': {
        'label': 'Bodily gestures',
        'definition': 'Emphasised reaching, striking, guiding, embracing, carrying or another visible bodily action shapes the image. Quiet hand actions can qualify.',
        'excludes': 'Every posed figure, resting hands, depicted weather, brushwork, or movement inferred only from a title.'},
    'intimate-figures': {
        'label': 'Figures close up',
        'definition': 'A near-view foreground human figure or compact bodily group occupies a substantial part of the view.',
        'excludes': 'A claim about tenderness, sympathy, the viewer\'s feelings, or a broad crowd of small figures.'},
    'landscape': {
        'label': 'Natural settings',
        'definition': 'Substantial recognisable terrain, water or vegetation organises the composition, including some figure scenes.',
        'excludes': 'A tiny natural background strip or window view, a landscape title alone, or a claim about the viewer\'s love of nature.'},
}

# These rows record an actual review of the current local reproductions.
# The short keys are expanded below; they are never part of the public schema.
KEYS = dict(N='narrative-detail', I='imagined-world', D='dramatic-light', S='layered-space',
            G='geometric-structure', V='visible-gesture', F='intimate-figures', L='landscape')
ROWS = [
 ('add-watts-hope','NIVF','The blindfold, lyre and globe supply symbolic clues; the hand action and closely framed body organise the image.'),
 ('velazquez-las-meninas','NDSV','Attendants, the mirror and the open doorway distribute clues across a selectively lit room with several spatial stages.'),
 ('van-gogh-night-cafe','NDS','Lamps illuminate the room, while the billiard table, distant doorway and scattered patrons create depth and secondary clues.'),
 ('goya-saturn','IDVF','A giant grips and bites a body under selective illumination against a nearly empty dark ground.'),
 ('bosch-garden-delights','NISVL','Many bodily incidents and fantastic creatures occupy successive terrain and water zones across the three panels.'),
 ('add-caravaggio-judith-barberini','NDVF','Selective light isolates the attack; the waiting older woman and cloth add clues around the closely framed bodily action.'),
 ('add-caravaggio-supper-emmaus-1601','NDVF','Outstretched arms, table objects and the standing attendant support a compact scene staged through strong light and shadow.'),
 ('add-caravaggio-taking-christ','NDVF','The kiss, restraining hands, fleeing figure and lantern bearer crowd into a selectively lit foreground group.'),
 ('add-bruegel-triumph-death','NISVL','Skeleton armies and many separate incidents spread through successive landscape zones, with repeated physical attacks and impossible bodies.'),
 ('add-velazquez-spinners','NDSV','Working hands occupy the foreground while an illuminated rear scene opens beyond the darker spinning room.'),
 ('add-van-eyck-arnolfini','NSVF','Raised and joined hands, domestic objects and the small mirror organise a close pair within a visibly recessed room.'),
 ('add-renoir-boating-party','NSV','Overlapping conversations and drinking gestures occupy the table and balcony, with an awning and railing creating spatial stages.'),
 ('add-marc-animal-destinies','GVL','Sharp angular planes break across animals, trees and terrain, with the animals\' bodily actions embedded in the fractured natural scene.'),
 ('holbein-ambassadors','NF','The closely framed pair is surrounded by instruments, books and an oblique skull that supply separate visual clues.'),
 ('brueghel-sight','NS','Pictures, instruments and collected objects surround the central figures, while an opening leads into a second spatial zone.'),
 ('millais-ophelia','NFL','The large reclining figure, surrounding flowers and dense streamside vegetation organise the image and provide secondary clues.'),
 ('van-gogh-starry-night','L','The village, hills and sky form a substantial recognisable natural setting despite the strongly stylised brushwork.'),
 ('klimt-kiss','GVF','A close embracing pair is wrapped in conspicuous rectangular and circular patterning, with hands and heads defining the bodily relation.'),
 ('friedrich-wanderer','SL','Near rocks, banks of mist and distant peaks create distinct spatial stages around the stationary back-facing figure.'),
 ('study-hokusai-great-wave','NSL','Boats and their crouching occupants sit between the large foreground wave and distant Fuji, supplying small incidents across depth.'),
 ('study-leonardo-mona-lisa','FL','The close half-length sitter occupies the foreground against a substantial winding terrain and water background.'),
 ('study-vermeer-pearl','DF','Selective illumination isolates a closely framed head and shoulder against a plain dark ground.'),
 ('study-vermeer-milkmaid','NVF','The closely framed pouring action, bread and table objects provide visible bodily action and secondary domestic clues.'),
 ('study-rembrandt-night-watch','NDSV','Selective light separates gesturing figures and scattered incidents at different depths within the broad group.'),
 ('study-botticelli-birth-venus','NIVFL','Winged figures, shell and arriving drapery surround the large central body within a substantial shore and sea setting.'),
 ('study-raphael-school-athens','NSGV','Many distinct bodily gestures and groups occupy successive architectural stages structured by repeated arches and the floor grid.'),
 ('study-waterhouse-shalott','NVFL','The large figure reaches within a boat, while its objects and the wooded riverbank provide setting and secondary clues.'),
 ('study-gericault-raft','NDSVL','Selectively lit bodies and signalling gestures build successive stages across the raft, with sea and sky organising the surrounding setting.'),
 ('study-david-marat','NDF','The close inactive body is selectively lit; the letter, knife and inscribed box supply separate clues around it.'),
 ('study-delacroix-liberty','NDV','Raised arms and weapons lead the crowd, while light separates foreground bodies from the smoky group behind.'),
 ('study-wood-american-gothic','NF','The close posed pair, pitchfork, clothing and house details provide relational clues without an emphatic bodily action.'),
 ('study-kandinsky-composition-eight','G','Circles, straight diagonals and measured angular forms conspicuously organise the nonfigurative composition.'),
 ('add-kandinsky-composition-seven','','Interlaced organic and fractured marks dominate; none of these eight narrowly defined content tags was assigned in this review.'),
 ('add-rothko-orange-yellow','G','Large rectangular colour fields organise the image; the tag describes their shape rather than an emotional response.'),
 ('add-herrera-cobalt-white','G','Clean blue and white angular planes establish the visible geometric structure.'),
 ('add-pollock-convergence','','Interlaced irregular marks dominate; none of these eight narrowly defined content tags was assigned in this review.'),
 ('mondrian-composition','G','Straight black divisions and rectangular colour fields visibly organise the surface.'),
 ('add-malevich-football-player','G','Clearly shaped rectilinear colour forms and diagonals organise the nonfigurative surface.'),
 ('add-af-klint-dove-two','G','Concentric circular forms and measured coloured divisions give the image an explicit geometric organisation.'),
 ('add-varo-harmony','NISV','An active figure, unusual apparatus and figures emerging from walls occupy a room with several readable spatial stages.'),
 ('add-varo-weaving-space-time','NIDSG','A regular enclosing mesh, uncanny central formation and illuminated interior combine physical impossibility with a layered room.'),
 ('add-carrington-dagobert','NISVL','Many unusual bodies and incidents occupy separate architectural and terrain zones, with repeated visible bodily actions.'),
 ('add-siqueiros-madre-nina','VF','The compact foreground adult and child are joined through a visible carrying or supporting action.'),
 ('add-rivera-zapatista-landscape','NG','Angular planes organise recognisable hat, weapon and fabric clues; the small distant mountain strip does not dominate the setting.'),
 ('add-gerzso-water-mansion','G','Sharp-edged coloured planes establish geometric structure without a clearly readable physical room or terrain.'),
 ('velasco-valley-mexico','SL','Near terrain, the broad valley, water and distant mountain ranges organise a succession of natural spatial stages.'),
 ('opening-cma-141639','DSL','An illuminated horizon contrasts with dark foreground silhouettes, while water and successive mountain zones organise the view.'),
 ('monet-water-lilies','L','Water, floating vegetation and reflections occupy the composition without clearly separated foreground and distant spatial stages.'),
 ('study-fan-kuan-travelers','NSL','A small travelling group supplies a local incident beneath successive rock, tree and mountain zones.'),
 ('hokusai-mount-fuji','L','The recognisable mountain and surrounding bands of natural setting organise the print.'),
 ('add-varo-sympathy','NISVF','The close figure and cat interact through uncanny connecting filaments within a room with readable depth.'),
 ('study-matisse-dance','VF','The large compact linked group is defined by extended arms, joined hands and bodily action.'),
 ('opening-cma-92937','DVF','Selective light picks out the two closely framed boxers and their striking bodily actions against the darker crowd.'),
 ('opening-cma-142792','VF','Large closely framed wrestlers organise the scene through their grappling bodies and limbs.'),
 ('add-izquierdo-sorrowful-friday','NS','A central framed head, altar objects and curtains create separate symbolic clues and shallow spatial compartments.'),
 ('opening-cma-169545','NSG','A regular cabinet grid divides recessed compartments containing books and distinct objects with many small visual clues.'),
]

def main():
    path = SITE / 'artworks.json'
    original = path.read_bytes()
    works = json.loads(original)
    by_id = {work['id']: work for work in works}
    if len(by_id) != len(works):
        raise ValueError('Duplicate current work identity')
    missing = [row[0] for row in ROWS if row[0] not in by_id]
    if missing:
        raise ValueError('Reviewed identity missing: ' + ', '.join(missing))
    annotations = []
    for work_id, short_tags, reason in ROWS:
        work = by_id[work_id]
        image_path = SITE / work['image']
        image_sha = hashlib.sha256(image_path.read_bytes()).hexdigest()
        urls = [work['sourceUrl']]
        provenance = work.get('provenance', {})
        for url in [provenance.get('recordUrl'), provenance.get('metadataUrl'), work.get('rightsUrl')]:
            if url and url.startswith('https://') and url not in urls:
                urls.append(url)
        annotation = dict(version=VERSION, reviewed=True, tags=[KEYS[key] for key in short_tags],
                          sourceUrls=urls, reviewedImage=work['image'], reviewedImageSha256=image_sha,
                          reviewReason=reason)
        work.setdefault('analysis', {})['curatorialFacets'] = annotation
        annotations.append(dict(workId=work_id, **annotation))
    output = dict(
        version=VERSION,
        meaning='Provisional editorial descriptions of visible artwork content and composition. These are not measured user emotions, psychological traits or causal explanations of a preference.',
        method='Current local reproductions were inspected in a visual review. Source links identify the artwork and reproduction; the tag assignments and review reasons are editorial annotations.',
        reviewedCount=len(annotations),
        definitions=DEFINITIONS,
        unknownSemantics={
            'missingAnnotation': 'Unknown. Missing or differently versioned annotations must not be interpreted as absent tags or numeric zero.',
            'reviewedEmptyTags': 'Explicitly reviewed, with none of these eight tags assigned. This does not imply an absence of subject, structure or meaning.',
            'negativeEvidence': 'Non-assignment is meaningful only within this finite reviewed vocabulary and reproduction. Tags are nonexclusive editorial judgements.',
            'archivedWorks': 'Use the annotation embedded in the actual captured artwork object. Never attach current sidecar annotations to an archived artwork solely by matching its ID.',
            'identityGuard': 'Each annotation records the exact reviewed local image path and SHA256. A different reproduction or source needs a new review.'},
        annotations=annotations)
    if path.read_bytes() != original:
        raise RuntimeError('Catalogue changed during review; do not overwrite concurrent edits')
    (SITE / 'curated-facets.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    path.write_text(json.dumps(works, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'catalogueWorks': len(works), 'reviewedWorks': len(annotations), 'version': VERSION}))

if __name__ == '__main__':
    main()
