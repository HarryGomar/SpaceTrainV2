import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {imageDimensions} from '../../scripts/art-atlas/import-study-media.mjs';
import {resolveArtworkMedia} from '../../public/art-atlas/artwork-media.mjs';

const site = new URL('../../public/art-atlas/', import.meta.url);
const additions = JSON.parse(fs.readFileSync(new URL('collection-additions-20261115.json', site), 'utf8'));
const ids = new Set(additions.map(work => work.id));
const study = JSON.parse(fs.readFileSync(new URL('artworks.json', site), 'utf8')).slice(0,164).filter(work => !ids.has(work.id));
const opening = JSON.parse(fs.readFileSync(new URL('opening-artworks.json', site), 'utf8'));
const previous = [...study, ...opening];
const byId = new Map(additions.map(work => [work.id, work]));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const normalize = text => String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const identity = work => normalize(work.artist) + ':' + normalize(work.title);

test('The reviewed expansion has distinct objects and no normalized identity or source collision with other study and decorative works', () => {
  assert.equal(additions.length, 57);
  assert.equal(ids.size, additions.length);
  assert.equal(study.length, 107);
  assert.equal(study.filter(work => !work.image.startsWith('assets/classics-20261115/')).length, 99);
  assert.equal(opening.length, 255);
  const oldIdentities = new Set(previous.map(identity));
  const oldSources = new Set(previous.map(work => String(work.sourceId)));
  const sources = new Set();
  for (const work of additions) {
    assert.ok(!oldIdentities.has(identity(work)), work.id);
    assert.ok(!oldSources.has(String(work.sourceId)), work.id);
    assert.ok(!sources.has(work.sourceId), work.id);
    assert.match(work.sourceId, /^gac:[\w-]+$/);
    assert.match(work.sourceUrl, /^https:\/\/artsandculture\.google\.com\/asset\//);
    assert.equal(work.provenance.objectRecordUrl, work.sourceUrl);
    sources.add(work.sourceId);
  }
});

test('All hosted derivatives are complete, dimension-matched local JPEGs with source-bound hashes and no upscaling', () => {
  const hashes = new Set();
  const previousHashes = new Set(previous.map(work => digest(fs.readFileSync(new URL(work.image, site)))));
  let total = 0;
  for (const work of additions) {
    for (const [key, width, height, hash, bytes] of [
      ['image', work.width, work.height, work.provenance.thumbnailSha256, work.provenance.thumbnailBytes],
      ['imageLarge', work.largeWidth, work.largeHeight, work.provenance.largeSha256, work.provenance.largeBytes],
    ]) {
      assert.match(work[key], /^assets\/collection-20261115\/[a-z0-9-]+\.jpg$/);
      const data = fs.readFileSync(new URL(work[key], site));
      const dimensions = imageDimensions(data);
      assert.equal(dimensions.mime, 'image/jpeg');
      assert.equal(dimensions.width, width, work.id + ':' + key);
      assert.equal(dimensions.height, height, work.id + ':' + key);
      assert.equal(data.readUInt16BE(data.length - 2), 0xffd9);
      assert.equal(digest(data), hash);
      assert.equal(data.length, bytes);
      assert.ok(!previousHashes.has(hash), work.id);
      total += data.length;
    }
    assert.ok(Math.max(work.width, work.height) <= 640);
    assert.ok(Math.max(work.width, work.height) >= 500);
    assert.ok(Math.max(work.largeWidth, work.largeHeight) <= 3200);
    assert.ok(work.largeWidth <= work.provenance.downloadedWidth);
    assert.ok(work.largeHeight <= work.provenance.downloadedHeight);
    assert.ok(work.largeWidth * work.largeHeight > work.width * work.height);
    assert.match(work.provenance.transformation, /no upscaling/);
    assert.ok(!hashes.has(work.provenance.largeSha256), work.id);
    hashes.add(work.provenance.largeSha256);
  }
  assert.ok(total < 40000000, 'Bounded derivatives avoid a large increase in hosted payload.');
});

test('The expansion fills sparse and dense abstraction and Mexican-practice gaps without assigning every work from an artist the same features', () => {
  assert.ok(additions.filter(work => work.country === 'Mexico').length >= 20);
  assert.ok(new Set(additions.filter(work => work.country === 'Mexico').map(work => work.artist)).size >= 12);
  assert.ok(additions.filter(work => work.features.abstraction >= .75).length >= 25);
  assert.ok(additions.filter(work => work.features.abstraction >= .75 && work.features.complexity <= .25).length >= 5);
  assert.ok(additions.filter(work => work.features.abstraction >= .75 && work.features.complexity >= .75).length >= 5);
  assert.ok(additions.filter(work => work.features.abstraction <= .35 && work.features.complexity <= .35).length >= 3);
  assert.ok(byId.get('add-af-klint-untitled-1933').features.humanity > .75);
  assert.equal(byId.get('add-af-klint-dove-two').features.humanity, 0);
  assert.ok(byId.get('add-atl-climatic-eruption').features.energy > byId.get('add-atl-popocatepetl').features.energy);
  assert.ok(byId.get('add-mondrian-composition-ten').features.complexity > byId.get('add-mondrian-composition-1930').features.complexity);
});

test('Unknown source facts remain unknown and the country field cannot silently become a nationality claim', () => {
  const tamayo = byId.get('add-tamayo-woman-watermelon');
  assert.equal(tamayo.date, 'Not dated in source record');
  assert.equal(tamayo.analysis.yearRange, null);
  assert.equal(tamayo.medium, 'Not specified in source record');
  assert.equal(byId.get('add-siqueiros-madre-nina').medium, 'Not specified in source record');
  assert.deepEqual(byId.get('add-varo-weaving-space-time').analysis.yearRange, [1954, 1954]);
  assert.equal(byId.get('add-varo-harmony').artistBirthCountry, 'Spain');
  assert.equal(byId.get('add-carrington-dagobert').artistBirthCountry, 'United Kingdom');
  assert.equal(byId.get('add-merida-time-space').artistBirthCountry, 'Guatemala');
  for (const work of additions) assert.match(work.countrySource, /not a nationality claim/);
});

test('Colour descriptors retain the original40-bin definition, and provisional features never masquerade as user responses', () => {
  for (const work of additions) {
    assert.deepEqual(Object.keys(work.features).sort(), ['abstraction', 'atmosphere', 'color', 'complexity', 'energy', 'humanity', 'narrative']);
    assert.ok(Object.values(work.features).every(value => Number.isFinite(value) && value >= 0 && value <= 1));
    assert.match(work.featureSource, /Manual provisional editorial/);
    assert.match(work.featureSource, /not psychometric measurements/);
    assert.equal(work.analysis.revision, 'gallery-descriptors-v1');
    const palette = work.analysis.palette;
    assert.equal(palette.method, 'HSV histogram, 40 bins; 64x64 samples; 6% edge crop');
    assert.equal(palette.histogram.length, 40);
    assert.ok(palette.histogram.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
    assert.ok(Math.abs(palette.histogram.reduce((sum, value) => sum + value, 0) - 1) < .00003);
    assert.ok(palette.swatches.length > 0 && palette.swatches.every(value => /^#[\da-f]{6}$/i.test(value)));
  }
});

test('Protected art, prints and the Watts attribution remain explicitly identified', () => {
  const hope = byId.get('add-watts-hope');
  assert.equal(hope.artist, 'George Frederic Watts and assistants');
  assert.equal(hope.date, '1886');
  assert.notEqual(hope.rights, 'CC0');
  assert.match(hope.rights, /Tate claims rights/);
  assert.match(byId.get('add-gerzso-landscape-red-ii').medium, /print on paper/i);
  assert.match(byId.get('add-dali-transparent-simulacrum').rights, /educational use only/);
  for (const work of additions) {
    assert.ok(work.rights && work.creditLine && work.rightsUrl.startsWith('https://'));
    assert.notEqual(work.rights, 'CC0');
    assert.equal(work.provenance.reuseStatus, 'permission-not-established');
    assert.match(work.provenance.metadataUrl, /^https:\/\//);
    assert.match(work.provenance.downloadUrl, /^https:\/\//);
  }
});

test('Failed and unsuitable candidates do not appear under substituted identities or leave deployable orphan images', () => {
  const excluded = JSON.parse(fs.readFileSync(new URL('../../docs/art-atlas-additions-20261115/excluded-candidates.json', import.meta.url), 'utf8'));
  for (const id of Object.keys(excluded)) {
    assert.ok(!ids.has(id));
    assert.ok(!fs.existsSync(new URL('assets/collection-20261115/' + id + '.jpg', site)));
    assert.ok(!fs.existsSync(new URL('assets/collection-20261115/' + id + '-large.jpg', site)));
  }
  for (const unavailable of ['add-varo-juggler', 'add-varo-creation-of-the-birds', 'add-varo-bankers-in-action']) assert.ok(!ids.has(unavailable));
  const expected = new Set(additions.flatMap(work => [work.image.split('/').at(-1), work.imageLarge.split('/').at(-1)]));
  assert.deepEqual(new Set(fs.readdirSync(new URL('assets/collection-20261115/', site))), expected);
});

test('Every new record resolves its own reviewed large image without borrowing from an original99 identity', () => {
  for (const work of additions) {
    const detail = resolveArtworkMedia(work, {preferLarge: true});
    assert.equal(detail.src, work.imageLarge, work.id);
    assert.equal(detail.width, work.largeWidth, work.id);
    assert.equal(detail.height, work.largeHeight, work.id);
  }
});
