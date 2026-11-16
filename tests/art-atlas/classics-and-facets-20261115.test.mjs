import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {imageDimensions} from '../../scripts/art-atlas/import-study-media.mjs';
import {resolveArtworkMedia} from '../../public/art-atlas/artwork-media.mjs';
import {FEATURE_SEMANTIC_VERSION,isReviewedVisualDescriptor} from '../../public/art-atlas/visual-descriptor-semantics.mjs';

const site = new URL('../../public/art-atlas/', import.meta.url);
const works = JSON.parse(fs.readFileSync(new URL('artworks.json', site), 'utf8'));
const plan = JSON.parse(fs.readFileSync(new URL('../../tools/art-atlas-classics-plan-20261115.json', import.meta.url), 'utf8'));
const facets = JSON.parse(fs.readFileSync(new URL('curated-facets.json', site), 'utf8'));
const byId = new Map(works.map(work => [work.id, work]));
const ids = new Set(plan.map(spec => spec.id));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const featureKeys = ['abstraction', 'atmosphere', 'color', 'complexity', 'energy', 'humanity', 'narrative'];

test('Eight exact classic identities are appended once with institutional dates and individual reproduction rights', () => {
  assert.equal(plan.length, 8);
  assert.equal(ids.size, 8);
  assert.equal(plan.filter(spec => spec.artist === 'Caravaggio').length, 3);
  for (const spec of plan) {
    const work = byId.get(spec.id);
    assert.ok(work, spec.id);
    for (const key of ['title', 'artist', 'date', 'sourceUrl', 'museum']) assert.equal(work[key], spec[key]);
    assert.deepEqual(work.analysis.yearRange, spec.yearRange);
    assert.equal(work.analysis.yearRangeSource, spec.sourceUrl);
    assert.equal(work.provenance.sourceFileTitle, spec.commonsTitle);
    assert.equal(work.rights, 'Public domain');
    assert.match(work.rightsUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:.+#Licensing$/);
    assert.equal(work.provenance.licenseMetadata.LicenseShortName, 'Public domain');
    assert.equal(work.provenance.licenseMetadata.Copyrighted, 'False');
    assert.equal(work.provenance.reuseStatus, 'public-domain-faithful-reproduction');
    assert.match(work.provenance.sourceRightsStatement, /Museum photographic terms are separate/);
    assert.equal(work.provenance.institutionRecordUrl, work.sourceUrl);
    assert.equal(work.imageSourceUrl, work.provenance.downloadUrl);
    assert.match(work.provenance.originalImageUrl, /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//);
  }
});

test('All16 classic JPEGs are complete source-bound derivatives with real dimensions and no duplicate small images', () => {
  const previousHashes = new Set(works.filter(work => !ids.has(work.id)).map(work => digest(fs.readFileSync(new URL(work.image, site)))));
  const largeHashes = new Set(), smallHashes = new Set();
  let totalBytes = 0;
  for (const id of ids) {
    const work = byId.get(id), p = work.provenance;
    for (const [key, width, height, hash, expectedBytes] of [
      ['image', work.width, work.height, p.thumbnailSha256, p.thumbnailBytes],
      ['imageLarge', work.largeWidth, work.largeHeight, p.largeSha256, p.largeBytes],
    ]) {
      assert.match(work[key], /^assets\/classics-20261115\/[a-z0-9-]+\.jpg$/);
      const bytes = fs.readFileSync(new URL(work[key], site)), measured = imageDimensions(bytes);
      assert.equal(measured.mime, 'image/jpeg');
      assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9);
      assert.equal(measured.width, width, id + ':' + key);
      assert.equal(measured.height, height, id + ':' + key);
      assert.equal(digest(bytes), hash);
      assert.equal(bytes.length, expectedBytes);
      totalBytes += bytes.length;
    }
    assert.equal(work.sha256, p.thumbnailSha256);
    assert.equal(work.bytes, p.thumbnailBytes);
    assert.ok(!previousHashes.has(work.sha256), id);
    assert.ok(!smallHashes.has(work.sha256), id); smallHashes.add(work.sha256);
    assert.ok(!largeHashes.has(p.largeSha256), id); largeHashes.add(p.largeSha256);
    assert.ok(Math.max(work.width, work.height) <= 800);
    assert.ok(Math.max(work.largeWidth, work.largeHeight) >= 2000);
    assert.ok(Math.max(work.largeWidth, work.largeHeight) <= 3200);
    assert.ok(work.largeWidth <= p.downloadedWidth && work.largeHeight <= p.downloadedHeight);
    assert.ok(work.largeWidth * work.largeHeight > work.width * work.height);
    assert.match(p.transformation, /No upscaling or invented pixels/);
    const large = resolveArtworkMedia(work, {preferLarge:true, responsive:true});
    assert.equal(large.mediaBinding, 'explicit-record');
    assert.equal(large.src, work.imageLarge);
    assert.equal(large.width, work.largeWidth);
    assert.equal(large.height, work.largeHeight);
    assert.equal(large.sourceLimited, false);
  }
  assert.ok(totalBytes < 8500000, 'Whole8-work preview/detail payload remains bounded.');
  const expected = new Set([...ids].flatMap(id => [id + '.jpg', id + '-large.jpg']));
  assert.deepEqual(new Set(fs.readdirSync(new URL('assets/classics-20261115/', site))), expected);
});

test('New numeric descriptors are explicitly provisional, keep literal action/setting meanings and retain the40-bin palette', () => {
  for (const id of ids) {
    const work = byId.get(id);
    assert.deepEqual(Object.keys(work.features).sort(), featureKeys);
    assert.ok(Object.values(work.features).every(value => Number.isFinite(value) && value >= 0 && value <= 1));
    assert.equal(work.featureSemanticVersion, FEATURE_SEMANTIC_VERSION);
    for(const key of ['narrative','atmosphere'])assert.ok(isReviewedVisualDescriptor(work,key));
    assert.match(work.featureSource, /Manual provisional editorial/);
    assert.match(work.featureSource, /Narrative means depicted action; atmosphere means emphasis on setting/);
    assert.match(work.featureSource, /not psychometric measurements/);
    assert.ok(work.featureReviewReason.length > 35);
    const palette = work.analysis.palette;
    assert.equal(palette.histogram.length, 40);
    assert.ok(palette.histogram.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
    assert.ok(Math.abs(palette.histogram.reduce((sum, value) => sum + value, 0) - 1) < .00003);
    assert.equal(palette.method, 'HSV histogram, 40 bins; 64x64 samples; 6% edge crop');
    assert.equal(work.recognitionTierSource.includes('not a population familiarity measure'), true);
  }
});

test('The finite8-tag vocabulary is versioned and describes artwork content without upgrading archived records by ID', () => {
  const expected = ['narrative-detail', 'imagined-world', 'dramatic-light', 'layered-space', 'geometric-structure', 'visible-gesture', 'intimate-figures', 'landscape'];
  assert.equal(facets.version, 'curatorial-facets-v1');
  assert.deepEqual(Object.keys(facets.definitions).sort(), expected.sort());
  assert.match(facets.meaning, /editorial/);
  assert.match(facets.meaning, /not measured user emotions/);
  assert.match(facets.unknownSemantics.missingAnnotation, /Unknown/);
  assert.match(facets.unknownSemantics.archivedWorks, /Never attach current sidecar annotations/);
  assert.match(facets.unknownSemantics.reviewedEmptyTags, /none of these eight tags assigned/);
  for (const value of Object.values(facets.definitions)) {
    assert.ok(value.label && value.definition && value.excludes);
  }
});

test('Every reviewed facet annotation is embedded in the exact current object and bound to its inspected image bytes', () => {
  assert.equal(facets.reviewedCount, 56);
  assert.equal(facets.annotations.length, facets.reviewedCount);
  assert.equal(new Set(facets.annotations.map(annotation => annotation.workId)).size, facets.reviewedCount);
  assert.equal(works.filter(work => work.analysis?.curatorialFacets).length, facets.reviewedCount);
  for (const annotation of facets.annotations) {
    const {workId, ...embedded} = annotation, work = byId.get(workId);
    assert.ok(work, workId);
    assert.deepEqual(work.analysis.curatorialFacets, embedded);
    assert.equal(embedded.version, facets.version);
    assert.equal(embedded.reviewed, true);
    assert.equal(embedded.reviewedImage, work.image);
    assert.equal(embedded.reviewedImageSha256, digest(fs.readFileSync(new URL(work.image, site))));
    assert.equal(new Set(embedded.tags).size, embedded.tags.length);
    assert.ok(embedded.tags.every(tag => facets.definitions[tag]));
    assert.ok(embedded.sourceUrls.includes(work.sourceUrl));
    assert.ok(embedded.sourceUrls.every(url => url.startsWith('https://')));
    assert.ok(embedded.reviewReason.length > 35);
  }
});

test('Sparse symbolism, literal action, geometric abstraction and explicit empty reviews remain distinct', () => {
  const tags = id => byId.get(id).analysis.curatorialFacets.tags;
  for (const id of ['add-watts-hope', 'velazquez-las-meninas', 'van-gogh-night-cafe', 'goya-saturn', 'bosch-garden-delights']) assert.ok(tags(id).length > 0, id);
  assert.ok(tags('add-watts-hope').includes('narrative-detail'));
  assert.ok(!tags('goya-saturn').includes('narrative-detail'), 'A single concentrated act is not automatically a field of secondary clues.');
  assert.ok(!tags('study-david-marat').includes('visible-gesture'), 'An inactive body does not become literal action from its backstory.');
  assert.ok(tags('add-herrera-cobalt-white').includes('geometric-structure'));
  assert.deepEqual(tags('add-pollock-convergence'), []);
  assert.deepEqual(tags('add-kandinsky-composition-seven'), []);
  assert.ok(!byId.get('cassatt-omnibus').analysis?.curatorialFacets, 'An unreviewed object stays unknown in the current catalogue.');
});
