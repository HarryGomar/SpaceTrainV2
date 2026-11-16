# Reviewed collection expansion

The integrated collection has 463 sourced works. This batch adds 280 works, consisting of 235 promotions from the existing opening collection and 45 new reproductions. A separate required-artwork batch adds 19 to the original 164. Three partial mural views are gallery-only, leaving 460 eligible for study comparisons. The committed import manifest is `tools/art-atlas-expansion-manifest-20261115.json`. Existing saved work metadata and answers remain frozen.

Every eligible candidate has a real local preview and a larger reproduction capped at 3200 pixels. Opening promotions retain their existing `opening-cma-*` identity, source URL, preview path and preview hash. New works use stable `extended-nga-*` or `extended-cma-*` IDs. SHA-256 hashes, actual dimensions, source image URLs, downloaded dimensions, institutional records and rights evidence accompany each record. No image is enlarged beyond its downloaded dimensions.

## What was reviewed

All 300 proposed images were inspected on the numbered contact sheets under `artifacts/art-atlas/collection-extended-20261115/`. Twenty were excluded. These include three album covers shown instead of their named pictures, multi-panel installation photographs that made each image too small, and several mounted or dark reproductions that did not support a fair quiz comparison. The exclusion reasons remain in the candidate manifest. Downloading an image does not make it eligible.

The manually entered bulk ledger is `tools/openaccess-visual-reviews-20261115.json`. Its seven coarse numerical descriptions remain provisional. A subsequent strict pass found that the initial action and setting meanings had been applied too broadly. Only 258 exact reproductions now carry `literal-action-setting-v2`, including the full first 72, original 164, required 16 and inspected bulk 78. The other 202 bulk works retain raw action/setting drafts under an explicit pending marker; those fields cannot influence current inference, maps or targeting. Seventeen unresolved reviewed fields are null. See `docs/literal-descriptor-review-20261116.md` and the public source-bound ledger. These labels do not encode symbolism, emotional impact, artistic quality or a participant's reason for choosing a work.

The public `artwork-attribute-reviews.json` provides all sixteen current criteria for every catalogue work; partial gallery views remain unknown. Each review is bound to the exact source URL, preview path and hash actually inspected. Present criteria have concrete visible reasons, unresolved fine detail is unknown, and unlisted criteria were assessed absent under the stated definitions. The reviewed asset is the contact-sheet's preview source, not the larger image merely made available for later inspection. These are assistant editorial judgements, not independent human annotation or psychometric validation.

No documentary interpretation was invented. `sourcedContext` is empty, `contextStatus` records that limitation, and candidate `note` is empty. These works must not generate context-reveal questions until a separately sourced note is supplied. Movement is explicitly `Unknown` where the object record does not assign one. Dates use the institution's begin/end fields, retaining approximate-date wording. `country` repeats institutional culture/tradition where supplied and otherwise remains `Unknown`, never silently substituting artist nationality for execution place.

## Sources and permission

The [Cleveland Museum of Art API](https://openaccess-api.clevelandart.org/) supplied 250 eligible CC0 object records and print renditions. The museum's [Open Access policy](https://www.clevelandart.org/open-access) describes image permissions. A CC0 value is required on the exact CMA record; metadata access alone was not treated as image permission.

The [National Gallery of Art's official open dataset](https://github.com/NationalGalleryOfArt/opendata) supplied 30 newly selected paintings. Only exact primary-image rows marked `openaccess=1` were used. The [data dictionary](https://github.com/NationalGalleryOfArt/opendata/blob/main/documentation/Data%20Dictionary.txt) distinguishes unrestricted images from restricted fair-use images. NGA image reuse follows its [image Open Access policy](https://www.nga.gov/artworks/free-images-and-open-access). The dataset's CC0 label was not copied onto the image rights.

The Art Institute API returned 403. The Met's [documented v1.1 search](https://metmuseum.github.io/) was initially reachable, but the early-modern results had no permitted images and later searches returned 403. No Met image was imported and no access restriction was bypassed. The availability audit is retained with the staged evidence.

## Sequencing

`curationHints` is an editorial planning proposal, separate from factual country and movement fields. Its `reserveUntilBatch` is zero-based. Value `3` means the fourth block of 50 rounds. Following the requested emphasis, East Asian, South Asian and Himalayan expansion works are proposed mainly for later depth. The first 150 can draw predominantly on Western classics and the separately supplied Mexican/Latin American core. Existing global icons need not be delayed.

The expansion offers 166 Western comparison candidates, 113 later-tradition depth candidates and one other sourced object. These labels are for study sequencing, not population familiarity or participant identity. The new Western selection adds, among others, Delaunay's *Political Drama*, Macke, Modersohn-Becker, Redon, Leyster, Gonzalès, Bannister, Duncanson, Tanner, Vermeer's *Woman Holding a Balance*, van Eyck's *Annunciation* and several different material, action and setting contrasts. It does not pretend to fix the still limited African and late abstract collection coverage.

## Reproduction

`py -3.12 tools/import-art-atlas-openaccess-20261115.py` supports `prepare`, `sheets`, `download`, `met`, `nga`, `extras` and `finalize`. Downloads are bounded and resumable. Preparation uses official API/dataset records. Finalisation only emits eligible works that have a manual review and verified local files. Review numbers are bound to the persisted candidate-plan order; do not reorder that plan after review.

`node --test tests/art-atlas/catalogue-expansion-candidates.test.mjs` checks source/identity uniqueness, original preview preservation, every local file and hash, measured image dimensions, retained numerical drafts and strict literal review dispositions, all sixteen criteria, unknown semantics, rights separation and later-block curation scope.
