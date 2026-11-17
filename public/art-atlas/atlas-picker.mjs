const shortLabel=text=>({'Personal appeal and Admiration of making':'Appeal & admiration','Personal appeal and Reported attention':'Appeal & attention','Scene clarity and Interpretive openness':'Clarity & interpretation','Felt tension and Wish to return':'Tension & return','Tension and Involvement':'Tension & involvement','Understanding and Connection':'Understanding & connection'}[text]||text.replace('Preference and curiosity','Preference & curiosity'));
const names={'atlas-x':'Choose the horizontal axis','atlas-y':'Choose the vertical axis','atlas-map':'Choose a response map','atlas-paired':'Choose a painting group','atlas-round':'Choose a question','atlas-comparison-question':'Choose a comparison question','atlas-component':'Choose a comparison group'};

export function createAtlasPicker(root){
  const doc=root.ownerDocument,dialog=doc.createElement('dialog');dialog.id='atlas-picker';dialog.className='atlas-picker-dialog';dialog.setAttribute('aria-labelledby','atlas-picker-title');
  dialog.innerHTML='<header><button type="button" class="atlas-picker-back" aria-label="Back to response maps" hidden>←</button><h2 id="atlas-picker-title"></h2><button type="button" data-picker-close aria-label="Close choices">×</button></header><div class="atlas-picker-options"></div>';doc.body.append(dialog);
  let fieldId='',position=0,previews={},colours={};
  function colourLabel(host,label,value){
    const tones=colours[value];host.textContent='';
    if(!tones?.every(tone=>/^#[a-f\d]{6}$/i.test(tone))){host.textContent=label;return;}
    host.parentElement?.style.setProperty('--choice-x',tones[0]);host.parentElement?.style.setProperty('--choice-y',tones[1]);host.parentElement?.classList.add('atlas-coloured-choice');
    const parts=label.split(/ & | and /);for(let index=0;index<parts.length;index++){if(index)host.append(doc.createTextNode(' & '));const text=doc.createElement('span');text.textContent=parts[index];text.style.color=tones[Math.min(index,1)];host.append(text);}
  }
  const close=()=>dialog.close();dialog.querySelector('[data-picker-close]').addEventListener('click',close);
  const preview=(images,className)=>{
    const group=doc.createElement('span');group.className=className;group.setAttribute('aria-hidden','true');
    for(const image of images||[]){const img=doc.createElement('img');img.src=image.src;img.alt='';group.append(img);}return group;
  };
  function renderOptions(groupStep=false){
    const field=doc.getElementById(fieldId);if(!field)return;
    const host=dialog.querySelector('.atlas-picker-options'),paired=[...field.options].filter(option=>option.value.startsWith('paired-'));
    const groups=groupStep||fieldId==='atlas-paired';host.replaceChildren();host.classList.toggle('painting-groups',groups);
    dialog.querySelector('h2').textContent=groups?'Choose a painting group':names[fieldId]||'Choose';
    dialog.querySelector('.atlas-picker-back').hidden=!(groupStep&&fieldId==='atlas-map');
    let grouped=false;
    for(const option of field.options){
      const isPaired=option.value.startsWith('paired-');if(groups&&!isPaired)continue;
      if(!groups&&fieldId==='atlas-map'&&isPaired&&grouped)continue;
      const item=doc.createElement('button');item.type='button';
      const title=doc.createElement('span');
      if(!groups&&fieldId==='atlas-map'&&isPaired){
        grouped=true;item.dataset.pickerFamily='paired';item.setAttribute('aria-pressed',String(paired.some(entry=>entry.selected)));item.append(title);colourLabel(title,'Preference & curiosity',option.value);
        const detail=doc.createElement('small');detail.textContent=paired.length+' painting '+(paired.length===1?'group':'groups');item.append(detail);
      }else{
        item.dataset.pickerValue=option.value;item.setAttribute('aria-pressed',String(option.selected));
        const info=previews[option.value];
        if(groups&&info){item.append(preview(info.images,'atlas-group-preview'));title.textContent=info.label;item.append(title);item.setAttribute('aria-label',info.images.map(image=>image.title).join(', ')+'. '+info.label);}
        else{item.append(title);colourLabel(title,shortLabel(option.textContent),option.value);if(option.dataset.detail){const detail=doc.createElement('small');detail.textContent=option.dataset.detail;item.append(detail);}}
      }
      host.append(item);
    }
  }
  dialog.querySelector('.atlas-picker-back').addEventListener('click',()=>renderOptions(false));
  dialog.addEventListener('click',event=>{
    if(event.target.closest('[data-picker-family]')){renderOptions(true);return;}
    const choice=event.target.closest('[data-picker-value]');
    if(choice){const field=doc.getElementById(fieldId);if(field){field.value=choice.dataset.pickerValue;field.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));}close();return;}
    if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}
  });
  dialog.addEventListener('close',()=>{doc.body.classList.remove('atlas-dialog-open');[...root.querySelectorAll('[data-select]')].find(el=>el.dataset.select===fieldId)?.focus({preventScroll:true});doc.defaultView.scrollTo({top:position,behavior:'instant'});});
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-select]');if(!button)return;const field=doc.getElementById(button.dataset.select);if(!field)return;
    fieldId=field.id;position=doc.defaultView.scrollY;renderOptions();doc.body.classList.add('atlas-dialog-open');dialog.showModal();dialog.querySelector('[data-picker-close]').focus({preventScroll:true});doc.defaultView.scrollTo({top:position,behavior:'instant'});
  });
  return {decorate(controls,details={},paintingGroups={},choiceColours={}){
    previews=paintingGroups;colours=choiceColours;
    for(const field of controls.querySelectorAll('select')){
      for(const option of field.options)if(details[option.value])option.dataset.detail=details[option.value];
      field.hidden=true;field.setAttribute('aria-hidden','true');
      const button=doc.createElement('button');button.type='button';button.className='atlas-choice-button';button.dataset.select=field.id;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',dialog.id);
      const selected=field.selectedOptions[0],info=previews[selected?.value],title=doc.createElement('span');title.className='atlas-current-choice';
      if(field.id==='atlas-paired'&&info)button.append(preview(info.images,'atlas-mini-group'));
      else{button.append(title);colourLabel(title,shortLabel(selected?.textContent||'Choose'),selected?.value);}
      const chevron=doc.createElement('span');chevron.className='atlas-edit-action';chevron.setAttribute('aria-hidden','true');chevron.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m4.5 6.25 3.5 3.5 3.5-3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';button.append(chevron);
      button.setAttribute('aria-label',(names[field.id]||'Choose')+': '+(field.id==='atlas-paired'?info?.label||'Paintings':title.textContent));field.after(button);
    }
  }};
}
