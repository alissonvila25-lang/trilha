/* Consulta clínica: perguntas gerais à IA, sem dados de paciente. A IA procura nos PDFs da Biblioteca dela e
   pesquisa a literatura atual na internet (Edge Function analisar-caso, modo "consulta"); a resposta vem com
   as fontes numeradas e fica guardada na tabela consultas. */
(function(){
"use strict";
const T=window.Trilha,esc=T.esc;
const ERROS={"sem-chave":"A IA ainda não foi ligada: falta cadastrar a chave do Claude no Supabase.",login:"Sua sessão expirou. Saia e entre de novo.",
  permissao:"Este login não tem acesso à IA.",credito:"Os créditos da IA acabaram. É preciso recarregar na conta da Anthropic.",
  "chave-invalida":"A chave do Claude cadastrada no Supabase não está funcionando.",limite:"A IA está ocupada agora. Espere um minuto e tente de novo.",
  tamanho:"A pergunta precisa ter entre 10 e 4.000 caracteres.",
  "busca-desligada":"A pesquisa na internet está desligada na conta da Anthropic (Settings → Capabilities → Web search).",
  tempo:"A consulta passou do tempo limite. Tente uma pergunta mais específica."};
const AVISOS={corte:"[A resposta foi cortada por tamanho. Para o restante, pergunte de forma mais específica.]",
  tempo:"[A consulta passou do tempo limite e parou aqui. Tente uma pergunta mais específica.]",
  erro:"[A resposta parou no meio por uma falha. Pode perguntar de novo.]"};
const Q={sb:null,list:null,error:false,cur:null,busy:false,buscas:[],draft:"",confirmDel:null};

function html(){return '<div id="cq-root"></div>';}
async function load(){
  try{
    const {data,error}=await Q.sb.from("consultas").select("id,pergunta,resposta,fontes,created_at").order("created_at");
    if(error)throw error;
    Q.list=(data||[]).sort((a,b)=>a.created_at<b.created_at?1:-1);Q.error=false;
  }catch(_){Q.error=true;}
  render();
}
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,"");}catch(_){return "";}};
const safeUrl=u=>/^https?:\/\//i.test(String(u||""))?String(u):"";
function fontesHTML(fs){
  if(!fs||!fs.length)return "";
  return '<h4 class="cq-ftitle">Fontes</h4><ol class="cq-fontes">'+fs.map(f=>{
    if(f.tipo==="biblioteca")return '<li value="'+f.n+'"><span class="cq-src lib">Biblioteca</span> '+
      (f.doc?'<button class="linkish" data-cq="open" data-doc="'+esc(f.doc)+'" data-page="'+(f.pagina||1)+'">'+esc(f.titulo)+(f.pagina?', p. '+f.pagina:'')+'</button>':esc(f.titulo))+'</li>';
    const u=safeUrl(f.url);
    return '<li value="'+f.n+'"><span class="cq-src web">Internet</span> '+(u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(f.titulo||u)+'</a> <span class="muted">'+esc(host(u))+'</span>':esc(f.titulo))+'</li>';
  }).join("")+'</ol>';
}
function buscasHTML(){
  if(!Q.buscas.length)return '<li>Começando a pesquisa…</li>';
  return Q.buscas.map(b=>'<li>'+(b.onde==="biblioteca"?"Procurando na sua Biblioteca":"Pesquisando na internet")+': “'+esc(b.q)+'”</li>').join("");
}
function render(){
  const root=document.getElementById("cq-root");if(!root)return;
  const c=Q.cur;
  root.innerHTML='<div class="panel"><h3>Consulta clínica</h3>'+
      '<p class="hint">Pergunte sobre teoria, técnicas, diagnóstico diferencial, evidências… A IA procura nos PDFs da sua Biblioteca, pesquisa a literatura atual na internet e cruza as duas, citando as fontes. É apoio ao estudo e ao raciocínio clínico: confira as fontes antes de usar.</p>'+
      '<p class="cq-warn">Não escreva nomes nem dados que identifiquem pacientes aqui.</p>'+
      '<textarea id="cq-q" rows="3" maxlength="4000" aria-label="Sua pergunta" placeholder="Ex.: Quais as evidências atuais da TCC para insônia em adultos? O que mudou em relação ao que está no manual?"'+(Q.busy?" disabled":"")+'>'+esc(Q.draft)+'</textarea>'+
      '<div class="btns"><button class="btn" data-cq="ask"'+(Q.busy?" disabled":"")+'>'+(Q.busy?"Pesquisando…":"Perguntar")+'</button></div></div>'+
    (c?'<div class="panel cq-result"><span class="eyebrow">'+(c.created_at?new Date(c.created_at).toLocaleDateString("pt-BR"):"Agora")+'</span><h3 class="cq-question">'+esc(c.pergunta)+'</h3>'+
      (Q.busy?'<ul class="cq-buscas" id="cq-buscas" aria-live="polite">'+buscasHTML()+'</ul>':'')+
      '<div class="cx-pre cq-answer" id="cq-answer">'+esc(c.resposta)+'</div>'+
      (Q.busy?'':fontesHTML(c.fontes)+
        '<div class="btns"><button class="btn ghost cx-small" data-cq="copy">Copiar resposta</button>'+
        (c.id?'<button class="btn '+(Q.confirmDel===c.id?"warn":"ghost")+' cx-small" data-cq="del" data-id="'+c.id+'">'+(Q.confirmDel===c.id?"Apagar mesmo?":"Apagar")+'</button>':'')+
        '<button class="btn ghost cx-small" data-cq="close">Fechar</button></div>')+'</div>':'')+
    (Q.error?'<div class="panel"><p>Não consegui abrir as consultas anteriores. Confira a internet.</p><div class="btns"><button class="btn" data-cq="retry">Tentar de novo</button></div></div>'
    :Q.list&&Q.list.length?'<div class="panel"><h3>Consultas anteriores</h3><div class="cq-list">'+Q.list.map(x=>
      '<button class="cq-item'+(c&&c.id===x.id?" on":"")+'" data-cq="show" data-id="'+x.id+'"><span>'+esc(x.pergunta.length>140?x.pergunta.slice(0,140)+"…":x.pergunta)+'</span><small class="muted">'+new Date(x.created_at).toLocaleDateString("pt-BR")+'</small></button>').join("")+'</div></div>'
    :'');
}
function showAnswer(){const el=document.getElementById("cq-answer");if(el&&Q.cur)el.textContent=Q.cur.resposta;}
function showBuscas(){const el=document.getElementById("cq-buscas");if(el)el.innerHTML=buscasHTML();}

async function ask(){
  const el=document.getElementById("cq-q"),pergunta=(el?el.value:"").trim();
  if(pergunta.length<10){T.toast("Escreva a pergunta com um pouco mais de detalhe.");return;}
  Q.draft=pergunta;Q.busy=true;Q.buscas=[];Q.confirmDel=null;Q.cur={pergunta,resposta:"",fontes:[]};render();
  let out="",fontes=[],fim=null,erro=null,buf="";
  // o stream é texto, com quadros de controle "\u0000tipo:json\u0001" no meio
  const eat=final=>{
    for(;;){
      const i=buf.indexOf("\u0000");
      if(i<0){out+=buf;buf="";return;}
      out+=buf.slice(0,i);
      const j=buf.indexOf("\u0001",i);
      if(j<0){
        if(final){const m=/^\u0000FIM:(\w+)/.exec(buf.slice(i));if(m)fim=m[1];buf="";}
        else buf=buf.slice(i);
        return;
      }
      const fr=buf.slice(i+1,j),k=fr.indexOf(":");buf=buf.slice(j+1);
      let v;try{v=JSON.parse(fr.slice(k+1));}catch(_){continue;}
      const tipo=fr.slice(0,k);
      if(tipo==="busca"&&v&&typeof v.q==="string"){Q.buscas.push(v);showBuscas();}
      else if(tipo==="fim")fim=String(v);
      else if(tipo==="fontes"&&Array.isArray(v))fontes=v;
    }
  };
  try{
    const {data}=await Q.sb.auth.getSession();
    const tok=data&&data.session&&data.session.access_token;
    if(!tok)throw new Error("login");
    const cfg=window.TRILHA_CONFIG;
    const res=await fetch(cfg.SUPABASE_URL+"/functions/v1/analisar-caso",{method:"POST",
      headers:{"content-type":"application/json",authorization:"Bearer "+tok,apikey:cfg.SUPABASE_ANON_KEY},body:JSON.stringify({texto:pergunta,modo:"consulta"})});
    if(!res.ok){let j={};try{j=await res.json();}catch(_){}throw new Error(j.erro||"ia");}
    const rd=res.body.getReader(),dec=new TextDecoder();
    for(;;){
      const {value,done}=await rd.read();if(done)break;
      buf+=dec.decode(value,{stream:true});eat(false);
      Q.cur.resposta=out;showAnswer();
    }
    eat(true);
  }catch(e){erro=e&&e.message;}
  Q.busy=false;out=out.trim();
  if(out){
    const falha=fim||(erro?"erro":null);
    Q.cur={pergunta,resposta:out+(falha?"\n\n"+(AVISOS[falha]||AVISOS.erro):""),fontes};
    Q.draft="";
    try{
      const {data:row,error}=await Q.sb.from("consultas").insert({pergunta,resposta:Q.cur.resposta,fontes}).select("id,created_at").single();
      if(error)throw error;
      Q.cur.id=row.id;Q.cur.created_at=row.created_at;
      Q.list=[{...Q.cur},...(Q.list||[])];
    }catch(_){T.toast("A resposta chegou, mas não consegui guardar no histórico. Copie se for precisar.");render();return;}
    T.toast(falha?"A resposta veio incompleta.":"Pronto. As fontes estão no fim da resposta.");
  }else{
    Q.cur=null;
    const k=fim&&fim!=="corte"?fim:erro;
    T.toast(ERROS[k]||(k==="Failed to fetch"||!navigator.onLine?"Não consegui falar com a IA. Confira a internet e tente de novo.":"A IA não respondeu agora. Tente de novo em instantes."));
  }
  render();
}

document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-cq]");if(!b||!b.closest("#cq-root"))return;
  const act=b.dataset.cq;
  if(act!=="del")Q.confirmDel=null;
  if(act==="ask"){if(!Q.busy)ask();return;}
  if(act==="retry"){Q.error=false;Q.list=null;render();load();return;}
  if(act==="open"){window.TrilhaLibrary.open(Q.sb,b.dataset.doc,Number(b.dataset.page)||1);return;}
  if(act==="close"){Q.cur=null;render();return;}
  if(act==="show"){const x=(Q.list||[]).find(y=>y.id===b.dataset.id);if(x&&!Q.busy){Q.cur={...x};render();document.querySelector(".cq-result").scrollIntoView({block:"start"});}return;}
  if(act==="copy"){
    const c=Q.cur;if(!c)return;
    const txt=c.pergunta+"\n\n"+c.resposta+(c.fontes&&c.fontes.length?"\n\nFontes\n"+c.fontes.map(f=>"["+f.n+"] "+(f.tipo==="biblioteca"?"Biblioteca: "+f.titulo+(f.pagina?", p. "+f.pagina:""):(f.titulo||"")+" — "+f.url)).join("\n"):"");
    try{await navigator.clipboard.writeText(txt);T.toast("Resposta copiada, com as fontes.");}catch(_){T.toast("Não consegui copiar. Selecione o texto e use Ctrl+C.");}
    return;
  }
  if(act==="del"){
    const id=b.dataset.id;
    if(Q.confirmDel!==id){Q.confirmDel=id;render();return;}
    Q.confirmDel=null;
    const {error}=await Q.sb.from("consultas").delete().eq("id",id);
    if(error){T.toast("Não consegui apagar. Confira a internet.");render();return;}
    Q.list=(Q.list||[]).filter(x=>x.id!==id);Q.cur=null;T.toast("Consulta apagada.");render();return;
  }
});
document.addEventListener("input",e=>{if(e.target.id==="cq-q")Q.draft=e.target.value;});
document.addEventListener("keydown",e=>{if(e.target.id==="cq-q"&&e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();if(!Q.busy)ask();}});
window.addEventListener("beforeunload",e=>{if(Q.busy){e.preventDefault();e.returnValue="";}});

window.TrilhaConsulta={
  html,
  mount(ctx){Q.sb=ctx.sb;render();if(Q.list==null||Q.error)load();},
  busy:()=>Q.busy
};
})();
