/* Aniversários: calendário do ano com o dia de cada paciente destacado e a lista dos próximos. A data vem da anamnese
   (do caso só ela é lida, e não sai do painel). Os nomes aparecem só nesta tela: o aviso no topo do painel, que pode
   estar à vista durante uma sessão, diz só quantos são. */
(function(){
"use strict";
const T=window.Trilha;
const MESES=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const SEMANA=["D","S","T","Q","Q","S","S"];
const OK_KEY="trilha.aniv.ok",DIAS_LISTA=30,DIAS_AVISO=7;
const A={sb:null,pacientes:[],lista:null,semData:[],erro:false,pedido:0,ano:new Date().getFullYear()};

// só data completa e que exista (o que veio de importações antigas pode ser outra coisa)
function lerNasc(s){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||"");if(!m)return null;
  const ano=+m[1],mes=+m[2]-1,dia=+m[3],d=new Date(ano,mes,dia);
  return d.getMonth()===mes&&d.getDate()===dia&&ano<=new Date().getFullYear()?{ano,mes,dia}:null;
}
// quem nasceu em 29/02 comemora em 28/02 nos anos que não têm esse dia
const bissexto=a=>new Date(a,1,29).getMonth()===1;
const ocorrencia=(x,ano)=>new Date(ano,x.mes,x.mes===1&&x.dia===29&&!bissexto(ano)?28:x.dia);
function idade(x,ano){const n=ano-x.ano;return n>0&&n<130?n:null;}
const hojeZero=()=>{const t=new Date();return new Date(t.getFullYear(),t.getMonth(),t.getDate());};
const porNome=(a,b)=>a.nome.localeCompare(b.nome,"pt-BR");
function proximos(n){
  const hoje=hojeZero(),out=[];
  (A.lista||[]).forEach(x=>{
    let d=ocorrencia(x,hoje.getFullYear());if(d<hoje)d=ocorrencia(x,hoje.getFullYear()+1);
    const dias=Math.round((d-hoje)/864e5);
    if(dias<=n)out.push({...x,d,dias});
  });
  return out.sort((a,b)=>a.dias-b.dias||porNome(a,b));
}

async function carregar(sb,pacientes){
  const pedido=++A.pedido;A.sb=sb;A.pacientes=pacientes;
  // a data que ela acabou de digitar na ficha pode estar esperando para salvar
  try{await window.TrilhaCase.flush();}catch(_){}
  const {data,error}=await sb.from("case_notes").select("patient_id,nasc:data->anamnese->>nascimento");
  if(error)throw error;
  const nasc={};(data||[]).forEach(r=>{const n=lerNasc(r.nasc);if(n)nasc[r.patient_id]=n;});
  // a anamnese que a paciente mandou pelo link só entra no caso quando a ficha é aberta: até lá, a data vem do envio
  try{
    const r=await sb.from("anamnese_envios").select("patient_id,nasc:data->>nascimento,aplicado_em").order("created_at");
    if(!r.error)(r.data||[]).forEach(e=>{const n=lerNasc(e.nasc);if(n&&!e.aplicado_em&&!nasc[e.patient_id])nasc[e.patient_id]=n;});
  }catch(_){}
  if(pedido!==A.pedido)return false; // chegou um pedido mais novo
  A.lista=pacientes.filter(p=>nasc[p.id]).map(p=>({id:p.id,nome:p.name,...nasc[p.id]})).sort(porNome);
  A.semData=pacientes.filter(p=>!nasc[p.id]).map(p=>({id:p.id,nome:p.name})).sort(porNome);
  A.erro=false;
  return true;
}

// o nome leva à ficha; nome e idade somem com o olhinho fechado
const nomeBtn=x=>'<button class="an-nome" data-act="aniv-abrir" data-arg="'+T.esc(x.id)+'" data-pv>'+T.esc(x.nome)+'</button>';
const anos=n=>n==null?"":' <span class="muted" data-pv>'+n+(n===1?" ano":" anos")+'</span>';
function quando(p){
  const dia=p.d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit"});
  return p.dias===0?"Hoje":p.dias===1?"Amanhã, "+dia:"Em "+p.dias+" dias, "+dia;
}
function proximosHTML(){
  const ps=proximos(DIAS_LISTA);
  return '<h4 class="an-tit">Próximos '+DIAS_LISTA+' dias</h4>'+(ps.length?'<ul class="an-prox">'+ps.map(p=>
    '<li'+(p.dias===0?' class="hoje"':'')+'><span class="an-quando">'+quando(p)+'</span><span>'+nomeBtn(p)+anos(idade(p,p.d.getFullYear()))+'</span></li>').join("")+'</ul>'
    :'<p class="hint">Nenhum aniversário nos próximos '+DIAS_LISTA+' dias.</p>');
}
function semDataHTML(){
  const n=A.semData.length;if(!n)return "";
  return '<details class="an-sem"><summary>'+(n===1?"1 paciente sem data de nascimento":n+" pacientes sem data de nascimento")+'</summary>'+
    '<p class="hint">Para aparecer no calendário, preencha a data na Anamnese da ficha.</p><div class="an-sem-lista">'+A.semData.map(nomeBtn).join("")+'</div></details>';
}
function mesHTML(m){
  const ano=A.ano,hoje=hojeZero(),dias=new Date(ano,m+1,0).getDate(),vazios=new Date(ano,m,1).getDay();
  const doMes=(A.lista||[]).filter(x=>x.mes===m).map(x=>({...x,no:ocorrencia(x,ano).getDate()})).sort((a,b)=>a.no-b.no||porNome(a,b));
  const marcados=new Set(doMes.map(x=>x.no));
  let cels=SEMANA.map(s=>'<span class="an-sem-dia">'+s+'</span>').join("")+'<span></span>'.repeat(vazios);
  for(let d=1;d<=dias;d++){
    const eHoje=hoje.getFullYear()===ano&&hoje.getMonth()===m&&hoje.getDate()===d;
    cels+='<span class="an-dia'+(marcados.has(d)?" on":"")+(eHoje?" hoje":"")+'">'+d+'</span>';
  }
  // a grade é só o desenho: quem lê com leitor de tela recebe a lista logo abaixo, que diz o mesmo
  return '<div class="an-mes'+(hoje.getFullYear()===ano&&hoje.getMonth()===m?" atual":"")+'"><h4>'+MESES[m]+'</h4><div class="an-grade" aria-hidden="true">'+cels+'</div>'+
    (doMes.length?'<ul class="an-lista">'+doMes.map(x=>'<li><b>'+String(x.no).padStart(2,"0")+'</b>'+nomeBtn(x)+anos(idade(x,ano))+'</li>').join("")+'</ul>':'')+'</div>';
}
function conteudo(){
  if(A.erro&&!A.lista)return '<section class="panel"><h3>Aniversários</h3><p class="hint">Não consegui carregar os aniversários. Confira a internet.</p></section>';
  if(!A.lista)return '<section class="panel"><h3>Aniversários</h3><p class="hint">Carregando…</p></section>';
  return '<section class="panel"><h3>Aniversários</h3><p class="hint">Das pacientes ativas, pela data de nascimento da Anamnese. É só um lembrete para você: nenhuma mensagem é enviada.</p>'+
    proximosHTML()+semDataHTML()+'</section>'+
    '<section class="panel"><div class="an-topo"><button class="btn ghost cx-small" data-an-ano="-1" aria-label="Ano anterior">‹</button><h3 aria-live="polite">'+A.ano+'</h3>'+
    '<button class="btn ghost cx-small" data-an-ano="1" aria-label="Próximo ano">›</button></div>'+
    '<div class="an-meses">'+MESES.map((_,m)=>mesHTML(m)).join("")+'</div></section>';
}
function pintar(){const el=document.getElementById("an-root");if(el)el.innerHTML=conteudo();}

document.addEventListener("click",e=>{
  const b=e.target.closest("[data-an-ano]");if(!b)return;
  A.ano+=Number(b.dataset.anAno);pintar();
  const de=document.querySelector('[data-an-ano="'+b.dataset.anAno+'"]');if(de)de.focus();
});

const hojeKey=()=>T.todayKey();
function dispensar(){try{localStorage.setItem(OK_KEY,hojeKey());}catch(_){}}
function dispensado(){try{return localStorage.getItem(OK_KEY)===hojeKey();}catch(_){return false;}}
// sem nomes de propósito (ver o começo do arquivo)
function aviso(){
  if(!A.lista||dispensado())return "";
  const ps=proximos(DIAS_AVISO),hoje=ps.filter(p=>p.dias===0).length,depois=ps.length-hoje;
  if(!ps.length)return "";
  const txt=hoje&&depois?"Hoje tem "+hoje+(hoje===1?" aniversário":" aniversários")+" e mais "+depois+" nos próximos "+DIAS_AVISO+" dias."
    :hoje?"Hoje tem "+hoje+(hoje===1?" aniversário.":" aniversários."):depois+(depois===1?" aniversário":" aniversários")+" nos próximos "+DIAS_AVISO+" dias.";
  return '<div class="panel an-aviso cx-received cx-noprint" id="an-aviso"><span>'+txt+'</span><span class="an-aviso-btns"><button class="btn ghost cx-small" data-act="aniv">Ver</button>'+
    '<button class="btn ghost cx-small" data-act="aniv-ok">Dispensar</button></span></div>';
}

window.TrilhaAniversarios={
  carregar,aviso,dispensar,
  html(){return '<div id="an-root" style="display:flex;flex-direction:column;gap:18px">'+conteudo()+'</div>';},
  mount(ctx){
    dispensar(); // abriu o calendário: o aviso de hoje já cumpriu o papel
    carregar(ctx.sb,ctx.pacientes).then(ok=>{if(ok)pintar();}).catch(()=>{A.erro=true;pintar();});
  }
};
})();
