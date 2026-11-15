// Place the selection marks around the contained painting, including portrait and panorama images.
export function updateArtworkCorners(root) {
  for (const frame of root.querySelectorAll('.art-visual')) {
    const img=frame.querySelector('img');
    if(!img?.naturalWidth || !img.naturalHeight)continue;
    const frameBox=frame.getBoundingClientRect(),imageBox=img.getBoundingClientRect();
    const measuredX=frameBox.width/(frame.clientWidth||frameBox.width),measuredY=frameBox.height/(frame.clientHeight||frameBox.height);
    const scaleX=Math.abs(measuredX-1)<.01?1:measuredX,scaleY=Math.abs(measuredY-1)<.01?1:measuredY;
    const width=imageBox.width/scaleX,height=imageBox.height/scaleY,ratio=img.naturalWidth/img.naturalHeight;
    if(!width||!height)continue;
    frame.style.setProperty('--art-content-width',Math.min(width,height*ratio)+'px');
    frame.style.setProperty('--art-content-height',Math.min(height,width/ratio)+'px');
    frame.style.setProperty('--art-center-x',((imageBox.left-frameBox.left)/scaleX+width/2)+'px');
    frame.style.setProperty('--art-center-y',((imageBox.top-frameBox.top)/scaleY+height/2)+'px');
  }
}
