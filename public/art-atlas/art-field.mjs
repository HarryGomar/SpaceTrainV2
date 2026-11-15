export function fieldRandom(seed=9317){let value=seed>>>0;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createArtField({mobile=false,workCount=1,seed=9317}={}){
  const random=fieldRandom(seed),normal=()=>Math.sqrt(-2*Math.log(Math.max(.0001,random())))*Math.cos(random()*Math.PI*2),count=Number.isFinite(workCount)?Math.max(0,Math.floor(workCount)):0,heroCount=Math.min(mobile?10:14,count);
  function position(index,hero=false){
    const lobe=Math.floor(random()*4),angle=hero?index/Math.max(1,heroCount)*Math.PI*2+.13:(random()<.73?lobe*Math.PI*.5+.28+normal()*.31:random()*Math.PI*2);
    const radius=hero?.94+random()*.12:clamp(.91+normal()*.19,.5,1.42);
    return [Math.cos(angle)*radius*1.06,Math.sin(angle)*radius*.94,hero?.2+random()*.5:clamp(normal()*.7-.48,-2.3,.85)];
  }
  const paintings=Array.from({length:count},(_,index)=>{
    const hero=index<heroCount,near=!hero&&index<Math.max(heroCount,Math.floor(count*.16)),far=index>=Math.max(heroCount,Math.floor(count*.68)),xyz=position(index,hero);
    if(far)xyz[2]-=.65;
    return {position:xyz,edge:hero?.35+random()*.17:near?.19+random()*.12:far?.04+random()*.07:.07+random()*.11,angle:(random()-.5)*(hero?.07:.18),seed:random()*1000,workIndex:index,hero};
  }).sort((a,b)=>a.position[2]-b.position[2]);
  const particles=Array.from({length:count?(mobile?9600:26000):0},(_,index)=>({position:position(index),size:.55+random()*1.5,seed:random()*1000,workIndex:Math.floor(random()*count),sample:[.1+random()*.8,.1+random()*.8]}));
  return {paintings,particles};
}

export function updateFieldPointer(pointer,{x,y,time,active=true},dt=1/60){
  const step=clamp(dt,0,.05),amount=1-Math.exp(-step*5),lastX=pointer.x,lastY=pointer.y;
  pointer.x+=(x-pointer.x)*amount;pointer.y+=(y-pointer.y)*amount;
  const speed=Math.hypot(pointer.x-lastX,pointer.y-lastY)/Math.max(step,.001);
  pointer.energy+=(Math.min(speed*.14,.6)-pointer.energy)*(1-Math.exp(-step*3));
  if(!active)pointer.energy*=Math.exp(-step*3);
  pointer.time=time;return pointer;
}
