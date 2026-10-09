/* Consulta clínica: perguntas gerais à IA, sem dados de paciente. A IA procura na memória (consultas que ela
   marcou como confiáveis), nos documentos que ela importou para a Biblioteca e na literatura atual da internet
   (Edge Function analisar-caso, modo "consulta"); a resposta vem com as fontes numeradas e fica guardada na
   tabela consultas. Enquanto ela escreve, aparecem as perguntas parecidas que já fez (de graça, sem IA). */
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
const Q={sb:null,list:null,error:false,cur:null,busy:false,buscas:[],draft:"",confirmDel:null,mem:true};

function html(){return '<div id="cq-root"></div>';}
async function load(){
  try{
    const COLS="id,pergunta,resposta,fontes,created_at";
    let {data,error}=await Q.sb.from("consultas").select(COLS+",confiavel").order("created_at");
    // banco ainda sem a memória (schema.sql não rodado): funciona, só sem o botão de confiável
    Q.mem=!error;
    if(error)({data,error}=await Q.sb.from("consultas").select(COLS).order("created_at"));
    if(error)throw error;
    Q.list=(data||[]).sort((a,b)=>a.created_at<b.created_at?1:-1);Q.error=false;
  }catch(_){Q.error=true;}
  render();
}
// perguntas parecidas: palavras em comum (sem acento, sem palavras vazias, comparando o começo da palavra)
const STOP=new Set(("a o as os de da do das dos e em no na nos nas num numa um uma uns umas para pra por com sem que qual quais como quando onde "+
  "e eh ser sao ha ao aos ou se sua seu suas seus mais menos muito muita sobre entre isso esse essa este esta pelo pela pelos pelas me te lhe "+
  "eu ele ela eles elas voce tem ter tenho fazer faz qual quais existe existem ainda").split(" "));
const norm=t=>String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const terms=t=>new Set(norm(t).split(/[^a-z0-9]+/).filter(w=>w.length>2&&!STOP.has(w)).map(w=>w.slice(0,6)));
function parecidas(q){
  const a=terms(q);if(a.size<2)return [];
  return (Q.list||[]).map(c=>{const b=terms(c.pergunta);let n=0;a.forEach(w=>{if(b.has(w))n++;});return {c,n,s:n/Math.max(1,Math.min(a.size,b.size))};})
    .filter(x=>x.n>=2&&x.s>=0.5).sort((x,y)=>y.s-x.s||(y.c.confiavel?1:0)-(x.c.confiavel?1:0)||(x.c.created_at<y.c.created_at?1:-1)).slice(0,3).map(x=>x.c);
}
const fmtDate=iso=>new Date(iso).toLocaleDateString("pt-BR");
const star=c=>c.confiavel?'<span class="cq-star" title="Confiável: entra na memória">★</span> ':'';
function simHTML(){
  if(Q.busy)return "";
  const list=parecidas(Q.draft);if(!list.length)return "";
  return '<div class="cq-sim"><span class="eyebrow">Você já perguntou algo parecido</span>'+list.map(c=>
    '<button class="cq-item" data-cq="show" data-id="'+c.id+'"><span>'+star(c)+esc(c.pergunta.length>140?c.pergunta.slice(0,140)+"…":c.pergunta)+'</span><small class="muted">'+fmtDate(c.created_at)+'</small></button>').join("")+
    '<p class="hint">Abrir uma destas é de graça. <b>Perguntar</b> faz uma consulta nova (e usa as que você marcou como confiáveis).</p></div>';
}
let simTimer=null;
function showSim(){const el=document.getElementById("cq-sim");if(el)el.innerHTML=simHTML();}
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,"");}catch(_){return "";}};
const safeUrl=u=>/^https?:\/\//i.test(String(u||""))?String(u):"";
function fontesHTML(fs){
  if(!fs||!fs.length)return "";
  return '<h4 class="cq-ftitle">Fontes</h4><ol class="cq-fontes">'+fs.map(f=>{
    if(f.tipo==="memoria")return '<li value="'+f.n+'"><span class="cq-src mem">Memória</span> '+
      (f.consulta?'<button class="linkish" data-cq="show" data-id="'+esc(f.consulta)+'">'+esc(f.titulo)+'</button>':esc(f.titulo))+
      (f.data?' <span class="muted">consulta de '+esc(f.data)+'</span>':'')+'</li>';
    if(f.tipo==="biblioteca")return '<li value="'+f.n+'"><span class="cq-src lib">Biblioteca</span> '+
      (f.doc?'<button class="linkish" data-cq="open" data-doc="'+esc(f.doc)+'" data-page="'+(f.pagina||1)+'">'+esc(f.titulo)+(f.pagina?', p. '+f.pagina:'')+'</button>':esc(f.titulo))+'</li>';
    const u=safeUrl(f.url);
    return '<li value="'+f.n+'"><span class="cq-src web">Internet</span> '+(u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(f.titulo||u)+'</a> <span class="muted">'+esc(host(u))+'</span>':esc(f.titulo))+'</li>';
  }).join("")+'</ol>';
}
function buscasHTML(){
  if(!Q.buscas.length)return '<li>Começando a pesquisa…</li>';
  const onde={memoria:"Procurando na memória (consultas confiáveis)",biblioteca:"Procurando nos documentos da sua Biblioteca",web:"Pesquisando na internet"};
  return Q.buscas.map(b=>'<li>'+(onde[b.onde]||onde.web)+': “'+esc(b.q)+'”</li>').join("");
}
function render(){
  const root=document.getElementById("cq-root");if(!root)return;
  const c=Q.cur;
  root.innerHTML='<div class="panel"><h3>Consulta clínica</h3>'+
      '<p class="hint">Pergunte sobre teoria, técnicas, diagnóstico diferencial, evidências… A IA procura primeiro nas consultas que você marcou como <b>confiáveis</b>, depois nos documentos da sua Biblioteca, e pesquisa a literatura atual na internet, cruzando tudo e citando as fontes. É apoio ao estudo e ao raciocínio clínico: confira as fontes antes de usar.</p>'+
      '<p class="cq-warn">Não escreva nomes nem dados que identifiquem pacientes aqui.</p>'+
      '<textarea id="cq-q" rows="3" maxlength="4000" aria-label="Sua pergunta" placeholder="Ex.: Quais as evidências atuais da TCC para insônia em adultos? O que mudou em relação ao que está no manual?"'+(Q.busy?" disabled":"")+'>'+esc(Q.draft)+'</textarea>'+
      '<div id="cq-sim">'+simHTML()+'</div>'+
      '<div class="btns"><button class="btn" data-cq="ask"'+(Q.busy?" disabled":"")+'>'+(Q.busy?"Pesquisando…":"Perguntar")+'</button></div></div>'+
    (c?'<div class="panel cq-result'+(c.confiavel?" trusted":"")+'"><span class="eyebrow">'+(c.created_at?fmtDate(c.created_at):"Agora")+(c.confiavel?' · ★ confiável, na memória':'')+'</span><h3 class="cq-question">'+esc(c.pergunta)+'</h3>'+
      (Q.busy?'<ul class="cq-buscas" id="cq-buscas" aria-live="polite">'+buscasHTML()+'</ul>':'')+
      '<div class="cx-pre cq-answer" id="cq-answer">'+esc(c.resposta)+'</div>'+
      (Q.busy?'':fontesHTML(c.fontes)+
        (c.id&&Q.mem?'<div class="cq-trust"><button class="btn '+(c.confiavel?"ghost":"")+' cx-small" data-cq="trust" data-id="'+c.id+'">'+(c.confiavel?"Tirar da memória":"★ Marcar como confiável")+'</button>'+
          '<span class="hint">'+(c.confiavel?"Esta resposta é usada como fonte nas próximas consultas parecidas.":"Revisou e está correta? Marque, e a IA passa a usar esta resposta nas próximas perguntas parecidas — pesquisando menos.")+'</span></div>':'')+
        '<div class="btns"><button class="btn ghost cx-small" data-cq="copy">Copiar resposta</button>'+
        (c.id?'<button class="btn '+(Q.confirmDel===c.id?"warn":"ghost")+' cx-small" data-cq="del" data-id="'+c.id+'">'+(Q.confirmDel===c.id?"Apagar mesmo?":"Apagar")+'</button>':'')+
        '<button class="btn ghost cx-small" data-cq="close">Fechar</button></div>')+'</div>':'')+
    (Q.error?'<div class="panel"><p>Não consegui abrir as consultas anteriores. Confira a internet.</p><div class="btns"><button class="btn" data-cq="retry">Tentar de novo</button></div></div>'
    :Q.list&&Q.list.length?'<div class="panel"><h3>Consultas anteriores</h3><div class="cq-list">'+Q.list.map(x=>
      '<button class="cq-item'+(c&&c.id===x.id?" on":"")+'" data-cq="show" data-id="'+x.id+'"><span>'+star(x)+esc(x.pergunta.length>140?x.pergunta.slice(0,140)+"…":x.pergunta)+'</span><small class="muted">'+new Date(x.created_at).toLocaleDateString("pt-BR")+'</small></button>').join("")+'</div></div>'
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
  if(act==="show"){
    if(Q.busy)return;
    const x=(Q.list||[]).find(y=>y.id===b.dataset.id);
    if(!x){T.toast("Esta consulta não está mais no histórico.");return;}
    Q.cur={...x};render();document.querySelector(".cq-result").scrollIntoView({block:"start"});return;
  }
  if(act==="copy"){
    const c=Q.cur;if(!c)return;
    const txt=c.pergunta+"\n\n"+c.resposta+(c.fontes&&c.fontes.length?"\n\nFontes\n"+c.fontes.map(f=>"["+f.n+"] "+(f.tipo==="biblioteca"?"Biblioteca: "+f.titulo+(f.pagina?", p. "+f.pagina:""):f.tipo==="memoria"?"Memória: consulta"+(f.data?" de "+f.data:"")+" — "+f.titulo:(f.titulo||"")+" — "+f.url)).join("\n"):"");
    try{await navigator.clipboard.writeText(txt);T.toast("Resposta copiada, com as fontes.");}catch(_){T.toast("Não consegui copiar. Selecione o texto e use Ctrl+C.");}
    return;
  }
  if(act==="trust"){
    const x=(Q.list||[]).find(y=>y.id===b.dataset.id);if(!x)return;
    const v=!x.confiavel;
    const {error}=await Q.sb.from("consultas").update({confiavel:v}).eq("id",x.id);
    if(error){T.toast("Não consegui salvar. Confira a internet.");return;}
    x.confiavel=v;if(Q.cur&&Q.cur.id===x.id)Q.cur.confiavel=v;
    T.toast(v?"Marcada como confiável: entra na memória da Consulta.":"Tirada da memória.");render();return;
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
document.addEventListener("input",e=>{if(e.target.id==="cq-q"){Q.draft=e.target.value;clearTimeout(simTimer);simTimer=setTimeout(showSim,250);}});
document.addEventListener("keydown",e=>{if(e.target.id==="cq-q"&&e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();if(!Q.busy)ask();}});
window.addEventListener("beforeunload",e=>{if(Q.busy){e.preventDefault();e.returnValue="";}});

window.TrilhaConsulta={
  html,
  mount(ctx){Q.sb=ctx.sb;render();if(Q.list==null||Q.error)load();},
  busy:()=>Q.busy
};
})();
