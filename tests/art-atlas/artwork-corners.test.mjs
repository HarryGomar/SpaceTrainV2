import test from 'node:test';
import assert from 'node:assert/strict';
import {updateArtworkCorners} from '../../public/art-atlas/artwork-corners.mjs';

function measure({frame=[400,300],image=[400,240],natural=[800,400],offset=[0,10],scale=1}={}){
  const values={};
  const img={clientWidth:image[0],clientHeight:image[1],naturalWidth:natural[0],naturalHeight:natural[1],getBoundingClientRect:()=>({left:100+offset[0]*scale,top:100+offset[1]*scale,width:image[0]*scale,height:image[1]*scale})};
  const node={clientWidth:frame[0],clientHeight:frame[1],style:{setProperty:(name,value)=>{values[name]=value;}},querySelector:()=>img,getBoundingClientRect:()=>({left:100,top:100,width:frame[0]*scale,height:frame[1]*scale})};
  updateArtworkCorners({querySelectorAll:()=>[node]});return values;
}

test('Corners centre on the visible image when its frame is taller',()=>{
  const values=measure();
  assert.equal(values['--art-content-width'],'400px');assert.equal(values['--art-content-height'],'200px');
  assert.equal(values['--art-center-x'],'200px');assert.equal(values['--art-center-y'],'130px');
});
test('A portrait gets image-sized corners inside a wider image box',()=>{
  const values=measure({frame:[400,500],image:[400,500],natural:[200,400],offset:[0,0]});
  assert.equal(values['--art-content-width'],'250px');assert.equal(values['--art-content-height'],'500px');assert.equal(values['--art-center-x'],'200px');assert.equal(values['--art-center-y'],'250px');
});
test('Ancestor scale does not double the local corner offsets',()=>{
  const values=measure({frame:[400,500],image:[400,450],offset:[0,10],scale:2});
  assert.equal(values['--art-center-x'],'200px');assert.equal(values['--art-center-y'],'235px');
});
