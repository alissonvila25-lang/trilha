/* Biblioteca da psicóloga: materiais gerais (não ligados a uma paciente), em PDF ou imagem, que abrem
   como apresentação. Arquivos no Storage do Supabase (bucket privado "biblioteca", pasta = id do login
   dela) e a lista em library_docs. PowerPoint/Canva entram exportados como PDF. */
(function(){
"use strict";
const T=window.Trilha,esc=T.esc;
const BUCKET="biblioteca",MAX=50*1024*1024;
const KINDS={"application/pdf":"PDF","image/png":"Imagem","image/jpeg":"Imagem","image/webp":"Imagem","image/gif":"Imagem"};
const PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const L={sb:null,docs:null,error:false,busy:null,confirmDel:null,renaming:null,q:""};

async function userId(){
  const {data}=await L.sb.auth.getSession();
  return data&&data.session&&data.session.user&&data.session.user.id;
}
async function load(){
  try{
    const {data,error}=await L.sb.from("library_docs").select("id,title,path,mime,size,created_at").order("created_at");
    if(error)throw error;
    L.docs=(data||[]).sort((a,b)=>a.created_at<b.created_at?1:-1);L.error=false;
  }catch(_){L.error=true;}
  render();
}
const fmtSize=n=>n>=1048576?(n/1048576).toFixed(1).replace(".",",")+" MB":Math.max(1,Math.round(n/1024))+" KB";
const baseName=n=>n.replace(/\.[^.]+$/,"").replace(/[_]+/g," ").trim().slice(0,120)||"Sem título";
const ext=n=>{const m=/\.([a-z0-9]{1,5})$/i.exec(n);return m?"."+m[1].toLowerCase():"";};

function html(){return '<div id="lib-root"></div>';}
function render(){
  const root=document.getElementById("lib-root");if(!root)return;
  const q=L.q.trim().toLowerCase(),docs=(L.docs||[]).filter(d=>!q||d.title.toLowerCase().includes(q));
  root.innerHTML='<div class="panel"><h3>Biblioteca</h3>'+
      '<p class="hint">Seus materiais para as sessões, para usar com qualquer paciente. Aceita PDF e imagens, até 50 MB cada. '+
      'Apresentação do PowerPoint ou do Canva: salve como PDF e envie aqui — abre em tela cheia, uma página por vez.</p>'+
      '<div class="btns"><label class="btn'+(L.busy?" disabled":"")+'" style="cursor:pointer">+ Enviar arquivos<input type="file" id="lib-file" accept="application/pdf,image/png,image/jpeg,image/webp,image/gif" multiple hidden'+(L.busy?" disabled":"")+'></label>'+
        (L.busy?'<span class="muted" id="lib-busy">'+esc(L.busy)+'</span>':'')+'</div></div>'+
    (L.error?'<div class="panel"><p>Não consegui abrir a biblioteca. Confira a internet.</p><div class="btns"><button class="btn" data-lib="retry">Tentar de novo</button></div></div>'
    :L.docs==null?'<div class="panel"><p class="muted">Carregando…</p></div>'
    :!L.docs.length?'<div class="panel"><p class="hint">Nada aqui ainda. Envie o primeiro material.</p></div>'
    :(L.docs.length>6?'<input type="search" id="lib-q" placeholder="Procurar pelo nome" value="'+esc(L.q)+'" aria-label="Procurar na biblioteca" style="margin-bottom:12px">':'')+
     '<div class="lib-grid">'+docs.map(d=>{
      const kind=KINDS[d.mime]||"Arquivo",del=L.confirmDel===d.id,ren=L.renaming===d.id;
      return '<div class="panel lib-card"><div class="lib-top"><span class="lib-kind '+(kind==="PDF"?"pdf":"img")+'">'+kind+'</span>'+
          (ren?'<input type="text" id="lib-rename" value="'+esc(d.title)+'" maxlength="120" aria-label="Nome do material">':'<b class="lib-title">'+esc(d.title)+'</b>'+
           '<button class="'+(del?"btn warn cx-small":"icon-btn")+'" data-lib="del" data-id="'+d.id+'" aria-label="Apagar '+esc(d.title)+'">'+(del?"Apagar?":"×")+'</button>')+'</div>'+
        '<span class="muted lib-meta">'+fmtSize(d.size)+' · '+new Date(d.created_at).toLocaleDateString("pt-BR")+'</span>'+
        '<div class="btns">'+(ren?'<button class="btn cx-small" data-lib="rename-ok" data-id="'+d.id+'">Salvar</button><button class="btn ghost cx-small" data-lib="rename-no">Cancelar</button>'
          :'<button class="btn cx-small" data-lib="show" data-id="'+d.id+'">Apresentar</button>'+
           '<button class="btn ghost cx-small" data-lib="download" data-id="'+d.id+'">Baixar</button>'+
           '<button class="btn ghost cx-small" data-lib="rename" data-id="'+d.id+'">Renomear</button>')+'</div></div>';
    }).join("")+'</div>'+(docs.length?'':'<p class="hint">Nenhum material com esse nome.</p>'));
  const r=document.getElementById("lib-rename");if(r){r.focus();r.select();}
}

async function upload(files){
  const uidv=await userId();
  if(!uidv){T.toast("Sua sessão expirou. Saia e entre de novo.");return;}
  // só aparece um aviso por vez: junta tudo num resumo no fim
  let ok=0;const tipo=[],grande=[],falhou=[];
  for(const f of files){
    if(!KINDS[f.type]){tipo.push(f.name);continue;}
    if(f.size>MAX){grande.push(f.name);continue;}
    L.busy="Enviando "+f.name+"…";render();
    const path=uidv+"/"+Date.now().toString(36)+Math.random().toString(36).slice(2,8)+ext(f.name);
    try{
      const up=await L.sb.storage.from(BUCKET).upload(path,f,{contentType:f.type,upsert:false});
      if(up.error)throw up.error;
      const {error}=await L.sb.from("library_docs").insert({title:baseName(f.name),path,mime:f.type,size:f.size});
      if(error){await L.sb.storage.from(BUCKET).remove([path]).catch(()=>{});throw error;}
      ok++;
    }catch(_){falhou.push(f.name);}
  }
  L.busy=null;
  const msg=[ok?(ok===1?"Material enviado.":ok+" materiais enviados."):"",
    tipo.length?"Não entrou "+tipo.join(", ")+": só PDF e imagens (PowerPoint ou Canva: salve como PDF antes).":"",
    grande.length?"Passa de 50 MB: "+grande.join(", ")+" (no PDF, salve com qualidade menor).":"",
    falhou.length?"Não consegui enviar "+falhou.join(", ")+". Confira a internet e tente de novo.":""].filter(Boolean).join(" ");
  if(msg)T.toast(msg);
  await load();
}
async function signedUrl(d,download){
  const {data,error}=await L.sb.storage.from(BUCKET).createSignedUrl(d.path,3600,download?{download:d.title+ext(d.path)}:undefined);
  if(error||!data)throw error||new Error("sem url");
  return data.signedUrl;
}

/* ---------- apresentar: tela cheia, uma página por vez ---------- */
let pdfjsReady=null;
function loadPdfJs(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(!pdfjsReady)pdfjsReady=new Promise((res,rej)=>{
    const s=document.createElement("script");s.src=PDFJS+"pdf.min.js";
    s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+"pdf.worker.min.js";res(window.pdfjsLib);};
    s.onerror=()=>{pdfjsReady=null;rej(new Error("pdfjs"));};
    document.head.appendChild(s);
  });
  return pdfjsReady;
}
const V={el:null,doc:null,page:1,pages:1,img:null,title:"",rendering:null,again:false};
function viewerShell(title){
  closeViewer();
  const el=document.createElement("div");el.id="lib-viewer";el.className="lib-viewer";el.tabIndex=-1;
  el.setAttribute("role","dialog");el.setAttribute("aria-label","Apresentação: "+title);
  el.innerHTML='<div class="lib-vbar"><b class="lib-vtitle">'+esc(title)+'</b><span id="lib-vpage" class="lib-vpage"></span>'+
    '<button class="lib-vbtn" data-v="prev" aria-label="Página anterior">‹</button><button class="lib-vbtn" data-v="next" aria-label="Próxima página">›</button>'+
    '<button class="lib-vbtn" data-v="full" aria-label="Tela cheia">⛶</button><button class="lib-vbtn" data-v="close" aria-label="Fechar">✕</button></div>'+
    '<div class="lib-stage" id="lib-stage"><p class="lib-vmsg">Abrindo…</p></div>';
  document.body.appendChild(el);document.body.classList.add("lib-open");
  V.el=el;V.doc=null;V.img=null;V.page=1;V.pages=1;V.title=title;
  el.focus();
  return el;
}
function closeViewer(){
  if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  if(V.el){V.el.remove();V.el=null;}
  if(V.doc){V.doc.destroy();V.doc=null;}
  document.body.classList.remove("lib-open");
}
function setPageLabel(){const s=document.getElementById("lib-vpage");if(s)s.textContent=V.doc?V.page+" / "+V.pages:"";
  if(V.el){V.el.querySelector('[data-v="prev"]').disabled=!V.doc||V.page<=1;V.el.querySelector('[data-v="next"]').disabled=!V.doc||V.page>=V.pages;}}
async function renderPage(){
  if(!V.doc||!V.el)return;
  if(V.rendering){V.again=true;return;}
  const stage=document.getElementById("lib-stage");
  V.rendering=(async()=>{
    const page=await V.doc.getPage(V.page);
    const base=page.getViewport({scale:1}),w=stage.clientWidth||window.innerWidth,h=stage.clientHeight||window.innerHeight;
    const scale=Math.min(w/base.width,h/base.height),dpr=window.devicePixelRatio||1;
    const vp=page.getViewport({scale:scale*dpr});
    const c=document.createElement("canvas");c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);
    c.style.width=Math.floor(vp.width/dpr)+"px";c.style.height=Math.floor(vp.height/dpr)+"px";c.className="lib-canvas";
    await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
    if(V.el){stage.innerHTML="";stage.appendChild(c);}
  })();
  try{await V.rendering;}catch(_){}
  V.rendering=null;setPageLabel();
  if(V.again){V.again=false;renderPage();}
}
function go(n){if(!V.doc)return;const p=Math.max(1,Math.min(V.pages,V.page+n));if(p!==V.page){V.page=p;setPageLabel();renderPage();}}
async function show(d){
  viewerShell(d.title);
  const stage=document.getElementById("lib-stage");
  try{
    const url=await signedUrl(d,false);
    if(!V.el)return;
    if(d.mime==="application/pdf"){
      const lib=await loadPdfJs();
      V.doc=await lib.getDocument(url).promise;
      if(!V.el){V.doc.destroy();V.doc=null;return;}
      V.pages=V.doc.numPages;V.page=1;setPageLabel();await renderPage();
    }else{
      stage.innerHTML='<img class="lib-img" alt="'+esc(d.title)+'" src="'+esc(url)+'">';setPageLabel();
    }
  }catch(_){
    if(stage&&V.el)stage.innerHTML='<p class="lib-vmsg">Não consegui abrir este material. Confira a internet e tente de novo.</p>';
  }
}

document.addEventListener("click",async e=>{
  const v=e.target.closest("[data-v]");
  if(v&&V.el){
    const a=v.dataset.v;
    if(a==="close")closeViewer();else if(a==="prev")go(-1);else if(a==="next")go(1);
    else if(a==="full"){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else V.el.requestFullscreen&&V.el.requestFullscreen().catch(()=>{});}
    return;
  }
  // clicar nas laterais do slide também passa a página
  const st=e.target.closest("#lib-stage");
  if(st&&V.doc){const r=st.getBoundingClientRect();go(e.clientX<r.left+r.width/3?-1:e.clientX>r.right-r.width/3?1:0);return;}
  const b=e.target.closest("[data-lib]");if(!b)return;
  const act=b.dataset.lib,d=(L.docs||[]).find(x=>x.id===b.dataset.id);
  if(act!=="del")L.confirmDel=null;
  if(act==="retry"){L.error=false;L.docs=null;render();load();return;}
  if(!d&&act!=="rename-no")return;
  if(act==="show"){show(d);return;}
  if(act==="download"){
    try{const url=await signedUrl(d,true);const a=document.createElement("a");a.href=url;a.rel="noopener";document.body.appendChild(a);a.click();a.remove();}
    catch(_){T.toast("Não consegui baixar agora. Confira a internet.");}
    return;
  }
  if(act==="rename"){L.renaming=d.id;render();return;}
  if(act==="rename-no"){L.renaming=null;render();return;}
  if(act==="rename-ok"){
    const t=(document.getElementById("lib-rename").value||"").trim().slice(0,120);if(!t){T.toast("Escreva um nome.");return;}
    const {error}=await L.sb.from("library_docs").update({title:t}).eq("id",d.id);
    if(error){T.toast("Não consegui renomear. Confira a internet.");return;}
    d.title=t;L.renaming=null;render();return;
  }
  if(act==="del"){
    if(L.confirmDel!==d.id){L.confirmDel=d.id;render();return;}
    L.confirmDel=null;
    try{
      const rm=await L.sb.storage.from(BUCKET).remove([d.path]);if(rm.error)throw rm.error;
      const {error}=await L.sb.from("library_docs").delete().eq("id",d.id);if(error)throw error;
      L.docs=L.docs.filter(x=>x.id!==d.id);T.toast("Material apagado.");
    }catch(_){T.toast("Não consegui apagar. Confira a internet.");}
    render();return;
  }
});
document.addEventListener("change",e=>{if(e.target.id==="lib-file"&&e.target.files.length){const fs=[...e.target.files];e.target.value="";upload(fs);}});
document.addEventListener("input",e=>{if(e.target.id==="lib-q"){L.q=e.target.value;const pos=e.target.selectionStart;render();const q=document.getElementById("lib-q");if(q){q.focus();q.setSelectionRange(pos,pos);}}});
document.addEventListener("keydown",e=>{
  if(e.target.id==="lib-rename"){if(e.key==="Enter"){e.preventDefault();document.querySelector('[data-lib="rename-ok"]').click();}else if(e.key==="Escape"){L.renaming=null;render();}return;}
  if(!V.el)return;
  if(e.key==="Escape"&&!document.fullscreenElement){closeViewer();return;}
  if(["ArrowRight","PageDown"," "].includes(e.key)){e.preventDefault();go(1);}
  else if(["ArrowLeft","PageUp"].includes(e.key)){e.preventDefault();go(-1);}
});
// deslizar no celular/tablet
let tx=null;
document.addEventListener("touchstart",e=>{if(V.el&&e.target.closest("#lib-stage"))tx=e.touches[0].clientX;},{passive:true});
document.addEventListener("touchend",e=>{if(tx==null||!V.el)return;const dx=e.changedTouches[0].clientX-tx;tx=null;if(Math.abs(dx)>50)go(dx<0?1:-1);},{passive:true});
window.addEventListener("resize",()=>{if(V.doc)renderPage();});
document.addEventListener("fullscreenchange",()=>{if(V.doc)setTimeout(renderPage,100);});

window.TrilhaLibrary={
  html,
  mount(ctx){L.sb=ctx.sb;render();load();},
  close:closeViewer,
  _test:{V,L}
};
})();
