// เสียงทั้งหมดสังเคราะห์ด้วย Web Audio API (ไม่มีไฟล์เสียง)
import { pick } from './utils.js';

/* ================= AUDIO (Web Audio, synthesized) ================= */
export const Snd = (()=>{
  let ctx=null, master, sfxG, musG, noiseBuf=null, musTimer=null;
  let sfxOn=true, musOn=true;
  try{ sfxOn=localStorage.getItem('pmoffice3d-sfx')!=='0'; musOn=localStorage.getItem('pmoffice3d-mus')!=='0'; }catch(e){}
  function init(){
    if(ctx){ if(ctx.state==='suspended') ctx.resume().catch(()=>{}); return; }
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    try{ ctx=new AC(); }catch(e){ return; }
    master=ctx.createGain(); master.gain.value=0.9;
    const comp=ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    sfxG=ctx.createGain(); sfxG.gain.value=sfxOn?0.55:0; sfxG.connect(master);
    musG=ctx.createGain(); musG.gain.value=musOn?0.22:0; musG.connect(master);
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate*0.5,ctx.sampleRate);
    const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    startMusic();
  }
  const ok=()=>ctx&&ctx.state==='running';
  function tone(f,t0,dur,type,vol,dest,slide){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(f,t0);
    if(slide) o.frequency.exponentialRampToValueAtTime(slide,t0+dur);
    g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(vol||0.2,t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g); g.connect(dest||sfxG); o.start(t0); o.stop(t0+dur+0.05);
  }
  function noise(t0,dur,vol,freq,q,dest){
    const s=ctx.createBufferSource(); s.buffer=noiseBuf;
    const fl=ctx.createBiquadFilter(); fl.type='bandpass'; fl.frequency.value=freq||3000; fl.Q.value=q||1;
    const g=ctx.createGain(); g.gain.setValueAtTime(vol,t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    s.connect(fl); fl.connect(g); g.connect(dest||sfxG); s.start(t0); s.stop(t0+dur+0.02);
  }
  const N=n=>440*Math.pow(2,(n-69)/12);
  const fx={
    click(){ tone(900,ctx.currentTime,0.05,'triangle',0.08); },
    select(){ const t=ctx.currentTime; tone(620,t,0.07,'triangle',0.16); tone(930,t+0.05,0.09,'triangle',0.13); },
    error(){ const t=ctx.currentTime; tone(180,t,0.12,'square',0.08); tone(150,t+0.1,0.16,'square',0.08); },
    assign(){ const t=ctx.currentTime; tone(380,t,0.14,'sine',0.3,null,880); tone(1320,t+0.09,0.12,'triangle',0.1); },
    done(){ const t=ctx.currentTime; [72,76,79,84].forEach((n,i)=>tone(N(n),t+i*0.075,0.28,'triangle',0.2)); tone(N(96),t+0.3,0.4,'sine',0.06); },
    bug(){ const t=ctx.currentTime; tone(320,t,0.28,'sawtooth',0.1,null,110); tone(240,t+0.14,0.3,'square',0.07,null,80); noise(t,0.2,0.08,800,2); },
    burnout(){ const t=ctx.currentTime; [67,65,63,58].forEach((n,i)=>tone(N(n),t+i*0.2,0.38,'sine',0.2)); },
    event(){ const t=ctx.currentTime; [[88,0],[83,0.16],[88,0.32]].forEach(([n,d])=>{ tone(N(n),t+d,0.9,'sine',0.16); tone(N(n+12),t+d,0.5,'sine',0.04); }); },
    coin(){ const t=ctx.currentTime; tone(N(83),t,0.09,'square',0.09); tone(N(88),t+0.08,0.35,'square',0.09); },
    talk(){ const t=ctx.currentTime; for(let i=0;i<5;i++) tone(500+Math.random()*400,t+i*0.06,0.06,'sine',0.12); },
    ot(){ const t=ctx.currentTime; noise(t,0.45,0.18,1200,0.7); tone(200,t,0.4,'sawtooth',0.06,null,700); },
    otOff(){ const t=ctx.currentTime; tone(N(76),t,0.3,'sine',0.14); tone(N(71),t+0.15,0.4,'sine',0.14); },
    cut(){ const t=ctx.currentTime; noise(t,0.05,0.25,6000,3); noise(t+0.09,0.05,0.25,5000,3); },
    unlock(){ const t=ctx.currentTime; tone(N(79),t,0.1,'triangle',0.12); tone(N(86),t+0.07,0.18,'triangle',0.12); },
    idle(){ const t=ctx.currentTime; tone(N(81),t,0.12,'triangle',0.16); tone(N(76),t+0.12,0.18,'triangle',0.16); },
    day(){ const t=ctx.currentTime; tone(N(96),t,0.15,'sine',0.05); },
    type(){ noise(ctx.currentTime,0.025,0.05,2500+Math.random()*2500,4); },
    hire(){ const t=ctx.currentTime; [67,71,74,79].forEach((n,i)=>tone(N(n),t+i*0.06,0.2,'square',0.06)); },
    win(){ const t=ctx.currentTime; [[60,64,67],[65,69,72],[67,71,74],[72,76,79,84]].forEach((ch,i)=>ch.forEach(n=>tone(N(n),t+i*0.22,i===3?1.2:0.3,'triangle',0.12))); },
    lose(){ const t=ctx.currentTime; [[67,0],[63,0.3],[60,0.6]].forEach(([n,d])=>tone(N(n),t+d,0.5,'triangle',0.15)); tone(N(48),t+0.6,1,'sine',0.15); }
  };
  function play(name){ if(!ok()||!sfxOn) return; try{ fx[name]&&fx[name](); }catch(e){} }
  // ---- lo-fi background loop ----
  const CH=[[53,57,60,64],[52,55,59,62],[50,53,57,60],[48,52,55,59]]; // Fmaj7 Em7 Dm7 Cmaj7
  const PENTA=[72,74,76,79,81,84];
  let step=0, nextT=0, tempo=1;
  function startMusic(){
    nextT=ctx.currentTime+0.1;
    musTimer=setInterval(()=>{
      if(!ok()) return;
      const spb=60/80/2/tempo; // 8th notes @80bpm
      while(nextT<ctx.currentTime+0.25){
        const bar=Math.floor(step/8)%4, s8=step%8, ch=CH[bar];
        if(musOn){
          if(s8===0) ch.forEach(n=>{ tone(N(n),nextT,spb*7.5,'triangle',0.05,musG); tone(N(n)*1.004,nextT,spb*7.5,'sine',0.04,musG); });
          if(s8===0||s8===5) tone(N(ch[0]-12),nextT,spb*2.5,'sine',0.22,musG);
          if(s8===0||s8===3||s8===6){ const k=ctx.createOscillator(),g=ctx.createGain(); k.frequency.setValueAtTime(110,nextT); k.frequency.exponentialRampToValueAtTime(40,nextT+0.12); g.gain.setValueAtTime(0.35,nextT); g.gain.exponentialRampToValueAtTime(0.0001,nextT+0.16); k.connect(g); g.connect(musG); k.start(nextT); k.stop(nextT+0.2); }
          if(s8===4) noise(nextT,0.12,0.12,1800,0.8,musG);
          noise(nextT,0.03,s8%2?0.03:0.05,8000,1,musG);
          if(Math.random()<0.28) tone(N(pick(PENTA)),nextT,spb*1.8,'sine',0.07,musG);
        }
        nextT+=spb; step++;
      }
    },90);
  }
  function setSfx(v){ sfxOn=v; try{localStorage.setItem('pmoffice3d-sfx',v?'1':'0');}catch(e){} if(sfxG) sfxG.gain.value=v?0.55:0; }
  function setMus(v){ musOn=v; try{localStorage.setItem('pmoffice3d-mus',v?'1':'0');}catch(e){} if(musG) musG.gain.setTargetAtTime(v?0.22:0,ctx.currentTime,0.1); }
  return {init,play,setSfx,setMus,get sfx(){return sfxOn;},get mus(){return musOn;},set tempo(v){tempo=v;}};
})();
