import {FIELD_MOTION} from './art-field.mjs';

const COMMON=`
uniform float u_time;
uniform vec2 u_pointer;
uniform float u_energy;
uniform float u_aspect;
uniform vec2 u_resolution;
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 flow(vec3 base,float seed){
 vec3 p=base;float t=u_time*.04;
 float wave=noise(base*1.25+vec3(t,0.,-t))-.5;
 p.x+=sin(t*.64+base.y*2.8+seed)*.012+wave*.020;
 p.y+=cos(t*.58+base.x*3.1+seed*.13)*.012+wave*.018;
 p.z+=sin(t*.71+seed+base.x*1.4)*.028;
 float yaw=sin(u_time*.02)*.010;
 p.x=p.x*cos(yaw)+p.z*sin(yaw)*.15;
 return p;
}
vec2 project(vec3 p){float d=3.6/(3.6-p.z);return vec2(p.x,p.y)*d;}
vec2 interact(vec2 p,float z,float seed){
 float depth=clamp((z+2.)/3.,0.,1.);
 p+=u_pointer*u_energy*vec2(${FIELD_MOTION.parallaxX},${FIELD_MOTION.parallaxY})*(.55+depth*.45);
 vec2 delta=(p-u_pointer)*vec2(u_aspect,1.);float distance=length(delta);
 float envelope=exp(-distance*distance/${FIELD_MOTION.radiusSquared})*u_energy;
 vec2 direction=delta/(distance+${FIELD_MOTION.directionSoftness});
 return p+direction*${FIELD_MOTION.repulsion}*envelope*mix(.45,.9,depth)/vec2(u_aspect,1.);
}
float clearing(vec2 p){return smoothstep(.34,.70,length(p*vec2(1.65,2.6)));}
`;
const ART_VERTEX=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec4 a_geometry;
layout(location=2) in vec4 a_tile;
layout(location=3) in vec2 a_corner;
${COMMON}
out vec2 v_uv;out vec4 v_tile;out float v_alpha;out float v_blur;out vec2 v_local;
void main(){
 vec3 p=flow(a_position,a_geometry.w);vec2 center=interact(project(p),p.z,a_geometry.w);
 float depth=3.6/(3.6-p.z),angle=a_geometry.z+sin(u_time*.13+a_geometry.w)*.012;
 vec2 q=a_corner*a_geometry.xy; q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;
 vec2 xy=center+q*depth/vec2(u_aspect,1.);
 gl_Position=vec4(xy,0.,1.);v_local=a_corner+.5;v_tile=a_tile;v_uv=mix(a_tile.xy,a_tile.zw,v_local);
 float focus=abs(p.z-.35);v_blur=clamp(focus*.68,0.,1.6);
 float fog=clamp((p.z+2.9)/3.5,.03,.95);v_alpha=fog*.83*clearing(xy);
}
`;
const ART_FRAGMENT=`#version 300 es
precision highp float;
uniform sampler2D u_atlas;
in vec2 v_uv;in vec4 v_tile;in float v_alpha;in float v_blur;in vec2 v_local;
out vec4 outColor;
void main(){
 vec2 du=fwidth(v_uv)*v_blur;
 vec4 c=texture(u_atlas,v_uv)*.36;
 c+=(texture(u_atlas,clamp(v_uv+vec2(du.x,0.),v_tile.xy,v_tile.zw))+texture(u_atlas,clamp(v_uv-vec2(du.x,0.),v_tile.xy,v_tile.zw))+texture(u_atlas,clamp(v_uv+vec2(0.,du.y),v_tile.xy,v_tile.zw))+texture(u_atlas,clamp(v_uv-vec2(0.,du.y),v_tile.xy,v_tile.zw)))*.16;
 float luma=dot(c.rgb,vec3(.2126,.7152,.0722));c.rgb=mix(vec3(luma)*vec3(1.025,1.,.965),c.rgb,.76);
 float edge=smoothstep(0.,.012,min(min(v_local.x,v_local.y),min(1.-v_local.x,1.-v_local.y)));
 outColor=vec4(c.rgb,c.a*v_alpha*edge);
}
`;
const DOT_VERTEX=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;layout(location=1) in vec2 a_shape;layout(location=2) in vec2 a_uv;
${COMMON}
out float v_alpha;out vec2 v_uv;
void main(){vec3 p=flow(a_position,a_shape.y);vec2 xy=interact(project(p),p.z,a_shape.y);gl_Position=vec4(xy,0.,1.);float d=3.6/(3.6-p.z);gl_PointSize=clamp(a_shape.x*d*u_resolution.y/820.,.8,3.8);v_alpha=clearing(xy)*(.13+clamp((p.z+2.)/3.,0.,1.)*.32);v_uv=a_uv;}
`;
const DOT_FRAGMENT=`#version 300 es
precision highp float;
uniform sampler2D u_atlas;in float v_alpha;in vec2 v_uv;out vec4 outColor;
void main(){float radius=length(gl_PointCoord-.5);if(radius>.5)discard;vec4 c=texture(u_atlas,v_uv);float l=dot(c.rgb,vec3(.2126,.7152,.0722));vec3 ink=mix(vec3(l)*vec3(1.03,.99,.94),c.rgb,.34);ink=mix(ink,vec3(.43,.40,.35),.16);float a=(1.-smoothstep(.12,.5,radius))*v_alpha;outColor=vec4(ink,a);}
`;

function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error);}return s;}
function program(gl,vertex,fragment){const v=shader(gl,gl.VERTEX_SHADER,vertex),f=shader(gl,gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const error=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw Error(error);}return {p,uniforms:Object.fromEntries(['u_time','u_pointer','u_energy','u_aspect','u_resolution','u_atlas'].map(k=>[k,gl.getUniformLocation(p,k)]))};}
function mesh(gl,data,stride,attributes){const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);for(const [location,size,offset] of attributes){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,stride*4,offset*4);}gl.bindVertexArray(null);return {vao,buffer,count:data.length/stride};}

export function createOpeningRenderer(canvas){
  // Keep the shader surface separate from the page compositor. Some embedded
  // browsers otherwise stop repainting static text above a moving WebGL layer.
  const surface=canvas.ownerDocument.createElement('canvas');
  const gl=surface.getContext('webgl2',{alpha:true,antialias:true,depth:false,stencil:false,powerPreference:'low-power'});if(!gl)return null;
  const output=canvas.getContext('2d',{alpha:false});if(!output)return null;
  let art,dots,artMesh,dotMesh,texture;
  try{art=program(gl,ART_VERTEX,ART_FRAGMENT);dots=program(gl,DOT_VERTEX,DOT_FRAGMENT);texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([160,150,135,255]));}catch(error){canvas.dataset.sceneError=String(error.message).slice(0,180);return null;}
  gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);
  function releaseMesh(m){if(m){gl.deleteBuffer(m.buffer);gl.deleteVertexArray(m.vao);}}
  return {
    type:'webgl2',
    setField(field,sources){
      releaseMesh(artMesh);releaseMesh(dotMesh);
      const vertices=[],points=[],corners=[[-.5,-.5],[.5,-.5],[-.5,.5],[-.5,.5],[.5,-.5],[.5,.5]];
      for(const item of field.paintings){const source=sources[item.workIndex%sources.length];if(!source?.loaded)continue;const ratio=source.ratio,w=ratio>1?item.edge:item.edge*ratio,h=ratio>1?item.edge/ratio:item.edge;for(const q of corners)vertices.push(...item.position,w,h,item.angle,item.seed,...source.uv,...q);}
      for(const item of field.particles){const s=sources[item.workIndex%sources.length],uv=s?.loaded?[s.uv[0]+(s.uv[2]-s.uv[0])*item.sample[0],s.uv[1]+(s.uv[3]-s.uv[1])*item.sample[1]]:[.005,.005];points.push(...item.position,item.size,item.seed,...uv);}
      artMesh=mesh(gl,vertices,13,[[0,3,0],[1,4,3],[2,4,7],[3,2,11]]);dotMesh=mesh(gl,points,7,[[0,3,0],[1,2,3],[2,2,5]]);
    },
    setAtlas(atlas,complete){gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);if(complete){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}},
    resize(){surface.width=canvas.width;surface.height=canvas.height;gl.viewport(0,0,surface.width,surface.height);},
    draw({time,pointer,width,height}){
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
      for(const [object,m,mode] of [[dots,dotMesh,gl.POINTS],[art,artMesh,gl.TRIANGLES]]){if(!m?.count)continue;gl.useProgram(object.p);const u=object.uniforms;gl.uniform1f(u.u_time,time);gl.uniform2f(u.u_pointer,pointer.x,pointer.y);gl.uniform1f(u.u_energy,pointer.energy);gl.uniform1f(u.u_aspect,width/Math.max(height,1));gl.uniform2f(u.u_resolution,canvas.width,canvas.height);gl.uniform1i(u.u_atlas,0);gl.bindVertexArray(m.vao);gl.drawArrays(mode,0,m.count);}gl.bindVertexArray(null);
      output.fillStyle='#f5f4f1';output.fillRect(0,0,canvas.width,canvas.height);output.drawImage(surface,0,0);
    },
    destroy(){releaseMesh(artMesh);releaseMesh(dotMesh);gl.deleteTexture(texture);gl.deleteProgram(art.p);gl.deleteProgram(dots.p);artMesh=null;dotMesh=null;surface.width=1;surface.height=1;gl.getExtension('WEBGL_lose_context')?.loseContext();}
  };
}
