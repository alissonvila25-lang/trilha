/* Regras de pontuação, datas e efeitos, usados pelo app da paciente e pelo painel. */
(function(){
"use strict";

const CELEB_LABEL={auto:"Variar a cada conquista",confete:"Chuva de confete",baloes:"Balões",fogos:"Fogos de artifício"};
const EMPTY_CONFIG={celebration:"auto",rewards:[],activities:[]};
/* Modelo pré-cadastrado a partir da planilha "Exercício - Escala SUDS": a hierarquia de exposição e os
   reforçadores. Só "Comer uma sobremesa" tinha pontos definidos na planilha; os outros reforçadores são
   sugestões, para a psicóloga ajustar em Configurar. */
const DEFAULT_CONFIG={
  celebration:"auto",
  rewards:[
    {id:"r1",name:"Comer uma sobremesa",points:25},
    {id:"r2",name:"Ficar deitada assistindo série",points:50},
    {id:"r3",name:"Dormir a tarde toda",points:80},
    {id:"r4",name:"Ir no salão fazer uma hidratação",points:120},
    {id:"r5",name:"Comprar roupa para trabalhar",points:200}
  ],
  activities:[
    ["a01","Entrar na sala e cumprimentar",0],["a02","Sair com uma amiga",25],
    ["a03","Atender paciente mulher na UPA",25],["a04","Atender paciente homem na UPA",50],
    ["a05","Atender paciente que está com acompanhante",50],["a06","Ir para o trabalho",75],
    ["a07","Atender paciente que está sem acompanhante",75],["a08","Atender paciente homem no consultório",100],
    ["a09","Atender paciente mulher no consultório",100],["a10","Enfermaria 2 (ala maior)",75],
    ["a11","Enfermaria 3 (menos pessoas)",75],["a12","Semi-intensiva",100],
    ["a13","Enfermaria 1 (ala psiquiátrica)",75],["a14","Academia",25],
    ["a15","Pilates com amiga",25],["a16","Fazer um bolo",25],
    ["a17","Ler artigos",null],["a18","Estudar",null]
  ].map(([id,name,suds])=>({id,name,suds}))
};

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

/* Escala de Realidade da planilha "Exercício - Escala SUDS": como a exposição foi, de verdade,
   depois de feita — para comparar com o SUDS previsto e ver a ansiedade caindo com a repetição. */
const REALIDADE_SCALE=[
  {v:0,label:"Foi tranquilo",short:"Tranquilo"},
  {v:25,label:"Foi mais tranquilo do que eu imaginava",short:"Mais tranquilo"},
  {v:50,label:"Foi mais ou menos, nem tranquilo nem muito difícil",short:"Mais ou menos"},
  {v:75,label:"Foi difícil, senti bastante desconforto",short:"Difícil"},
  {v:100,label:"Foi tão difícil quanto eu imaginava, ou pior",short:"Muito difícil"}
];
function realidadeShort(v){const f=REALIDADE_SCALE.find(x=>x.v===Number(v));return f?f.short:"";}
function sudsClass(v){const n=Number(v);return n<=25?"l":n<=50?"m":"h";}
/* Para o painel: a sequência de avaliações de Realidade de cada atividade, na ordem em que
   aconteceram, só para quem já tem pelo menos um registro — é o material da "Evolução". */
function realidadeHistory(config,realidade){
  const byAct={};
  Object.keys(realidade||{}).sort().forEach(day=>{
    const rec=(realidade||{})[day]||{};
    Object.keys(rec).forEach(id=>{
      if(rec[id]==null)return;
      (byAct[id]=byAct[id]||[]).push({day,value:rec[id]});
    });
  });
  return config.activities.filter(a=>byAct[a.id]).map(a=>({id:a.id,name:a.name,suds:a.suds,points:byAct[a.id]}));
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
/* Reforçador é reusável: a cada "points" pontos ela ganha de novo (tipo ficha trocada por prêmio),
   não um troféu de uma vez só. "times" = quantas vezes já ganhou; "left" = quantos pontos faltam
   para a PRÓXIMA vez (nunca 0 — assim que uma vez fecha, a próxima já precisa de um ciclo inteiro). */
function rewardCycle(r,total){
  const times=r.points>0?Math.floor(total/r.points):0;
  const rem=r.points>0?total%r.points:0;
  const left=rem===0?r.points:r.points-rem;
  return {times,left,pct:r.points>0?(rem/r.points)*100:0};
}
/* Ainda usado só pela trilha de bolinhas do placar (visão geral): se ela já ganhou aquele
   reforçador ALGUMA vez. Não precisa saber quantas vezes — é só um marco no caminho. */
function rewardStatus(r,total){
  const left=r.points-total;
  if(left<=0)return {kind:"won",left:0};
  if(left<=nearWindow(r.points))return {kind:"near",left};
  return {kind:"far",left};
}
/* O reforçador cuja PRÓXIMA vez está mais perto agora (olhando todos, não só o mais barato). */
function nextUp(config,total){
  let best=null;
  sortedRewards(config).forEach(r=>{
    const c=rewardCycle(r,total);
    if(!best||c.left<best.left)best={r,...c};
  });
  return best;
}
/* Igual, mas só devolve algo quando está "quase lá" (dentro da janela de aviso). */
function nearest(config,total){
  const n=nextUp(config,total);
  if(!n||n.left>nearWindow(n.r.points))return null;
  return {r:n.r,s:{kind:"near",left:n.left}};
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
  const n=Number(v);
  return '<span class="suds '+sudsClass(n)+'" title="Ansiedade prevista (SUDS)">SUDS '+n+'</span>';
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
  const next=nextUp(config,total);
  return '<div class="score-top"><div><div class="eyebrow">Pontos acumulados</div><div class="total">'+total+'<small>pts</small></div></div>'+
    '<span class="today-pill">+'+tp+' hoje</span></div>'+
    '<div class="track" aria-hidden="true"><div class="track-line"></div><div class="track-fill" style="width:'+Math.min(100,total/max*100)+'%"></div>'+stops+'</div>'+
    '<div class="next">'+(next?'<span class="muted">Próximo reforçador:</span> <b>'+esc(next.r.name)+'</b> <span class="muted">· faltam '+next.left+'</span>':
      '<span class="muted">Nenhum reforçador cadastrado ainda.</span>')+'</div>';
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
    const c=rewardCycle(r,total);
    const wonBefore=c.times>0;
    const nearChip=c.left<=nearWindow(r.points)?'<span class="chip near">Quase lá · faltam '+c.left+'</span>':'<span class="chip far">Faltam '+c.left+(wonBefore?' pra próxima':'')+'</span>';
    const timesChip=wonBefore?'<span class="chip won">Já ganhou '+c.times+(c.times===1?' vez':' vezes')+'</span>':'';
    return '<div class="rw '+(wonBefore?"won":c.left<=nearWindow(r.points)?"near":"far")+'"><div class="rw-head"><span class="rw-name">'+esc(r.name)+'</span><span class="rw-pts">'+r.points+' pts</span></div>'+
      '<div class="bar"><i style="width:'+c.pct+'%"></i></div><div class="rw-chips">'+timesChip+nearChip+'</div></div>';
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

window.Trilha={CELEB_LABEL,EMPTY_CONFIG,DEFAULT_CONFIG,REALIDADE_SCALE,todayKey,shiftKey,keyDate,dayLabel,normConfig,dayPoints,rawPoints,totalPoints,
  nearWindow,sortedRewards,rewardStatus,rewardCycle,nextUp,nearest,pickStyle,esc,sudsChip,sudsClass,realidadeShort,realidadeHistory,
  scoreHTML,nudgeHTML,rewardsHTML,weekHTML,toast,celebrate};
})();
