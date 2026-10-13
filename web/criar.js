/* Criar com IA: materiais para as sessões (fichas, registros, psicoeducação, exercícios) e conteúdo para o Instagram
   dela, sem dados de paciente. A IA (Edge Function analisar-caso, modos "recurso" e "marketing") escreve numa marcação
   simples (# título, ## seção, - item, ___ linha para escrever, | tabela |) que aqui vira uma folha pronta para
   imprimir ou copiar. O recurso também procura na Biblioteca dela. Fica guardado na tabela criacoes. */
(function(){
"use strict";
const T=window.Trilha,esc=T.esc;
const ERROS={"sem-chave":"A IA ainda não foi ligada: falta cadastrar a chave do Claude no Supabase.",login:"Sua sessão expirou. Saia e entre de novo.",
  permissao:"Este login não tem acesso à IA.",credito:"Os créditos da IA acabaram. É preciso recarregar na conta da Anthropic.",
  "chave-invalida":"A chave do Claude cadastrada no Supabase não está funcionando.",limite:"A IA está ocupada agora. Espere um minuto e tente de novo.",
  tamanho:"O pedido ficou grande demais. Encurte o tema ou o ajuste.",
  "busca-desligada":"A pesquisa na internet está desligada na conta da Anthropic (Settings → Capabilities → Web search).",
  tempo:"A IA passou do tempo limite. Tente um pedido mais específico."};
const AVISOS={corte:"> O material foi cortado por tamanho. Peça um ajuste para deixar mais curto ou dividir em partes.",
  tempo:"> A IA passou do tempo limite e parou aqui. Tente de novo com um pedido mais específico.",
  erro:"> O texto parou no meio por uma falha. Pode tentar de novo."};

const TIPOS=[["recurso","Recurso para a sessão"],["marketing","Instagram"]];
const R_FORMATOS=[["ficha","Ficha de exercício"],["registro","Registro ou diário para preencher"],["psicoeducacao","Psicoeducação (texto explicativo)"],
  ["exercicio","Roteiro de exercício guiado (respiração, relaxamento, mindfulness)"],["tarefa","Tarefa de casa"],["hierarquia","Hierarquia de exposição"],
  ["cartao","Cartão de enfrentamento"],["dinamica","Dinâmica ou atividade para a sessão"],["outro","Outro (descreva no tema)"]];
const PUBLICOS=[["adulto","Adulto"],["adolescente","Adolescente"],["crianca","Criança"],["casal","Casal ou família"],["grupo","Grupo"]];
const M_FORMATOS=[["carrossel","Carrossel"],["post","Post único (arte e legenda)"],["reels","Roteiro de Reels"],["stories","Sequência de stories"],["ideias","Ideias de conteúdo para o mês"]];
const TONS=[["acolhedor","Acolhedor"],["educativo","Educativo, mais técnico"],["leve","Leve e descontraído"]];
const label=(list,k)=>(list.find(x=>x[0]===k)||list[0])[1];

const K={sb:null,tipo:"recurso",list:null,error:false,hist:true,cur:null,busy:false,buscas:[],confirmDel:null,edit:false,notasPrint:false,
  assin:"",assinOk:false,ajuste:"",
  form:{recurso:{formato:"ficha",tema:"",publico:"adulto",contexto:""},marketing:{formato:"carrossel",tema:"",publico:"",tom:"acolhedor"}}};

/* ---------- marcação → folha ---------- */
const inline=t=>esc(t).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/_{3,}/g,'<span class="cr-fill"></span>');
const isRow=l=>/^\s*\|.*\|\s*$/.test(l);
const isSep=l=>/^\s*\|[\s:|-]+\|\s*$/.test(l)&&l.includes("-");
function blocks(src){
  const L=String(src||"").replace(/\r/g,"").split("\n");let h="",i=0;
  const take=re=>{const out=[];while(i<L.length&&re.test(L[i].trim())){out.push(L[i].trim().replace(re,""));i++;}return out;};
  while(i<L.length){
    const t=L[i].trim();let m;
    if(!t){i++;continue;}
    if((m=/^(#{1,3})\s+(.*)$/.exec(t))){h+='<h'+(m[1].length+1)+' class="cr-t'+m[1].length+'">'+inline(m[2])+'</h'+(m[1].length+1)+'>';i++;continue;}
    if(/^_{3,}$/.test(t)){h+='<div class="cr-line"></div>';i++;continue;}
    if(/^\[[ xX]?\]\s+/.test(t)){h+='<ul class="cr-check">'+take(/^\[[ xX]?\]\s+/).map(x=>'<li><span class="cr-box" aria-hidden="true"></span>'+inline(x)+'</li>').join("")+'</ul>';continue;}
    if(/^[-*•]\s+/.test(t)){h+='<ul>'+take(/^[-*•]\s+/).map(x=>'<li>'+inline(x)+'</li>').join("")+'</ul>';continue;}
    if(/^\d+[.)]\s+/.test(t)){const n=Number(/^\d+/.exec(t)[0]);h+='<ol'+(n>1?' start="'+n+'"':'')+'>'+take(/^\d+[.)]\s+/).map(x=>'<li>'+inline(x)+'</li>').join("")+'</ol>';continue;}
    if(/^>\s?/.test(t)){h+='<div class="cr-call">'+take(/^>\s?/).map(inline).join("<br>")+'</div>';continue;}
    if(isRow(t)){
      const rows=[];while(i<L.length&&isRow(L[i])){if(!isSep(L[i]))rows.push(L[i].trim().slice(1,-1).split("|").map(c=>c.trim()));i++;}
      const n=Math.max(...rows.map(r=>r.length));
      const cells=(r,tag)=>Array.from({length:n},(_,k)=>'<'+tag+(tag==="td"&&!r[k]?' class="cr-empty"':'')+'>'+inline(r[k]||"")+'</'+tag+'>').join("");
      h+='<div class="cr-tablewrap"><table class="cr-table"><thead><tr>'+cells(rows[0],"th")+'</tr></thead><tbody>'+rows.slice(1).map(r=>'<tr>'+cells(r,"td")+'</tr>').join("")+'</tbody></table></div>';
      continue;
    }
    const par=[];
    while(i<L.length){const x=L[i].trim();if(!x||/^(#{1,3}\s|_{3,}$|\[[ xX]?\]\s|[-*•]\s|\d+[.)]\s|>)/.test(x)||isRow(x))break;par.push(x);i++;}
    h+='<p>'+par.map(inline).join("<br>")+'</p>';
  }
  return h;
}
// o material da paciente e as notas para a psicóloga (que não vão impressas)
const NOTAS=/^##\s*(notas\s+)?para\s+a\s+psic[oó]loga.*$/im;
function partes(texto){
  const m=NOTAS.exec(texto||"");
  return m?{main:texto.slice(0,m.index),notas:texto.slice(m.index+m[0].length)}:{main:texto||"",notas:""};
}
// marketing: cada "## " é um pedaço que ela copia separado (slide, legenda, hashtags)
function secoes(texto){
  const out=[];let cur=null;
  String(texto||"").replace(/\r/g,"").split("\n").forEach(l=>{
    const m=/^##\s+(.*)$/.exec(l.trim());
    if(m){cur={titulo:m[1].trim(),linhas:[]};out.push(cur);}
    else if(cur)cur.linhas.push(l);
  });
  return out.map(s=>({titulo:s.titulo,texto:s.linhas.join("\n").trim()}));
}
const plano=t=>String(t||"").replace(/^#{1,3}\s+/gm,"").replace(/\*\*/g,"").replace(/^\[[ xX]?\]\s+/gm,"☐ ").replace(/^>\s?/gm,"").trim();
const tituloDe=(texto,tema)=>{const m=/^#\s+(.+)$/m.exec(texto||"");return (m?m[1]:tema||"Sem título").replace(/\*\*/g,"").trim().slice(0,200)||"Sem título";};

/* ---------- dados ---------- */
async function load(){
  try{
    const {data,error}=await K.sb.from("criacoes").select("id,tipo,titulo,pedido,texto,fontes,created_at,updated_at").order("created_at");
    if(error){
      // banco ainda sem a tabela (schema.sql não rodado): cria igual, só não guarda
      if(/criacoes|relation|does not exist|schema cache/i.test(error.message||"")||error.code==="42P01"||error.code==="PGRST205"){K.hist=false;K.list=[];K.error=false;render();return;}
      throw error;
    }
    K.hist=true;K.list=(data||[]).sort((a,b)=>a.created_at<b.created_at?1:-1);K.error=false;
  }catch(_){K.error=true;}
  render();
}
async function loadAssin(){
  try{const {data}=await K.sb.auth.getUser();const md=data&&data.user&&data.user.user_metadata||{};K.assin=String(md.assinatura||"");}catch(_){}
  K.assinOk=true;render();
}
async function saveAssin(v){
  v=v.trim().slice(0,160);if(v===K.assin)return;
  try{const {error}=await K.sb.auth.updateUser({data:{assinatura:v}});if(error)throw error;K.assin=v;T.toast(v?"Assinatura salva para as próximas vezes.":"Assinatura apagada.");}
  catch(_){K.assin=v;T.toast("Usei a assinatura agora, mas não consegui guardar para as próximas vezes.");}
}

/* ---------- tela ---------- */
function html(){return '<div id="cr-root"></div>';}
const opt=(list,v)=>list.map(([k,l])=>'<option value="'+k+'"'+(k===v?" selected":"")+'>'+esc(l)+'</option>').join("");
const fmtDate=iso=>new Date(iso).toLocaleDateString("pt-BR");
function formHTML(){
  const f=K.form[K.tipo],dis=K.busy?" disabled":"";
  if(K.tipo==="recurso")return ''+
    '<p class="hint">Fichas, registros, psicoeducação e exercícios para usar na sessão ou mandar para casa. A IA procura primeiro nos documentos da sua Biblioteca e segue a abordagem deles. Sai uma folha pronta para imprimir ou salvar em PDF; as notas para você ficam fora da impressão.</p>'+
    '<div class="cr-grid"><label>O que criar<select data-crf="formato"'+dis+'>'+opt(R_FORMATOS,f.formato)+'</select></label>'+
    '<label>Para quem<select data-crf="publico"'+dis+'>'+opt(PUBLICOS,f.publico)+'</select></label></div>'+
    '<label>Tema e objetivo<textarea data-crf="tema" rows="2" maxlength="1500"'+dis+' placeholder="Ex.: registro de pensamentos para ansiedade antes de provas, com um exemplo preenchido">'+esc(f.tema)+'</textarea></label>'+
    '<label>Contexto, opcional<textarea data-crf="contexto" rows="2" maxlength="1500"'+dis+' placeholder="Ex.: paciente com pouca escolaridade, prefere frases curtas; já fez psicoeducação sobre ansiedade">'+esc(f.contexto)+'</textarea></label>';
  return ''+
    '<p class="hint">Ideias, carrosséis, legendas e roteiros para o seu Instagram, seguindo as regras de publicidade do CFP: conteúdo educativo, sem prometer resultado, sem preço e sem depoimento de paciente. Revise antes de postar.</p>'+
    '<div class="cr-grid"><label>Formato<select data-crf="formato"'+dis+'>'+opt(M_FORMATOS,f.formato)+'</select></label>'+
    '<label>Tom<select data-crf="tom"'+dis+'>'+opt(TONS,f.tom)+'</select></label></div>'+
    '<label>Tema<textarea data-crf="tema" rows="2" maxlength="1500"'+dis+' placeholder="Ex.: diferença entre ansiedade normal e transtorno de ansiedade">'+esc(f.tema)+'</textarea></label>'+
    '<label>Público, opcional<input type="text" data-crf="publico" maxlength="200"'+dis+' value="'+esc(f.publico)+'" placeholder="Ex.: mulheres adultas que trabalham e cuidam dos filhos"></label>'+
    '<label>Assinatura (nome e CRP)<input type="text" id="cr-assin" maxlength="160"'+dis+' value="'+esc(K.assin)+'" placeholder="Ex.: Psicóloga Beatriz Silva · CRP 06/123456"></label>'+
    '<p class="hint">A publicidade da psicóloga precisa ter nome e CRP. Fica guardada para as próximas vezes.</p>';
}
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,"");}catch(_){return "";}};
const safeUrl=u=>/^https?:\/\//i.test(String(u||""))?String(u):"";
function fontesHTML(fs){
  if(!fs||!fs.length)return "";
  return '<h4 class="cq-ftitle">Em que se baseou</h4><ul class="cq-fontes">'+fs.map(f=>{
    if(f.tipo==="biblioteca")return '<li><span class="cq-src lib">Biblioteca</span> '+
      (f.doc?'<button class="linkish" data-cr="open" data-doc="'+esc(f.doc)+'" data-page="'+(f.pagina||1)+'">'+esc(f.titulo)+(f.pagina?', p. '+f.pagina:'')+'</button>':esc(f.titulo))+'</li>';
    const u=safeUrl(f.url);
    return '<li><span class="cq-src web">Internet</span> '+(u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(f.titulo||u)+'</a> <span class="muted">'+esc(host(u))+'</span>':esc(f.titulo))+'</li>';
  }).join("")+'</ul>';
}
function buscasHTML(){
  if(!K.buscas.length)return '<li>'+(K.tipo==="recurso"?"Começando…":"Escrevendo…")+'</li>';
  const onde={biblioteca:"Procurando nos documentos da sua Biblioteca",web:"Conferindo na internet"};
  return K.buscas.map(b=>'<li>'+(onde[b.onde]||onde.web)+': “'+esc(b.q)+'”</li>').join("");
}
function sheetHTML(c){
  if(c.tipo==="marketing"){
    const m=/^#\s+(.+)$/m.exec(c.texto||""),ss=secoes(c.texto);
    if(!ss.length)return '<div class="cr-sheet cr-mkt">'+blocks(c.texto)+'</div>';
    // o que vier entre o título e a primeira seção (uma introdução) também aparece
    const intro=String(c.texto).split(/^##\s/m)[0].replace(/^#\s+.*$/m,"").trim();
    return '<div class="cr-mkt">'+(m?'<h2 class="cr-t1">'+inline(m[1])+'</h2>':'')+(intro?blocks(intro):'')+ss.map((s,i)=>
      '<section class="cr-sec"><div class="cr-sec-head"><h3>'+inline(s.titulo)+'</h3>'+(K.busy?'':'<button class="btn ghost cx-small" data-cr="copysec" data-i="'+i+'">Copiar</button>')+'</div>'+
      blocks(s.texto)+'</section>').join("")+'</div>';
  }
  const p=partes(c.texto);
  return '<article class="cr-sheet" id="cr-sheet">'+blocks(p.main)+(K.assin?'<footer class="cr-foot">'+esc(K.assin)+'</footer>':'')+'</article>'+
    (p.notas.trim()||(c.fontes&&c.fontes.length)?'<aside class="cr-notas'+(K.notasPrint?'':' cx-noprint')+'"><span class="eyebrow">Para você · não vai na impressão'+(K.notasPrint?' (desta vez vai)':'')+'</span>'+
      blocks(p.notas)+fontesHTML(c.fontes)+'</aside>':'');
}
function resultHTML(){
  const c=K.cur;if(!c)return "";
  const dis=K.busy?" disabled":"";
  return '<div class="panel cr-result"><span class="eyebrow cx-noprint">'+esc(label(TIPOS,c.tipo))+' · '+(c.created_at?fmtDate(c.created_at):"agora")+'</span>'+
    (K.busy?'<ul class="cq-buscas cx-noprint" id="cr-buscas" aria-live="polite">'+buscasHTML()+'</ul>':'')+
    (K.edit?'<label class="cx-noprint">Editar o texto<textarea id="cr-edit" rows="18">'+esc(c.texto)+'</textarea></label>'+
      '<p class="hint cx-noprint"># título · ## seção · - item · 1. passo · [ ] para marcar · ___ linha para escrever · | coluna | coluna | tabela · &gt; destaque · **negrito**</p>'+
      '<div class="btns cx-noprint"><button class="btn" data-cr="edit-save">Salvar edição</button><button class="btn ghost" data-cr="edit-cancel">Cancelar</button></div>'
     :'<div id="cr-out">'+sheetHTML(c)+'</div>')+
    (K.busy||K.edit?'':'<div class="cr-actions cx-noprint">'+
      '<div class="btns">'+(c.tipo==="recurso"?'<button class="btn" data-cr="print">Imprimir / PDF</button>':'')+
        '<button class="btn '+(c.tipo==="recurso"?"ghost":"")+'" data-cr="copy">Copiar tudo</button><button class="btn ghost" data-cr="edit">Editar texto</button>'+
        (c.id?'<button class="btn '+(K.confirmDel===c.id?"warn":"ghost")+'" data-cr="del" data-id="'+c.id+'">'+(K.confirmDel===c.id?"Apagar mesmo?":"Apagar")+'</button>':'')+
        '<button class="btn ghost" data-cr="close">Fechar</button></div>'+
      (c.tipo==="recurso"?'<label class="cx-inline cr-np"><input type="checkbox" id="cr-np" style="width:auto"'+(K.notasPrint?" checked":"")+'> Imprimir também as notas para você</label>':'')+
      '<label>Pedir um ajuste à IA<textarea id="cr-ajuste" rows="2" maxlength="1500"'+dis+' placeholder="'+(c.tipo==="recurso"?"Ex.: deixe mais curto, com linguagem para adolescente e um exemplo sobre a escola":"Ex.: menos slides, tom mais leve, gancho mais forte")+'">'+esc(K.ajuste)+'</textarea></label>'+
      '<div class="btns"><button class="btn ghost" data-cr="ajustar">Ajustar com IA</button></div></div>')+
  '</div>';
}
function listHTML(){
  if(K.error)return '<div class="panel cx-noprint"><p>Não consegui abrir o que você já criou. Confira a internet.</p><div class="btns"><button class="btn" data-cr="retry">Tentar de novo</button></div></div>';
  if(!K.hist)return '<div class="panel cx-noprint"><p class="hint">Para guardar o que você cria aqui, rode o <b>schema.sql</b> atualizado no Supabase (SQL Editor) e recarregue a página. Até lá dá para criar, imprimir e copiar, mas não fica salvo.</p></div>';
  const xs=(K.list||[]).filter(x=>x.tipo===K.tipo);if(!xs.length)return "";
  return '<div class="panel cx-noprint"><h3>Já criados</h3><div class="cq-list">'+xs.map(x=>
    '<button class="cq-item'+(K.cur&&K.cur.id===x.id?" on":"")+'" data-cr="show" data-id="'+x.id+'"><span>'+esc(x.titulo)+'</span><small class="muted">'+fmtDate(x.created_at)+'</small></button>').join("")+'</div></div>';
}
function render(){
  const root=document.getElementById("cr-root");if(!root)return;
  const dis=K.busy?" disabled":"";
  root.innerHTML='<div class="panel cx-noprint"><h3>Criar com IA</h3>'+
      '<div class="tabs" role="tablist">'+TIPOS.map(([k,l])=>'<button class="tab" role="tab" data-cr="tipo" data-k="'+k+'" aria-selected="'+(K.tipo===k)+'"'+dis+'>'+l+'</button>').join("")+'</div>'+
      formHTML()+
      '<p class="cq-warn">Não escreva nomes nem dados que identifiquem pacientes aqui.</p>'+
      '<div class="btns"><button class="btn" data-cr="criar"'+dis+'>'+(K.busy?"Criando…":"Criar")+'</button></div></div>'+
    resultHTML()+listHTML();
}
let raf=0;
function showOut(){
  if(raf)return;
  raf=requestAnimationFrame(()=>{raf=0;const el=document.getElementById("cr-out");if(el&&K.cur)el.innerHTML=sheetHTML(K.cur);});
}
function showBuscas(){const el=document.getElementById("cr-buscas");if(el)el.innerHTML=buscasHTML();}

/* ---------- pedir à IA ---------- */
function pedidoTexto(tipo,f){
  if(tipo==="recurso")return "Tipo de material: "+label(R_FORMATOS,f.formato)+"\nPara: "+label(PUBLICOS,f.publico)+"\nTema e objetivo: "+f.tema.trim()+
    (f.contexto.trim()?"\nContexto (sem identificação): "+f.contexto.trim():"");
  return "Formato: "+label(M_FORMATOS,f.formato)+"\nTema: "+f.tema.trim()+"\nPúblico: "+(f.publico.trim()||"não informado")+"\nTom: "+label(TONS,f.tom)+
    "\nAssinatura: "+(f.assinatura||"não informada");
}
async function stream(modo,texto,onText,onBusca){
  let out="",fontes=[],fim=null,buf="";
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
      if(tipo==="busca"&&v&&typeof v.q==="string")onBusca(v);
      else if(tipo==="fim")fim=String(v);
      else if(tipo==="fontes"&&Array.isArray(v))fontes=v;
    }
  };
  const {data}=await K.sb.auth.getSession();
  const tok=data&&data.session&&data.session.access_token;
  if(!tok)throw new Error("login");
  const cfg=window.TRILHA_CONFIG;
  const res=await fetch(cfg.SUPABASE_URL+"/functions/v1/analisar-caso",{method:"POST",
    headers:{"content-type":"application/json",authorization:"Bearer "+tok,apikey:cfg.SUPABASE_ANON_KEY},body:JSON.stringify({texto,modo})});
  if(!res.ok){let j={};try{j=await res.json();}catch(_){}throw new Error(j.erro||"ia");}
  const rd=res.body.getReader(),dec=new TextDecoder();
  try{
    for(;;){const {value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});eat(false);onText(out);}
    eat(true);
  }catch(_){fim=fim||"erro";}
  return {out:out.trim(),fontes,fim};
}
// ajuste = refaz em cima do material atual (o mesmo registro é atualizado)
async function criar(ajuste){
  const tipo=ajuste?K.cur.tipo:K.tipo;
  const f=ajuste?{...(K.cur.pedido||{})}:{...K.form[tipo]};
  if(!ajuste){
    if(f.tema.trim().length<5){T.toast("Escreva o tema com um pouco mais de detalhe.");return;}
    if(tipo==="marketing"){const a=document.getElementById("cr-assin");if(a)await saveAssin(a.value);f.assinatura=K.assin;}
  }
  let texto=pedidoTexto(tipo,{formato:"",tema:"",publico:"",contexto:"",tom:"",...f});
  const base=ajuste?K.cur:null;
  if(ajuste){
    const a=K.ajuste.trim();if(a.length<3){T.toast("Escreva o que quer mudar.");return;}
    texto+="\n\n"+(tipo==="recurso"?"MATERIAL ATUAL":"CONTEÚDO ATUAL")+":\n"+base.texto+"\n\nAJUSTE PEDIDO: "+a;
  }
  K.busy=true;K.buscas=[];K.confirmDel=null;K.edit=false;
  K.cur={...(base||{}),tipo,pedido:f,texto:"",fontes:[]};render();
  document.querySelector(".cr-result").scrollIntoView({block:"start"});
  let r=null,erro=null;
  try{r=await stream(tipo,texto,o=>{K.cur.texto=o;showOut();},b=>{K.buscas.push(b);showBuscas();});}catch(e){erro=e&&e.message;}
  K.busy=false;
  if(!r||!r.out){
    K.cur=base;
    const k=r&&r.fim&&r.fim!=="corte"?r.fim:erro;
    T.toast(ERROS[k]||(k==="Failed to fetch"||!navigator.onLine?"Não consegui falar com a IA. Confira a internet e tente de novo.":"A IA não respondeu agora. Tente de novo em instantes."));
    render();return;
  }
  const textoFinal=r.out+(r.fim?"\n\n"+(AVISOS[r.fim]||AVISOS.erro):"");
  K.cur={...K.cur,texto:textoFinal,fontes:r.fontes,titulo:tituloDe(textoFinal,f.tema)};
  if(ajuste)K.ajuste="";
  await guardar();
  T.toast(r.fim?"Veio incompleto.":ajuste?"Ajustado.":"Pronto. Revise antes de usar.");
  render();
}
async function guardar(){
  const c=K.cur;if(!K.hist||!c)return;
  try{
    if(c.id){
      const {error}=await K.sb.from("criacoes").update({titulo:c.titulo,texto:c.texto,fontes:c.fontes||[],pedido:c.pedido||{},updated_at:new Date().toISOString()}).eq("id",c.id);
      if(error)throw error;
      K.list=(K.list||[]).map(x=>x.id===c.id?{...x,...c}:x);
    }else{
      const {data:row,error}=await K.sb.from("criacoes").insert({tipo:c.tipo,titulo:c.titulo,pedido:c.pedido||{},texto:c.texto,fontes:c.fontes||[]}).select("id,created_at").single();
      if(error)throw error;
      c.id=row.id;c.created_at=row.created_at;K.list=[{...c},...(K.list||[])];
    }
  }catch(_){T.toast("Ficou pronto, mas não consegui guardar. Copie ou imprima se for precisar.");}
}

/* ---------- ações ---------- */
async function copiar(t,msg){try{await navigator.clipboard.writeText(t);T.toast(msg);}catch(_){T.toast("Não consegui copiar. Selecione o texto e use Ctrl+C.");}}
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-cr]");if(!b||!b.closest("#cr-root"))return;
  const act=b.dataset.cr,c=K.cur;
  if(act!=="del")K.confirmDel=null;
  if(act==="tipo"){if(K.busy)return;K.tipo=b.dataset.k;if(c&&c.tipo!==K.tipo&&!K.edit)K.cur=null;render();return;}
  if(act==="criar"){if(!K.busy)criar(false);return;}
  if(act==="ajustar"){if(!K.busy&&c)criar(true);return;}
  if(act==="retry"){K.error=false;K.list=null;render();load();return;}
  if(act==="open"){window.TrilhaLibrary.open(K.sb,b.dataset.doc,Number(b.dataset.page)||1);return;}
  if(act==="close"){K.cur=null;K.edit=false;render();return;}
  if(act==="show"){
    if(K.busy)return;
    const x=(K.list||[]).find(y=>y.id===b.dataset.id);if(!x)return;
    K.cur={...x};K.edit=false;K.ajuste="";render();document.querySelector(".cr-result").scrollIntoView({block:"start"});return;
  }
  if(act==="copy"&&c){
    const p=c.tipo==="recurso"?partes(c.texto).main:c.texto;
    copiar(plano(p)+(c.tipo==="recurso"&&K.assin?"\n\n"+K.assin:""),c.tipo==="recurso"?"Material copiado (sem as notas para você).":"Conteúdo copiado.");return;
  }
  if(act==="copysec"&&c){const s=secoes(c.texto)[Number(b.dataset.i)];if(s)copiar(plano(s.texto),s.titulo+" copiado.");return;}
  if(act==="print"&&c){
    document.body.classList.add("cr-printing");
    window.addEventListener("afterprint",()=>document.body.classList.remove("cr-printing"),{once:true});
    setTimeout(()=>window.print(),50);return;
  }
  if(act==="edit"){K.edit=true;render();const t=document.getElementById("cr-edit");if(t)t.focus();return;}
  if(act==="edit-cancel"){K.edit=false;render();return;}
  if(act==="edit-save"&&c){
    const v=document.getElementById("cr-edit").value.trim();
    if(!v){T.toast("O texto ficou vazio.");return;}
    c.texto=v;c.titulo=tituloDe(v,c.pedido&&c.pedido.tema);K.edit=false;await guardar();T.toast("Edição salva.");render();return;
  }
  if(act==="del"){
    const id=b.dataset.id;
    if(K.confirmDel!==id){K.confirmDel=id;render();return;}
    K.confirmDel=null;
    const {error}=await K.sb.from("criacoes").delete().eq("id",id);
    if(error){T.toast("Não consegui apagar. Confira a internet.");render();return;}
    K.list=(K.list||[]).filter(x=>x.id!==id);K.cur=null;T.toast("Apagado.");render();return;
  }
});
document.addEventListener("input",e=>{
  const t=e.target;if(!t.closest||!t.closest("#cr-root"))return;
  if(t.dataset.crf)K.form[K.tipo][t.dataset.crf]=t.value;
  else if(t.id==="cr-ajuste")K.ajuste=t.value;
});
document.addEventListener("change",e=>{
  const t=e.target;if(!t.closest||!t.closest("#cr-root"))return;
  if(t.id==="cr-np"){K.notasPrint=t.checked;render();}
  else if(t.id==="cr-assin"&&!K.busy)saveAssin(t.value);
});
document.addEventListener("keydown",e=>{
  if(e.key!=="Enter"||!(e.ctrlKey||e.metaKey)||K.busy)return;
  if(e.target.dataset&&e.target.dataset.crf){e.preventDefault();criar(false);}
  else if(e.target.id==="cr-ajuste"&&K.cur){e.preventDefault();criar(true);}
});
window.addEventListener("beforeunload",e=>{if(K.busy){e.preventDefault();e.returnValue="";}});

window.TrilhaCriar={
  html,
  mount(ctx){K.sb=ctx.sb;render();if(K.list==null||K.error)load();if(!K.assinOk)loadAssin();},
  busy:()=>K.busy,
  _test:{blocks,partes,secoes,plano,tituloDe}
};
})();
