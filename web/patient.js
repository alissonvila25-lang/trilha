/* App da paciente: sem login. Acessa o banco só pelas funções patient_* com o código do link. */
(function(){
"use strict";
const T=window.Trilha,CFG=window.TRILHA_CONFIG;
const K_TOKEN="trilha.token",K_CACHE="trilha.cache",K_PENDING="trilha.pending",K_PENDING_CEL="trilha.pendingCelebrated",K_CARTAS="trilha.cartas";

const S={
  token:null,name:"",config:T.normConfig(T.EMPTY_CONFIG),days:{},realidade:{},offset:0,celebrated:{},
  loaded:false,tab:"hoje",viewDate:T.todayKey(),pending:{},online:true
};

/* ---------- armazenamento local ---------- */
function lsGet(k,fb){try{const v=localStorage.getItem(k);return v==null?fb:JSON.parse(v);}catch(e){return fb;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function cacheState(){lsSet(K_CACHE,{token:S.token,name:S.name,config:S.config,days:S.days,realidade:S.realidade,offset:S.offset,celebrated:S.celebrated});}

/* ---------- Supabase (REST/RPC) ---------- */
async function rpc(fn,args){
  const headers={"apikey":CFG.SUPABASE_ANON_KEY,"Content-Type":"application/json"};
  // a chave "anon" antiga é um JWT e também vai no Authorization; a nova "publishable" (sb_publishable_…) não
  if(CFG.SUPABASE_ANON_KEY.startsWith("eyJ"))headers.Authorization="Bearer "+CFG.SUPABASE_ANON_KEY;
  const r=await fetch(CFG.SUPABASE_URL.replace(/\/+$/,"")+"/rest/v1/rpc/"+fn,{
    method:"POST",
    headers,
    body:JSON.stringify(args)
  });
  if(!r.ok)throw new Error("HTTP "+r.status);
  return r.json();
}

async function load(){
  const st=await rpc("patient_state",{p_token:S.token});
  if(!st)return false;
  S.name=st.name||"";S.config=T.normConfig(st.config);S.offset=st.offset||0;T.aplicarTema(S.config.tema);
  // se um salvamento de comemoração anterior não chegou a confirmar (app fechado rápido demais,
  // sem internet etc.), o que temos guardado localmente é mais confiável que o servidor -- senão
  // a mesma comemoração reaparece toda vez que o app recarrega, mesmo já tendo sido vista.
  const pendingCel=lsGet(K_PENDING_CEL,null);
  S.celebrated=pendingCel!==null?pendingCel:(st.celebrated||{});
  S.days=Object.assign({},st.days||{},pendingDays());
  S.realidade=Object.assign({},st.realidade||{},pendingRealidade());
  S.loaded=true;cacheState();
  trySaveCelebrated();
  return true;
}
function pendingDays(){const out={};for(const k in S.pending)out[k]=S.pending[k].done;return out;}
function pendingRealidade(){const out={};for(const k in S.pending)out[k]=S.pending[k].realidade;return out;}

let flushing=false;
async function flush(){
  if(flushing)return;flushing=true;
  try{
    for(const k of Object.keys(S.pending)){
      const entry=S.pending[k];
      const ok=await rpc("patient_set_day",{p_token:S.token,p_day:k,p_done:entry.done,p_realidade:entry.realidade});
      if(ok===false)throw new Error("token");
      if(S.pending[k]===entry)delete S.pending[k];
      lsSet(K_PENDING,S.pending);
    }
    S.online=true;
  }catch(e){S.online=false;}
  flushing=false;renderSync();
  if(Object.keys(S.pending).length&&S.online)flush(); // marcou mais algo durante o envio
}

/* ---------- notificações ---------- */
let swReg=null;
async function notify(title,body,inApp){
  if(inApp!==false)T.toast(body);
  try{
    if(!("Notification" in window)||Notification.permission!=="granted")return;
    if(document.visibilityState==="visible"&&!isStandalone())return; // no navegador aberto, o aviso na tela basta
    const reg=swReg||await navigator.serviceWorker.ready;
    reg.showNotification(title,{body,icon:"icons/icon-192.png",badge:"icons/icon-192.png",tag:"trilha-"+title,renotify:true});
  }catch(e){}
}
function isStandalone(){return matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;}

/* ---------- conquistas ---------- */
let queue=[],showing=false;
/* Chamada depois de qualquer marcação ou desmarcação. Reforçador é reusável: a cada "points"
   pontos ela ganha de novo (não é um troféu de uma vez só). "celebrated[id]" guarda quantas vezes
   já foi comemorado; se o total real (T.rewardCycle) passou disso, comemora a diferença — inclusive
   mais de uma vez de uma vez só, se ela pulou dois patamares juntos. Se uma correção baixar o total,
   o número também baixa (sem comemorar negativo), pra poder comemorar nesse valor de novo depois. */
function checkRewards(){
  if(!S.loaded)return;
  const total=T.totalPoints(S.config,S.days,S.offset);
  const celebrated={...S.celebrated};
  const fresh=[]; // só o que ESTA chamada descobriu de novo, pra não reavisar o que já estava na fila
  let changed=false;
  T.sortedRewards(S.config).forEach(r=>{
    const times=T.rewardCycle(r,total).times;
    const had=celebrated[r.id]||0;
    if(times>had){for(let i=had;i<times;i++){queue.push(r);fresh.push(r);}}
    if(times!==had){celebrated[r.id]=times;changed=true;}
  });
  if(!changed)return;
  S.celebrated=celebrated;cacheState();
  saveCelebrated(celebrated);
  fresh.forEach(r=>notify("Reforçador conquistado!","Você conquistou: "+r.name+". Parabéns!",false)); // na tela, o cartão de parabéns já avisa
  runQueue();
}
function saveCelebrated(celebrated){lsSet(K_PENDING_CEL,celebrated);trySaveCelebrated();}
let celebratedSaving=false;
async function trySaveCelebrated(){
  if(celebratedSaving)return;
  const pending=lsGet(K_PENDING_CEL,null);
  if(pending===null)return;
  celebratedSaving=true;
  const snapshot=JSON.stringify(pending);
  try{
    await rpc("patient_set_celebrated",{p_token:S.token,p_celebrated:pending});
    if(JSON.stringify(lsGet(K_PENDING_CEL,null))===snapshot)lsSet(K_PENDING_CEL,null);
  }catch(e){}
  celebratedSaving=false;
}
function runQueue(){
  if(showing||!queue.length)return;
  showing=true;const r=queue.shift();
  const box=document.getElementById("toasts");if(box)box.replaceChildren(); // o "falta pouco" já não vale
  const m=document.getElementById("modal");
  m.innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><div class="modal-card">'+
    '<span class="medal">Reforçador conquistado</span><h2 id="mt"></h2>'+
    '<p class="muted" style="margin:0">Você chegou a '+r.points+' pontos. Aproveite, você mereceu!</p>'+
    '<button class="btn" id="modal-ok" style="margin-top:8px">Oba!</button></div></div>';
  m.querySelector("#mt").textContent=r.name;
  const ok=m.querySelector("#modal-ok");ok.focus();
  ok.onclick=()=>{m.innerHTML="";showing=false;runQueue();};
  T.celebrate(T.pickStyle(S.config,r));
}
function nudgeAfterGain(){
  const n=T.nearest(S.config,T.totalPoints(S.config,S.days,S.offset));
  if(!n)return;
  const left=n.s.left===1?"Falta só 1 ponto":"Faltam só "+n.s.left+" pontos";
  notify("Falta pouco!",left+" para: "+n.r.name+". Só mais um pouco!");
}

/* ---------- avaliação de Realidade (como foi, na prática) ----------
   Chamada ao marcar uma atividade como feita. Se abrir, `after` só roda quando a pessoa responder
   ou pular — assim uma comemoração de reforçador não some por trás desta pergunta. Devolve false
   quando não deu para abrir (ex.: já tem outra coisa na tela), para o chamador seguir em frente. */
function openRealidadeSheet(day,id,after){
  const act=S.config.activities.find(a=>a.id===id);
  if(!act||!(S.days[day]||[]).includes(id))return false; // só faz sentido se ainda estiver marcada
  if(showing)return false; // não atrapalha uma comemoração já em andamento
  showing=true;
  const done=()=>{showing=false;if(after)after();};
  const cur=(S.realidade[day]||{})[id];
  const m=document.getElementById("modal");
  m.innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-labelledby="rt"><div class="modal-card" style="text-align:left">'+
    '<span class="medal">Como foi, na prática?</span><h2 id="rt" style="font-size:20px">'+T.esc(act.name)+'</h2>'+
    '<div class="real-opts">'+T.REALIDADE_SCALE.map(o=>'<button class="real-opt'+(cur===o.v?" sel":"")+'" data-real-pick="'+o.v+'"><b>'+o.v+'</b><span>'+T.esc(o.label)+'</span></button>').join("")+'</div>'+
    '<button class="btn ghost" id="real-skip" style="margin-top:4px">Agora não</button></div></div>';
  m.querySelector("#real-skip").onclick=()=>{m.innerHTML="";done();};
  m.querySelectorAll("[data-real-pick]").forEach(btn=>btn.onclick=()=>{
    const v=Number(btn.dataset.realPick);
    const real={...(S.realidade[day]||{}),[id]:v};
    S.realidade={...S.realidade,[day]:real};
    const entry=S.pending[day]||{done:S.days[day]||[],realidade:S.realidade[day]||{}};
    S.pending[day]={done:entry.done,realidade:real};lsSet(K_PENDING,S.pending);cacheState();
    m.innerHTML="";render();flush();done();
  });
  return true;
}

/* ---------- instalação ---------- */
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;renderInstall();});
function renderInstall(){
  const box=document.getElementById("install");
  const parts=[];
  if(!isStandalone()){
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
    if(deferredPrompt)parts.push('<div class="btns"><span style="flex:1">Instale o app na tela inicial para abrir mais rápido.</span><button class="btn" data-install>Instalar</button></div>');
    else if(ios)parts.push('<span>Para instalar: toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. No iPhone, as notificações só funcionam com o app instalado.</span>');
  }
  if("Notification" in window&&Notification.permission==="default"&&(isStandalone()||!/iphone|ipad|ipod/i.test(navigator.userAgent)))
    parts.push('<div class="btns"><span style="flex:1">Quer receber um aviso quando faltar pouco para um reforçador?</span><button class="btn ghost" data-notif>Ativar avisos</button></div>');
  box.innerHTML=parts.length?'<div class="banner" style="display:flex;flex-direction:column;gap:8px">'+parts.join("")+'</div>':"";
}

/* ---------- telas ---------- */
const CHECK='<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="var(--accent-ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function renderSync(){
  const n=Object.keys(S.pending).length;
  document.getElementById("sync").textContent=n?(S.online?"Salvando…":"Sem internet. Suas marcações ficam guardadas e são enviadas quando a conexão voltar."):"";
}
/* ---------- Cartas (a psicóloga libera no painel): uma por vez, toque para virar, setas para passar ---------- */
// fase, carta em que parou e ordem embaralhada ficam neste aparelho
let FC=null;
function fc(){if(!FC){const s=lsGet(K_CARTAS,null)||{};FC={fase:s.fase||"",i:s.i||{},ordem:s.ordem||{},virada:false};}return FC;}
function fcSave(){lsSet(K_CARTAS,{fase:FC.fase,i:FC.i,ordem:FC.ordem});}
function fcFase(){const c=S.config.cartas;return c.fases.find(x=>x.id===fc().fase)||c.fases[0];}
function fcLista(f){const o=fc().ordem[f.id]||[],pos=id=>{const k=o.indexOf(id);return k<0?1e6:k;};return [...f.cartas].sort((a,b)=>pos(a.id)-pos(b.id));}
function cartasHTML(){
  const c=S.config.cartas,f=fcFase(),n=c.fases.indexOf(f),lista=fcLista(f),max=lista.length-1,esc=T.esc;
  const i=Math.min(Math.max(0,fc().i[f.id]||0),max),k=lista[i],vir=FC.virada;FC.i[f.id]=i;
  return (c.fases.length>1?'<div class="fc-fases">'+c.fases.map(x=>'<button class="fc-fase" data-fc-fase="'+esc(x.id)+'" aria-pressed="'+(x===f)+'">'+esc(x.nome)+'<small>'+esc(x.quem)+'</small></button>').join("")+'</div>':'')+
    (f.sobre?'<p class="hint fc-sobre">'+esc(f.sobre)+'</p>':'')+
    '<div class="fc" data-fase="'+esc(f.id)+'">'+
      '<button class="fc-card'+(vir?" virada":"")+'" data-fc-virar aria-pressed="'+vir+'" aria-describedby="fc-pos"><span class="fc-in">'+
        '<span class="fc-verso" aria-hidden="'+vir+'"><span class="fc-logo">'+esc(c.nome)+'</span><span class="fc-fase-n">Fase '+(n+1)+'</span><span>'+esc(f.nome)+'</span><span class="fc-toque">Toque para virar</span></span>'+
        '<span class="fc-frente" aria-hidden="'+!vir+'"><b class="fc-tit">'+esc(k.titulo)+'</b><span class="fc-txt">'+esc(k.texto)+'</span>'+(k.dica?'<i class="fc-dica">'+esc(k.dica)+'</i>':'')+'</span>'+
      '</span></button>'+
      '<div class="fc-nav"><button class="navbtn" data-fc-ir="-1" aria-label="Carta anterior"'+(i?'':' disabled')+'>‹</button>'+
        '<span id="fc-pos" class="fc-pos">Carta '+(i+1)+' de '+lista.length+'</span>'+
        '<button class="navbtn" data-fc-ir="1" aria-label="Próxima carta"'+(i<max?'':' disabled')+'>›</button></div>'+
    '</div>'+
    '<div class="btns" style="justify-content:center"><button class="btn ghost" data-fc-embaralhar>Embaralhar</button></div>'+
    (c.regras.length?'<details class="panel fc-regras"><summary>Como usar</summary><ol>'+c.regras.map(r=>'<li>'+esc(r)+'</li>').join("")+'</ol></details>':'');
}
function fcIr(dir){
  const f=fcFase(),i=(fc().i[f.id]||0)+dir;
  if(i<0||i>=f.cartas.length)return;
  FC.i[f.id]=i;FC.virada=false;fcSave();render();
  const b=document.querySelector('[data-fc-ir="'+dir+'"]');(b&&!b.disabled?b:document.querySelector(".fc-card")).focus();
}
function render(){
  const total=T.totalPoints(S.config,S.days,S.offset);
  // aba Cartas só quando a psicóloga liberou; nela, só as cartas (sem o placar)
  const tc=document.querySelector('.tab[data-tab="cartas"]');if(tc)tc.hidden=!S.config.cartas;
  if(S.tab==="cartas"&&!S.config.cartas)S.tab="hoje";
  ["score","nudge"].forEach(id=>{document.getElementById(id).style.display=S.tab==="cartas"?"none":"";});
  document.getElementById("hello").textContent=S.name?"Olá, "+S.name:"Programa de reforço";
  document.getElementById("score").innerHTML=T.scoreHTML(S.config,S.days,S.offset);
  document.getElementById("nudge").innerHTML=T.nudgeHTML(S.config,total);
  document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===S.tab)));
  const v=document.getElementById("view");
  if(S.tab==="cartas"){
    v.innerHTML=cartasHTML();
  }else if(S.tab==="premios"){
    v.innerHTML=T.rewardsHTML(S.config,total)+'<p class="hint">Você recebe um aviso quando faltar pouco: 5 pontos para reforçadores de até 99 pontos e 10 pontos para os de 100 ou mais.</p>';
  }else{
    const k=S.viewDate,t=T.todayKey(),done=new Set(S.days[k]||[]),acts=S.config.activities;
    const n=acts.filter(a=>done.has(a.id)).length;
    v.innerHTML='<div class="daybar"><button class="navbtn" data-day="-1" aria-label="Dia anterior" '+(k<=T.shiftKey(t,-6)?"disabled":"")+'>‹</button>'+
      '<div style="text-align:center"><h2>'+T.esc(T.dayLabel(k))+'</h2><div class="muted" style="font-size:14px">'+n+' de '+acts.length+' feitas · +'+n+' pts</div></div>'+
      '<button class="navbtn" data-day="1" aria-label="Próximo dia" '+(k>=t?"disabled":"")+'>›</button></div>'+
      '<p class="hint" style="text-align:center">Cada atividade feita vale 1 ponto. Toque para marcar.</p>'+
      (acts.length?'<div class="list">'+acts.map(a=>{
        const isDone=done.has(a.id),rv=(S.realidade[k]||{})[a.id];
        const chip=isDone?'<button class="real-chip'+(rv!=null?" set "+T.sudsClass(rv):"")+'" data-real="'+T.esc(a.id)+'">'+
          (rv!=null?T.esc(T.realidadeShort(rv)):"Como foi?")+'</button>':"";
        return '<div class="act'+(isDone?" done":"")+'"><button class="act-toggle" data-act="'+T.esc(a.id)+'" aria-pressed="'+isDone+'">'+
          '<span class="box">'+CHECK+'</span><span class="name">'+T.esc(a.name)+'</span>'+T.sudsChip(a.suds)+'</button>'+chip+'</div>';
      }).join("")+'</div>':
        '<p class="muted" style="text-align:center">Sua psicóloga ainda não cadastrou as atividades.</p>')+
      '<div style="display:flex;flex-direction:column;gap:6px;margin-top:6px"><span class="eyebrow">Últimos 7 dias</span>'+T.weekHTML(S.config,S.days,7)+'</div>';
  }
  renderSync();
}

document.addEventListener("click",async e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.tab){S.tab=b.dataset.tab;render();return;}
  if(b.hasAttribute("data-fc-virar")){
    FC.virada=!FC.virada;b.classList.toggle("virada",FC.virada);b.setAttribute("aria-pressed",FC.virada);
    b.querySelector(".fc-verso").setAttribute("aria-hidden",FC.virada);b.querySelector(".fc-frente").setAttribute("aria-hidden",!FC.virada);return;
  }
  if(b.dataset.fcIr){fcIr(Number(b.dataset.fcIr));return;}
  if(b.dataset.fcFase){fc().fase=b.dataset.fcFase;FC.virada=false;fcSave();render();return;}
  if(b.hasAttribute("data-fc-embaralhar")){
    const f=fcFase(),ids=f.cartas.map(x=>x.id);
    for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
    FC.ordem[f.id]=ids;FC.i[f.id]=0;FC.virada=false;fcSave();render();T.toast("Cartas embaralhadas.");return;
  }
  if(b.dataset.day){
    const k=T.shiftKey(S.viewDate,Number(b.dataset.day)),t=T.todayKey();
    if(k<=t&&k>=T.shiftKey(t,-6)){S.viewDate=k;render();}
    return;
  }
  if(b.dataset.act){
    const k=S.viewDate,id=b.dataset.act,cur=new Set(S.days[k]||[]);
    const adding=!cur.has(id);adding?cur.add(id):cur.delete(id);
    S.days={...S.days,[k]:[...cur]};
    const realToday={...(S.realidade[k]||{})};
    if(!adding)delete realToday[id]; // desmarcou: a avaliação daquela vez não vale mais
    S.realidade={...S.realidade,[k]:realToday};
    S.pending[k]={done:[...cur],realidade:realToday};lsSet(K_PENDING,S.pending);cacheState();
    render();flush();
    if(adding){
      nudgeAfterGain();
      // pergunta como foi antes de comemorar, senão a comemoração (se houver) tomaria a tela
      if(!openRealidadeSheet(k,id,checkRewards))checkRewards();
    }else{
      checkRewards(); // pode ter caído abaixo de algum reforçador; libera a comemoração pra quando ela bater a meta de novo
    }
    return;
  }
  if(b.dataset.real){openRealidadeSheet(S.viewDate,b.dataset.real);return;}
  if(b.hasAttribute("data-install")&&deferredPrompt){deferredPrompt.prompt();try{await deferredPrompt.userChoice;}catch(_){}deferredPrompt=null;renderInstall();return;}
  if(b.hasAttribute("data-notif")){
    try{const p=await Notification.requestPermission();if(p==="granted")T.toast("Avisos ativados.");}catch(_){}
    renderInstall();return;
  }
});

// nas Cartas: setas do teclado passam a carta; no celular, arrastar para o lado
document.addEventListener("keydown",e=>{
  if(S.tab!=="cartas"||!S.config.cartas||document.getElementById("main").hidden||document.querySelector("#modal .modal-card"))return;
  if(e.target.closest&&e.target.closest("input,textarea,select"))return;
  if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();fcIr(e.key==="ArrowRight"?1:-1);}
});
let fcToque=null;
document.addEventListener("touchstart",e=>{fcToque=e.target.closest(".fc-card")&&e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
document.addEventListener("touchend",e=>{
  if(!fcToque)return;const t=e.changedTouches[0],dx=t.clientX-fcToque.x,dy=t.clientY-fcToque.y;fcToque=null;
  if(Math.abs(dx)>60&&Math.abs(dx)>2*Math.abs(dy)){e.preventDefault();fcIr(dx<0?1:-1);}
});

/* ---------- entrada ---------- */
function showCode(msg){
  document.getElementById("main").hidden=true;
  document.getElementById("code-screen").hidden=false;
  const er=document.getElementById("code-error");er.hidden=!msg;er.textContent=msg||"";
}
document.getElementById("code-form").addEventListener("submit",e=>{
  e.preventDefault();
  const v=document.getElementById("code-input").value.replace(/[^a-z0-9]/gi,"").toUpperCase();
  if(v.length<8){showCode("O código tem 12 letras e números. Confira e tente de novo.");return;}
  start(v);
});

async function start(token){
  const prev=lsGet(K_CACHE,null);
  S.token=token;
  if(prev&&prev.token!==token){lsSet(K_CACHE,null);lsSet(K_PENDING,{});lsSet(K_PENDING_CEL,null);}
  S.pending=(prev&&prev.token===token)?lsGet(K_PENDING,{}):{};
  if(prev&&prev.token===token){
    S.name=prev.name;S.config=T.normConfig(prev.config);T.aplicarTema(S.config.tema);S.days=Object.assign({},prev.days,pendingDays());
    S.realidade=Object.assign({},prev.realidade,pendingRealidade());S.offset=prev.offset;S.celebrated=prev.celebrated||{};S.loaded=true;
    document.getElementById("code-screen").hidden=true;document.getElementById("main").hidden=false;render();
  }
  try{
    const ok=await load();
    if(!ok){lsSet(K_TOKEN,null);lsSet(K_CACHE,null);S.loaded=false;showCode("Código não encontrado. Confira o link com sua psicóloga.");return;}
    lsSet(K_TOKEN,token);S.online=true;
    document.getElementById("code-screen").hidden=true;document.getElementById("main").hidden=false;
    render();flush();checkRewards();
  }catch(e){
    S.online=false;
    if(!S.loaded)showCode("Sem conexão com a internet. Tente de novo quando estiver on-line.");
    else renderSync();
  }
}

function refresh(){if(S.token&&S.loaded)load().then(ok=>{if(ok){render();flush();checkRewards();}}).catch(()=>{S.online=false;renderSync();});}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){S.viewDate=S.viewDate>T.todayKey()?T.todayKey():S.viewDate;refresh();}});
window.addEventListener("online",()=>{flush();refresh();trySaveCelebrated();});

if("serviceWorker" in navigator){navigator.serviceWorker.register("sw.js").then(r=>{swReg=r;}).catch(()=>{});}
renderInstall();

const fromUrl=(new URLSearchParams(location.search).get("p")||"").replace(/[^a-z0-9]/gi,"").toUpperCase();
const saved=lsGet(K_TOKEN,null);
if(fromUrl)start(fromUrl);else if(saved)start(saved);else showCode("");
})();
