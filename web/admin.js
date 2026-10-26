/* Painel da psicóloga: login no Supabase, cadastro de pacientes, reforçadores, atividades e pontos. */
(function(){
"use strict";
const T=window.Trilha,CFG=window.TRILHA_CONFIG;
const sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);

const S={
  patients:[],current:null,days:{},realidade:{},tab:"caso",
  draft:null,dirty:false,confirm:null,creating:false,busy:false,cmpKind:"week",lib:false,
  hasPhone:true, // false enquanto o schema.sql com a coluna telefone não tiver sido rodado
  tema:"cafe", // paleta escolhida em Cores (guardada na conta dela e na config de cada paciente)
  arq:new Set(), // pacientes arquivadas (ids, na conta dela: user_metadata.arquivados)
  verArq:false,railOpen:false,
  ativTab:"resumo" // Ativação comportamental: "resumo" (a trilha dela) ou "config" (Configurar)
};
const arquivada=p=>!!p&&S.arq.has(p.id);
const cur=()=>S.patients.find(p=>p.id===S.current)||null;
const SALVE_CFG="Salve ou descarte as alterações da Configuração antes de sair.";
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

/* ---------- dados ---------- */
const COLS="id,name,token,config,point_offset,celebrated,created_at";
async function loadPatients(){
  let {data,error}=await sb.from("patients").select(COLS+(S.hasPhone?",telefone":"")).order("created_at");
  // banco ainda sem a coluna telefone: funciona igual, só sem o celular
  if(error&&S.hasPhone&&(error.code==="42703"||/telefone/.test(error.message||""))){
    S.hasPhone=false;({data,error}=await sb.from("patients").select(COLS).order("created_at"));
  }
  if(error)throw error;
  S.patients=data.map(p=>({...p,config:T.normConfig(p.config)}));
  if(!cur()){const a=S.patients.find(x=>!arquivada(x))||S.patients[0];S.current=a?a.id:null;}
}
async function loadDays(){
  S.days={};S.realidade={};
  if(!S.current)return;
  const {data,error}=await sb.from("days").select("day,done,realidade").eq("patient_id",S.current);
  if(error)throw error;
  data.forEach(d=>{S.days[d.day]=d.done||[];S.realidade[d.day]=d.realidade||{};});
}
async function refresh(){
  try{await loadPatients();await loadDays();}catch(e){T.toast("Não consegui carregar os dados. Confira a internet.");}
  render();
}
async function savePatient(fields,okMsg){
  const p=cur();if(!p)return false;
  if(fields.config)fields={...fields,config:{...fields.config,tema:S.tema}};
  const {error}=await sb.from("patients").update(fields).eq("id",p.id);
  if(error){T.toast("Não consegui salvar: "+error.message);return false;}
  Object.assign(p,fields);if(fields.config)p.config=T.normConfig(fields.config);
  if(okMsg)T.toast(okMsg);
  return true;
}

// usado pela Formulação ("levar submetas para a Trilha"): acrescenta as que ainda não existem, pelo nome
async function addActivities(names){
  const p=cur();if(!p)return -1;
  const have=new Set(p.config.activities.map(a=>a.name.trim().toLowerCase()));
  const add=[];
  names.forEach(n=>{const name=n.trim().slice(0,200),k=name.toLowerCase();if(name&&!have.has(k)){have.add(k);add.push({id:uid("a"),name,suds:null});}});
  if(!add.length)return 0;
  if(!await savePatient({config:{...p.config,activities:[...p.config.activities,...add]}}))return -1;
  S.draft=null;S.dirty=false;
  return add.length;
}

/* ---------- telas ---------- */
// telas gerais, fora de uma paciente
const FERRAMENTAS=[["lib","Biblioteca"],["consulta","Consulta clínica"],["criar","Criar com IA"],["cores","Cores"]];
const telaDe=k=>k==="lib"?window.TrilhaLibrary:k==="consulta"?window.TrilhaConsulta:k==="cores"?CORES:window.TrilhaCriar;
// Cores: escolhe a paleta do painel e do app das pacientes; cada cartão é uma miniatura com as cores dele
const CORES={
  html(){
    return '<section class="panel"><h3>Cores</h3><p class="hint">A paleta vale para o seu painel e para o app das suas pacientes (elas veem a cor nova na próxima vez que abrirem). '+
      'As cores dos pontos, do SUDS e da Realidade não mudam, porque têm significado.</p>'+
      '<div class="tema-grid">'+Object.entries(T.TEMAS).map(([id,t])=>{
        const c=t.cores,on=S.tema===id;
        return '<button class="tema-card" data-act="tema" data-arg="'+id+'" aria-pressed="'+on+'"'+(S.busy?" disabled":"")+
          ' style="--t-bg:'+c.bg+';--t-surface:'+c.surface+';--t-ink:'+c.ink+';--t-muted:'+c.muted+';--t-line:'+c.line+';--t-accent:'+c.accent+';--t-soft:'+c["accent-soft"]+'">'+
          '<span class="tema-mini" aria-hidden="true"><span class="tema-bar"></span><span class="tema-txt"><b>Olá, Ana</b><i>12 pontos esta semana</i></span>'+
          '<span class="tema-row"><span class="tema-btn">Salvar</span><span class="tema-chip">SUDS 40</span></span></span>'+
          '<span class="tema-nome">'+T.esc(t.nome)+(on?' <span class="muted">· em uso</span>':'')+'</span></button>';
      }).join("")+'</div></section>';
  },
  mount(){}
};
/* Barra lateral: os botões que ficavam no topo viram ícones; os ⋯ abrem os nomes */
const ICON_PATH={
  mais:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  pacientes:'<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.3c1.6.7 2.6 2.3 3 4.7"/>',
  novo:'<circle cx="10" cy="8" r="3.2"/><path d="M4 19c.6-3.3 3-5 6-5 1.4 0 2.7.4 3.7 1.1"/><path d="M18 13v6M15 16h6"/>',
  editar:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  arquivo:'<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10h14V9M10 13h4"/>',
  lib:'<path d="M5 4h4v16H5zM10 4h4v16h-4z"/><path d="M15.5 4.8l3.8-1 3.7 15.5-3.8 1z" transform="translate(-1.5 .500)"/>',
  consulta:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  criar:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  cores:'<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.8 2-1.8 0-1.3-1-1.7-1-3 0-1.1.9-2 2-2h2.5A3.5 3.5 0 0 0 21 10.7C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/>',
  atualizar:'<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
  sair:'<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  olho:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  olhoFechado:'<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 4M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'
};
const icon=k=>'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+ICON_PATH[k]+'</svg>';
const FER_ICON={lib:"lib",consulta:"consulta",criar:"criar",cores:"cores"};
function renderRail(p,nArq){
  const nav=document.getElementById("rail");if(!nav)return;
  const it=(act,ic,label,on,extra)=>'<button class="rail-btn" data-act="'+act+'" title="'+label+'" aria-label="'+label+'"'+(on!=null?' aria-pressed="'+!!on+'"':'')+(extra||"")+'>'+icon(ic)+'<span class="rail-label">'+label+'</span></button>';
  nav.innerHTML='<button class="rail-btn rail-toggle" data-act="rail" aria-expanded="'+S.railOpen+'" title="'+(S.railOpen?"Esconder os nomes":"Mostrar os nomes")+'" aria-label="'+(S.railOpen?"Esconder os nomes":"Mostrar os nomes")+'">'+icon("mais")+'<span class="rail-label">Menu</span></button>'+
    it("home","pacientes","Pacientes",!S.lib)+
    it("new","novo","Nova paciente")+
    (p?it("edit-patient","editar","Editar, arquivar ou excluir"):"")+
    (nArq?it("ver-arq","arquivo","Arquivadas ("+nArq+")",S.verArq):"")+
    FERRAMENTAS.map(([k,l])=>it(k,FER_ICON[k],l,S.lib===k)).join("")+
    it("refresh","atualizar","Atualizar")+
    '<span class="rail-fim"></span>'+it("logout","sair","Sair");
  nav.classList.toggle("aberta",S.railOpen);
  document.body.classList.toggle("rail-aberta",S.railOpen);
}
/* olhinho: fechado, os nomes e os dados que identificam a paciente ficam escondidos (gravar a tela) */
const PV_KEY="painel-privado";
const privado=()=>document.documentElement.classList.contains("privado");
function setPrivado(on){
  document.documentElement.classList.toggle("privado",on);
  try{localStorage.setItem(PV_KEY,on?"1":"0");}catch(_){}
  const b=document.getElementById("pv-toggle");
  if(b){b.setAttribute("aria-pressed",String(on));b.innerHTML=icon(on?"olhoFechado":"olho");
    const l=on?"Mostrar os dados das pacientes":"Esconder os dados das pacientes (para gravar a tela)";b.title=l;b.setAttribute("aria-label",l);}
}
try{if(localStorage.getItem(PV_KEY)==="1")document.documentElement.classList.add("privado");}catch(_){}
// guarda a paleta na conta e leva para a config de todas as pacientes; devolve quantas não salvaram
async function salvarTema(id){
  const {error}=await sb.auth.updateUser({data:{tema:id}});
  let falhas=error?1:0;
  for(const p of S.patients){
    if(p.config.tema===id)continue;
    const config={...p.config,tema:id};
    const r=await sb.from("patients").update({config}).eq("id",p.id);
    if(r.error)falhas++;else p.config=T.normConfig(config);
  }
  return falhas;
}
function render(){
  const main=document.getElementById("main");
  const p=cur();
  const opt=(x,i)=>'<option value="'+x.id+'"'+(x.id===S.current?" selected":"")+'>'+T.esc(privado()?"****** ("+(i+1)+")":x.name)+'</option>';
  const ativas=S.patients.filter(x=>!arquivada(x)||(x.id===S.current&&!S.verArq)),arqs=S.patients.filter(arquivada);
  const opts=ativas.map(opt).join("")+(S.verArq&&arqs.length?'<optgroup label="Arquivadas">'+arqs.map((x,i)=>opt(x,ativas.length+i)).join("")+'</optgroup>':"");
  renderRail(p,arqs.length);
  let html=S.lib?'':'<div class="topbar">'+
    (S.patients.length?'<select id="patient-select" aria-label="Paciente">'+opts+'</select>':'<span class="muted" style="flex:1">Nenhum paciente cadastrado ainda.</span>')+'</div>'+
    (arquivada(p)?'<div class="panel cx-received cx-noprint"><b>Paciente arquivada.</b> Ela não aparece na lista; nada foi apagado. <button class="btn ghost cx-small" data-act="arquivar">Reativar</button></div>':'');
  if(S.lib){
    const tela=telaDe(S.lib);
    main.innerHTML=html+tela.html();
    document.getElementById("app").classList.add("xwide");
    tela.mount({sb});
    return;
  }
  if(S.creating){
    html+='<form class="panel" id="new-form"><h3>Novo paciente</h3>'+
      '<label>Como o app vai chamar a paciente<input type="text" id="new-name" maxlength="80" placeholder="Primeiro nome ou apelido" required></label>'+
      '<p class="hint">Aparece no topo do app dela ("Olá, …"). Use só o primeiro nome ou um apelido.</p>'+
      (S.hasPhone?'<label>Celular (WhatsApp), opcional<input type="tel" id="new-phone" inputmode="tel" autocomplete="off" maxlength="25" placeholder="(11) 91234-5678"></label>'+
        '<p class="hint">Para o WhatsApp abrir direto a conversa com ela quando você enviar o link. Fica só no seu painel.</p>':'')+
      '<label style="flex-direction:row;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="new-template" checked style="width:auto">'+
      'Já começar com a hierarquia e os reforçadores da Escala SUDS</label>'+
      '<p class="hint">Preenche com a lista que vocês já cadastraram. Dá para editar ou apagar itens depois, em Ativação comportamental → Configurar — inclusive para outra paciente com uma lista diferente.</p>'+
      '<div class="btns"><button class="btn" type="submit">Criar</button><button class="btn ghost" type="button" data-act="cancel-new">Cancelar</button></div></form>';
  }
  if(p){
    html+='<div class="tabs" role="tablist">'+[["caso","Formulação"],["acesso","Paciente"]].map(([k,l])=>
      '<button class="tab" role="tab" data-tab="'+k+'" aria-selected="'+(S.tab===k)+'">'+l+'</button>').join("")+'</div>';
    html+=S.tab==="acesso"?accessHTML(p):window.TrilhaCase.html();
  }
  main.innerHTML=html;
  document.getElementById("app").classList.toggle("xwide",!!p&&S.tab==="caso");
  if(p&&S.tab==="acesso")drawQR(p);
  if(p&&S.tab==="caso")window.TrilhaCase.mount({sb,patient:p,addActivities,
    // o painel da trilha (pontos, histórico, evolução) aparece nos Recursos como "Ativação comportamental"
    // a Configuração (reforçadores, atividades, comemoração, pontos) fica dentro dela, em "Configurar"
    ativacao:{html:()=>ativacaoHTML(p),progress:()=>T.totalPoints(p.config,S.days,p.point_offset)+" pts",refresh,dirty:()=>S.dirty}});
  const nn=document.getElementById("new-name");if(nn)nn.focus();
}

function fmtShort(k){return T.keyDate(k).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});}
function cmpArrow(n,unit){
  if(n>0)return '<span class="cmp-up">▲ +'+n+' '+unit+'</span>';
  if(n<0)return '<span class="cmp-down">▼ '+n+' '+unit+'</span>';
  return '<span class="muted">sem mudança</span>';
}
function compareHTML(p){
  const kind=S.cmpKind,c=T.comparePeriods(p.config,S.days,kind);
  const label=kind==="week"?"Semana":"Mês";
  return '<div class="panel"><h3>Comparar progresso</h3>'+
    '<div class="tabs" role="tablist" style="max-width:240px">'+["week","month"].map(k=>
      '<button class="tab" role="tab" data-cmp="'+k+'" aria-selected="'+(kind===k)+'">'+(k==="week"?"Semanal":"Mensal")+'</button>').join("")+'</div>'+
    '<div class="cmp-grid">'+
      '<div class="cmp-col"><span class="eyebrow">'+label+' atual</span><span class="muted" style="font-size:12px">'+fmtShort(c.cur.start)+'–'+fmtShort(c.cur.end)+'</span>'+
        '<div class="cmp-num">'+c.cur.points+' pts</div><span class="muted" style="font-size:13px">'+c.cur.activeDays+' dia(s) com atividade</span></div>'+
      '<div class="cmp-col"><span class="eyebrow">'+label+' anterior</span><span class="muted" style="font-size:12px">'+fmtShort(c.prev.start)+'–'+fmtShort(c.prev.end)+'</span>'+
        '<div class="cmp-num muted">'+c.prev.points+' pts</div><span class="muted" style="font-size:13px">'+c.prev.activeDays+' dia(s) com atividade</span></div>'+
    '</div>'+
    '<p class="hint" style="margin-top:4px">Pontos: '+cmpArrow(c.cur.points-c.prev.points,"pts")+' · Dias ativos: '+cmpArrow(c.cur.activeDays-c.prev.activeDays,"dia(s)")+
    (kind==="week"?" · a semana atual pode estar incompleta ainda.":" · o mês atual pode estar incompleto ainda.")+'</p></div>';
}
function sudsTrailHTML(h){
  if(h.sudsHistory.length)return h.sudsHistory.map(x=>'<b>'+x.value+'</b>'+(x.date?' ('+fmtShort(x.date)+')':' (início)')).join(' → ');
  return h.suds!=null?'previsto '+h.suds:'';
}
// Ativação comportamental (Recursos da Formulação): a trilha dela e, em Configurar, o que antes era a aba Configuração
function ativacaoHTML(p){
  return '<div class="tabs cx-noprint" role="tablist" style="max-width:360px">'+[["resumo","Acompanhar"],["config","Configurar"]].map(([k,l])=>
      '<button class="tab" role="tab" data-ativ="'+k+'" aria-selected="'+(S.ativTab===k)+'">'+l+'</button>').join("")+'</div>'+
    (S.ativTab==="config"?configHTML(p):summaryHTML(p));
}
function summaryHTML(p){
  const total=T.totalPoints(p.config,S.days,p.point_offset);
  const todayKey=T.todayKey();
  const today=new Set(S.days[todayKey]||[]);
  const realToday=S.realidade[todayKey]||{};
  const doneToday=p.config.activities.filter(a=>today.has(a.id));
  const hist=T.realidadeHistory(p.config,S.realidade);
  return '<section class="score">'+T.scoreHTML(p.config,S.days,p.point_offset)+'</section>'+
    T.nudgeHTML(p.config,total).replace("Falta pouco para você conseguir","Falta pouco para ela conseguir").replace("Só mais um pouco! ","")+
    '<div class="panel"><h3>Hoje</h3>'+(doneToday.length?'<ul class="done-list">'+doneToday.map(a=>{
      const rv=realToday[a.id];
      return '<li>'+T.esc(a.name)+' — '+(rv!=null?'<span class="evo-dot '+T.sudsClass(rv)+'" style="margin-left:4px">'+rv+'</span> <span class="muted">'+T.esc(T.realidadeShort(rv))+'</span>':'<span class="muted">ainda sem avaliação da paciente</span>')+'</li>';
    }).join("")+'</ul>':'<p class="hint">Nada marcado hoje ainda.</p>')+'</div>'+
    compareHTML(p)+
    '<div style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow">Pontos por dia · últimos 14 dias</span>'+T.weekHTML(p.config,S.days,14)+'</div>'+
    (hist.length?'<div class="panel"><h3>Evolução por atividade</h3>'+
      '<p class="hint">Como ela avaliou cada vez que fez, na ordem em que aconteceu. Se os números forem caindo, é sinal de que a ansiedade real está diminuindo com a exposição.</p>'+
      '<div>'+hist.map(h=>'<div class="evo-row"><div class="evo-head"><span class="evo-name">'+T.esc(h.name)+'</span>'+
        (sudsTrailHTML(h)?'<span class="muted" style="font-size:12px">Meta SUDS: '+sudsTrailHTML(h)+'</span>':'')+'</div>'+
        '<div class="evo-track">'+h.points.map(pt=>'<span class="evo-dot '+T.sudsClass(pt.value)+'" title="'+T.esc(T.dayLabel(pt.day))+': '+T.esc(T.realidadeShort(pt.value))+'">'+pt.value+'</span>').join('<span class="evo-arrow">→</span>')+'</div>'+
        (h.points.length>1?'<p class="muted" style="font-size:12px;margin:4px 0 0">'+
          (h.delta>0?'Começou relatando '+h.first+', a mais recente foi '+h.last+' — caiu '+h.delta+' pontos de desconforto.':
           h.delta<0?'Começou relatando '+h.first+', a mais recente foi '+h.last+' — subiu '+Math.abs(h.delta)+' pontos de desconforto.':
           'Sem mudança até agora: sempre relatou '+h.last+'.')+'</p>':'')+
        '</div>').join("")+
      '</div></div>':"")+
    '<div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Reforçadores</span>'+T.rewardsHTML(p.config,total)+'</div>';
}

function configHTML(p){
  if(!S.draft){S.draft=JSON.parse(JSON.stringify(p.config));sortDraft();S.dirty=false;}
  const d=S.draft,total=T.totalPoints(p.config,S.days,p.point_offset);
  const cf=S.confirm;
  return '<div class="panel"><h3>Reforçadores</h3><p class="hint">Nome e quantos pontos ela precisa acumular. O aviso de "falta pouco" sai faltando 5 pontos (até 99) ou 10 pontos (100 ou mais).</p>'+
    '<div class="list">'+d.rewards.map((r,i)=>'<div class="row"><input type="text" id="rn-'+T.esc(r.id)+'" data-rw="'+i+'" data-f="name" value="'+T.esc(r.name)+'" aria-label="Nome do reforçador">'+
      '<input type="number" id="rp-'+T.esc(r.id)+'" min="1" data-rw="'+i+'" data-f="points" value="'+T.esc(r.points)+'" aria-label="Pontos"><button class="icon-btn" id="rx-'+T.esc(r.id)+'" data-del-rw="'+i+'" aria-label="Remover reforçador">×</button></div>').join("")+'</div>'+
    '<div class="btns"><button class="btn ghost" data-add="rw">+ Reforçador</button><button class="btn ghost" data-import-open="rw">Colar lista</button></div>'+
    (S.importing==="rw"?importHTML("rw","Um por linha: nome e pontos separados por ponto e vírgula ou tabulação (dá para copiar duas colunas do Excel).\nEx.: Comer uma sobremesa; 25"):"")+'</div>'+

    '<div class="panel"><h3>Atividades da hierarquia</h3><p class="hint">Cada atividade feita no dia vale 1 ponto. O número é o SUDS previsto (0 a 100), opcional.</p>'+
    '<div class="list">'+d.activities.map((a,i)=>'<div class="row"><input type="text" id="an-'+T.esc(a.id)+'" data-ac="'+i+'" data-f="name" value="'+T.esc(a.name)+'" aria-label="Atividade">'+
      '<input type="number" id="as-'+T.esc(a.id)+'" min="0" max="100" step="5" data-ac="'+i+'" data-f="suds" value="'+(a.suds==null?"":T.esc(a.suds))+'" placeholder="SUDS" aria-label="SUDS"><button class="icon-btn" id="ax-'+T.esc(a.id)+'" data-del-ac="'+i+'" aria-label="Remover atividade">×</button></div>').join("")+'</div>'+
    '<div class="btns"><button class="btn ghost" data-add="ac">+ Atividade</button><button class="btn ghost" data-import-open="ac">Colar lista</button></div>'+
    (S.importing==="ac"?importHTML("ac","Uma por linha: nome e SUDS separados por ponto e vírgula ou tabulação (dá para copiar as colunas da planilha).\nEx.: Ir para o trabalho; 75"):"")+'</div>'+

    '<div class="panel"><h3>Comemoração</h3><p class="hint">O que aparece na tela quando ela alcança um reforçador.</p>'+
    '<select id="celeb">'+Object.entries(T.CELEB_LABEL).map(([k,l])=>'<option value="'+k+'"'+(d.celebration===k?" selected":"")+'>'+l+'</option>').join("")+'</select>'+
    '<div class="btns"><button class="btn ghost" data-test="confete">Testar confete</button><button class="btn ghost" data-test="baloes">Testar balões</button><button class="btn ghost" data-test="fogos">Testar fogos</button></div></div>'+

    '<div class="panel"><h3>Pontos</h3><p class="hint">Ajuste manual (bônus ou correção). Total atual: <b>'+total+'</b> pts.</p>'+
    '<div class="btns"><input type="number" id="adj" value="5" style="width:90px" aria-label="Quantidade de pontos"><button class="btn ghost" data-adj="1">Somar</button><button class="btn ghost" data-adj="-1">Subtrair</button></div>'+
    '<p class="hint">Recomeçar zera os pontos e libera todos os reforçadores de novo. O histórico de dias continua salvo.</p>'+
    '<div class="btns">'+(cf==="reset"?'<button class="btn warn" data-confirm="reset">Confirmar: zerar pontos</button><button class="btn ghost" data-confirm="no">Cancelar</button>':'<button class="btn ghost" data-ask="reset">Recomeçar ciclo</button>')+'</div></div>'+

    (S.dirty?'<div class="savebar"><span class="muted" style="margin-right:auto;font-size:14px">Alterações não salvas</span><button class="btn ghost" data-draft="discard">Descartar</button><button class="btn" data-draft="save">Salvar</button></div>':"");
}
function sortDraft(){S.draft.rewards.sort(T.byPoints);S.draft.activities.sort(T.bySuds);}
function importHTML(kind,help){
  return '<div style="display:flex;flex-direction:column;gap:8px"><textarea id="import-text" placeholder="'+T.esc(help)+'"></textarea>'+
    '<div class="btns"><button class="btn" data-import="'+kind+'">Adicionar à lista</button><button class="btn ghost" data-import-open="">Fechar</button></div></div>';
}

function patientLink(p){return new URL("./?p="+p.token,location.href).href;}
function anamneseLink(p){return new URL("./anamnese.html?p="+p.token,location.href).href;}
/* Celular: guarda só os dígitos com o código do país. Aceita "(11) 91234-5678", "11912345678",
   "+55 11 91234-5678" ou um número de fora com "+". "" = apagar; null = número que não dá para usar. */
function normPhone(v){
  const t=String(v||"").trim();if(!t)return "";
  let d=t.replace(/\D/g,"");
  if(t.startsWith("+")||d.startsWith("00")){d=d.replace(/^00/,"");return d.length>=8&&d.length<=15?d:null;}
  d=d.replace(/^0+/,""); // 011 9... → 11 9...
  if(d.length===10||d.length===11)return "55"+d;
  if((d.length===12||d.length===13)&&d.startsWith("55"))return d;
  return null;
}
function fmtPhone(d){
  if(!d)return "";
  if(d.startsWith("55")&&(d.length===12||d.length===13)){const n=d.slice(4);return "("+d.slice(2,4)+") "+n.slice(0,n.length-4)+"-"+n.slice(-4);}
  return "+"+d;
}
const PHONE_ERR="Confira o celular: DDD e número, por exemplo (11) 91234-5678. De outro país, comece com + e o código do país.";
// com o celular salvo, o WhatsApp abre direto a conversa dela; sem, abre a lista de conversas para escolher
function waLink(text,phone){return "https://wa.me/"+(phone||"")+"?text="+encodeURIComponent(text);}
function waApp(p){return waLink("Oi, "+p.name+"! Este é o link do seu app de atividades: "+patientLink(p)+"\nAbra no celular e toque em \"Adicionar à tela inicial\".",p.telefone);}
function waAnamnese(p){return waLink("Oi, "+p.name+"! Antes da nossa próxima sessão, preencha a sua ficha de anamnese por este link: "+anamneseLink(p)+"\nPode responder com calma; as respostas vêm só para mim.",p.telefone);}
function waLabel(p){return p.telefone?"Enviar no WhatsApp dela":"Enviar pelo WhatsApp";}
function phoneHTML(p){
  if(!S.hasPhone)return '<p class="hint">Para guardar o celular dela e o WhatsApp abrir direto na conversa, rode o <b>schema.sql</b> atualizado no Supabase (SQL Editor) e recarregue esta página.</p>';
  return '<label for="phone" style="margin-top:6px">Celular (WhatsApp)</label>'+
    '<div class="btns"><input type="tel" id="phone" data-pv inputmode="tel" autocomplete="off" maxlength="25" value="'+T.esc(fmtPhone(p.telefone))+'" placeholder="(11) 91234-5678" style="flex:1" aria-label="Celular (WhatsApp)">'+
    '<button class="btn ghost" data-act="phone">Salvar celular</button></div>'+
    '<p class="hint">Opcional. Com o celular salvo, os botões do WhatsApp abrem direto a conversa com ela, com a mensagem pronta: é só tocar em enviar. O número fica só no seu painel; o app dela não recebe.</p>';
}
function accessHTML(p){
  const cf=S.confirm;
  return '<div class="panel"><h3>Editar ou excluir</h3>'+
    '<div class="btns"><input type="text" id="rename" data-pv value="'+T.esc(p.name)+'" maxlength="80" style="flex:1" aria-label="Nome"><button class="btn ghost" data-act="rename">Salvar nome</button></div>'+
    phoneHTML(p)+
    '<p class="hint">'+(arquivada(p)?'Paciente arquivada: não aparece na lista de pacientes. Reativar traz de volta.':'Terminou o acompanhamento? Arquivar tira a paciente da lista sem apagar nada; dá para reativar quando quiser.')+'</p>'+
    '<div class="btns"><button class="btn ghost" data-act="arquivar">'+(arquivada(p)?"Reativar paciente":"Arquivar paciente")+'</button></div>'+
    '<p class="hint">Excluir apaga a paciente e todo o histórico dela. Não dá para desfazer.</p>'+
    '<div class="btns">'+(cf==="delete"?'<button class="btn warn" data-confirm="delete">Confirmar: excluir '+T.esc(T.pv(p.name))+'</button><button class="btn ghost" data-confirm="no">Cancelar</button>':'<button class="btn ghost" data-ask="delete">Excluir paciente</button>')+'</div></div>'+
    '<div class="panel"><h3>Link da paciente</h3>'+
    '<p class="hint">Envie este link para ela (WhatsApp, por exemplo) ou mostre o QR code na consulta. Ela não precisa criar conta. Depois de abrir, é só instalar na tela inicial.</p>'+
    '<div class="linkbox" id="plink">'+T.esc(patientLink(p))+'</div>'+
    '<div class="btns"><button class="btn" data-act="copy" data-arg="app">Copiar link</button><a class="btn ghost" data-wa="app" href="'+T.esc(waApp(p))+'" target="_blank" rel="noopener">'+waLabel(p)+'</a><span class="muted" style="font-size:14px">Código: <b style="letter-spacing:.08em">'+T.esc(p.token)+'</b></span></div>'+
    '<div class="qr" id="qr"></div>'+
    '<p class="hint">Quem tiver esse link consegue abrir o app dela. Se ele vazar, gere um código novo: o link antigo para de funcionar e você envia o novo.</p>'+
    '<div class="btns">'+(cf==="token"?'<button class="btn warn" data-confirm="token">Confirmar: trocar código</button><button class="btn ghost" data-confirm="no">Cancelar</button>':'<button class="btn ghost" data-ask="token">Gerar novo código</button>')+'</div></div>'+
    '<div class="panel"><h3>Anamnese para ela preencher</h3>'+
    '<p class="hint">Ela responde pelo celular, sem conta, e as respostas entram sozinhas na Anamnese da aba Formulação. Se você já tiver escrito algo num campo, a resposta dela aparece ali para você escolher.</p>'+
    '<div class="linkbox" id="alink">'+T.esc(anamneseLink(p))+'</div>'+
    '<div class="btns"><button class="btn" data-act="copy" data-arg="an">Copiar link</button><a class="btn ghost" data-wa="an" href="'+T.esc(waAnamnese(p))+'" target="_blank" rel="noopener">'+waLabel(p)+'</a></div>'+
    '<p class="hint">Usa o mesmo código do app: se você gerar um código novo, este link também muda.</p></div>';
}
function drawQR(p){
  const box=document.getElementById("qr");if(!box||!window.qrcode)return;
  const qr=window.qrcode(0,"M");qr.addData(patientLink(p));qr.make();
  box.innerHTML=qr.createSvgTag({cellSize:4,margin:2,scalable:true});
}

/* ---------- ações ---------- */
function parseLines(text){
  return text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{
    const parts=l.split(/\t|;/).map(s=>s.trim());
    const num=parts.length>1?parts[parts.length-1].match(/\d+/):null;
    const name=(num?parts.slice(0,-1).join(" "):parts.join(" ")).replace(/\s+/g," ").trim();
    return {name,num:num?Number(num[0]):null};
  }).filter(x=>x.name);
}
function markDirty(){if(!S.dirty){S.dirty=true;render();}}

document.addEventListener("click",async e=>{
  const b=e.target.closest("button");if(!b||S.busy)return;
  const p=cur(),ds=b.dataset;
  if(b.id==="pv-toggle"){setPrivado(!privado());render();return;}
  if(ds.act==="rail"){S.railOpen=!S.railOpen;renderRail(p,S.patients.filter(arquivada).length);return;}
  if(S.railOpen&&b.closest("#rail")){S.railOpen=false;renderRail(p,S.patients.filter(arquivada).length);}
  if(ds.act==="home"||((ds.act==="new"||ds.act==="edit-patient")&&S.lib)){
    if(S.dirty){T.toast(SALVE_CFG);return;}
    S.lib=false;if(ds.act==="home"){S.creating=false;render();window.scrollTo(0,0);return;}
  }
  if(ds.act==="ver-arq"){S.verArq=!S.verArq;render();T.toast(S.verArq?"As arquivadas aparecem no fim da lista de pacientes.":"Arquivadas escondidas da lista.");return;}
  if(ds.act==="arquivar"&&p){
    const on=!arquivada(p),set=new Set(S.arq);if(on)set.add(p.id);else set.delete(p.id);
    S.busy=true;let error;try{({error}=await sb.auth.updateUser({data:{arquivados:[...set]}}));}catch(e){error=e;}S.busy=false;
    if(error){T.toast("Não consegui salvar. Confira a internet e tente de novo.");return;}
    S.arq=set;
    if(on&&!S.verArq){
      const a=S.patients.find(x=>!arquivada(x));
      if(a){if(window.TrilhaCase.pending())window.TrilhaCase.flush();S.current=a.id;S.tab="caso";S.draft=null;S.confirm=null;try{await loadDays();}catch(_){}}
    }
    render();
    T.toast(on?T.pv(p.name)+" arquivada. Ela sai da lista de pacientes; para ver de novo, use Arquivadas, na barra ao lado.":T.pv(p.name)+" voltou para a lista de pacientes.");
    return;
  }
  if(ds.cmp){S.cmpKind=ds.cmp;render();return;}
  if(ds.ativ){
    if(ds.ativ===S.ativTab)return;
    if(S.dirty){T.toast(SALVE_CFG);return;}
    S.ativTab=ds.ativ;S.draft=null;S.confirm=null;S.importing=null;
    if(ds.ativ==="resumo")await refresh();else render();return;
  }
  if(ds.tab||ds.act==="edit-patient"){
    const tab=ds.tab||"acesso";
    if(S.dirty&&tab!==S.tab){T.toast(SALVE_CFG);return;}
    S.tab=tab;S.confirm=null;S.importing=null;
    // como o antigo Resumo: abrir a trilha dela busca as marcações mais recentes
    if(tab==="caso"&&window.TrilhaCase.section()==="ativacao")await refresh();else render();return;
  }
  if(FERRAMENTAS.some(([k])=>k===ds.act)){
    if(S.dirty){T.toast(SALVE_CFG);return;}
    if(!S.lib&&window.TrilhaCase.pending())window.TrilhaCase.flush();
    S.lib=S.lib===ds.act?false:ds.act;S.creating=false;render();window.scrollTo(0,0);return;
  }
  if(ds.act==="tema"){
    const id=T.temaValido(ds.arg);if(id===S.tema||S.busy)return;
    S.tema=T.aplicarTema(id);S.busy=true;render();
    const falhas=await salvarTema(id);S.busy=false;render();
    T.toast(falhas?"Mudei aqui, mas não consegui salvar em tudo. Confira a internet e escolha de novo."
      :"Paleta "+T.TEMAS[id].nome+" aplicada"+(S.patients.length?". O app das pacientes muda na próxima vez que abrirem.":"."));
    return;
  }
  if(ds.act==="new"){S.creating=true;render();window.scrollTo(0,0);return;}
  if(ds.act==="cancel-new"){S.creating=false;render();return;}
  if(ds.act==="refresh"){await refresh();T.toast("Atualizado");return;}
  if(ds.act==="logout"){
    if(window.TrilhaCase.pending()){T.toast("Salvando a formulação antes de sair…");await window.TrilhaCase.flush();if(window.TrilhaCase.pending()){T.toast("Não consegui salvar a formulação. Confira a internet antes de sair.");return;}}
    await sb.auth.signOut();location.reload();return;
  }
  if(ds.act==="copy"){
    const an=ds.arg==="an",link=an?anamneseLink(p):patientLink(p);
    try{await navigator.clipboard.writeText(link);T.toast(an?"Link da anamnese copiado":"Link copiado");}
    catch(_){const r=document.createRange();r.selectNodeContents(document.getElementById(an?"alink":"plink"));const s=getSelection();s.removeAllRanges();s.addRange(r);T.toast("Selecionei o link. Copie com Ctrl+C.");}
    return;
  }
  if(ds.act==="phone"){
    const el=document.getElementById("phone"),tel=normPhone(el.value);
    if(tel===null){T.toast(PHONE_ERR);el.focus();return;}
    if((tel||null)===(p.telefone||null)){el.value=fmtPhone(tel);T.toast(tel?"Esse já é o celular salvo":"Nenhum celular salvo");return;}
    S.busy=true;const ok=await savePatient({telefone:tel||null},tel?"Celular salvo. O WhatsApp agora abre direto a conversa com ela.":"Celular apagado");S.busy=false;
    if(ok)render();return;
  }
  if(ds.act==="rename"){const v=document.getElementById("rename").value.trim();if(v){await savePatient({name:v},"Nome salvo");render();}return;}
  if(ds.test){T.celebrate(ds.test);return;}
  if(ds.ask){S.confirm=ds.ask;render();return;}
  if(ds.confirm==="no"){S.confirm=null;render();return;}
  if(ds.confirm==="reset"){
    S.busy=true;
    await savePatient({point_offset:-T.rawPoints(p.config,S.days),celebrated:{}},"Ciclo recomeçado. Pontos zerados.");
    S.busy=false;S.confirm=null;render();return;
  }
  if(ds.confirm==="token"){
    S.busy=true;
    const {data,error}=await sb.rpc("new_patient_token");
    if(error)T.toast("Não consegui gerar o código: "+error.message);
    else await savePatient({token:data},"Código trocado. Envie o link novo para ela.");
    S.busy=false;S.confirm=null;render();return;
  }
  if(ds.confirm==="delete"){
    S.busy=true;
    const {error}=await sb.from("patients").delete().eq("id",p.id);
    S.busy=false;S.confirm=null;
    if(error){T.toast("Não consegui excluir: "+error.message);return;}
    T.toast("Paciente excluída");S.current=null;S.tab="caso";await refresh();return;
  }
  if(ds.adj){
    const n=Math.round(Number(document.getElementById("adj").value)||0)*Number(ds.adj);if(!n)return;
    S.busy=true;await savePatient({point_offset:(p.point_offset||0)+n},(n>0?"Somados ":"Subtraídos ")+Math.abs(n)+" pontos");S.busy=false;render();return;
  }
  if(ds.add){
    if(ds.add==="rw")S.draft.rewards.push({id:uid("r"),name:"Novo reforçador",points:30});
    else S.draft.activities.push({id:uid("a"),name:"Nova atividade",suds:null});
    S.dirty=true;render();return;
  }
  if(ds.delRw){S.draft.rewards.splice(Number(ds.delRw),1);S.dirty=true;render();return;}
  if(ds.delAc){S.draft.activities.splice(Number(ds.delAc),1);S.dirty=true;render();return;}
  if(ds.importOpen!=null){S.importing=ds.importOpen||null;render();const t=document.getElementById("import-text");if(t)t.focus();return;}
  if(ds.import){
    const rows=parseLines(document.getElementById("import-text").value);
    if(!rows.length){T.toast("Cole pelo menos uma linha.");return;}
    rows.forEach(x=>{
      if(ds.import==="rw")S.draft.rewards.push({id:uid("r"),name:x.name,points:x.num&&x.num>0?x.num:30});
      else S.draft.activities.push({id:uid("a"),name:x.name,suds:x.num==null?null:Math.min(100,x.num)});
    });
    sortDraft();S.importing=null;S.dirty=true;render();T.toast(rows.length+" itens adicionados. Confira e salve.");return;
  }
  if(ds.draft==="discard"){S.draft=null;S.dirty=false;render();return;}
  if(ds.draft==="save"){
    const d=S.draft;
    const config={
      celebration:d.celebration||"auto",
      rewards:d.rewards.map(r=>({id:r.id,name:String(r.name).trim()||"Reforçador",points:Math.max(1,Math.round(Number(r.points)||1))})).sort(T.byPoints),
      activities:d.activities.map(a=>{
        const suds=a.suds===""||a.suds==null||isNaN(Number(a.suds))?null:Math.max(0,Math.min(100,Number(a.suds)));
        const old=p.config.activities.find(x=>x.id===a.id);
        // se o SUDS previsto mudou (ex.: psicóloga baixando a meta 100 → 75 → 50 conforme a
        // exposição avança), guarda o valor anterior com a data -- essa "escadinha" aparece
        // depois em Ativação comportamental, junto da evolução real relatada pela paciente.
        let sudsHistory=old&&Array.isArray(old.sudsHistory)?old.sudsHistory:[];
        if(old&&old.suds!==suds){
          if(!sudsHistory.length&&old.suds!=null)sudsHistory=[{date:null,value:old.suds}];
          sudsHistory=[...sudsHistory,{date:T.todayKey(),value:suds}];
        }
        return {id:a.id,name:String(a.name).trim()||"Atividade",suds,...(sudsHistory.length?{sudsHistory}:{})};
      }).sort(T.bySuds)
    };
    // um reforçador que ficou mais caro (ou sumiu) volta a poder ser comemorado dessa vez em diante;
    // nunca AUMENTA a contagem aqui — se baratear e passar a valer mais vezes, quem faz o app da
    // paciente perceber e comemorar é o próprio app dela, não o painel
    const total=T.totalPoints(config,S.days,p.point_offset);
    const celebrated={};
    for(const id in (p.celebrated||{})){
      const r=config.rewards.find(x=>x.id===id);
      if(!r)continue;
      const allowed=T.rewardCycle(r,total).times;
      const n=Math.min(p.celebrated[id]||0,allowed);
      if(n>0)celebrated[id]=n;
    }
    S.busy=true;
    const ok=await savePatient({config,celebrated},"Alterações salvas. O app dela atualiza na próxima vez que abrir.");
    S.busy=false;
    if(ok){S.draft=null;S.dirty=false;}
    render();return;
  }
});

document.addEventListener("input",e=>{
  const t=e.target;
  if(!S.draft)return;
  if(t.dataset.rw!=null)S.draft.rewards[Number(t.dataset.rw)][t.dataset.f]=t.value;
  else if(t.dataset.ac!=null)S.draft.activities[Number(t.dataset.ac)][t.dataset.f]=t.value;
  else if(t.id==="celeb")S.draft.celebration=t.value;
  else return;
  if(!S.dirty){
    const id=t.id,pos=t.selectionStart;
    markDirty();
    const el=document.getElementById(id);
    if(el){el.focus();try{if(el.type==="text")el.setSelectionRange(pos,pos);}catch(_){}}
  }
});

document.addEventListener("change",async e=>{
  // terminou de digitar pontos ou SUDS: a linha vai para o lugar dela na ordem crescente, sem perder o foco
  const f=e.target.dataset&&e.target.dataset.f;
  if(S.draft&&(f==="points"||f==="suds")){
    setTimeout(()=>{
      if(!S.draft)return;
      const a=document.activeElement,id=a&&a.id;
      sortDraft();render();
      const el=id&&document.getElementById(id);if(el)el.focus();
    },0);
    return;
  }
  if(e.target.id==="patient-select"){
    if(S.dirty){T.toast("Salve ou descarte as alterações antes de trocar de paciente.");e.target.value=S.current;return;}
    S.current=e.target.value;S.draft=null;S.confirm=null;S.importing=null;
    try{await loadDays();}catch(_){T.toast("Não consegui carregar o histórico.");}
    render();
  }
});

document.addEventListener("submit",async e=>{
  if(e.target.id==="login-form"){
    e.preventDefault();
    const btn=document.getElementById("login-btn"),er=document.getElementById("login-error");
    btn.disabled=true;er.hidden=true;
    const {error}=await sb.auth.signInWithPassword({email:document.getElementById("email").value.trim(),password:document.getElementById("password").value});
    btn.disabled=false;
    if(error){er.hidden=false;er.textContent="E-mail ou senha incorretos.";return;}
    showMain();
  }
  if(e.target.id==="new-form"){
    e.preventDefault();
    const name=document.getElementById("new-name").value.trim();if(!name)return;
    const np=document.getElementById("new-phone"),tel=np?normPhone(np.value):"";
    if(tel===null){T.toast(PHONE_ERR);np.focus();return;}
    const config={...(document.getElementById("new-template").checked?JSON.parse(JSON.stringify(T.DEFAULT_CONFIG)):T.EMPTY_CONFIG),tema:S.tema};
    S.busy=true;
    const {data,error}=await sb.from("patients").insert({name,config,...(tel?{telefone:tel}:{})}).select("id").single();
    S.busy=false;
    if(error){T.toast("Não consegui criar: "+error.message);return;}
    S.creating=false;S.current=data.id;S.tab="caso";S.ativTab="config";S.draft=null;window.TrilhaCase.setSection("ativacao");
    await refresh();T.toast("Paciente criada. Cadastre os reforçadores e as atividades.");
  }
});

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&!document.getElementById("main").hidden&&!S.dirty&&!S.lib&&S.tab==="caso"&&window.TrilhaCase.section()==="ativacao")refresh();
});

/* ---------- início ---------- */
async function showMain(){
  document.getElementById("login").hidden=true;
  document.getElementById("main").hidden=false;
  try{const {data}=await sb.auth.getUser();const md=data&&data.user&&data.user.user_metadata||{};S.tema=T.aplicarTema(md.tema);
    S.arq=new Set(Array.isArray(md.arquivados)?md.arquivados.map(String):[]);}catch(_){}
  document.getElementById("rail").hidden=false;document.getElementById("pv-toggle").hidden=false;document.body.classList.add("com-rail");setPrivado(privado());
  await refresh();
}
sb.auth.getSession().then(({data})=>{
  if(data&&data.session)showMain();
  else document.getElementById("login").hidden=false;
});
})();
