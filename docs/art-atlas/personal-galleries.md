# Personal galleries

`public/art-atlas/galleries.html` is a standalone creative space. It does not boot the quiz or add free arrangements to profile evidence.

The gallery index keeps multiple named galleries. Each gallery can have up to 24 separately named rooms, with eight clear wall positions per room. Click a library painting and an empty position, or drag a painting. Placing a new work selects the next unhung work. Moving a hung work preserves its identity; moving onto another hung work swaps their positions. A new library work cannot silently replace a mounted work. Empty rooms can be removed, including the last room; occupied rooms must be emptied first. Undo reverses the most recent edits in the current gallery. Download exports the independent gallery store.

## Storage and artwork identities

Only `art-atlas-personal-galleries-v1` stores creative arrangements. Artwork title, artist, source, images and rights are captured when first placed. Current metadata does not overwrite those snapshots. A conflicting current identity produces an unavailable placeholder; a removed current entry can still use its saved snapshot. Malformed original storage is preserved and can be downloaded. Storage failures keep edits in memory and display a persistent download reminder.

The page also updates the existing `art-atlas-gallery-context-v1` presentation-context record. Its scope explicitly says that opening the gallery does not establish which labels were read. It does not contain preference values or alter quiz knowledge answers.

`Quiz galleries` reads completed curate records from the active study and read-only archives. It validates the captured question identities and the original catalogue, preserves actual room membership and wall coordinates, and provides no editing controls. Old three-room records remain browsable by room. Missing or conflicting artwork identities remain unavailable; current library metadata is never substituted into the old record. Archive lookup uses a read-only IndexedDB transaction and aborts database upgrades.

## Museum connections

Connections are ranked by selected paintings identified with the institution, then sourced artist representation, then supported visual or movement connections to at least two different institution works in this library. The display distinguishes these bases. Reviewed descriptive tags require their original image and source binding. Unknown tags remain unknown. Every result has institution/object source links and supporting artwork identities. This is a collection-sample route, not a world-wide closest-museum score or a claim about current display.

## Checks

`node --test tests/art-atlas/personal-galleries.test.mjs` covers the model, actual sourced catalogue, persistence, swaps and undo, failed storage, read-only quiz browsing, source identity, museum ranking and unsupported-match suppression. Browser geometry and touch QA are delegated to the coordinating agent through CUA.
