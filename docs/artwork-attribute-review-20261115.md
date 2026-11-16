# Source-bound artwork attributes

The new review describes 96 artworks against 16 visual criteria. It covers all 72 current main-comparison works and 24 later works, including 12 additional recommendation candidates. It changes no artwork ID, image, seven numeric descriptor or earlier `curatorialFacets-v1` annotation.

The goal is to compare treatments across different subjects, dates and catalogue styles. A precise still life and a geometric abstraction can share controlled edges. A Chinese ink landscape and an expressive figure scene can both expose individual marks. A complex crowd and a sparse symbolic image can both offer story clues. Those connections are descriptions to test against actual appeal and admiration responses, not explanations assigned in advance.

## The 16 criteria

The exact definitions, exclusions and negative criteria are in `public/art-atlas/artwork-attribute-definitions.mjs`. It exports `ARTWORK_ATTRIBUTE_VERSION`, `ARTWORK_ATTRIBUTE_DEFINITIONS`, `ARTWORK_ATTRIBUTE_STATUSES` and `ARTWORK_ATTRIBUTE_LIMITS`.

| Key | What was reviewed |
| --- | --- |
| narrative-detail | Secondary incidents, objects or relationships beyond the focal pose. |
| imagined-world | Visibly impossible or uncanny bodies, objects or settings. |
| dramatic-light | Selective illumination and deep shadow staging the subject. |
| layered-space | Distinct physical stages, frames, mirrors or recesses. |
| geometric-structure | Salient regular shapes, divisions, grids or colour fields. |
| visible-gesture | Emphasised bodily actions and active hand gestures. |
| intimate-figures | A nearby human figure or compact bodily group. |
| landscape | A substantial surrounding natural setting. Isolated still-life flowers do not qualify. |
| expressive-distortion | Recognisable forms conspicuously altered in proportion or shape. No stable referent means unknown. |
| precise-rendering | Dominant controlled contours or finely differentiated detail, including graphic geometry. This is not a skill score. |
| visible-paint-marks | Conspicuous strokes, dabs, drips or expressive drawn marks. The display label is Visible mark-making. |
| pattern-rhythm | Repeated motifs, divisions or directional marks producing rhythm. |
| human-relationships | An emphasised visible exchange, touch, shared attention or coordinated action between people. |
| theatrical-staging | Curtains, stage-like framing or an emphatically arranged presented scene. Lighting alone does not qualify. |
| material-detail | Differentiated depicted surfaces, rather than actual paint texture alone. |
| open-expanse | Large relatively uninterrupted fields of sky, water, ground or colour. This does not mean calm. |

The criteria are nonexclusive and partly correlated. Their boundaries depend on the reproduction and editorial judgement. No artist-wide or movement-wide defaults were applied. The annotations have not received independent human rating or psychometric validation.

## Review workflow

The review used the actual local images resolved by `resolveArtworkMedia` with `preferLarge:true`. Eight contact sheets were inspected, covering the 96 works. Individual native-size images were checked where the wider sheet could not resolve a criterion. Source-limited or very dark images retain unknown statuses for unresolved detail. For example, fine marks in the small Hope reproduction remain unknown, and the dark Newman reproduction does not establish precise internal geometry.

Every work was checked against the full 16-item list. The compact observations file explicitly records positive and unresolved criteria after that review. The builder expands the remaining checked criteria into explicit absent statuses using their negative definitions. It never assigns a criterion from the artist, country, title or movement.

Positive and unknown reasons describe particular visible evidence or the reproduction limitation. Negative reasons identify the specific criterion that was not observed at this scale. An absent result concerns this defined treatment; it does not imply that the painting lacks meaning, structure, imagination or artistic value.

The generator is `tools/build-artwork-attribute-reviews-20261115.mjs`. Its source observations are `tools/artwork-attribute-observations-20261115.json`; documentary context is in `tools/artwork-attribute-context-20261115.json`. The generated data is `public/art-atlas/artwork-attribute-reviews.json`.

## Identity and history

Each keyed review has this shape:

```js
reviews[workId] = {
  version: 'artwork-attributes-v1',
  reviewed: true,
  reviewerType: 'assistant-visual-review',
  sourceIdentity: {sourceUrl, image, previewSha256},
  reviewedAsset: {image, sha256, width, height, mediaBinding,
                  compositionMatch: 'same-composition', sourceLimited},
  attributes: {
    'dramatic-light': {
      status: 'present', // or 'absent' or 'unknown'
      reason: 'Visible evidence or an explicit limitation.',
      evidenceKind: 'visual-review'
    }
  },
  sourceUrls: [],
  sourcedContext: [],
  contextStatus: 'not-documented-in-this-review'
};
```

The source identity binds the catalogue's canonical source URL, exact preview path and SHA256 of the actual preview bytes. The reviewed asset separately binds the larger reproduction and its real dimensions. Existing hash aliases were checked against those preview bytes. A source mismatch, missing version or unknown status never supplies a zero or a negative observation.

A current review may accompany an older response only when the original artwork source and reproduction identity are verified. The result must say that it uses a current editorial interpretation. It must not mutate the captured work, question, answer or earlier feature annotation. A mere ID match is insufficient. When a historical capture lacks a hash, the consuming adapter must disclose any reliance on a current verified asset reference.

## Documentary context

Nine works carry short, separately cited museum descriptions of narrative or symbolism. These include Tate's explanation of the lyre in Hope, the National Gallery's treatment of the skull and objects in The Ambassadors, and Cleveland's account of Green Tara's iconography. These notes paraphrase identified primary institutional sources and retain their uncertainty. They are not additional visual attributes or viewer responses.

No documentary note means that symbolism was not documented in this review. It is never a claim that a work has no symbolism. Generic properties such as religion, a fantastical title or membership of an artistic movement cannot substitute for a documented meaning.

Tests validate the 16-field tri-state schema, all 96 source/preview/large hashes and dimensions, source agreement, current 72 coverage and the separation of visual evidence from documentary meaning. Qualitative reliability, observer agreement and predictive usefulness remain to be evaluated.

## Separate contextual metadata

`public/art-atlas/artwork-context-reviews.json` contains the same 96 source-bound identities. It separates institutional object facts, previously imported explicit metadata, inherited catalogue classifications and individually reviewed contextual refinements. The `evidenceKinds` dictionary explains each status. Twenty-two official Cleveland API records were retrieved for this pass.

The layer preserves full reported media, such as drypoint and aquatint for Cassatt's In the Omnibus, and oil, sand and collage for Blanchard's Still Life. Normalised medium families are derived filters. They do not replace the original wording. Missing media, including the physical medium of Madre niña, remain unknown.

Creation place, depicted place, source culture and artist origin remain separate. Cleveland explicitly locates the making of Twilight in the Wilderness in a New York studio while identifying the scene as Maine. The National Gallery places the Sunflowers group in Arles, although the old country grouping says Netherlands. That old label is retained as context rather than promoted to a place-of-creation claim.

Movement labels carry kinds, so a historical movement, a religious tradition, a print format and a visible treatment cannot silently become equivalent categories. Colour-field treatment, hard-edged geometry and gestural abstraction remain distinct. Kandinsky's 1913 painting is not assigned to postwar Abstract Expressionism. Institutional indexing dates stay separate from open-ended display dates and earlier editorial intervals.

The context builder is `tools/build-artwork-context-reviews-20261115.mjs`, with individually supplied refinements in `tools/artwork-context-refinements-20261115.json`. No response data or private collection-page links enter either public sidecar.
