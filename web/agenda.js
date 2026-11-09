/* Agenda: o horário fixo de cada paciente (semanal ou quinzenal) gera as sessões do mês; desmarcar e sessão extra são exceções.
   Fica em tabelas próprias (agenda_*), fora da config: não vai para o app da paciente nem para a IA. O Financeiro usa a contagem
   de sessões daqui para cobrar quem paga no começo do mês pelas sessões daquele mês.
   Google Agenda, sem login no Google: as sessões vão para lá por um link secreto que o Google assina (função agenda, GET), e os
   compromissos dela no Google aparecem aqui pelo "endereço secreto iCal" que ela cola (a função lê o Google, porque o navegador
   não consegue; o ical.js expande as repetições). */
(function(){
"use strict";
const T=window.Trilha,esc=T.esc;
const hoje0=new Date();
const A={sb:null,pacientes:[],ano:hoje0.getFullYear(),mes:hoje0.getMonth(),aba:"mes",horarios:{},excecoes:[],
  carregado:false,erro:false,semTabela:false,pedido:0,busy:false,sel:null,
  cfg:{},semCfg:false,gcal:null,gErro:null,gCarregando:false,gPedido:0,confirmaLink:false};
const ICALJS="https://cdn.jsdelivr.net/npm/ical.js@1.5.0/build/ical.min.js";
const funcao=()=>window.TRILHA_CONFIG.SUPABASE_URL+"/functions/v1/agenda";
const linkSessoes=()=>A.cfg.feed_token?funcao()+"?t="+A.cfg.feed_token:"";
function novoCodigo(){
  const abc="ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789",b=new Uint8Array(32);crypto.getRandomValues(b);
  return [...b].map(x=>abc[x%abc.length]).join("");
}
const SEMANA=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const key=(a,m,d)=>T.todayKey(new Date(a,m,d));
const nomeMes=()=>new Date(A.ano,A.mes,1).toLocaleDateString("pt-BR",{month:"long"});
const ddmm=k=>k.slice(8,10)+"/"+k.slice(5,7);
const dias=(a,b)=>Math.round((T.keyDate(b)-T.keyDate(a))/864e5);
const nomeDe=id=>{const p=A.pacientes.find(x=>x.id===id);return p?p.name:"";};

/* ---------- as contas ---------- */
// as datas em que o horário fixo cai no mês (m de 0 a 11), a partir da primeira sessão
function datasFixas(h,ano,m){
  if(!h||!h.inicio)return [];
  const passo=h.frequencia==="quinzenal"?14:7,out=[],ult=new Date(ano,m+1,0).getDate();
  for(let d=1;d<=ult;d++){
    const k=key(ano,m,d),n=dias(h.inicio,k);
    if(n>=0&&n%passo===0)out.push(k);
  }
  return out;
}
// as sessões do mês de uma lista de horários: tira as desmarcadas, põe as extras
function sessoesDoMes(horarios,excecoes,ano,m){
  const a=key(ano,m,1),b=key(ano,m+1,0),no=x=>x.data>=a&&x.data<=b,out=[];
  const desm=new Set(excecoes.filter(x=>x.tipo==="desmarcada").map(x=>x.patient_id+"|"+x.data));
  Object.values(horarios).forEach(h=>datasFixas(h,ano,m).forEach(data=>{
    out.push({patient_id:h.patient_id,data,hora:h.hora||"",tipo:"fixa",desmarcada:desm.has(h.patient_id+"|"+data)});
  }));
  excecoes.filter(x=>x.tipo==="extra"&&no(x)).forEach(x=>out.push({patient_id:x.patient_id,data:x.data,hora:x.hora||"",tipo:"extra",id:x.id}));
  return out.sort((x,y)=>x.data<y.data?-1:x.data>y.data?1:x.hora<y.hora?-1:x.hora>y.hora?1:0);
}
// quantas sessões a paciente tem no mês (para o Financeiro); null se ela não tem horário na agenda
function contar(horario,excecoes,ano,m){
  if(!horario)return null;
  return sessoesDoMes({x:horario},excecoes.filter(e=>e.patient_id===horario.patient_id),ano,m).filter(s=>!s.desmarcada).length;
}

/* ---------- dados ---------- */
async function pedir(q){const {data,error}=await q;if(error)throw error;return data||[];}
async function carregar(){
  const pedido=++A.pedido;
  try{
    const [hs,ex]=await Promise.all([
      pedir(A.sb.from("agenda_horarios").select("patient_id,frequencia,inicio,hora")),
      pedir(A.sb.from("agenda_excecoes").select("id,patient_id,data,tipo,hora"))
    ]);
    if(pedido!==A.pedido)return;
    const ativas=new Set(A.pacientes.map(p=>p.id));
    A.horarios=Object.fromEntries(hs.filter(h=>ativas.has(h.patient_id)).map(h=>[h.patient_id,{...h,hora:String(h.hora||"").slice(0,5)}]));
    A.excecoes=ex.filter(x=>ativas.has(x.patient_id)).map(x=>({...x,hora:String(x.hora||"").slice(0,5)}));
    A.erro=false;A.semTabela=false;A.carregado=true;
    // a configuração do Google é à parte: banco sem a tabela ainda não impede a agenda
    try{const c=await pedir(A.sb.from("agenda_config").select("feed_token,duracao,google_url"));A.cfg=c[0]||{};A.semCfg=false;}catch(_){A.cfg={};A.semCfg=true;}
    if(pedido!==A.pedido)return;
    if(A.cfg.google_url&&!A.gcal&&!A.gCarregando)lerGoogle();
  }catch(e){
    if(pedido!==A.pedido)return;
    A.semTabela=e&&(e.code==="42P01"||e.code==="PGRST205"||/agenda_|schema cache|does not exist/.test(e.message||""));
    A.erro=true;
  }
  pintar();
}
async function gravar(q,okMsg){
  if(A.busy)return false;
  A.busy=true;let error;
  try{({error}=await q);}catch(x){error=x;}
  A.busy=false;
  if(error){T.toast("Não consegui salvar. Confira a internet e tente de novo.");return false;}
  if(okMsg)T.toast(okMsg);
  await carregar();
  return true;
}

/* ---------- compromissos do Google ---------- */
let icalPronto=null;
function carregaIcal(){
  if(window.ICAL)return Promise.resolve(window.ICAL);
  if(!icalPronto)icalPronto=new Promise((res,rej)=>{const sc=document.createElement("script");sc.src=ICALJS;sc.onload=()=>res(window.ICAL);sc.onerror=()=>{icalPronto=null;rej(new Error("ical"));};document.head.appendChild(sc);});
  return icalPronto;
}
const G_ERROS={"sem-endereco":"Cole o endereço secreto da sua agenda do Google.","endereco":"Esse endereço não é o endereço secreto no formato iCal do Google. Copie de novo.",
  "google-404":"O Google não reconheceu o endereço. Ele muda se você redefinir o endereço secreto: copie o novo.","grande":"A agenda do Google é grande demais para ler aqui.",
  "login":"Sua sessão expirou. Saia e entre de novo."};
async function lerGoogle(){
  const pedido=++A.gPedido;A.gCarregando=true;A.gErro=null;pintar();
  try{
    const ICAL=await carregaIcal();
    const {data}=await A.sb.auth.getSession(),tok=data&&data.session&&data.session.access_token;
    const r=await fetch(funcao(),{method:"POST",headers:{authorization:"Bearer "+tok,apikey:window.TRILHA_CONFIG.SUPABASE_ANON_KEY,"content-type":"application/json"},body:"{}"});
    if(!r.ok){let j={};try{j=await r.json();}catch(_){}throw new Error(j.erro||"google");}
    const comp=new ICAL.Component(ICAL.parse(await r.text()));
    comp.getAllSubcomponents("vtimezone").forEach(tz=>{try{ICAL.TimezoneService.register(tz);}catch(_){}});
    const evs=comp.getAllSubcomponents("vevent").map(v=>new ICAL.Event(v));
    // as alterações de um dia de um evento repetido entram no evento principal
    const base=evs.filter(e=>!e.isRecurrenceException()),porUid={};base.forEach(e=>{porUid[e.uid]=e;});
    evs.filter(e=>e.isRecurrenceException()).forEach(e=>{const b=porUid[e.uid];if(b)b.relateException(e);else base.push(e);});
    if(pedido!==A.gPedido)return;
    A.gcal=base;
  }catch(e){
    if(pedido!==A.gPedido)return;
    A.gcal=null;A.gErro=G_ERROS[e&&e.message]||"Não consegui ler a sua agenda do Google agora. Confira a internet e tente de novo.";
  }
  A.gCarregando=false;pintar();
}
const hm=d=>String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
// os compromissos do Google no mês: {data,hora,titulo}; os de dia inteiro aparecem em cada dia
function googleDoMes(ano,m){
  if(!A.gcal)return [];
  const ini=new Date(ano,m,1),fim=new Date(ano,m+1,1),out=[];
  const cancelado=it=>String(it.component.getFirstPropertyValue("status")||"").toUpperCase()==="CANCELLED";
  const poe=(it,st,en)=>{
    if(cancelado(it))return;
    const titulo=it.summary||"(sem título)";
    if(st.isDate){
      for(let d=st.toJSDate(),e=en.toJSDate();d<e&&d<fim;d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1))
        if(d>=ini)out.push({data:T.todayKey(d),hora:"",titulo});
      return;
    }
    const d=st.toJSDate();if(d>=ini&&d<fim)out.push({data:T.todayKey(d),hora:hm(d),titulo});
  };
  for(const ev of A.gcal){
    try{
      if(!ev.isRecurring()){if(ev.startDate)poe(ev,ev.startDate,ev.endDate||ev.startDate);continue;}
      const it=ev.iterator();let t,n=0;
      while((t=it.next())&&n++<5000){
        if(t.toJSDate()>=fim)break;
        const det=ev.getOccurrenceDetails(t);
        if(det.endDate.toJSDate()<=ini&&!(det.startDate.isDate&&det.startDate.toJSDate()>=ini))continue;
        poe(det.item,det.startDate,det.endDate);
      }
    }catch(_){}
  }
  return out.sort((x,y)=>x.data<y.data?-1:x.data>y.data?1:x.hora<y.hora?-1:x.hora>y.hora?1:0);
}

/* ---------- tela ---------- */
function chipHTML(s){
  const nome=nomeDe(s.patient_id),sel=A.sel&&A.sel.patient_id===s.patient_id&&A.sel.data===s.data&&A.sel.tipo===s.tipo;
  return '<button class="ag-sessao'+(s.desmarcada?" desmarcada":"")+(s.tipo==="extra"?" extra":"")+'" data-ag="sel" data-p="'+esc(s.patient_id)+'" data-d="'+s.data+'" data-t="'+s.tipo+'" aria-pressed="'+!!sel+'">'+
    (s.hora?'<span class="ag-hora">'+esc(s.hora)+'</span> ':'')+'<span data-pv>'+esc(nome)+'</span></button>';
}
function mesHTML(){
  const ss=sessoesDoMes(A.horarios,A.excecoes,A.ano,A.mes),ini=new Date(A.ano,A.mes,1).getDay(),ult=new Date(A.ano,A.mes+1,0).getDate(),hoje=T.todayKey();
  const porDia={},gDia={};ss.forEach(s=>{(porDia[s.data]=porDia[s.data]||[]).push(s);});
  googleDoMes(A.ano,A.mes).forEach(g=>{(gDia[g.data]=gDia[g.data]||[]).push(g);});
  const n=ss.filter(s=>!s.desmarcada).length;
  let cel='';
  for(let i=0;i<ini;i++)cel+='<div class="ag-dia vazio" aria-hidden="true"></div>';
  for(let d=1;d<=ult;d++){
    const k=key(A.ano,A.mes,d),lista=porDia[k]||[],gs=gDia[k]||[];
    cel+='<div class="ag-dia'+(k===hoje?" hoje":"")+(lista.length||gs.length?"":" sem")+'"><span class="ag-num">'+d+'<span class="ag-sem"> · '+SEMANA[new Date(A.ano,A.mes,d).getDay()]+'</span></span>'+lista.map(chipHTML).join("")+
      gs.map(g=>'<span class="ag-google">'+(g.hora?'<span class="ag-hora">'+esc(g.hora)+'</span> ':'')+'<span data-pv>'+esc(g.titulo)+'</span></span>').join("")+'</div>';
  }
  return (Object.keys(A.horarios).length||A.excecoes.length?'<p class="hint">'+(n===1?"1 sessão":n+" sessões")+' em '+nomeMes()+'. Toque numa sessão para desmarcar.</p>'
      :'<div class="fin-aviso"><span>Cadastre o horário de cada paciente para as sessões aparecerem aqui.</span><button class="btn cx-small" data-ag="aba" data-arg="horarios">Cadastrar horários</button></div>')+
    (A.cfg.google_url?'<p class="hint ag-g-status">'+(A.gCarregando?'Lendo a sua agenda do Google…':A.gErro?esc(A.gErro)+' <button class="linkish" data-ag="g-ler">Tentar de novo</button>':'<span class="ag-g-leg"></span> Em cinza, os compromissos da sua agenda do Google. <button class="linkish" data-ag="g-ler">Atualizar</button>')+'</p>':'')+
    selHTML()+
    '<div class="ag-grade"><div class="ag-cab" aria-hidden="true">'+SEMANA.map(x=>'<span>'+x.slice(0,3)+'</span>').join("")+'</div><div class="ag-dias">'+cel+'</div></div>'+extraHTML();
}
function selHTML(){
  const s=A.sel;if(!s)return "";
  const titulo='<b data-pv>'+esc(nomeDe(s.patient_id))+'</b> · '+ddmm(s.data)+(s.hora?' às '+esc(s.hora):'');
  const ex=s.tipo==="extra"?A.excecoes.find(x=>x.id===s.id):A.excecoes.find(x=>x.tipo==="desmarcada"&&x.patient_id===s.patient_id&&x.data===s.data);
  return '<div class="ag-sel"><span>'+titulo+(s.tipo==="extra"?' <span class="muted">· sessão extra</span>':ex?' <span class="muted">· desmarcada</span>':'')+'</span><span class="btns">'+
    (s.tipo==="extra"?'<button class="btn ghost cx-small" data-ag="apagar-extra">Tirar a sessão extra</button>':ex?'<button class="btn ghost cx-small" data-ag="remarcar">Voltar a marcar</button>':'<button class="btn ghost cx-small" data-ag="desmarcar">Desmarcar esta sessão</button>')+
    '<button class="btn ghost cx-small" data-ag="fechar">Fechar</button></span></div>';
}
function extraHTML(){
  if(!A.pacientes.length)return "";
  return '<form class="fin-form" id="ag-form-extra"><h4>Sessão extra ou remarcada</h4><div class="fin-campos">'+
    '<label>Paciente<select id="ag-ex-pac" required><option value="">Escolha…</option>'+A.pacientes.map(p=>'<option value="'+esc(p.id)+'" data-pv>'+esc(p.name)+'</option>').join("")+'</select></label>'+
    '<label>Data<input type="date" id="ag-ex-data" required></label><label>Hora<input type="time" id="ag-ex-hora"></label></div>'+
    '<p class="hint">Para remarcar: desmarque a sessão no calendário e coloque aqui o dia novo.</p>'+
    '<div class="btns"><button class="btn" type="submit">Adicionar</button></div></form>';
}
function horariosHTML(){
  if(!A.pacientes.length)return '<p class="hint">Nenhuma paciente cadastrada ainda.</p>';
  return '<p class="hint">A data da primeira sessão dá o dia da semana e, no quinzenal, de qual semana ela é. Salva sozinho. Mudar aqui não altera o que já foi lançado no Financeiro.</p>'+
    '<ul class="ag-horarios">'+A.pacientes.map(p=>{
      const h=A.horarios[p.id]||{},semana=h.inicio?SEMANA[T.keyDate(h.inicio).getDay()]:"";
      return '<li><span class="fin-v-nome" data-pv>'+esc(p.name)+'</span>'+
        '<label>Frequência<select data-ag-freq="'+esc(p.id)+'"><option value="semanal"'+(h.frequencia!=="quinzenal"?" selected":"")+'>Semanal</option><option value="quinzenal"'+(h.frequencia==="quinzenal"?" selected":"")+'>Quinzenal</option></select></label>'+
        '<label>Primeira sessão<input type="date" data-ag-inicio="'+esc(p.id)+'" value="'+esc(h.inicio||"")+'"></label>'+
        '<label>Hora<input type="time" data-ag-hora="'+esc(p.id)+'" value="'+esc(h.hora||"")+'"></label>'+
        '<span class="ag-semana muted">'+(semana?semana+"s":"Sem horário")+'</span>'+
        (h.inicio?'<button class="btn ghost cx-small" data-ag="sem-horario" data-arg="'+esc(p.id)+'">Tirar da agenda</button>':'')+'</li>';
    }).join("")+'</ul>';
}
function googleHTML(){
  if(A.semCfg)return '<p class="hint">Falta preparar o banco de dados: rode o arquivo supabase/schema.sql no SQL Editor do Supabase e abra esta tela de novo.</p>';
  const c=A.cfg,link=linkSessoes(),dur=[30,40,45,50,60,90].includes(Number(c.duracao))?Number(c.duracao):50;
  return '<h4 class="fin-tit">Suas sessões no Google Agenda</h4>'+
    (link?'<p class="hint">Cole este link no Google Agenda para as sessões aparecerem lá, com o nome da paciente. Quem tiver o link vê os nomes e os horários: não envie para ninguém. Se ele vazar, gere um link novo.</p>'+
      '<div class="linkbox" id="ag-link">'+esc(link)+'</div>'+
      '<div class="btns"><button class="btn" data-ag="g-copiar">Copiar link</button>'+
        (A.confirmaLink?'<button class="btn warn cx-small" data-ag="g-novo-sim">Confirmar: o link antigo para de funcionar</button><button class="btn ghost cx-small" data-ag="g-novo-nao">Cancelar</button>'
          :'<button class="btn ghost cx-small" data-ag="g-novo">Gerar um link novo</button><button class="btn ghost cx-small" data-ag="g-desligar">Desligar</button>')+'</div>'+
      '<ol class="ag-passos"><li>No computador, abra o Google Agenda.</li><li>À esquerda, em <b>Outras agendas</b>, clique em <b>+</b> e escolha <b>Do URL</b>.</li><li>Cole o link e clique em <b>Adicionar agenda</b>.</li></ol>'+
      '<p class="hint">O Google atualiza essa agenda sozinho, mas pode levar algumas horas para mostrar uma mudança feita aqui.</p>'+
      '<label class="ag-dur">Duração de cada sessão no Google<select id="ag-dur">'+[30,40,45,50,60,90].map(n=>'<option value="'+n+'"'+(n===dur?" selected":"")+'>'+n+' minutos</option>').join("")+'</select></label>'
    :'<p class="hint">Gera um link secreto que o Google Agenda assina: as sessões daqui (horários fixos, desmarcadas e extras) aparecem lá numa agenda separada, com o nome da paciente.</p>'+
      '<div class="btns"><button class="btn" data-ag="g-criar">Criar o link para o Google</button></div>')+
    '<h4 class="fin-tit">Seus compromissos do Google aqui</h4>'+
    '<p class="hint">Cole o endereço secreto da sua agenda do Google: os compromissos dela aparecem em cinza no calendário daqui, junto das sessões. Só leitura: nada muda no Google.</p>'+
    '<form id="ag-form-google" class="ag-google-form"><input type="url" id="ag-google-url" autocomplete="off" spellcheck="false" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" value="'+esc(c.google_url||"")+'" aria-label="Endereço secreto no formato iCal">'+
      '<button class="btn" type="submit">Salvar</button>'+(c.google_url?'<button class="btn ghost" type="button" data-ag="g-tirar">Remover</button>':'')+'</form>'+
    (c.google_url?'<p class="hint">'+(A.gCarregando?'Lendo…':A.gErro?esc(A.gErro):A.gcal?'Lido. '+googleDoMes(A.ano,A.mes).length+' compromissos em '+nomeMes()+'.':'')+'</p>':'')+
    '<ol class="ag-passos"><li>No Google Agenda (no computador), clique na engrenagem e em <b>Configurações</b>.</li><li>À esquerda, em <b>Configurações das minhas agendas</b>, clique na sua agenda.</li>'+
      '<li>Em <b>Integrar agenda</b>, copie o <b>Endereço secreto no formato iCal</b> e cole aqui.</li></ol>'+
    '<p class="hint">Use o endereço da sua agenda, não o da agenda de sessões criada pelo link acima (senão as sessões aparecem duas vezes).</p>';
}
function conteudo(){
  if(A.semTabela)return '<section class="panel"><h3>Agenda</h3><p class="hint">Falta preparar o banco de dados: rode o arquivo supabase/schema.sql no SQL Editor do Supabase e abra esta tela de novo.</p></section>';
  if(A.erro)return '<section class="panel"><h3>Agenda</h3><p class="hint">Não consegui carregar. Confira a internet.</p></section>';
  if(!A.carregado)return '<section class="panel"><h3>Agenda</h3><p class="hint">Carregando…</p></section>';
  return '<section class="panel"><div class="fin-topo"><h3>Agenda</h3>'+
      (A.aba==="mes"?'<div class="fin-nav"><button class="btn ghost cx-small" data-ag="mes" data-arg="-1" aria-label="Mês anterior">‹</button><b aria-live="polite">'+nomeMes()+' de '+A.ano+'</b><button class="btn ghost cx-small" data-ag="mes" data-arg="1" aria-label="Próximo mês">›</button></div>':'')+'</div>'+
    '<div class="tabs" role="tablist">'+[["mes","Calendário"],["horarios","Horários fixos"],["google","Google Agenda"]].map(([k,l])=>'<button class="tab" role="tab" data-ag="aba" data-arg="'+k+'" aria-selected="'+(A.aba===k)+'">'+l+'</button>').join("")+'</div>'+
    (A.aba==="horarios"?horariosHTML():A.aba==="google"?googleHTML():mesHTML())+'</section>';
}
function pintar(){const el=document.getElementById("ag-root");if(el)el.innerHTML=conteudo();}

/* ---------- ações ---------- */
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-ag]");if(!b||A.busy)return;
  const act=b.dataset.ag,arg=b.dataset.arg;
  if(act==="mes"){const d=new Date(A.ano,A.mes+Number(arg),1);A.ano=d.getFullYear();A.mes=d.getMonth();A.sel=null;pintar();return;}
  if(act==="aba"){A.aba=arg;A.sel=null;pintar();return;}
  if(act==="fechar"){A.sel=null;pintar();return;}
  if(act==="g-ler"){A.gcal=null;lerGoogle();return;}
  if(act==="g-criar"||act==="g-novo-sim"){A.confirmaLink=false;await gravarCfg({feed_token:novoCodigo()},act==="g-criar"?"Link criado. Agora cole no Google Agenda.":"Link novo criado. Troque no Google Agenda: o antigo parou de funcionar.");return;}
  if(act==="g-novo"){A.confirmaLink=true;pintar();return;}
  if(act==="g-novo-nao"){A.confirmaLink=false;pintar();return;}
  if(act==="g-desligar"){await gravarCfg({feed_token:null},"Link desligado. A agenda de sessões no Google para de atualizar; você pode removê-la de lá.");return;}
  if(act==="g-tirar"){A.gcal=null;A.gErro=null;await gravarCfg({google_url:null},"Endereço removido.");return;}
  if(act==="g-copiar"){
    const t=linkSessoes();
    try{await navigator.clipboard.writeText(t);T.toast("Link copiado.");}
    catch(_){const el=document.getElementById("ag-link"),r=document.createRange();r.selectNodeContents(el);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);T.toast("Selecionei o link. Copie com Ctrl+C.");}
    return;
  }
  if(act==="sel"){
    const s=sessoesDoMes(A.horarios,A.excecoes,A.ano,A.mes).find(x=>x.patient_id===b.dataset.p&&x.data===b.dataset.d&&x.tipo===b.dataset.t);
    A.sel=s||null;pintar();return;
  }
  const s=A.sel;
  if(act==="desmarcar"&&s){A.sel=null;await gravar(A.sb.from("agenda_excecoes").insert({patient_id:s.patient_id,data:s.data,tipo:"desmarcada"}),"Sessão desmarcada");return;}
  if(act==="remarcar"&&s){
    const ex=A.excecoes.find(x=>x.tipo==="desmarcada"&&x.patient_id===s.patient_id&&x.data===s.data);A.sel=null;
    if(ex)await gravar(A.sb.from("agenda_excecoes").delete().eq("id",ex.id),"Sessão marcada de novo");
    return;
  }
  if(act==="apagar-extra"&&s){A.sel=null;await gravar(A.sb.from("agenda_excecoes").delete().eq("id",s.id),"Sessão extra retirada");return;}
  if(act==="sem-horario"){await gravar(A.sb.from("agenda_horarios").delete().eq("patient_id",arg),"Horário retirado");}
});
// grava a configuração da agenda (uma linha por conta)
async function gravarCfg(campos,okMsg){
  if(A.busy)return false;
  A.busy=true;let error;
  try{({error}=await A.sb.from("agenda_config").upsert({...A.cfg,...campos},{onConflict:"owner"}));}catch(x){error=x;}
  A.busy=false;
  if(error){T.toast("Não consegui salvar. Confira a internet e tente de novo.");return false;}
  A.cfg={...A.cfg,...campos};pintar();
  if(okMsg)T.toast(okMsg);
  return true;
}
document.addEventListener("submit",async e=>{
  if(e.target.id==="ag-form-google"){
    e.preventDefault();if(A.busy)return;
    const u=document.getElementById("ag-google-url").value.trim();
    if(!/^https:\/\/calendar\.google\.com\/calendar\/ical\/[^\s/]+\/[^\s/]+\/basic\.ics$/.test(u)){T.toast("Esse não é o endereço secreto no formato iCal do Google. Ele começa com https://calendar.google.com/calendar/ical/ e termina com basic.ics.");return;}
    if(await gravarCfg({google_url:u},"Endereço salvo. Lendo a sua agenda do Google…")){A.gcal=null;lerGoogle();}
    return;
  }
  if(e.target.id!=="ag-form-extra")return;
  e.preventDefault();if(A.busy)return;
  const v=id=>document.getElementById(id).value;
  await gravar(A.sb.from("agenda_excecoes").insert({patient_id:v("ag-ex-pac"),data:v("ag-ex-data"),tipo:"extra",hora:v("ag-ex-hora")||null}),"Sessão adicionada");
});
document.addEventListener("change",async e=>{
  if(e.target.id==="ag-dur"){await gravarCfg({duracao:Number(e.target.value)},"Duração salva.");return;}
  const ds=e.target.dataset||{},pid=ds.agFreq||ds.agInicio||ds.agHora;if(!pid)return;
  const li=e.target.closest("li"),inicio=li.querySelector("[data-ag-inicio]").value;
  if(!inicio){if(ds.agInicio&&A.horarios[pid])T.toast("Para tirar da agenda, use o botão ao lado.");return;} // sem a primeira sessão não dá para calcular as datas
  await gravar(A.sb.from("agenda_horarios").upsert({patient_id:pid,frequencia:li.querySelector("[data-ag-freq]").value,inicio,hora:li.querySelector("[data-ag-hora]").value||null},{onConflict:"patient_id"}));
});

window.TrilhaAgenda={
  contar,sessoesDoMes,datasFixas,
  html(){return '<div id="ag-root" style="display:flex;flex-direction:column;gap:18px">'+conteudo()+'</div>';},
  // o que já veio do Google fica guardado ao voltar para a tela (Atualizar busca de novo)
  mount(ctx){A.sb=ctx.sb;A.pacientes=ctx.pacientes;A.sel=null;A.confirmaLink=false;carregar();}
};
})();
