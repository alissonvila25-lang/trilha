/* Formulação de caso (painel da psicóloga): as abas da planilha "Modelo formulação de caso".
   Fica em case_notes, tabela separada de patients.config (que é entregue ao app da paciente) —
   isto é prontuário, só a psicóloga lê. Salva sozinho alguns instantes depois de ela parar de digitar. */
(function(){
"use strict";
const T=window.Trilha,esc=T.esc;

// em cima, o que ela usa em todo caso; ao lado, recursos que entram só quando fazem sentido
const MAIN=[["anamnese","Anamnese"],["metas","Metas (LDM)"],["formulacao","Formulação"],["conceit","Conceitualização"],["plano","Plano de tratamento"]];
const EXTRA=[["vida","Linha da vida"],["valores","Valores"],["distorcoes","Distorções"],["ia","Apoio da IA"]];
const SECTIONS=[...MAIN,...EXTRA];

// [chave, pergunta, tipo] — tipo vazio = texto longo
const ANAMNESE=[
  ["Identificação",[["email","E-mail","email"],["nome","Nome completo","short"],["nascimento","Data de nascimento","date"],["cpf","CPF","short"],
    ["escolaridade","Grau de escolaridade","short"],["profissao","Profissão","short"],["religiao","Religião","short"],["pronome","Qual pronome você prefere que eu use para me referir a você?","short"],
    ["orientacao","Orientação sexual","short"],["genero","Identidade de gênero","short"],
    ["endereco","Endereço completo (rua, número, bairro, cidade, estado, CEP)"],["reside","Com quem você reside"],
    ["contato1","Contato de segurança nº 1 (nome, grau de parentesco e telefone)"],["contato2","Contato de segurança nº 2 (nome, grau de parentesco e telefone)"]]],
  ["Saúde",[["psiquiatrico","Faz tratamento psiquiátrico? Se sim, há quanto tempo?"],["condicao","Você tem alguma condição médica atual ou houve alguma mudança na sua saúde geral neste último ano?"],
    ["familiar","Algum familiar próximo (pais, irmãos ou avós) possui ou já possuiu diagnóstico de transtorno mental ou faz/fazia acompanhamento psicológico ou psiquiátrico?"],
    ["medicacao","Faz uso de medicação?"],["psicoterapia","Você já fez psicoterapia antes?"],
    ["autolesao","Você apresentou ou já apresentou comportamentos autolesivos? Se sim, quais? Quando? (cortes, arranhões, queimaduras, beliscar…)"]]],
  ["Motivos e objetivos",[["motivos","Descreva os motivos que o levaram a buscar atendimento psicológico"],["objetivos","Descreva os objetivos que você gostaria de alcançar com a terapia"],
    ["assinale","Assinale qualquer dos seguintes itens que se aplique a você"]]],
  ["Rotina e relações",[["tempo","Como você ocupa a maior parte do seu tempo?"],["alimentacao","Como anda a sua alimentação?"],["sono","Como anda seu sono?"],
    ["atividade","Você pratica alguma atividade física?"],["sexual","A sua vida sexual atual é satisfatória?"],["sexo_info","Quando e como você conseguiu suas primeiras informações sobre sexo?"],
    ["familia","Como você descreveria sua relação familiar?"]]],
  ["Futuro",[["futuro","Você poderia contar alguma coisa sobre seus planos, esperanças e expectativas para o futuro?"],
    ["outros","Tem algo que não foi abordado neste questionário, que você ache importante me contar?"]]]
];
const ANAMNESE_KEYS=ANAMNESE.flatMap(g=>g[1].map(f=>f[0]));

const FASES_VIDA=[
  ["infancia","Infância","0 a 12 anos","Lembranças positivas; lembranças dolorosas ou desafiadoras; pessoas significativas."],
  ["adolescencia","Adolescência","13 a 18 anos","Momentos que marcaram sua identidade e escolhas; situações de alegria ou conquistas; dores, perdas ou dificuldades."],
  ["adulta","Vida adulta","a partir dos 19 anos","Eventos importantes (trabalho, estudos, relacionamentos, saúde); experiências de crescimento e orgulho; experiências difíceis, que deixaram marcas."]
];
const TIPOS_VIDA=[["positivo","Positiva / conquista"],["doloroso","Dolorosa / desafiadora"],["pessoa","Pessoa significativa"]];

// [chave, nome na planilha, rótulo curto do gráfico]
const DOMINIOS=[["familia","Relações familiares","Família"],["casal","Casamento / casal / intimidade","Casal"],["filhos","Cuidados maternais","Filhos"],
  ["amizades","Amizades / vida social","Amizades"],["carreira","Carreira / emprego / financeiro","Carreira"],["educacao","Educação / desenvolvimento pessoal","Educação"],
  ["lazer","Recreação / diversão / lazer","Lazer"],["espiritualidade","Espiritualidade","Espiritualidade"],["cidadania","Cidadania / comunidade","Cidadania"],
  ["saude","Saúde / bem-estar físico","Saúde"]];

const DISTORCOES=[
  ["Pensamento dicotômico","também chamado tudo ou nada, preto e branco ou polarizado","Vejo a situação, a pessoa ou o acontecimento apenas em termos de “uma coisa ou outra”, colocando-as em apenas duas categorias extremas em vez de em um contínuo.","“Eu cometi um erro, logo meu rendimento foi um fracasso”. “Comi mais do que pretendia, portanto estraguei completamente minha dieta”"],
  ["Previsão do futuro","também denominada catastrofização","Antecipo o futuro em termos negativos e acredito que o que acontecerá será tão horrível que eu não vou suportar.","“Vou fracassar e isso será insuportável.” “Vou ficar tão perturbado que não conseguirei me concentrar no exame.”"],
  ["Desqualificação dos aspectos positivos","","Desqualifico e desconto as experiências e acontecimentos positivos insistindo que estes não contam.","“Fui aprovado no exame, mas foi pura sorte.” “Entrar para a universidade não foi grande coisa, qualquer um consegue.”"],
  ["Raciocínio emocional","","Acredito que minhas emoções refletem o que as coisas realmente são e deixo que elas guiem minhas atitudes e julgamentos.","“Sinto que ela me ama, então deve ser verdade.” “Tenho pavor de aviões, logo voar deve ser perigoso.” “Meus sentimentos me dizem que não devo acreditar nele.”"],
  ["Rotulação","","Coloco um rótulo fixo, global e geralmente negativo em mim ou nos outros.","“Sou um fracassado.” “Ele é uma pessoa estragada.” “Ela é uma completa imbecil.”"],
  ["Ampliação / minimização","","Avalio a mim mesmo, os outros e as situações ampliando os aspectos negativos e/ou minimizando os aspectos positivos.","“Consegui um 8. Isto demonstra o quanto meu desempenho foi ruim.” “Consegui um 10. Isto significa que o teste foi muito fácil.”"],
  ["Abstração seletiva","também denominada filtro mental e visão em túnel","Presto atenção em um ou poucos detalhes e não consigo ver o quadro inteiro.","“Miguel apontou um erro em meu trabalho. Então, posso ser despedido” (não considerando o retorno positivo de Miguel). “Não consigo esquecer que aquela informação que dei durante minha apresentação estava errada” (deixando de considerar o sucesso da apresentação e o aplauso das pessoas)."],
  ["Leitura mental","","Acredito que conheço os pensamentos e intenções de outros (ou que eles conhecem meus pensamentos e intenções) sem ter evidências suficientes.","“Ele está pensando que eu falhei”. “Ela pensou que eu não conhecia o projeto.” “Ele sabe que eu não gosto de ser tocada deste jeito.”"],
  ["Supergeneralização","","Eu tomo casos negativos isolados e os generalizo, tornando-os um padrão interminável com o uso repetido de palavras como “sempre”, “nunca”, “todo”, “inteiro”, etc.","“Estava chovendo esta manhã, o que significa que choverá todo o fim de semana.” “Que azar! Perdi o avião, logo isto vai estragar minhas férias inteiras”. “Minha dor de cabeça nunca vai parar”."],
  ["Personalização","","Assumo que comportamentos dos outros e eventos externos dizem respeito (ou são direcionados) a mim, sem considerar outras explicações plausíveis.","“Senti-me mal porque a moça do caixa não me agradeceu” (sem considerar que ela não agradeceu a ninguém). “Meu marido me deixou porque eu fui uma má esposa” (não considerando que ela foi sua quarta esposa)."],
  ["Afirmações do tipo “deveria”","também “devia”, “devo”, “tenho de”","Digo a mim mesmo que os acontecimentos, os comportamentos de outras pessoas e minhas próprias atitudes “deveriam” ser da forma que espero que sejam e não o que de fato são.","“Eu devia ter sido uma mãe melhor”. “Ele deveria ter se casado com Ana em vez de Maria”. “Eu não devia ter cometido tantos erros.”"],
  ["Conclusões precipitadas","","Tiro conclusões (negativas ou positivas) a partir de nenhuma ou poucas evidências que possam confirmá-las.","“Logo que o vi, soube que ele faria um trabalho deplorável.” “Ele olhou para mim de um modo que logo concluí que ele foi o responsável pelo acidente.”"],
  ["Culpar outros ou a si mesmo","","Dirijo minha atenção aos outros como fontes de meus sentimentos e experiências, deixando de considerar minha própria responsabilidade; ou, inversamente, tomo para mim mesmo a responsabilidade pelos comportamentos e atitudes de outros.","“Meus pais são os únicos culpados por minha infelicidade.” “É culpa minha que meu filho tenha se casado com uma pessoa tão egoísta e descuidada.”"],
  ["E se...?","","Fico me fazendo perguntas do tipo “e se acontecer alguma coisa?”","“E se eu bater o carro?” “E se eu tiver um enfarte?” “E se meu marido me deixar?”"],
  ["Comparações injustas","","Comparo-me com outras pessoas que parecem se sair melhor do que eu e me coloco em posição de desvantagem.","“Meu pai prefere meu irmão mais velho a mim porque ele é mais inteligente do que eu.” “Estou triste porque ela tem mais sucesso do que eu.”"]
].map((x,i)=>({id:"d"+(i+1),name:x[0],aka:x[1],def:x[2],ex:x[3]}));

const CONCEIT_TOPO=[["historia","Dados relevantes da infância e da história","Que experiências contribuíram para o desenvolvimento e a manutenção da(s) crença(s) nuclear(es)?"],
  ["nucleares","Crenças nucleares","Quais são as crenças mais nucleares dela a respeito de si mesma, dos outros e do mundo?"],
  ["intermediarias","Pressupostos / crenças / regras condicionais","Que pressuposto positivo a ajudou a lidar com a(s) crença(s) nuclear(es)? Qual a contraparte negativa desse pressuposto? (“se… então…”, “eu deveria…”)"],
  ["estrategias","Estratégias compensatórias / de enfrentamento","Que comportamentos a ajudaram a lidar com a(s) crença(s)?"]];
const SITUACAO_CAMPOS=[["situacao","Situação","Qual foi a situação problemática?"],["pensamento","Pensamento automático","O que passou pela cabeça dela?"],
  ["significado","Significado do pensamento","O que o pensamento automático significou para ela?"],["emocoes","Emoções","Que emoção estava associada ao pensamento automático?"],
  ["comportamento","Comportamento","O que fez — e o que teve vontade de fazer (estratégia compensatória)"]];

const FORMULACAO=[
  ["objetivo","Objetivo do tratamento","O que a paciente deseja alcançar com a terapia?"],
  ["vulnerabilidade","Fatores de vulnerabilidade","Gatilhos, experiências tardias, histórico de vida relevante (traumas, violências, bullying, invalidação). Tudo que contribuiu para as dificuldades."],
  ["problemas","Lista de problemas","Quais são as principais queixas trazidas pela paciente?"],
  ["modificadores","Modificadores situacionais (fatores externos)","Quais fatores externos influenciam diretamente o problema (ex.: ambiente familiar, trabalho, relacionamentos)?"],
  ["manutencao","Fatores de manutenção (fatores internos)","Quais padrões de pensamento, comportamento ou emoção parecem manter os sintomas ativos? Há crenças centrais disfuncionais, distorções cognitivas ou esquemas rígidos?"],
  ["obstaculos","Obstáculos do tratamento","Quais fatores podem dificultar o progresso terapêutico (ex.: resistência, baixa motivação, ambiente hostil)? A paciente tem dificuldade de adesão às estratégias propostas?"],
  ["crencas","Crenças centrais e pressupostos subjacentes","Quais são as principais crenças dela sobre si, os outros e o mundo, e as regras ou pressupostos que derivam delas?"],
  ["sistemas","Sistemas afetados","Como o problema aparece em cada sistema."],
  ["fortes","Pontos fortes e recursos","Recursos pessoais, relacionais ou contextuais que podem apoiar o tratamento. Talentos, habilidades e aspectos positivos da paciente."],
  ["hipotese","Hipótese diagnóstica","Qual e por quê (critérios diagnósticos)?"],
  ["medicamentos","Medicamentos","Qual medicamento? Há quanto tempo? Quantos mg?"]
];

const SISTEMAS=[["pensamentos","Pensamentos"],["comportamentos","Comportamentos"],["emocoes","Emoções"],["reacoes","Reações (físicas)"]];
// valor de um quadro da formulação como texto (Sistemas afetados tem um campo por sistema)
function fval(d,k){
  if(k!=="sistemas")return str(d.formulacao[k]);
  const o=obj(d.formulacao.sistemas);
  return SISTEMAS.filter(([x])=>str(o[x])).map(([x,l])=>l+": "+str(o[x])).join("\n");
}

// o plano que já estava na planilha modelo — só entra se ela pedir, numa paciente com o plano vazio
const PLANO_MODELO=[
  {nome:"Fase inicial",porque:"Ampliar a motivação do tratamento; elevar o humor e trazer alívio; psicoeducação e socialização ao modelo.",itens:[
    ["Avaliação da depressão","Aplicação do BDI-II; avaliação clínica contínua"],
    ["Psicoeducação sobre depressão e ruminação","Psicoeducação sobre depressão, ruminação, esquiva emocional e ciclo cognitivo-comportamental"],
    ["Aumentar atividades prazerosas e de domínio","Agenda de atividades; lista personalizada de atividades prazerosas e funcionais"],
    ["Organização da rotina diária","Planejamento semanal; rotina mínima diária"],
    ["Regular e aumentar qualidade do sono","Higiene do sono; estabelecimento de horários regulares"],
    ["Ampliação da rede de apoio","Mapeamento de rede de apoio; estímulo a contatos seguros e graduais"]]},
  {nome:"Fase intermediária",porque:"Aquisição de habilidades; substituição de crenças disfuncionais por crenças adaptativas; resolução de longo prazo; dependem da atuação da fase inicial.",itens:[
    ["Diminuição da ruminação","Hora da ruminação; mindfulness; redirecionamento comportamental"],
    ["Reestruturação cognitiva","Checagem de evidências; pensamentos alternativos; seta descendente; experimentos comportamentais"],
    ["Autocompaixão","Psicoeducação sobre autocompaixão; exercícios compassivos; carta compassiva"],
    ["Flexibilidade psicológica","Técnicas de aceitação; desfusão cognitiva; identificação de valores"],
    ["Tolerância ao erro e à frustração","Exposição gradual ao erro; experimentos comportamentais; treino de assertividade"],
    ["Trabalho com imagem corporal e autoestima","Reestruturação cognitiva; exposição gradual; autocompaixão focada no corpo"]]},
  {nome:"Fase final",porque:"Finalização das metas a longo prazo e pontuais; prevenção de recaídas; manutenção dos ganhos.",itens:[
    ["Autonomia no gerenciamento dos sintomas","Revisão das estratégias eficazes; plano de manejo individual"],
    ["Prevenção de recaídas","Identificação de gatilhos; plano de ação para momentos críticos"],
    ["Integração da história de vida","Construção de narrativa integrada; diferenciação passado × presente"],
    ["Planejamento de vida e valores","Definição de metas alinhadas a valores pessoais"],
    ["Encerramento terapêutico","Revisão do processo terapêutico; reforço das conquistas"]]}
];

/* ---------- dados ---------- */
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const obj=x=>x&&typeof x==="object"&&!Array.isArray(x)?x:{};
const arr=x=>Array.isArray(x)?x:[];
const str=x=>String(x==null?"":x).trim();
const lines=s=>str(s).split(/\r?\n/).map(x=>x.replace(/^\s*(?:[-•*]|\d+[.)])\s*/,"").trim()).filter(Boolean);

function blank(){
  return {v:1,anamnese:{},vida:{infancia:[],adolescencia:[],adulta:[],historia:""},metas:[],valores:{atual:{},medicoes:[]},
    distorcoes:{},conceit:{situacoes:[{},{},{}]},formulacao:{},ia:{},
    plano:{fases:[["f1","Fase inicial"],["f2","Fase intermediária"],["f3","Fase final"]].map(([id,nome])=>({id,nome,porque:"",itens:[]}))}};
}
function normalize(raw){
  const d=obj(raw),b=blank();
  b.anamnese=obj(d.anamnese);
  const vida=obj(d.vida);FASES_VIDA.forEach(([k])=>b.vida[k]=arr(vida[k]).map(obj));b.vida.historia=vida.historia||"";
  b.metas=arr(d.metas).map(obj);
  const val=obj(d.valores);b.valores={atual:obj(val.atual),medicoes:arr(val.medicoes).map(obj)};
  b.distorcoes=obj(d.distorcoes);
  const c=obj(d.conceit);b.conceit={...c,situacoes:[0,1,2].map(i=>obj(arr(c.situacoes)[i]))};
  const fases=arr(obj(d.plano).fases).map(obj);
  if(fases.length)b.plano.fases=fases.map(f=>({...f,itens:arr(f.itens).map(obj)}));
  b.formulacao=obj(d.formulacao);
  b.ia=obj(d.ia);
  return b;
}
function setPath(o,path,v){
  const k=path.split(".");let x=o;
  for(let i=0;i<k.length-1;i++){if(x[k[i]]==null||typeof x[k[i]]!=="object")x[k[i]]=/^\d+$/.test(k[i+1])?[]:{};x=x[k[i]];}
  x[k[k.length-1]]=v;
}
const getPath=(o,path)=>path.split(".").reduce((x,k)=>x==null?undefined:x[k],o);

const num=x=>x===""||x==null||isNaN(Number(x))?null:Number(x);
function scoresOf(atual){const o={};DOMINIOS.forEach(([k])=>{const x=obj(atual[k]);o[k]={imp:num(x.imp),suc:num(x.suc)};});return o;}
// escore composto do VLQ (Wilson et al., 2010): média de importância × sucesso das áreas respondidas (1 a 100)
function vlq(sc){
  let s=0,n=0;DOMINIOS.forEach(([k])=>{const x=sc[k];if(x&&x.imp!=null&&x.suc!=null){s+=x.imp*x.suc;n++;}});
  return n?{score:Math.round(s/n),n}:null;
}
function age(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||""))return null;
  const b=T.keyDate(iso),t=new Date();let a=t.getFullYear()-b.getFullYear();
  if(t.getMonth()<b.getMonth()||(t.getMonth()===b.getMonth()&&t.getDate()<b.getDate()))a--;
  return a>=0&&a<130?a:null;
}
const fmtDate=k=>k?T.keyDate(k).toLocaleDateString("pt-BR"):"";
const fmtShort=k=>k?T.keyDate(k).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit"}):"";
function markedDistortions(d){return DISTORCOES.filter(x=>obj(d.distorcoes[x.id]).marcada);}
function planTotals(d){
  let done=0,total=0;d.plano.fases.forEach(f=>f.itens.forEach(it=>{total++;if(it.feito)done++;}));
  const atual=d.plano.fases.find(f=>f.itens.some(it=>!it.feito));
  return {done,total,pct:total?Math.round(done*100/total):0,atual:atual?str(atual.nome)||"—":(total?"Concluído":"—")};
}
function progress(d,k){
  const filled=keys=>keys.filter(x=>str(x)).length;
  if(k==="anamnese")return filled(ANAMNESE_KEYS.map(x=>d.anamnese[x]))+"/"+ANAMNESE_KEYS.length;
  if(k==="vida"){const n=FASES_VIDA.reduce((s,[f])=>s+d.vida[f].length,0);return n?n+" evento"+(n>1?"s":""):"vazia";}
  if(k==="metas")return d.metas.length?d.metas.length+" meta"+(d.metas.length>1?"s":""):"vazia";
  if(k==="valores"){const sc=scoresOf(d.valores.atual);return DOMINIOS.filter(([x])=>sc[x].imp!=null&&sc[x].suc!=null).length+"/10";}
  if(k==="distorcoes"){const n=markedDistortions(d).length;return n?n+" marcada"+(n>1?"s":""):"nenhuma";}
  if(k==="conceit")return filled([...CONCEIT_TOPO.map(([x])=>d.conceit[x]),...d.conceit.situacoes.flatMap(s=>SITUACAO_CAMPOS.map(([x])=>s[x]))])+"/19";
  if(k==="plano"){const t=planTotals(d);return t.total?t.pct+"%":"vazio";}
  if(k==="formulacao")return filled(FORMULACAO.map(([x])=>fval(d,x)))+"/"+FORMULACAO.length;
  if(k==="ia")return str(d.ia.resposta)?"resposta salva":"—";
  return "";
}
// pensamentos/emoções/comportamentos das 3 situações do diagrama, já com o sistema na frente
const sitLines=(d,k,l)=>d.conceit.situacoes.flatMap(s=>lines(s[k])).map(x=>l+": "+x);
// o que as outras abas já dizem sobre cada campo da formulação (ela decide se insere no texto)
function linked(d){
  const evs=t=>FASES_VIDA.flatMap(([k,nome])=>d.vida[k].filter(e=>e.tipo===t&&str(e.evento)).map(e=>str(e.evento)+" ("+(str(e.idade)?str(e.idade):nome.toLowerCase())+")"));
  const sc=scoresOf(d.valores.atual);
  return {
    objetivo:lines(d.anamnese.objetivos),
    vulnerabilidade:evs("doloroso"),
    problemas:d.metas.map(m=>str(m.dificuldade)).filter(Boolean),
    modificadores:lines(d.anamnese.reside).map(x=>"Reside com: "+x),
    crencas:[...lines(d.conceit.nucleares).map(x=>"Crença nuclear: "+x),...lines(d.conceit.intermediarias).map(x=>"Pressuposto / regra: "+x)],
    sistemas:[...sitLines(d,"pensamento","Pensamentos"),...sitLines(d,"emocoes","Emoções"),...sitLines(d,"comportamento","Comportamentos")],
    manutencao:[...markedDistortions(d).map(x=>"Distorção: "+x.name),...d.metas.flatMap(m=>lines(m.manutencao))],
    obstaculos:d.metas.flatMap(m=>lines(m.obstaculos)),
    fortes:[...evs("positivo"),...DOMINIOS.filter(([k])=>sc[k].suc!=null&&sc[k].suc>=7).map(([k,l])=>"Vai bem em "+l.toLowerCase()+" (sucesso "+sc[k].suc+")")],
    medicamentos:[...lines(d.anamnese.medicacao),...lines(d.anamnese.psiquiatrico).map(x=>"Psiquiatria: "+x)]
  };
}

/* ---------- estado, carregar e salvar ---------- */
const C={ctx:null,pid:null,sec:"anamnese",cache:{},load:{},dirty:{},saving:null,error:false,savedAt:null,
  printAll:false,onlyMarked:false,cmpIdx:0,confirmDel:null,iaDraft:null,iaRedacted:0,iaHyp:false,
  iaBusy:null,iaStream:"",iaConfirm:false};
const D=()=>C.cache[C.pid];

async function fetchCase(pid){
  const {data,error}=await C.ctx.sb.from("case_notes").select("data").eq("patient_id",pid);
  if(error)throw error;
  return normalize(data&&data[0]?data[0].data:null);
}
async function ensureLoaded(pid){
  if(C.load[pid]==="loading")return;
  const had=!!C.cache[pid];
  if(!had)C.load[pid]="loading";
  try{
    const d=await fetchCase(pid);
    // se ela começou a digitar enquanto buscava, o que está na tela vale mais que o do servidor
    if(!C.dirty[pid]&&C.saving===null){C.cache[pid]=d;}
    C.load[pid]="ok";
  }catch(e){
    // nunca deixa editar em cima de uma formulação que não carregou: salvar ia apagar a de verdade
    if(!had)C.load[pid]="error";
  }
  if(pid===C.pid)render();
}
let timer=null;
function schedule(){
  C.dirty[C.pid]=true;setStatus();
  clearTimeout(timer);timer=setTimeout(flush,900);
}
async function flush(){
  clearTimeout(timer);
  if(C.saving)return C.saving;
  const pids=Object.keys(C.dirty);if(!pids.length)return;
  C.saving=(async()=>{
    let failed=false;
    for(const pid of pids){
      delete C.dirty[pid];
      const snap=JSON.parse(JSON.stringify(C.cache[pid]));
      let error;
      try{({error}=await C.ctx.sb.from("case_notes").upsert({patient_id:pid,data:snap,updated_at:new Date().toISOString()}));}catch(e){error=e;}
      if(error){C.dirty[pid]=true;failed=true;}else C.savedAt=new Date();
    }
    C.error=failed;
  })();
  setStatus();
  await C.saving;C.saving=null;setStatus();
  if(C.error){clearTimeout(timer);timer=setTimeout(flush,5000);}
  else if(Object.keys(C.dirty).length)flush();
}
function statusText(){
  if(C.error)return "Não consegui salvar — tentando de novo…";
  if(C.saving)return "Salvando…";
  if(Object.keys(C.dirty).length)return "Alterações não salvas";
  if(C.savedAt)return "Salvo às "+C.savedAt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  return "Salva sozinha enquanto você digita";
}
function setStatus(){
  const el=document.getElementById("cx-status");
  if(el){el.textContent=statusText();el.classList.toggle("err",C.error);}
}

/* ---------- pedacinhos de HTML ---------- */
const val=p=>{const v=getPath(D(),p);return v==null?"":v;};
const ph=t=>t?' placeholder="'+esc(t)+'"':"";
function ta(path,placeholder,rows){return '<textarea data-cp="'+path+'" rows="'+(rows||2)+'"'+ph(placeholder)+'>'+esc(val(path))+'</textarea>';}
function inp(path,type,placeholder,extra){return '<input type="'+(type||"text")+'" data-cp="'+path+'" value="'+esc(val(path))+'"'+ph(placeholder)+(extra||"")+'>';}
function field(label,control,cls){return '<label class="cx-field'+(cls?" "+cls:"")+'"><span>'+label+'</span>'+control+'</label>';}
function delBtn(path,label){
  const on=C.confirmDel===path;
  return '<button class="'+(on?"btn warn cx-small":"icon-btn")+' cx-noprint" data-cx="del" data-arg="'+path+'" aria-label="'+esc(label)+'">'+(on?"Apagar?":"×")+'</button>';
}
const tag=(t,cls)=>'<span class="cx-tag'+(cls?" "+cls:"")+'">'+t+'</span>';

/* ---------- seções ---------- */
function anamneseHTML(){
  const d=D();
  return ANAMNESE.map(([g,fields])=>'<div class="panel"><h3>'+g+'</h3><div class="cx-grid">'+fields.map(([k,l,t])=>{
    const path="anamnese."+k;
    if(t){
      const a=k==="nascimento"?age(d.anamnese.nascimento):null;
      return field(esc(l)+(a!=null?" "+tag(a+" anos"):""),inp(path,t==="short"?"text":t,"",k==="cpf"?' inputmode="numeric" autocomplete="off"':' autocomplete="off"'));
    }
    return field(esc(l),ta(path),"cx-full");
  }).join("")+'</div></div>').join("");
}

function vidaHTML(){
  const d=D();
  return '<p class="hint">Os momentos que marcaram cada fase, e o impacto que deixaram. As lembranças dolorosas e positivas aparecem depois na Formulação, em vulnerabilidades e pontos fortes.</p>'+
    '<div class="cx-timeline">'+FASES_VIDA.map(([k,nome,idade,dica])=>
      '<section class="cx-phase"><div class="cx-phase-head"><h3>'+nome+'</h3><span class="muted">'+idade+'</span></div><p class="hint">'+dica+'</p>'+
      d.vida[k].map((ev,i)=>{
        const p="vida."+k+"."+i,tipo=TIPOS_VIDA.some(t=>t[0]===ev.tipo)?ev.tipo:"positivo";
        return '<div class="cx-event '+tipo+'"><div class="cx-event-top">'+
          '<select data-cp="'+p+'.tipo" aria-label="Tipo de lembrança">'+TIPOS_VIDA.map(([v,l])=>'<option value="'+v+'"'+(v===tipo?" selected":"")+'>'+l+'</option>').join("")+'</select>'+
          inp(p+".idade","text","Idade",' class="cx-age" aria-label="Idade"')+delBtn(p,"Apagar evento")+'</div>'+
          '<div class="cx-grid">'+field("Evento",ta(p+".evento"))+field("Impacto",ta(p+".impacto"))+'</div></div>';
      }).join("")+
      '<button class="btn ghost cx-noprint" data-cx="add-ev" data-arg="'+k+'">+ Evento na '+nome.toLowerCase()+'</button></section>').join("")+'</div>'+
    '<div class="panel"><h3>História de vida</h3>'+ta("vida.historia","Relato livre, com as palavras dela",6)+'</div>';
}

function metasHTML(){
  const d=D();
  return '<p class="hint">Lista de metas (LDM). As submetas podem virar atividades do app dela com um clique — uma por linha.</p>'+
    d.metas.map((m,i)=>{
      const p="metas."+i;
      return '<div class="panel cx-meta"><div class="cx-meta-head"><span class="cx-num">'+(i+1)+'</span>'+field("Dificuldade",inp(p+".dificuldade"),"cx-grow")+delBtn(p,"Apagar meta")+'</div>'+
        '<div class="cx-grid">'+field("Meta",ta(p+".meta"))+field("Submetas",ta(p+".submetas","Uma por linha",3))+
        field("Fatores de manutenção",ta(p+".manutencao"))+field("Obstáculos",ta(p+".obstaculos"))+'</div>'+
        '<div class="btns cx-noprint"><button class="btn ghost cx-small" data-cx="to-trilha" data-arg="'+i+'">→ Levar submetas para o app dela</button></div></div>';
    }).join("")+
    '<div class="btns cx-noprint"><button class="btn" data-cx="add-meta">+ Meta</button></div>';
}

function radarSVG(series){
  const W=460,H=330,cx=230,cy=165,R=112,N=DOMINIOS.length;
  const pt=(i,v)=>{const a=(-90+i*360/N)*Math.PI/180;return [cx+R*v/10*Math.cos(a),cy+R*v/10*Math.sin(a)];};
  let s='<svg class="cx-radar" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Gráfico de valores: importância e sucesso por área">';
  [2,4,6,8,10].forEach(r=>{s+='<polygon class="ring" points="'+DOMINIOS.map((_,i)=>pt(i,r).join(",")).join(" ")+'"/>';});
  DOMINIOS.forEach(([,,short],i)=>{
    const [x,y]=pt(i,10),[lx,ly]=pt(i,11.4),c=Math.cos((-90+i*360/N)*Math.PI/180);
    s+='<line class="axis" x1="'+cx+'" y1="'+cy+'" x2="'+x+'" y2="'+y+'"/>'+
      '<text x="'+lx+'" y="'+(ly+4)+'" text-anchor="'+(c>.3?"start":c<-.3?"end":"middle")+'">'+esc(short)+'</text>';
  });
  series.forEach(se=>{
    if(!se.vals.some(v=>v!=null))return;
    s+='<polygon class="'+se.cls+'" points="'+se.vals.map((v,i)=>pt(i,v||0).join(",")).join(" ")+'"/>';
    se.vals.forEach((v,i)=>{if(v!=null){const [x,y]=pt(i,v);s+='<circle class="'+se.cls+'" cx="'+x+'" cy="'+y+'" r="3"/>';}});
  });
  return s+'</svg>';
}
function valoresHTML(){
  const v=D().valores,sc=scoresOf(v.atual),comp=vlq(sc),meds=v.medicoes;
  const base=meds.length?meds[Math.min(C.cmpIdx,meds.length-1)]:null,baseSc=base?scoresOf(obj(base.notas)):null,baseComp=baseSc?vlq(baseSc):null;
  const gaps=DOMINIOS.map(([k,l])=>({l,imp:sc[k].imp,suc:sc[k].suc})).filter(x=>x.imp!=null&&x.suc!=null&&x.imp>=7&&x.imp-x.suc>=3).sort((a,b)=>(b.imp-b.suc)-(a.imp-a.suc));
  const opt=n=>'<option value="">—</option>'+[1,2,3,4,5,6,7,8,9,10].map(i=>'<option value="'+i+'"'+(n===i?" selected":"")+'>'+i+'</option>').join("");
  const delta=comp&&baseComp?comp.score-baseComp.score:null;
  return '<div class="panel cx-values"><div class="cx-values-top">'+
      radarSVG([...(baseSc?[{cls:"old",vals:DOMINIOS.map(([k])=>baseSc[k].suc)}]:[]),{cls:"imp",vals:DOMINIOS.map(([k])=>sc[k].imp)},{cls:"suc",vals:DOMINIOS.map(([k])=>sc[k].suc)}])+
      '<div class="cx-values-side">'+
        '<div class="cx-legend"><span><i class="imp"></i>Importância</span><span><i class="suc"></i>Sucesso</span>'+(base?'<span><i class="old"></i>Sucesso em '+fmtShort(base.data)+'</span>':'')+'</div>'+
        '<div><span class="eyebrow">Escore composto (VLQ)</span><div class="cx-big">'+(comp?comp.score:"—")+'<small>/100</small></div>'+
          '<span class="muted" style="font-size:13px">'+(comp?comp.n+" de 10 áreas respondidas":"Preencha importância e sucesso")+'</span>'+
          (delta!=null?'<p class="hint" style="margin-top:4px">'+baseComp.score+' em '+fmtShort(base.data)+' → '+comp.score+' agora '+(delta>0?'<span class="cmp-up">▲ +'+delta+'</span>':delta<0?'<span class="cmp-down">▼ '+delta+'</span>':'(sem mudança)')+'</p>':'')+'</div>'+
        (gaps.length?'<div><span class="eyebrow">Importante e distante</span><ul class="cx-gaps">'+gaps.map(g=>'<li><b>'+esc(g.l)+'</b> <span class="muted">importância '+g.imp+' · sucesso '+g.suc+'</span></li>').join("")+'</ul></div>':'')+
      '</div></div>'+
    '<div class="btns cx-noprint"><button class="btn ghost cx-small" data-cx="snap">Registrar medição de hoje</button>'+
      (meds.length?'<label class="cx-inline">Comparar com <select data-cxcmp aria-label="Medição para comparar">'+meds.map((m,i)=>'<option value="'+i+'"'+(i===Math.min(C.cmpIdx,meds.length-1)?" selected":"")+'>'+fmtDate(m.data)+(vlq(scoresOf(obj(m.notas)))?" · VLQ "+vlq(scoresOf(obj(m.notas))).score:"")+'</option>').join("")+'</select></label>':'')+'</div>'+
    '<p class="hint">Registre uma medição no começo e reaplique depois de alguns meses: o gráfico mostra o sucesso de antes (tracejado) contra o de agora.</p></div>'+
    '<div class="cx-grid">'+DOMINIOS.map(([k,l])=>'<div class="panel cx-dom"><h3>'+l+'</h3>'+ta("valores.atual."+k+".texto","O que é importante para ela nessa área?",3)+
      '<div class="cx-scores"><label class="cx-inline">Importância <select data-cp="valores.atual.'+k+'.imp" data-num aria-label="Importância de '+esc(l)+'">'+opt(sc[k].imp)+'</select></label>'+
      '<label class="cx-inline">Sucesso <select data-cp="valores.atual.'+k+'.suc" data-num aria-label="Sucesso em '+esc(l)+'">'+opt(sc[k].suc)+'</select></label></div></div>').join("")+'</div>'+
    '<p class="hint">Wilson, K.G., Sandoz, E.K., Kitchens, J. et al. The Valued Living Questionnaire: Defining and Measuring Valued Action within a Behavioral Framework. Psychol Rec 60, 249–272 (2010).</p>';
}

function distorcoesHTML(){
  const d=D(),marked=markedDistortions(d);
  const list=C.onlyMarked||C.printAll?marked:DISTORCOES;
  return '<div class="panel"><h3>Marcadas nela</h3>'+(marked.length?'<div class="cx-chips">'+marked.map(x=>tag(esc(x.name),"on")).join("")+'</div>':'<p class="hint">Toque no círculo ao lado de cada distorção que aparece nela. As marcadas aparecem também na Conceitualização e na Formulação.</p>')+
    '<div class="btns cx-noprint"><button class="btn ghost cx-small" data-cx="only" aria-pressed="'+C.onlyMarked+'">'+(C.onlyMarked?"Mostrar todas":"Mostrar só as marcadas")+'</button></div></div>'+
    '<div class="list">'+list.map(x=>{
      const r=obj(d.distorcoes[x.id]),on=!!r.marcada;
      return '<div class="cx-dist'+(on?" on":"")+'"><button class="cx-check" data-cx="mark" data-arg="'+x.id+'" aria-pressed="'+on+'" aria-label="Aparece nela: '+esc(x.name)+'">✓</button>'+
        '<div class="cx-dist-body"><b>'+esc(x.name)+'</b>'+(x.aka?' <span class="muted" style="font-size:13px">('+esc(x.aka)+')</span>':'')+
        '<p class="hint">'+esc(x.def)+'</p><details class="cx-noprint"><summary>Exemplos gerais</summary><p class="hint">'+esc(x.ex)+'</p></details>'+
        (on||str(r.exemplos)?field("Exemplos dela",ta("distorcoes."+x.id+".exemplos","Pensamentos dela que são exemplo disso")):'')+'</div></div>';
    }).join("")+'</div>';
}

function conceitHTML(){
  const d=D(),marked=markedDistortions(d);
  const box=(path,label,hint,cls)=>'<div class="cx-box'+(cls?" "+cls:"")+'"><span class="cx-box-label">'+label+'</span>'+ta(path,hint)+'</div>';
  const arrow='<div class="cx-arrow" aria-hidden="true"></div>';
  return '<p class="hint">Diagrama de conceitualização cognitiva (modelo de Judith Beck). Cada caixa é editável; as setas mostram o caminho da história até o comportamento.</p>'+
    '<div class="cx-diagram">'+CONCEIT_TOPO.map(([k,l,h],i)=>(i?arrow:"")+box("conceit."+k,l,h,"cx-top")).join("")+
    '<div class="cx-fork" aria-hidden="true"></div>'+
    (marked.length?'<div class="cx-chips cx-center"><span class="muted" style="font-size:13px">Distorções marcadas nela:</span>'+marked.map(x=>tag(esc(x.name),"on")).join("")+'</div>':'')+
    '<div class="cx-sits">'+[0,1,2].map(i=>'<div class="cx-sit">'+SITUACAO_CAMPOS.map(([k,l,h],j)=>(j?arrow:"")+box("conceit.situacoes."+i+"."+k,l+(k==="situacao"?" "+(i+1):""),h,k==="situacao"?"cx-sit-head":"")).join("")+'</div>').join("")+'</div></div>';
}

function planoHTML(){
  const d=D(),t=planTotals(d);
  return '<div class="panel cx-plan-sum"><div class="cx-plan-row"><div class="cx-big">'+t.pct+'<small>%</small></div><div><b>'+t.done+' de '+t.total+'</b> itens concluídos<br><span class="muted">Fase atual: <b>'+esc(t.atual)+'</b></span></div></div>'+
      '<div class="bar"><i style="width:'+t.pct+'%"></i></div>'+
      (t.total?'':'<div class="btns cx-noprint"><button class="btn ghost cx-small" data-cx="plan-template">Começar com o plano da planilha modelo</button><span class="hint">17 itens em 3 fases, para ajustar a esta paciente.</span></div>')+'</div>'+
    d.plano.fases.map((f,i)=>{
      const p="plano.fases."+i,n=f.itens.length,dn=f.itens.filter(x=>x.feito).length,cur=str(f.nome)===t.atual&&n>dn;
      return '<div class="panel cx-fase'+(cur?" current":"")+'"><div class="cx-fase-head">'+inp(p+".nome","text","Nome da fase",' class="cx-h3input" aria-label="Nome da fase"')+
        (cur?tag("fase atual","on"):"")+tag(dn+"/"+n)+'</div><div class="bar"><i style="width:'+(n?Math.round(dn*100/n):0)+'%"></i></div>'+
        field("Por que isso será trabalhado nessa fase (quais são os ganhos?)",ta(p+".porque"))+
        '<div class="list">'+f.itens.map((it,j)=>{
          const q=p+".itens."+j;
          return '<div class="cx-item'+(it.feito?" done":"")+'"><button class="cx-check" data-cx="done" data-arg="'+q+'" aria-pressed="'+!!it.feito+'" aria-label="Concluído">✓</button>'+
            '<div class="cx-item-body">'+inp(q+".texto","text","O que trabalhar",' aria-label="O que trabalhar"')+inp(q+".como","text","Como (ferramentas)",' aria-label="Como trabalhar"')+
            (it.feito&&it.data?'<span class="hint">Concluído em '+fmtDate(it.data)+'</span>':'')+'</div>'+delBtn(q,"Apagar item")+'</div>';
        }).join("")+'</div>'+
        '<div class="btns cx-noprint"><button class="btn ghost cx-small" data-cx="add-item" data-arg="'+i+'">+ Item</button></div></div>';
    }).join("");
}

function formulacaoHTML(){
  const d=D(),L=linked(d);
  return '<p class="hint">Embaixo de cada campo aparece o que as outras abas já dizem sobre ele. "Inserir no texto" copia só o que ainda não estiver escrito.</p>'+
    '<div class="cx-grid cx-form">'+FORMULACAO.map(([k,l,q])=>{
      const items=L[k]||[];
      const control=k==="sistemas"?'<div class="cx-sis">'+SISTEMAS.map(([x,sl])=>field(sl,ta("formulacao.sistemas."+x,"",2))).join("")+'</div>':ta("formulacao."+k,"",4);
      return '<div class="panel'+(k==="objetivo"?" cx-full":"")+'"><h3>'+l+'</h3><p class="hint">'+q+'</p>'+control+
        (items.length?'<div class="cx-linked cx-noprint"><span class="eyebrow">Das outras abas</span><ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul>'+
          '<button class="btn ghost cx-small" data-cx="insert" data-arg="'+k+'">Inserir no texto</button></div>':'')+'</div>';
    }).join("")+'</div>';
}

/* ---------- apoio da IA (caminho "copiar e colar": nada sai daqui sem ela copiar) ---------- */
const IA_PROMPT=[
"Você é um(a) psicólogo(a) clínico(a) experiente em Terapia Cognitivo-Comportamental, apoiando outra psicóloga no raciocínio diagnóstico de um caso. Os dados abaixo são de um caso real, anonimizados. A avaliação e o diagnóstico finais são da psicóloga responsável — seu papel é ajudar a pensar, não decidir.",
"",
"Responda em português, com estas seções:",
"1. Hipóteses diagnósticas a investigar (até 4, da mais para a menos provável). Para cada uma: critérios do DSM-5-TR que os dados sustentam, citando o trecho; critérios contrários ou ainda não avaliados; grau de confiança (baixo/médio/alto).",
"2. Diagnósticos diferenciais a descartar, e por quê.",
"3. Sinais de risco que pedem atenção imediata (ex.: autolesão, ideação suicida), se houver.",
"4. Perguntas para as próximas sessões e instrumentos/escalas que ajudariam a confirmar ou descartar cada hipótese.",
"5. Lacunas ou contradições na formulação.",
"",
"Regras: baseie-se somente no que está nos dados. Quando a informação não bastar, diga isso em vez de supor. Não invente sintomas nem histórico."
].join("\n");
const PARENTESCO=new Set(["mãe","mae","pai","irmã","irma","irmão","irmao","tia","tio","avó","avo","avô","esposo","esposa","marido","namorado","namorada","amiga","amigo","filho","filha","prima","primo","sogra","sogro","madrasta","padrasto","contato","telefone","nome","celular"]);
const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
// nomes que dá para saber que são identificação: os da própria paciente e os dos contatos de segurança
function identifiers(d,p){
  const words=s=>(String(s||"").match(/\p{Lu}\p{Ll}{2,}/gu)||[]).filter(w=>!PARENTESCO.has(w.toLowerCase()));
  const pac=[...new Set([...words(d.anamnese.nome),...words(p&&p.name)])];
  const outros=[...new Set([...words(d.anamnese.contato1),...words(d.anamnese.contato2)])].filter(w=>!pac.includes(w));
  return {pac,outros};
}
function redact(text,ids){
  let n=0;
  const rep=(re,s)=>{text=text.replace(re,()=>{n++;return s;});};
  rep(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g,"[e-mail]");
  rep(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,"[CPF]");
  rep(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g,"[telefone]");
  // diferencia maiúsculas: sobrenome que também é palavra comum (Paz, Rosa, Santos) não apaga "em paz" do relato
  const word=w=>new RegExp("(?<!\\p{L})(?:"+escRe(w)+"|"+escRe(w.toUpperCase())+")(?!\\p{L})","gu");
  ids.pac.forEach(w=>rep(word(w),"[paciente]"));
  ids.outros.forEach(w=>rep(word(w),"[nome]"));
  return {text,n};
}
// palavras com maiúscula no meio da frase: pode ser o nome de alguém que ela citou
function maybeNames(text){
  const seen=new Set();
  text=text.split("\n").filter(l=>!l.startsWith("#")).join("\n"); // títulos são nossos, não dela
  (text.match(/(?<=\p{Ll} )\p{Lu}\p{Ll}{2,}/gu)||[]).forEach(w=>seen.add(w));
  return [...seen].slice(0,20);
}
function iaData(d,withHyp){
  const out=[];
  const sec=(title,items)=>{items=items.filter(Boolean);if(items.length)out.push("## "+title+"\n"+items.join("\n"));};
  const one=s=>str(s).replace(/\s*\n+\s*/g," / ");
  const item=(label,v)=>str(v)?"- "+label.replace(/\?$/,"")+": "+one(v):null;
  const a=age(d.anamnese.nascimento);
  sec("Dados gerais",[a!=null?"- Idade: "+a+" anos":null,...[["pronome","Pronome"],["genero","Identidade de gênero"],["orientacao","Orientação sexual"],
    ["escolaridade","Escolaridade"],["profissao","Profissão"],["religiao","Religião"],["reside","Com quem reside"]].map(([k,l])=>item(l,d.anamnese[k]))]);
  ANAMNESE.slice(1).forEach(([g,fields])=>sec("Anamnese — "+g,fields.map(([k,l])=>item(l,d.anamnese[k]))));
  sec("Linha da vida",[...FASES_VIDA.flatMap(([k,nome])=>d.vida[k].filter(e=>str(e.evento)||str(e.impacto)).map(e=>
      "- "+nome+" · "+((TIPOS_VIDA.find(t=>t[0]===e.tipo)||TIPOS_VIDA[0])[1])+(str(e.idade)?" · "+one(e.idade):"")+": "+one(e.evento)+(str(e.impacto)?" — Impacto: "+one(e.impacto):""))),
    item("História de vida (relato livre)",d.vida.historia)]);
  sec("Lista de metas (LDM)",d.metas.filter(m=>hasContent(m)).map((m,i)=>"- Meta "+(i+1)+": "+[["dificuldade","Dificuldade"],["meta","Meta"],["submetas","Submetas"],
    ["manutencao","Fatores de manutenção"],["obstaculos","Obstáculos"]].filter(([k])=>str(m[k])).map(([k,l])=>l+": "+one(m[k])).join("; ")));
  const sc=scoresOf(d.valores.atual),comp=vlq(sc);
  sec("Valores (Valued Living Questionnaire, notas de 1 a 10)",[...DOMINIOS.filter(([k])=>sc[k].imp!=null||sc[k].suc!=null||str(obj(d.valores.atual[k]).texto)).map(([k,l])=>
      "- "+l+": importância "+(sc[k].imp==null?"—":sc[k].imp)+", sucesso "+(sc[k].suc==null?"—":sc[k].suc)+(str(obj(d.valores.atual[k]).texto)?" — "+one(obj(d.valores.atual[k]).texto):"")),
    comp?"- Escore composto: "+comp.score+"/100 ("+comp.n+" de 10 áreas)":null]);
  sec("Distorções cognitivas identificadas",markedDistortions(d).map(x=>"- "+x.name+(str(obj(d.distorcoes[x.id]).exemplos)?": "+one(obj(d.distorcoes[x.id]).exemplos):"")));
  sec("Conceitualização cognitiva (modelo de Beck)",[...CONCEIT_TOPO.map(([k,l])=>item(l,d.conceit[k])),
    ...d.conceit.situacoes.flatMap((s,i)=>hasContent(s)?["- Situação "+(i+1)+": "+SITUACAO_CAMPOS.filter(([k])=>str(s[k])).map(([k,l])=>(k==="situacao"?"":l+": ")+one(s[k])).join("; ")]:[])]);
  sec("Formulação de caso",FORMULACAO.filter(([k])=>k!=="hipotese"||withHyp).map(([k,l])=>item(k==="hipotese"?"Hipótese diagnóstica da psicóloga (comente)":l,fval(d,k))));
  return out.join("\n\n");
}
function iaHTML(){
  const d=D(),p=C.ctx.patient,ia=d.ia;
  if(C.iaDraft==null){
    const body=iaData(d,C.iaHyp);
    const r=body?redact(body,identifiers(d,p)):{text:"",n:0};
    C.iaDraft=body?IA_PROMPT+"\n\n# Dados do caso (anonimizados)\n\n"+r.text:"";C.iaRedacted=r.n;
  }
  const names=maybeNames(C.iaDraft.split("# Dados do caso")[1]||"");
  const busy=C.iaBusy===C.pid;
  return '<div class="panel"><h3>Antes de usar</h3><ul class="cx-gaps">'+
      '<li>Nome, CPF, e-mail, endereço, data de nascimento e contatos de segurança não entram. Nomes da paciente e dos contatos, telefones e e-mails escritos no meio dos textos são trocados por [paciente], [nome], [telefone].</li>'+
      '<li><b>Analisar com Claude</b> manda só o texto do quadro 1, pela conta do app: a Anthropic não usa esses dados para treinar modelos.</li>'+
      '<li>Se preferir copiar e colar em outra IA, use uma em que você <b>desligou o uso das conversas para treinar o modelo</b> (fica nas configurações de privacidade). Não use IA gratuita que não tenha essa opção.</li>'+
      '<li>A resposta é apoio para o seu raciocínio, não um diagnóstico.</li></ul></div>'+
    (C.iaDraft?
    '<div class="panel"><h3>1. Texto para a IA</h3>'+
      '<p class="hint">'+(C.iaRedacted?C.iaRedacted+" dado(s) identificável(is) trocado(s) automaticamente. ":"")+'Dá para editar aqui antes de enviar — as edições não ficam salvas.</p>'+
      (names.length?'<div class="cx-linked"><span class="eyebrow">Confira se alguma destas palavras é nome de alguém</span><div class="cx-chips">'+names.map(w=>tag(esc(w))).join("")+'</div><p class="hint">Se for, troque no texto antes de enviar.</p></div>':'')+
      '<textarea id="cx-ia-text" data-cxia rows="12" aria-label="Texto para a IA">'+esc(C.iaDraft)+'</textarea>'+
      '<label class="cx-inline"><input type="checkbox" data-cxhyp'+(C.iaHyp?" checked":"")+' style="width:auto"> Incluir a minha hipótese diagnóstica para a IA comentar</label>'+
      '<p class="hint">Desmarcado é melhor para uma segunda opinião sem influência; marcado, a IA comenta a sua hipótese.</p>'+
      '<div class="btns"><button class="btn" data-cx="ia-run"'+(C.iaBusy?" disabled":"")+'>'+(busy?"Analisando…":C.iaConfirm?"Substituir a resposta salva?":"Analisar com Claude")+'</button>'+
        '<button class="btn ghost" data-cx="ia-copy">Copiar texto</button>'+
        '<button class="btn ghost cx-small" data-cx="ia-regen">Gerar de novo</button></div>'+
      (C.iaConfirm?'<p class="hint">Já existe uma resposta salva. Clique de novo para trocar pela nova análise.</p>':'')+'</div>'
    :'<div class="panel"><p class="hint">Preencha a formulação primeiro — o texto para a IA é montado a partir das outras partes.</p></div>')+
    '<div class="panel"><h3>2. Resposta da IA</h3><p class="hint">'+(busy?'O Claude está escrevendo — costuma levar até 1 minuto. Pode continuar em outras partes; a resposta fica salva sozinha.'
      :'Aparece aqui quando você clica em Analisar com Claude. Se usou outra IA, cole a resposta aqui. Fica salva nesta formulação, separada da sua hipótese diagnóstica.'+(ia.data?' Resposta de '+fmtDate(ia.data)+'.':''))+'</p>'+
      (busy?'<textarea id="cx-ia-stream" readonly rows="6" aria-label="Resposta da IA">'+esc(C.iaStream)+'</textarea>':ta("ia.resposta","Cole a resposta aqui",6))+'</div>';
}
const IA_FIM="\u0000FIM:";
const IA_ERROS={"sem-chave":"A IA ainda não foi ligada: falta cadastrar a chave do Claude no Supabase.",login:"Sua sessão expirou. Saia e entre de novo.",
  permissao:"Este login não tem acesso à IA.",credito:"Os créditos da IA acabaram. É preciso recarregar na conta da Anthropic.",
  "chave-invalida":"A chave do Claude cadastrada no Supabase não está funcionando.",limite:"A IA está ocupada agora. Espere um minuto e tente de novo.",
  tamanho:"O texto está grande demais para enviar. Encurte os relatos mais longos."};
async function runIA(text){
  const pid=C.pid;
  C.iaBusy=pid;C.iaStream="";render();
  let out="",fim=null,erro=null;
  const show=()=>{const el=document.getElementById("cx-ia-stream");if(el&&C.pid===pid){el.value=out;grow(el);}};
  try{
    const {data}=await C.ctx.sb.auth.getSession();
    const tok=data&&data.session&&data.session.access_token;
    if(!tok)throw new Error("login");
    const cfg=window.TRILHA_CONFIG;
    const res=await fetch(cfg.SUPABASE_URL+"/functions/v1/analisar-caso",{method:"POST",
      headers:{"content-type":"application/json",authorization:"Bearer "+tok,apikey:cfg.SUPABASE_ANON_KEY},body:JSON.stringify({texto:text})});
    if(!res.ok){let j={};try{j=await res.json();}catch(_){}throw new Error(j.erro||"ia");}
    const rd=res.body.getReader(),dec=new TextDecoder();
    for(;;){
      const {value,done}=await rd.read();if(done)break;
      out+=dec.decode(value,{stream:true});
      const k=out.indexOf(IA_FIM);if(k>=0){fim=out.slice(k+IA_FIM.length);out=out.slice(0,k);}
      C.iaStream=out;show();
    }
  }catch(e){erro=e&&e.message;}
  C.iaBusy=null;C.iaStream="";
  out=out.trim();
  if(out){
    const d=C.cache[pid];
    d.ia.resposta=out+(fim==="corte"?"\n\n[A resposta foi cortada por tamanho. Para o restante, peça de novo com menos texto.]":fim==="erro"||erro?"\n\n[A resposta parou no meio por uma falha de conexão.]":"");
    d.ia.data=T.todayKey();
    C.dirty[pid]=true;flush();
  }
  if(C.pid===pid)render();
  if(out&&!fim&&!erro)T.toast("Análise pronta e salva na formulação.");
  else if(out)T.toast("A resposta veio incompleta. Pode tentar de novo.");
  else T.toast(IA_ERROS[erro]||(erro==="Failed to fetch"||!navigator.onLine?"Não consegui falar com a IA. Confira a internet e tente de novo.":"A IA não respondeu agora. Tente de novo em instantes."));
}
function iaPrintHTML(){
  const d=D();
  return '<div class="panel"><p class="hint">Sugestões geradas por inteligência artificial'+(d.ia.data?' em '+fmtDate(d.ia.data):'')+' a partir dos dados anonimizados. Apoio ao raciocínio clínico — não constituem diagnóstico.</p>'+ta("ia.resposta","",6)+'</div>';
}

const RENDER={ia:iaHTML,anamnese:anamneseHTML,vida:vidaHTML,metas:metasHTML,valores:valoresHTML,distorcoes:distorcoesHTML,conceit:conceitHTML,plano:planoHTML,formulacao:formulacaoHTML};

function navHTML(list){
  const d=D();
  return list.map(([k,l])=>'<button class="cx-chip" data-cx="sec" data-arg="'+k+'" aria-pressed="'+(C.sec===k)+'"><span>'+l+'</span><small>'+progress(d,k)+'</small></button>').join("");
}
function updateNav(){
  const n=document.getElementById("cx-nav"),s=document.getElementById("cx-side");
  if(n)n.innerHTML=navHTML(MAIN);if(s)s.innerHTML=navHTML(EXTRA);
}

function grow(t){if(t.tagName!=="TEXTAREA")return;t.style.height="auto";if(t.scrollHeight)t.style.height=(t.scrollHeight+2)+"px";}

function render(){
  const root=document.getElementById("case-root");if(!root)return;
  const st=C.load[C.pid];
  if(!D()){
    root.innerHTML=st==="error"?'<div class="panel"><p>Não consegui abrir a formulação desta paciente. Confira a internet.</p><div class="btns"><button class="btn" data-cx="retry">Tentar de novo</button></div></div>'
      :'<div class="panel"><p class="muted">Carregando a formulação…</p></div>';
    return;
  }
  // redesenhar sem perder o lugar: guarda foco, cursor e rolagem
  const a=document.activeElement,fp=a&&root.contains(a)?(a.dataset.cp||null):null,sel=fp&&a.selectionStart!=null?[a.selectionStart,a.selectionEnd]:null;
  const y=window.scrollY;
  const p=C.ctx.patient;
  root.innerHTML=
    '<div class="cx-printhead"><h2>Formulação de caso · '+esc(p.name)+'</h2><span>'+new Date().toLocaleDateString("pt-BR")+'</span></div>'+
    '<div class="cx-head cx-noprint"><div class="cx-head-text"><span class="eyebrow">Formulação de caso</span><span id="cx-status" class="cx-status'+(C.error?" err":"")+'">'+statusText()+'</span></div>'+
      '<button class="btn ghost cx-small" data-cx="print">Imprimir / PDF</button></div>'+
    '<p class="hint cx-noprint">Só você vê esta aba. O app da paciente não tem acesso a nada daqui.</p>'+
    '<nav class="cx-nav cx-noprint" id="cx-nav" aria-label="Partes da formulação">'+navHTML(MAIN)+'</nav>'+
    (C.printAll?SECTIONS.filter(([k])=>k!=="ia"||str(D().ia.resposta)).map(([k,l])=>'<section class="cx-section"><h2 class="cx-section-title">'+l+'</h2>'+(k==="ia"?iaPrintHTML():RENDER[k]())+'</section>').join("")
      :'<div class="cx-body"><section class="cx-section">'+
        (EXTRA.some(([k])=>k===C.sec)?'<h2 class="cx-res-title">'+(EXTRA.find(([k])=>k===C.sec)[1])+'</h2>':'')+RENDER[C.sec]()+'</section>'+
        '<aside class="cx-side cx-noprint" aria-label="Recursos"><span class="eyebrow">Recursos</span><nav class="cx-side-nav" id="cx-side">'+navHTML(EXTRA)+'</nav>'+
        '<p class="hint">Use quando fizerem sentido para o caso.</p></aside></div>');
  root.querySelectorAll("textarea").forEach(grow);
  // no celular a navegação rola de lado: mantém a parte aberta à vista
  ["cx-nav","cx-side"].forEach(id=>{
    const nav=document.getElementById(id),chip=nav&&nav.querySelector('[aria-pressed="true"]');
    if(chip){const n=nav.getBoundingClientRect(),c=chip.getBoundingClientRect();if(c.left<n.left||c.right>n.right)nav.scrollLeft+=c.left-n.left-(n.width-c.width)/2;}
  });
  if(fp){const el=root.querySelector('[data-cp="'+fp+'"]');if(el){el.focus({preventScroll:true});if(sel)try{el.setSelectionRange(sel[0],sel[1]);}catch(_){}}}
  window.scrollTo(0,y);
}

/* ---------- ações ---------- */
const inRoot=el=>el&&el.closest&&el.closest("#case-root");
function focusLast(sel){const els=document.querySelectorAll("#case-root "+sel);if(els.length)els[els.length-1].focus();}
function hasContent(x){return typeof x==="string"?!!x.trim():x&&typeof x==="object"?Object.entries(x).some(([k,v])=>k!=="id"&&k!=="tipo"&&k!=="feito"&&hasContent(v)):false;}

document.addEventListener("input",e=>{
  const t=e.target;if(!inRoot(t))return;
  if(t.dataset.cxia!=null){C.iaDraft=t.value;grow(t);return;}
  if(!t.dataset.cp||t.tagName==="SELECT"||t.type==="date")return;
  setPath(D(),t.dataset.cp,t.value);if(t.dataset.cp==="ia.resposta")D().ia.data=T.todayKey();grow(t);schedule();updateNav();
});
document.addEventListener("change",e=>{
  const t=e.target;if(!inRoot(t))return;
  if(t.dataset.cxcmp!=null){C.cmpIdx=Number(t.value)||0;render();return;}
  if(t.dataset.cxhyp!=null){C.iaHyp=t.checked;C.iaDraft=null;render();return;}
  if(!t.dataset.cp||(t.tagName!=="SELECT"&&t.type!=="date"))return;
  setPath(D(),t.dataset.cp,t.dataset.num!=null?num(t.value):t.value);schedule();render();
});
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-cx]");if(!b||!inRoot(b))return;
  const act=b.dataset.cx,arg=b.dataset.arg,d=D();
  if(act!=="del")C.confirmDel=null;
  if(act!=="ia-run")C.iaConfirm=false;
  if(act==="retry"){C.load[C.pid]=null;render();ensureLoaded(C.pid);return;}
  if(!d)return;
  if(act==="sec"){C.sec=arg;if(arg==="ia")C.iaDraft=null;render();const r=document.getElementById("case-root");if(r&&r.getBoundingClientRect().top<0)r.scrollIntoView();return;}
  if(act==="print"){
    C.printAll=true;render();
    window.addEventListener("afterprint",()=>{C.printAll=false;render();},{once:true});
    setTimeout(()=>window.print(),50);return;
  }
  if(act==="del"){
    const parts=arg.split("."),i=Number(parts.pop()),list=getPath(d,parts.join("."));
    if(!Array.isArray(list))return;
    if(hasContent(list[i])&&C.confirmDel!==arg){C.confirmDel=arg;render();return;}
    C.confirmDel=null;list.splice(i,1);schedule();render();return;
  }
  if(act==="add-ev"){d.vida[arg].push({id:uid("e"),tipo:"positivo",idade:"",evento:"",impacto:""});schedule();render();focusLast('[data-cp^="vida.'+arg+'."][data-cp$=".evento"]');return;}
  if(act==="add-meta"){d.metas.push({id:uid("m"),dificuldade:"",meta:"",submetas:"",manutencao:"",obstaculos:""});schedule();render();focusLast('[data-cp$=".dificuldade"]');return;}
  if(act==="add-item"){d.plano.fases[Number(arg)].itens.push({id:uid("i"),texto:"",como:"",feito:false,data:null});schedule();render();focusLast('[data-cp^="plano.fases.'+arg+'.itens."][data-cp$=".texto"]');return;}
  if(act==="done"){const it=getPath(d,arg);it.feito=!it.feito;it.data=it.feito?T.todayKey():null;schedule();render();return;}
  if(act==="mark"){const r=d.distorcoes[arg]=obj(d.distorcoes[arg]);r.marcada=!r.marcada;schedule();render();return;}
  if(act==="only"){C.onlyMarked=!C.onlyMarked;render();return;}
  if(act==="ia-regen"){C.iaDraft=null;render();T.toast("Texto montado de novo a partir da formulação.");return;}
  if(act==="ia-run"){
    if(C.iaBusy)return;
    const el=document.getElementById("cx-ia-text"),text=el?el.value.trim():"";
    if(!text){T.toast("O texto para a IA está vazio. Clique em Gerar de novo.");return;}
    if(str(d.ia.resposta)&&!C.iaConfirm){C.iaConfirm=true;render();return;}
    C.iaConfirm=false;runIA(text);return;
  }
  if(act==="ia-copy"){
    const el=document.getElementById("cx-ia-text");
    try{await navigator.clipboard.writeText(el.value);T.toast("Copiado. Cole na IA e depois traga a resposta para o campo 2.");}
    catch(_){el.focus();el.select();T.toast("Selecionei o texto. Copie com Ctrl+C.");}
    return;
  }
  if(act==="plan-template"){
    if(planTotals(d).total)return;
    d.plano.fases=PLANO_MODELO.map((f,i)=>({id:"f"+(i+1),nome:f.nome,porque:f.porque,itens:f.itens.map(([texto,como])=>({id:uid("i"),texto,como,feito:false,data:null}))}));
    schedule();render();T.toast("Plano modelo carregado. Ajuste o que for diferente para esta paciente.");return;
  }
  if(act==="snap"){
    const sc=scoresOf(d.valores.atual);
    if(!DOMINIOS.some(([k])=>sc[k].imp!=null||sc[k].suc!=null)){T.toast("Preencha importância e sucesso antes de registrar.");return;}
    const hoje=T.todayKey(),m={data:hoje,notas:JSON.parse(JSON.stringify(sc))};
    const i=d.valores.medicoes.findIndex(x=>x.data===hoje);
    if(i>=0)d.valores.medicoes[i]=m;else d.valores.medicoes.push(m);
    d.valores.medicoes.sort((a,b)=>a.data<b.data?-1:1);
    schedule();render();T.toast(i>=0?"Medição de hoje atualizada.":"Medição registrada. Nas próximas, dá para comparar com esta.");return;
  }
  if(act==="insert"){
    if(arg==="sistemas"){
      const o=d.formulacao.sistemas=obj(d.formulacao.sistemas);let n=0;
      linked(d).sistemas.forEach(x=>{const [l,...r]=x.split(": "),t=r.join(": "),sk=(SISTEMAS.find(([,sl])=>sl===l)||[])[0];
        if(sk&&!str(o[sk]).includes(t)){o[sk]=(str(o[sk])?str(o[sk])+"\n":"")+t;n++;}});
      if(!n){T.toast("Isso já está no texto.");return;}
      schedule();render();return;
    }
    const cur=str(d.formulacao[arg]),add=(linked(d)[arg]||[]).filter(x=>!cur.includes(x));
    if(!add.length){T.toast("Isso já está no texto.");return;}
    d.formulacao[arg]=(cur?cur+"\n":"")+add.join("\n");schedule();render();return;
  }
  if(act==="to-trilha"){
    const names=lines(d.metas[Number(arg)].submetas);
    if(!names.length){T.toast("Escreva as submetas primeiro, uma por linha.");return;}
    b.disabled=true;
    const n=await C.ctx.addActivities(names);
    b.disabled=false;
    if(n<0)return; // o painel já avisou o erro
    T.toast(n?n+(n>1?" atividades adicionadas":" atividade adicionada")+" ao app dela. O SUDS você completa em Configurar.":"Essas submetas já estão no app dela.");
    return;
  }
});
window.addEventListener("beforeunload",e=>{if(Object.keys(C.dirty).length||C.saving||C.iaBusy){e.preventDefault();e.returnValue="";}});
window.addEventListener("online",()=>{if(Object.keys(C.dirty).length)flush();});

window.TrilhaCase={
  html(){return '<div id="case-root" class="cx"></div>';},
  // ctx: {sb, patient, addActivities(nomes) -> quantas entraram, ou -1 se deu erro}
  mount(ctx){
    if(C.pid&&C.pid!==ctx.patient.id){C.confirmDel=null;C.cmpIdx=0;C.iaDraft=null;C.iaHyp=false;C.iaConfirm=false;flush();}
    C.ctx=ctx;C.pid=ctx.patient.id;
    render();
    // busca de novo sempre que abre (pode ter sido editada em outro aparelho), sem atropelar o que está sendo digitado
    if(!C.dirty[C.pid]&&!C.saving)ensureLoaded(C.pid);
  },
  flush,
  pending(){return Object.keys(C.dirty).length>0||!!C.saving;},
  _test:{normalize,vlq,scoresOf,linked,age,redact,identifiers,iaData}
};
})();
