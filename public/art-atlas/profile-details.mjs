/** Open supporting material without changing the reading's height or position. */
export function createProfileDetails({app,showArtwork}){
  const document=app.ownerDocument,window=document.defaultView;
  const dialog=document.createElement('dialog');dialog.className='profile-details-dialog';
  dialog.setAttribute('aria-labelledby','profile-details-title');
  dialog.innerHTML='<header><h2 id="profile-details-title">Your choices</h2><button type="button" class="profile-details-close" aria-label="Close evidence">×</button></header><div class="profile-details-content"></div>';
  document.body.append(dialog);let opener=null,position=0;
  const close=()=>dialog.close();
  dialog.querySelector('.profile-details-close').addEventListener('click',close);
  dialog.addEventListener('click',event=>{
    const art=event.target.closest('[data-action="deep-art"]');if(art){showArtwork(art.dataset.work,true);return;}
    if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}
  });
  dialog.addEventListener('close',()=>{
    document.body.classList.remove('profile-evidence-open');
    if(opener?.isConnected)opener.focus({preventScroll:true});
    if(Math.abs(window.scrollY-position)>1)window.scrollTo({top:position,behavior:'instant'});
  });
  app.addEventListener('click',event=>{
    const trigger=event.target.closest('.taste-portrait .tp-evidence > summary,.taste-portrait .tp-more > summary,.taste-portrait .tp-method > summary,.taste-portrait .tp-palette-note > summary');if(!trigger)return;
    let body=trigger.parentElement.querySelector(':scope > .tp-evidence-body');
    if(!body){body=trigger.parentElement.cloneNode(true);body.querySelector('summary')?.remove();}
    event.preventDefault();opener=trigger;position=window.scrollY;
    const article=trigger.closest('article,section');
    dialog.querySelector('h2').textContent=trigger.parentElement.dataset.evidenceTitle||(trigger.parentElement.classList.contains('tp-evidence')?article?.querySelector('h2,h3')?.textContent||'Your choices':trigger.textContent.replace(/[+↗]/g,'').trim());
    dialog.querySelector('.profile-details-content').innerHTML=body.innerHTML;
    dialog.querySelector('.profile-details-content').scrollTop=0;
    document.body.classList.add('profile-evidence-open');dialog.showModal();
  });
  return {destroy(){dialog.remove();}};
}
