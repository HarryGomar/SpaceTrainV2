# Classic paintings and reviewed content tags

Eight paintings extend the study catalogue from 156 to 164 works. The opening keeps its 255 decorative records, giving 419 distinct local preview images. Existing artwork IDs, image bytes and seven numeric descriptors were preserved. Current artwork objects receive the new optional content annotations described below.

## New reproductions

The institutional links establish object identity and catalogue dates. Each individually linked Wikimedia Commons file separately records a faithful public-domain reproduction. No museum photograph has been relabelled CC0. The complete Commons file identity, original source URL, downloaded dimensions, licence fields and SHA256 values are in each new artwork's provenance.

| Work | Institutional record | Why it belongs in a comparison |
| --- | --- | --- |
| Caravaggio, Judith Beheading Holofernes, about 1599 | [Barberini catalogue](https://barberinicorsini.org/wp-content/uploads/2021/11/2021_12_Barberini_Giuditta_CartellaStampa.pdf) | Compressed foreground action and selective light alongside other depictions of physical conflict. |
| Caravaggio, The Supper at Emmaus, 1601 | [National Gallery](https://www.nationalgallery.org.uk/paintings/michelangelo-merisi-da-caravaggio-the-supper-at-emmaus) | Gestures and ordinary table objects carry a story within a shallow room. This is the London version. |
| Caravaggio, The Taking of Christ, 1602 | [National Gallery of Ireland](https://onlinecollection.nationalgallery.ie/objects/2882/the-taking-of-christ) | An interlocked group and directional illumination provide another treatment of close bodily action. |
| Pieter Bruegel the Elder, The Triumph of Death, 1562–63 | [Prado](https://www.museodelprado.es/en/the-collection/art-work/the-triumph-of-death/d3d82b0b-9bf2-4082-ab04-66ed53196ccc) | Many separate incidents across deep terrain extend the existing Bosch comparison without equating density with liking. |
| Diego Velázquez, The Spinners, or The Fable of Arachne, 1655–60 | [Prado](https://www.museodelprado.es/en/the-collection/art-work/the-spinners-or-the-fable-of-arachne/3d8e510d-2acf-4efb-af0c-8ffd665acd8d) | Foreground work and a second rear scene support a comparison of layered rooms with Las Meninas. The reproduction retains the canvas's later edge additions. |
| Jan van Eyck, The Arnolfini Portrait, 1434 | [National Gallery](https://www.nationalgallery.org.uk/paintings/jan-van-eyck-the-arnolfini-portrait) | Small domestic objects and a mirror supply clues around restrained figures. |
| Pierre-Auguste Renoir, Luncheon of the Boating Party, 1880–81 | [Phillips Collection](https://www.phillipscollection.org/collection/luncheon-boating-party) | A daylight social group and numerous objects broaden the treatments of human activity. |
| Franz Marc, Animal Destinies, 1913 | [Kunstmuseum Basel](https://kunstmuseumbasel.ch/de/museum/blog/2020/5) | Recognisable animals and forest remain within fractured angular planes, bridging figurative scenes and abstraction. |

Preview images have a maximum edge of 800 pixels. The corresponding large JPEGs have edges between 2000 and 2732 pixels. Larger originals were downsampled with their aspect ratios retained; no image was enlarged or generated. The 16 preview/detail files total approximately 7.5MB. Detailed source and final hashes are recorded in the catalogue. A contact sheet and source-download evidence remain in the ignored QA directory.

The importer is append-only. It rejects existing target assets, duplicate identities and concurrent catalogue changes. Preparation and catalogue append are separate phases so the actual reproductions can be inspected before their provisional seven descriptors are accepted. Those descriptors retain the literal meanings of depicted action and emphasis on setting.

## Eight optional content tags

The review covers 56 current reproductions, including the eight additions and a mix of detailed scenes, close figures, landscapes, Mexican work and abstract contrasts. The public definition file is `public/art-atlas/curated-facets.json`. Its definitions deliberately distinguish story clues from visual density, dramatic illumination from a dark palette, physical fantasy from expressive style, and bodily gestures from brush marks.

Each reviewed current object embeds:

```js
analysis.curatorialFacets = {
  version: 'curatorial-facets-v1',
  reviewed: true,
  tags: ['narrative-detail', 'layered-space'],
  sourceUrls: ['https://institution.example/object'],
  reviewedImage: 'assets/example.jpg',
  reviewedImageSha256: '...',
  reviewReason: 'A description of visible evidence.'
};
```

The vocabulary is narrative-detail, imagined-world, dramatic-light, layered-space, geometric-structure, visible-gesture, intimate-figures and landscape. Definitions and exclusions are authoritative for this revision. Tags are nonexclusive editorial judgements about these reproductions. They have not been validated through an independent rating study and cannot explain why a viewer prefers an artwork by themselves.

A missing or differently versioned annotation is unknown. An explicitly reviewed empty tag array means that this finite vocabulary did not receive an assignment. Pollock's Convergence and Kandinsky's Composition VII have empty arrays; their interlaced marks are not automatically regular geometric structure. Empty tags do not mean that a painting has no content or meaning.

Use the embedded annotation on the captured artwork object when analysing a saved study. Do not attach current tags to an archived object by ID. Each annotation binds the reviewed preview path and actual image SHA256. Current sidecar definitions document the vocabulary; they are not a way to rewrite historical source metadata.

## Gallery consistency

The fresh Paintings page derives its proposal from `journeyCurationNotes(works)`, the same current curation function as the journey. It therefore shows the actual 18 four-painting main comparisons and the 46/46 later pools for the 164-work catalogue. Passing explicit older notes to the gallery model still preserves their 72/42/42 proposal on the original 156-work catalogue. Answered historical sets continue to use their own captured metadata.

Focused tests verify all 16 JPEG dimensions and hashes, unique source identity, individual rights metadata, no upscaling, the original 40-bin palette definition, all 56 embedded reviews, unknown semantics and the fresh gallery's agreement with actual v10 question bindings.
