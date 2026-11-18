const arrow='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5"/></svg>';
export function renderOpening({started=false,finished=false,profileAvailable=false}={}){
  return `<section class="opening-screen"><canvas data-art-scene aria-hidden="true"></canvas><div class="opening-center"><h1 id="question-title">Art Atlas</h1><button type="button" class="opening-start" data-action="deep-start">${finished?'View profile':started?'Continue':'Start'}${arrow}</button><div class="opening-explore"><a class="opening-profiles" href="./paintings.html">Paintings</a><a class="opening-profiles" href="./galleries.html">Galleries</a>${profileAvailable?'<button type="button" class="opening-profiles" data-action="deep-reading">Your profile</button>':'<a class="opening-profiles" href="./profiles.html">Explore profiles</a>'}<a class="opening-profiles" href="./maps.html">Maps</a></div></div><nav class="opening-policies" aria-label="Site policies"><a href="./privacy.html">Privacy</a><a href="./privacy.html#terms">Terms</a></nav><button type="button" class="opening-motion" data-scene-motion aria-label="Pause animation"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg></button></section>`;
}
export const renderIntroTitle=renderOpening;
export const renderStudioTitle=()=>renderOpening();
export const renderStudyTitle=renderOpening;
