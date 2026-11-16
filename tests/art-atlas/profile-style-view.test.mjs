import test from 'node:test';
import assert from 'node:assert/strict';
import {renderProfileStyles} from '../../public/art-atlas/profile-style-view.mjs';

const works=[{id:'starry',title:'The Starry Night',artist:'Van Gogh',movement:'Post-Impressionism'},{id:'cafe',title:'The Night Café',artist:'Van Gogh',movement:'Post-Impressionism'},{id:'sunflowers',title:'Sunflowers',artist:'Van Gogh',movement:'Post-Impressionism'},{id:'church',title:'Twilight',artist:'Church',movement:'Hudson River School'}];
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),image=work=>`<img data-work="${work.id}">`,route={id:'tradition-post-impressionism',title:'Post-Impressionism',workIds:['starry','cafe'],counter:[{roundId:'q',workIds:['church','sunflowers']}],reason:'The original source comparisons.'};

test('A movement route distinguishes actual favourites from a lower-rated work in the same movement',()=>{
  const portrait={heroWorks:[{workId:'starry',basis:'overall-favourites'},{workId:'cafe',basis:'overall-favourites'}],preferenceEvidence:{overallRatings:[{workId:'sunflowers',score:20}]}};
  const html=renderProfileStyles({routes:[route],works,portrait,image,esc});
  assert.match(html,/2 selected favourites/);assert.match(html,/by Van Gogh/);assert.match(html,/data-style-role="counter"[\s\S]*data-work="sunflowers"/);assert.match(html,/Rated lower/);assert.doesNotMatch(html,/data-work="church"|positively chosen|catalogue label/);
});

test('An old local comparison is never labelled an absolute low rating',()=>{
  const html=renderProfileStyles({routes:[route],works,portrait:{},image,esc});
  assert.match(html,/Lower in a comparison/);assert.doesNotMatch(html,/Rated lower|Selected favourite/);
});

test('Unknown routes and missing paintings cannot manufacture examples',()=>{
  assert.equal(renderProfileStyles({routes:[{id:'bad',workIds:['missing']}],works,image,esc}),'');
  const html=renderProfileStyles({routes:[{...route,title:'<script>bad</script>'}],works,image,esc});assert.doesNotMatch(html,/<script>/);
});
