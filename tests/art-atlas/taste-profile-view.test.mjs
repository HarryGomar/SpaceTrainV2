import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTasteAxisIndex,renderTasteAxisProfile,renderTasteQualityProfile,renderTasteQualityRecommendations,renderTasteBoundaries,renderDeclaredPreferences} from '../../public/art-atlas/taste-profile-view.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const works=[{id:'a',title:'Painting A',artist:'Artist A'},{id:'b',title:'Painting B',artist:'Artist B'},{id:'c',title:'Painting C',artist:'Artist C'}],image=work=>`<img data-work="${work.id}">`;
const helpers={works,image,esc,evidence:item=>`<button data-evidence="${esc(item.id)}">View the comparisons</button>`};

test('The declaration gallery shows only current sourced choices and does not turn history into a new favourite',()=>{
  const html=renderDeclaredPreferences({...helpers,profile:{explicitFavourites:[{workId:'a',sourceRoundIds:['favourite-round']}],explicitDislikes:[{workId:'b',sourceRoundIds:['dislike-round']},{workId:'c',sourceRoundIds:[]}],favouriteDeclarations:[{workId:'c',sourceRoundIds:['old-round']}]}});
  assert.match(html,/Favourites & dislikes/);assert.match(html,/data-work="a"/);assert.match(html,/data-work="b"/);assert.doesNotMatch(html,/data-work="c"|\/ 100/);
  assert.equal(renderDeclaredPreferences({...helpers}), '');
});

test('An explicit favourite versus dislike contrast never fabricates numerical ratings',()=>{
  const finding={id:'declared-boundary',status:'explicit-choice-contrast',title:'Stories inside detailed scenes',text:'The observed contrast.',supportPairs:[{highWorkId:'a',lowWorkId:'b'},{highWorkId:'a',lowWorkId:'c'}]};
  const html=renderTasteBoundaries({...helpers,profile:{findings:[finding]}});
  assert.match(html,/Favourite/);assert.match(html,/Disliked/);assert.match(html,/data-evidence="declared-boundary"/);assert.doesNotMatch(html,/\/ 100|undefined|Rated highly|Rated lower/);
  const legacy=renderTasteBoundaries({...helpers,profile:{findings:[{...finding,status:'exploratory-contrast',supportPairs:finding.supportPairs.map(pair=>({...pair,highValue:85,lowValue:20}))}]}});
  assert.match(legacy,/Rated highly · 85 \/ 100/);assert.match(legacy,/Rated lower · 20 \/ 100/);
});

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

test('Visual balance names the counted groups and preserves mixed evidence without inventing a score',()=>{
  const axis={key:'colour',title:'Colour',status:'tentative',presentationStatus:'tentative',readingLabel:'Stronger colour',direction:1,positiveSetCount:5,negativeSetCount:1,mixedSetCount:3,leftLabel:'Restrained',rightLabel:'Intense'};
  const html=renderTasteAxisProfile({...helpers,profile:{axes:[axis]}});
  assert.equal((html.match(/<i data-side=/g)||[]).length,9);assert.match(html,/<strong>5 of 9<\/strong> groups favoured <em>Intense<\/em>/);assert.match(html,/3 groups were mixed or close/);assert.match(html,/Early tendency/);assert.doesNotMatch(html,/Comparison groups, not a personality score|Both directions recur|\d+%/);
  const profile=renderTasteQualityProfile({...helpers,profile:{patterns:[{id:'unqualified',channel:'overall-appeal',status:'descriptive-association',summaryEligible:false,title:'Not a supported result',text:'Open question.'}]}});
  assert.equal(profile.includes('class="taste-quality-section"'),false);
});
