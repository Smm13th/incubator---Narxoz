import * as THREE from 'three';
import {W,H,RA,RS,ZONE,START,VMAX,MAXPULL,K,GROUND_PALETTES} from './config.js';

const cv=document.getElementById('cv');
const scene=new THREE.Scene();
scene.background=new THREE.Color('#12303f');
scene.fog=new THREE.Fog('#12303f',28,55);
const camera=new THREE.PerspectiveCamera(30,2/3,.1,100);
camera.position.set(0,17,18);camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
cv.appendChild(renderer.domElement);
const ambient=new THREE.HemisphereLight(0xd9edff,0x57351d,2.1);scene.add(ambient);
const sun=new THREE.DirectionalLight(0xffe1a6,3.2);sun.position.set(-8,16,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const rim=new THREE.PointLight(0x38bdf8,28,24);rim.position.set(5,7,-7);scene.add(rim);
const boardGroup=new THREE.Group();scene.add(boardGroup);
const fieldMat=new THREE.MeshStandardMaterial({color:'#ddc28c',roughness:.9,metalness:0});
const field=new THREE.Mesh(new THREE.PlaneGeometry(8.4,15.8),fieldMat);field.rotation.x=-Math.PI/2;field.position.y=-.16;field.receiveShadow=true;boardGroup.add(field);
const borderMat=new THREE.MeshStandardMaterial({color:'#843b27',roughness:.65});
function rail(w,h,x,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,.32,h),borderMat);m.position.set(x,.02,z);m.castShadow=true;m.receiveShadow=true;boardGroup.add(m);}
rail(8.8,.22,0,-7.92);rail(8.8,.22,0,7.92);rail(.22,15.8,-4.29,0);rail(.22,15.8,4.29,0);
function flatLine(points,color,width=.035,y=-.105){const geo=new THREE.BufferGeometry().setFromPoints(points.map(([x,z])=>new THREE.Vector3(x,y,z)));const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color}));boardGroup.add(line);return line;}
function dashedRect(x1,z1,x2,z2,color){const points=[];const n=14;for(let i=0;i<n;i+=2){const a=i/n,b=(i+1)/n;points.push([[x1+(x2-x1)*a,z1],[x1+(x2-x1)*b,z1]],[[x1+(x2-x1)*a,z2],[x1+(x2-x1)*b,z2]],[[x1,z1+(z2-z1)*a],[x1,z1+(z2-z1)*b]],[[x2,z1+(z2-z1)*a],[x2,z1+(z2-z1)*b]]);}for(const seg of points)flatLine(seg,color,.035,-.09);}
const zoneX=(ZONE.x/W-.5)*8,zoneX2=((ZONE.x+ZONE.w)/W-.5)*8;
const zoneZ=(ZONE.y/H-.5)*15,zoneZ2=((ZONE.y+ZONE.h)/H-.5)*15;
dashedRect(zoneX,zoneZ,zoneX2,zoneZ2,'#9a3e2b');
flatLine([[-3.8,(START.y+40)/H*15-7.5],[3.8,(START.y+40)/H*15-7.5]],'#9a3e2b',.035,-.08);
function makeLabel(text,color='#fff1d0'){const c=document.createElement('canvas');c.width=512;c.height=96;const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.font='bold 42px Georgia';g.textAlign='center';g.textBaseline='middle';g.fillStyle=color;g.shadowColor='#06131c';g.shadowBlur=10;g.fillText(text,256,48);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});const spr=new THREE.Sprite(mat);spr.scale.set(3.2,.6,1);return spr;}
const zoneLabel=makeLabel('КОН');zoneLabel.position.set(0,.03,zoneZ-.38);scene.add(zoneLabel);
const lineLabel=makeLabel('ЛИНИЯ БРОСКА','#d5bc89');lineLabel.position.set(0,.03,(START.y+62)/H*15-7.5);scene.add(lineLabel);
const bodyMat=new THREE.MeshStandardMaterial({color:'#e7dfc5',roughness:.42,metalness:.08});
const accentMat=new THREE.MeshStandardMaterial({color:'#8e6842',roughness:.55});
const sakaMats={gold:new THREE.MeshStandardMaterial({color:'#f2b632',metalness:.68,roughness:.22}),neon:new THREE.MeshStandardMaterial({color:'#39ff14',emissive:'#164d08',metalness:.25,roughness:.2}),ice:new THREE.MeshStandardMaterial({color:'#70d6ff',metalness:.5,roughness:.18}),ruby:new THREE.MeshStandardMaterial({color:'#ff4d6d',metalness:.48,roughness:.22})};
function makeAsyk(saka=false,skins={saka:'gold'}){const group=new THREE.Group();const mat=saka?sakaMats[skins.saka]||sakaMats.gold:bodyMat;const sphere=new THREE.SphereGeometry(1,24,16);function lump(x,z,sx,sy,sz){const m=new THREE.Mesh(sphere,mat);m.position.set(x,.16,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;group.add(m);}lump(0,0,saka?.38:.28,saka?.24:.2,saka?.31:.23);lump(-.22,0,.19,.16,.19);lump(.22,0,.19,.16,.19);if(saka){const ring=new THREE.Mesh(new THREE.TorusGeometry(.22,.035,8,28),new THREE.MeshStandardMaterial({color:'#8a5a00',metalness:.55,roughness:.24}));ring.rotation.x=Math.PI/2;ring.position.y=.35;group.add(ring);}else{const groove=new THREE.Mesh(new THREE.TorusGeometry(.16,.018,6,24),accentMat);groove.rotation.x=Math.PI/2;groove.position.y=.32;group.add(groove);}group.userData.isSaka=saka;return group;}
let targetMeshes=[],sakaMesh=null,aimLine=null,fxSprites=[];
const aimDotGeometry=new THREE.SphereGeometry(.085,12,10);
const aimDotMaterial=new THREE.MeshBasicMaterial({color:'#00d9ff',depthTest:false,toneMapped:false});
const aimArrowGeometry=new THREE.ConeGeometry(.15,.38,16);
const aimArrowMaterial=new THREE.MeshBasicMaterial({color:'#ff4b22',depthTest:false,toneMapped:false});
function resize3d(){const w=Math.max(1,cv.clientWidth),h=Math.max(1,cv.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
resize3d();window.addEventListener('resize',resize3d);
const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2(),playPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hitPoint=new THREE.Vector3();
const worldPoint=(x,y)=>new THREE.Vector3((x/W-.5)*8,0,(y/H-.5)*15);
export const pos=e=>{const r=cv.getBoundingClientRect();pointerNdc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height*2-1));raycaster.setFromCamera(pointerNdc,camera);if(raycaster.ray.intersectPlane(playPlane,hitPoint))return{x:(hitPoint.x/8+.5)*W,y:(hitPoint.z/15+.5)*H};return{x:W/2,y:H/2};};



/* ========= Отрисовка ========= */
function updateGroundTheme(SKINS){
  const theme=GROUND_PALETTES[SKINS.ground]||GROUND_PALETTES.sand;
  fieldMat.color.set(theme.g1);borderMat.color.set(theme.border);
  scene.background.set(SKINS.ground==='cyber'?'#080d21':SKINS.ground==='emerald'?'#123a2d':'#12303f');
  scene.fog.color.copy(scene.background);
}
function ensureMeshes(S,SKINS){
  while(targetMeshes.length<S.ast.length){const m=makeAsyk(false,SKINS);scene.add(m);targetMeshes.push(m);}
  while(targetMeshes.length>S.ast.length){const m=targetMeshes.pop();scene.remove(m);}
  if(!sakaMesh){sakaMesh=makeAsyk(true,SKINS);scene.add(sakaMesh);}
  const desired=sakaMats[SKINS.saka]||sakaMats.gold;
  sakaMesh.traverse(o=>{if(o.isMesh&&o.geometry.type==='SphereGeometry')o.material=desired;});
}
function updateAim(S){
  if(aimLine){aimLine.traverse(o=>{if(o.isLine){o.geometry.dispose();o.material.dispose();}});scene.remove(aimLine);aimLine=null;}
  if(!S||!S.drag||S.phase!=='aim')return;
  const px=S.drag.x0-S.drag.x,py=S.drag.y0-S.drag.y,len=Math.hypot(px,py);
  if(len<14)return;
  const reach=Math.min(len,MAXPULL)/MAXPULL*VMAX/K,ux=px/len,uy=py/len;
  aimLine=new THREE.Group();
  const path=[];
  for(let d=8;d<reach;d+=18){
    const p=worldPoint(S.saka.x+ux*d,S.saka.y+uy*d);p.y=.28;path.push(p);
    const dot=new THREE.Mesh(aimDotGeometry,aimDotMaterial);dot.position.copy(p);dot.renderOrder=20;aimLine.add(dot);
  }
  if(path.length>1){
    const geometry=new THREE.BufferGeometry().setFromPoints(path);
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#ff4b22',depthTest:false,toneMapped:false}));
    line.renderOrder=19;aimLine.add(line);
  }
  const tip=worldPoint(S.saka.x+ux*reach,S.saka.y+uy*reach);tip.y=.3;
  const arrow=new THREE.Mesh(aimArrowGeometry,aimArrowMaterial);
  arrow.position.copy(tip);
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(ux,0,uy).normalize());
  arrow.renderOrder=21;aimLine.add(arrow);scene.add(aimLine);
}
function updateFx(S,dt){
  for(const f of fxSprites){f.userData.life-=dt;f.position.y+=dt*.45;f.material.opacity=Math.max(0,f.userData.life);}
  fxSprites=fxSprites.filter(f=>{if(f.userData.life<=0){scene.remove(f);f.material.map.dispose();f.material.dispose();return false;}return true;});
  if(S&&S.fl.length){for(const f of S.fl){if(f._shown)continue;f._shown=true;const spr=makeLabel(f.txt,'#ffd75c');const p=worldPoint(f.x,f.y);spr.position.set(p.x,.65,p.z);spr.userData.life=1;fxSprites.push(spr);scene.add(spr);}}
}
export function draw3D(dt,S,SKINS){
  if(SKINS.ground!==document.body.dataset.ground){document.body.dataset.ground=SKINS.ground;updateGroundTheme(SKINS);}
  if(S){ensureMeshes(S,SKINS);S.ast.forEach((a,i)=>{const p=worldPoint(a.x,a.y),m=targetMeshes[i];m.position.set(p.x,.02,p.z);m.rotation.set(0,a.rot*.22,a.rot);});if(S.phase!=='edit'){const p=worldPoint(S.saka.x,S.saka.y);sakaMesh.visible=true;sakaMesh.position.set(p.x,.08,p.z);sakaMesh.rotation.set(0,0,Math.sin(performance.now()*.002)*.08);}else sakaMesh.visible=false;}
  else {targetMeshes.forEach(m=>scene.remove(m));targetMeshes=[];if(sakaMesh)sakaMesh.visible=false;}
  updateAim(S);updateFx(S,dt);renderer.render(scene,camera);
}


