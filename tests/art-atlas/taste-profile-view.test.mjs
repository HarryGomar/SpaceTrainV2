import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTasteAxisIndex,renderTasteAxisProfile,renderTasteQualityProfile,renderTasteQualityRecommendations} from '../../public/art-atlas/taste-profile-view.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const works=[{id:'a',title:'Painting A',artist:'Artist A'},{id:'b',title:'Painting B',artist:'Artist B'},{id:'c',title:'Painting C',artist:'Artist C'}],image=work=>`<img data-work="${work.id}">`;
const helpers={works,image,esc,evidence:item=>`<button data-evidence="${esc(item.id)}">View the comparisons</button>`};

test('All-tied or unknown axes do not claim that opposite preferences recur',()=>{
  const axes=[{key:'colour',title:'Colour',leftLabel:'Restrained',rightLabel:'Intense',status:'mixed',positiveSetCount:0,negativeSetCount:0,summary:'No clear difference.',displayWorkIds:[]}];
  const html=renderTasteAxisProfile({...helpers,profile:{axes}});
  assert.match(html,/No clear split/);assert.doesNotMatch(html,/Both directions recur|data-leading="true"/);
  assert.match(renderTasteAxisProfile({...helpers,profile:{axes:[{...axes[0],positiveSetCount:2,negativeSetCount:3}]}}),/Restrained &amp; intense/);
});

test('A directional profile links to its actual evidence and known paintings',()=>{
  const axis={key:'human-presence',title:'Human presence',leftLabel:'Other subjects',rightLabel:'Figures',status:'leaning',direction:1,summary:'Figures led across several comparisons.',eligibleSetCount:5,displayWorkIds:['a','missing']};
  const profile={axes:[axis],coverage:{distinctSets:5}},html=renderTasteAxisProfile({...helpers,profile});
  assert.match(html,/id="axis-human-presence"/);assert.match(html,/data-evidence="axis-human-presence"/);assert.match(html,/data-work="a"/);assert.doesNotMatch(html,/data-work="missing"|%/);
  assert.match(renderTasteAxisIndex({profile,esc}),/href="#axis-human-presence"/);
});

test('The quality view keeps admiration separate from liking and withholds unqualified patterns',()=>{
  const patterns=[{id:'likes-light',channel:'overall-appeal',status:'qualified',title:'Dramatic light',text:'A shared direction.',displayWorkIds:['a','b']},{id:'admires-precision',channel:'admiration-of-making',status:'qualified',title:'Precise rendering',text:'A different judgment.',displayWorkIds:['b','c']},{id:'uncertain',channel:'overall-appeal',status:'mixed',title:'Do not present as established',text:'Mixed.'}];
  const html=renderTasteQualityProfile({...helpers,profile:{patterns}});
  assert.match(html,/id="profile-appeal-qualities"[\s\S]*?id="likes-light"/);assert.match(html,/id="profile-admiration-qualities"[\s\S]*?id="admires-precision"/);assert.doesNotMatch(html.split('<details class="tp-more taste-quality-ledger"')[0],/Do not present as established/);assert.match(html,/Mixed evidence/);
});

test('Pattern text stays escaped, and recommendation paintings need actual catalogue identities',()=>{
  const html=renderTasteQualityProfile({...helpers,profile:{patterns:[{id:'test',status:'qualified',channel:'relative-choice',title:'<script>bad</script>',text:'<img src=x onerror=bad>',displayWorkIds:['missing','a']}]}});
  assert.doesNotMatch(html,/<script>|onerror=bad>/);assert.match(html,/&lt;script&gt;/);
  const routes=renderTasteQualityRecommendations({...helpers,recommendations:[{workId:'missing',reason:'Do not render'},{workId:'c',reason:'Shares a reviewed quality.'}]});
  assert.doesNotMatch(routes,/Do not render/);assert.match(routes,/data-work="c"/);assert.match(routes,/Shares a reviewed quality/);
});

test('Visual groups show exact dot counts once, without a repeated score disclaimer or hidden unqualified association',()=>{
  const axis={key:'colour',title:'Colour',status:'tentative',presentationStatus:'tentative',readingLabel:'Stronger colour',direction:1,positiveSetCount:5,negativeSetCount:1,mixedSetCount:3,leftLabel:'Restrained',rightLabel:'Intense'};
  const html=renderTasteAxisProfile({...helpers,profile:{axes:[axis]}});
  assert.equal((html.match(/<i><\/i>/g)||[]).length,9);assert.match(html,/Early tendency/);assert.doesNotMatch(html,/Comparison groups, not a personality score|Both directions recur/);
  const profile=renderTasteQualityProfile({...helpers,profile:{patterns:[{id:'unqualified',channel:'overall-appeal',status:'descriptive-association',summaryEligible:false,title:'Not a supported result',text:'Open question.'}]}});
  assert.equal(profile.includes('class="taste-quality-section"'),false);
});
