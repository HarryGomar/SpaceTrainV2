# Original catalogue review completion

The remaining68 works in the original164-work catalogue have individual source-bound reviews using the existing sixteen operational attributes. They supplement the original96 records without changing artworks, seven numeric descriptors, earlier answers or archived study manifests.

The staged handoff is `artifacts/art-atlas/core-remainder-attribute-reviews.json`, with `.reviews` and `.currentAssetReferences`. Its reproducible checklist is `tools/core-remainder-observations-20261115.json`; `tools/build-core-remainder-reviews-20261115.mjs` computes the exact source and image bindings. The original96 and this68 are disjoint and together cover exactly the original164 IDs.

All68 resolved local reproductions were inspected in nine numbered contact sheets. The review records that scale explicitly, maximum384×440 displayed pixels per whole reproduction. This is assistant editorial review rather than independent human validation or microscopic inspection. Fine marks, small interactions and ambiguous referents remain unknown when that scale cannot settle them. Original source and review-image hashes bind the actual local files, while the contact sheets remain in ignored QA output.

The1088 attribute assignments contain387 present,547 absent and154 unknown statuses. Every status has a reason. Unlisted checklist criteria were explicitly checked and recorded absent under the shared definition; unknown never becomes zero. No balancing quota or artist/movement template produced these assignments.

Some distinctions matter for later comparisons:

- Mondrian's `Tableau no.1` has conspicuous painted marks; the available `Composition with Red, Blue and Yellow` reproduction has surface cracking whose relation to paint marks is unresolved.
- The visual evidence for an impossible world is positive in Ernst's `Divinité`, while the bird-and-fire conjunction in Magritte's `Les Fanatiques` remains uncertain. Movement membership supplies no automatic answer.
- Kandinsky's `Impression III` uses a large bounded dark shape and yellow field; the looser parallel marks of `Improvisation26` do not establish the same geometric criterion.
- `Painterly Realism of a Football Player` does not show an identifiable active body merely because the title names one. `Abstraction with Reference to a Flowering Tree` does not establish a recognisable surrounding natural setting from its title.
- A still pitchfork pose differs from the cutting and restraining bodies in Gentileschi's `Judith`. Strong colour contrast differs from clearly depicted selective illumination.

The Teotihuacan record describes its surviving fragment only. It does not reconstruct the lost mural programme. None of these68 reviews adds documentary symbolism, a birthplace, nationality, creation location or a new historical movement claim. Missing such context remains unknown documentation.

Tests read committed checklists and the integrated public catalogue/review sidecar, so clean-checkout validation does not depend on ignored staging artifacts. They verify the164-work partition, both actual image hashes, all sixteen explicit statuses and the distinctions above. The broader attribute suite also validates source identity, approved reproduction path, SHA256 and dimensions for every merged review, including expansion records reviewed at preview scale.
