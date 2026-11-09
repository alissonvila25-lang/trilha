/* Financeiro da psicóloga: o que entra (sessões, faltas cobradas, mensalidades) e o que sai (despesas), mês a mês.
   Fica em tabelas próprias (fin_*), separadas do caso e da config: não vai para o prontuário, para o app da paciente
   nem para a IA. Cada conta vê só o que é dela (RLS por owner). A regra de cobrar falta é de cada psicóloga: aqui ela
   só marca "falta cobrada" quando for o caso. Tudo conta no mês de referência (o da sessão ou da mensalidade), mesmo se o dinheiro
   entrou em outro mês. O vencimento e o reajuste por atraso também são de cada uma, e só valem depois que ela preencher. */
(function(){
"use strict";
const T=window.Trilha,esc=T.esc;
const hoje0=new Date();
const F={sb:null,pacientes:[],todas:[],ano:hoje0.getFullYear(),mes:hoje0.getMonth(),aba:"receitas",
  dados:null,valores:{},despAnt:[],erro:false,semTabela:false,pedido:0,busy:false,editar:null,apagar:null,
  horarios:{},excecoes:[],cfg:{},anoRel:hoje0.getFullYear(),anoDados:null,anoErro:false,pedidoAno:0};
const COLS="id,tipo,patient_id,data,valor,pago_em,descricao,acrescimo";
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
const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

/* ---------- dados ---------- */
async function pedir(q){const {data,error}=await q;if(error)throw error;return data||[];}
const tab=()=>F.sb.from("fin_lancamentos");
async function carregar(){
  const pedido=++F.pedido,a=ini(),b=fim();
  try{
    const [doMes,pend,vals,ant,hs,ex]=await Promise.all([
      pedir(tab().select(COLS).gte("data",a).lte("data",b)),
      pedir(tab().select(COLS).is("pago_em",null).neq("tipo","despesa")),
      pedir(F.sb.from("fin_pacientes").select("patient_id,modo,valor")),
      pedir(tab().select(COLS).eq("tipo","despesa").gte("data",key(F.ano,F.mes-1,1)).lte("data",key(F.ano,F.mes,0))),
      pedir(F.sb.from("agenda_horarios").select("patient_id,frequencia,inicio,hora")),
      pedir(F.sb.from("agenda_excecoes").select("id,patient_id,data,tipo,hora"))
    ]);
    if(pedido!==F.pedido)return;
    const porId=new Map();[...doMes,...pend].forEach(r=>porId.set(r.id,r));
    F.dados=[...porId.values()].sort((x,y)=>x.data<y.data?-1:x.data>y.data?1:0);
    F.valores=Object.fromEntries(vals.map(v=>[v.patient_id,v]));
    F.despAnt=ant;F.horarios=Object.fromEntries(hs.map(h=>[h.patient_id,h]));F.excecoes=ex;F.erro=false;F.semTabela=false;
  }catch(e){
    if(pedido!==F.pedido)return;
    F.semTabela=e&&(e.code==="42P01"||e.code==="PGRST205"||/fin_|agenda_|schema cache|does not exist/.test(e.message||""));
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
const centavos=n=>Math.round(Number(n||0)*100)/100;
// o reajuste de quem paga no começo do mês e passou do vencimento; só depois que ela preencher as regras
function reajuste(r){
  const c=F.cfg,v=Number(c.valor);
  if(r.tipo!=="mensalidade"||r.pago_em||!(v>0)||!c.dia)return 0;
  const a=Number(r.data.slice(0,4)),m=Number(r.data.slice(5,7))-1,venc=key(a,m,Math.min(Number(c.dia),new Date(a,m+1,0).getDate()));
  if(T.todayKey()<=venc)return 0;
  return c.tipo==="fixo"?v:centavos(Number(r.valor)*v/100);
}
// o que conta: o valor + o reajuste (o já cobrado, ou o de agora, se ainda não recebeu)
const total=r=>centavos(Number(r.valor||0)+Number(r.acrescimo||0)+reajuste(r));
const soma=rs=>centavos(rs.reduce((t,r)=>t+total(r),0));
function resumo(){
  const a=ini(),b=fim(),ds=F.dados,noMes=r=>r.data>=a&&r.data<=b;
  const recebido=soma(ds.filter(r=>receita(r)&&r.pago_em&&noMes(r)));
  const despesas=soma(ds.filter(r=>!receita(r)&&noMes(r)));
  const aReceber=soma(ds.filter(r=>receita(r)&&!r.pago_em));
  return {recebido,despesas,aReceber,saldo:centavos(recebido-despesas)};
}
const Ag=()=>window.TrilhaAgenda;
const nSessoes=(pid,ano,m)=>Ag().contar(F.horarios[pid],F.excecoes,ano,m);
const sessoesTxt=n=>n===1?"1 sessão":n+" sessões";
// quem paga no começo do mês (valor fixo, ou quinzenal: sessões da agenda × valor da sessão) e ainda não tem a mensalidade do mês;
// só até o mês atual e desde que ela foi cadastrada. Quinzenal sem horário na agenda não entra: não há como saber quantas sessões.
function mensalidadesFaltando(){
  const a=ini(),b=fim(),agora=T.todayKey();
  if(a>agora)return [];
  const lancadas=new Set(F.dados.filter(r=>r.tipo==="mensalidade"&&r.data>=a&&r.data<=b).map(r=>r.patient_id));
  return F.pacientes.flatMap(p=>{
    const v=F.valores[p.id];
    if(!v||!(Number(v.valor)>0)||lancadas.has(p.id)||String(p.created_at||"").slice(0,10)>b)return [];
    if(v.modo==="mensal")return [{p,valor:Number(v.valor),descricao:"",rot:p.name}];
    if(v.modo!=="quinzenal")return [];
    const n=nSessoes(p.id,F.ano,F.mes);if(!n)return [];
    return [{p,valor:centavos(Number(v.valor)*n),descricao:sessoesTxt(n),rot:p.name+" ("+sessoesTxt(n)+")"}];
  });
}
const quinzenaisSemHorario=()=>F.pacientes.filter(p=>{const v=F.valores[p.id];return v&&v.modo==="quinzenal"&&Number(v.valor)>0&&!F.horarios[p.id];});

/* ---------- tela ---------- */
function linhaHTML(r){
  const desp=!receita(r),pago=!!r.pago_em,ap=F.apagar===r.id,atraso=reajuste(r);
  const titulo=desp?'<b>'+esc(r.descricao||"Despesa")+'</b>':'<b data-pv>'+esc(nomeDe(r.patient_id))+'</b> <span class="muted">· '+TIPOS[r.tipo]+(r.descricao?" · "+esc(r.descricao):"")+'</span>';
  return '<li class="fin-linha'+(!desp&&!pago?" pendente":"")+'"><span class="fin-data">'+ddmm(r.data)+'</span><span class="fin-desc">'+titulo+'</span>'+
    '<span class="fin-valor" data-pv>'+brl(total(r))+'</span>'+
    (atraso?'<span class="fin-reaj">'+brl(r.valor)+' + <span data-pv>'+brl(atraso)+'</span> de reajuste</span>':Number(r.acrescimo)>0?'<span class="fin-reaj">inclui <span data-pv>'+brl(r.acrescimo)+'</span> de reajuste</span>':'')+
    '<span class="fin-acoes">'+
    (desp?'':pago?'<span class="fin-ok">Recebido '+ddmm(r.pago_em)+'</span><button class="btn ghost cx-small" data-fin="desfazer" data-arg="'+r.id+'">Desfazer</button>'
      :atraso?'<button class="btn cx-small" data-fin="receber-reaj" data-arg="'+r.id+'">Recebido com reajuste</button><button class="btn ghost cx-small" data-fin="receber" data-arg="'+r.id+'">Sem reajuste</button>'
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
  const dev={};ds.filter(r=>!r.pago_em).forEach(r=>{const k=r.patient_id||"";(dev[k]=dev[k]||[]).push(r);});
  const devedores=Object.entries(dev).map(([id,rs])=>({id,nome:nomeDe(id),total:soma(rs),n:rs.length})).sort((x,y)=>x.nome.localeCompare(y.nome,"pt-BR"));
  const pacs=[...F.pacientes];if(ed&&ed.patient_id&&!pacs.some(p=>p.id===ed.patient_id))pacs.push({id:ed.patient_id,name:nomeDe(ed.patient_id)});
  const tipos=ed&&ed.tipo==="mensalidade"?[["mensalidade","Mensalidade"]]:[["sessao","Sessão realizada"],["falta","Falta cobrada"]];
  const falta=mensalidadesFaltando(),semHor=quinzenaisSemHorario();
  return (falta.length?'<div class="fin-aviso"><span>'+(falta.length===1?"1 mensalidade":falta.length+" mensalidades")+' de '+nomeMes()+' a lançar: <span data-pv>'+esc(falta.map(x=>x.rot).join(", "))+'</span></span>'+
      '<button class="btn cx-small" data-fin="mensalidades">Lançar</button></div>':'')+
    (semHor.length?'<p class="hint">Quinzenal sem horário na Agenda, por isso sem mensalidade calculada: <span data-pv>'+esc(semHor.map(p=>p.name).join(", "))+'</span>.</p>':'')+
    '<form class="fin-form" id="fin-form-rec"><h4>'+(ed?"Editar lançamento":"Registrar sessão")+'</h4><div class="fin-campos">'+
    '<label>Paciente<select id="fin-pac" required'+(ed&&!ed.patient_id?' disabled':'')+'><option value="">Escolha…</option>'+pacs.map(p=>'<option value="'+esc(p.id)+'"'+(ed&&ed.patient_id===p.id?" selected":"")+' data-pv>'+esc(p.name)+'</option>').join("")+
      (ed&&!ed.patient_id?'<option value="" selected>Paciente excluída</option>':'')+'</select></label>'+
    '<label>'+(ed&&ed.tipo==="mensalidade"?"Mês de referência (qualquer dia dele)":"Data da sessão")+'<input type="date" id="fin-data" required value="'+(ed?ed.data:dataPadrao())+'"></label>'+
    '<label>Situação<select id="fin-tipo">'+tipos.map(([k,l])=>'<option value="'+k+'"'+(ed&&ed.tipo===k?" selected":"")+'>'+l+'</option>').join("")+'</select></label>'+
    '<label>Valor (R$)<input type="text" id="fin-valor" inputmode="decimal" autocomplete="off" required data-pv value="'+(ed?num(ed.valor):"")+'" placeholder="0,00"></label>'+
    '<label>Recebido em<input type="date" id="fin-pago" value="'+(ed&&ed.pago_em||"")+'"></label></div>'+
    '<p class="hint">O valor conta no mês da sessão, mesmo se for pago em outro mês. Deixe "Recebido em" vazio se ainda não recebeu. Falta que você não cobra não precisa ser lançada.</p>'+
    '<div class="btns"><button class="btn" type="submit">'+(ed?"Salvar":"Registrar")+'</button>'+(ed?'<button class="btn ghost" type="button" data-fin="cancelar">Cancelar</button>':'')+'</div></form>'+
    (devedores.length?'<h4 class="fin-tit">Quem está devendo</h4><ul class="fin-devem">'+devedores.map(d=>'<li><span data-pv>'+esc(d.nome)+'</span><span class="muted">'+(d.n===1?"1 lançamento":d.n+" lançamentos")+'</span><b data-pv>'+brl(d.total)+'</b></li>').join("")+'</ul>':'')+
    '<h4 class="fin-tit">Lançamentos de '+nomeMes()+'</h4>'+(doMes.length?listaHTML(doMes):'<p class="hint">Nada lançado neste mês ainda.</p>')+
    (outrosPend.length?'<h4 class="fin-tit">De outros meses, ainda sem receber</h4>'+listaHTML(outrosPend):'');
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
// ao lado do valor: o que ele significa para esta paciente neste mês
function infoModo(pid,modo,valor){
  if(modo!=="quinzenal")return "";
  const n=nSessoes(pid,F.ano,F.mes);
  if(n==null)return '<span class="muted">valor por sessão · falta o horário na </span><button class="linkish" type="button" data-act="agenda">Agenda</button>';
  return '<span class="muted">valor por sessão · '+nomeMes()+': '+sessoesTxt(n)+(Number(valor)>0?' = <span data-pv>'+brl(Number(valor)*n)+'</span>':'')+'</span>';
}
function valoresHTML(){
  if(!F.pacientes.length)return '<p class="hint">Nenhuma paciente cadastrada ainda.</p>';
  const c=F.cfg,opt=(v,l,on)=>'<option value="'+v+'"'+(on?" selected":"")+'>'+l+'</option>';
  return '<p class="hint">Como cada paciente paga. <b>Por sessão</b>: o valor já vem preenchido ao registrar a sessão. <b>Por mês</b>: valor fixo. <b>Quinzenal</b>: paga no começo do mês o valor da sessão vezes as sessões daquele mês na Agenda. Mudar aqui não altera o que já foi lançado. Salva sozinho.</p><ul class="fin-valores">'+
    F.pacientes.map(p=>{const v=F.valores[p.id]||{},m=v.modo||"sessao";return '<li><span class="fin-v-nome" data-pv>'+esc(p.name)+'</span>'+
      '<select data-fin-modo="'+esc(p.id)+'" aria-label="Forma de cobrança">'+opt("sessao","Por sessão",m==="sessao")+opt("mensal","Por mês",m==="mensal")+opt("quinzenal","Quinzenal",m==="quinzenal")+'</select>'+
      '<input type="text" data-fin-valor="'+esc(p.id)+'" inputmode="decimal" autocomplete="off" data-pv aria-label="Valor em reais" placeholder="0,00" value="'+(v.valor!=null?num(v.valor):"")+'">'+
      '<span class="fin-v-info">'+infoModo(p.id,m,v.valor)+'</span></li>';}).join("")+'</ul>'+
    '<form class="fin-form" id="fin-form-cfg"><h4>Pagamento em atraso</h4><div class="fin-campos">'+
    '<label>Vence no dia<input type="number" id="fin-cfg-dia" min="1" max="31" step="1" value="'+esc(c.dia||"")+'" placeholder="Ex.: 10"></label>'+
    '<label>Depois disso, acrescentar<select id="fin-cfg-tipo">'+opt("pct","% do valor",c.tipo!=="fixo")+opt("fixo","Valor fixo (R$)",c.tipo==="fixo")+'</select></label>'+
    '<label>Quanto<input type="text" id="fin-cfg-valor" inputmode="decimal" autocomplete="off" value="'+(c.valor?num(c.valor):"")+'" placeholder="0,00"></label></div>'+
    '<p class="hint">Vale para quem paga no começo do mês (por mês ou quinzenal). O reajuste é somado uma vez, não por dia de atraso, e só entra na conta quando você escolhe "Recebido com reajuste". Deixe "Quanto" vazio para não usar.</p>'+
    '<div class="btns"><button class="btn" type="submit">Salvar regra</button></div></form>';
}
/* ---------- análise do ano ---------- */
function anoContas(){
  const meses=MESES.map(()=>({rec:0,pend:0,desp:0})),pac={},desp={};
  F.anoDados.forEach(r=>{
    const m=meses[Number(r.data.slice(5,7))-1],v=total(r);
    if(!receita(r)){m.desp+=v;const k=str0(r.descricao)||"Sem descrição";desp[k]=(desp[k]||0)+v;return;}
    if(r.pago_em)m.rec+=v;else m.pend+=v;
    const k=r.patient_id||"",p=pac[k]=pac[k]||{nome:nomeDe(r.patient_id),rec:0,pend:0,n:0};
    if(r.pago_em)p.rec+=v;else p.pend+=v;
    p.n++;
  });
  const t=meses.reduce((a,m)=>({rec:a.rec+m.rec,pend:a.pend+m.pend,desp:a.desp+m.desp}),{rec:0,pend:0,desp:0});
  const comRec=meses.map((m,i)=>({i,rec:m.rec})).filter(x=>x.rec>0);
  return {meses,t,saldo:t.rec-t.desp,
    melhor:comRec.length?comRec.reduce((a,b)=>b.rec>a.rec?b:a):null,media:comRec.length?t.rec/comRec.length:0,nMeses:comRec.length,
    pacientes:Object.values(pac).sort((a,b)=>(b.rec+b.pend)-(a.rec+a.pend)),
    despesas:Object.entries(desp).map(([nome,v])=>({nome,v})).sort((a,b)=>b.v-a.v)};
}
const str0=s=>String(s==null?"":s).trim();
// valores do eixo: passos redondos (1, 2, 2,5 ou 5 × potência de 10)
function escala(max){
  if(!(max>0))return {topo:100,passo:25};
  const b=Math.pow(10,Math.floor(Math.log10(max/4))),passo=[1,2,2.5,5,10].map(x=>x*b).find(x=>x*4>=max);
  return {topo:passo*4,passo};
}
const COR_REC="#2a78d6",COR_DESP="#eb6834";
// barra com o topo arredondado, ancorada na base
const barra=(x,y,w,h,fill,extra)=>{
  if(h<=0)return "";
  const r=Math.min(4,w/2,h);
  return '<path d="M'+x+' '+(y+h)+'V'+(y+r)+'Q'+x+' '+y+' '+(x+r)+' '+y+'H'+(x+w-r)+'Q'+(x+w)+' '+y+' '+(x+w)+' '+(y+r)+'V'+(y+h)+'Z" fill="'+fill+'"'+(extra||"")+'/>';
};
const milhar=n=>Number(n).toLocaleString("pt-BR",{maximumFractionDigits:n>=1000?0:2});
function graficoAno(c){
  const W=760,H=270,esq=58,dir=8,topo=10,base=236,alt=base-topo,e=escala(Math.max(...c.meses.map(m=>Math.max(m.rec+m.pend,m.desp)))),larg=(W-esq-dir)/12,bw=Math.min(20,larg/2-5);
  const y=v=>base-v/e.topo*alt;
  let s='<svg class="fin-graf" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Recebido, a receber e despesas em cada mês de '+F.anoRel+'. Os valores estão na tabela abaixo.">'+
    '<defs><pattern id="fin-hach" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><rect width="2.500" height="6" fill="'+COR_REC+'"/></pattern></defs>';
  for(let i=0;i<=4;i++){const v=e.passo*i,yy=y(v);s+='<line class="fin-g-grade" x1="'+esq+'" x2="'+(W-dir)+'" y1="'+yy+'" y2="'+yy+'"/><text class="fin-g-val" x="'+(esq-8)+'" y="'+(yy+4)+'" text-anchor="end">'+milhar(v)+'</text>';}
  c.meses.forEach((m,i)=>{
    const cx=esq+larg*i+larg/2,x1=cx-bw-1,x2=cx+1,hR=m.rec/e.topo*alt,hP=m.pend/e.topo*alt,hD=m.desp/e.topo*alt;
    s+=hP>0&&hR>0?'<rect x="'+x1+'" y="'+(base-hR)+'" width="'+bw+'" height="'+hR+'" fill="'+COR_REC+'"/>'+barra(x1,base-hR-hP-2,bw,hP,"url(#fin-hach)",' stroke="'+COR_REC+'"'):barra(x1,base-hR,bw,hR,COR_REC)+barra(x1,base-hP,bw,hP,"url(#fin-hach)",' stroke="'+COR_REC+'"');
    s+=barra(x2,base-hD,bw,hD,COR_DESP);
    s+='<text class="fin-g-mes" x="'+cx+'" y="'+(base+18)+'" text-anchor="middle">'+MESES[i]+'</text>';
    s+='<rect class="fin-g-alvo" x="'+(esq+larg*i)+'" y="'+topo+'" width="'+larg+'" height="'+(H-topo)+'" fill="transparent" data-fin-mes="'+i+'"/>';
  });
  return s+'<line class="fin-g-base" x1="'+esq+'" x2="'+(W-dir)+'" y1="'+base+'" y2="'+base+'"/></svg>';
}
function anoHTML(){
  const nav='<div class="fin-topo fin-noprint"><div class="fin-nav"><button class="btn ghost cx-small" data-fin="ano" data-arg="-1" aria-label="Ano anterior">‹</button><b aria-live="polite">'+F.anoRel+'</b><button class="btn ghost cx-small" data-fin="ano" data-arg="1" aria-label="Próximo ano">›</button></div>'+
    (F.anoDados&&F.anoDados.length?'<div class="btns"><button class="btn cx-small" data-fin="ano-print">Imprimir / salvar PDF</button><button class="btn ghost cx-small" data-fin="csv">Baixar os lançamentos (planilha)</button></div>':'')+'</div>';
  if(F.anoErro)return nav+'<p class="hint">Não consegui carregar. Confira a internet.</p>';
  if(!F.anoDados)return nav+'<p class="hint">Carregando…</p>';
  if(!F.anoDados.length)return nav+'<p class="hint">Nada lançado em '+F.anoRel+'.</p>';
  const c=anoContas(),card=(l,v,cl)=>'<div class="fin-card'+(cl?" "+cl:"")+'"><span>'+l+'</span><b data-pv>'+brl(v)+'</b></div>';
  const lin=(a,b,cl)=>'<tr'+(cl?' class="'+cl+'"':'')+'>'+a+b+'</tr>',v=n=>'<td class="fin-n" data-pv>'+(n?brl(n):'—')+'</td>';
  return nav+'<div id="fin-relatorio"><header class="fin-rel-cab"><h2>Análise financeira de '+F.anoRel+'</h2><span class="muted">Gerada em '+new Date().toLocaleDateString("pt-BR")+'. Cada valor conta no mês a que se refere.</span></header>'+
    '<div class="fin-cards">'+card("Recebido",c.t.rec)+card("Despesas",c.t.desp)+card("Saldo",c.saldo,c.saldo<0?"neg":"")+card("A receber",c.t.pend)+'</div>'+
    (c.melhor?'<p class="fin-rel-frase">Melhor mês: <b>'+new Date(F.anoRel,c.melhor.i,1).toLocaleDateString("pt-BR",{month:"long"})+'</b>, com <b data-pv>'+brl(c.melhor.rec)+'</b> recebidos. Média de <b data-pv>'+brl(c.media)+'</b> por mês com recebimento ('+c.nMeses+(c.nMeses===1?" mês":" meses")+').</p>':'')+
    '<h4 class="fin-tit">Mês a mês</h4><div class="fin-legenda"><span><i style="background:'+COR_REC+'"></i>Recebido</span><span><i class="hach"></i>A receber</span><span><i style="background:'+COR_DESP+'"></i>Despesas</span></div>'+
    '<div class="fin-graf-box">'+graficoAno(c)+'<div id="fin-tip" class="fin-tip" hidden></div></div>'+
    '<div class="fin-tab-rola"><table class="fin-tab"><thead><tr><th>Mês</th><th class="fin-n">Recebido</th><th class="fin-n">A receber</th><th class="fin-n">Despesas</th><th class="fin-n">Saldo</th></tr></thead><tbody>'+
      c.meses.map((m,i)=>lin('<td>'+new Date(F.anoRel,i,1).toLocaleDateString("pt-BR",{month:"long"})+'</td>',v(m.rec)+v(m.pend)+v(m.desp)+v(m.rec-m.desp))).join("")+
      lin('<td>Total</td>',v(c.t.rec)+v(c.t.pend)+v(c.t.desp)+v(c.saldo),"fin-total")+'</tbody></table></div>'+
    '<div class="fin-rel-col">'+
    (c.pacientes.length?'<div><h4 class="fin-tit">Por paciente</h4><div class="fin-tab-rola"><table class="fin-tab"><thead><tr><th>Paciente</th><th class="fin-n">Recebido</th><th class="fin-n">A receber</th></tr></thead><tbody>'+
      c.pacientes.map(p=>'<tr><td data-pv>'+esc(p.nome)+'</td>'+v(p.rec)+v(p.pend)+'</tr>').join("")+'</tbody></table></div></div>':'')+
    (c.despesas.length?'<div><h4 class="fin-tit">Por despesa</h4><div class="fin-tab-rola"><table class="fin-tab"><thead><tr><th>Descrição</th><th class="fin-n">Total</th></tr></thead><tbody>'+
      c.despesas.map(d=>'<tr><td>'+esc(d.nome)+'</td>'+v(d.v)+'</tr>').join("")+'</tbody></table></div></div>':'')+
    '</div></div>';
}
async function carregarAno(){
  const pedido=++F.pedidoAno,a=F.anoRel;
  try{
    const rs=await pedir(tab().select(COLS).gte("data",a+"-01-01").lte("data",a+"-12-31"));
    if(pedido!==F.pedidoAno)return;
    F.anoDados=rs.sort((x,y)=>x.data<y.data?-1:x.data>y.data?1:0);F.anoErro=false;
  }catch(_){if(pedido!==F.pedidoAno)return;F.anoErro=true;}
  pintar();
}
// o balão do gráfico: mês a mês, ao passar o mouse (com os dados escondidos, não aparece)
document.addEventListener("mousemove",e=>{
  const tip=document.getElementById("fin-tip");if(!tip)return;
  const alvo=e.target.closest&&e.target.closest("[data-fin-mes]");
  if(!alvo||document.documentElement.classList.contains("privado")||!F.anoDados){tip.hidden=true;return;}
  const i=Number(alvo.dataset.finMes),m=anoContas().meses[i],box=tip.parentElement.getBoundingClientRect();
  tip.innerHTML='<b>'+new Date(F.anoRel,i,1).toLocaleDateString("pt-BR",{month:"long"})+'</b><br>Recebido: '+brl(m.rec)+'<br>A receber: '+brl(m.pend)+'<br>Despesas: '+brl(m.desp);
  tip.hidden=false;
  const x=e.clientX-box.left,w=tip.offsetWidth;
  tip.style.left=Math.max(0,Math.min(box.width-w,x+12))+"px";tip.style.top=Math.max(0,e.clientY-box.top-tip.offsetHeight-8)+"px";
});
// no mês de hoje, a data de hoje; em outro mês, o primeiro dia dele
const dataPadrao=()=>{const h=T.todayKey();return h>=ini()&&h<=fim()?h:ini();};
function conteudo(){
  if(F.semTabela)return '<section class="panel"><h3>Financeiro</h3><p class="hint">Falta preparar o banco de dados: rode o arquivo supabase/schema.sql no SQL Editor do Supabase e abra esta tela de novo.</p></section>';
  if(F.erro)return '<section class="panel"><h3>Financeiro</h3><p class="hint">Não consegui carregar. Confira a internet.</p></section>';
  if(!F.dados)return '<section class="panel"><h3>Financeiro</h3><p class="hint">Carregando…</p></section>';
  const r=resumo(),card=(l,v,c)=>'<div class="fin-card'+(c?" "+c:"")+'"><span>'+l+'</span><b data-pv>'+brl(v)+'</b></div>';
  return '<section class="panel"><div class="fin-topo"><h3>Financeiro</h3><div class="fin-nav"><button class="btn ghost cx-small" data-fin="mes" data-arg="-1" aria-label="Mês anterior">‹</button>'+
    '<b aria-live="polite">'+nomeMes()+' de '+F.ano+'</b><button class="btn ghost cx-small" data-fin="mes" data-arg="1" aria-label="Próximo mês">›</button></div></div>'+
    '<div class="fin-cards">'+card("Recebido do mês",r.recebido,"")+card("Despesas no mês",r.despesas,"")+card("Saldo do mês",r.saldo,r.saldo<0?"neg":"")+card("A receber (todos os meses)",r.aReceber,"")+'</div>'+
    '<p class="hint">Só você vê. Nada daqui vai para o prontuário, para o app da paciente ou para a IA. É um controle seu: não substitui o contador nem os recibos. Cada valor conta no mês a que se refere, mesmo se o pagamento veio em outro mês.</p>'+
    '</section>'+
    '<section class="panel"><div class="tabs" role="tablist">'+[["receitas","Receitas"],["despesas","Despesas"],["valores","Valores"],["ano","Análise do ano"]].map(([k,l])=>
      '<button class="tab" role="tab" data-fin="aba" data-arg="'+k+'" aria-selected="'+(F.aba===k)+'">'+l+'</button>').join("")+'</div>'+
    (F.aba==="despesas"?despesasHTML():F.aba==="valores"?valoresHTML():F.aba==="ano"?anoHTML():receitasHTML())+'</section>';
}
function pintar(){const el=document.getElementById("fin-root");if(el)el.innerHTML=conteudo();}

/* ---------- ações ---------- */
function baixarCSV(){
  const rs=F.anoDados||[];
  // célula que começa com = + - @ viraria fórmula na planilha
  const cel=s=>{let t=String(s==null?"":s);if(/^[=+\-@]/.test(t))t="'"+t;return /[;"\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;};
  const data=k=>k?T.keyDate(k).toLocaleDateString("pt-BR"):"";
  const linhas=[["Data","Tipo","Paciente","Descrição","Valor","Reajuste","Recebido em"].join(";"),
    ...rs.map(r=>[data(r.data),TIPOS[r.tipo],receita(r)?nomeDe(r.patient_id):"",r.descricao||"",num(r.valor),Number(r.acrescimo)>0?num(r.acrescimo):"",data(r.pago_em)].map(cel).join(";"))];
  const url=URL.createObjectURL(new Blob(["﻿"+linhas.join("\r\n")],{type:"text/csv;charset=utf-8"}));
  const l=document.createElement("a");l.href=url;l.download="financeiro-"+F.anoRel+".csv";document.body.appendChild(l);l.click();l.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-fin]");if(!b||F.busy)return;
  const act=b.dataset.fin,arg=b.dataset.arg;
  if(act!=="apagar-sim"&&act!=="apagar")F.apagar=null;
  if(act==="mes"){const d=new Date(F.ano,F.mes+Number(arg),1);F.ano=d.getFullYear();F.mes=d.getMonth();F.editar=null;F.dados=null;pintar();await carregar();return;}
  if(act==="aba"){F.aba=arg;F.editar=null;pintar();if(arg==="ano")await carregarAno();return;}
  if(act==="ano"){F.anoRel+=Number(arg);F.anoDados=null;pintar();await carregarAno();return;}
  if(act==="ano-print"){
    document.body.classList.add("fin-printing");
    window.addEventListener("afterprint",()=>document.body.classList.remove("fin-printing"),{once:true});
    setTimeout(()=>window.print(),30);return;
  }
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
  if(act==="receber-reaj"){
    const r=F.dados.find(x=>x.id===arg);if(!r)return;
    await gravar(tab().update({pago_em:T.todayKey(),acrescimo:reajuste(r)}).eq("id",arg));return;
  }
  if(act==="desfazer"){await gravar(tab().update({pago_em:null,acrescimo:0}).eq("id",arg));return;}
  if(act==="mensalidades"){
    const a=ini(),rows=mensalidadesFaltando().map(x=>({tipo:"mensalidade",patient_id:x.p.id,data:a,valor:x.valor,descricao:x.descricao}));
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
  const id=e.target.id;
  if(id==="fin-form-cfg"){
    e.preventDefault();if(F.busy)return;
    const dia=Number(document.getElementById("fin-cfg-dia").value),txt=document.getElementById("fin-cfg-valor").value,valor=txt.trim()?lerValor(txt):0;
    if(valor==null){T.toast("Confira o valor. Exemplo: 5,00");return;}
    if(valor>0&&!(Number.isInteger(dia)&&dia>=1&&dia<=31)){T.toast("Diga em que dia do mês vence (de 1 a 31).");return;}
    const fin={dia:dia||null,tipo:document.getElementById("fin-cfg-tipo").value,valor};
    F.busy=true;let error;
    try{({error}=await F.sb.auth.updateUser({data:{fin}}));}catch(x){error=x;}
    F.busy=false;
    if(error){T.toast("Não consegui salvar. Confira a internet e tente de novo.");return;}
    F.cfg=fin;pintar();T.toast(valor>0?"Regra salva.":"Sem reajuste por atraso.");return;
  }
  if(id!=="fin-form-rec"&&id!=="fin-form-desp")return;
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
    if(campo&&!F.editar)campo.value=v&&v.modo==="sessao"&&v.valor!=null?num(v.valor):"";
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
  if(valor!=null)li.querySelector("[data-fin-valor]").value=num(valor);
  li.querySelector(".fin-v-info").innerHTML=infoModo(pid,modo,valor);
});

window.TrilhaFinanceiro={
  html(){return '<div id="fin-root" style="display:flex;flex-direction:column;gap:18px">'+conteudo()+'</div>';},
  async mount(ctx){
    F.sb=ctx.sb;F.pacientes=ctx.pacientes;F.todas=ctx.todas;F.apagar=null;
    try{const {data}=await F.sb.auth.getUser();F.cfg=(data&&data.user&&data.user.user_metadata&&data.user.user_metadata.fin)||{};}catch(_){F.cfg={};}
    await carregar();
    if(F.aba==="ano")await carregarAno();
  }
};
})();
