/* Financeiro da psicóloga: o que entra (sessões, faltas cobradas, mensalidades) e o que sai (despesas), mês a mês.
   Fica em tabelas próprias (fin_*), separadas do caso e da config: não vai para o prontuário, para o app da paciente
   nem para a IA. Cada conta vê só o que é dela (RLS por owner). A regra de cobrar falta é de cada psicóloga: aqui ela
   só marca "falta cobrada" quando for o caso. Recebido conta pela data em que o dinheiro entrou; despesa, pela data dela. */
(function(){
"use strict";
const T=window.Trilha,esc=T.esc;
const hoje0=new Date();
const F={sb:null,pacientes:[],todas:[],ano:hoje0.getFullYear(),mes:hoje0.getMonth(),aba:"receitas",
  dados:null,valores:{},despAnt:[],erro:false,semTabela:false,pedido:0,busy:false,editar:null,apagar:null};
const COLS="id,tipo,patient_id,data,valor,pago_em,descricao";
const TIPOS={sessao:"Sessão",falta:"Falta cobrada",mensalidade:"Mensalidade",despesa:"Despesa"};

const key=(a,m,d)=>T.todayKey(new Date(a,m,d));
const ini=()=>key(F.ano,F.mes,1),fim=()=>key(F.ano,F.mes+1,0);
const nomeMes=()=>new Date(F.ano,F.mes,1).toLocaleDateString("pt-BR",{month:"long"});
const brl=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const ddmm=k=>k?k.slice(8,10)+"/"+k.slice(5,7):"";
const num=n=>Number(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false});
// "150", "150,5", "1.500,00", "1500.50" -> número; o que não for valor -> null
function lerValor(s){
  let t=String(s||"").replace(/[R$\s]/g,"");if(!t)return null;
  if(t.includes(","))t=t.replace(/\./g,"").replace(",",".");
  else if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,"");
  if(!/^\d+(\.\d{1,2})?$/.test(t))return null;
  const n=Number(t);return n<1e7?n:null;
}
const nomeDe=id=>{const p=F.todas.find(x=>x.id===id);return p?p.name:"Paciente excluída";};
const receita=r=>r.tipo!=="despesa";

/* ---------- dados ---------- */
async function pedir(q){const {data,error}=await q;if(error)throw error;return data||[];}
const tab=()=>F.sb.from("fin_lancamentos");
async function carregar(){
  const pedido=++F.pedido,a=ini(),b=fim();
  try{
    const [doMes,pagos,pend,vals,ant]=await Promise.all([
      pedir(tab().select(COLS).gte("data",a).lte("data",b)),
      pedir(tab().select(COLS).gte("pago_em",a).lte("pago_em",b)),
      pedir(tab().select(COLS).is("pago_em",null).neq("tipo","despesa")),
      pedir(F.sb.from("fin_pacientes").select("patient_id,modo,valor")),
      pedir(tab().select(COLS).eq("tipo","despesa").gte("data",key(F.ano,F.mes-1,1)).lte("data",key(F.ano,F.mes,0)))
    ]);
    if(pedido!==F.pedido)return;
    const porId=new Map();[...doMes,...pagos,...pend].forEach(r=>porId.set(r.id,r));
    F.dados=[...porId.values()].sort((x,y)=>x.data<y.data?-1:x.data>y.data?1:0);
    F.valores=Object.fromEntries(vals.map(v=>[v.patient_id,v]));
    F.despAnt=ant;F.erro=false;F.semTabela=false;
  }catch(e){
    if(pedido!==F.pedido)return;
    F.semTabela=e&&(e.code==="42P01"||e.code==="PGRST205"||/fin_|schema cache|does not exist/.test(e.message||""));
    F.erro=true;F.dados=null;
  }
  pintar();
}
async function gravar(q,okMsg,msgDuplicado){
  if(F.busy)return false;
  F.busy=true;let error;
  try{({error}=await q);}catch(e){error=e;}
  F.busy=false;
  if(error){
    T.toast(error.code==="23505"||/duplicate|fin_mensalidade_unica/.test(error.message||"")?(msgDuplicado||"Esse lançamento já existe."):"Não consegui salvar. Confira a internet e tente de novo.");
    return false;
  }
  if(okMsg)T.toast(okMsg);
  await carregar();
  return true;
}

/* ---------- contas ---------- */
const soma=rs=>rs.reduce((t,r)=>t+Number(r.valor||0),0);
function resumo(){
  const a=ini(),b=fim(),ds=F.dados;
  const recebido=soma(ds.filter(r=>receita(r)&&r.pago_em&&r.pago_em>=a&&r.pago_em<=b));
  const despesas=soma(ds.filter(r=>!receita(r)&&r.data>=a&&r.data<=b));
  const aReceber=soma(ds.filter(r=>receita(r)&&!r.pago_em));
  return {recebido,despesas,aReceber,saldo:recebido-despesas};
}
// mensalista com valor que ainda não tem a mensalidade do mês; só até o mês atual e desde que ela foi cadastrada
function mensalidadesFaltando(){
  const a=ini(),b=fim(),agora=T.todayKey();
  if(a>agora)return [];
  const lancadas=new Set(F.dados.filter(r=>r.tipo==="mensalidade"&&r.data>=a&&r.data<=b).map(r=>r.patient_id));
  return F.pacientes.filter(p=>{
    const v=F.valores[p.id];
    return v&&v.modo==="mensal"&&Number(v.valor)>0&&!lancadas.has(p.id)&&String(p.created_at||"").slice(0,10)<=b;
  });
}

/* ---------- tela ---------- */
function linhaHTML(r){
  const desp=!receita(r),pago=!!r.pago_em,ap=F.apagar===r.id;
  const titulo=desp?'<b>'+esc(r.descricao||"Despesa")+'</b>':'<b data-pv>'+esc(nomeDe(r.patient_id))+'</b> <span class="muted">· '+TIPOS[r.tipo]+'</span>';
  return '<li class="fin-linha'+(!desp&&!pago?" pendente":"")+'"><span class="fin-data">'+ddmm(r.data)+'</span><span class="fin-desc">'+titulo+'</span>'+
    '<span class="fin-valor" data-pv>'+brl(r.valor)+'</span>'+
    '<span class="fin-acoes">'+
    (desp?'':pago?'<span class="fin-ok">Recebido '+ddmm(r.pago_em)+'</span><button class="btn ghost cx-small" data-fin="desfazer" data-arg="'+r.id+'">Desfazer</button>'
      :'<button class="btn cx-small" data-fin="receber" data-arg="'+r.id+'">Marcar recebido</button>')+
    '<button class="btn ghost cx-small" data-fin="editar" data-arg="'+r.id+'">Editar</button>'+
    (ap?'<button class="btn warn cx-small" data-fin="apagar-sim" data-arg="'+r.id+'">Confirmar exclusão</button>':'<button class="btn ghost cx-small" data-fin="apagar" data-arg="'+r.id+'">Excluir</button>')+
    '</span></li>';
}
const listaHTML=rs=>'<ul class="fin-lista">'+rs.map(linhaHTML).join("")+'</ul>';
function receitasHTML(){
  const a=ini(),b=fim(),ds=F.dados.filter(receita),ed=F.editar&&F.dados.find(r=>r.id===F.editar&&receita(r));
  const doMes=ds.filter(r=>r.data>=a&&r.data<=b).reverse();
  const outrosPend=ds.filter(r=>!r.pago_em&&(r.data<a||r.data>b));
  const outrosPagos=ds.filter(r=>r.pago_em&&r.pago_em>=a&&r.pago_em<=b&&(r.data<a||r.data>b));
  const dev={};ds.filter(r=>!r.pago_em).forEach(r=>{const k=r.patient_id||"";(dev[k]=dev[k]||[]).push(r);});
  const devedores=Object.entries(dev).map(([id,rs])=>({id,nome:nomeDe(id),total:soma(rs),n:rs.length})).sort((x,y)=>x.nome.localeCompare(y.nome,"pt-BR"));
  const pacs=[...F.pacientes];if(ed&&ed.patient_id&&!pacs.some(p=>p.id===ed.patient_id))pacs.push({id:ed.patient_id,name:nomeDe(ed.patient_id)});
  const tipos=ed&&ed.tipo==="mensalidade"?[["mensalidade","Mensalidade"]]:[["sessao","Sessão realizada"],["falta","Falta cobrada"]];
  const falta=mensalidadesFaltando();
  return (falta.length?'<div class="fin-aviso"><span>'+(falta.length===1?"1 mensalidade":falta.length+" mensalidades")+' de '+nomeMes()+' a lançar: <span data-pv>'+esc(falta.map(p=>p.name).join(", "))+'</span></span>'+
      '<button class="btn cx-small" data-fin="mensalidades">Lançar</button></div>':'')+
    '<form class="fin-form" id="fin-form-rec"><h4>'+(ed?"Editar lançamento":"Registrar sessão")+'</h4><div class="fin-campos">'+
    '<label>Paciente<select id="fin-pac" required'+(ed&&!ed.patient_id?' disabled':'')+'><option value="">Escolha…</option>'+pacs.map(p=>'<option value="'+esc(p.id)+'"'+(ed&&ed.patient_id===p.id?" selected":"")+' data-pv>'+esc(p.name)+'</option>').join("")+
      (ed&&!ed.patient_id?'<option value="" selected>Paciente excluída</option>':'')+'</select></label>'+
    '<label>Data<input type="date" id="fin-data" required value="'+(ed?ed.data:dataPadrao())+'"></label>'+
    '<label>Situação<select id="fin-tipo">'+tipos.map(([k,l])=>'<option value="'+k+'"'+(ed&&ed.tipo===k?" selected":"")+'>'+l+'</option>').join("")+'</select></label>'+
    '<label>Valor (R$)<input type="text" id="fin-valor" inputmode="decimal" autocomplete="off" required data-pv value="'+(ed?num(ed.valor):"")+'" placeholder="0,00"></label>'+
    '<label>Recebido em<input type="date" id="fin-pago" value="'+(ed&&ed.pago_em||"")+'"></label></div>'+
    '<p class="hint">Deixe "Recebido em" vazio se ainda não recebeu. Falta que você não cobra não precisa ser lançada.</p>'+
    '<div class="btns"><button class="btn" type="submit">'+(ed?"Salvar":"Registrar")+'</button>'+(ed?'<button class="btn ghost" type="button" data-fin="cancelar">Cancelar</button>':'')+'</div></form>'+
    (devedores.length?'<h4 class="fin-tit">Quem está devendo</h4><ul class="fin-devem">'+devedores.map(d=>'<li><span data-pv>'+esc(d.nome)+'</span><span class="muted">'+(d.n===1?"1 lançamento":d.n+" lançamentos")+'</span><b data-pv>'+brl(d.total)+'</b></li>').join("")+'</ul>':'')+
    '<h4 class="fin-tit">Lançamentos de '+nomeMes()+'</h4>'+(doMes.length?listaHTML(doMes):'<p class="hint">Nada lançado neste mês ainda.</p>')+
    (outrosPend.length?'<h4 class="fin-tit">De outros meses, ainda sem receber</h4>'+listaHTML(outrosPend):'')+
    (outrosPagos.length?'<h4 class="fin-tit">Recebidos em '+nomeMes()+', de outros meses</h4>'+listaHTML(outrosPagos):'');
}
function despesasHTML(){
  const a=ini(),b=fim(),ds=F.dados.filter(r=>!receita(r)&&r.data>=a&&r.data<=b).reverse();
  const ed=F.editar&&F.dados.find(r=>r.id===F.editar&&!receita(r));
  const sugestoes=[...new Set([...F.despAnt,...ds].map(r=>r.descricao).filter(Boolean))];
  return (!ds.length&&F.despAnt.length?'<div class="fin-aviso"><span>'+(F.despAnt.length===1?"1 despesa":F.despAnt.length+" despesas")+' no mês anterior. Quer repetir neste mês?</span><button class="btn cx-small" data-fin="copiar-despesas">Repetir</button></div>':'')+
    '<form class="fin-form" id="fin-form-desp"><h4>'+(ed?"Editar despesa":"Nova despesa")+'</h4><div class="fin-campos">'+
    '<label class="fin-largo">Descrição<input type="text" id="fin-desc" list="fin-desc-lista" maxlength="200" required value="'+(ed?esc(ed.descricao):"")+'" placeholder="Ex.: aluguel da sala, supervisão"></label>'+
    '<datalist id="fin-desc-lista">'+sugestoes.map(s=>'<option value="'+esc(s)+'"></option>').join("")+'</datalist>'+
    '<label>Data<input type="date" id="fin-data" required value="'+(ed?ed.data:dataPadrao())+'"></label>'+
    '<label>Valor (R$)<input type="text" id="fin-valor" inputmode="decimal" autocomplete="off" required data-pv value="'+(ed?num(ed.valor):"")+'" placeholder="0,00"></label></div>'+
    '<div class="btns"><button class="btn" type="submit">'+(ed?"Salvar":"Adicionar")+'</button>'+(ed?'<button class="btn ghost" type="button" data-fin="cancelar">Cancelar</button>':'')+'</div></form>'+
    '<h4 class="fin-tit">Despesas de '+nomeMes()+'</h4>'+(ds.length?listaHTML(ds):'<p class="hint">Nenhuma despesa neste mês ainda.</p>');
}
function valoresHTML(){
  if(!F.pacientes.length)return '<p class="hint">Nenhuma paciente cadastrada ainda.</p>';
  return '<p class="hint">Como cada paciente paga. O valor já vem preenchido ao registrar a sessão; mudar aqui não altera o que já foi lançado. Salva sozinho.</p><ul class="fin-valores">'+
    F.pacientes.map(p=>{const v=F.valores[p.id]||{};return '<li><span class="fin-v-nome" data-pv>'+esc(p.name)+'</span>'+
      '<select data-fin-modo="'+esc(p.id)+'" aria-label="Forma de cobrança"><option value="sessao"'+(v.modo!=="mensal"?" selected":"")+'>Por sessão</option><option value="mensal"'+(v.modo==="mensal"?" selected":"")+'>Por mês</option></select>'+
      '<input type="text" data-fin-valor="'+esc(p.id)+'" inputmode="decimal" autocomplete="off" data-pv aria-label="Valor em reais" placeholder="0,00" value="'+(v.valor!=null?num(v.valor):"")+'"></li>';}).join("")+'</ul>';
}
// no mês de hoje, a data de hoje; em outro mês, o primeiro dia dele
const dataPadrao=()=>{const h=T.todayKey();return h>=ini()&&h<=fim()?h:ini();};
function conteudo(){
  if(F.semTabela)return '<section class="panel"><h3>Financeiro</h3><p class="hint">Falta preparar o banco de dados: rode o arquivo supabase/schema.sql no SQL Editor do Supabase e abra esta tela de novo.</p></section>';
  if(F.erro)return '<section class="panel"><h3>Financeiro</h3><p class="hint">Não consegui carregar. Confira a internet.</p></section>';
  if(!F.dados)return '<section class="panel"><h3>Financeiro</h3><p class="hint">Carregando…</p></section>';
  const r=resumo(),card=(l,v,c)=>'<div class="fin-card'+(c?" "+c:"")+'"><span>'+l+'</span><b data-pv>'+brl(v)+'</b></div>';
  return '<section class="panel"><div class="fin-topo"><h3>Financeiro</h3><div class="fin-nav"><button class="btn ghost cx-small" data-fin="mes" data-arg="-1" aria-label="Mês anterior">‹</button>'+
    '<b aria-live="polite">'+nomeMes()+' de '+F.ano+'</b><button class="btn ghost cx-small" data-fin="mes" data-arg="1" aria-label="Próximo mês">›</button></div></div>'+
    '<div class="fin-cards">'+card("Recebido no mês",r.recebido,"")+card("Despesas no mês",r.despesas,"")+card("Saldo do mês",r.saldo,r.saldo<0?"neg":"")+card("A receber (todos os meses)",r.aReceber,"")+'</div>'+
    '<p class="hint">Só você vê. Nada daqui vai para o prontuário, para o app da paciente ou para a IA. É um controle seu: não substitui o contador nem os recibos.</p>'+
    '<div class="btns"><button class="btn ghost cx-small" data-fin="csv">Baixar planilha do mês</button></div></section>'+
    '<section class="panel"><div class="tabs" role="tablist">'+[["receitas","Receitas"],["despesas","Despesas"],["valores","Valores"]].map(([k,l])=>
      '<button class="tab" role="tab" data-fin="aba" data-arg="'+k+'" aria-selected="'+(F.aba===k)+'">'+l+'</button>').join("")+'</div>'+
    (F.aba==="despesas"?despesasHTML():F.aba==="valores"?valoresHTML():receitasHTML())+'</section>';
}
function pintar(){const el=document.getElementById("fin-root");if(el)el.innerHTML=conteudo();}

/* ---------- ações ---------- */
function baixarCSV(){
  const a=ini(),b=fim();
  const rs=F.dados.filter(r=>(r.data>=a&&r.data<=b)||(r.pago_em&&r.pago_em>=a&&r.pago_em<=b));
  // célula que começa com = + - @ viraria fórmula na planilha
  const cel=s=>{let t=String(s==null?"":s);if(/^[=+\-@]/.test(t))t="'"+t;return /[;"\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;};
  const data=k=>k?T.keyDate(k).toLocaleDateString("pt-BR"):"";
  const linhas=[["Data","Tipo","Paciente","Descrição","Valor","Recebido em"].join(";"),
    ...rs.map(r=>[data(r.data),TIPOS[r.tipo],receita(r)?nomeDe(r.patient_id):"",r.descricao||"",num(r.valor),data(r.pago_em)].map(cel).join(";"))];
  const url=URL.createObjectURL(new Blob(["﻿"+linhas.join("\r\n")],{type:"text/csv;charset=utf-8"}));
  const l=document.createElement("a");l.href=url;l.download="financeiro-"+a.slice(0,7)+".csv";document.body.appendChild(l);l.click();l.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-fin]");if(!b||F.busy)return;
  const act=b.dataset.fin,arg=b.dataset.arg;
  if(act!=="apagar-sim"&&act!=="apagar")F.apagar=null;
  if(act==="mes"){const d=new Date(F.ano,F.mes+Number(arg),1);F.ano=d.getFullYear();F.mes=d.getMonth();F.editar=null;F.dados=null;pintar();await carregar();return;}
  if(act==="aba"){F.aba=arg;F.editar=null;pintar();return;}
  if(act==="cancelar"){F.editar=null;pintar();return;}
  if(act==="csv"){baixarCSV();return;}
  if(act==="editar"){
    F.editar=arg;const r=F.dados.find(x=>x.id===arg);if(r)F.aba=receita(r)?"receitas":"despesas";pintar();
    const f=document.querySelector(".fin-form");if(f)f.scrollIntoView({block:"center"});
    return;
  }
  if(act==="apagar"){F.apagar=arg;pintar();return;}
  if(act==="apagar-sim"){F.apagar=null;if(F.editar===arg)F.editar=null;await gravar(tab().delete().eq("id",arg),"Lançamento excluído");return;}
  if(act==="receber"){await gravar(tab().update({pago_em:T.todayKey()}).eq("id",arg));return;}
  if(act==="desfazer"){await gravar(tab().update({pago_em:null}).eq("id",arg));return;}
  if(act==="mensalidades"){
    const a=ini(),rows=mensalidadesFaltando().map(p=>({tipo:"mensalidade",patient_id:p.id,data:a,valor:Number(F.valores[p.id].valor),descricao:""}));
    if(rows.length)await gravar(tab().insert(rows),rows.length===1?"Mensalidade lançada":rows.length+" mensalidades lançadas");
    return;
  }
  if(act==="copiar-despesas"){
    const ult=new Date(F.ano,F.mes+1,0).getDate();
    const rows=F.despAnt.map(r=>({tipo:"despesa",data:key(F.ano,F.mes,Math.min(Number(r.data.slice(8,10)),ult)),valor:Number(r.valor),descricao:r.descricao}));
    await gravar(tab().insert(rows),"Despesas repetidas. Confira os valores deste mês.");
  }
});
document.addEventListener("submit",async e=>{
  const id=e.target.id;if(id!=="fin-form-rec"&&id!=="fin-form-desp")return;
  e.preventDefault();if(F.busy)return;
  const v=lerValor(document.getElementById("fin-valor").value);
  if(v==null){T.toast("Confira o valor. Exemplo: 150,00");return;}
  const data=document.getElementById("fin-data").value;
  let campos;
  if(id==="fin-form-rec"){
    const sel=document.getElementById("fin-pac"),ed=F.editar&&F.dados.find(r=>r.id===F.editar);
    campos={data,valor:v,tipo:document.getElementById("fin-tipo").value,pago_em:document.getElementById("fin-pago").value||null};
    if(!sel.disabled)campos.patient_id=sel.value;
    if(!ed&&!campos.patient_id){T.toast("Escolha a paciente.");return;}
  }else campos={data,valor:v,tipo:"despesa",descricao:document.getElementById("fin-desc").value.trim()};
  const ed=F.editar,q=ed?tab().update(campos).eq("id",ed):tab().insert(campos);
  const ok=await gravar(q,ed?"Salvo":id==="fin-form-rec"?"Registrado":"Despesa adicionada","Essa paciente já tem mensalidade nesse mês.");
  if(ok&&ed){F.editar=null;pintar();}
});
document.addEventListener("change",async e=>{
  const t=e.target,ds=t.dataset||{};
  // ao escolher a paciente, o valor dela já vem preenchido (se ela paga por sessão)
  if(t.id==="fin-pac"){
    const v=F.valores[t.value],campo=document.getElementById("fin-valor");
    if(campo&&!F.editar)campo.value=v&&v.modo!=="mensal"&&v.valor!=null?num(v.valor):"";
    return;
  }
  const pid=ds.finModo||ds.finValor;if(!pid)return;
  const li=t.closest("li"),modo=li.querySelector("[data-fin-modo]").value,txt=li.querySelector("[data-fin-valor]").value;
  const valor=txt.trim()?lerValor(txt):null;
  if(txt.trim()&&valor==null){T.toast("Confira o valor. Exemplo: 150,00");return;}
  let error;
  try{({error}=await F.sb.from("fin_pacientes").upsert({patient_id:pid,modo,valor},{onConflict:"patient_id"}));}catch(x){error=x;}
  if(error){T.toast("Não consegui salvar. Confira a internet e tente de novo.");return;}
  F.valores[pid]={patient_id:pid,modo,valor};
  if(valor!=null)t.closest("li").querySelector("[data-fin-valor]").value=num(valor);
});

window.TrilhaFinanceiro={
  html(){return '<div id="fin-root" style="display:flex;flex-direction:column;gap:18px">'+conteudo()+'</div>';},
  mount(ctx){F.sb=ctx.sb;F.pacientes=ctx.pacientes;F.todas=ctx.todas;F.apagar=null;carregar();}
};
})();
