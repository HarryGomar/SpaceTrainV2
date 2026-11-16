import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/art-atlas');
const base = JSON.parse(await fs.readFile(path.join(root, 'artworks.json'), 'utf8'));
const added = JSON.parse(await fs.readFile(path.join(root, 'opening-artworks.json'), 'utf8'));
const all = [...base, ...added];
const studyAdditions = JSON.parse(await fs.readFile(path.join(root, 'study-additions.json'), 'utf8'));
const norm = value => String(value ?? '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const family = accession => accession.split('.').slice(0, 2).join('.');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function jpegDimensions(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'JPEG start marker');
  assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9, 'JPEG end marker');
  for (let i = 2; i < bytes.length - 9;) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1]; i += 2;
    if ([0xff, 0x00, 0xd8, 0xd9].includes(marker)) continue;
    const length = bytes.readUInt16BE(i);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { width: bytes.readUInt16BE(i + 5), height: bytes.readUInt16BE(i + 3) };
    assert.ok(length >= 2); i += length;
  }
  assert.fail('JPEG size marker missing');
}

test('419 distinct identities and paths across 164 study and 255 decorative works', () => {
  assert.equal(base.length, 164); assert.equal(added.length, 255); assert.equal(all.length, 419);
  for (const field of ['id', 'image']) assert.equal(new Set(all.map(a => a[field])).size, 419, field);
  assert.equal(new Set(all.map(a => norm(a.title) + '|' + norm(a.artist) + '|' + norm(a.date))).size, 419, 'title + artist');
  assert.equal(new Set(all.map(a => a.imageSourceUrl)).size, 419, 'source image URLs');
  const cma = all.filter(a => /clevelandart\.org/.test(a.sourceUrl));
  assert.equal(new Set(cma.map(a => a.sourceId)).size, cma.length, 'CMA source IDs');
  assert.equal(new Set(cma.map(a => a.sourceUrl.replace('www.', '').replace(/\/$/, ''))).size, cma.length, 'CMA source URLs');
  const previousFamilies = new Set(base.filter(a => /clevelandart\.org/.test(a.sourceUrl)).map(a => family(a.sourceUrl.split('/').pop())));
  const addedFamilies = added.map(a => family(a.accessionNumber));
  assert.equal(new Set(addedFamilies).size, added.length, 'No alternate panels or parts from one accession family');
  for (const value of addedFamilies) assert.ok(!previousFamilies.has(value), value);
});

test('every remaining decorative work has individual CC0 image provenance and no taste scores', () => {
  for (const a of added) {
    assert.equal(a.rights, 'CC0'); assert.equal(a.provenance.share_license_status, 'CC0');
    assert.equal(a.provenance.type, 'Painting'); assert.equal(a.decorativeOnly, true); assert.equal(a.coreQuiz, false);
    assert.ok(!('features' in a));
    assert.match(a.id, /^opening-cma-\d+$/);
    assert.equal(a.image, `assets/${a.id}.jpg`);
    assert.match(a.sourceUrl, /^https:\/\/(www\.)?clevelandart\.org\/art\//);
    assert.match(a.imageSourceUrl, /^https:\/\/openaccess-cdn\.clevelandart\.org\/.+_web\.jpg$/);
    assert.equal(a.imageSourceUrl, a.provenance.sourceImageUrl);
    assert.equal(a.provenance.recordUrl, `https://openaccess-api.clevelandart.org/api/artworks/${a.sourceId}`);
    assert.ok(a.title && a.artist && a.date && a.alt && Array.isArray(a.culture));
    for (const creator of a.provenance.creatorAttribution.filter(c => c.use_in_caption !== false && c.qualifier && c.qualifier.toLowerCase() !== 'and')) {
      assert.ok(a.artist.toLowerCase().includes(creator.qualifier.toLowerCase()), `Attribution qualifier missing: ${a.id}`);
    }
    assert.equal(a.sha256, a.provenance.finalSha256);
  }
});

test('all 419 local JPEGs have unique SHA256 values and declared dimensions; opening images retain their size limits', async () => {
  const shipped = (await fs.readdir(path.join(root, 'assets'))).filter(name => /^opening-cma-\d+\.jpg$/.test(name));
  const referencedOpeningFiles = all.map(a => path.basename(a.image)).filter(name => /^opening-cma-\d+\.jpg$/.test(name));
  assert.equal(shipped.length, 261, 'Original opening images include six retained study promotions');
  assert.deepEqual(shipped.sort(), referencedOpeningFiles.sort(), 'No obsolete or unreferenced opening image files');
  const hashes = new Set();
  for (const a of all) {
    const bytes = await fs.readFile(path.join(root, a.image));
    const value = hash(bytes);
    assert.ok(!hashes.has(value), `Repeated image bytes: ${a.id}`); hashes.add(value);
    const size = jpegDimensions(bytes);
    assert.deepEqual(size, { width: a.width, height: a.height }, a.id);
    if (/^opening-cma-/.test(a.id)) {
      assert.ok(Math.max(size.width, size.height) <= 480, a.id);
      assert.ok(Math.min(size.width, size.height) >= 100, a.id);
    }
    if (a.bytes !== undefined) assert.equal(bytes.length, a.bytes, a.id);
    if (a.sha256 !== undefined) assert.equal(value, a.sha256, a.id);
    assert.ok(bytes.length > 4000, a.id);
  }
  assert.equal(hashes.size, 419);
});

test('six opening promotions retain their exact identity, image path and bytes in the study collection', () => {
  const promoted = studyAdditions.filter(a => a.promotedFromOpening);
  assert.equal(studyAdditions.length, 40);
  assert.equal(promoted.length, 6);
  assert.deepEqual(base.filter(a => a.promotedFromOpening).map(a => a.id).sort(), promoted.map(a => a.id).sort());
  for (const snapshot of promoted) {
    const current = base.find(a => a.id === snapshot.id);
    assert.ok(current, snapshot.id);
    assert.ok(!added.some(a => a.id === snapshot.id || a.image === snapshot.image), snapshot.id);
    for (const key of ['id', 'image', 'sourceId', 'sourceUrl', 'imageSourceUrl', 'rights', 'width', 'height', 'bytes', 'sha256']) {
      assert.equal(current[key], snapshot[key], `${snapshot.id}: ${key}`);
    }
    // The legacy twelve-round quiz flag is separate from study eligibility.
    assert.equal(current.studyEligible, true);
    assert.equal(current.decorativeOnly, false);
    assert.equal(current.featureQuality, 'provisional_manual');
    assert.match(current.featureSource, /Manual provisional editorial/);
  }
});
