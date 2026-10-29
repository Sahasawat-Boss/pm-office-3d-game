import * as THREE from 'three';
import './style.css';
import { $, clamp, rnd, rndInt, pick, fmt, fmtK } from './utils.js';
import { ROLES, PRIW, LEVELS } from './data/levels.js';
import { Snd } from './audio.js';

/* ================= SETTINGS (แยก key จาก save — Reset Progress ไม่ล้างค่าตั้ง) ================= */
const OPT_KEY='pmoffice3d-opt';
const OPT=Object.assign({pace:'normal',theme:'cream',autoPull:true,shadows:true,autoPause:true,idleSnd:true},(()=>{ try{ return JSON.parse(localStorage.getItem(OPT_KEY)||'{}'); }catch(e){ return {}; } })());
function saveOpt(){ try{ localStorage.setItem(OPT_KEY,JSON.stringify(OPT)); }catch(e){} }
const PACE={slow:{sec:6.5,th:'ช้า'},normal:{sec:4.5,th:'ปกติ'},fast:{sec:3,th:'เร็ว'}};
const daySec=()=>(PACE[OPT.pace]||PACE.normal).sec;

/* ================= SAVE / STARS / UPGRADES ================= */
const SAVE_KEY='pmoffice3d-save';
let SAVE={coins:0,stars:{},up:{},best:{}};
try{ const j=JSON.parse(localStorage.getItem(SAVE_KEY)||'null'); if(j) SAVE=Object.assign(SAVE,j); }catch(e){}
LEVELS.forEach(L=>{ try{ const b=localStorage.getItem('pmoffice3d-best-'+L.id); if(b&&!SAVE.best[L.id]) SAVE.best[L.id]=b; }catch(e){} });
function persist(){ try{ localStorage.setItem(SAVE_KEY,JSON.stringify(SAVE)); }catch(e){} }
const OBJ={
  noBurn:{label:'ไม่มีใคร Burnout',ok:()=>S.burnouts===0,lock:()=>S.burnouts>0},
  budget25:{label:'งบเหลือ ≥ 25%',ok:()=>S.money>=S.budget*0.25},
  budget15:{label:'งบเหลือ ≥ 15%',ok:()=>S.money>=S.budget*0.15},
  bugs1:{label:'บั๊กไม่เกิน 1 ครั้ง',ok:()=>S.bugs<=1,lock:()=>S.bugs>1},
  bugs2:{label:'บั๊กไม่เกิน 2 ครั้ง',ok:()=>S.bugs<=2,lock:()=>S.bugs>2},
  noOT:{label:'ใช้ OT ไม่เกิน 1 วัน',ok:()=>S.otTime<=1,lock:()=>S.otTime>1},
  stake80:{label:'ลูกค้าพอใจ ≥ 80',ok:()=>S.stake>=80},
  noCut:{label:'ไม่ตัด Scope / ไม่ขอเลื่อน',ok:()=>S.cuts===0&&S.extensions===0,lock:()=>S.cuts>0||S.extensions>0},
  qual85:{label:'คุณภาพ ≥ 85',ok:()=>S.quality>=85},
  qual90:{label:'คุณภาพ ≥ 90',ok:()=>S.quality>=90},
  morale70:{label:'ขวัญทีมตอนจบ ≥ 70',ok:()=>avgMorale()>=70},
  noExt:{label:'ไม่ขอเลื่อน Deadline',ok:()=>S.extensions===0,lock:()=>S.extensions>0}
};
const LOBJ={cafe:['noBurn','budget25'],shop:['bugs1','noOT'],food:['stake80','noCut'],clinic:['qual85','noBurn'],game:['morale70','budget15'],erp:['noExt','bugs2'],bank:['qual90','noBurn']};
LEVELS.forEach(L=>L.obj=LOBJ[L.id]);
const starLabels=L=>['ส่งมอบครบทุกงาน'].concat(L.obj.map(k=>OBJ[k].label));
const popc=n=>(n&1)+((n>>1)&1)+((n>>2)&1);
const UPG=[
  {id:'coffee',icon:'☕',name:'เครื่องชงกาแฟพรีเมียม',desc:l=>'พัก/ประชุมแล้วหายเครียดเร็วขึ้น +'+(25*l)+'%'},
  {id:'chair',icon:'🪑',name:'เก้าอี้ Ergonomic',desc:l=>'ทำงานแล้วเครียดช้าลง −'+(12*l)+'%'},
  {id:'monitor',icon:'🖥️',name:'จอคู่ + อุปกรณ์โปร',desc:l=>'ทุกคนทำงานเร็วขึ้น +'+(6*l)+'%'},
  {id:'garden',icon:'🌿',name:'สวนในออฟฟิศ',desc:l=>'ขวัญทีมค่อย ๆ เพิ่ม +'+(0.8*l).toFixed(1)+'/วัน'},
  {id:'lounge',icon:'🎮',name:'มุมพักผ่อน',desc:l=>'Burnout ลาพักสั้นลง −'+(0.5*l)+' วัน'},
  {id:'cicd',icon:'🧪',name:'CI/CD + Test อัตโนมัติ',desc:l=>'โอกาสเกิดบั๊ก −'+(15*l)+'%'},
  {id:'client',icon:'📺',name:'จอ Dashboard ลูกค้า',desc:l=>'ลูกค้าพอใจเริ่ม +'+(5*l)+' และลดช้าลง '+(30*l)+'%'}
];
const UCOST=[30,70,130];
const ul=id=>SAVE.up[id]||0;

['pointerup','keydown','touchend'].forEach(ev=>addEventListener(ev,()=>Snd.init(),{passive:true}));
document.addEventListener('click',e=>{ if(e.target.closest('button')) Snd.play('click'); });
function syncSoundBtns(){ $('#sfxBtn').textContent=Snd.sfx?'🔊':'🔇'; $('#sfxBtn').classList.toggle('off',!Snd.sfx); $('#musBtn').classList.toggle('off',!Snd.mus); }
$('#sfxBtn').onclick=()=>{ Snd.init(); Snd.setSfx(!Snd.sfx); syncSoundBtns(); };
$('#musBtn').onclick=()=>{ Snd.init(); Snd.setMus(!Snd.mus); syncSoundBtns(); };
syncSoundBtns();

/* ================= 3D SCENE ================= */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled = OPT.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-10,10,10,-10,0.1,200);
let camAz = 0.78, camEl = 0.62, camZoom = 1;
const camTarget = new THREE.Vector3(0,0.6,0.4);

scene.add(new THREE.HemisphereLight(0xfff8ee,0xb49b7c,0.75));
const sun = new THREE.DirectionalLight(0xffffff,0.75);
sun.position.set(9,18,10); sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:60});
sun.shadow.bias = -0.0005;
scene.add(sun);
const winFill=new THREE.DirectionalLight(0xcfe9ff,0.18); winFill.position.set(5,6,-12); scene.add(winFill);   // แสงฟ้าอ่อนจากหน้าต่าง

const matCache = {};
function mat(color,opts){
  const k = color+'|'+JSON.stringify(opts||{});
  if(!opts && matCache[k]) return matCache[k];
  const m = new THREE.MeshStandardMaterial(Object.assign({color,roughness:0.82,metalness:0.02},opts||{}));
  if(!opts) matCache[k]=m;
  return m;
}
function mesh(geo,color,opts,parent,pos){
  const m = new THREE.Mesh(geo, color instanceof THREE.Material ? color : mat(color,opts));
  m.castShadow = true; m.receiveShadow = true;
  if(pos) m.position.set(pos[0],pos[1],pos[2]);
  if(parent) parent.add(m);
  return m;
}
const B = (x,y,z)=>new THREE.BoxGeometry(x,y,z);

// ---------- geometry / texture helpers ----------
// กล่องมุมมน: ดัด vertex ของ BoxGeometry ให้มุมเป็นทรงกลมรัศมี r (s = ความละเอียดมุม)
function RB(w,h,d,r,s){
  s=s||2; r=Math.max(0.001,Math.min(r,w/2-0.001,h/2-0.001,d/2-0.001));
  const n=2*s+1, g=new THREE.BoxGeometry(1,1,1,n,n,n), P=g.attributes.position, N=g.attributes.normal, a=new THREE.Vector3();
  const ax=u=>{ const k=Math.round((u+0.5)*n); return k<=s?[-(1-k/s),-1]:[(k-s-1)/s,1]; };
  const hx=w/2-r, hy=h/2-r, hz=d/2-r;
  for(let i=0;i<P.count;i++){
    const [x,sx]=ax(P.getX(i)), [y,sy]=ax(P.getY(i)), [z,sz]=ax(P.getZ(i));
    a.set(x,y,z).normalize();
    P.setXYZ(i,sx*hx+a.x*r,sy*hy+a.y*r,sz*hz+a.z*r); N.setXYZ(i,a.x,a.y,a.z);
  }
  return g;
}
function ctex(w,h,draw,rep){
  const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.anisotropy=renderer.capabilities.getMaxAnisotropy();
  if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep[0],rep[1]); }
  return t;
}
const lathe=(pts,seg)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg||20);
const shade=(c,l)=>new THREE.Color(c).offsetHSL(0,0,l).getHex();
function rrect(x,X,Y,w,h,r){ x.beginPath(); x.moveTo(X+r,Y); x.arcTo(X+w,Y,X+w,Y+h,r); x.arcTo(X+w,Y+h,X,Y+h,r); x.arcTo(X,Y+h,X,Y,r); x.arcTo(X,Y,X+w,Y,r); x.closePath(); }

const woodTex=ctex(256,256,(x,w,h)=>{
  x.fillStyle='#d9a066'; x.fillRect(0,0,w,h);
  for(let i=0;i<70;i++){ const y=Math.random()*h;
    x.strokeStyle=`rgba(${120+Math.random()*40|0},${70+Math.random()*30|0},30,${0.06+Math.random()*0.12})`; x.lineWidth=1+Math.random()*2;
    x.beginPath(); x.moveTo(0,y); x.bezierCurveTo(w*0.3,y+rnd(-8,8),w*0.7,y+rnd(-8,8),w,y+rnd(-4,4)); x.stroke(); }
});
const POT=lathe([[0,0],[0.21,0],[0.25,0.04],[0.29,0.48],[0.34,0.5],[0.34,0.6],[0.3,0.6],[0.29,0.55],[0,0.55]],18);
function makePlant(kind,potCol){
  const g=new THREE.Group();
  mesh(POT,potCol||0xc96f4a,null,g);
  mesh(new THREE.CylinderGeometry(0.28,0.28,0.03,16),0x5a3d2b,null,g,[0,0.55,0]);
  if(kind===1){ // snake plant
    for(let i=0;i<7;i++){ const a=i/7*Math.PI*2, hh=0.8+((i*37)%5)*0.12;
      const l=mesh(new THREE.ConeGeometry(0.08,hh,4),i%2?0x3e8f55:0x5aa86a,{flatShading:true},g,[Math.cos(a)*0.1,0.55+hh/2,Math.sin(a)*0.1]);
      l.scale.z=0.35; l.rotation.set(Math.sin(a)*0.2,a,-Math.cos(a)*0.2); }
  } else if(kind===2){ // ใบกว้างแบบ monstera
    for(let i=0;i<7;i++){ const st=new THREE.Group(); st.position.y=0.55; st.rotation.y=i/7*Math.PI*2+0.3; g.add(st);
      const tilt=0.35+((i*13)%3)*0.18, len=0.45+((i*7)%3)*0.12;
      const stem=mesh(new THREE.CylinderGeometry(0.012,0.018,len,5),0x2f7a45,null,st,[0,len/2*Math.cos(tilt),len/2*Math.sin(tilt)]); stem.rotation.x=tilt;
      const leaf=mesh(new THREE.CircleGeometry(0.24,9),i%2?0x2f8a4d:0x3e9b5b,{side:THREE.DoubleSide,flatShading:true},st,[0,len*Math.cos(tilt)+0.05,len*Math.sin(tilt)+0.12]);
      leaf.rotation.x=-Math.PI/2+tilt*1.4; leaf.scale.set(0.85,1.2,1); }
  } else { // พุ่มกลม
    [[0,0.95,0,0.42,0x3e9b5b],[0.2,1.25,0.08,0.3,0x52b56e],[-0.18,1.18,-0.1,0.3,0x2f8a4d],[0.05,1.45,-0.05,0.22,0x6cc77f]]
      .forEach(([x,y,z,r,c])=>mesh(new THREE.IcosahedronGeometry(r,1),c,{flatShading:true},g,[x,y,z]));
  }
  return g;
}

// ---------- ธีมสีออฟฟิศ (พื้น ผนัง พรม โซฟา) ----------
const THEMES={
  cream:{name:'ครีมอบอุ่น',sw:'#f7efe2',wall:0xf7efe2,wain:0xe9dcc6,panel:0xe2d3ba,sofa:0x14a38b,sofaD:0x0f8a75,
    floor:{c:['#e6c79a','#e0bf8f','#ead0a6','#dcb886','#e3c393'],seam:'#b8925f'},rug:['#d96c4f','#e8896d','#fff3e0']},
  mint:{name:'มินต์สดใส',sw:'#dff3ea',wall:0xe3f4ec,wain:0xc6e6d8,panel:0xb6dccb,sofa:0xff8a5b,sofaD:0xe86f40,
    floor:{c:['#f1e3cc','#ecdcc1','#f4e9d6','#e8d6b8','#efe1c8'],seam:'#c7b08c'},rug:['#3aa58a','#5cbfa3','#effaf5']},
  lavender:{name:'ลาเวนเดอร์',sw:'#ebe4f7',wall:0xeee8f8,wain:0xd8cdee,panel:0xcbbde6,sofa:0x7b5cd6,sofaD:0x6246b8,
    floor:{c:['#e9d9c8','#e3d1bd','#eee1d3','#dfcab3','#e7d6c4'],seam:'#bba088'},rug:['#c45d9a','#da82b5','#fdf0f7']},
  sky:{name:'ฟ้าทะเล',sw:'#e1effa',wall:0xe4f0fa,wain:0xc5dcef,panel:0xb3cfe8,sofa:0xffb627,sofaD:0xe09a10,
    floor:{c:['#d9dde3','#d2d7de','#e0e4e9','#cdd2da','#d6dbe1'],seam:'#a3abb8'},rug:['#2f6fd6','#4f8ae6','#eaf2ff']},
  modern:{name:'เทาโมเดิร์น',sw:'#d9dadd',wall:0xe2e3e6,wain:0x4a5160,panel:0x5a6272,sofa:0xe5484d,sofaD:0xc23a3f,
    floor:{c:['#8a6a4f','#7f6047','#94735a','#7a5b42','#876650'],seam:'#5b4332'},rug:['#2b3140','#3b4356','#e6e8ee']},
  night:{name:'สตูดิโอกลางคืน',night:true,sw:'#2b2f45',wall:0x353a55,wain:0x272b42,panel:0x2f3450,sofa:0xff5fa2,sofaD:0xd9407f,
    floor:{c:['#4a3a33','#433530','#52413a','#3f312b','#4b3c35'],seam:'#2b201c'},rug:['#7b2cbf','#9d4edd','#f4d9ff']}
};
function floorTex(T){ return ctex(512,512,(x,w,h)=>{
  const rows=8, ph=h/rows, cols=T.c;
  for(let r=0;r<rows;r++){ let px=-((r*157)%220);
    while(px<w){ const pw=170+((r*31+px)%140|0); x.fillStyle=cols[(r*3+(px/40|0))%cols.length]; x.fillRect(px,r*ph,pw,ph);
      x.strokeStyle='rgba(120,80,40,.10)'; x.lineWidth=1.5;
      for(let k=0;k<3;k++){ const y=r*ph+8+k*((ph-16)/2)+rnd(-3,3); x.beginPath(); x.moveTo(px,y); x.bezierCurveTo(px+pw*0.4,y+rnd(-5,5),px+pw*0.6,y+rnd(-5,5),px+pw,y); x.stroke(); }
      x.fillStyle=T.seam; x.fillRect(px+pw-2,r*ph,2,ph); px+=pw; }
    x.fillStyle=T.seam; x.fillRect(0,r*ph+ph-2,w,2); }
},[3,2.2]); }
function rugTex([outer,inner,line]){ return ctex(512,352,(x,w,h)=>{ x.clearRect(0,0,w,h);
  x.fillStyle=outer; rrect(x,0,0,w,h,40); x.fill();
  x.fillStyle=inner; rrect(x,18,18,w-36,h-36,28); x.fill();
  x.strokeStyle=line; x.lineWidth=4; x.setLineDash([14,10]); rrect(x,34,34,w-68,h-68,20); x.stroke(); x.setLineDash([]);
  x.globalAlpha=0.35; x.fillStyle=line; for(let i=0;i<5;i++) for(let j=0;j<3;j++){ x.beginPath(); x.arc(96+i*80,96+j*80,10,0,7); x.fill(); } }); }
function nightSky(){ return ctex(512,256,(x,w,h)=>{
  const gr=x.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#141a3a'); gr.addColorStop(1,'#3b2f6b'); x.fillStyle=gr; x.fillRect(0,0,w,h);
  x.fillStyle='#fff'; for(let i=0;i<60;i++){ x.globalAlpha=0.3+Math.random()*0.7; x.fillRect(Math.random()*w,Math.random()*h*0.6,2,2); } x.globalAlpha=1;
  x.fillStyle='#fff6d6'; x.beginPath(); x.arc(400,55,26,0,7); x.fill(); x.fillStyle='#141a3a'; x.beginPath(); x.arc(412,48,24,0,7); x.fill();
  let bx=0; while(bx<w){ const bw=30+Math.random()*50, bh=40+Math.random()*90; x.fillStyle=Math.random()<0.5?'#1f2547':'#262d55'; x.fillRect(bx,h-bh,bw,bh);
    for(let wy=h-bh+8;wy<h-6;wy+=12) for(let wx=bx+6;wx<bx+bw-6;wx+=10){ x.fillStyle=Math.random()<0.45?'#ffd66b':'#30386a'; x.fillRect(wx,wy,5,6); } bx+=bw+4; }
}); }
function applyTheme(id){
  const T=THEMES[id]||THEMES.cream;
  ROOM.wall.color.setHex(T.wall); ROOM.wain.color.setHex(T.wain); ROOM.panel.color.setHex(T.panel);
  if(T.night&&!ROOM.skyNight) ROOM.skyNight=nightSky();
  if(ROOM.win){ ROOM.win.map=T.night?ROOM.skyNight:ROOM.skyDay; ROOM.win.needsUpdate=true; }
  ROOM.sofa.color.setHex(T.sofa); ROOM.sofaD.color.setHex(T.sofaD);
  [['floor',floorTex(T.floor)],['rug',rugTex(T.rug)]].forEach(([k,t])=>{ const m=ROOM[k]; if(m.map) m.map.dispose(); m.map=t; m.needsUpdate=true; });
}

// room
const RX=9, RZ=6.6;
let clockH, clockM;
const ROOM={wall:new THREE.MeshStandardMaterial({roughness:0.9}),wain:new THREE.MeshStandardMaterial({roughness:0.9}),panel:new THREE.MeshStandardMaterial({roughness:0.9}),sofa:new THREE.MeshStandardMaterial({roughness:0.85}),sofaD:new THREE.MeshStandardMaterial({roughness:0.85})};
(function buildRoom(){
  // พื้นไม้ลายแผ่น
  const ft=floorTex(THEMES.cream.floor);
  const floor = mesh(B(RX*2,0.4,RZ*2), ROOM.floor=new THREE.MeshStandardMaterial({map:ft,roughness:0.75}), null, scene,[0,-0.2,0]);
  floor.castShadow=false;
  mesh(B(RX*2+0.6,0.5,0.3),0x8a6a4a,null,scene,[0,-0.25,RZ+0.15]).castShadow=false;
  mesh(B(0.3,0.5,RZ*2),0x8a6a4a,null,scene,[RX+0.15,-0.25,0]).castShadow=false;
  // ผนัง: ส่วนบน + บัวผนังล่าง (wainscot) + คิ้วไม้
  const wallM=ROOM.wall, wainM=ROOM.wain, trimM=mat(0xffffff);
  mesh(B(RX*2,4.6,0.3),wallM,null,scene,[0,2.3,-RZ-0.15]);
  mesh(B(0.3,4.6,RZ*2),wallM,null,scene,[-RX-0.15,2.3,0]);
  mesh(B(RX*2,1.2,0.06),wainM,null,scene,[0,0.6,-RZ+0.03]);
  mesh(B(0.06,1.2,RZ*2),wainM,null,scene,[-RX+0.03,0.6,0]);
  for(let i=-8;i<=8;i+=2) mesh(B(1.5,0.8,0.02),ROOM.panel,null,scene,[i,0.62,-RZ+0.065]).castShadow=false;
  for(let i=-5;i<=5;i+=2) mesh(B(0.02,0.8,1.5),ROOM.panel,null,scene,[-RX+0.065,0.62,i]).castShadow=false;
  mesh(RB(RX*2,0.08,0.12,0.03,1),trimM,null,scene,[0,1.22,-RZ+0.05]);
  mesh(RB(0.12,0.08,RZ*2,0.03,1),trimM,null,scene,[-RX+0.05,1.22,0]);
  mesh(B(RX*2,0.18,0.1),0xd9c7ab,null,scene,[0,0.09,-RZ+0.07]);
  mesh(B(0.1,0.18,RZ*2),0xd9c7ab,null,scene,[-RX+0.07,0.09,0]);
  mesh(B(RX*2,0.14,0.2),trimM,null,scene,[0,4.53,-RZ+0.05]);
  // หน้าต่าง: ท้องฟ้า + เมฆ + ตึกไกล ๆ
  const sky=ctex(512,256,(x,w,h)=>{
    const gr=x.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#7cc8ef'); gr.addColorStop(1,'#d9f1fb'); x.fillStyle=gr; x.fillRect(0,0,w,h);
    x.fillStyle='rgba(255,255,255,.9)';
    [[90,60,1],[300,45,1.3],[440,90,0.8]].forEach(([cx,cy,s])=>{ [[0,0,26],[24,-8,22],[48,0,24],[22,8,22]].forEach(([dx,dy,r])=>{ x.beginPath(); x.arc(cx+dx*s,cy+dy*s,r*s,0,7); x.fill(); }); });
    let bx=0; while(bx<w){ const bw=30+Math.random()*50, bh=40+Math.random()*90; x.fillStyle=Math.random()<0.5?'#a9c9da':'#b9d6e4'; x.fillRect(bx,h-bh,bw,bh);
      x.fillStyle='rgba(255,255,255,.45)'; for(let wy=h-bh+8;wy<h-6;wy+=12) for(let wx=bx+6;wx<bx+bw-6;wx+=10) x.fillRect(wx,wy,5,6); bx+=bw+4; }
  });
  const win=new THREE.Mesh(new THREE.PlaneGeometry(4.6,2.2),ROOM.win=new THREE.MeshBasicMaterial({map:ROOM.skyDay=sky})); win.position.set(4.6,2.6,-RZ+0.02); scene.add(win);
  const frM=mat(0xffffff);
  mesh(RB(4.9,0.16,0.2,0.05,1),frM,null,scene,[4.6,3.74,-RZ+0.08]);
  mesh(RB(4.9,0.16,0.2,0.05,1),frM,null,scene,[4.6,1.46,-RZ+0.08]);
  mesh(RB(0.16,2.4,0.2,0.05,1),frM,null,scene,[2.23,2.6,-RZ+0.08]);
  mesh(RB(0.16,2.4,0.2,0.05,1),frM,null,scene,[6.97,2.6,-RZ+0.08]);
  mesh(RB(0.1,2.2,0.12,0.03,1),frM,null,scene,[4.6,2.6,-RZ+0.06]);
  mesh(RB(4.6,0.06,0.1,0.02,1),frM,null,scene,[4.6,2.95,-RZ+0.05]);
  mesh(RB(5.2,0.08,0.4,0.03,1),frM,null,scene,[4.6,1.36,-RZ+0.2]);   // ขอบหน้าต่าง
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(4.6,2.2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.12})); glass.position.set(4.6,2.6,-RZ+0.07); scene.add(glass);
  // นาฬิกาแขวน (เข็มเดินตามเวลาในเกม 09:00–18:00)
  const ck=new THREE.Group(); ck.position.set(-RX+0.04,3.75,3.5); ck.rotation.y=Math.PI/2; scene.add(ck);
  mesh(new THREE.CylinderGeometry(0.45,0.45,0.06,32),0xffffff,null,ck,[0,0,0.03]).rotation.x=Math.PI/2;
  mesh(new THREE.TorusGeometry(0.45,0.045,8,32),0x1d2433,null,ck,[0,0,0.06]);
  for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; mesh(B(0.03,i%3?0.05:0.1,0.01),0x1d2433,null,ck,[Math.sin(a)*0.36,Math.cos(a)*0.36,0.065]).rotation.z=-a; }
  clockH=new THREE.Group(); clockH.position.z=0.07; ck.add(clockH); mesh(B(0.04,0.22,0.01),0x1d2433,null,clockH,[0,0.09,0]);
  clockM=new THREE.Group(); clockM.position.z=0.08; ck.add(clockM); mesh(B(0.025,0.32,0.01),0xff6b3d,null,clockM,[0,0.14,0]);
  mesh(new THREE.CylinderGeometry(0.03,0.03,0.03,12),0x1d2433,null,ck,[0,0,0.085]).rotation.x=Math.PI/2;
  // พรมขอบมน + ลายขอบ
  const rt=rugTex(THEMES.cream.rug);
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(6.5,4.4),ROOM.rug=new THREE.MeshStandardMaterial({map:rt,alphaTest:0.5,roughness:1}));
  rug.rotation.x=-Math.PI/2; rug.position.set(0,0.015,1.2); rug.receiveShadow=true; scene.add(rug);
  // ต้นไม้
  [[0,-RX+0.7,-RZ+0.7,1.2],[2,RX-0.7,-RZ+0.8,1],[1,-RX+0.7,RZ-0.8,0.9]].forEach(([k,x,z,s])=>{ const p=makePlant(k); p.position.set(x,0,z); p.scale.setScalar(s); scene.add(p); });
  // มุมกาแฟ: ตู้ + ท็อป + เครื่องชง + ถังน้ำ
  const cf = new THREE.Group(); cf.position.set(-RX+0.7,0,-1.6);
  mesh(RB(1,0.94,1.6,0.04,1),0x5b6b84,null,cf,[0,0.47,0]);
  [-0.4,0.4].forEach(z=>{ mesh(RB(0.02,0.78,0.74,0.01,1),0x6a7a94,null,cf,[0.51,0.48,z]); mesh(RB(0.03,0.2,0.04,0.015,1),0xd8dde6,null,cf,[0.53,0.62,z+(z<0?0.3:-0.3)]); });
  mesh(RB(1.08,0.06,1.68,0.025,1),0xf2f2f2,null,cf,[0,0.97,0]);
  const mc=new THREE.Group(); mc.position.set(0,1.0,-0.35); cf.add(mc);
  mesh(RB(0.5,0.62,0.45,0.06,2),0x2b2f38,null,mc,[0,0.31,0]);
  mesh(RB(0.36,0.06,0.2,0.02,1),0x9aa3b2,null,mc,[0.08,0.08,0]).position.x=0.2;
  mesh(new THREE.CylinderGeometry(0.03,0.03,0.02,10),0xff4d4d,{emissive:0xff4d4d,emissiveIntensity:0.8},mc,[0.26,0.5,0.1]).rotation.z=Math.PI/2;
  mesh(new THREE.CylinderGeometry(0.07,0.06,0.12,14),0xffffff,null,mc,[0.22,0.14,0]);
  const jug=new THREE.Group(); jug.position.set(0,1.0,0.4); cf.add(jug);
  mesh(new THREE.CylinderGeometry(0.2,0.2,0.4,16),0xdfe6ee,null,jug,[0,0.2,0]);
  mesh(new THREE.CylinderGeometry(0.22,0.22,0.55,18),0x9fd9f0,{transparent:true,opacity:0.6,roughness:0.1},jug,[0,0.68,0]);
  mesh(new THREE.SphereGeometry(0.22,18,8,0,Math.PI*2,0,Math.PI/2),0x9fd9f0,{transparent:true,opacity:0.6,roughness:0.1},jug,[0,0.95,0]);
  [[0.3,0.75],[0.38,0.6]].forEach(([x,z])=>mesh(new THREE.CylinderGeometry(0.05,0.04,0.1,12),0xffffff,null,cf,[x-0.25,1.05,z]));
  scene.add(cf);
  // โซฟา: ฐาน + เบาะ + พนักพิง + หมอนอิง
  const so = new THREE.Group(); so.position.set(RX-1.2,0,-RZ+2.4); so.rotation.y=-Math.PI/2;
  mesh(RB(2.6,0.3,0.9,0.08,2),ROOM.sofaD,null,so,[0,0.3,0]);
  [-0.6,0.6].forEach(x=>mesh(RB(1.18,0.18,0.72,0.08,2),ROOM.sofa,null,so,[x,0.53,0.06]));
  mesh(RB(2.6,0.7,0.26,0.1,2),ROOM.sofaD,null,so,[0,0.78,-0.34]);
  [-1.25,1.25].forEach(x=>mesh(RB(0.26,0.62,0.9,0.1,2),ROOM.sofaD,null,so,[x,0.5,0]));
  [[-0.8,0xffc53d],[0.85,0xff6b3d]].forEach(([x,c])=>{ const pw=mesh(RB(0.48,0.42,0.14,0.07,2),c,null,so,[x,0.82,-0.16]); pw.rotation.set(-0.25,0,x<0?0.12:-0.1); });
  [[-1.2,-0.35],[1.2,-0.35],[-1.2,0.35],[1.2,0.35]].forEach(([x,z])=>mesh(new THREE.CylinderGeometry(0.04,0.03,0.15,8),0x3a2a1f,null,so,[x,0.075,z]));
  scene.add(so);
})();
applyTheme(OPT.theme);

// whiteboard (kanban) with live texture
const wbCanvas = document.createElement('canvas'); wbCanvas.width=640; wbCanvas.height=384;
const wbTex = new THREE.CanvasTexture(wbCanvas); wbTex.anisotropy=renderer.capabilities.getMaxAnisotropy();
(function(){
  const g = new THREE.Group(); g.position.set(-3.2,2.4,-RZ+0.08);
  mesh(RB(4.9,3.0,0.1,0.05,2),0xc8ced8,{metalness:0.4,roughness:0.4},g,[0,0,0]);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(4.7,2.82), new THREE.MeshBasicMaterial({map:wbTex}));
  face.position.z=0.055; g.add(face);
  mesh(RB(4.6,0.06,0.22,0.03,1),0xc8ced8,{metalness:0.4,roughness:0.4},g,[0,-1.53,0.12]);
  [0x3d7bff,0xe5484d,0x22b07d,0x1d2433].forEach((c,i)=>{ const mk=mesh(new THREE.CylinderGeometry(0.03,0.03,0.26,10),c,null,g,[-1.6+i*0.34,-1.47,0.16]); mk.rotation.z=Math.PI/2; });
  mesh(RB(0.3,0.1,0.08,0.03,1),0x4a5568,null,g,[1.7,-1.46,0.16]);
  scene.add(g);
})();

function drawWhiteboard(){
  const x = wbCanvas.getContext('2d'), W=640,H=384;
  x.fillStyle='#fbfbf8'; x.fillRect(0,0,W,H);
  if(!S) { wbTex.needsUpdate=true; return; }
  const todo=S.tasks.filter(t=>t.status==='todo'&&!assigned(t).length);
  const doing=S.tasks.filter(t=>t.status==='todo'&&assigned(t).length);
  const done=S.tasks.filter(t=>t.status==='done');
  const cols=[['TO DO',todo],['DOING',doing],['DONE',done]];
  cols.forEach((c,i)=>{
    const cx = 10+i*210;
    x.fillStyle='#1d2433'; x.font='bold 30px Kanit, sans-serif'; x.fillText(c[0]+'  '+c[1].length, cx+10, 42);
    x.fillRect(cx+8,52,190,4);
    if(i>0){ x.fillStyle='#1d243333'; x.fillRect(cx-4,14,3,H-28); }
    c[1].slice(0,15).forEach((t,j)=>{
      const r=Math.floor(j/3), k=j%3;
      x.fillStyle = t.isBug ? '#ff8f8f' : ROLES[t.type].css;
      x.save(); x.translate(cx+14+k*63, 68+r*60); x.rotate((((j*37)%7)-3)*0.015);
      x.fillRect(0,0,54,50);
      x.fillStyle='#ffffffaa'; x.fillRect(6,10,40,5); x.fillRect(6,22,28,5);
      x.restore();
    });
  });
  wbTex.needsUpdate = true;
}

// desk slots
const SLOTS = [[-5.4,-1.6],[-1.8,-1.6],[1.8,-1.6],[5.4,-1.6],[-5.4,2.8],[-1.8,2.8],[1.8,2.8],[5.4,2.8]].map(p=>({x:p[0],z:p[1],used:false}));
const SKINS=[0xf2c9a0,0xe0ac7e,0xc98d5e,0xf5d5b8,0xd9a066];
const HAIRS=[0x2b1d14,0x4a2f1b,0x111111,0x7a4b26,0xb5651d,0x3b2a5a];
const pickables = [];

const chairMat=new THREE.MeshStandardMaterial({color:0x2f3542,roughness:0.8});
const CHAIRC=[0x2f3542,0x14a38b,0xff6b3d,0x7b2cbf];
function applyDeskUp(x){
  const lm=ul('monitor'), lc=ul('chair');
  x.mon2.visible=lm>=1; x.lamp.visible=lm>=2; x.mon.scale.x=lm>=3?1.35:1;
  x.head.visible=lc>=2;
}
const upG=new THREE.Group(); scene.add(upG);
const upLeds=[];
function buildUpgradeDecor(){
  while(upG.children.length) upG.remove(upG.children[0]);
  upLeds.length=0;
  chairMat.color.setHex(CHAIRC[ul('chair')]);
  if(S) S.members.forEach(m=>applyDeskUp(m.v.extras));
  // coffee
  const c=ul('coffee');
  if(c>=1){ const g=new THREE.Group(); g.position.set(-RX+0.7,0,-0.25); upG.add(g);
    mesh(B(1,1,1.1),0x5b6b84,null,g,[0,0.5,0]);
    mesh(B(0.55,0.5,0.45),0xd8342c,null,g,[0,1.25,-0.15]);
    mesh(B(0.5,0.08,0.3),0xcccccc,null,g,[0,1.04,0.22]);
    mesh(new THREE.CylinderGeometry(0.07,0.07,0.12,10),0xffffff,null,g,[0.15,1.12,0.25]); }
  if(c>=2){ const dome=new THREE.Mesh(new THREE.SphereGeometry(0.28,16,10,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:0.35}));
    dome.position.set(-RX+0.7,1.0,-1.0); upG.add(dome);
    [[0xd99a5b,-0.08],[0xf5d08a,0.08],[0x8b4a2b,0]].forEach(([col,o],i)=>mesh(new THREE.SphereGeometry(0.08,8,8),col,null,upG,[-RX+0.7+o,1.06,-1.0+(i-1)*0.08])); }
  if(c>=3){ const cv=document.createElement('canvas'); cv.width=256; cv.height=96; const x=cv.getContext('2d');
    x.fillStyle='#1d2433'; x.fillRect(0,0,256,96); x.font='bold 54px Kanit, sans-serif'; x.fillStyle='#ffb3c7'; x.shadowColor='#ff5fa2'; x.shadowBlur=18; x.textAlign='center'; x.fillText('COFFEE',128,68);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(1.8,0.68),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv)}));
    p.position.set(-RX+0.02,3.0,-1.0); p.rotation.y=Math.PI/2; upG.add(p); }
  // garden
  const gd=ul('garden');
  const pl=(x,z,sc,col)=>{ const g=makePlant(col?1:(x>0?2:0),0xffffff); g.position.set(x,0,z); g.scale.setScalar(sc); upG.add(g); };
  if(gd>=1){ pl(-1.4,-RZ+0.6,1.1); pl(RX-0.7,RZ-0.8,1); }
  if(gd>=2){ pl(-2.6,RZ-0.5,0.7,0x2f8a4d); pl(2.6,RZ-0.5,0.7,0x2f8a4d); pl(-RX+0.6,1.0,0.8); }
  if(gd>=3){ const w=new THREE.Group(); w.position.set(-RX+0.05,2.2,4.6); upG.add(w);
    mesh(B(0.1,2.4,2.4),0x2e7d47,null,w,[0,0,0]);
    for(let i=0;i<26;i++) mesh(new THREE.IcosahedronGeometry(0.18+Math.random()*0.12,0),pick([0x3e9b5b,0x52b56e,0x2f8a4d,0x7bd389]),{flatShading:true},w,[0.12,rnd(-1.1,1.1),rnd(-1.1,1.1)]); }
  // lounge
  const lg=ul('lounge');
  if(lg>=1){ [[6.1,5.4,0xff6b3d],[7.5,5.1,0x7b2cbf]].forEach(([x,z,col])=>{ const b=mesh(new THREE.SphereGeometry(0.55,16,12),col,null,upG,[x,0.35,z]); b.scale.set(1,0.62,1); }); }
  if(lg>=2){ const a=new THREE.Group(); a.position.set(RX-0.7,0,4.4); a.rotation.y=-0.45; upG.add(a);
    mesh(B(0.9,1.9,0.8),0x3d7bff,null,a,[0,0.95,0]);
    const scr=new THREE.Mesh(new THREE.PlaneGeometry(0.66,0.5),new THREE.MeshBasicMaterial({color:0x7cf5c8})); scr.position.set(0,1.4,0.41); a.add(scr); upLeds.push({m:scr,c1:0x7cf5c8,c2:0xff5fa2,sp:2});
    mesh(B(0.8,0.1,0.35),0x222222,null,a,[0,1.02,0.5]); }
  if(lg>=3){ const r=mesh(new THREE.CylinderGeometry(1.5,1.5,0.03,32),0xffc53d,null,upG,[6.8,0.03,5.25]); r.castShadow=false;
    const fl=new THREE.Group(); fl.position.set(5.0,0,5.9); upG.add(fl);
    mesh(new THREE.CylinderGeometry(0.04,0.04,1.8,8),0x333333,null,fl,[0,0.9,0]);
    mesh(new THREE.SphereGeometry(0.25,12,10),0xfff2c4,{emissive:0xffd66b,emissiveIntensity:0.8},fl,[0,1.85,0]); }
  // ci/cd
  const ci=ul('cicd');
  for(let k=0;k<Math.min(ci,2);k++){ const r=new THREE.Group(); r.position.set(0.15+k*0.95,0,-RZ+0.5); upG.add(r);
    mesh(B(0.8,2.1,0.75),0x1f232b,null,r,[0,1.05,0]);
    for(let i=0;i<6;i++){ mesh(B(0.66,0.22,0.05),0x2d333f,null,r,[0,0.35+i*0.3,0.38]);
      const led=new THREE.Mesh(B(0.06,0.06,0.02),new THREE.MeshBasicMaterial({color:0x3ecf8e})); led.position.set(0.25,0.35+i*0.3,0.42); r.add(led); upLeds.push({m:led,c1:0x3ecf8e,c2:0x0b3d2a,sp:3+Math.random()*6}); } }
  if(ci>=3){ const cv=document.createElement('canvas'); cv.width=256; cv.height=128; const x=cv.getContext('2d');
    x.fillStyle='#0d1f17'; x.fillRect(0,0,256,128); x.fillStyle='#3ecf8e'; x.font='bold 30px Kanit, sans-serif'; x.fillText('✓ BUILD PASS',18,52); x.font='20px monospace'; x.fillText('tests 248/248',22,92);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(1.7,0.85),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv)})); p.position.set(0.62,3.25,-RZ+0.03); upG.add(p); }
  // client dashboard
  const cl=ul('client');
  if(cl>=1){ const cv=document.createElement('canvas'); cv.width=320; cv.height=192; const x=cv.getContext('2d');
    x.fillStyle='#1d2433'; x.fillRect(0,0,320,192); x.fillStyle='#fff'; x.font='bold 22px Kanit, sans-serif'; x.fillText('CLIENT DASHBOARD',16,32);
    [60,95,80,120,140].forEach((h,i)=>{ x.fillStyle=i===4?'#ff6b3d':'#14a38b'; x.fillRect(24+i*56,180-h,38,h); });
    mesh(B(0.12,1.3,2.1),0x111111,null,upG,[-RX+0.06,2.6,1.7]);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(1.95,1.15),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv)})); p.position.set(-RX+0.13,2.6,1.7); p.rotation.y=Math.PI/2; upG.add(p); }
  if(cl>=2){ mesh(B(0.3,0.06,1.4),0x8a6a4a,null,upG,[-RX+0.15,1.75,3.6]);
    [3.2,3.6,4.0].forEach((z,i)=>{ mesh(new THREE.ConeGeometry(0.1,0.3,8),0xffc53d,{metalness:0.6,roughness:0.3},upG,[-RX+0.18,1.93,z]); }); }
  if(cl>=3){ const t=new THREE.Group(); t.position.set(-6.6,0,5.2); upG.add(t);
    mesh(new THREE.CylinderGeometry(0.75,0.75,0.08,24),0xffffff,null,t,[0,0.8,0]);
    mesh(new THREE.CylinderGeometry(0.08,0.12,0.8,8),0x777777,null,t,[0,0.4,0]);
    [0,2.1,4.2].forEach(a=>mesh(new THREE.CylinderGeometry(0.25,0.25,0.45,12),0x14a38b,null,t,[Math.sin(a)*1.1,0.23,Math.cos(a)*1.1])); }
}
const deskTopM=new THREE.MeshStandardMaterial({map:woodTex,roughness:0.55});
const metalM=new THREE.MeshStandardMaterial({color:0x3a3f4b,metalness:0.5,roughness:0.45});
const chairBaseM=new THREE.MeshStandardMaterial({color:0x2a2d35,metalness:0.4,roughness:0.5});
// หน้าจอโค้ด (เลื่อนขึ้นเรื่อย ๆ ตอนทำงาน)
const codeTex=ctex(256,256,(x,w,h)=>{
  x.fillStyle='#0f1420'; x.fillRect(0,0,w,h);
  const cols=['#7cc4ff','#ff9ec7','#9be7a8','#ffd479','#c3b5ff','#e6e6e6'];
  for(let i=0;i<22;i++){ let xx=10+((i*7)%4)*14; const y=6+i*11.4;
    for(let k=0,n=1+((i*5)%4);k<n;k++){ const len=18+((i*13+k*29)%60); x.fillStyle=cols[(i+k)%cols.length]; x.fillRect(xx,y,len,5); xx+=len+8; } }
});
codeTex.wrapT=THREE.RepeatWrapping;
const keysTex=ctex(192,64,(x,w,h)=>{
  x.fillStyle='#c9ced6'; x.fillRect(0,0,w,h); x.fillStyle='#fbfbfb';
  for(let r=0;r<4;r++) for(let c=0;c<13;c++){ rrect(x,4+c*14.6+(r%2)*4,4+r*14,12,11,2); x.fill(); }
  rrect(x,50,60-4,90,6,2); x.fill();
});
const keysM=new THREE.MeshStandardMaterial({map:keysTex,roughness:0.7});
function makeMonitor(w,h,cy){ // cy = ความสูงกลางจอจากพื้น → คำนวณขาตั้งให้แตะโต๊ะพอดี
  const g=new THREE.Group();
  mesh(RB(w,h,0.06,0.03,2),0x23262e,null,g);
  const map=codeTex.clone(); map.needsUpdate=true; map.repeat.set(1,0.55); map.offset.y=Math.random();
  const scr=new THREE.Mesh(new THREE.PlaneGeometry(w-0.08,h-0.08),new THREE.MeshBasicMaterial({color:0x2a2f3a,map}));
  scr.position.z=-0.032; scr.rotation.y=Math.PI; g.add(scr);
  const top=1.01-cy;
  mesh(RB(0.08,-top-h/2+0.1,0.05,0.02,1),metalM,null,g,[0,(top+(-h/2+0.1))/2,0.05]);
  mesh(new THREE.CylinderGeometry(0.17,0.19,0.025,20),metalM,null,g,[0,top+0.012,0.05]);
  return {g,scr};
}
function buildDesk(slot){
  const g = new THREE.Group(); g.position.set(slot.x,0,slot.z);
  mesh(RB(2.5,0.1,1.15,0.04,2),deskTopM,null,g,[0,0.96,0]);
  [-1.08,1.08].forEach(x=>{
    [-0.45,0.45].forEach(z=>mesh(RB(0.08,0.9,0.08,0.03,1),metalM,null,g,[x,0.46,z]));
    mesh(RB(0.1,0.06,1.05,0.03,1),metalM,null,g,[x,0.03,0]);
    mesh(RB(0.06,0.06,0.95,0.02,1),metalM,null,g,[x,0.86,0]);
  });
  mesh(RB(2.2,0.45,0.04,0.02,1),0xc78f58,null,g,[0,0.62,0.5]);
  // จอหลัก + โลโก้ด้านหลัง (สีตามสายงานตอนทำงาน)
  const M=makeMonitor(1.0,0.64,1.5), mon=M.g; mon.position.set(0,1.5,0.12); g.add(mon);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.08,20), new THREE.MeshBasicMaterial({color:0x444444}));
  glow.position.z=0.032; mon.add(glow);
  [[0xffd479,-0.44],[0xff9ec7,-0.33]].forEach(([c,x],i)=>{ const n=new THREE.Mesh(new THREE.PlaneGeometry(0.1,0.1),new THREE.MeshStandardMaterial({color:c,side:THREE.DoubleSide})); n.position.set(x,0.25-i*0.04,-0.034); n.rotation.set(0,Math.PI,(i?-0.15:0.1)); mon.add(n); });
  // คีย์บอร์ด + เมาส์ + แผ่นรอง
  mesh(RB(0.72,0.035,0.24,0.015,1),0xe9ecf0,null,g,[0,1.028,-0.25]);
  const keys=new THREE.Mesh(new THREE.PlaneGeometry(0.67,0.2),keysM); keys.rotation.x=-Math.PI/2; keys.position.set(0,1.047,-0.25); g.add(keys);
  mesh(RB(0.32,0.01,0.26,0.004,1),0x2f3542,null,g,[0.55,1.015,-0.25]).castShadow=false;
  const mouse=mesh(new THREE.SphereGeometry(0.055,14,10),0xf5f5f5,null,g,[0.55,1.03,-0.25]); mouse.scale.set(1,0.45,1.45);
  // แก้วกาแฟมีหูจับ
  const mug=new THREE.Group(); mug.position.set(0.85,1.01,-0.05); mug.rotation.y=rnd(-1,1); g.add(mug);
  mesh(new THREE.CylinderGeometry(0.08,0.07,0.16,18),pick([0xff6b3d,0xffffff,0x14a38b,0xffc53d,0x3d7bff]),null,mug,[0,0.08,0]);
  mesh(new THREE.CircleGeometry(0.072,16),0x5a3420,null,mug,[0,0.15,0]).rotation.x=-Math.PI/2;
  mesh(new THREE.TorusGeometry(0.045,0.013,6,14),0xffffff,null,mug,[0.09,0.08,0]);
  // กองกระดาษ / ต้นไม้จิ๋ว (สุ่ม)
  for(let i=0;i<3;i++){ const p=mesh(B(0.3,0.012,0.4),i===1?0xfff6d6:0xffffff,null,g,[-0.85,1.017+i*0.013,-0.15]); p.rotation.y=rnd(-0.15,0.15); }
  if(Math.random()<0.6){ const sp=makePlant(Math.random()<0.5?0:1,pick([0xffffff,0xff9ec7,0x9be7a8])); sp.scale.setScalar(0.22); sp.position.set(-0.75,1.04,0.3); g.add(sp); }
  // เก้าอี้สำนักงาน: ขา 5 แฉก + ล้อ + เบาะ + พนัก + ที่วางแขน
  const ch=new THREE.Group(); ch.position.set(0,0,-1.0); g.add(ch);
  for(let i=0;i<5;i++){ const a=i/5*Math.PI*2+0.3, arm=new THREE.Group(); arm.rotation.y=a; ch.add(arm);
    mesh(RB(0.07,0.05,0.4,0.02,1),chairBaseM,null,arm,[0,0.1,0.2]);
    mesh(new THREE.SphereGeometry(0.05,10,8),0x111111,null,arm,[0,0.05,0.38]); }
  mesh(new THREE.CylinderGeometry(0.035,0.04,0.36,10),chairBaseM,null,ch,[0,0.29,0]);
  mesh(RB(0.78,0.13,0.72,0.06,2),chairMat,null,ch,[0,0.52,0]);
  mesh(RB(0.06,0.42,0.05,0.02,1),chairBaseM,null,ch,[0,0.66,-0.37]);
  const back=mesh(RB(0.72,0.72,0.1,0.06,2),chairMat,null,ch,[0,0.98,-0.38]); back.rotation.x=-0.08;
  [-0.4,0.4].forEach(x=>{ mesh(RB(0.05,0.22,0.05,0.02,1),chairBaseM,null,ch,[x,0.66,-0.05]); mesh(RB(0.09,0.045,0.36,0.02,1),chairBaseM,null,ch,[x,0.78,-0.02]); });
  const head=mesh(RB(0.48,0.26,0.1,0.06,2),chairMat,null,ch,[0,1.52,-0.42]);
  // จอเสริม + โคมไฟ (ปลดล็อกจากอัปเกรด)
  const mon2=makeMonitor(0.8,0.52,1.45).g; mon2.position.set(-0.92,1.45,0.2); mon2.rotation.y=0.35; g.add(mon2);
  const lamp=new THREE.Group(); lamp.position.set(1.0,1.01,0.35); g.add(lamp);
  mesh(new THREE.CylinderGeometry(0.1,0.11,0.035,16),0x444a56,null,lamp,[0,0.018,0]);
  const a1=mesh(new THREE.CylinderGeometry(0.018,0.018,0.42,8),0x444a56,null,lamp,[0.05,0.22,0]); a1.rotation.z=-0.25;
  mesh(new THREE.SphereGeometry(0.035,10,8),0x444a56,null,lamp,[0.1,0.42,0]);
  const a2=mesh(new THREE.CylinderGeometry(0.016,0.016,0.32,8),0x444a56,null,lamp,[0.02,0.5,-0.1]); a2.rotation.set(-1.0,0,0.5);
  const shadeG=new THREE.Group(); shadeG.position.set(-0.06,0.55,-0.22); shadeG.rotation.x=0.5; lamp.add(shadeG);
  mesh(new THREE.ConeGeometry(0.13,0.16,16,1,true),0xffc53d,{side:THREE.DoubleSide},shadeG,[0,0,0]);
  mesh(new THREE.SphereGeometry(0.05,10,8),0xfff2c4,{emissive:0xffd66b,emissiveIntensity:1},shadeG,[0,-0.05,0]);
  const extras={head,mon2,lamp,mon};
  applyDeskUp(extras);
  // floor ring (stress)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5,0.68,32), new THREE.MeshBasicMaterial({color:0x3ecf8e,transparent:true,opacity:0.85,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.set(0,0.04,-1.0); g.add(ring);
  const selRing = new THREE.Mesh(new THREE.RingGeometry(0.78,0.92,40), new THREE.MeshBasicMaterial({color:0xff6b3d,transparent:true,opacity:0,side:THREE.DoubleSide}));
  selRing.rotation.x=-Math.PI/2; selRing.position.set(0,0.05,-1.0); g.add(selRing);
  scene.add(g);
  return {g,glow,scr:M.scr,ring,selRing,extras};
}

// ตัวละคร: ลำตัวโค้ง (lathe), หน้า (ตา คิ้ว ปาก หู), ทรงผม 4 แบบ, ขานั่ง/ยืน
const TORSO=lathe([[0,0],[0.36,0],[0.42,0.06],[0.43,0.3],[0.4,0.55],[0.33,0.72],[0.18,0.82],[0,0.84]],22);
const PANTS=0x3a4256;
function buildPerson(color,skin,hair,opts){
  opts=opts||{};
  const p = new THREE.Group();
  const body = mesh(TORSO,color,null,p,[0,0.58,0]);
  mesh(new THREE.TorusGeometry(0.15,0.045,8,18),opts.tie?0xffffff:shade(color,0.12),null,p,[0,1.4,0]).rotation.x=Math.PI/2;
  mesh(new THREE.CylinderGeometry(0.1,0.11,0.14,12),skin,null,p,[0,1.46,0]);
  const headG = new THREE.Group(); headG.position.set(0,1.68,0); p.add(headG);
  mesh(new THREE.SphereGeometry(0.32,24,18),skin,null,headG,[0,0,0]).scale.set(1,0.96,0.98);
  [-1,1].forEach(s=>mesh(new THREE.SphereGeometry(0.07,10,8),skin,null,headG,[s*0.31,-0.02,0]).scale.set(0.6,1,1));
  const eyes=[-1,1].map(s=>{ const e=mesh(new THREE.SphereGeometry(0.048,12,10),0x111111,null,headG,[s*0.11,0.03,0.285]); e.scale.z=0.6;
    mesh(new THREE.SphereGeometry(0.016,8,6),0xffffff,{emissive:0xffffff,emissiveIntensity:0.6},e,[0.015,0.018,0.04]); return e; });
  const style = opts.style!==undefined ? opts.style : Math.floor(Math.random()*4);
  [-1,1].forEach(s=>{ const b=mesh(RB(0.1,0.025,0.02,0.01,1),shade(hair,-0.05),null,headG,[s*0.11,0.13,0.29]); b.rotation.z=s*-0.12; });
  mesh(new THREE.SphereGeometry(0.035,10,8),shade(skin,-0.06),null,headG,[0,-0.02,0.315]);
  const mouth=mesh(new THREE.TorusGeometry(0.05,0.012,6,14,Math.PI),0x7a2e2e,null,headG,[0,-0.1,0.29]); mouth.rotation.z=Math.PI;
  mesh(new THREE.SphereGeometry(0.05,8,8),0xff9a8a,{transparent:true,opacity:0.6},headG,[-0.2,-0.08,0.24]);
  mesh(new THREE.SphereGeometry(0.05,8,8),0xff9a8a,{transparent:true,opacity:0.6},headG,[0.2,-0.08,0.24]);
  // ผม
  const hairM = mesh(new THREE.SphereGeometry(0.34,22,12,0,Math.PI*2,0,Math.PI*0.52),hair,null,headG,[0,0.04,-0.02]);
  hairM.rotation.x = -0.25;
  if(!opts.cap){
    if(style===1){ for(let i=0;i<7;i++){ const a=i/7*Math.PI*2; const c=mesh(new THREE.ConeGeometry(0.08,0.2,6),hair,{flatShading:true},headG,[Math.cos(a)*0.15,0.33,Math.sin(a)*0.15-0.04]); c.rotation.set(Math.sin(a)*0.5,0,-Math.cos(a)*0.5); } }
    else if(style===2){ mesh(new THREE.SphereGeometry(0.15,14,12),hair,null,headG,[0,0.28,-0.2]); mesh(new THREE.TorusGeometry(0.1,0.025,6,14),0xff6b3d,null,headG,[0,0.22,-0.15]).rotation.x=Math.PI/2.6; }
    else if(style===3){ mesh(RB(0.66,0.55,0.24,0.11,2),hair,null,headG,[0,-0.12,-0.17]); [-1,1].forEach(s=>mesh(RB(0.1,0.42,0.22,0.05,1),hair,null,headG,[s*0.29,-0.12,0.02])); }
    else { const f=mesh(RB(0.42,0.1,0.14,0.05,1),hair,null,headG,[0.04,0.23,0.21]); f.rotation.set(0.5,0,-0.15); }
  }
  // แขน: ไหล่ + แขนเสื้อ + มือ
  const armL = new THREE.Group(); armL.position.set(-0.42,1.3,0); p.add(armL);
  const armR = new THREE.Group(); armR.position.set(0.42,1.3,0); p.add(armR);
  [armL,armR].forEach(a=>{ mesh(new THREE.SphereGeometry(0.11,12,10),color,null,a,[0,0,0]);
    mesh(RB(0.18,0.58,0.18,0.08,2),color,null,a,[0,-0.28,0]);
    mesh(new THREE.CylinderGeometry(0.095,0.095,0.05,12),shade(color,0.12),null,a,[0,-0.55,0]);
    mesh(new THREE.SphereGeometry(0.1,12,10),skin,null,a,[0,-0.64,0]); });
  // ขา
  if(opts.legs){
    [-0.15,0.15].forEach(x=>{ mesh(RB(0.21,0.62,0.23,0.08,2),PANTS,null,p,[x,0.36,0]); mesh(RB(0.23,0.1,0.34,0.05,1),0x222222,null,p,[x,0.05,0.05]); });
  } else {
    [-0.13,0.13].forEach(x=>{ mesh(RB(0.19,0.17,0.5,0.08,2),PANTS,null,p,[x,0.66,0.22]);
      mesh(RB(0.17,0.5,0.17,0.07,2),PANTS,null,p,[x,0.37,0.44]);
      mesh(RB(0.19,0.09,0.28,0.04,1),0x222222,null,p,[x,0.06,0.5]); });
  }
  if(opts.tie){ mesh(RB(0.1,0.36,0.04,0.02,1),0xe5484d,null,p,[0,1.13,0.415]).rotation.x=-0.12; mesh(RB(0.08,0.07,0.05,0.02,1),0xc23a3f,null,p,[0,1.33,0.37]); }
  if(opts.cap){ mesh(new THREE.SphereGeometry(0.345,22,12,0,Math.PI*2,0,Math.PI*0.42),0xff6b3d,null,headG,[0,0.06,0]);
    mesh(RB(0.42,0.04,0.26,0.02,1),0xff6b3d,null,headG,[0,0.17,0.3]).rotation.x=-0.15;
    mesh(new THREE.SphereGeometry(0.04,8,8),0xffffff,null,headG,[0,0.4,0]); }
  return {p,body,headG,armL,armR,eyes,blinkAt:1+Math.random()*4};
}

/* ---------- animation helpers ---------- */
const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));          // เข้าหาเป้าแบบนุ่ม ไม่กระตุก ไม่ขึ้นกับ fps
const nowS=()=>performance.now()/1000;
function blink(v,T){ // กะพริบตาสุ่มทุก 2–5 วิ
  const d=T-v.blinkAt; let sy=1;
  if(d>0){ sy=d<0.12?Math.abs(1-d/0.06):1; if(d>=0.12) v.blinkAt=T+2+Math.random()*3; }
  v.eyes.forEach(e=>e.scale.y=Math.max(0.1,sy));
}
// confetti
const confetti=[]; const confGeo=new THREE.PlaneGeometry(0.12,0.08);
function burst(pos,cols,n){
  for(let i=0;i<(n||26);i++){
    const m=new THREE.Mesh(confGeo,new THREE.MeshBasicMaterial({color:pick(cols),side:THREE.DoubleSide,transparent:true}));
    m.position.copy(pos); scene.add(m);
    const a=Math.random()*Math.PI*2, s=1.5+Math.random()*2.2;
    confetti.push({m,vx:Math.cos(a)*s*0.6,vy:3.5+Math.random()*2.5,vz:Math.sin(a)*s*0.6,rx:rnd(-9,9),ry:rnd(-9,9),life:1.4+Math.random()*0.5});
  }
}
function stepConfetti(dt){
  for(let i=confetti.length-1;i>=0;i--){ const c=confetti[i];
    c.life-=dt; c.vy-=9*dt; c.vx*=0.985; c.vz*=0.985;
    c.m.position.x+=c.vx*dt; c.m.position.y=Math.max(0.03,c.m.position.y+c.vy*dt); c.m.position.z+=c.vz*dt;
    if(c.m.position.y>0.03){ c.m.rotation.x+=c.rx*dt; c.m.rotation.y+=c.ry*dt; }
    c.m.material.opacity=Math.min(1,c.life*2);
    if(c.life<=0){ scene.remove(c.m); c.m.material.dispose(); confetti.splice(i,1); } }
}
function cheer(m,good){
  m.v.cheerT=nowS(); m.v.cheerGood=good;
  if(good){ const p=new THREE.Vector3(); m.v.headG.getWorldPosition(p); p.y+=0.4; burst(p,[0xff6b3d,0xffc53d,0x14a38b,0x3d7bff,0xff5fa2]); }
}

// PM avatar
const pm = buildPerson(0xffffff,0xf2c9a0,0x2b1d14,{legs:true,tie:true,cap:true});
pm.p.position.set(-5.5,0,-4.2); scene.add(pm.p);
mesh(B(0.35,0.45,0.04),0x8a6a4a,null,pm.armR,[0.05,-0.6,0.18]);
const pmTarget = new THREE.Vector3(-5.5,0,-4.2);

// camera
function updateProjection(){
  const w = innerWidth, h = innerHeight, a = w/h;
  let half = Math.max(8.2, 12.6/a);
  half /= camZoom;
  camera.left=-half*a; camera.right=half*a; camera.top=half; camera.bottom=-half;
  camera.updateProjectionMatrix();
}
function placeCamera(){
  const r=40;
  camera.position.set(camTarget.x+Math.sin(camAz)*Math.cos(camEl)*r, camTarget.y+Math.sin(camEl)*r, camTarget.z+Math.cos(camAz)*Math.cos(camEl)*r);
  camera.lookAt(camTarget);
}
function resize(){ renderer.setSize(innerWidth,innerHeight,false); updateProjection(); }
addEventListener('resize',resize); resize(); placeCamera();

// pointer
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let pdown=null, dragging=false, pinch=null;
const pts = new Map();
let camTween=null;
canvas.addEventListener('pointerdown',e=>{ camTween=null;pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); pdown={x:e.clientX,y:e.clientY}; dragging=false; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove',e=>{
  if(!pts.has(e.pointerId)) return;
  const prev = pts.get(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2){
    const [a,b]=[...pts.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y);
    if(pinch){ camZoom=clamp(camZoom*d/pinch,0.7,2.4); updateProjection(); }
    pinch=d; dragging=true; return;
  }
  if(!pdown) return;
  if(Math.hypot(e.clientX-pdown.x,e.clientY-pdown.y)>6) dragging=true;
  if(dragging){
    camAz = clamp(camAz-(e.clientX-prev.x)*0.006,-0.15,1.6);
    camEl = clamp(camEl+(e.clientY-prev.y)*0.004,0.32,1.25);
    placeCamera();
  }
});
function endPtr(e){
  pts.delete(e.pointerId); if(pts.size<2) pinch=null;
  if(pdown && !dragging && pts.size===0) pick3D(e.clientX,e.clientY);
  if(pts.size===0) pdown=null;
}
canvas.addEventListener('pointerup',endPtr);
canvas.addEventListener('pointercancel',e=>{pts.delete(e.pointerId);pdown=null;pinch=null;});
canvas.addEventListener('wheel',e=>{ e.preventDefault(); camTween=null;camZoom=clamp(camZoom*(1-e.deltaY*0.0012),0.7,2.4); updateProjection(); },{passive:false});
$('#zIn').onclick=()=>{camTween=null;camZoom=clamp(camZoom*1.15,0.7,2.4);updateProjection();};
$('#zOut').onclick=()=>{camTween=null;camZoom=clamp(camZoom/1.15,0.7,2.4);updateProjection();};

function pick3D(x,y){
  if(!S||S.ended) return;
  ndc.set(x/innerWidth*2-1, -(y/innerHeight)*2+1);
  ray.setFromCamera(ndc,camera);
  const hits = ray.intersectObjects(pickables,true);
  for(const h of hits){
    let o=h.object; while(o && o.userData.mid===undefined) o=o.parent;
    if(o){ const m=S.members.find(mm=>mm.id===o.userData.mid); if(m){ clickMember(m); return; } }
  }
  if(!S.selTask && S.selMember){ S.selMember=null; dirty(); }
}

/* ================= GAME STATE ================= */
let S = null;
let uid = 1;
const taskById = id => S.tasks.find(t=>t.id===id);
const assigned = t => S.members.filter(m=>m.task===t.id);
function isBlocked(t){ return t.dep.some(id=>{ const d=taskById(id); return d && d.status==='todo'; }); }
function active(){ return S.members.filter(m=>m.offUntil<=S.t); }
function avgMorale(){ return S.members.length? S.members.reduce((a,m)=>a+m.morale,0)/S.members.length : 0; }
function dirty(){ S && (S._dirty=true); }

function addMember(p){
  const slot = SLOTS.find(s=>!s.used); if(!slot) return null;
  slot.used=true;
  const m = Object.assign({id:uid++,morale:75,stress:15,task:null,busyUntil:0,offUntil:0,onboardUntil:0,switchUntil:0,oneReady:0,state:'idle',slot},p);
  const desk = buildDesk(slot);
  const person = buildPerson(ROLES[m.role].hex, pick(SKINS), pick(HAIRS));
  person.p.position.set(0,0,-1.0); desk.g.add(person.p);
  desk.g.userData.mid = m.id; pickables.push(desk.g);
  m.v = Object.assign(desk,person);
  m.v.phase = Math.random()*6;
  if(p.spawn){ desk.g.scale.setScalar(0.01); m.v.grow=0; }
  const lbl = document.createElement('div'); lbl.className='lbl'; $('#labels').appendChild(lbl); m.lbl=lbl; m._lh='';
  S.members.push(m);
  return m;
}
function removeMember(m){
  scene.remove(m.v.g); m.slot.used=false;
  const i=pickables.indexOf(m.v.g); if(i>=0) pickables.splice(i,1);
  m.lbl.remove(); S.members=S.members.filter(x=>x!==m);
  if(S.selMember===m) S.selMember=null;
  dirty();
}

function newGame(li){
  if(S){ S.members.slice().forEach(removeMember); }
  $('#labels').innerHTML='';
  const L = LEVELS[li];
  S = { li, L, t:0, speed:0, deadline:L.days, budget:L.budget, money:L.budget, quality:80, stake:70+5*ul('client'), hist:[], marks:[], origDeadline:L.days, ot:false, otTime:0, effMod:1,
    members:[], tasks:L.tasks.map(t=>Object.assign({},t,{dep:t.dep||[],progress:0,status:'todo',riskSum:0})),
    feats:L.feats.slice(), log:[], lessons:[], used:{}, nextEvent:rndInt(L.ev[0],L.ev[1]), lastDoneT:0,
    selTask:null, selMember:null, mode:null, burnouts:0, extensions:0, cuts:0, freelancers:0, lunchReady:0,
    ended:false, modal:false, bugs:0, idleWaste:0, crs:0, autoPull:OPT.autoPull, _dirty:true };
  L.team.forEach(p=>addMember(Object.assign({},p)));
  $('#projName').textContent = L.name; Snd.tempo=1;
  S.hist.push(snap(0));
  S.log=[]; log('🚀 เริ่มโปรเจกต์ "'+L.name+'" — วางแผนก่อนแล้วกด ▶');
  pmTarget.set(-5.5,0,-4.2);
  setSpeed(0);
  hint('👉 กด 🪄 แจกงานอัตโนมัติ (หรือเลือกเอง) แล้วกด ▶ เพื่อเริ่ม');
  updateUI(true);
}

function log(s){ if(!S) return; S.log.unshift('<span style="opacity:.55">D'+(Math.floor(S.t)+1)+'</span> '+s); S.log=S.log.slice(0,40); S._logDirty=true; }
let hintTimer=null;
function hint(s,warn,ms){
  const h=$('#hint'); h.textContent=s; h.className=warn?'warn':'';
  clearTimeout(hintTimer); if(ms) hintTimer=setTimeout(()=>{ if(h.textContent===s) h.textContent=''; },ms);
}
function popup(m,text,color){
  const pos = m ? new THREE.Vector3().setFromMatrixPosition(m.v.headG.matrixWorld).add(new THREE.Vector3(0,1.1,0)) : new THREE.Vector3(0,3,0);
  pos.project(camera);
  const el=document.createElement('div'); el.className='pop'; el.textContent=text; el.style.color=color||'#1d2433';
  el.style.left=((pos.x+1)/2*innerWidth)+'px'; el.style.top=((1-pos.y)/2*innerHeight)+'px';
  $('#labels').appendChild(el); setTimeout(()=>el.remove(),1900);
}

/* ---------- interactions ---------- */
function clickMember(m){
  if(S.ended) return;
  if(S.selTask){ assign(m,S.selTask); S.selTask=null; S.selMember=null; dirty(); return; }
  S.selMember = S.selMember===m ? null : m;
  dirty();
}
function clickTask(t){
  if(S.ended) return;
  if(S.mode==='cut'){ cutTask(t); return; }
  if(t.status!=='todo') return;
  if(isBlocked(t)){ const deps=t.dep.map(taskById).filter(d=>d.status==='todo').map(d=>d.name).join(', '); hint('🔒 ต้องรอ: '+deps+' เสร็จก่อน',true,2600); Snd.play('error'); return; }
  if(S.selMember){ assign(S.selMember,t); S.selMember=null; dirty(); return; }
  S.selTask = S.selTask===t ? null : t; if(S.selTask) Snd.play('select');
  if(S.selTask) hint('กดชื่อคนบนการ์ด หรือคลิกตัวละคร (สีเขียว = ตรงสายงาน)',false,3500); else hint('');
  dirty();
}
function assign(m,t){
  if(t.status!=='todo'||isBlocked(t)) return;
  if(m.offUntil>S.t){ hint(m.name+' ลาพักอยู่ — มอบหมายไม่ได้',true,2200); return; }
  if(m.task===t.id) return;
  if(m.task){ m.switchUntil=S.t+0.3; log('🔀 '+m.name+' สลับงาน (context switch เสียเวลา ~0.3 วัน)'); }
  m.task=t.id;
  const n=assigned(t).length;
  let msg='📌 '+m.name+' รับงาน "'+t.name+'"';
  if(t.type!==m.role) msg+=' ⚠️ ไม่ตรงสายงาน (ช้าลง 35%, เสี่ยงบั๊ก)';
  if(n>1) msg+=' 👥 ทำร่วม '+n+' คน (ประสิทธิภาพต่อคนลดลง)';
  log(msg); hint('',false); Snd.play('assign'); m.v.hopT=nowS();
  pmTarget.set(m.slot.x+1.6,0,m.slot.z+0.2);
  dirty();
}
function unassign(m){ if(m.task){ log('↩️ '+m.name+' วางงาน "'+taskById(m.task).name+'"'); m.task=null; dirty(); } }

function setSpeed(sp){
  if(!S) return;
  if(S.modal||S.ended) sp=0;
  S.speed=sp;
  document.querySelectorAll('.speed button[data-sp]').forEach(b=>{ b.classList.toggle('on',+b.dataset.sp===sp); b.disabled=S.modal||S.ended; });
  $('.speed button[data-sp="1"]').classList.toggle('pulse', sp===0 && S.t===0);
}
document.querySelectorAll('.speed button[data-sp]').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.sp));
document.addEventListener('visibilitychange',()=>{ if(document.hidden&&OPT.autoPause&&S&&!S.ended&&S.speed){ setSpeed(0); hint('⏸️ หยุดเกมให้อัตโนมัติตอนสลับหน้าต่าง กด ▶ เพื่อเล่นต่อ',false,3000); } });
addEventListener('keydown',e=>{ if(e.code==='Space'&&S&&!S.modal&&!S.ended&&$('#start').classList.contains('hide')){ e.preventDefault(); setSpeed(S.speed?0:1);} });

/* ---------- actions ---------- */
$('#aPull').onclick=()=>{ if(!S||S.ended) return; S.autoPull=!S.autoPull; log(S.autoPull?'🔁 เปิดโหมดหยิบงานเอง':'✋ ปิดโหมดหยิบงานเอง — PM แจกเองทั้งหมด'); if(S.autoPull) S.members.forEach(pullFor); dirty(); };
$('#autoBtn').onclick=()=>{ if(!S||S.ended) return; let n=0; S.members.forEach(m=>{ if(pullFor(m)) n++; }); S.selTask=null; if(n) Snd.play('assign'); else Snd.play('error'); hint(n?'🪄 แจกงานให้ '+n+' คนแล้ว — กด ▶ เริ่มได้เลย':'ไม่มีงานที่ตรงสายสำหรับคนที่ว่างอยู่ ลองแจกข้ามสายเอง',!n,2600); dirty(); };
// drag & drop (mouse)
let drag=null, dragJustEnded=false;
$('#boardList').addEventListener('pointerdown',e=>{
  if(e.pointerType!=='mouse'||e.button!==0||!S||S.ended||e.target.closest('[data-assign]')) return;
  const c=e.target.closest('[data-task]'); if(!c) return;
  const t=taskById(c.dataset.task); if(t.status!=='todo'||isBlocked(t)) return;
  drag={t,x:e.clientX,y:e.clientY,on:false};
});
addEventListener('pointermove',e=>{
  if(!drag) return;
  if(!drag.on && Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8){ drag.on=true; const g=$('#ghost'); g.textContent=ROLES[drag.t.type].icon+' '+drag.t.name; g.style.display='block'; S.selTask=drag.t; dirty(); }
  if(drag.on){ const g=$('#ghost'); g.style.left=e.clientX+'px'; g.style.top=e.clientY+'px';
    document.querySelectorAll('.mem.drop').forEach(x=>x.classList.remove('drop'));
    const el=document.elementFromPoint(e.clientX,e.clientY); const mm=el&&el.closest&&el.closest('[data-mem]'); if(mm) mm.classList.add('drop'); }
});
addEventListener('pointerup',e=>{
  if(!drag) return; const d=drag; drag=null;
  if(!d.on) return;
  $('#ghost').style.display='none'; dragJustEnded=true; setTimeout(()=>dragJustEnded=false,50);
  document.querySelectorAll('.mem.drop').forEach(x=>x.classList.remove('drop'));
  let m=null;
  const el=document.elementFromPoint(e.clientX,e.clientY);
  const mm=el&&el.closest&&el.closest('[data-mem]');
  if(mm) m=S.members.find(x=>x.id===+mm.dataset.mem);
  else if(el===canvas){ ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1); ray.setFromCamera(ndc,camera);
    for(const h of ray.intersectObjects(pickables,true)){ let o=h.object; while(o&&o.userData.mid===undefined) o=o.parent; if(o){ m=S.members.find(x=>x.id===o.userData.mid); break; } } }
  S.selTask=null;
  if(m) assign(m,d.t); else hint('วางการ์ดบนตัวละครหรือชื่อในรายชื่อทีม',true,2000);
  dirty();
});
$('#aOT').onclick=()=>{ if(!S||S.ended) return; S.ot=!S.ot; Snd.play(S.ot?'ot':'otOff'); Snd.tempo=S.ot?1.25:1; log(S.ot?'🔥 เปิดโหมด OT — ทุกคนเร่งงาน':'🌙 ปิด OT — ทีมกลับบ้านตรงเวลา'); dirty(); };
$('#a11').onclick=()=>{
  const m=S&&S.selMember; if(!m) { hint('เลือกคนในทีมก่อน แล้วค่อยกดคุย 1:1',true,2200); return; }
  if(m.offUntil>S.t){ hint(m.name+' ลาพักอยู่',true,2000); return; }
  if(m.oneReady>S.t){ hint('เพิ่งคุยกับ '+m.name+' ไป — รออีก '+Math.ceil(m.oneReady-S.t)+' วัน',true,2200); return; }
  m.busyUntil=S.t+0.5; m.stress=clamp(m.stress-28,0,100); m.morale=clamp(m.morale+8,0,100); m.oneReady=S.t+3;
  popup(m,'🗣️ คุยกันหน่อย','#14a38b'); Snd.play('talk'); log('🗣️ คุย 1:1 กับ '+m.name+' — เครียดลดลง ขวัญดีขึ้น');
  pmTarget.set(m.slot.x+1.6,0,m.slot.z+0.2); dirty();
};
$('#aLunch').onclick=()=>{
  if(!S||S.ended) return;
  if(S.lunchReady>S.t){ hint('เพิ่งเลี้ยงไป — อีก '+Math.ceil(S.lunchReady-S.t)+' วันค่อยเลี้ยงได้อีก',true,2200); return; }
  const cost=2000*S.members.length; S.money-=cost; S.lunchReady=S.t+5;
  S.members.forEach(m=>{ m.morale=clamp(m.morale+12,0,100); m.stress=clamp(m.stress-15,0,100); if(m.offUntil<=S.t) popup(m,'🍕 +ขวัญ','#ff6b3d'); });
  log('🍕 เลี้ยงข้าวทีม '+fmt(cost)); Snd.play('coin'); dirty();
};
$('#aHire').onclick=()=>{
  if(!S||S.ended) return;
  if(S.freelancers>=2||!SLOTS.some(s=>!s.used)){ hint('จ้างฟรีแลนซ์ได้สูงสุด 2 คน',true,2200); return; }
  const prev=S.speed; setSpeed(0); S.modal=true; setSpeed(0);
  openModal(`<div class="ev-ic">🧑‍💻</div><h2>จ้างฟรีแลนซ์</h2><p>ค่าจ้าง ฿15,000 + ฿7,000/วัน · skill ★★★★ · 1 วันแรกยัง onboard (ทำงานได้ครึ่งเดียว)</p>
   ${Object.keys(ROLES).map(r=>`<button class="choice" data-r="${r}"><b>${ROLES[r].icon} ${ROLES[r].th}</b><small>${r==='dev'?'งานเขียนโค้ด / แก้บั๊ก':r==='design'?'งาน UX/UI':'งานทดสอบ'}</small></button>`).join('')}
   <button class="choice" data-r=""><b>ยกเลิก</b><small>ลองบริหารทีมเดิมก่อน</small></button>`);
  $('#modalBody').querySelectorAll('.choice').forEach(b=>b.onclick=()=>{
    closeModal(prev);
    const r=b.dataset.r; if(!r) return;
    const names=['เจมส์','ฝน','โอม','ตาล'].filter(n=>!S.members.some(m=>m.name.startsWith(n)));
    const m=addMember({name:pick(names)+' (FL)',role:r,skill:4,salary:7000,freelance:true,onboardUntil:S.t+1,spawn:true});
    S.money-=15000; S.freelancers++; mark('🧑‍💻','จ้าง '+m.name); Snd.play('hire');
    log('🧑‍💻 จ้าง '+m.name+' ('+ROLES[r].th+') — Brooks\'s law: คนใหม่ต้องใช้เวลา onboard'); dirty();
  });
};
$('#aCut').onclick=()=>{
  if(!S||S.ended) return;
  S.mode = S.mode==='cut'?null:'cut';
  if(S.mode==='cut'){ S.selTask=null; hint('✂️ คลิกงาน Priority M/L ที่ยังไม่เริ่ม เพื่อตัดออก (กดปุ่มอีกครั้งเพื่อยกเลิก)',true); }
  else hint('');
  dirty();
};
function cutTask(t){
  if(t.status!=='todo'){ return; }
  if(t.pri==='H'){ hint('งาน High priority = Must-have ตัดไม่ได้',true,2200); return; }
  if(t.progress>0||assigned(t).length){ hint('งานนี้เริ่มไปแล้ว ตัดไม่ได้',true,2200); return; }
  t.status='cut'; S.cuts++; mark('✂️','ตัด '+t.name); const p=t.pri==='L'?6:12; S.stake=clamp(S.stake-p,0,100);
  S.mode=null; hint('',false);
  Snd.play('cut'); log('✂️ ตัด "'+t.name+'" ออกจาก scope (ลูกค้าพอใจ −'+p+')');
  addLesson('MoSCoW: เมื่อเวลาไม่พอ ให้ตัด Could/Should-have ก่อน และคุยกับลูกค้าให้ชัดว่าอะไรคือ Must-have');
  checkWin(); dirty();
}
$('#aExt').onclick=()=>{
  if(!S||S.ended) return;
  if(S.extensions>=2){ hint('ขอเลื่อนได้สูงสุด 2 ครั้ง',true,2200); return; }
  const p=15+S.extensions*10; S.deadline+=3; S.extensions++; mark('📅','เลื่อน Deadline +3'); S.stake=clamp(S.stake-p,0,100);
  log('📅 ขอเลื่อน deadline +3 วัน (ลูกค้าพอใจ −'+p+')'); dirty();
};
$('#aBoard').onclick=()=>{ $('#board').classList.toggle('open'); $('#side').classList.remove('open'); };
$('#aTeam').onclick=()=>{ $('#side').classList.toggle('open'); $('#board').classList.remove('open'); };

/* ---------- simulation ---------- */
function rate(m,t){
  let r = m.skill*0.75;
  r *= 0.55 + m.morale/100*0.6;
  if(m.stress>80) r*=0.7;
  if(t.type!==m.role) r*=0.65;
  if(S.ot) r*=1.4;
  if(m.onboardUntil>S.t) r*=0.5;
  r *= S.effMod*(1+0.06*ul('monitor'));
  const n = assigned(t).filter(x=>x.offUntil<=S.t).length;
  if(n>1) r*=0.72;
  return r;
}
function freeTasks(){ return S.tasks.filter(t=>t.status==='todo'&&!isBlocked(t)&&!assigned(t).length); }
function bestTaskFor(m){
  const f=freeTasks().filter(t=>t.type===m.role);
  f.sort((a,b)=>(PRIW[b.pri]-PRIW[a.pri])||(b.progress-a.progress));
  return f[0]||null;
}
function pullFor(m){
  if(m.task||m.offUntil>S.t||m.busyUntil>S.t) return false;
  const t=bestTaskFor(m); if(!t) return false;
  m.task=t.id; log('🔁 '+m.name+' หยิบงาน "'+t.name+'" เอง'); dirty(); return true;
}
function idleCount(){ return S.members.filter(m=>!m.task&&m.offUntil<=S.t&&m.busyUntil<=S.t).length; }
function sim(dd){
  const t0=S.t; S.t+=dd;
  if(S.ot) S.otTime+=dd;
  const freeTask = S.tasks.some(t=>t.status==='todo'&&!isBlocked(t)&&!assigned(t).length);
  let cost=0;
  for(const m of S.members.slice()){
    cost += m.salary*((S.ot&&m.state==='work')?1.3:1);
    if(m.offUntil>S.t){ if(m.state!=='off'){m.state='off';dirty();} m.stress=clamp(m.stress-20*dd,0,100); continue; }
    if(m.state==='off'){ m.state='idle'; log('👋 '+m.name+' กลับมาทำงานแล้ว'); dirty(); }
    const t = m.task && taskById(m.task);
    if(t && t.status!=='todo'){ m.task=null; }
    let ns;
    if(m.busyUntil>S.t){ ns='meet'; m.stress-=12*dd*(1+0.25*ul('coffee')); }
    else if(m.task && m.switchUntil>S.t){ ns='switch'; m.stress+=2*dd; }
    else if(m.task){
      ns='work';
      const mis = t.type!==m.role;
      const inc = rate(m,t)*dd;
      t.progress += inc;
      const risk = (0.05+(mis?0.3:0)+(m.stress>70?0.22:0)+(S.ot?0.08:0)-(m.skill-3)*0.03)*(1-0.15*ul('cicd'));
      t.riskSum += inc*Math.max(0.01,risk)*(t.isBug?0.5:1);
      m.stress += (3+(S.ot?8:0)+(mis?1.5:0))*dd*(1-0.12*ul('chair'));
      if(t.progress>=t.effort) completeTask(t,m);
    } else { ns='idle'; m.stress-=10*dd*(1+0.25*ul('coffee')); if(S.autoPull && pullFor(m)) ns='work'; else if(freeTask) S.idleWaste+=dd; }
    if(ns!==m.state){ if(ns==='idle'&&m.state!=='idle'&&OPT.idleSnd&&performance.now()-(S._idleSnd||0)>700){ S._idleSnd=performance.now(); Snd.play('idle'); } m.state=ns; }
    if(m.stress>75) m.morale-=5*dd; else if(m.stress<35) m.morale+=1.5*dd;
    m.morale+=0.8*ul('garden')*dd;
    m.stress=clamp(m.stress,0,100); m.morale=clamp(m.morale,0,100);
    if(m.stress>=100) burnout(m);
  }
  S.money -= cost*dd;
  if(S.t-S.lastDoneT>2) S.stake=clamp(S.stake-1.2*dd*(1-0.3*ul('client')),0,100);
  if(S.ended) return;
  const d0=Math.floor(t0), d1=Math.floor(S.t);
  if(d1>d0) onNewDay(d1);
  if(S.ended) return;
  if(S.t>=S.deadline) endGame('deadline');
  else if(S.money < -S.budget*0.3) endGame('bankrupt');
}
function completeTask(t,m){
  t.status='done'; t.doneT=S.t;
  S.members.forEach(x=>{ if(x.task===t.id) x.task=null; });
  const chance = t.riskSum/t.effort;
  const who = m ? m : null;
  if(t.type!=='qa' && Math.random()<chance){
    S.bugs++; S.quality=clamp(S.quality-4,0,100); mark('🐞','บั๊กจาก '+t.name);
    const b={id:'b'+(uid++),name:'🐞 แก้บั๊ก: '+t.name.replace('🐞 แก้บั๊ก: ',''),type:t.type==='design'?'design':'dev',effort:rndInt(3,5),pri:'H',dep:[],progress:0,status:'todo',riskSum:0,isBug:true};
    S.tasks.push(b);
    log('🐞 "'+t.name+'" เสร็จแต่มีบั๊ก! (โอกาสเกิด '+Math.round(chance*100)+'%)');
    popup(who,'🐞 เจอบั๊ก!','#e5484d'); Snd.play('bug'); if(who) cheer(who,false);
  } else {
    S.quality=clamp(S.quality+(t.isBug?2:1.5),0,100);
    log('✅ เสร็จ "'+t.name+'"');
    popup(who,'✅ เสร็จแล้ว!','#14a38b'); Snd.play('done'); if(who) cheer(who,true);
  }
  S.stake=clamp(S.stake+(t.pri==='H'?3:1.5),0,100);
  S.lastDoneT=S.t;
  // unlocked tasks notice
  S.tasks.filter(x=>x.status==='todo'&&x.dep.includes(t.id)&&!isBlocked(x)).forEach((x,i)=>{ log('🔓 ปลดล็อก "'+x.name+'"'); if(!i) setTimeout(()=>Snd.play('unlock'),450); });
  dirty(); checkWin();
}
function checkWin(){ if(!S.ended && S.tasks.every(t=>t.status!=='todo')) endGame('done'); }
function burnout(m){
  Snd.play('burnout');
  m.offUntil=S.t+2.5-0.5*ul('lounge'); m.task=null; m.morale=clamp(m.morale-15,0,100); m.stress=55; S.burnouts++; mark('😵',m.name+' Burnout');
  log('😵 '+m.name+' BURNOUT! ลาพัก 2.5 วัน');
  popup(m,'😵 Burnout!','#e5484d');
  addLesson('Burnout เกิดจากแรงกดดันต่อเนื่อง — OT ระยะสั้นช่วยได้ แต่ใช้ยาวจะทำให้ทีมพังและช้ากว่าเดิม (Sustainable pace)');
  dirty();
}
function snap(d){ const sc=S.tasks.filter(t=>t.status!=='cut'); return {d, rem:sc.reduce((a,t)=>a+(t.status==='done'?0:Math.max(0,t.effort-t.progress)),0), scope:sc.reduce((a,t)=>a+t.effort,0)}; }
function mark(icon,label){ if(S) S.marks.push({t:S.t,icon,label}); }
function onNewDay(d){
  S.hist.push(snap(d));
  Snd.play('day');
  if(d>=S.nextEvent && S.t<S.deadline-0.5){
    S.nextEvent = d + rndInt(S.L.ev[0],S.L.ev[1]);
    triggerEvent();
  }
}
function addLesson(s){ if(!S.lessons.includes(s)) S.lessons.push(s); }

/* ---------- events ---------- */
const EVENTS = [
 {id:'scope',w:3,max:3,make(){
   if(!S.feats.length) return null;
   const f=S.feats[0];
   return {icon:'📞',title:'ลูกค้าขอฟีเจอร์เพิ่ม',text:`ลูกค้าโทรมาว่า <b>"ขอเพิ่ม${f}หน่อยได้ไหม ง่าย ๆ เอง"</b> — งานนี้ประเมินแล้วราว 10 point`,
    lesson:'Scope creep คือฆาตกรเงียบของโปรเจกต์ — ทุกการเปลี่ยนแปลงควรผ่าน Change Request ที่ระบุผลกระทบต่อเวลาและงบชัดเจน',
    choices:[
     {label:'รับเลย ไม่อยากขัดใจลูกค้า',sub:'งานเพิ่ม แต่เวลาและงบเท่าเดิม',fx(){ S.feats.shift(); addTask(f,'dev',10,'M'); S.stake=clamp(S.stake+8,0,100); return 'ลูกค้ายิ้มแก้มปริ (+8) แต่ทีมต้องแบกงานเพิ่มโดยไม่มีเวลาเพิ่ม...'; }},
     {label:'เปิด Change Request (เพิ่มงบ + เวลา)',sub:'คุยตามกระบวนการ',fx(){ S.feats.shift(); addTask(f,'dev',10,'M'); S.money+=45000; S.budget+=45000; S.deadline+=2; S.crs++; S.stake=clamp(S.stake+2,0,100); return 'ลูกค้ายอมจ่ายเพิ่ม ฿45,000 และขยายเวลา 2 วัน — win-win แบบมืออาชีพ'; }},
     {label:'ปฏิเสธ ขอเก็บไว้เฟสถัดไป',sub:'รักษาแผนเดิม',fx(){ S.feats.shift(); S.stake=clamp(S.stake-10,0,100); return 'แผนยังอยู่ครบ แต่ลูกค้าดูไม่ค่อยพอใจ (−10)'; }}
    ]};
 }},
 {id:'sick',w:2,max:2,make(){
   const c=active().filter(m=>m.task); if(!c.length) return null; const m=pick(c);
   return {icon:'🤒',title:m.name+' ไม่สบาย',text:`${m.name} (${ROLES[m.role].th}) ส่งข้อความมาตอนเช้าว่าเป็นไข้ ตัวร้อน แต่บอกว่า "ถ้าจำเป็นทำจากบ้านได้ครับ/ค่ะ"`,
    lesson:'คนคือทรัพยากรที่สำคัญที่สุด — ฝืนให้คนป่วยทำงาน มักได้งานคุณภาพต่ำและเสี่ยง Burnout ระยะยาว',
    choices:[
     {label:'ให้พักเต็มที่ 2 วัน',sub:'งานของเขาจะหยุด — ควรหาคนรับช่วงไหม?',fx(){ m.offUntil=S.t+2; m.morale=clamp(m.morale+8,0,100); dirty(); return m.name+' ซึ้งใจมาก (ขวัญ +8) อย่าลืมพิจารณาย้ายงานด่วนให้คนอื่นนะ'; }},
     {label:'ขอให้ WFH ทำงานเบา ๆ',sub:'งานเดินต่อ',fx(){ m.stress=clamp(m.stress+30,0,100); m.morale=clamp(m.morale-12,0,100); return 'งานเดินต่อ แต่ '+m.name+' เครียดขึ้นมาก (+30) และรู้สึกไม่ได้รับการดูแล'; }}
    ]};
 }},
 {id:'conflict',w:2,max:1,make(){
   const a=active().find(m=>m.role==='dev'), b=active().find(m=>m.role==='design'); if(!a||!b) return null;
   return {icon:'💢',title:'ทีมขัดแย้งกัน',text:`${a.name} (Dev) กับ ${b.name} (Designer) เถียงกันเสียงดัง — "ดีไซน์แบบนี้ทำจริงไม่ได้!" vs "ก็ลองหาวิธีสิ!"`,
    lesson:'Conflict ที่ไม่จัดการจะลามเป็นปัญหาทีม — PM ควรเป็นตัวกลางให้คุยกันด้วยข้อมูลและเป้าหมายร่วม ไม่ใช่อารมณ์',
    choices:[
     {label:'นัดคุยหาทางกลางด้วยกัน',sub:'ทั้งคู่หยุดงานครึ่งวัน',fx(){ [a,b].forEach(m=>{m.busyUntil=S.t+0.5;m.morale=clamp(m.morale+10,0,100);}); S.quality=clamp(S.quality+3,0,100); return 'ได้ข้อสรุปที่ทั้งคู่ยอมรับ ขวัญทีม +10 คุณภาพ +3'; }},
     {label:'ตัดสินใจเองเลย ใช้ดีไซน์เดิม',sub:'เร็ว แต่มีคนไม่พอใจ',fx(){ b.morale=clamp(b.morale+5,0,100); a.stress=clamp(a.stress+20,0,100); a.morale=clamp(a.morale-8,0,100); return a.name+' ต้องฝืนทำของที่ยาก เครียด +20'; }},
     {label:'ปล่อยไว้ เดี๋ยวก็ดีกันเอง',sub:'ไม่เสียเวลา',fx(){ [a,b].forEach(m=>{m.morale=clamp(m.morale-18,0,100);m.stress=clamp(m.stress+10,0,100);}); return 'บรรยากาศมาคุทั้งออฟฟิศ ขวัญทั้งคู่ −18'; }}
    ]};
 }},
 {id:'demo',w:2,max:1,make(){
   if(S.t<3) return null;
   return {icon:'🎤',title:'ผู้บริหารขอดู Demo พรุ่งนี้!',text:'CEO ฝั่งลูกค้าอยากเห็นความคืบหน้าแบบด่วน ๆ ก่อนประชุมบอร์ด',
    lesson:'สื่อสารความคืบหน้าแบบโปร่งใสและสม่ำเสมอ ดีกว่าเตรียมโชว์ใหญ่ครั้งเดียว — ความเชื่อใจสร้างจากความจริง',
    choices:[
     {label:'ทั้งทีมเตรียม Demo ให้เต็มที่',sub:'ทุกคนหยุดงาน 1 วัน',fx(){ active().forEach(m=>m.busyUntil=S.t+1); S.stake=clamp(S.stake+15,0,100); return 'Demo ปัง! ลูกค้าพอใจ +15 แต่เสียเวลาทั้งทีมไป 1 วัน'; }},
     {label:'โชว์ของที่มีตามจริง',sub:'ไม่เสียเวลา ผลขึ้นกับความคืบหน้า',fx(){ const p=progress(); const g=p>=0.35; S.stake=clamp(S.stake+(g?8:-8),0,100); return g?'ความคืบหน้า '+Math.round(p*100)+'% ดูดีพอ ลูกค้าชอบความตรงไปตรงมา (+8)':'งานยังน้อยไป ('+Math.round(p*100)+'%) ลูกค้าเริ่มกังวล (−8)'; }},
     {label:'ขอเลื่อนไปสัปดาห์หน้า',sub:'',fx(){ S.stake=clamp(S.stake-10,0,100); return 'ลูกค้าไม่ค่อยพอใจ (−10)'; }}
    ]};
 }},
 {id:'offer',w:2,max:1,make(){
   const c=active().filter(m=>!m.freelance && m.skill>=3); if(!c.length||S.members.length<3) return null; const m=pick(c);
   return {icon:'💼',title:m.name+' ได้ข้อเสนองานใหม่',text:`${m.name} มาบอกตรง ๆ ว่ามีบริษัทอื่นให้เงินเดือนมากกว่า 30% กำลังลังเลอยู่...`,
    lesson:'การเสียคนเก่งกลางโปรเจกต์แพงกว่าการรักษาไว้เสมอ — ทั้ง knowledge loss และเวลาที่ต้องหาคนใหม่',
    choices:[
     {label:'ขึ้นเงินให้ 20%',sub:'ต้นทุนรายวันเพิ่ม',fx(){ m.salary=Math.round(m.salary*1.2); m.morale=clamp(m.morale+15,0,100); return m.name+' ตัดสินใจอยู่ต่อ ขวัญ +15 (ค่าจ้าง '+fmt(m.salary)+'/วัน)'; }},
     {label:'คุยเรื่องการเติบโต + งานที่ท้าทาย',sub:'ไม่เสียเงิน แต่มีความเสี่ยง',fx(){ if(Math.random()<0.6){ m.morale=clamp(m.morale+10,0,100); return m.name+' ประทับใจที่ได้รับการมองเห็น ตัดสินใจอยู่ต่อ!'; } const n=m.name; removeMember(m); S.members.forEach(x=>x.morale=clamp(x.morale-5,0,100)); return 'น่าเสียดาย '+n+' เลือกไป... งานที่ถืออยู่กลับเข้า To Do'; }},
     {label:'ยินดีด้วย ปล่อยไป',sub:'',fx(){ const n=m.name; removeMember(m); S.members.forEach(x=>x.morale=clamp(x.morale-6,0,100)); return n+' ลาออก ทีมเหลือ '+S.members.length+' คน ขวัญทีม −6'; }}
    ]};
 }},
 {id:'budget',w:2,max:1,make(){
   const c=S.tasks.filter(t=>t.status==='todo'&&t.pri!=='H'&&t.progress===0&&!assigned(t).length).sort((a,b)=>PRIW[a.pri]-PRIW[b.pri]);
   const amt=Math.round(S.budget*0.1/1000)*1000;
   const ch=[{label:'ยอมรับการตัดงบ',sub:'−'+fmt(amt),fx(){ S.money-=amt; return 'งบหายไป '+fmt(amt)+' ต้องบริหารเงินให้รัดกุมขึ้น'; }}];
   if(c.length) ch.push({label:'ต่อรอง: ตัดฟีเจอร์ "'+c[0].name+'" แทน',sub:'Scope ลด แต่งบคงเดิม',fx(){ c[0].status='cut'; S.cuts++; S.stake=clamp(S.stake-4,0,100); dirty(); return 'ตัด "'+c[0].name+'" ออก งบไม่โดนหั่น ลูกค้าพอใจ −4'; }});
   return {icon:'📉',title:'ฝ่ายการเงินตัดงบ 10%',text:'เศรษฐกิจไม่ดี บริษัทลูกค้าขอลดงบโปรเจกต์ลง '+fmt(amt),
    lesson:'Triple constraint: งบ–เวลา–ขอบเขต (Scope) เปลี่ยนตัวหนึ่ง ต้องปรับอีกตัวเสมอ',choices:ch};
 }},
 {id:'shiny',w:2,max:1,make(){
   const c=active().filter(m=>m.role==='dev'&&!m.freelance); if(!c.length) return null; const m=pick(c);
   return {icon:'✨',title:'อยากเปลี่ยนไปใช้ Framework ใหม่',text:`${m.name} เห็นคลิปบน X ว่ามี Framework ใหม่ "เร็วกว่าเดิม 10 เท่า!" อยากย้ายโปรเจกต์ไปใช้ตอนนี้เลย`,
    lesson:'ลดความเสี่ยงด้วย Spike / POC แบบจำกัดเวลา ก่อนตัดสินใจเปลี่ยนเทคโนโลยีกลางทาง',
    choices:[
     {label:'ลองเลย! เทคใหม่ต้องดีกว่า',sub:'เสี่ยงสูง',fx(){ if(Math.random()<0.35){ m.skill=Math.min(5,m.skill+1); m.morale=clamp(m.morale+10,0,100); return 'โชคดี! มันเวิร์กจริง '+m.name+' skill +1'; } S.tasks.filter(t=>t.status==='todo'&&t.type==='dev'&&t.progress>0).forEach(t=>t.progress*=0.65); S.quality=clamp(S.quality-6,0,100); return 'พัง... ต้องย้อนกลับ งาน dev ที่ทำค้างเสียไป 35% คุณภาพ −6'; }},
     {label:'ให้ทำ Spike 1 วันก่อนตัดสินใจ',sub:'เสียเวลาเขา 1 วัน',fx(){ m.busyUntil=S.t+1; m.morale=clamp(m.morale+6,0,100); S.quality=clamp(S.quality+2,0,100); return 'ผล Spike: ยังไม่ mature พอ ใช้ของเดิมไปก่อน — ทีมเห็นด้วยเพราะมีข้อมูล'; }},
     {label:'ไม่ได้ ยึดตามแผน',sub:'',fx(){ m.morale=clamp(m.morale-10,0,100); return m.name+' หงอยไปเลย ขวัญ −10'; }}
    ]};
 }},
 {id:'prodbug',w:2,max:2,make(){
   const d=S.tasks.filter(t=>t.status==='done'&&t.type!=='qa'&&!t.isBug); if(!d.length) return null; const t=pick(d);
   return {icon:'🚨',title:'เจอบั๊กร้ายแรง!',text:`ลูกค้าเจอบั๊กใน "<b>${t.name}</b>" ที่ส่งไปแล้ว ระบบล่มบางส่วน`,
    lesson:'ยิ่งเจอบั๊กช้า ยิ่งแก้แพง — ลงทุนกับ QA, Test Plan และ Code Review ตั้งแต่ต้น',
    choices:[
     {label:'Hotfix ทันที',sub:'เพิ่มงานด่วน Priority H',fx(){ addTask('แก้บั๊ก: '+t.name,'dev',5,'H',true); S.quality=clamp(S.quality-3,0,100); S.stake=clamp(S.stake+3,0,100); return 'เพิ่มงาน Hotfix ใน To Do แล้ว ลูกค้าชอบที่ตอบสนองไว'; }},
     {label:'จดไว้แก้รอบหน้า',sub:'ไม่เสียเวลาตอนนี้',fx(){ S.quality=clamp(S.quality-10,0,100); S.stake=clamp(S.stake-10,0,100); return 'คุณภาพ −10 ลูกค้าพอใจ −10 (หนี้ทางเทคนิคพอกพูน)'; }}
    ]};
 }},
 {id:'meetings',w:1,max:1,make(){
   if(S.effMod<1) return null;
   return {icon:'📆',title:'ลูกค้าขอประชุม Status ทุกวัน',text:'ลูกค้าอยากให้ทั้งทีมเข้าประชุมอัปเดตทุกเช้า วันละ 1 ชั่วโมง',
    lesson:'ประชุมเยอะ ≠ คืบหน้าเยอะ — หาช่องทางสื่อสารที่ไม่กินเวลาทีม เช่น Weekly report หรือ Dashboard',
    choices:[
     {label:'ตกลง ตามใจลูกค้า',sub:'ทีมทำงานช้าลง 10% ตลอดโปรเจกต์',fx(){ S.effMod=0.9; S.stake=clamp(S.stake+10,0,100); return 'ลูกค้าพอใจ +10 แต่ productivity ทีมลดลง 10% ถาวร'; }},
     {label:'เสนอ Weekly Report + Dashboard แทน',sub:'PM ทำเอง',fx(){ S.stake=clamp(S.stake+4,0,100); return 'ลูกค้ายอมรับ ได้เห็นข้อมูลชัดกว่าเดิม (+4) ทีมไม่เสียเวลา'; }}
    ]};
 }},
 {id:'bonus',w:2,max:1,make(){
   if(S.stake<72||S.t<4) return null;
   return {icon:'🎁',title:'ลูกค้าประทับใจ ให้โบนัส!',text:'ลูกค้าชมว่าความคืบหน้าดีเกินคาด ขอมอบงบพิเศษ ฿30,000',
    lesson:'Contingency budget ช่วยรองรับความเสี่ยงในอนาคต ส่วนการให้รางวัลทีมก็สร้างแรงจูงใจระยะยาว — เลือกให้เหมาะกับสถานการณ์',
    choices:[
     {label:'เก็บเป็นงบสำรอง',sub:'+฿30,000',fx(){ S.money+=30000; return 'งบสำรองเพิ่ม ฿30,000'; }},
     {label:'แบ่งเป็นโบนัสทีม',sub:'+฿10,000 และขวัญทุกคน +15',fx(){ S.money+=10000; S.members.forEach(m=>{m.morale=clamp(m.morale+15,0,100);m.stress=clamp(m.stress-10,0,100);}); return 'ทีมดีใจสุด ๆ ขวัญ +15 ทุกคน'; }}
    ]};
 }}
];
function addTask(name,type,effort,pri,isBug){
  S.tasks.push({id:'x'+(uid++),name:(isBug?'🐞 ':'')+name,type,effort,pri,dep:[],progress:0,status:'todo',riskSum:0,isBug:!!isBug,extra:!isBug});
  dirty();
}
function progress(){
  const sc=S.tasks.filter(t=>t.status!=='cut');
  const tot=sc.reduce((a,t)=>a+t.effort,0)||1;
  return sc.reduce((a,t)=>a+(t.status==='done'?t.effort:Math.min(t.progress,t.effort)),0)/tot;
}
function triggerEvent(){
  const pool=[];
  EVENTS.forEach(e=>{ if((S.used[e.id]||0)>=e.max) return; const inst=e.make(); if(inst) pool.push({e,inst}); });
  if(!pool.length) return;
  const tw=pool.reduce((a,p)=>a+p.e.w,0); let r=Math.random()*tw, sel=pool[0];
  for(const p of pool){ r-=p.e.w; if(r<=0){ sel=p; break; } }
  S.used[sel.e.id]=(S.used[sel.e.id]||0)+1;
  showEvent(sel.inst);
}
function openModal(html){ $('#modalBody').innerHTML=html; $('#modal').classList.remove('hide'); }
function closeModal(prev){ $('#modal').classList.add('hide'); S.modal=false; setSpeed(prev||0); dirty(); }
function showEvent(ev){
  const prev = S.speed||1;
  S.modal=true; setSpeed(0); Snd.play('event');
  openModal(`<div class="ev-ic">${ev.icon}</div><h2>${ev.title}</h2><p>${ev.text}</p><div id="chs">${ev.choices.map((c,i)=>`<button class="choice" data-i="${i}"><b>${c.label}</b>${c.sub?`<small>${c.sub}</small>`:''}</button>`).join('')}</div>`);
  $('#modalBody').querySelectorAll('.choice').forEach(b=>b.onclick=()=>{
    const c=ev.choices[+b.dataset.i];
    const res=c.fx();
    addLesson(ev.lesson);
    log(ev.icon+' '+ev.title+' → '+c.label); mark(ev.icon,ev.title);
    $('#chs').innerHTML=`<div class="res"><b>ผลลัพธ์:</b> ${res}</div><div class="lesson"><b>💡 บทเรียน PM:</b> ${ev.lesson}</div><button class="big" id="evGo">ไปต่อ ▶</button>`;
    $('#evGo').onclick=()=>{ closeModal(prev); if(!S.ended) checkWin(); };
  });
}

/* ---------- end ---------- */
function endGame(reason){
  if(S.ended) return;
  S.ended=true; S.modal=false; setSpeed(0);
  $('#modal').classList.add('hide');
  const scoped=S.tasks.filter(t=>t.status!=='cut'&&!t.isBug);
  const totW=scoped.reduce((a,t)=>a+PRIW[t.pri],0)||1;
  const doneW=scoped.reduce((a,t)=>a+PRIW[t.pri]*(t.status==='done'?1:Math.min(1,t.progress/t.effort)*0.4),0);
  const completion=clamp(doneW/totW*100,0,100);
  const openBugs=S.tasks.filter(t=>t.isBug&&t.status==='todo').length;
  const early=Math.max(0,S.deadline-S.t);
  const time = reason==='done'?clamp(72+early*9,0,100):reason==='bankrupt'?0:(completion>=99?70:30);
  const br=S.money/S.budget;
  const budgetS = br>=0 ? clamp(45+br*200,0,100) : clamp(60+br*200,0,100);
  const qual=clamp(S.quality-openBugs*5,0,100);
  const mor=avgMorale();
  const total = completion*0.35+time*0.15+budgetS*0.15+qual*0.15+S.stake*0.1+mor*0.1;
  const grade = total>=92?'S':total>=82?'A':total>=70?'B':total>=56?'C':total>=40?'D':'F';
  const gcol = {S:'#ffc53d',A:'#14a38b',B:'#3d7bff',C:'#f08c00',D:'#e5484d',F:'#8a93a6'}[grade];
  S.hist.push(snap(S.t));
  const order='FDCBAS', oldB=SAVE.best[S.L.id]; if(!oldB||order.indexOf(grade)>order.indexOf(oldB)) SAVE.best[S.L.id]=grade;
  const delivered = reason==='done';
  let mask=0; if(delivered){ mask|=1; S.L.obj.forEach((k,i)=>{ if(OBJ[k].ok()) mask|=(2<<i); }); }
  const prevMask=SAVE.stars[S.L.id]||0, newMask=mask&~prevMask;
  const cGrade={S:60,A:45,B:30,C:20,D:10,F:5}[grade], cStar=popc(newMask)*25, cBudget=Math.max(0,Math.round(S.money/10000));
  const earned=cGrade+cStar+cBudget;
  SAVE.coins+=earned; SAVE.stars[S.L.id]=prevMask|mask; persist();
  const labels=starLabels(S.L);
  const starHTML=`<div class="starrow">${labels.map((l,i)=>{ const got=mask&(1<<i), nw=newMask&(1<<i); return `<div class="star ${got?'got':''}" style="animation-delay:${i*0.15}s"><span class="s" style="animation-delay:${0.2+i*0.25}s">⭐</span><span>${l}${nw?'<span class="nw">NEW</span>':''}${!delivered&&i>0?'<br><small style="opacity:.6">ต้องส่งงานครบก่อน</small>':''}</span></div>`; }).join('')}</div>
   <div class="earn">ได้เหรียญ <b>🪙 +${earned}</b><span>เกรด ${grade} +${cGrade}</span>${cStar?`<span>ดาวใหม่ +${cStar}</span>`:''}${cBudget?`<span>งบเหลือ +${cBudget}</span>`:''}<span style="margin-left:auto">รวม 🪙 ${SAVE.coins}</span></div>`;
  const title = reason==='done' ? '🎉 ส่งมอบโปรเจกต์สำเร็จ!' : reason==='bankrupt' ? '💸 งบบานปลาย — โปรเจกต์ถูกระงับ' : '⏰ หมด Deadline!';
  const sub = reason==='done' ? (early>=1?'เร็วกว่ากำหนด '+early.toFixed(1)+' วัน':'ทันเส้นตายแบบเฉียดฉิว') : reason==='bankrupt' ? 'ใช้เงินเกินงบไปกว่า 30%' : 'ส่งงานได้ '+Math.round(completion)+'% ของ scope';
  // auto lessons
  const L2=S.lessons.slice();
  if(S.idleWaste>2) L2.unshift('ทรัพยากรว่างงานรวม '+S.idleWaste.toFixed(1)+' วัน-คน ขณะที่ยังมีงานรออยู่ — PM ที่ดีต้องดู Resource utilization และแจกงานล่วงหน้า');
  if(S.bugs>=3) L2.unshift('เกิดบั๊ก '+S.bugs+' ครั้ง — สาเหตุหลักคือใช้คนผิดสายงาน ความเครียดสูง หรือ OT นาน ๆ (Quality vs Speed)');
  if(S.otTime>5) L2.unshift('ใช้ OT รวม '+S.otTime.toFixed(1)+' วัน — ได้ความเร็วแลกกับความเครียดและค่าใช้จ่ายที่เพิ่มขึ้น');
  if(!L2.length) L2.push('บริหารได้ราบรื่นมาก! ลองเล่นด่านที่ยากขึ้นเพื่อเจอ dependency และความเสี่ยงที่ซับซ้อนกว่าเดิม');
  const row=(n,v)=>`<span>${n}</span><div class="bar"><i style="width:${v}%"></i></div><span>${Math.round(v)}</span>`;
  $('#endBody').innerHTML=`
   <div class="endtop"><div class="grade" style="background:${gcol}">${grade}</div><div><h2>${title}</h2><p style="margin:4px 0">${sub}</p><p style="font-family:Kanit;font-size:22px;font-weight:700">คะแนนรวม ${Math.round(total)}/100</p></div></div>
   ${starHTML}
   ${burndownHTML()}
   <div class="sc">${row('Scope ที่ส่งมอบ',completion)}${row('ตรงเวลา',time)}${row('การคุมงบ',budgetS)}${row('คุณภาพ',qual)}${row('ลูกค้าพอใจ',S.stake)}${row('ขวัญทีม',mor)}</div>
   <div class="facts"><span>💰 งบเหลือ ${fmt(S.money)}</span><span>🐞 บั๊ก ${S.bugs}</span><span>😵 Burnout ${S.burnouts}</span><span>✂️ ตัด scope ${S.cuts}</span><span>📅 เลื่อน ${S.extensions}</span><span>📝 CR ${S.crs}</span><span>🔥 OT ${S.otTime.toFixed(1)} วัน</span></div>
   <div class="lessons"><h3>💡 บทเรียนจากโปรเจกต์นี้</h3><ul>${L2.slice(0,7).map(s=>`<li>${s}</li>`).join('')}</ul></div>
   <button class="big" id="again">เล่นด่านนี้อีกครั้ง</button> <button class="big alt" id="menu">เลือกด่าน</button> <button class="big alt" id="toShop">🏢 อัปเกรดออฟฟิศ</button>`;
  wireBurndown();
  $('#end').classList.remove('hide'); Snd.play(reason==='done'?'win':'lose');
  $('#again').onclick=()=>{ $('#end').classList.add('hide'); newGame(S.li); };
  $('#menu').onclick=()=>{ $('#end').classList.add('hide'); showStart(); };
  $('#toShop').onclick=()=>{ $('#end').classList.add('hide'); showStart('shop'); };
}

/* ---------- burndown ---------- */
let BD=null;
function burndownHTML(){
  const H=S.hist; if(H.length<2) return '';
  const W=640, HH=250, pl=42, pr=14, pt=30, pb=30;
  const r0=H[0].rem, od=S.origDeadline;
  const xMax=Math.max(S.deadline,S.t,od), yMax=Math.max(...H.map(h=>h.scope))*1.08||1;
  const X=d=>pl+d/xMax*(W-pl-pr), Y=v=>pt+(1-v/yMax)*(HH-pt-pb);
  const ideal=d=>Math.max(0,r0*(1-d/od));
  let g='';
  const step=yMax>120?40:yMax>60?20:10;
  for(let v=0;v<=yMax;v+=step){ g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1d2433" stroke-opacity=".08"/><text x="${pl-6}" y="${Y(v)+4}" font-size="11" text-anchor="end" fill="#1d2433" fill-opacity=".55">${v}</text>`; }
  const xs=xMax>20?5:2;
  for(let d=0;d<=xMax;d+=xs){ g+=`<text x="${X(d)}" y="${HH-pb+16}" font-size="11" text-anchor="middle" fill="#1d2433" fill-opacity=".55">${d}</text>`; }
  g+=`<text x="${W-pr}" y="${HH-4}" font-size="11" text-anchor="end" fill="#1d2433" fill-opacity=".55">วัน</text><text x="${pl}" y="14" font-size="11" fill="#1d2433" fill-opacity=".55">pt</text>`;
  // deadline lines
  if(S.deadline!==od) g+=`<line x1="${X(od)}" x2="${X(od)}" y1="${pt}" y2="${HH-pb}" stroke="#1d2433" stroke-opacity=".25" stroke-dasharray="2 4"/>`;
  g+=`<line x1="${X(S.deadline)}" x2="${X(S.deadline)}" y1="${pt}" y2="${HH-pb}" stroke="#1d2433" stroke-opacity=".5" stroke-dasharray="2 3"/><text x="${X(S.deadline)-4}" y="${pt+10}" font-size="11" text-anchor="end" fill="#1d2433">Deadline</text>`;
  // ideal
  g+=`<line x1="${X(0)}" y1="${Y(r0)}" x2="${X(od)}" y2="${Y(0)}" stroke="#1d2433" stroke-width="2" stroke-dasharray="6 5" stroke-opacity=".6"/>`;
  const pts=k=>H.map(h=>X(h.d).toFixed(1)+','+Y(h[k]).toFixed(1)).join(' ');
  g+=`<polygon points="${X(0)},${Y(0)} ${pts('rem')} ${X(H[H.length-1].d)},${Y(0)}" fill="#e8552a" fill-opacity=".08"/>`;
  g+=`<polyline points="${pts('scope')}" fill="none" stroke="#0f8a75" stroke-width="2" stroke-linejoin="round"/>`;
  g+=`<polyline points="${pts('rem')}" fill="none" stroke="#e8552a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  const last=H[H.length-1];
  g+=`<circle cx="${X(last.d)}" cy="${Y(last.rem)}" r="4.5" fill="#e8552a" stroke="#fff" stroke-width="2"/>`;
  // marks
  const seen={};
  S.marks.forEach(mk=>{ const x=X(mk.t); const k=Math.round(x/14); const yo=(seen[k]=(seen[k]||0)+1)-1;
    g+=`<line x1="${x}" x2="${x}" y1="${pt}" y2="${HH-pb}" stroke="#1d2433" stroke-opacity=".07"/><text x="${x}" y="${pt-8-yo*13}" font-size="13" text-anchor="middle"><title>วันที่ ${(mk.t+1).toFixed(1)}: ${mk.label}</title>${mk.icon}</text>`; });
  g+=`<line id="bdX" x1="0" x2="0" y1="${pt}" y2="${HH-pb}" stroke="#1d2433" stroke-opacity=".45" visibility="hidden"/><circle id="bdDot" r="5" fill="#e8552a" stroke="#fff" stroke-width="2" visibility="hidden"/>`;
  g+=`<rect id="bdHit" x="${pl}" y="${pt}" width="${W-pl-pr}" height="${HH-pt-pb}" fill="transparent"/>`;
  BD={X,Y,xMax,pl,pr,W,ideal};
  // insights
  const ins=[];
  const vel=(last.scope-last.rem)/Math.max(0.1,last.d), need=r0/od;
  ins.push(`Velocity จริง <b>${vel.toFixed(1)} pt/วัน</b> เทียบกับที่แผนต้องการ ${need.toFixed(1)} pt/วัน`+(vel>=need?' ✅':' — ทีมทำได้ช้ากว่าแผน'));
  const behind=H.find(h=>h.d>0&&h.rem>ideal(h.d)*1.12+2);
  if(behind) ins.push(`เริ่มหลุดจากแผนตั้งแต่ <b>วันที่ ${behind.d}</b> (คงเหลือ ${Math.round(behind.rem)} pt แต่แผนควรเหลือ ${Math.round(ideal(behind.d))} pt) — ช่วงนั้นลองดูว่ามีคนว่าง งานติด dependency หรือมีเหตุการณ์อะไรเข้ามา`);
  else ins.push('เส้นงานคงเหลืออยู่ใต้เส้นแผนตลอด แปลว่าทำได้ตามหรือเร็วกว่าแผน 👏');
  const grow=last.scope-H[0].scope;
  if(grow>0) ins.push(`Scope โตขึ้น <b>+${Math.round(grow)} pt</b> ระหว่างทาง (ฟีเจอร์ที่รับเพิ่มและบั๊ก) — เส้นสีเขียวที่ยกตัวขึ้นคือสัญญาณ Scope creep`);
  else if(grow<0) ins.push(`ตัด Scope ไป ${Math.round(-grow)} pt — ช่วยให้ส่งงานทัน แลกกับความพอใจของลูกค้า`);
  return `<div class="bd" id="bdBox"><h3>📉 Burndown Chart</h3><div class="sub">งานคงเหลือ (story point) ในแต่ละวัน เทียบกับแผน · ชี้เมาส์ดูรายวัน · ไอคอนด้านบน = เหตุการณ์</div>
   <div class="legend"><span><i style="border-color:#e8552a"></i>งานคงเหลือ</span><span><i style="border-color:#0f8a75"></i>Scope รวม</span><span><i style="border-color:#1d2433;border-top-style:dashed;opacity:.6"></i>แผน (Ideal)</span></div>
   <svg viewBox="0 0 ${W} ${HH}" role="img" aria-label="Burndown chart">${g}</svg><div class="tip" id="bdTip"></div>
   <ul>${ins.map(i=>`<li class="insight">${i}</li>`).join('')}</ul></div>`;
}
function wireBurndown(){
  const svg=document.querySelector('#bdBox svg'); if(!svg||!BD) return;
  const tip=$('#bdTip'), xl=$('#bdX'), dot=$('#bdDot'), H=S.hist;
  function mv(e){
    const r=svg.getBoundingClientRect(); const sx=(e.clientX-r.left)/r.width*BD.W;
    const d=(sx-BD.pl)/(BD.W-BD.pl-BD.pr)*BD.xMax;
    let best=H[0]; H.forEach(h=>{ if(Math.abs(h.d-d)<Math.abs(best.d-d)) best=h; });
    const x=BD.X(best.d), y=BD.Y(best.rem);
    xl.setAttribute('x1',x); xl.setAttribute('x2',x); xl.setAttribute('visibility','visible');
    dot.setAttribute('cx',x); dot.setAttribute('cy',y); dot.setAttribute('visibility','visible');
    const ev=S.marks.filter(m=>Math.floor(m.t)===Math.floor(best.d-0.001)||Math.floor(m.t)===Math.floor(best.d)).map(m=>m.icon+' '+m.label).slice(0,3);
    tip.innerHTML=`<b>วันที่ ${(+best.d).toFixed(best.d%1?1:0)}</b><br>คงเหลือ ${Math.round(best.rem)} pt<br>แผน ${Math.round(BD.ideal(best.d))} pt<br>Scope รวม ${Math.round(best.scope)} pt${ev.length?'<br>'+ev.join('<br>'):''}`;
    tip.style.display='block';
    const box=$('#bdBox').getBoundingClientRect(); let lx=e.clientX-box.left+14; if(lx>box.width-170) lx=e.clientX-box.left-170;
    tip.style.left=lx+'px'; tip.style.top=(r.top-box.top+20)+'px';
  }
  svg.addEventListener('pointermove',mv); svg.addEventListener('pointerdown',mv);
  svg.addEventListener('pointerleave',()=>{ tip.style.display='none'; xl.setAttribute('visibility','hidden'); dot.setAttribute('visibility','hidden'); });
}

/* ================= UI RENDER ================= */
function cardHTML(t){
  const as=assigned(t), bl=t.status==='todo'&&isBlocked(t);
  const cls=['card','t-'+t.type]; if(bl) cls.push('blocked'); if(t.status==='done') cls.push('done'); if(t.status==='cut') cls.push('cut'); if(t.isBug) cls.push('bug');
  if(S.selTask===t) cls.push('sel');
  if(t.status==='todo'&&t.pri!=='H'&&t.progress===0&&!as.length) cls.push('cuttable');
  let meta='';
  if(t.status==='todo'){
    if(bl) meta='🔒 รอ: '+t.dep.map(taskById).filter(d=>d.status==='todo').map(d=>d.name).join(', ');
    else if(as.length) meta='👤 '+as.map(m=>m.name+(m.offUntil>S.t?' (ลา)':'')).join(', ');
    else if(t.progress>0) meta='⏸ ค้างไว้ — ยังไม่มีคนทำ';
    else meta='พร้อมเริ่ม · '+ROLES[t.type].th;
  }
  const pct=Math.min(100,t.progress/t.effort*100);
  let chips='';
  if(S.selTask===t && !bl){
    const ms=S.members.filter(m=>m.offUntil<=S.t&&m.task!==t.id).sort((a,b)=>((b.role===t.type)-(a.role===t.type))||(!!a.task-!!b.task));
    chips=`<div class="chips"><span class="lab">มอบงานนี้ให้:</span>${ms.map(m=>{const rec=m.role===t.type; return `<button class="chip ${rec?'rec':''} ${m.task?'busy':''}" data-assign="${m.id}">${ROLES[m.role].icon} ${m.name}${rec?' <small>ตรงสาย</small>':''}${m.task?' <small>(มีงานอยู่)</small>':''}${m.stress>75?' <small>😰</small>':''}</button>`;}).join('')||'<span class="lab">ไม่มีใครว่าง</span>'}</div>`;
  }
  return `<div class="${cls.join(' ')}" data-task="${t.id}"><div class="row"><span>${t.status==='done'?'✅':ROLES[t.type].icon}</span><b>${t.name}</b><span class="pri ${t.pri}">${t.pri}</span></div>
   <div class="bar"><i data-pb="${t.id}" style="width:${pct}%;background:${ROLES[t.type].css}"></i></div>
   <div class="meta"><span data-pt="${t.id}">${Math.floor(Math.min(t.progress,t.effort))}/${t.effort} pt</span> · ${meta}</div>${chips}</div>`;
}
function renderBoard(){
  const todo=S.tasks.filter(t=>t.status==='todo'&&!assigned(t).length);
  todo.sort((a,b)=>(isBlocked(a)-isBlocked(b))||(PRIW[b.pri]-PRIW[a.pri]));
  const doing=S.tasks.filter(t=>t.status==='todo'&&assigned(t).length);
  const done=S.tasks.filter(t=>t.status==='done'||t.status==='cut');
  $('#boardList').innerHTML=
   `<div class="sec"><span>⚡ Doing</span><span>${doing.length}</span></div>${doing.map(cardHTML).join('')||'<div class="meta" style="padding:4px">ยังไม่มีใครทำงาน</div>'}
    <div class="sec"><span>📥 To Do</span><span>${todo.length}</span></div>${todo.map(cardHTML).join('')}
    <div class="sec"><span>✅ Done</span><span>${done.length}</span></div>${done.map(cardHTML).join('')}`;
  $('#board').classList.toggle('cutmode',S.mode==='cut');
}
$('#boardList').addEventListener('click',e=>{
  if(!S||dragJustEnded) return;
  const a=e.target.closest('[data-assign]');
  if(a){ const m=S.members.find(x=>x.id===+a.dataset.assign), t=taskById(a.closest('[data-task]').dataset.task); if(m&&t){ assign(m,t); S.selTask=null; S.selMember=null; hint(''); dirty(); } return; }
  const c=e.target.closest('[data-task]'); if(c) clickTask(taskById(c.dataset.task));
});
function stars(n){ return '★'.repeat(n)+'<span style="opacity:.25">'+'★'.repeat(5-n)+'</span>'; }
function stateIcon(m){ return {work:'💻',idle:'☕',meet:'🗣️',switch:'🤯',off:'🏠'}[m.state]||'☕'; }
function stateText(m){
  const t=m.task&&taskById(m.task);
  if(m.offUntil>S.t) return '🏠 ลาพักอีก '+(m.offUntil-S.t).toFixed(1)+' วัน';
  if(m.busyUntil>S.t) return '🗣️ ประชุม/คุยงาน';
  if(t&&m.switchUntil>S.t) return '🤯 กำลังสลับงาน';
  if(t) return '💻 '+t.name;
  return '☕ ว่าง — รอรับงาน';
}
function renderTeam(){
  const tsel=S.selTask;
  $('#teamList').innerHTML=S.members.map(m=>`<div class="mem ${S.selMember===m?'sel':''} ${m.offUntil>S.t?'off':''} ${tsel&&tsel.type===m.role?'match':''}" data-mem="${m.id}">
    <div class="row"><span class="dot" style="background:${ROLES[m.role].css}"></span><b>${m.name}</b><span class="stars">${stars(m.skill)}</span><span data-si="${m.id}">${stateIcon(m)}</span></div>
    <div class="meta" data-st="${m.id}">${stateText(m)}</div>
    <div class="mb"><label>ขวัญ</label><div class="bar m"><i data-mm="${m.id}" style="width:${m.morale}%"></i></div><label>เครียด</label><div class="bar s"><i data-ms="${m.id}" style="width:${m.stress}%"></i></div></div></div>`).join('');
  const m=S.selMember;
  if(!m){ $('#selCard').innerHTML='<div class="empty">คลิกคนในฉากหรือในรายชื่อ<br>เพื่อดูรายละเอียด / สั่งงาน</div>'; }
  else{
    $('#selCard').innerHTML=`<h4><span class="dot" style="background:${ROLES[m.role].css}"></span>${m.name}${m.freelance?' <small style="font-size:11px;opacity:.6">ฟรีแลนซ์</small>':''}</h4>
     <div>${ROLES[m.role].icon} ${ROLES[m.role].th} · <span class="stars">${stars(m.skill)}</span> · ${fmt(m.salary)}/วัน</div>
     <div style="margin-top:3px" data-st2="1">${stateText(m)}</div>
     <div class="btns"><button class="btn" id="b11">🗣️ คุย 1:1</button><button class="btn" id="bUn" ${m.task?'':'disabled'}>✖ วางงาน</button></div>
     ${m.offUntil>S.t?'':`<div class="meta" style="margin-top:6px">งานที่แนะนำสำหรับ ${m.name}:</div>${(()=>{const f=freeTasks().sort((a,b)=>((b.type===m.role)-(a.type===m.role))||(PRIW[b.pri]-PRIW[a.pri])).slice(0,3); return f.map(t=>`<button class="qtask" data-q="${t.id}">➕ ${ROLES[t.type].icon} ${t.name} <small>${t.type===m.role?'✓ ตรงสาย':'⚠️ ต่างสาย'} · ${t.pri}</small></button>`).join('')||'<div class="meta">ไม่มีงานว่างตอนนี้</div>';})()}`}`;
    $('#selCard').querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ assign(m,taskById(b.dataset.q)); S.selMember=null; dirty(); });
    $('#b11').onclick=()=>$('#a11').click();
    $('#bUn').onclick=()=>unassign(m);
  }
  const daily=S.members.reduce((a,m)=>a+m.salary,0)*(S.ot?1.3:1);
  $('#burnRate').textContent='ค่าจ้าง '+fmtK(daily)+'/วัน';
}
$('#teamList').addEventListener('click',e=>{ const c=e.target.closest('[data-mem]'); if(c&&S){ const m=S.members.find(x=>x.id===+c.dataset.mem); if(m) clickMember(m);} });

let uiAcc=0;
function updateUI(force){
  if(!S) return;
  if(S._dirty||force){
    S._dirty=false; renderBoard(); renderTeam(); drawWhiteboard();
    $('#aOT').classList.toggle('on',S.ot);
    $('#aPull').classList.toggle('on',S.autoPull); $('#pullTxt').textContent=S.autoPull?'เปิดอยู่':'ปิดอยู่';
    const ic=idleCount(); $('#idleBadge').innerHTML=ic?`<span class="idlebadge">☕ ว่าง ${ic}</span>`:'';
    $('#aCut').classList.toggle('on',S.mode==='cut');
    $('#lunchCost').textContent=S.lunchReady>S.t?'รออีก '+Math.ceil(S.lunchReady-S.t)+' วัน':fmt(2000*S.members.length);
    $('#extCost').textContent=S.extensions>=2?'ใช้ครบแล้ว':'ลูกค้าพอใจ −'+(15+S.extensions*10);
    $('#a11 .c').textContent=S.selMember?'กับ '+S.selMember.name:'เลือกคนก่อน';
    $('#aHire').disabled=S.freelancers>=2;
    $('#aExt').disabled=S.extensions>=2;
  }
  if(S.L.obj){ const oh=starLabels(S.L).map((l,i)=>{ if(i===0) return `<span class="obj">⭐ ${l}</span>`; const o=OBJ[S.L.obj[i-1]]; const st=o.lock&&o.lock()?'bad':o.ok()?'ok':''; return `<span class="obj ${st}">⭐ ${l}${st==='ok'?' ✓':''}</span>`; }).join('');
    if(oh!==S._oh){ S._oh=oh; $('#objBox').innerHTML=oh; } }
  const day=Math.min(S.deadline,Math.floor(S.t)+1);
  $('#sDay').textContent=day+'/'+S.deadline;
  $('#sDay').className='num '+(S.deadline-S.t<3?'bad':'');
  $('#sDayBar').style.width=(S.t/S.deadline*100)+'%';
  $('#sMoney').textContent=fmtK(S.money); $('#sMoney').className='num '+(S.money<S.budget*0.15?'bad':'');
  $('#sMoneyBar').style.width=clamp(S.money/S.budget*100,0,100)+'%';
  const p=progress(); $('#sProg').textContent=Math.round(p*100)+'%'; $('#sProgBar').style.width=(p*100)+'%';
  $('#sProgBar').style.background = p >= S.t/S.deadline ? 'var(--teal)' : 'var(--red)';
  const q=Math.round(S.quality); $('#sQual').textContent=q; $('#sQual').className='num '+(q<60?'bad':q>=85?'good':'');
  const sk=Math.round(S.stake); $('#sStake').textContent=(sk>=75?'😊 ':sk>=50?'😐 ':'😠 ')+sk; $('#sStake').className='num '+(sk<50?'bad':'');
  const mo=Math.round(avgMorale()); $('#sMorale').textContent=mo; $('#sMorale').className='num '+(mo<45?'bad':mo>=80?'good':'');
  // live bars
  S.tasks.forEach(t=>{ const b=document.querySelector('[data-pb="'+t.id+'"]'); if(b) b.style.width=Math.min(100,t.progress/t.effort*100)+'%'; const tx=document.querySelector('[data-pt="'+t.id+'"]'); if(tx) tx.textContent=Math.floor(Math.min(t.progress,t.effort))+'/'+t.effort+' pt'; });
  S.members.forEach(m=>{
    const a=document.querySelector('[data-mm="'+m.id+'"]'); if(a) a.style.width=m.morale+'%';
    const b=document.querySelector('[data-ms="'+m.id+'"]'); if(b) b.style.width=m.stress+'%';
    const c=document.querySelector('[data-si="'+m.id+'"]'); if(c) c.textContent=stateIcon(m);
    const d=document.querySelector('[data-st="'+m.id+'"]'); if(d) d.textContent=stateText(m);
  });
  if(S.selMember){ const e=document.querySelector('[data-st2]'); if(e) e.textContent=stateText(S.selMember); }
}

/* ================= LOOP ================= */
const clock = new THREE.Clock();
function pmFace(goal,dt){ let df=goal-pm.p.rotation.y; df=Math.atan2(Math.sin(df),Math.cos(df)); pm.p.rotation.y+=df*(1-Math.exp(-12*dt)); }
const tmpV = new THREE.Vector3();
const cGreen=new THREE.Color(0x3ecf8e), cYel=new THREE.Color(0xffc53d), cRed=new THREE.Color(0xe5484d);
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),0.1), T=clock.elapsedTime;
  if(S && !S.ended && !S.modal && S.speed>0) sim(dt*S.speed/daySec());
  if(S){
    for(const m of S.members){
      const v=m.v;
      if(v.grow!==undefined && v.grow<1){ v.grow=Math.min(1,v.grow+dt*1.8); const s=1-Math.pow(1-v.grow,3); v.g.scale.setScalar(Math.max(0.01,s)); }
      const off=m.offUntil>S.t; const shopHide=document.body.classList.contains('shopmode'); v.p.visible=!off&&!shopHide;
      const ph=T*1.0+v.phase;
      const working=m.state==='work' && S.speed>0;
      if(working && !S.modal && Math.random()<dt*(S.ot?5:3)) Snd.play('type');
      // target pose ตามสถานะ แล้วค่อย ๆ blend เข้าหา (เปลี่ยนท่าไม่กระตุก)
      let aL, aR, hx, hy, hz=0, py=0, k=10;
      const stressed=m.stress>75;
      if(working){
        const f=S.ot?22:14;
        aL=-1.1+Math.sin(T*f+v.phase)*0.25; aR=-1.1+Math.cos(T*f+v.phase)*0.25;
        hy=Math.sin(ph*0.7)*0.12; hx=0.12+(stressed?0.12:0); k=18;
        py=Math.abs(Math.sin(T*f*0.5))*0.02;
        if(stressed) hz=Math.sin(T*23)*0.04;                     // เครียดจัด = ตัวสั่นนิด ๆ
      } else if(m.state==='meet'){
        aL=-0.3; aR=-0.6+Math.sin(T*4)*0.4; hx=Math.sin(T*5)*0.15; hy=0;
      } else if(m.state==='switch'){
        hy=Math.sin(T*9)*0.35; aL=-2.6; aR=-2.6; hx=0; k=14;
      } else { // ว่าง: มองซ้ายขวา + บิดขี้เกียจเป็นระยะ
        const st=Math.max(0,Math.sin(ph*0.35)-0.85)/0.15;        // 0..1 ช่วงบิดตัว
        aL=-0.15-st*2.7; aR=-0.15+Math.sin(ph)*0.05-st*2.7;
        hy=Math.sin(ph*0.6)*0.6*(1-st); hx=-0.05-st*0.25; k=6;
      }
      // ท่าพิเศษชั่วคราว: เสร็จงาน = กระโดดชูมือ / เจอบั๊ก = กุมหัว / รับงาน = เด้งรับ
      const ct=v.cheerT?nowS()-v.cheerT:9;
      if(ct<1.1){
        if(v.cheerGood){ const j=Math.sin(Math.min(1,ct/0.55)*Math.PI); py=j*0.45+Math.abs(Math.sin(ct*14))*0.04*(ct>0.55); aL=-2.9+Math.sin(ct*18)*0.2; aR=-2.9-Math.sin(ct*18)*0.2; hx=-0.25; k=22; }
        else { aL=-2.5; aR=-2.5; hx=0.3; hz=Math.sin(ct*20)*0.18; k=22; }
      }
      const ht=v.hopT?nowS()-v.hopT:9;
      if(ht<0.35) py+=Math.sin(ht/0.35*Math.PI)*0.18;
      v.armL.rotation.x=damp(v.armL.rotation.x,aL,k,dt); v.armR.rotation.x=damp(v.armR.rotation.x,aR,k,dt);
      v.headG.rotation.x=damp(v.headG.rotation.x,hx,k,dt); v.headG.rotation.y=damp(v.headG.rotation.y,hy,k,dt); v.headG.rotation.z=damp(v.headG.rotation.z,hz,15,dt);
      v.p.position.y=(ct<1.1||ht<0.35)?py:damp(v.p.position.y,py,k,dt);
      v.body.scale.set(1,1+Math.sin(T*2.2+v.phase)*0.025,1);       // หายใจ
      blink(v,T);
      const sc = m.stress<50 ? cGreen.clone().lerp(cYel,m.stress/50) : cYel.clone().lerp(cRed,(m.stress-50)/50);
      v.ring.material.color.copy(sc); v.ring.visible=!off&&!shopHide;
      v.glow.material.color.setHex(working?ROLES[m.role].hex:0x444444);
      v.scr.material.color.setHex(working?0xffffff:0x2a2f3a);
      if(working) v.scr.material.map.offset.y+=dt*(S.ot?0.12:0.06);
      v.selRing.material.opacity = S.selMember===m ? 0.6+Math.sin(T*6)*0.3 : (S.selTask&&S.selTask.type===m.role&&!off?0.35:0);
      v.selRing.material.color.setHex(S.selMember===m?0xff6b3d:0x14a38b);
      // label
      v.headG.getWorldPosition(tmpV); tmpV.y+=0.75; tmpV.project(camera);
      const x=(tmpV.x+1)/2*innerWidth, y=(1-tmpV.y)/2*innerHeight;
      m.lbl.style.left=x+'px'; m.lbl.style.top=y+'px';
      const t=m.task&&taskById(m.task);
      const pct=t?Math.min(100,t.progress/t.effort*100):0;
      const isIdle=!off&&!m.task&&m.busyUntil<=S.t;
      const key=m.name+stateIcon(m)+isIdle+(t?t.id:'')+Math.round(pct)+(off?'o':'')+(m.onboardUntil>S.t?'n':'');
      if(key!==m._lh){
        m._lh=key;
        m.lbl.innerHTML=`<b>${m.name}</b> ${off?'🏠':stateIcon(m)}${m.onboardUntil>S.t?' 🔰':''}${t?`<span class="tn">${t.name}</span><div class="lb"><i style="width:${pct}%;background:${ROLES[t.type].css}"></i></div>`:off?'<span class="tn">ลาพัก</span>':isIdle?'<span class="idletag">ว่าง! แจกงานเลย</span>':''}`;
      }
      m.lbl.classList.toggle('sel',S.selMember===m);
      m.lbl.classList.toggle('match',!!(S.selTask&&S.selTask.type===m.role&&!off));
      m.lbl.classList.toggle('idle',isIdle&&!S.selTask);
    }
    uiAcc+=dt; if(uiAcc>0.12||S._dirty){ uiAcc=0; updateUI(); }
  }
  // PM walk
  const d=tmpV.copy(pmTarget).sub(pm.p.position); d.y=0; const dist=d.length();
  if(dist>0.08){
    d.normalize();
    const sp=Math.min(4.2,0.8+dist*2.2);                          // เร่งออกตัว / ชะลอก่อนถึง
    pm.p.position.addScaledVector(d,Math.min(dist,dt*sp));
    pmFace(Math.atan2(d.x,d.z),dt);
    pm.p.position.y=Math.abs(Math.sin(T*12))*0.08;
    pm.armL.rotation.x=Math.sin(T*12)*0.6; pm.armR.rotation.x=-Math.sin(T*12)*0.3-0.4;
  } else {
    pm.p.position.y=damp(pm.p.position.y,0,12,dt); pm.armL.rotation.x=damp(pm.armL.rotation.x,0,8,dt); pm.armR.rotation.x=damp(pm.armR.rotation.x,-0.5,8,dt);
    if(S&&S.selMember){ const s=S.selMember.slot; pmFace(Math.atan2(s.x-pm.p.position.x,(s.z-1)-pm.p.position.z),dt); }
  }
  pm.body.scale.set(1,1+Math.sin(T*2)*0.02,1); blink(pm,T);
  stepConfetti(dt);
  if(S){ const hr=9+(S.t%1)*9; clockM.rotation.z=-(hr%1)*Math.PI*2; clockH.rotation.z=-(hr/12)*Math.PI*2; }
  if(camTween){ const k=1-Math.exp(-6*dt);
    camTarget.lerp(camTween.t,k); camZoom+=(camTween.z-camZoom)*k; camAz+=(camTween.az-camAz)*k; camEl+=(camTween.el-camEl)*k;
    updateProjection(); placeCamera();
    if(camTarget.distanceTo(camTween.t)<0.01&&Math.abs(camTween.z-camZoom)<0.002) camTween=null; }
  upLeds.forEach((l,i)=>l.m.material.color.setHex(Math.sin(T*l.sp+i)>-0.2?l.c1:l.c2));
  renderer.render(scene,camera);
}

/* ================= START ================= */
function renderShop(){
  $('#coinTxt').textContent='🪙 '+SAVE.coins;
  $('#themes').innerHTML=Object.entries(THEMES).map(([k,T])=>`<button class="thm ${OPT.theme===k?'on':''}" data-theme="${k}" title="${T.name}"><i style="background:linear-gradient(135deg,${T.sw} 0 50%,${T.rug[0]} 50% 75%,#${T.sofa.toString(16).padStart(6,'0')} 75%)"></i><span>${T.name}</span></button>`).join('');
  $('#themes').querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{ OPT.theme=b.dataset.theme; saveOpt(); applyTheme(OPT.theme); Snd.play('select'); renderShop(); });
  $('#shop').innerHTML=UPG.map(u=>{ const l=ul(u.id), max=l>=3, cost=UCOST[l];
    return `<div class="up"><div class="ui">${u.icon}</div><div><h4>${u.name}</h4><div class="pips">${[0,1,2].map(i=>`<i class="${i<l?'on':''}"></i>`).join('')}</div><div class="ud">${l?'ตอนนี้: '+u.desc(l):'ยังไม่มี'}${max?'':'<br>ถัดไป: '+u.desc(l+1)}</div></div>
      <button class="buy" data-up="${u.id}" ${max||SAVE.coins<cost?'disabled':''}>${max?'MAX':'🪙 '+cost}</button></div>`; }).join('');
  $('#shop').querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{ const id=b.dataset.up, l=ul(id), cost=UCOST[l]; if(l>=3||SAVE.coins<cost) return;
    SAVE.coins-=cost; SAVE.up[id]=l+1; persist(); buildUpgradeDecor(); Snd.play('hire'); renderShop(); });
}
function setShadows(on){
  renderer.shadowMap.enabled=on;
  scene.traverse(o=>{ if(o.material) [].concat(o.material).forEach(mt=>mt.needsUpdate=true); });
}
function renderSettings(root=$('#setPane'),inGame=false){
  const tg=(k,on,label,sub)=>`<div class="opt"><div><h4>${label}</h4><div class="ud">${sub}</div></div><button class="tgl ${on?'on':''}" data-opt="${k}">${on?'เปิด':'ปิด'}</button></div>`;
  const nStars=LEVELS.reduce((a,L)=>a+popc(SAVE.stars[L.id]||0),0), nClear=LEVELS.filter(L=>SAVE.best[L.id]).length;
  root.innerHTML=`<div class="shopgrid">
    <div class="opt"><div><h4>⏱️ ความเร็วเกม</h4><div class="ud">1 วันในเกม = ${daySec()} วินาที (ที่ความเร็ว 1x)</div></div>
      <div class="seg">${Object.entries(PACE).map(([k,p])=>`<button data-pace="${k}" class="${OPT.pace===k?'on':''}">${p.th}</button>`).join('')}</div></div>
    ${tg('sfx',Snd.sfx,'🔊 เสียงประกอบ','เสียงคลิก แจกงาน งานเสร็จ เหตุการณ์')}
    ${tg('mus',Snd.mus,'🎵 เพลงพื้นหลัง','เพลง lo-fi ระหว่างเล่น')}
    ${tg('idleSnd',OPT.idleSnd,'🔔 เสียงเตือนคนว่าง','ดังเมื่อมีสมาชิกทำงานเสร็จและไม่มีงานต่อ')}
    ${tg('autoPull',OPT.autoPull,'🔁 หยิบงานเองตั้งแต่เริ่มด่าน','ปิดถ้าอยากฝึกแจกงานเองทั้งหมด (สลับได้ระหว่างเล่น)')}
    ${tg('autoPause',OPT.autoPause,'⏸️ หยุดเกมเมื่อสลับหน้าต่าง','กันเวลาเดินตอนไม่ได้ดูจอ')}
    ${tg('shadows',OPT.shadows,'🌗 เงาในฉาก 3D','ปิดเพื่อให้ลื่นขึ้นบนเครื่องสเปกต่ำ / มือถือ')}
    ${inGame?'':`<div class="opt danger"><div><h4>🗑️ รีเซ็ตความคืบหน้า</h4><div class="ud">ลบเหรียญ 🪙 ${SAVE.coins}, ดาว ${nStars} ดวง, ผ่านแล้ว ${nClear} ด่าน และอัปเกรดออฟฟิศทั้งหมด — ค่าตั้งในหน้านี้ไม่ถูกลบ</div></div>
      <button class="tgl rst" id="resetBtn">รีเซ็ต</button></div>`}
  </div>`;
  const again=()=>renderSettings(root,inGame);
  root.querySelectorAll('[data-pace]').forEach(b=>b.onclick=()=>{ OPT.pace=b.dataset.pace; saveOpt(); again(); });
  root.querySelectorAll('[data-opt]').forEach(b=>b.onclick=()=>{ const k=b.dataset.opt;
    if(k==='sfx'){ Snd.init(); Snd.setSfx(!Snd.sfx); syncSoundBtns(); }
    else if(k==='mus'){ Snd.init(); Snd.setMus(!Snd.mus); syncSoundBtns(); }
    else { OPT[k]=!OPT[k]; saveOpt(); if(k==='shadows') setShadows(OPT.shadows); }
    again(); });
  if(inGame) return;
  const rb=$('#resetBtn'); let armed=false;
  rb.onclick=()=>{
    if(!armed){ armed=true; rb.textContent='กดอีกครั้งเพื่อยืนยัน'; rb.classList.add('armed'); setTimeout(()=>{ if(rb.isConnected){ armed=false; rb.textContent='รีเซ็ต'; rb.classList.remove('armed'); } },3500); return; }
    SAVE={coins:0,stars:{},up:{},best:{}}; persist();
    LEVELS.forEach(L=>{ try{ localStorage.removeItem('pmoffice3d-best-'+L.id); }catch(e){} });
    buildUpgradeDecor(); Snd.play('cut'); showStart('settings');
    hint('🗑️ รีเซ็ตความคืบหน้าแล้ว เริ่มใหม่จากศูนย์',false,2600);
  };
}
function openPause(){
  if(!S||S.ended||S.modal||!$('#start').classList.contains('hide')) return;
  const prev=S.speed; S.modal=true; setSpeed(0); Snd.play('select');
  openModal(`<h2>⚙️ ตั้งค่า</h2><p style="opacity:.7">เกมหยุดไว้ระหว่างเปิดหน้านี้</p><div id="pauseSet"></div>
   <button class="big" id="pResume">▶ เล่นต่อ</button> <button class="big alt" id="pQuit">🏠 ออกไปเมนู</button>`);
  renderSettings($('#pauseSet'),true);
  $('#pResume').onclick=()=>closeModal(prev);
  const q=$('#pQuit'); let armed=false;
  q.onclick=()=>{
    if(!armed){ armed=true; q.textContent='กดอีกครั้ง — ความคืบหน้าด่านนี้จะหายไป'; setTimeout(()=>{ if(q.isConnected){ armed=false; q.textContent='🏠 ออกไปเมนู'; } },3500); return; }
    S.ended=true; S.modal=false; S.ot=false; S.mode=null; Snd.tempo=1; setSpeed(0);
    $('#modal').classList.add('hide'); hint(''); showStart();
  };
}
$('#setBtn').onclick=openPause;
addEventListener('keydown',e=>{ if(e.code!=='Escape'||!S) return;
  if($('#pauseSet')&&!$('#modal').classList.contains('hide')) $('#pResume').click(); else openPause(); });
function setTab(t){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  $('#levels').style.display=t==='levels'?'':'none'; $('#shopPane').style.display=t==='shop'?'':'none';
  $('#setPane').style.display=t==='settings'?'':'none'; $('#guidePane').style.display=t==='guide'?'':'none'; if(t==='settings') renderSettings();
  $('#start').classList.toggle('shop',t==='shop');
  document.body.classList.toggle('shopmode',t==='shop');
  pm.p.visible=t!=='shop'; if(S) S.members.forEach(m=>{ m.v.p.visible=t!=='shop'; m.v.ring.visible=t!=='shop'; });
  if(t==='shop') renderShop();
  // กล้องเลื่อนนุ่ม ๆ ไปมุมใหม่ แทนการตัดภาพ
  camTween = t==='shop' ? {t:new THREE.Vector3(innerWidth>980?-3.2:0,0.6,0.4),z:innerWidth>980?1.15:1,az:0.78,el:0.62}
                        : {t:new THREE.Vector3(0,0.6,0.4),z:1,az:camAz,el:camEl};
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
function showStart(tab){
  const best=SAVE.best;
  $('#coinTxt').textContent='🪙 '+SAVE.coins;
  $('#levels').innerHTML=LEVELS.map((L,i)=>`<button class="lv${best[L.id]?' cleared':''}" data-li="${i}">${best[L.id]?'<div class="clearStamp">✔ ผ่านด่าน</div>':''}<div class="lvh"><span class="df" style="background:${L.dcol}">${L.diff}</span><span style="font-size:22px">${L.icon}</span></div>
   <h3>${L.name}</h3><p>${L.desc}</p><div class="spec"><span>👥 ${L.team.length} คน</span><span>📋 ${L.tasks.length} งาน</span><span>⏳ ${L.days} วัน</span><span>💰 ${fmtK(L.budget)}</span></div>
   <div class="lvh" style="margin-top:6px"><span class="stars3">${[0,1,2].map(i=>(SAVE.stars[L.id]||0)&(1<<i)?'<b>★</b>':'★').join('')}</span><span class="best" style="margin:0">${best[L.id]?'🏆 '+best[L.id]:''}</span></div>
   <div class="objs">${starLabels(L).map((l,i)=>`<div class="${(SAVE.stars[L.id]||0)&(1<<i)?'got':''}">⭐ ${l}</div>`).join('')}</div></button>`).join('');
  $('#levels').querySelectorAll('.lv').forEach(b=>b.onclick=()=>{ setTab('levels'); $('#start').classList.add('hide'); newGame(+b.dataset.li); });
  $('#start').classList.remove('hide');
  setTab(tab||'levels');
}
drawWhiteboard();
buildUpgradeDecor();
showStart();
animate();
window.__pm = { get S(){return S;}, newGame, sim:(d)=>sim(d), endGame, SAVE:()=>SAVE, buildUpgradeDecor };
