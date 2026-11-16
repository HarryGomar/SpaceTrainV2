import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {canonicalOpeningPool} from '../public/art-atlas/opening-pool.mjs';

const root=new URL('../public/art-atlas/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');

test('Art Atlas has its own directory route without taking over personal-site routes',()=>{
  const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.ok(config.redirects.some(rule=>rule.source==='/art-atlas'&&rule.destination==='/art-atlas/'));
  assert.ok(config.rewrites.some(rule=>rule.source==='/art-atlas/'&&rule.destination==='/art-atlas/index.html'));
  const fallback=config.rewrites.find(rule=>rule.destination==='/index.html');
  assert.equal(fallback.source,'/:path((?!art-atlas/).*)');
  const matches=new RegExp('^/'+fallback.source.slice('/:path('.length,-1)+'$');
  for(const route of ['/','/projects/example','/train'])assert.ok(matches.test(route),route);
  for(const route of ['/art-atlas/maps.html','/art-atlas/assets/example.jpg','/art-atlas/missing.mjs'])assert.equal(matches.test(route),false,route);
});

test('All Art Atlas entry pages resolve their local files under the route',()=>{
  for(const page of ['index.html','paintings.html','maps.html','profiles.html','galleries.html']){
    const html=read(page);assert.match(html,/Art Atlas/);
    for(const [,reference] of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)){
      const file=new URL(reference,new URL(page,root));assert.ok(fs.existsSync(file),page+' → '+reference);
      assert.ok(file.pathname.startsWith(root.pathname),reference);
    }
  }
});

test('The expanded collection preserves its records and supplies480 canonical opening artworks',()=>{
  const study=JSON.parse(read('artworks.json')),opening=JSON.parse(read('opening-artworks.json')),all=[...study,...opening],canonical=canonicalOpeningPool(all);
  assert.equal(study.length,463);assert.equal(opening.length,255);assert.equal(new Set(all.map(work=>work.id)).size,483);
  assert.equal(canonical.length,480);assert.equal(new Set(canonical.map(work=>work.image)).size,480);
  for(const work of new Map(all.map(work=>[work.id,work])).values()){
    const file=new URL(work.image,root);assert.ok(file.pathname.startsWith(root.pathname),work.id);
    const bytes=fs.readFileSync(file);assert.equal(bytes[0],255,work.id);assert.equal(bytes[1],216,work.id);
    assert.ok(/^https?:\/\//.test(work.sourceUrl),work.id+' source');
  }
  for(const name of fs.readdirSync(root))assert.ok(!/qa-output|\.env|art-profile-.*\.json/.test(path.basename(name)),name);
});
