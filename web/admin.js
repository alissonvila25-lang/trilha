/* Painel da psicóloga: login no Supabase, cadastro de pacientes, reforçadores, atividades e pontos. */
(function(){
"use strict";
const T=window.Trilha,CFG=window.TRILHA_CONFIG;
const sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);

const S={
  patients:[],current:null,days:{},realidade:{},tab:"resumo",
  draft:null,dirty:false,confirm:null,creating:false,busy:false
};
const cur=()=>S.patients.find(p=>p.id===S.current)||null;
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

/* ---------- dados ---------- */
async function loadPatients(){
  const {data,error}=await sb.from("patients").select("id,name,token,config,point_offset,celebrated,created_at").order("created_at");
  if(error)throw error;
  S.patients=data.map(p=>({...p,config:T.normConfig(p.config)}));
  if(!cur())S.current=S.patients[0]?S.patients[0].id:null;
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
  const {error}=await sb.from("patients").update(fields).eq("id",p.id);
  if(error){T.toast("Não consegui salvar: "+error.message);return false;}
  Object.assign(p,fields);if(fields.config)p.config=T.normConfig(fields.config);
  if(okMsg)T.toast(okMsg);
  return true;
}

/* ---------- telas ---------- */
function render(){
  const main=document.getElementById("main");
  const p=cur();
  const opts=S.patients.map(x=>'<option value="'+x.id+'"'+(x.id===S.current?" selected":"")+'>'+T.esc(x.name)+'</option>').join("");
  let html='<div class="topbar">'+
    (S.patients.length?'<select id="patient-select" aria-label="Paciente">'+opts+'</select>':'<span class="muted" style="flex:1">Nenhum paciente cadastrado ainda.</span>')+
    (p?'<button class="btn ghost" data-act="edit-patient" title="Trocar o nome ou excluir esta paciente">✎ Editar/excluir</button>':"")+
    '<button class="btn ghost" data-act="new">+ Paciente</button><button class="btn ghost" data-act="refresh" aria-label="Atualizar">Atualizar</button>'+
    '<button class="btn ghost" data-act="logout">Sair</button></div>';
  if(S.creating){
    html+='<form class="panel" id="new-form"><h3>Novo paciente</h3>'+
      '<label>Como o app vai chamar a paciente<input type="text" id="new-name" maxlength="80" placeholder="Primeiro nome ou apelido" required></label>'+
      '<p class="hint">Aparece no topo do app dela ("Olá, …"). Use só o primeiro nome ou um apelido.</p>'+
      '<label style="flex-direction:row;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="new-template" checked style="width:auto">'+
      'Já começar com a hierarquia e os reforçadores da Escala SUDS</label>'+
      '<p class="hint">Preenche com a lista que vocês já cadastraram. Dá para editar ou apagar itens depois, em Configurar — inclusive para outra paciente com uma lista diferente.</p>'+
      '<div class="btns"><button class="btn" type="submit">Criar</button><button class="btn ghost" type="button" data-act="cancel-new">Cancelar</button></div></form>';
  }
  if(p){
    html+='<div class="tabs" role="tablist">'+[["resumo","Resumo"],["config","Configurar"],["acesso","Paciente"]].map(([k,l])=>
      '<button class="tab" role="tab" data-tab="'+k+'" aria-selected="'+(S.tab===k)+'">'+l+'</button>').join("")+'</div>';
    html+=S.tab==="config"?configHTML(p):S.tab==="acesso"?accessHTML(p):summaryHTML(p);
  }
  main.innerHTML=html;
  if(p&&S.tab==="acesso")drawQR(p);
  const nn=document.getElementById("new-name");if(nn)nn.focus();
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
    '<div style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow">Pontos por dia · últimos 14 dias</span>'+T.weekHTML(p.config,S.days,14)+'</div>'+
    (hist.length?'<div class="panel"><h3>Evolução por atividade</h3>'+
      '<p class="hint">Como ela avaliou cada vez que fez, na ordem em que aconteceu. Se os números forem caindo, é sinal de que a ansiedade real está diminuindo com a exposição.</p>'+
      '<div>'+hist.map(h=>'<div class="evo-row"><div class="evo-head"><span class="evo-name">'+T.esc(h.name)+'</span>'+
        (h.suds!=null?'<span class="muted" style="font-size:12px">SUDS previsto '+h.suds+'</span>':'')+'</div>'+
        '<div class="evo-track">'+h.points.map(pt=>'<span class="evo-dot '+T.sudsClass(pt.value)+'" title="'+T.esc(T.dayLabel(pt.day))+': '+T.esc(T.realidadeShort(pt.value))+'">'+pt.value+'</span>').join('<span class="evo-arrow">→</span>')+'</div></div>').join("")+
      '</div></div>':"")+
    '<div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Reforçadores</span>'+T.rewardsHTML(p.config,total)+'</div>';
}

function configHTML(p){
  if(!S.draft){S.draft=JSON.parse(JSON.stringify(p.config));S.dirty=false;}
  const d=S.draft,total=T.totalPoints(p.config,S.days,p.point_offset);
  const cf=S.confirm;
  return '<div class="panel"><h3>Reforçadores</h3><p class="hint">Nome e quantos pontos ela precisa acumular. O aviso de "falta pouco" sai faltando 5 pontos (até 99) ou 10 pontos (100 ou mais).</p>'+
    '<div class="list">'+d.rewards.map((r,i)=>'<div class="row"><input type="text" id="rn-'+T.esc(r.id)+'" data-rw="'+i+'" data-f="name" value="'+T.esc(r.name)+'" aria-label="Nome do reforçador">'+
      '<input type="number" id="rp-'+T.esc(r.id)+'" min="1" data-rw="'+i+'" data-f="points" value="'+T.esc(r.points)+'" aria-label="Pontos"><button class="icon-btn" data-del-rw="'+i+'" aria-label="Remover reforçador">×</button></div>').join("")+'</div>'+
    '<div class="btns"><button class="btn ghost" data-add="rw">+ Reforçador</button><button class="btn ghost" data-import-open="rw">Colar lista</button></div>'+
    (S.importing==="rw"?importHTML("rw","Um por linha: nome e pontos separados por ponto e vírgula ou tabulação (dá para copiar duas colunas do Excel).\nEx.: Comer uma sobremesa; 25"):"")+'</div>'+

    '<div class="panel"><h3>Atividades da hierarquia</h3><p class="hint">Cada atividade feita no dia vale 1 ponto. O número é o SUDS previsto (0 a 100), opcional.</p>'+
    '<div class="list">'+d.activities.map((a,i)=>'<div class="row"><input type="text" id="an-'+T.esc(a.id)+'" data-ac="'+i+'" data-f="name" value="'+T.esc(a.name)+'" aria-label="Atividade">'+
      '<input type="number" id="as-'+T.esc(a.id)+'" min="0" max="100" step="5" data-ac="'+i+'" data-f="suds" value="'+(a.suds==null?"":T.esc(a.suds))+'" placeholder="SUDS" aria-label="SUDS"><button class="icon-btn" data-del-ac="'+i+'" aria-label="Remover atividade">×</button></div>').join("")+'</div>'+
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
function importHTML(kind,help){
  return '<div style="display:flex;flex-direction:column;gap:8px"><textarea id="import-text" placeholder="'+T.esc(help)+'"></textarea>'+
    '<div class="btns"><button class="btn" data-import="'+kind+'">Adicionar à lista</button><button class="btn ghost" data-import-open="">Fechar</button></div></div>';
}

function patientLink(p){return new URL("./?p="+p.token,location.href).href;}
function accessHTML(p){
  const cf=S.confirm;
  return '<div class="panel"><h3>Editar ou excluir</h3>'+
    '<div class="btns"><input type="text" id="rename" value="'+T.esc(p.name)+'" maxlength="80" style="flex:1" aria-label="Nome"><button class="btn ghost" data-act="rename">Salvar nome</button></div>'+
    '<p class="hint">Excluir apaga a paciente e todo o histórico dela. Não dá para desfazer.</p>'+
    '<div class="btns">'+(cf==="delete"?'<button class="btn warn" data-confirm="delete">Confirmar: excluir '+T.esc(p.name)+'</button><button class="btn ghost" data-confirm="no">Cancelar</button>':'<button class="btn ghost" data-ask="delete">Excluir paciente</button>')+'</div></div>'+
    '<div class="panel"><h3>Link da paciente</h3>'+
    '<p class="hint">Envie este link para ela (WhatsApp, por exemplo) ou mostre o QR code na consulta. Ela não precisa criar conta. Depois de abrir, é só instalar na tela inicial.</p>'+
    '<div class="linkbox" id="plink">'+T.esc(patientLink(p))+'</div>'+
    '<div class="btns"><button class="btn" data-act="copy">Copiar link</button><span class="muted" style="font-size:14px">Código: <b style="letter-spacing:.08em">'+T.esc(p.token)+'</b></span></div>'+
    '<div class="qr" id="qr"></div>'+
    '<p class="hint">Quem tiver esse link consegue abrir o app dela. Se ele vazar, gere um código novo: o link antigo para de funcionar e você envia o novo.</p>'+
    '<div class="btns">'+(cf==="token"?'<button class="btn warn" data-confirm="token">Confirmar: trocar código</button><button class="btn ghost" data-confirm="no">Cancelar</button>':'<button class="btn ghost" data-ask="token">Gerar novo código</button>')+'</div></div>';
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
  if(ds.tab||ds.act==="edit-patient"){
    const tab=ds.tab||"acesso";
    if(S.dirty&&tab!=="config"){T.toast("Salve ou descarte as alterações antes de sair de Configurar.");return;}
    S.tab=tab;S.confirm=null;S.importing=null;if(tab==="config"&&!S.dirty)S.draft=null;
    if(tab==="resumo")await refresh();else render();return;
  }
  if(ds.act==="new"){S.creating=true;render();return;}
  if(ds.act==="cancel-new"){S.creating=false;render();return;}
  if(ds.act==="refresh"){await refresh();T.toast("Atualizado");return;}
  if(ds.act==="logout"){await sb.auth.signOut();location.reload();return;}
  if(ds.act==="copy"){
    const link=patientLink(p);
    try{await navigator.clipboard.writeText(link);T.toast("Link copiado");}
    catch(_){const r=document.createRange();r.selectNodeContents(document.getElementById("plink"));const s=getSelection();s.removeAllRanges();s.addRange(r);T.toast("Selecionei o link. Copie com Ctrl+C.");}
    return;
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
    T.toast("Paciente excluída");S.current=null;S.tab="resumo";await refresh();return;
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
    S.importing=null;S.dirty=true;render();T.toast(rows.length+" itens adicionados. Confira e salve.");return;
  }
  if(ds.draft==="discard"){S.draft=null;S.dirty=false;render();return;}
  if(ds.draft==="save"){
    const d=S.draft;
    const config={
      celebration:d.celebration||"auto",
      rewards:d.rewards.map(r=>({id:r.id,name:String(r.name).trim()||"Reforçador",points:Math.max(1,Math.round(Number(r.points)||1))})),
      activities:d.activities.map(a=>({id:a.id,name:String(a.name).trim()||"Atividade",
        suds:a.suds===""||a.suds==null||isNaN(Number(a.suds))?null:Math.max(0,Math.min(100,Number(a.suds)))}))
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
    const config=document.getElementById("new-template").checked?JSON.parse(JSON.stringify(T.DEFAULT_CONFIG)):T.EMPTY_CONFIG;
    S.busy=true;
    const {data,error}=await sb.from("patients").insert({name,config}).select("id").single();
    S.busy=false;
    if(error){T.toast("Não consegui criar: "+error.message);return;}
    S.creating=false;S.current=data.id;S.tab="config";S.draft=null;
    await refresh();T.toast("Paciente criada. Cadastre os reforçadores e as atividades.");
  }
});

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&!document.getElementById("main").hidden&&!S.dirty&&S.tab==="resumo")refresh();
});

/* ---------- início ---------- */
async function showMain(){
  document.getElementById("login").hidden=true;
  document.getElementById("main").hidden=false;
  await refresh();
}
sb.auth.getSession().then(({data})=>{
  if(data&&data.session)showMain();
  else document.getElementById("login").hidden=false;
});
})();
