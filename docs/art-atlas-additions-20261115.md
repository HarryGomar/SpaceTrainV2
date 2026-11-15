# Reviewed collection additions — 15 November 2026

The import contains **57 real artworks**, bringing the study catalogue from 99 to 156 after integration. The existing 99 and the 255 opening-cloud records were not rewritten by this import. The new images occupy 32,120,845bytes, including 640px previews and separate larger reproductions.

## What is ready

- Import: [`public/art-atlas/collection-additions-20261115.json`](../public/art-atlas/collection-additions-20261115.json).
- Local images: [`public/art-atlas/assets/collection-20261115/`](../public/art-atlas/assets/collection-20261115/).
- Actual-image contact sheets: [1](art-atlas-additions-20261115/contact-1.jpg), [2](art-atlas-additions-20261115/contact-2.jpg), [3](art-atlas-additions-20261115/contact-3.jpg).
- Machine-readable [coverage and source audit](art-atlas-additions-20261115/coverage-audit.json).
- [Candidate plan](../tools/art-atlas-additions-plan-20261115.json), [manual review](../tools/art-atlas-additions-review-20261115.json), and [source importer](../tools/art-atlas-collection-20261115.py).

There are 25 works from Mexican practices across 12 artists: Varo, Gerzso, Izquierdo, Tamayo, Dr. Atl, Rivera, Orozco, Siqueiros, Carrington, Mérida, Paalen and Kahlo. This groups artistic practice rather than nationality. Varo's Spanish birth, Carrington's British birth and Mérida's Guatemalan birth remain explicit. Rivera's Paris-painted *Zapatista Landscape* and Detroit-painted Kahlo work are not presented as paintings executed in Mexico.

The verified Varo works are *Harmony*, *Sympathy*, the open state of *Icon*, and *Weaving of Space and Time*. The closed state of *Icon* is not counted as another work. NMWA's own [collection labels](https://nmwa.org/gallery-labels-uncanny/) supply the latter work's 1954 date and oil-on-Masonite medium; its shorter Google record omitted those facts.

Tate's 1886 *Hope* is attributed to **George Frederic Watts and assistants**. It is distinguished from the earlier version. Its object identity and public-domain reproduction context are documented by [Tate](https://www.tate.org.uk/art/artworks/watts-hope-n 01640) and the [Commons object/rights record](https://commons.wikimedia.org/wiki/File:Assistants_and_George_Frederic_Watts_-_Hope_-_Google_Art_Project.jpg).

## Coverage rather than artist stereotypes

All seven feature values were assigned after inspecting the actual downloaded reproductions. They remain provisional editorial annotations. In particular, narrative means depicted action, setting means emphasis on a depicted setting, and visual activity does not mean felt arousal.

| Coverage in the additions | Works |
| --- | ---: |
| High abstraction, value≥.75 |29|
| High abstraction and sparse, complexity≤.25 |6|
| High abstraction and dense, complexity≥.75 |10|
| Representational or lightly stylized, abstraction≤.35, and sparse |5|
| Sparse overall, complexity≤.25 |8|
| Little emphasis on a depicted setting, setting≤.25 |36|

The six sparse abstractions include broad geometry and colour fields; dense alternatives include Kandinsky, Mondrian's *Composition 10*, Klee, Pollock, Thomas and Krasner. Sparse representational alternatives include a Rivera portrait, Hammershøi, Morandi, Kahlo's masked child and *Hope*. Hilma af Klint's 1933 *Untitled* is correctly annotated as a prominent human profile, unlike her nonfigurative *Dove No.2*.

The combined 156 remain uneven: only 12 have complexity≤.25, compared with 68 at≥.75. This expansion improves that gap; it does not establish a balanced or representative sample of world art. Mexican practice here is principally twentieth-century modernism, muralism and Surrealism, not a survey of every Mexican tradition.

## Image quality and credits

The usual larger Google institution rendition was requested at `=w3200`. Most supplied objects still returned 1200px on the long side. Those available pixels were retained without artificial enlargement. The preview and large-image dimensions and hashes describe the actual files.

Several expired cached image links were replaced using primary institutional sources:

| Work | Primary reproduction | Hosted larger pixels |
| --- | --- | ---: |
| Herrera, *Cobalto y Blanco* | [CIFO/Ella Fontanals-Cisneros](https://www.cifo.org/mac-exhibitions/the-forms-of-silence%3A-carmen-herrera%2C-abstract-works-1948%E2%80%931987-) |1972×2800|
| Krasner, *Icarus* | [Barbican](https://www.barbican.org.uk/s/introducingleekrasner/), Thomson Family Collection; photo Diego Flores |2560×1707|
| Dalí, *The Transparent Simulacrum of the Feigned Image* | [Buffalo AKG](https://buffaloakg.org/artworks/196693-transparent-simulacrum-feigned-image) |2500×1950|
| Newman, *Prometheus Bound* | [Museum Folkwang's isolated work illustration](https://www.museum-folkwang.de/de/podcast/kunst-als-fremdsprache-ii) |400×1056|

Newman's source is a genuine but limited-resolution reproduction. It is explicitly flagged; it was not sharpened or enlarged to manufacture detail. The remaining small-resolution or unsuitable candidates are absent from the deployable image directory.

**This is not an open-license image pack.** Per-source copyright statements, credits, source URLs and `reuseStatus:'permission-not-established'` are preserved. Many works remain protected or have no open reproduction license stated. The Dalí primary source specifies educational downloads; other purposes require permission. *Hope* is a public-domain underlying work, with the Tate digital-reproduction claim recorded separately. No work is automatically markedCC0. A named institution may be a record provider or collection source; the data does not promise current display.

## Excluded and unfulfilled works

Of the 66 planned candidates, nine were excluded:

- Carrington's *Crow Soup*: only 402×306 pixels available.
- Orozco's *Prometheus*: the reproduction includes substantial architecture outside the fresco.
- Albers's *Still Remembered*: cached image expired; the replacement Mart page explicitly excludes publication without separate permission.
- Albers's *Sonorous*, Rothko's *No.5*, Magritte's *Presence of Mind*, Ernst's *The Forest*, Hammershøi's Getty easel interior, and Morandi's 1935 still life: no suitable verified replacement image acquired during this pass.

The two downloaded rejected reproductions are preserved under `docs/art-atlas-additions-20261115/excluded-assets/`, outside the deployable app. Reasons are also in [excluded-candidates.json](art-atlas-additions-20261115/excluded-candidates.json).

Varo's *The Juggler*, *Creation of the Birds*, and *Bankers in Action* were researched but are **not included**. Their source-image requirements remain unresolved; none of the four other Varo works substitutes under those identities.

## Verification and replay

```powershell
py -3.10 tools/art-atlas-collection-20261115.py stage
py -3.10 tools/art-atlas-collection-20261115.py finalize
py -3.10 tools/art-atlas-collection-20261115.py audit
node --test tests/art-atlas/collection-additions-20261115.test.mjs
```

The8 focused tests pass. Pillow verifies all 114 hosted JPEGs. Tests check dimensions, complete JPEG markers, bytes, source-bound hashes, explicit rights/unknown facts, useful feature contrasts, compatible 40-bin palettes, and the large-image resolver. The audit finds no normalized title-and-artist, source-ID, source-URL or exact-image-hash collision against all 354 previous records. No user answers, stored sessions, live source catalogue or deployment were changed by this importer.

The HSV sampling reproduces the existing 40-bin definition,64×64 rounded pixel-centres,6% edge crop and saturation/value rules. Source date strings are retained. Unknown dates stay null. The one circa interval is explicitly identified as an editorial±2-year display interval, not closed bounds supplied by the museum.
