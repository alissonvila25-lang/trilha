/* Anamnese que a paciente preenche pelo link anamnese.html?p=CODIGO (o mesmo código do app dela).
   Ela só envia: as respostas vão para patient_send_anamnese e o painel leva para a ficha. Nada da
   ficha volta para cá. O rascunho fica neste aparelho até ela enviar. */
(function(){
"use strict";
const CFG=window.TRILHA_CONFIG,T=window.Trilha,esc=T.esc,Q=window.TRILHA_ANAMNESE;
// na planilha era uma lista de opções para marcar, que não veio junto: fica de fora até ter as opções
const SKIP=new Set(["assinale"]);
const token=(new URLSearchParams(location.search).get("p")||"").trim().toUpperCase();
const KEY="anamnese-rascunho-"+token;
const root=document.getElementById("form-root");

async function rpc(fn,args){
  const headers={"apikey":CFG.SUPABASE_ANON_KEY,"Content-Type":"application/json"};
  // a chave antiga (eyJ…) também vai no Authorization; a nova (sb_publishable_) não pode
  if(CFG.SUPABASE_ANON_KEY.startsWith("eyJ"))headers.Authorization="Bearer "+CFG.SUPABASE_ANON_KEY;
  const r=await fetch(CFG.SUPABASE_URL.replace(/\/+$/,"")+"/rest/v1/rpc/"+fn,{method:"POST",headers,body:JSON.stringify(args)});
  const body=await r.json().catch(()=>null);
  if(!r.ok){const e=new Error((body&&body.message)||"http "+r.status);e.server=true;throw e;}
  return body;
}

let draft={};
try{draft=JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(_){draft={};}
function saveDraft(){try{localStorage.setItem(KEY,JSON.stringify(draft));}catch(_){}}
function clearDraft(){try{localStorage.removeItem(KEY);}catch(_){}}

const panel=html=>{root.innerHTML='<section class="panel">'+html+'</section>';};
const invalid=()=>panel('<h3>Link inválido</h3><p class="hint">Confira se o link está completo, do jeito que a sua psicóloga enviou. Se não der certo, peça um link novo para ela.</p>');

function control(k,label,type){
  const v=esc(draft[k]||"");
  if(type==="date")return '<input type="date" data-k="'+k+'" value="'+v+'">';
  if(type)return '<input type="'+(type==="email"?"email":"text")+'" data-k="'+k+'" value="'+v+'"'+(k==="cpf"?' inputmode="numeric"':'')+(type==="email"?' autocomplete="email"':'')+'>';
  return '<textarea data-k="'+k+'" rows="3">'+v+'</textarea>';
}
function render(){
  root.innerHTML='<form class="an-form" id="an-form" novalidate>'+
    '<section class="panel"><h3>Antes de começar</h3><p class="hint">Estas perguntas ajudam a sua psicóloga a conhecer você. Responda com calma, do seu jeito. Pode deixar em branco o que não quiser responder agora.</p>'+
      '<p class="hint">Suas respostas vão só para ela. O que você escreve fica guardado neste aparelho até você enviar, então dá para parar e continuar depois.</p></section>'+
    Q.map(([g,fields])=>'<section class="panel"><h3>'+esc(g)+'</h3><div class="an-fields">'+
      fields.filter(([k])=>!SKIP.has(k)).map(([k,l,t])=>'<label>'+esc(l)+control(k,l,t)+'</label>').join("")+'</div></section>').join("")+
    '<div class="an-send"><button class="btn" type="submit" id="an-send" style="width:100%">Enviar para a psicóloga</button></div></form>';
  root.querySelectorAll("textarea").forEach(grow);
}
function grow(t){t.style.height="auto";if(t.scrollHeight)t.style.height=(t.scrollHeight+2)+"px";}

root.addEventListener("input",e=>{
  const k=e.target.dataset&&e.target.dataset.k;if(!k)return;
  draft[k]=e.target.value;saveDraft();
  if(e.target.tagName==="TEXTAREA")grow(e.target);
});
root.addEventListener("submit",async e=>{
  e.preventDefault();
  const data={};
  Q.forEach(([,fields])=>fields.forEach(([k])=>{const v=String(draft[k]||"").trim();if(v&&!SKIP.has(k))data[k]=v;}));
  if(!Object.keys(data).length){T.toast("Responda pelo menos uma pergunta antes de enviar.");return;}
  const b=document.getElementById("an-send");b.disabled=true;b.textContent="Enviando…";
  try{
    const ok=await rpc("patient_send_anamnese",{p_token:token,p_data:data});
    if(!ok){invalid();return;}
    clearDraft();draft={};
    panel('<h3>Recebido!</h3><p>Obrigada por responder. Sua psicóloga vai ler antes da próxima sessão.</p><p class="hint">Se lembrar de mais alguma coisa, é só contar na sessão.</p>');
    window.scrollTo(0,0);
  }catch(err){
    b.disabled=false;b.textContent="Enviar para a psicóloga";
    T.toast(err.server&&/muitos envios/.test(err.message)?"Já recebemos vários envios hoje. Tente de novo amanhã ou fale com a sua psicóloga."
      :"Não consegui enviar. Confira a internet e tente de novo — suas respostas continuam aqui.");
  }
});

(async function start(){
  if(!/^[A-Z0-9]{6,20}$/.test(token)){invalid();return;}
  let st;
  try{st=await rpc("patient_state",{p_token:token});}
  catch(_){panel('<h3>Sem conexão</h3><p class="hint">Não consegui abrir a ficha agora. Confira a internet e recarregue a página.</p>');return;}
  if(!st){invalid();return;}
  document.getElementById("hello").textContent="Ficha de anamnese · "+st.name;
  render();
})();
})();
