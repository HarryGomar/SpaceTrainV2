export function fieldRandom(seed=9317){let value=seed>>>0;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const FIELD_MOTION=Object.freeze({pointerFollow:4.8,presenceRise:3.6,presenceFall:4.1,presence:.9,radiusSquared:.34,repulsion:.26,directionSoftness:.14,parallaxX:.034,parallaxY:.025});

export function createArtField({mobile=false,workCount=1,seed=9317}={}){
  const random=fieldRandom(seed),normal=()=>Math.sqrt(-2*Math.log(Math.max(.0001,random())))*Math.cos(random()*Math.PI*2),count=Number.isFinite(workCount)?Math.max(0,Math.floor(workCount)):0,heroCount=Math.min(14,count),rotation=random()*Math.PI*2;
  function position(index,hero=false){
    const lobe=Math.floor(random()*4),angle=hero?index/Math.max(1,heroCount)*Math.PI*2+rotation:(random()<.73?lobe*Math.PI*.5+.28+normal()*.31:random()*Math.PI*2);
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
  const step=clamp(Number.isFinite(dt)?dt:1/60,0,.05),amount=1-Math.exp(-step*FIELD_MOTION.pointerFollow);
  pointer.x=Number.isFinite(pointer.x)?pointer.x:0;pointer.y=Number.isFinite(pointer.y)?pointer.y:0;pointer.energy=Number.isFinite(pointer.energy)?clamp(pointer.energy,0,1):0;
  const targetX=Number.isFinite(x)?clamp(x,-1.2,1.2):pointer.x,targetY=Number.isFinite(y)?clamp(y,-1.2,1.2):pointer.y;
  pointer.x+=(targetX-pointer.x)*amount;pointer.y+=(targetY-pointer.y)*amount;
  const target=active?FIELD_MOTION.presence:0,rate=active?FIELD_MOTION.presenceRise:FIELD_MOTION.presenceFall;
  pointer.energy+=(target-pointer.energy)*(1-Math.exp(-step*rate));
  if(Number.isFinite(time))pointer.time=time;return pointer;
}

/** Canvas fallback and geometry checks share the shader's static mouse force.
 * No velocity derivative or time-oscillating side-force enters the interaction. */
export function interactFieldPoint(point,pointer,{aspect=1,z=0}={}){
  const ratio=Number.isFinite(aspect)&&aspect>0?aspect:1,energy=clamp(Number.isFinite(pointer.energy)?pointer.energy:0,0,1),depth=clamp((z+2)/3,0,1),weight=.45+(.9-.45)*depth;
  const x=point[0]+pointer.x*energy*FIELD_MOTION.parallaxX*(.55+depth*.45),y=point[1]+pointer.y*energy*FIELD_MOTION.parallaxY*(.55+depth*.45),dx=(x-pointer.x)*ratio,dy=y-pointer.y,distance=Math.hypot(dx,dy),force=Math.exp(-distance*distance/FIELD_MOTION.radiusSquared)*energy*weight*FIELD_MOTION.repulsion;
  return [x+dx/(distance+FIELD_MOTION.directionSoftness)*force/ratio,y+dy/(distance+FIELD_MOTION.directionSoftness)*force];
}
