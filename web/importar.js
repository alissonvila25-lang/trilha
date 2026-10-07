/* Importar formulação antiga: lê a planilha "MODELO FORMULAÇÃO DE CASO" (.xlsx) e devolve o que achou
   em cada aba, no formato da Formulação. Cada pergunta é procurada pelo texto (com o endereço da planilha
   modelo como primeiro palpite) e a resposta pode estar na mesma célula, ao lado ou nas linhas de baixo.
   Nada aqui grava: case.js mostra o resumo e só preenche o que estiver vazio. */
(function(){
"use strict";
const XLSX_URL="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

const ANAMNESE=[["A1","E-mail:","email"],["A3","Nome completo:","nome"],["A5","Data de Nascimento:","nascimento"],["A7","CPF:","cpf"],
  ["A9","Grau de Escolaridade:","escolaridade"],["A11","Profissão:","profissao"],["A13","Religião:","religiao"],
  ["A15","Endereço completo (rua, número, bairro, cidade, estado, cep)","endereco"],["A17","Com quem você reside:","reside"],
  ["A19","Contato de segurança nº1 (Nome, grau de parentesco e telefone):","contato1"],["A21","Contato de segurança n°2 (Nome, grau de parentesco e telefone):","contato2"],
  ["A23","Qual pronome você prefere que eu use para me referir a você?","pronome"],["A25","Orientação sexual:","orientacao"],["A27","Identidade de gênero:","genero"],
  ["A29","Faz tratamento psiquiátrico? Se sim, há quanto tempo?","psiquiatrico"],
  ["A31","Você tem alguma condição médica atual ou houve alguma mudança na sua saúde geral neste último ano?","condicao"],
  ["A33","Algum familiar próximo (pais, irmãos ou avós) possui ou já possuiu diagnóstico de transtorno mental ou faz/fazia acompanhamento psicológico ou psiquiátrico?","familiar"],
  ["A35","Faz uso de medicação?","medicacao"],["A37","Você já fez psicoterapia antes?","psicoterapia"],
  ["A39","Descreva os motivos que o levaram a buscar atendimento psicológico:","motivos"],["A41","Descreva os objetivos que você gostaria de alcançar com a terapia:","objetivos"],
  ["A43","Assinale qualquer dos seguintes itens que se aplique a você:","assinale"],
  ["A45","Você apresentou ou já apresentou comportamentos autolesivos? Se sim, quais? Quando? Cortes, arranhões, queimaduras, beliscar..","autolesao"],
  ["A47","Como você ocupa a maior parte do seu tempo?","tempo"],["A49","Como anda a sua alimentação?","alimentacao"],["A51","Como anda seu sono?","sono"],
  ["A53","Você pratica alguma atividade física?","atividade"],["A55","A sua vida sexual atual é satisfatória?","sexual"],
  ["A57","Quando e como você conseguiu suas primeiras informações sobre sexo?","sexo_info"],["A59","Como você descreveria sua relação familiar?","familia"],
  ["A61","Você poderia contar alguma coisa sobre seus planos, esperanças e expectativas para o futuro?","futuro"],
  ["A63","Tem algo que não foi abordado neste questionário, que você ache importante me contar?","outros"]];
const CONCEIT=[["B4","Dados relevantes de história:","historia"],["B7","Crenças nucleares:","nucleares"],["B10","Crenças intermediárias/crenças regras:","intermediarias"],
  ["B14","Estratégias de enfrentamento:","estrategias"]];
const SIT=[["17","Situação 1:","situacao"],["19","Pensamento automático:","pensamento"],["23","Significado:","significado"],["25","Emoções:","emocoes"],["27","Comportamento:","comportamento"]];
const FORM=[["B2","Objetivo do tratamento: O que a paciente deseja alcançar com a terapia?","objetivo"],
  ["B5","Fatores de vulnerabilidade (gatilho), experiências tardias, histórico de vida relevante (traumas; violências; bullying; invalidação): Tudo que contribuiu para as dificuldades.","vulnerabilidade"],
  ["D5","Lista de problemas: Quais são as principais queixas trazidas pela paciente?","problemas"],
  ["B8","Modificadores Situacionais: (fatores externos) Quais fatores externos influenciam diretamente o problema (ex: ambiente familiar, trabalho, relacionamentos)?","modificadores"],
  ["D8","Fatores de manutenção: (fatores internos) Quais padrões de pensamento, comportamento ou emoção parecem manter os sintomas ativos? Há crenças centrais disfuncionais, distorções cognitivas ou esquemas rígidos?","manutencao"],
  ["B11","Obstáculos do tratamento: Quais fatores podem dificultar o progresso terapêutico (ex: resistência, baixa motivação, ambiente hostil)? A paciente tem dificuldade de adesão às estratégias propostas?","obstaculos"],
  ["D11","Pontos fortes e recursos: Quais são os recursos pessoais, relacionais ou contextuais que podem apoiar o tratamento? Quais são os talentos, habilidades ou aspectos positivos da paciente?","fortes"],
  ["B14","Hipótese diagnóstica: Qual e porquê (critérios diagnósticos)?","hipotese"],["D14","Medicamentos: Qual medicamento? Há quanto tempo? Quantos mg?","medicamentos"],
  // quadros das planilhas mais novas: sem endereço fixo, só pelo texto
  ["","Crenças centrais e pressupostos subjacentes:","crencas"],["","Sistemas Afetados:","sistemas"]];
const SISTEMAS={pensamentos:"pensamentos",comportamentos:"comportamentos",emocoes:"emocoes",reacoes:"reacoes"};
// textos de exemplo da planilha modelo (Valores e um lembrete na conceitualização): guardados só como
// impressão digital, para reconhecer e não importar como se fossem da paciente
const MODELO=new Set(["254497ff7bf40a33","ea79119650ee1274","d793d93e497c5087","20ffd32467bf482f","efcbb13c090cb5b6","403f2a2d5be8179a",
  "1ed1976057a6de63","8445029dcb0eb569","fa51243a39c29daf","c10fb9f42327bc40","7105136faae5e089"]);

const norm=s=>String(s==null?"":s).replace(/\r/g,"").split("\n").map(l=>l.replace(/\s+$/,"")).join("\n").trim();
const flat=s=>norm(s).replace(/\s+/g," ");
const key=s=>flat(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
async function hash(s){
  const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(flat(s)));
  return [...new Uint8Array(b)].slice(0,8).map(x=>x.toString(16).padStart(2,"0")).join("");
}
const pad=n=>String(n).padStart(2,"0");
// Date de outro "realm" (iframe, testes) não passa no instanceof
const isDate=v=>Object.prototype.toString.call(v)==="[object Date]";
const isoDate=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());

function loadXLSX(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  return new Promise((res,rej)=>{const s=document.createElement("script");s.src=XLSX_URL;s.onload=()=>res(window.XLSX);s.onerror=()=>rej(new Error("xlsx"));document.head.appendChild(s);});
}

async function parse(XLSX,buf){
  const wb=XLSX.read(buf,{type:"array",cellDates:true});
  const sheet=word=>{const n=wb.SheetNames.find(x=>key(x).includes(word));return n?wb.Sheets[n]:null;};
  const out={anamnese:{},vida:{eventos:[],historia:""},metas:[],valores:{},distorcoes:{},conceit:{situacoes:[{},{},{}]},plano:[],formulacao:{}};

  // ---- leitura de células ----
  const dec=a=>XLSX.utils.decode_cell(a),enc=(c,r)=>XLSX.utils.encode_cell({c,r});
  const raw=(ws,c,r)=>{const x=ws[enc(c,r)];return x&&x.v!=null?x.v:null;};
  const text=(ws,c,r)=>{const v=raw(ws,c,r);return v==null?"":isDate(v)?isoDate(v):norm(v);};
  const bounds=ws=>ws["!ref"]?XLSX.utils.decode_range(ws["!ref"]):{s:{c:0,r:0},e:{c:-1,r:-1}};
  const mergeAt=(ws,c,r)=>(ws["!merges"]||[]).find(m=>m.s.c<=c&&c<=m.e.c&&m.s.r<=r&&r<=m.e.r);
  // tira o rótulo da frente do texto da célula (a resposta às vezes foi escrita na mesma célula, embaixo da pergunta)
  function strip(cellText,label){
    const lk=key(label);let consumed="";const lines=cellText.split("\n");
    while(lines.length){
      const lk2=key(lines[0]);
      if(!lk2){lines.shift();continue;}
      if(lk.startsWith(consumed+lk2)){consumed+=lk2;lines.shift();if(consumed===lk)break;continue;}
      if((consumed+lk2).startsWith(lk)&&consumed.length<lk.length){
        // a resposta começa na mesma linha, depois do rótulo
        let need=lk.length-consumed.length,i=0,line=lines[0];
        while(i<line.length&&need>0){if(key(line[i]))need-=key(line[i]).length;i++;}
        lines[0]=line.slice(i).replace(/^[\s:.\-–—]+/,"");consumed=lk;break;
      }
      break;
    }
    return consumed.length>=Math.min(lk.length,12)?norm(lines.join("\n")):null;
  }
  function find(ws,addr,label){
    if(!ws)return null;
    const lk=key(label).slice(0,40);
    if(addr){const {c,r}=dec(addr);const t=text(ws,c,r);if(t&&key(t).startsWith(lk))return {c,r,t};}
    const b=bounds(ws);
    for(let r=b.s.r;r<=Math.min(b.e.r,400);r++)for(let c=b.s.c;c<=Math.min(b.e.c,30);c++){
      const t=text(ws,c,r);if(t&&key(t).startsWith(lk))return {c,r,t};
    }
    return null;
  }
  // resposta: o resto da própria célula + a célula logo ao lado + as linhas de baixo, até o próximo rótulo
  async function answer(ws,at,label,stopRows){
    const parts=[];
    const rest=strip(at.t,label);if(rest)parts.push(rest);
    const m=mergeAt(ws,at.c,at.r),c1=m?m.e.c:at.c,r1=m?m.e.r:at.r;
    const right=text(ws,c1+1,at.r);if(right&&!stopRows.has(at.r+":"+(c1+1)))parts.push(right);
    for(let r=r1+1;r<=r1+8;r++){
      if(stopRows.has(r+":"+at.c)||stopRows.has(r+":*"))break;
      const t=text(ws,at.c,r);if(t)parts.push(t);
    }
    const keep=[];for(const p of parts)if(!MODELO.has(await hash(p)))keep.push(p);
    return norm(keep.join("\n"));
  }

  // ---- anamnese ----
  let ws=sheet("anamnese");
  if(ws){
    const found=ANAMNESE.map(([a,l,k])=>({k,l,at:find(ws,a,l)})).filter(x=>x.at);
    const stops=new Set(found.map(x=>x.at.r+":"+x.at.c));
    for(const x of found){
      let v=await answer(ws,x.at,x.l,stops);
      if(x.k==="nascimento"){
        const below=raw(ws,x.at.c,x.at.r+1),right=raw(ws,x.at.c+1,x.at.r),d=[below,right].find(isDate);
        if(d)v=isoDate(d);
        else{const m=/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(v);if(m)v=m[3]+"-"+pad(m[2])+"-"+pad(m[1]);else if(!/^\d{4}-\d{2}-\d{2}$/.test(v))v="";}
      }
      if(x.k==="cpf"&&/^\d{9,11}$/.test(v))v=v.padStart(11,"0");
      if(v)out.anamnese[x.k]=v;
    }
  }

  // ---- linha da vida e história ----
  ws=sheet("linhadavida");
  if(ws){
    for(const [fase,word] of [["infancia","infancia"],["adolescencia","adolescencia"],["adulta","vidaadulta"]]){
      const at=find(ws,"",word);if(!at)continue;
      const m=mergeAt(ws,at.c,at.r),r1=m?m.e.r:at.r;
      const col=t=>{const a=[];for(let r=at.r;r<=r1;r++){const x=text(ws,at.c+t,r);if(x)a.push(x);}return a.join("\n");};
      const evento=col(1),impacto=col(2);
      if(evento||impacto)out.vida.eventos.push({fase,evento,impacto});
    }
  }
  ws=sheet("historiadevida");
  if(ws){
    const b=bounds(ws),a=[];
    for(let r=b.s.r;r<=Math.min(b.e.r,400);r++)for(let c=b.s.c;c<=Math.min(b.e.c,10);c++){
      let t=text(ws,c,r);if(!t)continue;
      if(key(t).startsWith("historiadevida"))t=strip(t,"HISTÓRIA DE VIDA")||"";
      if(t)a.push(t);
    }
    out.vida.historia=norm(a.join("\n\n"));
  }

  // ---- LDM ----
  ws=sheet("ldm")||sheet("metas");
  if(ws){
    const heads=[["dificuldade","Lista de dificuldades:"],["meta","Meta:"],["submetas","Submetas:"],["manutencao","Fatores de Manutenção:"],["obstaculos","Obstáculos:"]]
      .map(([k,l])=>({k,at:find(ws,"",l)})).filter(x=>x.at);
    const h0=heads.find(x=>x.k==="dificuldade");
    if(h0){
      const b=bounds(ws);
      for(let r=h0.at.r+1;r<=Math.min(b.e.r,h0.at.r+60);r++){
        const m={};heads.forEach(h=>{const t=text(ws,h.at.c,r);if(t)m[h.k]=t;});
        if(Object.keys(m).length)out.metas.push(m);
      }
    }
  }

  // ---- valores ----
  ws=sheet("valores");
  if(ws){
    const DOM=[["familia","RELAÇÕES FAMILIARES"],["casal","CASAMENTO / CASAL / INTIMIDADE"],["filhos","CUIDADOS MATERNAIS"],["amizades","AMIZADES / VIDA SOCIAL"],
      ["carreira","CARREIRA / EMPREGO/ FINANCEIRO"],["educacao","EDUCAÇÃO / DESENVOLVIMENTO PESSOAL"],["lazer","RECREAÇÃO / DIVERSÃO / LAZER"],
      ["espiritualidade","ESPIRITUALIDADE"],["cidadania","CIDADANIA / COMUNIDADE"],["saude","SAÚDE / BEM-ESTAR FÍSICO"]];
    const head=find(ws,"","IMPORTÂNCIA"),suc=find(ws,"","SUCESSO");
    const b=bounds(ws);
    for(const [k,l] of DOM){
      const lk=key(l);let row=null;
      // a linha da tabela (depois do cabeçalho IMPORTÂNCIA/SUCESSO), com "ÁREA - texto"
      for(let r=head?head.r+1:b.s.r;r<=Math.min(b.e.r,200);r++){const t=text(ws,1,r);if(t&&key(t).startsWith(lk)){row=r;break;}}
      if(row==null)continue;
      const t=text(ws,1,row);
      if(MODELO.has(await hash(t)))continue; // texto de exemplo da planilha modelo: não é dela
      const txt=norm(t.replace(/^[^-–—]*[-–—]\s*/,""));
      const n=v=>{const x=Number(v);return Number.isFinite(x)&&x>=1&&x<=10?Math.round(x):null;};
      const o={};if(txt&&key(txt)!==lk)o.texto=txt;
      if(head){const v=n(raw(ws,head.c,row));if(v!=null)o.imp=v;}
      if(suc){const v=n(raw(ws,suc.c,row));if(v!=null)o.suc=v;}
      if(Object.keys(o).length)out.valores[k]=o;
    }
  }

  // ---- distorções ----
  ws=sheet("distorc");
  if(ws){
    const b=bounds(ws),mine=find(ws,"","Meus Exemplos");
    const col=mine?mine.c:3;
    for(let r=b.s.r;r<=Math.min(b.e.r,80);r++){
      const m=/^\s*(\d{1,2})\s*[.)-]/.exec(text(ws,0,r));if(!m)continue;
      const i=Number(m[1]);if(i<1||i>15)continue;
      const ex=text(ws,col,r);if(ex)out.distorcoes["d"+i]={marcada:true,exemplos:ex};
    }
  }

  // ---- conceitualização ----
  ws=sheet("conceitualiz");
  if(ws){
    const tops=CONCEIT.map(([a,l,k])=>({k,l,at:find(ws,a,l)})).filter(x=>x.at);
    const sits=[];
    for(const [r,l,k] of SIT)["B","C","D"].forEach((col,i)=>{
      const at=find(ws,col+r,k==="situacao"?"Situação "+(i+1):l);
      // procura a da coluna certa: com rótulos iguais nas 3 colunas, o palpite de endereço é o que vale
      if(at&&XLSX.utils.encode_col(at.c)===col)sits.push({k,i,l,at});
    });
    const stops=new Set([...tops,...sits].map(x=>x.at.r+":"+x.at.c));
    for(const x of tops){const v=await answer(ws,x.at,x.l,stops);if(v)out.conceit[x.k]=v;}
    for(const x of sits){
      // nas situações, "ao lado" é a coluna da outra situação: só vale o que está embaixo
      const v=await answer(ws,{...x.at,t:x.at.t},x.l,new Set([...stops,...[0,1,2,3].map(d=>x.at.r+":"+(x.at.c+1+d))]));
      if(v)out.conceit.situacoes[x.i][x.k]=x.k==="situacao"?v.replace(/^\d+\s*[:.-]?\s*/,""):v;
    }
  }

  // ---- plano de tratamento ----
  ws=sheet("plano");
  if(ws){
    const h=find(ws,"","O que trabalhar"),porque=find(ws,"","Por que isso será trabalhado"),como=find(ws,"","Como trabalhar");
    if(h){
      const b=bounds(ws),fases=[];let atual=null;
      for(let r=h.r+1;r<=Math.min(b.e.r,h.r+120);r++){
        const nome=text(ws,1,r),item=text(ws,h.c,r);
        if(nome){atual={nome,porque:"",itens:[]};fases.push(atual);}
        if(!atual&&item){atual={nome:"Fase",porque:"",itens:[]};fases.push(atual);}
        if(!atual)continue;
        if(porque&&!atual.porque)atual.porque=text(ws,porque.c,r);
        if(item){
          const f=raw(ws,h.c+1,r);
          atual.itens.push({texto:item,como:como?text(ws,como.c,r):"",feito:f===true||/^(true|verdadeiro|sim|x|ok|✓|✔)$/i.test(String(f==null?"":f).trim())});
        }
      }
      out.plano=fases.filter(f=>f.itens.length);
    }
  }

  // ---- formulação ----
  ws=sheet("formulacaodecaso");
  if(ws){
    const found=FORM.map(([a,l,k])=>({k,l,at:find(ws,a,l)})).filter(x=>x.at);
    const stops=new Set(found.map(x=>x.at.r+":"+x.at.c));
    for(const x of found){
      // no modelo os quadros ficam lado a lado (B e D): a célula "ao lado" é vazia ou é o outro quadro
      const v=await answer(ws,x.at,x.l,new Set([...stops,x.at.r+":"+(x.at.c+1),x.at.r+":"+(x.at.c+2)]));
      if(!v)continue;
      if(x.k==="sistemas"){
        const o={};
        v.split("\n").forEach(line=>{const m=/^\s*[-•]?\s*([^:]+):\s*(.*)$/.exec(line);if(!m)return;const sk=SISTEMAS[key(m[1])];if(sk&&m[2].trim())o[sk]=m[2].trim();});
        if(Object.keys(o).length)out.formulacao.sistemas=o;
      }else out.formulacao[x.k]=v;
    }
  }
  return out;
}

// quanto achou em cada parte (para o resumo antes de importar)
function counts(f){
  const n=o=>Object.keys(o).length;
  return {anamnese:n(f.anamnese),vida:f.vida.eventos.length+(f.vida.historia?1:0),metas:f.metas.length,valores:n(f.valores),
    distorcoes:n(f.distorcoes),conceit:n(f.conceit)-1+f.conceit.situacoes.reduce((s,x)=>s+n(x),0),
    plano:f.plano.reduce((s,x)=>s+x.itens.length,0),formulacao:n(f.formulacao)};
}

window.TrilhaImport={loadXLSX,parse,counts};
})();
