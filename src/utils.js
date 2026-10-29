// Helper functions ใช้ร่วมกันทั้งเกม
const $ = s => document.querySelector(s);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rnd = (a,b)=>a+Math.random()*(b-a);
const rndInt = (a,b)=>Math.floor(rnd(a,b+1));
const pick = a=>a[Math.floor(Math.random()*a.length)];
const fmt = n => (n<0?'-':'')+'฿'+Math.abs(Math.round(n)).toLocaleString('en-US');
const fmtK = n => (n<0?'-':'')+'฿'+(Math.abs(n)/1000).toFixed(Math.abs(n)>=100000?0:1)+'k';

export { $, clamp, rnd, rndInt, pick, fmt, fmtK };
