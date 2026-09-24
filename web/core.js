/* Regras de pontuação, datas e efeitos, usados pelo app da paciente e pelo painel. */
(function(){
"use strict";

const CELEB_LABEL={auto:"Variar a cada conquista",confete:"Chuva de confete",baloes:"Balões",fogos:"Fogos de artifício"};
const EMPTY_CONFIG={celebration:"auto",rewards:[],activities:[]};

/* ---------- datas (fuso local do aparelho) ---------- */
function todayKey(d){d=d||new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function shiftKey(k,n){const [y,m,d]=k.split("-").map(Number);return todayKey(new Date(y,m-1,d+n));}
function keyDate(k){const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d);}
function dayLabel(k){
  const t=todayKey();
  if(k===t)return "Hoje";
  if(k===shiftKey(t,-1))return "Ontem";
  return keyDate(k).toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"short"});
}

/* ---------- pontos ---------- */
function normConfig(c){
  c=c||{};
  return {
    celebration:c.celebration||"auto",
    rewards:Array.isArray(c.rewards)?c.rewards:[],
    activities:Array.isArray(c.activities)?c.activities:[]
  };
}
function dayPoints(config,days,k){
  const ids=new Set(config.activities.map(a=>a.id));
  return (days[k]||[]).filter(id=>ids.has(id)).length;
}
function rawPoints(config,days){let t=0;for(const k in days)t+=dayPoints(config,days,k);return t;}
function totalPoints(config,days,offset){return Math.max(0,rawPoints(config,days)+(Number(offset)||0));}
/* Aviso "quase lá": faltando 5 pontos (reforçador < 100) ou 10 (>= 100). */
function nearWindow(p){return p>=100?10:5;}
function sortedRewards(config){return config.rewards.filter(r=>r.points>0).sort((a,b)=>a.points-b.points);}
function rewardStatus(r,total){
  const left=r.points-total;
  if(left<=0)return {kind:"won",left:0};
  if(left<=nearWindow(r.points))return {kind:"near",left};
  return {kind:"far",left};
}
function nearest(config,total){
  return sortedRewards(config).map(r=>({r,s:rewardStatus(r,total)})).find(x=>x.s.kind==="near")||null;
}
function pickStyle(config,r){
  const c=config.celebration||"auto";
  if(c!=="auto")return c;
  const i=sortedRewards(config).findIndex(x=>x.id===r.id);
  return ["confete","baloes","fogos"][Math.max(0,i)%3];
}

/* ---------- renderização compartilhada ---------- */
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function sudsChip(v){
  if(v==null||v==="")return "";
  const n=Number(v);const c=n<=25?"l":n<=50?"m":"h";
  return '<span class="suds '+c+'" title="Ansiedade prevista (SUDS)">SUDS '+n+'</span>';
}
function scoreHTML(config,days,offset){
  const total=totalPoints(config,days,offset),rw=sortedRewards(config);
  const max=Math.max(rw.length?rw[rw.length-1].points:1,total,1);
  const tp=dayPoints(config,days,todayKey());
  let stops="",lastX=-99;
  rw.forEach(r=>{
    const st=rewardStatus(r,total),pct=r.points/max*100;
    stops+='<span class="stop '+(st.kind==="won"?"won":st.kind==="near"?"near":"")+'" style="left:'+pct+'%" title="'+esc(r.name)+'"></span>';
    if(pct-lastX>9){stops+='<span class="stop-label" style="left:'+pct+'%">'+r.points+'</span>';lastX=pct;}
  });
  const next=rw.find(r=>r.points>total);
  return '<div class="score-top"><div><div class="eyebrow">Pontos acumulados</div><div class="total">'+total+'<small>pts</small></div></div>'+
    '<span class="today-pill">+'+tp+' hoje</span></div>'+
    '<div class="track" aria-hidden="true"><div class="track-line"></div><div class="track-fill" style="width:'+Math.min(100,total/max*100)+'%"></div>'+stops+'</div>'+
    '<div class="next">'+(next?'<span class="muted">Próximo reforçador:</span> <b>'+esc(next.name)+'</b> <span class="muted">· faltam '+(next.points-total)+'</span>':
      (rw.length?'<b>Todos os reforçadores foram conquistados!</b>':'<span class="muted">Nenhum reforçador cadastrado ainda.</span>'))+'</div>';
}
function nudgeHTML(config,total){
  const n=nearest(config,total);
  if(!n)return "";
  return '<div class="nudge" role="status"><div class="nudge-num">'+n.s.left+'</div><p><b>Falta pouco para você conseguir: '+esc(n.r.name)+'.</b><br>Só mais um pouco! '+
    (n.s.left===1?"Falta 1 ponto.":"Faltam "+n.s.left+" pontos.")+'</p></div>';
}
function rewardsHTML(config,total){
  const rw=sortedRewards(config);
  if(!rw.length)return '<p class="muted">Nenhum reforçador cadastrado ainda.</p>';
  return '<div class="list">'+rw.map(r=>{
    const s=rewardStatus(r,total),pct=Math.min(100,total/r.points*100);
    const chip=s.kind==="won"?'<span class="chip won">Conquistado</span>':s.kind==="near"?'<span class="chip near">Quase lá · faltam '+s.left+'</span>':'<span class="chip far">Faltam '+s.left+'</span>';
    return '<div class="rw '+s.kind+'"><div class="rw-head"><span class="rw-name">'+esc(r.name)+'</span><span class="rw-pts">'+r.points+' pts</span></div>'+
      '<div class="bar"><i style="width:'+pct+'%"></i></div><div>'+chip+'</div></div>';
  }).join("")+'</div>';
}
function weekHTML(config,days,n){
  const t=todayKey(),vals=[];
  for(let i=n-1;i>=0;i--){const k=shiftKey(t,-i);vals.push([k,dayPoints(config,days,k)]);}
  const vmax=Math.max(1,...vals.map(v=>v[1]));
  return '<div class="week">'+vals.map(([k,v])=>{
    const wd=n>7?String(keyDate(k).getDate()):keyDate(k).toLocaleDateString("pt-BR",{weekday:"narrow"}).toUpperCase();
    return '<div class="wk" title="'+esc(dayLabel(k))+': '+v+' pontos"><span>'+v+'</span><div class="wk-bar'+(v?"":" zero")+'" style="height:'+(v?Math.max(8,v/vmax*44):3)+'px"></div><span>'+wd+'</span></div>';
  }).join("")+'</div>';
}

/* ---------- avisos na tela ---------- */
function toast(msg){
  let box=document.getElementById("toasts");
  if(!box){box=document.createElement("div");box.id="toasts";box.className="toasts";box.setAttribute("aria-live","polite");document.body.appendChild(box);}
  box.replaceChildren(); // só o aviso mais recente fica na tela
  const t=document.createElement("div");t.className="toast";t.textContent=msg;box.appendChild(t);
  setTimeout(()=>t.remove(),4200);
}

/* ---------- efeitos de comemoração ---------- */
const COLORS=["#F2B138","#EF6F53","#3CC2AE","#6C8CF5","#E86BB0","#8DD35F"];
function celebrate(kind){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  let cv=document.getElementById("fx");
  if(!cv){cv=document.createElement("canvas");cv.id="fx";document.body.appendChild(cv);}
  cv.hidden=false;
  const ctx=cv.getContext("2d"),dpr=Math.min(2,window.devicePixelRatio||1);
  const W=innerWidth,H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  const rnd=(a,b)=>a+Math.random()*(b-a),col=()=>COLORS[Math.floor(Math.random()*COLORS.length)];
  let parts=[];const rockets=[];const start=performance.now();
  if(kind==="confete"){
    for(let i=0;i<180;i++)parts.push({x:rnd(0,W),y:rnd(-H,-10),vx:rnd(-1,1),vy:rnd(2,5),r:rnd(0,6),vr:rnd(-.2,.2),w:rnd(6,10),h:rnd(10,16),c:col(),ph:rnd(0,6)});
  }else if(kind==="baloes"){
    for(let i=0;i<22;i++)parts.push({x:rnd(20,W-20),y:H+rnd(40,H*.8),vy:rnd(1.6,3.2),rad:rnd(20,32),c:col(),ph:rnd(0,6)});
  }else{
    for(let i=0;i<7;i++)rockets.push({x:rnd(W*.15,W*.85),y:H,ty:rnd(H*.15,H*.45),t0:i*380,c:col(),boom:false});
  }
  function frame(now){
    const el=now-start;ctx.clearRect(0,0,W,H);
    if(kind==="confete"){
      parts.forEach(p=>{p.ph+=.05;p.x+=p.vx+Math.sin(p.ph)*.8;p.y+=p.vy;p.r+=p.vr;
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h*Math.abs(Math.cos(p.ph)));ctx.restore();});
      parts=parts.filter(p=>p.y<H+30);
    }else if(kind==="baloes"){
      parts.forEach(p=>{p.ph+=.03;p.y-=p.vy;const x=p.x+Math.sin(p.ph)*14;
        ctx.strokeStyle="rgba(120,120,120,.7)";ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,p.y+p.rad*1.2);
        ctx.quadraticCurveTo(x+Math.sin(p.ph*2)*10,p.y+p.rad*2,x,p.y+p.rad*3);ctx.stroke();
        ctx.fillStyle=p.c;ctx.beginPath();ctx.ellipse(x,p.y,p.rad*.85,p.rad*1.05,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.moveTo(x-5,p.y+p.rad*1.2);ctx.lineTo(x+5,p.y+p.rad*1.2);ctx.lineTo(x,p.y+p.rad*1.02);ctx.fill();
        ctx.fillStyle="rgba(255,255,255,.45)";ctx.beginPath();ctx.ellipse(x-p.rad*.3,p.y-p.rad*.4,p.rad*.15,p.rad*.28,-.5,0,Math.PI*2);ctx.fill();});
      parts=parts.filter(p=>p.y>-p.rad*4);
    }else{
      rockets.forEach(r=>{
        if(el<r.t0||r.boom)return;
        r.y-=9;ctx.fillStyle=r.c;ctx.beginPath();ctx.arc(r.x,r.y,3,0,Math.PI*2);ctx.fill();
        if(r.y<=r.ty){r.boom=true;for(let i=0;i<70;i++){const a=Math.PI*2*i/70,s=rnd(1.5,5);parts.push({x:r.x,y:r.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,c:Math.random()<.3?col():r.c});}}
      });
      parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.06;p.vx*=.985;p.life-=.012;
        ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,2.4,0,Math.PI*2);ctx.fill();});
      ctx.globalAlpha=1;parts=parts.filter(p=>p.life>0);
    }
    const busy=parts.length||rockets.some(r=>!r.boom);
    if(busy&&el<9000)requestAnimationFrame(frame);else{ctx.clearRect(0,0,W,H);cv.hidden=true;}
  }
  requestAnimationFrame(frame);
}

window.Trilha={CELEB_LABEL,EMPTY_CONFIG,todayKey,shiftKey,keyDate,dayLabel,normConfig,dayPoints,rawPoints,totalPoints,
  nearWindow,sortedRewards,rewardStatus,nearest,pickStyle,esc,sudsChip,scoreHTML,nudgeHTML,rewardsHTML,weekHTML,toast,celebrate};
})();
