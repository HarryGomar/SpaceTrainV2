# Larger study reproductions

The original 99 study records keep their existing `image` paths and bytes. The separate [study-image-sources.json](../public/art-atlas/study-image-sources.json) provides 97 larger real reproductions. Hosted files total 90,020,300 bytes. Of these, 89 have a long edge of at least 2000 pixels, eight have smaller verified sources or available derivatives, and two retain their native small image. No AI upscaling was used.

Twilight in the Wilderness now has a 3200 × 1998 hosted reproduction, derived from the museum's 3400 × 2123 print JPEG. Its existing 480 × 300 file remains the map/opening asset. The museum API verifies accession 1965.233 and CC0 individually. [CMA record](https://www.clevelandart.org/art/1965.233), [API record](https://openaccess-api.clevelandart.org/api/artworks/141639), [CMA open-access policy](https://www.clevelandart.org/open-access).

## Rendering contract

Import `resolveArtworkMedia` from [artwork-media.mjs](../public/art-atlas/artwork-media.mjs).

```js
const thumbnail = resolveArtworkMedia(work);
const responsive = resolveArtworkMedia(work, {responsive:true});
const detail = resolveArtworkMedia(work, {preferLarge:true});
```

The default `src` stays small. `responsive:true` adds width descriptors for the small and larger local files, without choosing a viewport size. The consumer supplies an appropriate `sizes` attribute. Detail callers explicitly set `preferLarge:true` and receive the larger dimensions. Cloud points and tiny thumbnails should retain the small default.

The resolver returns `src`, optional `srcSet`, `width`, `height`, `imageLarge`, `largeWidth`, `largeHeight`, `nativeWidth`, `nativeHeight`, `sourceLimited`, `matchedLargeSource` and `mediaBinding`. It has no DOM or session state.

For the original 99, an ID match alone is insufficient. The current record must match all three stored source identity fields: `sourceUrl`, small `image`, and `imageSourceUrl`. A frozen record with different source fields stays on its own small image. New verified collection records may carry their own explicit local `imageLarge`, `largeWidth` and `largeHeight`; those fields belong to that record rather than borrowing another work's entry. External or traversing large paths and invalid dimensions are rejected.

`sourceLimited:true` means the largest available verified local reproduction is below the 2000px target, or no larger file is available. Detail consumers should use `nativeWidth`/`nativeHeight` to cap enlargement and describe the source limit where useful. The two native-only cases are Posada's Catrina, 956 × 640, and Tanner's Banjo Lesson, 591 × 830. The checked original files did not offer more real pixels. Candidate alternatives with weak sourcing or a different photographic crop were not used merely to raise the dimensions.

Root integration uses the shared image renderer in the study, gallery enlargement, atlas inspector and profile explorer. Those consumers should keep alt text from the bound artwork record and keep thumbnails lazy. Explicit large detail views can load eagerly when opened.

## Sources and reproduction differences

All 49 Cleveland records were checked against the current Open Access API, matching accession numbers and `share_license_status:'CC0'`. Their museum print JPEGs provide the larger source. Klee's Carnival in the Snow is limited by the museum's own 1536 × 1676 print and full-image files.

Commons files were checked individually through imageinfo metadata and their file licensing pages. Public-domain files require the recorded public-domain status. The NGA-donated files for Van Gogh's Self-Portrait and Monet's Japanese Footbridge explicitly use CC0. Their Commons `Copyrighted:'True'` flag does not override that explicit dedication. The manifest retains the actual license fields and individual file URLs. The Met's Great Wave uses the museum's public-domain primary image.

Kandinsky's Composition VIII, Géricault's Raft of the Medusa and Matisse's 1910 Dance use reviewed alternate public-domain reproductions of the same works. Their colour rendering can differ from the original small files. These are presentation assets, with `alternativeReproduction:true` in provenance. The old pixels, recorded palette annotations and participant responses are unchanged. The review compares the actual compositions, not just titles. Relevant file records: [Kandinsky](https://commons.wikimedia.org/wiki/File:Wassily_Kandinsky_Composition_VIII.jpg), [Géricault](https://commons.wikimedia.org/wiki/File:Th%C3%A9odore_G%C3%A9ricault_-_The_Raft_of_the_Medusa_-_WGA08630.jpg), [Matisse](https://commons.wikimedia.org/wiki/File:Henri_Matisse_-_Dance_1910.jpg).

Original-file downloads hit Wikimedia 429 responses in several cases. Their public published thumbnail derivatives were retrieved instead, with actual dimensions recorded from the bytes. A 1920px file is described as 1920px rather than being labelled with the larger original's dimensions.

Hosted derivatives preserve the whole reproduction and its aspect ratio. They are JPEG quality 90, at most 3200px on the long edge. Images over a 1MB budget are downsampled to 2400 or 2000px as needed. Native smaller sources are never enlarged. Original downloaded pixel sizes, source URLs, source hashes and byte counts remain in provenance alongside each hosted file's final dimensions, SHA-256 and size.

## Reproduction and checks

The pipeline scripts are in [scripts/art-atlas](../scripts/art-atlas/). Run the import, alternate-file metadata review, completion with `--public-thumbnails`, and optimization in that order. Requests use public APIs with no keys. The importer fixes its assigned scope to the original 99 IDs, even if the live collection grows. It does not write the artwork catalogue or add research descriptors.

Source metadata, raw downloads, initial small-image hashes and the comparison sheet live under ignored `qa-output/study-media/`, inside the repository. The final comparison sheet is `study-media-comparisons.jpg`. The raw cache is excluded from Git; only the optimized hosted files are deliverable assets.

Run `node --test tests/art-atlas/artwork-media.test.mjs`. Tests check complete 99-work accounting, 97 distinct hosted hashes, actual image dimensions and byte counts, complete JPEG markers, no upscaling, the 3200px maximum, the 100MB budget, unchanged small files, responsive defaults, explicit record media, invalid paths and frozen-source mismatches. Windows System.Drawing also decoded every hosted source while creating the JPEG derivatives.
