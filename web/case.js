/* Formulação de caso (painel da psicóloga): as abas da planilha "Modelo formulação de caso".
   Fica em case_notes, tabela separada de patients.config (que é entregue ao app da paciente) —
   isto é prontuário, só a psicóloga lê. Salva sozinho alguns instantes depois de ela parar de digitar. */
(function(){
"use strict";
const T=window.Trilha,esc=T.esc;

// em cima, o que ela usa em todo caso; ao lado, recursos que entram só quando fazem sentido
const MAIN=[["anamnese","Anamnese"],["metas","Metas (LDM)"],["formulacao","Formulação"],["conceit","Conceitualização"],["plano","Plano de tratamento"],["prontuario","Prontuário"],["notas","Notas de sessão"]];
const EXTRA=[["ativacao","Ativação comportamental"],["tarefa","Tarefa gradativa"],["vida","Linha da vida"],["valores","Valores"],["distorcoes","Distorções"],["cartas","Cartas de intimidade"],["ia","Apoio da IA"]];
const SECTIONS=[...MAIN,...EXTRA];

const ANAMNESE=window.TRILHA_ANAMNESE;
const CARTAS=window.TRILHA_CARTAS;
const ANAMNESE_KEYS=ANAMNESE.flatMap(g=>g[1].map(f=>f[0]));
const PV_KEYS=new Set(["email","nome","telefone","nascimento","cpf","endereco","contato1","contato2"]);

const FASES_VIDA=[
  ["infancia","Infância","0 a 12 anos","Lembranças positivas; lembranças dolorosas ou desafiadoras; pessoas significativas."],
  ["adolescencia","Adolescência","13 a 18 anos","Momentos que marcaram sua identidade e escolhas; situações de alegria ou conquistas; dores, perdas ou dificuldades."],
  ["adulta","Vida adulta","a partir dos 19 anos","Eventos importantes (trabalho, estudos, relacionamentos, saúde); experiências de crescimento e orgulho; experiências difíceis, que deixaram marcas."]
];
const TIPOS_VIDA=[["positivo","Positiva / conquista"],["doloroso","Dolorosa / desafiadora"],["pessoa","Pessoa significativa"],["marcante","Marcante (a classificar)"]];

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
  ["vulnerabilidade","Fatores de vulnerabilidade","Experiências precoces e tardias, histórico de vida relevante (traumas, violências, bullying, invalidação). Tudo que contribuiu para as dificuldades."],
  ["problemas","Lista de problemas","Quais são as principais queixas trazidas pela paciente?"],
  ["modificadores","Modificadores situacionais (fatores externos)","Gatilhos e fatores externos que influenciam diretamente o problema, fazendo-o voltar ou piorar (ex.: ambiente familiar, trabalho, relacionamentos)."],
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
    distorcoes:{},conceit:{situacoes:[{},{},{}]},formulacao:{},ia:{},prontuario:{sessoes:[]},anamnese_paciente:{},anamnese_recebida:null,
    tarefa:{titulo:"",degraus:[]},notas:{itens:[]},nomes:[],nao_nomes:[],
    cartas:{fase:"f1",feitas:{},ocultas:[],editadas:{},proprias:[]},
    plano:{fases:[["f1","Fase inicial"],["f2","Fase intermediária"],["f3","Fase final"]].map(([id,nome])=>({id,nome,porque:"",itens:[]})),sugestoes:[]}};
}
function normalize(raw){
  const d=obj(raw),b=blank();
  b.anamnese=obj(d.anamnese);
  const vida=obj(d.vida);FASES_VIDA.forEach(([k])=>b.vida[k]=arr(vida[k]).map(obj));b.vida.historia=vida.historia||"";
  // toda meta precisa de id (abrir/recolher e reordenar dependem dele); as antigas ganham um agora
  b.metas=arr(d.metas).map(obj).map(m=>m.id?m:{...m,id:uid("m")});
  const val=obj(d.valores);b.valores={atual:obj(val.atual),medicoes:arr(val.medicoes).map(obj)};
  b.distorcoes=obj(d.distorcoes);
  const c=obj(d.conceit);b.conceit={...c,situacoes:[0,1,2].map(i=>obj(arr(c.situacoes)[i]))};
  const fases=arr(obj(d.plano).fases).map(obj);
  if(fases.length){
    b.plano.fases=fases.map(f=>({...f,itens:arr(f.itens).map(obj)}));
    // as fases intermediária e final aparecem sempre, mesmo vazias (um plano importado só com a inicial ficava sem elas)
    const fs=b.plano.fases,tem=k=>fs.some(f=>normTxt(f.nome).includes(k)),novoId=id=>fs.some(f=>f.id===id)?uid("f"):id;
    if(!tem("intermediaria")){const i=fs.findIndex(f=>normTxt(f.nome).includes("inicial"));fs.splice(i>=0?i+1:fs.length,0,{id:novoId("f2"),nome:"Fase intermediária",porque:"",itens:[]});}
    if(!tem("final"))fs.push({id:novoId("f3"),nome:"Fase final",porque:"",itens:[]});
  }
  b.plano.sugestoes=arr(obj(d.plano).sugestoes).map(obj);
  b.formulacao=obj(d.formulacao);
  b.ia=obj(d.ia);
  b.prontuario={...obj(d.prontuario),sessoes:arr(obj(d.prontuario).sessoes).map(obj)};
  const tg=obj(d.tarefa);b.tarefa={titulo:tg.titulo||"",degraus:arr(tg.degraus).map(obj)};
  b.notas={itens:arr(obj(d.notas).itens).map(obj).map(n=>({...n,sugestoes:arr(n.sugestoes).map(obj)}))};
  b.anamnese_paciente=obj(d.anamnese_paciente);b.anamnese_recebida=d.anamnese_recebida||null;
  b.nomes=arr(d.nomes).map(str).filter(Boolean);b.nao_nomes=arr(d.nao_nomes).map(str).filter(Boolean);
  const ca=obj(d.cartas);
  b.cartas={fase:str(ca.fase)||"f1",feitas:obj(ca.feitas),ocultas:arr(ca.ocultas).map(str),editadas:obj(ca.editadas),proprias:arr(ca.proprias).map(obj)};
  // o prontuário guarda só a evolução: anotações antigas escritas nele viram nota de sessão (com a mesma data), ligada à sessão
  b.prontuario.sessoes.forEach(s=>{
    if(!str(s.notas))return;
    if(!(s.nota_id&&b.notas.itens.some(n=>n.id===s.nota_id))){
      const id="n_"+s.id;
      if(!b.notas.itens.some(n=>n.id===id))b.notas.itens.push({id,data:s.data||"",texto:str(s.notas),sugestoes:[],do_prontuario:true});
      s.nota_id=id;
    }
    delete s.notas;
  });
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
  if(k==="metas"){const n=d.metas.length,s=d.metas.filter(m=>m.superada).length;return n?n+" meta"+(n>1?"s":"")+(s?" · "+s+" superada"+(s>1?"s":""):""):"vazia";}
  if(k==="valores"){const sc=scoresOf(d.valores.atual);return DOMINIOS.filter(([x])=>sc[x].imp!=null&&sc[x].suc!=null).length+"/10";}
  if(k==="distorcoes"){const n=markedDistortions(d).length;return n?n+" marcada"+(n>1?"s":""):"nenhuma";}
  if(k==="conceit")return filled([...CONCEIT_TOPO.map(([x])=>d.conceit[x]),...d.conceit.situacoes.flatMap(s=>SITUACAO_CAMPOS.map(([x])=>s[x]))])+"/19";
  if(k==="plano"){const t=planTotals(d);return t.total?t.pct+"%":"vazio";}
  if(k==="formulacao")return filled(FORMULACAO.map(([x])=>fval(d,x)))+"/"+FORMULACAO.length;
  if(k==="ia")return str(d.ia.resposta)?"resposta salva":"—";
  if(k==="notas"){const n=d.notas.itens.length;return n?n+" nota"+(n>1?"s":""):"nenhuma nota";}
  if(k==="tarefa"){const g=d.tarefa.degraus.filter(x=>str(x.texto)),f=g.filter(x=>x.feito).length;return g.length?g.length+" degrau"+(g.length>1?"s":"")+(f?" · "+f+" feito"+(f>1?"s":""):""):"vazia";}
  if(k==="ativacao")return C.ctx&&C.ctx.ativacao?C.ctx.ativacao.progress():"";
  if(k==="cartas"){
    const n=Object.keys(d.cartas.feitas).length,f=CARTAS.fases.findIndex(x=>x.id===d.cartas.fase)+1||1;
    return n||f>1?"fase "+f+(n?" · "+n+" feita"+(n>1?"s":""):""):"";
  }
  if(k==="prontuario"){const n=d.prontuario.sessoes.length;return n?n+" sess"+(n>1?"ões":"ão"):"nenhuma sessão";}
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
    problemas:d.metas.filter(m=>str(m.dificuldade)).map(m=>str(m.dificuldade)+(m.superada?" (superada)":"")),
    modificadores:lines(d.anamnese.reside).map(x=>"Reside com: "+x),
    crencas:[...lines(d.conceit.nucleares).map(x=>"Crença nuclear: "+x),...lines(d.conceit.intermediarias).map(x=>"Pressuposto / regra: "+x)],
    sistemas:[...sitLines(d,"pensamento","Pensamentos"),...sitLines(d,"emocoes","Emoções"),...sitLines(d,"comportamento","Comportamentos")],
    // o mesmo assunto numa linha só, separado por ponto e vírgula (em vez de uma distorção embaixo da outra)
    manutencao:[...(markedDistortions(d).length?["Distorções cognitivas: "+markedDistortions(d).map(x=>x.name).join("; ")]:[]),
      ...(d.metas.some(m=>lines(m.manutencao).length)?["Estratégias de enfrentamento: "+d.metas.flatMap(m=>lines(m.manutencao)).join("; ")]:[])],
    obstaculos:d.metas.flatMap(m=>lines(m.obstaculos)),
    fortes:[...evs("positivo"),...DOMINIOS.filter(([k])=>sc[k].suc!=null&&sc[k].suc>=7).map(([k,l])=>"Vai bem em "+l.toLowerCase()+" (sucesso "+sc[k].suc+")")],
    medicamentos:[...lines(d.anamnese.medicacao),...lines(d.anamnese.psiquiatrico).map(x=>"Psiquiatria: "+x)]
  };
}

/* ---------- estado, carregar e salvar ---------- */
const C={ctx:null,pid:null,sec:"anamnese",cache:{},load:{},dirty:{},saving:null,error:false,savedAt:null,
  printAll:false,printPick:null,onlyMarked:false,cmpIdx:0,confirmDel:null,iaDraft:null,iaRedacted:0,iaHyp:false,
  iaBusy:null,iaStream:"",iaConfirm:false,prConfirm:null,prNames:[],imp:null,dict:null,dictAsk:null,dictCloudOk:false,tgPaste:false,
  // preferências da tela, guardadas neste navegador: metas recolhidas e sugestões "das outras abas" escondidas
  metasCompact:pref("cx-metas-compactas"),metaAbertas:new Set(),nomesSel:new Set(),ntAbertas:new Map(),semSugestoes:pref("cx-sem-sugestoes"),ntConfirm:null,
  // cartas viradas e ordem embaralhada valem só nesta tela (não salvam)
  cartasViradas:new Set(),cartasOrdem:{},cartasEdit:false,cartasFull:false};
function pref(k){try{return localStorage.getItem(k)==="1";}catch(_){return false;}}
function setPref(k,v){try{if(v)localStorage.setItem(k,"1");else localStorage.removeItem(k);}catch(_){}}
const D=()=>C.cache[C.pid];

async function fetchCase(pid){
  const {data,error}=await C.ctx.sb.from("case_notes").select("data").eq("patient_id",pid);
  if(error)throw error;
  return normalize(data&&data[0]?data[0].data:null);
}
// anamnese que a paciente mandou pelo link e ainda não entrou na ficha
async function fetchEnvios(pid){
  try{
    const {data,error}=await C.ctx.sb.from("anamnese_envios").select("id,data,created_at,aplicado_em").eq("patient_id",pid);
    if(error)return [];
    return (data||[]).filter(e=>!e.aplicado_em).sort((a,b)=>a.created_at<b.created_at?-1:1);
  }catch(_){return [];} // não atrapalha abrir a ficha; tenta de novo na próxima vez
}
// campo vazio recebe a resposta dela; campo que já tem texto diferente guarda a dela ao lado para a psicóloga escolher.
// Pode rodar de novo com o mesmo envio sem estragar nada (se marcar como aplicado falhar).
function applyEnvios(d,envios){
  let filled=0,conflicts=0;
  envios.forEach(e=>{
    Object.entries(obj(e.data)).forEach(([k,v])=>{
      v=str(v);if(!v||!ANAMNESE_KEYS.includes(k))return;
      const cur=str(d.anamnese[k]);
      if(!cur){d.anamnese[k]=v;filled++;}
      else if(cur!==v){d.anamnese_paciente[k]={valor:v,em:e.created_at};conflicts++;}
    });
    d.anamnese_recebida=e.created_at;
  });
  return {filled,conflicts};
}
async function receiveEnvios(pid){
  const envios=await fetchEnvios(pid);
  if(!envios.length||!C.cache[pid])return;
  const r=applyEnvios(C.cache[pid],envios);
  C.dirty[pid]=true;
  if(pid===C.pid)render();
  T.toast(T.pv(C.ctx.patient.name)+" mandou a anamnese pelo link: "+r.filled+(r.filled===1?" resposta entrou":" respostas entraram")+" na ficha"+
    (r.conflicts?". "+r.conflicts+(r.conflicts===1?" é diferente":" são diferentes")+" do que você tinha escrito — veja em Anamnese.":"."));
  await flush();
  // só marca como aplicado depois que a ficha com as respostas foi salva
  if(!C.dirty[pid]&&!C.error){
    for(const e of envios){try{await C.ctx.sb.from("anamnese_envios").update({aplicado_em:new Date().toISOString()}).eq("id",e.id);}catch(_){}}
  }
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
    receiveEnvios(pid);
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
  const d=D(),conf=d.anamnese_paciente,nConf=Object.keys(conf).length;
  const when=iso=>new Date(iso).toLocaleDateString("pt-BR");
  const choice=(k,t)=>{
    const c=obj(conf[k]);
    return '<div class="cx-linked cx-noprint"><span class="eyebrow">Resposta dela pelo link ('+when(c.em)+')</span><p class="cx-pre"'+(PV_KEYS.has(k)?" data-pv":"")+'>'+esc(str(c.valor))+'</p>'+
      '<div class="btns"><button class="btn ghost cx-small" data-cx="an-use" data-arg="'+k+'">Usar a dela</button><button class="btn ghost cx-small" data-cx="an-keep" data-arg="'+k+'">Manter a minha</button>'+
      (t?'':'<button class="btn ghost cx-small" data-cx="an-both" data-arg="'+k+'">Juntar as duas</button>')+'</div></div>';
  };
  return (d.anamnese_recebida?'<div class="panel cx-received cx-noprint"><b>Ela preencheu a anamnese pelo link em '+when(d.anamnese_recebida)+'.</b> '+
      (nConf?'As respostas entraram nos campos vazios. <b>'+nConf+(nConf===1?' campo já tinha':' campos já tinham')+' texto seu</b>: escolha abaixo o que fica.':'As respostas entraram nos campos que estavam vazios.')+'</div>':'')+
    ANAMNESE.map(([g,fields])=>'<div class="panel"><h3>'+g+'</h3><div class="cx-grid">'+fields.map(([k,l,t])=>{
    const path="anamnese."+k;let html;
    if(t){
      const a=k==="nascimento"?age(d.anamnese.nascimento):null;
      html=field(esc(l)+(a!=null?" "+tag(a+" anos"):""),inp(path,t==="short"?"text":t,"",k==="cpf"?' inputmode="numeric" autocomplete="off"':' autocomplete="off"'));
    }else html=field(esc(l),ta(path),"cx-full");
    // olhinho fechado (gravar a tela): o que identifica a paciente fica escondido
    if(PV_KEYS.has(k))html=html.replace('data-cp="'+path+'"','data-cp="'+path+'" data-pv');
    return conf[k]?'<div class="cx-field-wrap'+(t?"":" cx-full")+'">'+html+choice(k,t)+'</div>':html;
  }).join("")+'</div></div>').join("");
}

function vidaHTML(){
  const d=D();
  return '<p class="hint">Os momentos que marcaram cada fase, e o impacto que deixaram. As lembranças dolorosas e positivas aparecem depois na Formulação, em vulnerabilidades e pontos fortes.</p>'+
    ntOrgHTML(d,"vida")+ntSugHTML(d,(dest,x)=>dest==="vida.evento"&&!NT_FASES.includes(x.fase),{titulo:"Eventos sugeridos pela IA, das notas, sem fase",dica:"A nota não dizia a idade: escolha em que fase o evento entra.",fases:true})+
    '<div class="cx-timeline">'+FASES_VIDA.map(([k,nome,idade,dica])=>
      '<section class="cx-phase"><div class="cx-phase-head"><h3>'+nome+'</h3><span class="muted">'+idade+'</span></div><p class="hint">'+dica+'</p>'+
      ntSugHTML(d,(dest,x)=>dest==="vida.evento"&&x.fase===k)+
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

// metas em ordem de prioridade (a 1ª é a mais importante); "ver só as dificuldades" recolhe os cartões e ela abre um por um
function metasHTML(){
  const d=D(),compact=C.metasCompact&&!C.printAll,last=d.metas.length-1;
  return '<p class="hint">Lista de metas (LDM), em ordem de prioridade: use ↑ ↓ para mudar a ordem e ✓ para marcar a dificuldade superada. As submetas podem virar atividades do app dela com um clique — uma por linha.</p>'+
    ntOrgHTML(d,"metas")+ntSugHTML(d,k=>k==="metas.nova",{titulo:"Dificuldades sugeridas pela IA, das notas",dica:"Inserir cria uma meta nova no fim da lista, com esta dificuldade."})+
    (d.metas.length?'<div class="btns cx-noprint"><button class="btn ghost cx-small" data-cx="metas-compact" aria-pressed="'+!!C.metasCompact+'">'+(C.metasCompact?"Mostrar tudo":"Ver só as dificuldades")+'</button></div>':'')+
    d.metas.map((m,i)=>{
      const p="metas."+i,open=!compact||C.metaAbertas.has(m.id);
      return '<div class="panel cx-meta'+(m.superada?" superada":"")+(open?"":" fechada")+'"><div class="cx-meta-head">'+
        '<button class="cx-check" data-cx="meta-sup" data-arg="'+i+'" aria-pressed="'+!!m.superada+'" aria-label="Dificuldade superada" title="Dificuldade superada">✓</button>'+
        '<span class="cx-num">'+(i+1)+'</span>'+field("Dificuldade"+(m.superada?' <span class="cx-tag ok">superada'+(m.superada_em?" em "+fmtShort(m.superada_em):"")+'</span>':''),ta(p+".dificuldade","",1),"cx-grow cx-ta1")+
        '<span class="cx-tg-move cx-noprint"><button class="icon-btn" data-cx="meta-move" data-arg="'+i+'" data-dir="-1" aria-label="Subir na prioridade" title="Subir na prioridade"'+(i?"":" disabled")+'>↑</button>'+
        '<button class="icon-btn" data-cx="meta-move" data-arg="'+i+'" data-dir="1" aria-label="Descer na prioridade" title="Descer na prioridade"'+(i<last?"":" disabled")+'>↓</button></span>'+
        (compact?'<button class="icon-btn cx-noprint" data-cx="meta-open" data-arg="'+esc(m.id)+'" aria-expanded="'+open+'" aria-label="'+(open?"Recolher":"Abrir")+' esta meta">'+(open?"▾":"▸")+'</button>':'')+
        delBtn(p,"Apagar meta")+'</div>'+
        (open?'<div class="cx-grid">'+field("Meta",ta(p+".meta"))+field("Submetas",ta(p+".submetas","Uma por linha",3))+
          field("Estratégias de enfrentamento",ta(p+".manutencao"))+field("Obstáculos",ta(p+".obstaculos"))+'</div>'+
          '<div class="btns cx-noprint"><button class="btn ghost cx-small" data-cx="to-trilha" data-arg="'+i+'">→ Levar submetas para o app dela</button></div>':'')+'</div>';
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
  const box=(path,label,hint,cls,sug)=>'<div class="cx-box'+(cls?" "+cls:"")+'"><span class="cx-box-label">'+label+'</span>'+ta(path,hint)+(sug||"")+'</div>';
  const livres=d.conceit.situacoes.filter(z=>!str(z.situacao)&&!str(z.pensamento)).length;
  const arrow='<div class="cx-arrow" aria-hidden="true"></div>';
  return '<p class="hint">Diagrama de conceitualização cognitiva (modelo de Judith Beck). Cada caixa é editável; as setas mostram o caminho da história até o comportamento.</p>'+
    ntOrgHTML(d,"conceit")+'<div class="cx-diagram">'+CONCEIT_TOPO.map(([k,l,h],i)=>(i?arrow:"")+box("conceit."+k,l,h,"cx-top",ntSugCampo(d,"conceit."+k))).join("")+
    '<div class="cx-fork" aria-hidden="true"></div>'+
    (marked.length?'<div class="cx-chips cx-center"><span class="muted" style="font-size:13px">Distorções marcadas nela:</span>'+marked.map(x=>tag(esc(x.name),"on")).join("")+'</div>':'')+
    '<div class="cx-sits">'+[0,1,2].map(i=>'<div class="cx-sit">'+SITUACAO_CAMPOS.map(([k,l,h],j)=>(j?arrow:"")+box("conceit.situacoes."+i+"."+k,l+(k==="situacao"?" "+(i+1):""),h,k==="situacao"?"cx-sit-head":"")).join("")+'</div>').join("")+'</div></div>'+
    ntSugHTML(d,k=>k==="conceit.situacao",{titulo:"Situações sugeridas pela IA, das notas",
      dica:livres?"Inserir põe a situação no primeiro quadro vazio do diagrama.":"Os 3 quadros de situação já estão preenchidos: apague ou limpe um para trazer uma destas."});
}

function planoHTML(){
  const d=D(),t=planTotals(d);
  return '<div class="panel cx-plan-sum"><div class="cx-plan-row"><div class="cx-big">'+t.pct+'<small>%</small></div><div><b>'+t.done+' de '+t.total+'</b> itens concluídos<br><span class="muted">Fase atual: <b>'+esc(t.atual)+'</b></span></div></div>'+
      '<div class="bar"><i style="width:'+t.pct+'%"></i></div>'+
      (t.total?'':'<div class="btns cx-noprint"><button class="btn ghost cx-small" data-cx="plan-template">Começar com o plano da planilha modelo</button><span class="hint">17 itens em 3 fases, para ajustar a esta paciente.</span></div>')+'</div>'+
    '<div class="panel cx-noprint"><h3>Ideias para o plano</h3><p class="hint">O plano gira em torno das metas que ela trouxe: cada meta da Lista de metas vira um item, e embaixo as técnicas para chegar nela, pensando nos obstáculos. <b>Ideias da IA</b> sugere em que fase entra cada meta e como trabalhar: nada entra no plano sem você inserir.</p>'+
      '<div class="btns"><button class="btn ghost cx-small" data-cx="plan-metas">Trazer as metas</button>'+
        '<button class="btn ghost cx-small" data-cx="plan-ia-todas"'+(C.iaBusy?" disabled":"")+'>'+(C.plTodas?"Pensando: "+esc(C.plTodas)+"…":"Ideias da IA para todas as fases")+'</button></div>'+
      plSugHTML(d,"",{titulo:"Metas para colocar no plano",dica:"Escolha a fase de cada uma. Dá para escrever o como antes de inserir: os obstáculos da meta ajudam a pensar nas técnicas."})+'</div>'+
    d.plano.fases.map((f,i)=>{
      const p="plano.fases."+i,n=f.itens.length,dn=f.itens.filter(x=>x.feito).length,cur=str(f.nome)===t.atual&&n>dn;
      return '<div class="panel cx-fase'+(cur?" current":"")+'"><div class="cx-fase-head">'+inp(p+".nome","text","Nome da fase",' class="cx-h3input" aria-label="Nome da fase"')+
        (cur?tag("fase atual","on"):"")+tag(dn+"/"+n)+'</div><div class="bar"><i style="width:'+(n?Math.round(dn*100/n):0)+'%"></i></div>'+
        field("Por que isso será trabalhado nessa fase (quais são os ganhos?)",ta(p+".porque"))+
        '<div class="list">'+f.itens.map((it,j)=>{
          const q=p+".itens."+j,last=f.itens.length-1;
          return '<div class="cx-item'+(it.feito?" done":"")+'"><button class="cx-check" data-cx="done" data-arg="'+q+'" aria-pressed="'+!!it.feito+'" aria-label="Concluído">✓</button>'+
            '<div class="cx-item-body cx-ta1">'+ta(q+".texto","O que trabalhar",1)+ta(q+".como","Como (ferramentas)",1)+
            (it.feito&&it.data?'<span class="hint">Concluído em '+fmtDate(it.data)+'</span>':'')+'</div>'+
            // ordem dos itens dentro da fase
            '<span class="cx-tg-move cx-noprint"><button class="icon-btn" data-cx="plan-move" data-arg="'+i+'.'+j+'" data-dir="-1" aria-label="Subir o item" title="Subir"'+(j?"":" disabled")+'>↑</button>'+
            '<button class="icon-btn" data-cx="plan-move" data-arg="'+i+'.'+j+'" data-dir="1" aria-label="Descer o item" title="Descer"'+(j<last?"":" disabled")+'>↓</button></span>'+
            delBtn(q,"Apagar item")+'</div>';
        }).join("")+'</div>'+
        plSugHTML(d,f.id,{titulo:"Ideias para esta fase"})+
        '<div class="btns cx-noprint"><button class="btn ghost cx-small" data-cx="add-item" data-arg="'+i+'">+ Item</button>'+
          '<button class="btn ghost cx-small" data-cx="plan-ia" data-arg="'+i+'"'+(C.iaBusy?" disabled":"")+'>'+(C.iaBusy===C.pid+":plano:"+f.id?"Pensando nas ideias…":"Ideias da IA para esta fase")+'</button></div></div>';
    }).join("")+
    '<div class="btns cx-noprint"><button class="btn ghost cx-small" data-cx="plan-add-fase">+ Fase</button></div>';
}
/* ideias para o plano: da IA (por fase) ou as metas da LDM (sem fase até ela escolher); ficam em d.plano.sugestoes */
function plSugHTML(d,fase,o){
  const its=d.plano.sugestoes.map((x,k)=>({x,k})).filter(({x})=>(x.fase||"")===fase);
  if(!its.length)return "";
  const fases=d.plano.fases;
  return '<div class="cx-linked cx-nt-sug cx-noprint"><div class="cx-linked-head"><span class="eyebrow">'+o.titulo+'</span>'+
      (fase&&its.length>1?'<button class="btn ghost cx-small" data-cx="plan-ok-all" data-arg="'+esc(fase)+'">Inserir todas</button>':'')+'</div>'+
    (o.dica?'<p class="hint">'+o.dica+'</p>':'')+
    its.map(({x,k})=>{
      const p="plano.sugestoes."+k,acts=fase?'<button class="btn cx-small" data-cx="plan-ok" data-arg="'+esc(x.id)+'">Inserir</button>'
        :fases.map(f=>'<button class="btn ghost cx-small" data-cx="plan-ok" data-arg="'+esc(x.id)+'" data-fase="'+esc(f.id)+'">'+esc(str(f.nome)||"Fase")+'</button>').join("");
      return '<div class="cx-item cx-nt-item"><div class="cx-item-body">'+(x.tipo==="porque"?'<span class="hint">Por que nesta fase (ganhos)</span>'+ta(p+".texto","",2)
          :inp(p+".texto","text","O que trabalhar",' aria-label="O que trabalhar (sugestão)"')+ta(p+".como","Como (ferramentas)",1))+
        (x.origem==="metas"?'<span class="hint">Meta '+esc(x.meta||"")+(str(x.obstaculos)?' · obstáculos: '+esc(x.obstaculos):'')+'</span>':'')+'</div>'+
        '<div class="cx-nt-acts">'+acts+'<button class="icon-btn" data-cx="plan-no" data-arg="'+esc(x.id)+'" aria-label="Descartar ideia" title="Descartar">×</button></div></div>';
    }).join("")+'</div>';
}
// a meta mudou na LDM: o item do plano que veio dela (meta_id) acompanha
function plSincMeta(d,m){
  if(!m)return;const t=str(m.meta)||str(m.dificuldade);if(!t)return;
  d.plano.fases.forEach(f=>f.itens.forEach(it=>{if(it.meta_id===m.id)it.texto=t;}));
}
const normTxt=s=>str(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
function plJaTem(d,t){
  const k=normTxt(t);
  return !k||d.plano.fases.some(f=>f.itens.some(it=>normTxt(it.texto)===k))||d.plano.sugestoes.some(x=>x.tipo!=="porque"&&normTxt(x.texto)===k);
}
// insere uma ideia na fase: item novo, ou o "por que" somado ao campo
function plInsere(d,x,faseId){
  const f=d.plano.fases.find(z=>z.id===(faseId||x.fase));if(!f)return false;
  if(x.tipo==="porque"){const t=str(x.texto);if(t&&!str(f.porque).includes(t))f.porque=str(f.porque)?str(f.porque)+"\n"+t:t;}
  else if(str(x.texto))f.itens.push({id:uid("i"),texto:str(x.texto),como:str(x.como),feito:false,data:null,...(x.meta_id?{meta_id:x.meta_id}:{})});
  d.plano.sugestoes=d.plano.sugestoes.filter(z=>z!==x);
  return true;
}
const PL_PROMPT=fase=>[
"Você é uma psicóloga clínica experiente em Terapia Cognitivo-Comportamental, ajudando outra psicóloga a montar o plano de tratamento de um caso real (dados anonimizados abaixo). Ela monta o plano por fases e agora está trabalhando na fase \""+fase+"\". Sugira ideias para essa fase. As decisões são dela: seu papel é dar ideias.",
"",
"Como o plano dela é organizado (tudo gira em torno das metas que a paciente trouxe):",
"- Cada fase tem o campo \"Por que isso será trabalhado nessa fase (quais são os ganhos?)\" e uma lista de itens.",
"- Cada item é uma META da Lista de metas (LDM): \"o que trabalhar\" é a meta, com as palavras dela (é o subtítulo do plano); \"como trabalhar\" são as técnicas para a paciente chegar nessa meta, pensadas também a partir dos OBSTÁCULOS e das estratégias de enfrentamento dessa meta, separadas por ponto e vírgula (ex.: \"Psicoeducação sobre o sono; higiene do sono; registro do sono; atividades prazerosas antes de dormir\").",
"- Fase inicial: motivação para o tratamento, alívio dos sintomas e do humor, psicoeducação e socialização ao modelo cognitivo; metas que trazem ganho mais rápido. Fase intermediária: aquisição de habilidades e trabalho com crenças (nucleares e intermediárias), que dependem da fase inicial. Fase final: autonomia, prevenção de recaída e manutenção dos ganhos. Se a fase tiver outro nome, use o que o nome e os itens dela indicam.",
"",
"Regras:",
"- Só metas que estão na LDM. Nada de itens soltos, que a paciente não trouxe como meta. Se nenhuma meta cabe nesta fase, devolva a lista vazia.",
"- Não repita meta que já está no plano, em nenhuma fase.",
"- Use técnicas reconhecidas da TCC e de terapias baseadas em evidências (ex.: reestruturação cognitiva, exame de evidências, seta descendente, experimentos comportamentais, exposição gradual com SUDS, ativação comportamental, solução de problemas, treino de assertividade, role-play, mindfulness, autocompaixão, cartão de enfrentamento, vantagens e desvantagens). Escolha as que servem para aquela meta e para os obstáculos dela; não liste todas.",
"- Na ordem em que faz sentido trabalhar. Não faça diagnóstico e não invente dados.",
"- \"porque\": uma ou duas frases para o campo dos ganhos da fase, só se ele estiver vazio ou se faltar algo importante; senão, \"\".",
"",
"Responda SOMENTE com um JSON, sem texto antes ou depois:",
"{\"porque\":\"...\",\"itens\":[{\"texto\":\"a meta, como está na LDM\",\"como\":\"técnicas para chegar nela\"}]}"
].join("\n");
// pedido de ideias para uma fase (null se o caso ainda está vazio)
function plJob(d,f){
  const body=iaData(d,false);if(!body)return null;
  const fid=f.id,ids=identifiers(d,C.ctx.patient),nome=str(f.nome)||"Fase "+(d.plano.fases.indexOf(f)+1);
  const job={text:PL_PROMPT(nome)+"\n\n# Plano atual\n\n"+redact(plAtual(d),ids).text+"\n\n# Dados do caso (anonimizados)\n\n"+redact(body,ids).text,
    modo:"plano",key:C.pid+":plano:"+fid,falhou:"A resposta da IA veio fora do formato. Tente de novo.",
    save:(dd,out)=>{
      const r=plParse(out),ff=dd.plano.fases.find(z=>z.id===fid);if(!r||!ff)return false;
      const novos=r.itens.filter(x=>!plJaTem(dd,x.texto));
      if(r.porque&&!str(ff.porque).includes(r.porque))dd.plano.sugestoes.push({id:uid("p"),fase:fid,tipo:"porque",texto:r.porque,origem:"ia"});
      novos.forEach(x=>dd.plano.sugestoes.push({id:uid("p"),fase:fid,texto:x.texto,como:x.como,origem:"ia"}));
      job.novos=novos.length;
      job.ok=novos.length?novos.length+(novos.length>1?" ideias":" ideia")+" para "+(str(ff.nome)||"a fase")+", embaixo da fase. Insira as que fizerem sentido.":"A IA não achou nada novo para esta fase além do que já está no plano.";
    }};
  return job;
}
function plAtual(d){
  return d.plano.fases.map(f=>"## "+(str(f.nome)||"Fase")+"\n- Por que (ganhos): "+(str(f.porque)||"(vazio)")+
    (f.itens.length?"\n"+f.itens.map(it=>"- "+str(it.texto)+(str(it.como)?" — como: "+str(it.como):"")+(it.feito?" (concluído)":"")).join("\n"):"\n- (sem itens)")).join("\n\n");
}
function plParse(out){
  const a=out.indexOf("{"),b=out.lastIndexOf("}");if(a<0||b<a)return null;
  let j=null;try{j=JSON.parse(out.slice(a,b+1));}catch(_){}
  for(let k=b,n=0;!j&&k>a&&n<40;k=out.lastIndexOf("}",k-1),n++){try{j=JSON.parse(out.slice(a,k+1)+"]}");}catch(_){}}
  if(!j)return null;
  const lim=x=>String(x==null?"":x).trim().slice(0,600);
  return {porque:lim(obj(j).porque),itens:arr(obj(j).itens).map(obj).map(x=>({texto:lim(x.texto).slice(0,300),como:lim(x.como)})).filter(x=>x.texto)};
}

function formulacaoHTML(){
  const d=D(),L=linked(d);
  return ntTodasHTML(d)+ntOrgHTML(d,"formulacao")+'<div class="cx-sug-bar cx-noprint"><p class="hint">'+(C.semSugestoes?'As sugestões das outras abas estão escondidas.':'Embaixo de cada campo aparece o que as outras abas já dizem sobre ele. "Inserir no texto" copia só o que ainda não estiver escrito.')+'</p>'+
    '<button class="btn ghost cx-small" data-cx="sugestoes" aria-pressed="'+!C.semSugestoes+'">'+(C.semSugestoes?"Mostrar sugestões das outras abas":"Ocultar sugestões das outras abas")+'</button></div>'+
    '<div class="cx-grid cx-form">'+FORMULACAO.map(([k,l,q])=>{
      const items=L[k]||[];
      const control=k==="sistemas"?'<div class="cx-sis">'+SISTEMAS.map(([x,sl])=>field(sl,ta("formulacao.sistemas."+x,"",2))).join("")+'</div>':ta("formulacao."+k,"",4);
      // as sugestões da IA (das notas) entram na mesma caixa "Das outras abas"; com ela oculta, ficam numa caixa só delas
      const junto=!C.semSugestoes,fs=k==="sistemas"?x=>x.startsWith("formulacao.sistemas."):x=>x==="formulacao."+k;
      const sug=ntSugHTML(d,fs,{embed:junto,sub:k==="sistemas"?x=>(SISTEMAS.find(([sk])=>"formulacao.sistemas."+sk===x.destino)||[])[1]:null});
      return '<div class="panel'+(k==="objetivo"?" cx-full":"")+'"><h3>'+l+'</h3><p class="hint">'+q+'</p>'+control+(junto?"":sug)+
        (junto&&(items.length||sug)?'<div class="cx-linked cx-noprint"><div class="cx-linked-head"><span class="eyebrow">Das outras abas</span><button class="linkish cx-small" data-cx="sugestoes">Ocultar</button></div>'+
          (items.length?'<ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul><button class="btn ghost cx-small" data-cx="insert" data-arg="'+k+'">Inserir no texto</button>':'')+sug+'</div>':'')+'</div>';
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
  const outros=[...new Set([...words(d.anamnese.contato1),...words(d.anamnese.contato2),...arr(d.nomes).map(str).filter(Boolean)])].filter(w=>!pac.includes(w));
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
/* Nomes: na conferência antes de enviar, ela toca nas palavras que são nomes. Elas entram em d.nomes e passam a ser
   trocadas por [nome] em tudo que vai para a IA (a nota não muda); as que ela não marcou vão para d.nao_nomes e não
   aparecem mais na conferência. Fica guardado no caso de cada paciente. */
const nomesSuspeitos=(d,text)=>{const nao=new Set(arr(d.nao_nomes));return maybeNames(text).filter(w=>!nao.has(w));};
function nomesHTML(){
  if(!C.prNames.length)return "";
  return '<span class="eyebrow">Alguma destas palavras é nome de alguém?</span>'+
    '<div class="cx-chips cx-nomes">'+C.prNames.map(w=>'<button class="cx-tag cx-nome" data-cx="nome-tog" data-arg="'+esc(w)+'" aria-pressed="'+C.nomesSel.has(w)+'">'+esc(w)+'</button>').join("")+'</div>'+
    '<p class="hint">Toque nos nomes: eles viram [nome] antes de ir para a IA (a nota não muda) e ficam guardados para as próximas vezes. As palavras que você não marcar não aparecem mais aqui.</p>';
}
function nomesGuardar(d){
  const sel=C.nomesSel,nomes=new Set(arr(d.nomes)),nao=new Set(arr(d.nao_nomes));
  C.prNames.forEach(w=>{if(sel.has(w)){nomes.add(w);nao.delete(w);}else if(!nomes.has(w))nao.add(w);});
  d.nomes=[...nomes].slice(-500);d.nao_nomes=[...nao].slice(-1000);
  C.nomesSel=new Set();C.prNames=[];schedule();
}
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
  sec("Lista de metas (LDM), em ordem de prioridade",d.metas.filter(m=>hasContent(m)).map((m,i)=>"- Meta "+(i+1)+(m.superada?" (dificuldade já superada)":"")+": "+[["dificuldade","Dificuldade"],["meta","Meta"],["submetas","Submetas"],
    ["manutencao","Estratégias de enfrentamento"],["obstaculos","Obstáculos"]].filter(([k])=>str(m[k])).map(([k,l])=>l+": "+one(m[k])).join("; ")));
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
  const busy=C.iaBusy===C.pid+":caso";
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
      (busy?'<textarea id="cx-ia-stream" data-stream="'+C.pid+':caso" readonly rows="6" aria-label="Resposta da IA">'+esc(C.iaStream)+'</textarea>':ta("ia.resposta","Cole a resposta aqui",6))+'</div>';
}
const IA_FIM="\u0000FIM:";
const IA_ERROS={"sem-chave":"A IA ainda não foi ligada: falta cadastrar a chave do Claude no Supabase.",login:"Sua sessão expirou. Saia e entre de novo.",
  permissao:"Este login não tem acesso à IA.",credito:"Os créditos da IA acabaram. É preciso recarregar na conta da Anthropic.",
  "chave-invalida":"A chave do Claude cadastrada no Supabase não está funcionando.",limite:"A IA está ocupada agora. Espere um minuto e tente de novo.",
  tamanho:"O texto está grande demais para enviar. Encurte os relatos mais longos."};
// job: {text, modo: "caso"|"sessao", key (o que fica "escrevendo" na tela), save(d,texto) -> false se o alvo sumiu, ok (aviso no fim)}
async function runIA(job){
  const pid=C.pid,key=job.key;
  C.iaBusy=key;C.iaStream="";render();
  let out="",fim=null,erro=null;
  const show=()=>{const el=document.querySelector('#case-root [data-stream="'+key+'"]');if(el){el.value=out;grow(el);}};
  try{
    const {data}=await C.ctx.sb.auth.getSession();
    const tok=data&&data.session&&data.session.access_token;
    if(!tok)throw new Error("login");
    const cfg=window.TRILHA_CONFIG;
    const res=await fetch(cfg.SUPABASE_URL+"/functions/v1/analisar-caso",{method:"POST",
      headers:{"content-type":"application/json",authorization:"Bearer "+tok,apikey:cfg.SUPABASE_ANON_KEY},body:JSON.stringify({texto:job.text,modo:job.modo})});
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
    const full=out+(fim==="corte"?"\n\n[A resposta foi cortada por tamanho. Para o restante, peça de novo com menos texto.]":fim==="erro"||erro?"\n\n[A resposta parou no meio por uma falha de conexão.]":"");
    var salvo=job.save(C.cache[pid],full)!==false;
    if(salvo){C.dirty[pid]=true;flush();}
  }
  if(C.pid===pid)render();
  if(job.quiet){if(!out){job.erro="rede";job.erroMsg=IA_ERROS[erro]||"Não consegui falar com a IA. Confira a internet e tente de novo.";}else if(!salvo)job.erro="formato";return;}
  if(out&&!fim&&!erro)T.toast(salvo||!job.falhou?job.ok:job.falhou);
  else if(out)T.toast("A resposta veio incompleta. Pode tentar de novo.");
  else T.toast(IA_ERROS[erro]||(erro==="Failed to fetch"||!navigator.onLine?"Não consegui falar com a IA. Confira a internet e tente de novo.":"A IA não respondeu agora. Tente de novo em instantes."));
}
/* ---------- ditado por voz (prontuário) ---------- */
// O Chrome transcreve no próprio computador (processLocally): a voz não sai da máquina.
// Quando o navegador só faz isso por um serviço on-line, ela precisa aceitar antes.
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const DICT_LANG="pt-BR";
const DICT_ERROS={"not-allowed":"O navegador não deixou usar o microfone. Libere no cadeado ao lado do endereço do site.",
  "service-not-allowed":"O navegador não deixou usar o microfone. Libere no cadeado ao lado do endereço do site.",
  "audio-capture":"Não encontrei microfone neste aparelho.","network":"O ditado deste navegador precisa de internet. Confira a conexão.",
  "language-not-supported":"Este navegador não reconhece português para ditado."};
const dictOn=s=>!!(C.dict&&C.dict.sid===s.id&&C.dict.pid===C.pid);
function dictBtn(s){
  if(!SR)return "";
  const on=dictOn(s),down=on&&C.dict.status==="download";
  return '<button class="btn'+(on?" warn":" ghost")+' cx-small" data-cx="dict" data-arg="'+s.id+'"'+(down||C.iaBusy?" disabled":"")+'>'+
    (down?"Preparando o ditado…":on?"■ Parar ditado":"🎤 Ditar")+'</button>';
}
function dictHTML(s){
  if(C.dictAsk===s.id)return '<div class="cx-linked cx-noprint"><p>Neste navegador o ditado passa por um serviço on-line (do Google ou da Apple): a voz não fica só no computador. Evite dizer nomes e outros dados que identifiquem a paciente.</p>'+
    '<p class="hint">No Google Chrome atualizado, no computador, o ditado é feito no próprio aparelho.</p>'+
    '<div class="btns"><button class="btn warn cx-small" data-cx="dict-ok" data-arg="'+s.id+'">Ditar assim mesmo</button><button class="btn ghost cx-small" data-cx="dict-no">Cancelar</button></div></div>';
  if(!dictOn(s))return "";
  if(C.dict.status==="download")return '<p class="hint cx-noprint">Baixando o reconhecimento de voz em português. Só acontece na primeira vez; depois ele funciona no próprio computador.</p>';
  return '<p class="cx-dict-live cx-noprint" aria-live="polite"><span class="cx-dict-dot" aria-hidden="true"></span><span data-dict-live>'+(esc(C.dict.interim)||"Ouvindo… fale normalmente; o texto entra nas anotações.")+'</span></p>'+
    (C.dict.local?'':'<p class="hint cx-noprint">Ditado pelo serviço on-line do navegador. Evite dizer nomes.</p>');
}
// local: o navegador transcreve no aparelho; download: precisa baixar o pacote de português antes; cloud: só on-line
async function dictMode(){
  if(!SR)return "none";
  if(typeof SR.available!=="function")return "cloud";
  try{
    const a=await SR.available({langs:[DICT_LANG],processLocally:true});
    if(a==="available")return "local";
    if(a==="downloadable"||a==="downloading")return "download";
  }catch(_){}
  return "cloud";
}
// onde o ditado escreve: anotações de uma sessão do prontuário ou texto de uma nota de sessão
function dictAlvo(d,sid){
  // só nas notas de sessão (o prontuário guarda só a evolução)
  const i=d.notas.itens.findIndex(x=>x.id===sid);
  return i>=0?{o:d.notas.itens[i],k:"texto",path:"notas.itens."+i+".texto"}:null;
}
function dictAppend(pid,sid,text){
  text=String(text||"").trim();if(!text)return;
  const d=C.cache[pid],a=d&&dictAlvo(d,sid);if(!a)return;
  const cur=String(a.o[a.k]||"").replace(/[ \t]+$/,"");
  if(!cur||/[.!?:\n]$/.test(cur))text=text.charAt(0).toUpperCase()+text.slice(1);
  a.o[a.k]=cur+(cur&&!/\n$/.test(cur)?" ":"")+text;
  if(pid!==C.pid){C.dirty[pid]=true;flush();return;}
  const el=document.querySelector('#case-root [data-cp="'+a.path+'"]');
  if(el){el.value=a.o[a.k];grow(el);}
  schedule();
}
function dictStop(){
  const x=C.dict;if(!x)return;
  C.dict=null;clearInterval(x.watch);
  // stop() ainda entrega o último trecho ouvido (onresult continua valendo)
  if(x.rec)try{x.rec.stop();}catch(_){}
}
function dictStart(sid,local){
  const pid=C.pid,rec=new SR();
  rec.lang=DICT_LANG;rec.continuous=true;rec.interimResults=true;
  if(local)rec.processLocally=true;
  const x={sid,pid,rec,local,interim:"",ends:[]};
  C.dict=x;
  rec.onresult=e=>{
    let fin="",tmp="";
    for(let k=e.resultIndex;k<e.results.length;k++){const r=e.results[k];if(r.isFinal)fin+=r[0].transcript;else tmp+=r[0].transcript;}
    if(fin)dictAppend(pid,sid,fin);
    if(C.dict!==x)return;
    x.interim=tmp.trim();
    const el=document.querySelector("#case-root [data-dict-live]");
    if(el)el.textContent=x.interim||"Ouvindo… fale normalmente; o texto entra nas anotações.";
  };
  rec.onerror=e=>{x.err=e.error;};
  rec.onend=()=>{
    if(C.dict!==x)return;
    // o navegador encerra sozinho depois de um silêncio: recomeça, a não ser que tenha dado erro de verdade
    const now=Date.now();x.ends=x.ends.filter(t=>now-t<4000);x.ends.push(now);
    const err=x.err;x.err=null;
    if(!DICT_ERROS[err]&&x.ends.length<4){try{rec.start();return;}catch(_){}}
    dictStop();render();
    T.toast(DICT_ERROS[err]||"O ditado parou. Clique em Ditar para continuar.");
  };
  // saiu do prontuário (outra aba, outra paciente): desliga o microfone
  x.watch=setInterval(()=>{if(C.dict===x&&!document.querySelector('#case-root [data-cx="dict"][data-arg="'+sid+'"]')){dictStop();render();}},1000);
  try{rec.start();}catch(_){C.dict=null;clearInterval(x.watch);T.toast("Não consegui ligar o ditado. Tente de novo.");}
  render();
}
async function dictClick(sid){
  if(C.dict&&C.dict.sid===sid){if(C.dict.status!=="download"){dictStop();render();}return;}
  dictStop();
  const mode=await dictMode();
  if(mode==="none"){T.toast("Este navegador não faz ditado. Use o Google Chrome.");return;}
  if(mode==="local"){dictStart(sid,true);return;}
  if(mode==="download"){
    const x={sid,pid:C.pid,status:"download"};C.dict=x;render();
    let ok=false;try{ok=await SR.install({langs:[DICT_LANG],processLocally:true});}catch(_){}
    if(C.dict!==x)return;
    C.dict=null;
    if(ok){dictStart(sid,true);return;}
    render();T.toast("Não consegui preparar o ditado neste computador. Confira a internet e tente de novo.");return;
  }
  if(C.dictCloudOk){dictStart(sid,false);return;}
  C.dictAsk=sid;render();
}

/* ---------- prontuário: anotações da sessão -> evolução ---------- */
// as regras são as da Beatriz (o prompt que ela já usava): o prontuário pode ser pedido pela própria paciente
const PR_REGRAS=[
"FIDELIDADE",
"- Usar apenas o que está nas minhas anotações. Não inventar fatos, não completar lacunas com hipóteses e não fechar diagnóstico.",
"- Não atribuir técnicas ou intervenções que não estejam nas anotações. Se as anotações não descrevem técnica, registrar apenas o foco temático.",
"- Se o campo de humor estiver vazio, não registrar humor.",
"- Se uma linha das anotações estiver ambígua ou incompleta, não incluí-la.",
"- Hipóteses ou diagnósticos mencionados pelo paciente ou por terceiros, sem avaliação formal, não entram no prontuário.",
"",
"SIGILO E DISCRIÇÃO (o que deixar de fora ou generalizar)",
"- Nomes de terceiros (familiares, parceiros, colegas, chefia): usar apenas o papel (\"a mãe\", \"parceiro\", \"colega\"), e só quando necessário. Marcadores como [nome] e [paciente] também não entram no texto.",
"- Falas literais do paciente e de terceiros: sintetizar.",
"- Conteúdo sexual ou íntimo, inclusive pornografia: não registrar. Se for essencial, usar termos como \"dificuldades na dinâmica conjugal\".",
"- Substâncias e medicações: usar \"uso de substâncias\" e \"tratamento medicamentoso em acompanhamento\", sem nomes, doses ou quantidades.",
"- Detalhes de saúde de terceiros, violência, histórico de trauma e conflitos explícitos: sintetizar em nível clínico (\"histórico de conflitos familiares\", \"vivências de perda\").",
"- Valores financeiros, locais, empresas, cargos específicos, processos judiciais e episódios identificáveis: omitir.",
"- Evitar termos pejorativos ou patologizantes e leituras interpretativas subjetivas.",
"- Priorizar conceitos clínicos amplos compatíveis com TCC, como padrões cognitivos, regulação emocional, autocobrança, culpa, evitação, ambivalência, conflitos interpessoais, necessidades afetivas, psicoeducação, reestruturação cognitiva e estratégias comportamentais. Usar somente quando coerentes com as anotações."
];
const PR_PROMPT=[
"Você é uma assistente clínica especializada em Terapia Cognitivo-Comportamental (TCC). Sua função é transformar minhas anotações soltas de sessão em prontuários psicológicos breves, técnicos, éticos e objetivos, alinhados ao Código de Ética Profissional do Psicólogo e às diretrizes do CFP. Sou psicóloga clínica em TCC, e os prontuários podem ser solicitados pelo próprio paciente. Por isso, o cuidado com as palavras e com o sigilo é prioridade. As anotações já vêm anonimizadas.",
"",
"FORMATO",
"- Título: \"PRONTUÁRIO: SESSÃO DD/MM (horário)\", com a data e o horário informados abaixo (sem horário informado, sem parênteses). Se a sessão foi antecipada ou remarcada, indicar no título.",
"- Texto corrido, em um único parágrafo, com cerca de 4 a 6 linhas. Sem tópicos dentro do prontuário.",
"- Linguagem clínica madura, neutra, técnica e sintética. Evitar literalidade e transformar relatos informais ou emocionalmente carregados em formulações técnicas.",
"- Estrutura implícita: humor ou queixa principal, temas trabalhados, intervenções em TCC, foco terapêutico e plano de ação resumido.",
"- Modelo de escrita: \"Paciente relatou (...). Trouxe (...), associado a (...). Sessão focada em (...). Definido acompanhamento com (...).\"",
"- Para primeira sessão, escrever \"PRONTUÁRIO: PRIMEIRA SESSÃO\", descrevendo o acolhimento e o levantamento de histórico.",
"- Para faltas, registrar apenas a data, a ausência e se houve aviso. Escrever \"Atendimento não realizado\". Sem conteúdo clínico e sem interpretação do motivo.",
"",
...PR_REGRAS,
"- Se vierem prontuários de sessões anteriores (ficha de continuidade), usar só como contexto. Não repetir seu conteúdo no prontuário.",
"",
"ENTREGA",
"- Entregar o prontuário pronto para uso, sem observações, listas de pontos omitidos ou comentários adicionais. Sem markdown (nada de # ou **).",
"- Única exceção: se as anotações trouxerem conteúdo de risco (ideação suicida, autolesão, risco a terceiros) ou informações contraditórias sobre isso, escrever uma única linha após o prontuário avisando que o dado não foi registrado e que a decisão de registro é minha. Se faltar informação essencial para o registro, fazer apenas uma pergunta breve, em vez do prontuário."
].join("\n");
// a introdução do prontuário: o parágrafo "Anamnese" que vem depois da identificação, para entregar à paciente ou a outro profissional
const PR_INTRO_PROMPT=[
"Você é uma assistente clínica especializada em Terapia Cognitivo-Comportamental (TCC). Escreva o parágrafo \"Anamnese\" da introdução de um prontuário psicológico, a partir das respostas da anamnese abaixo (anonimizadas). Ele vem logo depois da identificação, para quem receber o prontuário (a própria paciente ou outro profissional) saber de quem se trata. Siga o Código de Ética Profissional do Psicólogo e as diretrizes do CFP.",
"",
"FORMATO",
"- Um único parágrafo corrido, com cerca de 5 a 8 linhas, em terceira pessoa, começando por \"Paciente\". Sem título, sem tópicos e sem markdown.",
"- Conteúdo: motivo da busca pelo atendimento e queixas principais; acompanhamentos anteriores ou atuais (psicoterapia, psiquiatria); aspectos relevantes de saúde, rotina e relações; objetivos com a terapia.",
"- Modelo de escrita: \"Paciente em acompanhamento psiquiátrico há (...), com queixas de (...). Já realizou psicoterapia anteriormente (...). Refere (...). Apresenta rotina (...). Como objetivos, destaca (...).\"",
"",
...PR_REGRAS.filter(l=>!/técnica|humor/.test(l)).map(l=>l.replace(/(minhas )?anotações/g,"respostas")),
"- Pergunta sem resposta: não mencionar.",
"",
"Entregue só o parágrafo, sem observações. Se as respostas trouxerem risco (ideação suicida, autolesão, risco a terceiros), escreva uma única linha depois do parágrafo avisando que o dado não foi registrado e que a decisão de registro é minha."
].join("\n");
// respostas da anamnese que entram na introdução (a identificação fica de fora: ela vai no quadro, não para a IA)
function prAnamneseTexto(d){
  const one=s=>str(s).replace(/\s*\n+\s*/g," / ");
  const a=age(d.anamnese.nascimento),out=[];
  if(a!=null)out.push("- Idade: "+a+" anos");
  [["escolaridade","Escolaridade"],["profissao","Profissão"],["reside","Com quem reside"]].forEach(([k,l])=>{if(str(d.anamnese[k]))out.push("- "+l+": "+one(d.anamnese[k]));});
  ANAMNESE.slice(1).forEach(([,fields])=>fields.forEach(([k,l])=>{if(str(d.anamnese[k]))out.push("- "+l.replace(/\?$/,"")+": "+one(d.anamnese[k]));}));
  return out.join("\n");
}
// ficha de continuidade: os prontuários das últimas sessões antes desta, só como contexto
function prContinuidade(d,s){
  return prOrder(d).filter(x=>x.s!==s&&str(x.s.evolucao)&&str(x.s.data)<=str(s.data)).slice(-3)
    .map(x=>"- Sessão "+x.n+(x.s.data?" ("+fmtShort(x.s.data)+")":"")+": "+str(x.s.evolucao).replace(/\s*\n+\s*/g," ")).join("\n");
}
function prOrder(d){
  // número da sessão pela ordem das datas; na tela, a mais recente primeiro
  const ss=d.prontuario.sessoes.map((s,i)=>({s,i})).sort((a,b)=>str(a.s.data).localeCompare(str(b.s.data))||a.i-b.i);
  ss.forEach((x,n)=>x.n=n+1);
  return ss;
}
// o prontuário guarda só a evolução; as anotações da sessão ficam nas Notas de sessão (a nota ligada à sessão)
const prNota=(d,s)=>s.nota_id?d.notas.itens.find(n=>n.id===s.nota_id)||null:null;
function prontuarioHTML(){
  const d=D(),ss=prOrder(d).reverse();
  return '<p class="hint">Aqui fica só a evolução de cada sessão. As anotações você faz em <button class="linkish" data-cx="sec" data-arg="notas">Notas de sessão</button>: <b>Levar para as outras abas</b> já escreve o prontuário da sessão, com as suas regras de ética e sigilo (nomes trocados antes de enviar). Revise antes de considerar final.</p>'+
    '<div class="btns cx-noprint"><button class="btn" data-cx="pr-new">+ Nova sessão</button>'+
      '<label class="btn ghost'+(C.prLendo?" disabled":"")+'" style="cursor:pointer" title="Prontuários antigos: cada sessão do arquivo vira uma sessão aqui">'+(C.prLendo?"Lendo o arquivo…":"Importar Word ou PDF")+
      '<input type="file" id="cx-pr-import" accept="'+DOC_ACCEPT+'" hidden'+(C.prLendo?" disabled":"")+'></label>'+(ss.length||prTemIntro(d)?'<button class="btn ghost cx-small" data-cx="pr-print">Imprimir prontuário</button>':'')+'</div>'+
    prTodasHTML(d)+prIntroHTML(d)+
    ss.map(({s,i,n})=>{
      const p="prontuario.sessoes."+i,key=C.pid+":s:"+s.id,busy=C.iaBusy===key,conf=C.prConfirm===s.id,nota=prNota(d,s);
      return '<div class="panel cx-sessao"><div class="cx-meta-head"><span class="cx-num">'+n+'</span><b class="cx-grow">Sessão '+n+'</b>'+
          inp(p+".data","date","",' aria-label="Data da sessão" style="width:auto"')+inp(p+".hora","time","",' aria-label="Horário da sessão" style="width:auto"')+delBtn(p,"Apagar sessão")+'</div>'+
        (s.importada?'<p class="hint">Importada do arquivo '+esc(s.importada)+(s.data?'. A data veio do título da sessão — confira.':': o título não tinha data, preencha.')+'</p>':'')+
        field("Evolução (registro do prontuário)"+(s.ia_data&&!busy?" "+tag("escrita pela IA em "+fmtShort(s.ia_data)):""),
          busy?'<textarea data-stream="'+key+'" readonly rows="5" aria-label="Evolução sendo escrita">'+esc(C.iaStream)+'</textarea>':ta(p+".evolucao","Texto final do prontuário.",4))+
        (nota?'<div class="btns cx-noprint"><button class="btn ghost cx-small" data-cx="nt-ver" data-arg="'+esc(nota.id)+'">Ver a nota da sessão</button>'+
            '<button class="btn'+(conf?" warn":" ghost")+' cx-small" data-cx="pr-run" data-arg="'+i+'"'+(C.iaBusy?" disabled":"")+'>'+
            (busy?"Escrevendo…":conf?(str(s.evolucao)?"Substituir a evolução?":"Enviar assim mesmo"):str(s.evolucao)?"Escrever de novo pela nota":"Escrever pela nota")+'</button></div>'+
          (conf?'<div class="cx-linked cx-noprint">'+nomesHTML()+
            (str(s.evolucao)?'<p class="hint">Esta sessão já tem uma evolução escrita; a nova substitui a atual.</p>':'')+'<p class="hint">Clique de novo no botão para enviar.</p></div>':'')
         :'')+
      '</div>';
    }).join("")+
    (ss.length?'':'<div class="panel"><p class="hint">Nenhuma sessão registrada ainda.</p></div>');
}
/* Introdução do prontuário: identificação (da Anamnese) + um parágrafo de anamnese, no começo do prontuário impresso */
function prTelefone(){
  const t=str(C.ctx.patient.telefone);if(!t)return "";
  if(t.startsWith("55")&&(t.length===12||t.length===13)){const n=t.slice(4);return "("+t.slice(2,4)+") "+n.slice(0,n.length-4)+"-"+n.slice(-4);}
  return "+"+t;
}
// [rótulo, valor] da identificação, na ordem do modelo dela
function prIdent(d){
  const a=d.anamnese,cad=C.ctx.patient.created_at;
  return [["Nome",str(a.nome)||C.ctx.patient.name],["Data de nasc.",a.nascimento?fmtDate(a.nascimento):""],["Contato",str(a.telefone)||prTelefone()],
    ["Sexo",a.sexo],["Cor",a.cor],["CPF",a.cpf],["Religião",a.religiao],["Profissão",a.profissao],["Data de cadastro",cad?new Date(cad).toLocaleDateString("pt-BR"):""]].map(([l,v])=>[l,str(v)]);
}
const prTemIntro=d=>!!(str(d.prontuario.intro)||str(d.anamnese.nome)||str(d.anamnese.cpf));
function prIntroHTML(d){
  const id=prIdent(d),falta=id.filter(([,v])=>!v).map(([l])=>l),key=C.pid+":intro",busy=C.iaBusy===key,conf=C.prConfirm==="intro";
  const temAnamnese=!!prAnamneseTexto(d);
  return '<div class="panel cx-pr-intro"><h3>Introdução do prontuário</h3>'+
    '<p class="hint">Vai no começo do prontuário impresso, para quem receber (a paciente ou outro profissional) saber de quem se trata. A identificação, o contato de emergência e o endereço vêm da <button class="linkish" data-cx="sec" data-arg="anamnese">Anamnese</button>.</p>'+
    '<dl class="cx-pr-id">'+id.map(([l,v])=>'<div><dt>'+l+'</dt><dd'+(v?' data-pv':' class="muted"')+'>'+(v?esc(v):"—")+'</dd></div>').join("")+'</dl>'+
    (falta.length?'<p class="hint">Sem preencher na Anamnese: '+falta.join(", ")+'.</p>':'')+
    field("Anamnese (parágrafo da introdução)"+(d.prontuario.intro_ia&&!busy?" "+tag("escrita pela IA em "+fmtShort(d.prontuario.intro_ia)):""),
      busy?'<textarea data-stream="'+key+'" readonly rows="5" aria-label="Parágrafo sendo escrito">'+esc(C.iaStream)+'</textarea>'
        :ta("prontuario.intro","Principais informações da anamnese, em um parágrafo. Escreva aqui ou use Escrever com IA.",4))+
    '<div class="btns cx-noprint"><button class="btn'+(conf?" warn":" ghost")+' cx-small" data-cx="pr-intro"'+(C.iaBusy||!temAnamnese?" disabled":"")+'>'+
      (busy?"Escrevendo…":conf?"Substituir o parágrafo?":"Escrever com IA")+'</button>'+
      (temAnamnese?'':'<span class="hint">Preencha a Anamnese para a IA ter de onde tirar.</span>')+'</div>'+
    (conf?'<p class="hint cx-noprint">Já existe um parágrafo; o novo substitui o atual. Clique de novo para continuar.</p>':'')+'</div>';
}
function prIntroPrintHTML(d){
  const a=d.anamnese,cell=(l,v)=>'<div><b>'+l+':</b> '+esc(str(v))+'</div>';
  const contatos=[a.contato1,a.contato2].map(str).filter(Boolean);
  return '<div class="cx-pr-cover"><h2>Prontuário Psicológico</h2>'+
    '<h3>Identificação do usuário/Instituição</h3><div class="cx-pr-cells">'+prIdent(d).map(([l,v])=>cell(l,v)).join("")+'</div>'+
    (contatos.length?'<h3>Informações do(a) Contato de Emergência</h3>'+contatos.map(c=>'<p class="cx-pre">'+esc(c)+'</p>').join(""):'')+
    (str(a.endereco)?'<h3>Endereço</h3><p class="cx-pre">'+esc(str(a.endereco))+'</p>':'')+
    (str(d.prontuario.intro)?'<h3>Anamnese</h3><p class="cx-pre cx-pr-anam">'+esc(str(d.prontuario.intro))+'</p>':'')+'</div>';
}
// pedido do prontuário de uma sessão (as anotações já conferidas)
function prJob(d,s,ok){
  // primeira sessão, falta, remarcada: quem diz são as anotações (o app pode ter começado no meio do tratamento)
  // o que ficou "para a próxima sessão" entra como plano de ação; a pauta (o que ela pensou levar) não
  const ids=identifiers(d,C.ctx.patient),cont=prContinuidade(d,s),nota=prNota(d,s),
    r=redact(str(nota&&nota.texto)+(str(nota&&nota.proxima)?"\n\nPara a próxima sessão: "+str(nota.proxima):""),ids);
  const dados="# Dados da sessão\n\n- Data: "+(s.data?T.keyDate(s.data).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}):"não informada")+
    "\n- Horário: "+(str(s.hora)||"não informado");
  return {text:PR_PROMPT+"\n\n"+dados+(cont?"\n\n# Ficha de continuidade (sessões anteriores, só contexto)\n\n"+redact(cont,ids).text:"")+"\n\n# Anotações da sessão (anonimizadas)\n\n"+r.text,modo:"sessao",key:C.pid+":s:"+s.id,
    ok,save:(dd,out)=>{const x=dd.prontuario.sessoes.find(z=>z.id===s.id);if(!x)return false;x.evolucao=out;x.ia_data=T.todayKey();}};
}
/* Nota de sessão -> prontuário: cria (ou atualiza) a sessão do prontuário ligada à nota, com a mesma data e o texto
   da nota como anotações, e a IA escreve o registro. Documento importado (não é uma sessão) não vira prontuário. */
const ntPrSessao=(d,n)=>d.prontuario.sessoes.find(s=>s.nota_id===n.id)||null;
async function ntProntuario(d,n,ok,quiet){
  let s=ntPrSessao(d,n);
  if(!s){s={id:uid("s"),data:n.data||T.todayKey(),hora:"",evolucao:"",nota_id:n.id};d.prontuario.sessoes.push(s);schedule();}
  const job=prJob(d,s,ok||"Prontuário desta sessão escrito na aba Prontuário. Revise antes de considerar final.");job.quiet=!!quiet;
  await runIA(job);return job;
}
/* Gerar o prontuário de todas as notas de sessão que ainda não têm, da mais antiga para a mais nova (assim cada uma
   já tem o prontuário da anterior como continuidade). Documentos importados que não são sessão ficam de fora. */
const ntSemProntuario=d=>ntOrder(d).reverse().map(({n})=>n).filter(n=>{const s=ntPrSessao(d,n);return str(n.texto)&&!ntDoc(n)&&!(s&&str(s.evolucao));});
async function ntGerarProntuarios(fila){
  const pid=C.pid,lote={i:0,total:fila.length,parar:false,feitos:0,falhas:0};C.prLote=lote;
  for(const n of fila){
    if(lote.parar||C.pid!==pid)break;
    lote.i++;
    const dd=C.cache[pid],nn=dd&&dd.notas.itens.find(z=>z.id===n.id);if(!nn||!str(nn.texto))continue;
    const job=await ntProntuario(dd,nn,"",true);
    if(job.erro==="rede"){lote.erroMsg=job.erroMsg;break;}
    const s=ntPrSessao(C.cache[pid],nn);if(s&&str(s.evolucao))lote.feitos++;else lote.falhas++;
  }
  C.prLote=null;if(C.pid===pid)render();
  T.toast(lote.erroMsg?lote.erroMsg+" ("+lote.feitos+" de "+lote.total+" prontuários escritos antes de parar.)"
    :(lote.parar?"Parado. ":"")+lote.feitos+(lote.feitos===1?" prontuário escrito":" prontuários escritos")+" na aba Prontuário. Revise antes de considerar final."+(lote.falhas?" "+lote.falhas+" não deram certo: use Gerar prontuário nelas.":""));
}
function prTodasHTML(d){
  if(C.prLote)return '<div class="cx-linked cx-noprint cx-nt-lote" aria-live="polite"><span>A IA está escrevendo os prontuários: <b>'+C.prLote.i+' de '+C.prLote.total+'</b>…</span>'+
    '<button class="btn ghost cx-small" data-cx="pr-todas-parar"'+(C.prLote.parar?" disabled":"")+'>'+(C.prLote.parar?"Parando…":"Parar")+'</button></div>';
  const n=ntSemProntuario(d).length;if(!n)return "";
  return '<div class="cx-linked cx-noprint cx-nt-lote"><span>'+(n>1?n+" notas de sessão ainda não têm prontuário.":"1 nota de sessão ainda não tem prontuário.")+'</span>'+
    '<button class="btn'+(C.prTodasOk?" warn":"")+' cx-small" data-cx="pr-todas"'+(C.iaBusy||C.ntLote?" disabled":"")+'>'+(C.prTodasOk?"Enviar assim mesmo":n>1?"Gerar os prontuários de todas":"Gerar o prontuário")+'</button>'+
    (C.prTodasOk?'<div class="cx-nt-lote-conf">'+nomesHTML()+'<p class="hint">Clique de novo para enviar.</p></div>':'')+'</div>';
}
/* Prontuários antigos (Word/PDF): cada sessão do arquivo vira uma sessão daqui, com o texto como registro.
   Ficam como histórico, e os últimos vão como ficha de continuidade quando a IA escreve o próximo. */
function prHora(t){
  const m=/(?<![\d\/.-])(\d{1,2})\s*(?:h|:)\s*(\d{2})?(?![\d\/])/i.exec(str(t));
  return !m||+m[1]>23||(m[2]&&+m[2]>59)?"":pad2(m[1])+":"+(m[2]||"00");
}
async function prImportar(file){
  const pid=C.pid;if(C.prLendo)return;
  C.prLendo=true;render();
  let texto;
  try{texto=await window.TrilhaImport.lerDocumento(file);}
  catch(e){C.prLendo=false;render();T.toast(DOC_ERR[e&&e.message]||"Não consegui ler este arquivo.");return;}
  C.prLendo=false;
  const d=C.cache[pid];if(!d||C.pid!==pid){render();return;}
  const ss=ntSessoes(texto,fileDay(file)),partes=ss?ss.sessoes:[{rotulo:"",data:fileDay(file),texto}];
  // importar o mesmo arquivo de novo não duplica
  const tem=new Set(d.prontuario.sessoes.map(s=>str(s.evolucao)));
  let n=0,semData=0;
  partes.forEach(x=>{
    const t=str(x.texto);if(!t||tem.has(t))return;tem.add(t);
    d.prontuario.sessoes.push({id:uid("s"),data:x.data||"",hora:prHora(x.rotulo),notas:"",evolucao:t,importada:file.name});
    n++;if(!x.data)semData++;
  });
  schedule();render();
  T.toast(!n?"Estas sessões já estavam no prontuário.":ss?n+(n>1?" sessões importadas":" sessão importada")+", cada uma com a data do título"+(semData?" ("+semData+" sem data: preencha)":"")+". A IA usa as últimas como continuidade."
    :"Não achei títulos de sessão no arquivo ("+NT_EX_TITULO+"): o texto inteiro virou um registro, com a data do arquivo.");
}
function prPrintHTML(){
  const d=D();
  return (prTemIntro(d)?prIntroPrintHTML(d):'')+(prOrder(d).map(({s,n})=>'<div class="panel cx-pr-print"><h3>Sessão '+n+(s.data?' — '+fmtDate(s.data):'')+(str(s.hora)?' às '+esc(str(s.hora)):'')+'</h3><div class="cx-pre">'+esc(str(s.evolucao)||"—")+'</div></div>').join("")||'<p>Nenhuma sessão registrada.</p>');
}
/* Folhas de impressão da Formulação e da Conceitualização: no desenho dos formulários de papel (quadros com borda),
   cada uma numa folha A4. Pouco texto: os quadros crescem até encher a folha; muito texto: a folha toda encolhe. */
const SHEET_H=262; // mm: altura útil do A4 com a margem de 14 mm (e uma folga para não sobrar uma página em branco)
const shTxt=v=>'<div class="sh-txt">'+esc(str(v))+'</div>';
const shBox=(label,v,cls,extra)=>'<div class="sh-box'+(cls?" "+cls:"")+'"><b class="sh-label">'+label+'</b>'+shTxt(v)+(extra||"")+'</div>';
function shHead(d,eyebrow,titulo,diag){
  const nome=str(d.anamnese.nome)||C.ctx.patient.name,hip=str(d.formulacao.hipotese);
  return '<header class="sh-head">'+(eyebrow?'<span class="sh-eyebrow">'+eyebrow+'</span>':'')+'<h1>'+titulo+'</h1>'+
    '<div class="sh-meta"><span><b>Paciente:</b> '+esc(nome)+'</span><span><b>Data:</b> '+new Date().toLocaleDateString("pt-BR")+'</span></div>'+
    '<div class="sh-meta"><span class="sh-diag"><b>'+diag+':</b> '+esc(hip)+'</span></div></header>';
}
function formPrintHTML(){
  const d=D(),f=d.formulacao,o=obj(f.sistemas),q=k=>(FORMULACAO.find(([x])=>x===k)||[,k])[1];
  const sis='<div class="sh-sis"><b class="sh-label">Sistemas afetados</b>'+SISTEMAS.map(([k,l])=>'<div class="sh-sis-row"><span>'+l+':</span>'+shTxt(o[k])+'</div>').join("")+'</div>';
  return '<div class="cx-sheet sh-form">'+shHead(d,"","Formulação de caso","Hipótese diagnóstica")+
    shBox(q("objetivo"),f.objetivo,"sh-objetivo")+
    '<div class="sh-cols">'+
      '<div class="sh-col">'+["vulnerabilidade","modificadores","manutencao","obstaculos","fortes"].map(k=>shBox(q(k),f[k])).join("")+'</div>'+
      '<div class="sh-col">'+shBox(q("crencas"),f.crencas)+shBox(q("problemas"),f.problemas,"sh-grande",sis)+shBox(q("medicamentos"),f.medicamentos)+'</div>'+
    '</div></div>';
}
function conceitPrintHTML(){
  const d=D(),c=d.conceit;
  return '<div class="cx-sheet sh-conceit">'+shHead(d,"Terapia Cognitivo-Comportamental","Diagrama de conceitualização cognitiva","Diagnóstico")+
    '<div class="sh-topo">'+CONCEIT_TOPO.map(([k,l])=>shBox(l,c[k],"sh-ligado")).join("")+'</div>'+
    '<div class="sh-sits">'+c.situacoes.slice(0,3).map((x,i)=>SITUACAO_CAMPOS.map(([k,l])=>shBox(k==="situacao"?l+" "+(i+1):l,obj(x)[k],"sh-ligado"+(k==="situacao"?" sh-sit":""))).join("")).join("")+'</div></div>';
}
// ajusta cada folha a uma página: mede com a largura do A4 (a mesma da impressão)
function fitSheets(){
  const alt=SHEET_H*96/25.4;
  document.querySelectorAll("#case-root .cx-sheet").forEach(el=>{
    el.style.zoom="";el.style.height="auto";
    const h=el.scrollHeight;
    if(h>alt)el.style.zoom=String(Math.max(.45,Math.floor(alt/h*100)/100));else el.style.height=SHEET_H+"mm";
  });
}
const SHEETS={formulacao:formPrintHTML,conceit:conceitPrintHTML};
// impressão pelo menu do navegador depois de abrir a escolha, ou fonte que carregou depois: mede de novo
window.addEventListener("beforeprint",()=>{if(Array.isArray(C.printAll))fitSheets();});
function iaPrintHTML(){
  const d=D();
  return '<div class="panel"><p class="hint">Sugestões geradas por inteligência artificial'+(d.ia.data?' em '+fmtDate(d.ia.data):'')+' a partir dos dados anonimizados. Apoio ao raciocínio clínico — não constituem diagnóstico.</p>'+ta("ia.resposta","",6)+'</div>';
}

/* ---------- Notas de sessão: anotações pessoais dela, fora do prontuário; a IA ajuda a levar para as outras abas ---------- */
// para onde cada informação pode ir (caminho no caso -> nome na tela)
const NT_DESTINOS=[["formulacao.objetivo","Formulação · Objetivo do tratamento"],
  ["formulacao.problemas","Formulação · Lista de problemas"],["formulacao.vulnerabilidade","Formulação · Fatores de vulnerabilidade"],
  ["formulacao.modificadores","Formulação · Modificadores situacionais"],["formulacao.manutencao","Formulação · Fatores de manutenção"],
  ["formulacao.obstaculos","Formulação · Obstáculos do tratamento"],["formulacao.crencas","Formulação · Crenças centrais e pressupostos"],
  ["formulacao.sistemas.pensamentos","Formulação · Sistemas afetados: pensamentos"],["formulacao.sistemas.comportamentos","Formulação · Sistemas afetados: comportamentos"],
  ["formulacao.sistemas.emocoes","Formulação · Sistemas afetados: emoções"],["formulacao.sistemas.reacoes","Formulação · Sistemas afetados: reações físicas"],
  ["formulacao.fortes","Formulação · Pontos fortes e recursos"],["formulacao.medicamentos","Formulação · Medicamentos"],
  ["conceit.historia","Conceitualização · Dados da infância e da história"],["conceit.nucleares","Conceitualização · Crenças nucleares"],
  ["conceit.intermediarias","Conceitualização · Pressupostos / regras"],["conceit.estrategias","Conceitualização · Estratégias compensatórias"],
  ["conceit.situacao","Conceitualização · Situação do diagrama"],["metas.nova","Metas · Nova dificuldade"],["vida.evento","Linha da vida · Evento"]];
const NT_NOME=Object.fromEntries(NT_DESTINOS);
// a pergunta de cada campo (a mesma da tela): a IA põe cada coisa onde ela responde à pergunta, e não só pelo nome
const NT_DICA={...Object.fromEntries(FORMULACAO.map(([k,,q])=>["formulacao."+k,q])),...Object.fromEntries(CONCEIT_TOPO.map(([k,,h])=>["conceit."+k,h])),
  "formulacao.sistemas.pensamentos":"Que pensamentos aparecem junto com o problema?","formulacao.sistemas.comportamentos":"O que ela faz (ou deixa de fazer) por causa do problema?",
  "formulacao.sistemas.emocoes":"Que emoções o problema traz?","formulacao.sistemas.reacoes":"Que reações do corpo aparecem (taquicardia, insônia, tensão…)?",
  "metas.nova":"Uma dificuldade de agora que ela quer superar e pode virar meta do tratamento."};
// em que aba fica cada destino
const NT_ABA={formulacao:"Formulação",conceit:"Conceitualização",metas:"Metas",vida:"Linha da vida"};
const ntAba=dest=>str(dest).split(".")[0];
const NT_FASES=["infancia","adolescencia","adulta"];
// a função aceita até 60 mil caracteres por pedido (o prompt usa ~3 mil); arquivos maiores viram várias notas
const NT_MAX=50000,NT_PARTE=40000;
const DOC_ACCEPT=".docx,.pdf,.txt,.doc";
const DOC_ERR={doc:"Este é um Word antigo (.doc). Abra no Word e use Salvar como → .docx (ou PDF) e importe de novo.",
  tipo:"Aqui entram Word (.docx), PDF ou texto (.txt). Para a planilha da formulação, use Importar arquivo no topo.",
  grande:"O arquivo passa de 30 MB.",vazio:"Não achei texto neste arquivo. Se for um PDF escaneado (foto do papel), a IA não consegue ler: digite ou dite a nota.",
  docx:"Não consegui abrir este Word. Abra no Word, salve de novo como .docx e tente outra vez.",pdf:"Não consegui abrir este PDF. Ele pode estar protegido por senha.",
  xlsx:"Não consegui carregar o leitor de arquivos. Confira a internet.",pdfjs:"Não consegui carregar o leitor de PDF. Confira a internet."};
// texto grande: corta em partes nos parágrafos
function ntPartes(t){
  const out=[];let cur="";
  for(const para of t.split(/\n{2,}/)){
    for(let q=para;q;){
      const piece=q.slice(0,NT_PARTE);q=q.slice(NT_PARTE);
      if(cur&&cur.length+2+piece.length>NT_PARTE){out.push(cur);cur="";}
      cur=cur?cur+"\n\n"+piece:piece;
    }
  }
  if(cur)out.push(cur);
  return out;
}
// data do arquivo (última alteração) como palpite para a data da nota; no futuro ou inválida: hoje
function fileDay(f){
  const t=Number(f&&f.lastModified),d=new Date(t),hoje=T.todayKey();
  if(!t||isNaN(d))return hoje;
  const k=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  return k>hoje?hoje:k;
}
/* Arquivo com várias sessões (ex.: "PRIMEIRA SESSÃO 10/03 às 15h", "2ª sessão - 17/03", "Sessão 3 (24/03/2025)"):
   cada sessão vira uma nota, com a data do título. O que vem antes da 1ª sessão (dados da paciente) vira uma nota à parte. */
const NT_ORD="primeira|segunda|terceira|quarta|quinta|sexta|s[eé]tima|oitava|nona|d[eé]cima(?:\\s+\\p{L}+)?|[uú]ltima";
// dd/mm(/aaaa); o hífen só vale colado ("17-03"), senão "Sessão 1 - 03/02" vira dia 1 de março
const NT_DT=/(?<!\d)(\d{1,2})(?:\s*[\/.]\s*|-)(\d{1,2})(?:(?:\s*[\/.]\s*|-)(\d{4}|\d{2})(?!\d))?/;
// palavras que abrem o título de uma sessão ("TERAPIA 12/06 ÀS 15H", "Consulta 3 - 17/03"); sem data ou número não contam
const NT_PALAVRA="sess[aã]o|atendimento|psicoterapia|terapia|consulta|encontro|retorno";
// "PRONTUÁRIO: SESSÃO 20/10 (14h)" (o título do prontuário dela) também abre uma sessão
const NT_CAB=new RegExp("^[\\s\\-–—•*#>|]*(?:prontu[aá]rio\\s*[:\\-–]?\\s*)?(?:\\d{1,2}\\s*[/.-]\\s*\\d{1,2}(?:\\s*[/.-]\\s*\\d{2,4})?\\s*[-–—:|,]?\\s*)?(?:(?:"+NT_ORD+"|\\d{1,3}\\s*[ªºa°o]?)\\s+)?(?:"+NT_PALAVRA+")(?!\\p{L})","iu");
const NT_NUM=new RegExp("(?:"+NT_ORD+"|\\d{1,3}\\s*[ªºa°o]?)\\s+(?:"+NT_PALAVRA+")|(?:"+NT_PALAVRA+")\\s*(?:n\\s*)?[º°o.]?\\s*\\d","iu");
// data por extenso: "17 de março", "17 mar 2025"
const NT_MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const NT_DT_MES=/(\d{1,2})\s*(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?(?:\s*(?:de\s+)?(\d{4}))?/i;
// linha que é só a data, às vezes com "Data:" ou o dia da semana na frente ("Segunda-feira, 17/03 - 15h")
const NT_SO_DATA=new RegExp("^[\\s\\-–—•*#>|]*(?:data(?:\\s+da\\s+sess[aã]o)?\\s*[:\\-–]?\\s*|(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?\\s*[,\\-–]?\\s*)?"+
  "(?:\\d{1,2}\\s*[/.-]\\s*\\d{1,2}(?:\\s*[/.-]\\s*\\d{2,4})?(?![\\d/])|\\d{1,2}\\s*(?:de\\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\\.?(?:\\s*(?:de\\s+)?\\d{4})?)[^.!?]{0,25}$","iu");
function ntDia(l){
  let m=NT_DT.exec(l),dia,mes,ano;
  if(m){dia=+m[1];mes=+m[2];ano=m[3]?+m[3]:null;}
  else if((m=NT_DT_MES.exec(l))){dia=+m[1];mes=NT_MESES.indexOf(m[2].toLowerCase())+1;ano=m[3]?+m[3]:null;}
  else return {};
  return dia<1||dia>31||mes<1||mes>12?{}:{dia,mes,ano};
}
function ntCabecalho(l){
  // o PDF às vezes junta o título com o começo do texto: vale se a data ou o número vierem logo no início
  const t=l.trim();if(!t||t.length>160)return null;
  if(!NT_CAB.test(t)){
    // linha curta toda em MAIÚSCULAS com data também é título ("DIA 12/06 ÀS 15H")
    const letras=t.replace(/[^\p{L}]/gu,"");
    if(t.length>60||letras.length<2||letras!==letras.toUpperCase())return null;
    const dt=ntDia(t);return dt.dia?{rotulo:t,...dt}:null;
  }
  const ini=t.slice(0,60),dt=ntDia(ini);if(!dt.dia&&!NT_NUM.test(ini))return null;
  return {rotulo:t.length>90?ini.replace(/\s+\S*$/,"")+"…":t,...dt};
}
const pad2=n=>String(n).padStart(2,"0");
// separa o texto nas sessões; sem pelo menos 2 sessões reconhecidas devolve null (fica como antes)
function ntSessoes(t,ref,fixas){
  const linhas=t.split("\n"),achar=f=>linhas.map((l,i)=>{const c=f(l);return c&&{...c,i};}).filter(Boolean);
  let cab=achar(ntCabecalho);
  // menos de 2 títulos com "sessão": junta os títulos que são só a data ("17/03/2025", "Data: 24/03")
  if(cab.length<2){
    const ja=new Set(cab.map(c=>c.i));
    cab=[...cab,...achar(l=>NT_SO_DATA.test(l.trim())?{rotulo:l.trim(),...ntDia(l)}:null).filter(c=>c.dia&&!ja.has(c.i))].sort((a,b)=>a.i-b.i);
  }
  if(cab.length<2)return null;
  // datas: as que já existem (fixas: título -> data, ao separar de novo) e as que têm o ano no título
  const key=(c,y)=>y+"-"+pad2(c.mes)+"-"+pad2(c.dia),valida=(c,y)=>new Date(y,c.mes-1,c.dia).getMonth()===c.mes-1; // 31/02: sem data
  cab.forEach(c=>{
    if(fixas&&fixas.has(c.rotulo)){c.data=fixas.get(c.rotulo);return;}
    if(c.dia&&c.ano!=null){const y=c.ano<100?2000+c.ano:c.ano;if(valida(c,y))c.data=key(c,y);}
  });
  // ano que falta, depois de uma data conhecida: o que deixa a sessão logo depois da anterior
  let prev=null;
  cab.forEach(c=>{
    if(c.data){prev=c.data;return;}
    if(!c.dia||!prev)return;
    let y=+prev.slice(0,4);if(key(c,y)<prev)y++;
    if(valida(c,y)){c.data=key(c,y);prev=c.data;}
  });
  // antes da primeira data conhecida: o mais recente que não passa da sessão seguinte (nem da data do arquivo)
  let lim=ref;
  for(let k=cab.length-1;k>=0;k--){
    const c=cab[k];
    if(c.data){if(c.data<lim)lim=c.data;continue;}
    if(!c.dia)continue;
    let y=+lim.slice(0,4);if(key(c,y)>lim)y--;
    if(valida(c,y)){c.data=key(c,y);lim=c.data;}
  }
  return {intro:linhas.slice(0,cab[0].i).join("\n").trim(),
    sessoes:cab.map((c,k)=>({rotulo:c.rotulo,data:c.data||"",texto:linhas.slice(c.i,k+1<cab.length?cab[k+1].i:linhas.length).join("\n").trim()}))};
}
async function importDoc(file){
  const pid=C.pid;
  if(C.ntLendo)return;
  C.ntLendo=true;if(C.sec!=="notas"){C.sec="notas";}render();
  let texto;
  try{texto=await window.TrilhaImport.lerDocumento(file);}
  catch(e){C.ntLendo=false;render();T.toast(DOC_ERR[e&&e.message]||"Não consegui ler este arquivo.");return;}
  C.ntLendo=false;
  const d=C.cache[pid];
  if(!d||C.pid!==pid){render();return;}
  const {novas,ss}=ntCriarNotas(d,texto,fileDay(file),file.name);
  C.sec="notas";schedule();render();
  ntMostra(novas);
  T.toast(ss?ntAvisoSessoes(ss):novas.length>1?"O texto era longo e virou "+novas.length+" notas, e não achei títulos de sessão para separar ("+NT_EX_TITULO+"). Confira e use Levar para as outras abas em cada uma."
    :"O texto do arquivo virou uma nota. Confira e use Levar para as outras abas.");
}
const NT_EX_TITULO='ex.: "Terapia 12/06", "Segunda sessão 17/03" ou "Sessão 2 - 17/03"';
const ntAvisoSessoes=ss=>{const semData=ss.sessoes.filter(x=>!x.data).length;
  return "Achei "+ss.sessoes.length+" sessões: cada uma virou uma nota, com a data dela"+(semData?" ("+semData+" sem data no título: preencha)":"")+". Use Levar para as outras abas em cada uma.";};
// notas que acabaram de entrar (importar, separar) ficam abertas: ela precisa conferir as datas
function ntMostra(novas){novas.forEach(n=>C.ntAbertas.set(n.id,true));render();const el=novas.length&&document.getElementById("nt-"+novas[novas.length-1].id);if(el)el.scrollIntoView({block:"start"});}
// texto de um arquivo -> notas (uma por sessão, se achar os títulos; senão uma só, em partes se for grande)
function ntCriarNotas(d,texto,data,arquivo,fixas){
  const novas=[],ss=ntSessoes(texto,data,fixas),lote=uid("l");
  // de trás para frente para a parte 1 ficar em cima (mais nova primeiro, empate pela ordem)
  const poe=(t,extra,rot)=>{const ps=ntPartes(t);for(let k=ps.length-1;k>=0;k--){
    const n={id:uid("n"),texto:ps[k],sugestoes:[],arquivo,lote,...extra};
    if(rot!=null||ps.length>1)n.rotulo=(rot||arquivo)+(ps.length>1?" (parte "+(k+1)+" de "+ps.length+")":"");
    d.notas.itens.push(n);novas.push(n);
  }};
  if(ss){
    const primeira=(ss.sessoes.find(x=>x.data)||{}).data||data;
    if(ss.intro.replace(/[^\p{L}\p{N}]/gu,"").length>=20)poe(ss.intro,{data:primeira},"Início do arquivo (antes da 1ª sessão)");
    ss.sessoes.forEach(x=>poe(x.texto,{data:x.data,sessao:true},x.rotulo));
  }else poe(texto,{data},null);
  return {novas,ss};
}
// notas já importadas inteiras (ou em partes): junta as partes do mesmo arquivo e separa por sessão
const NT_PARTE_RE=/ \(parte (\d+) de \d+\)$/;
const ntBaseArq=n=>str(n.arquivo).replace(NT_PARTE_RE,"");
// as notas que vieram da mesma importação, na ordem do arquivo. Cada importação tem um "lote"; as de antes não
// têm: aí vale o mesmo arquivo e a mesma versão (a mais antiga tinha "(parte k de n)" no nome do arquivo)
function ntGrupoArquivo(d,n){
  const base=ntBaseArq(n),velha=x=>NT_PARTE_RE.test(str(x.arquivo));
  const its=d.notas.itens.filter(x=>x.arquivo&&(n.lote?x.lote===n.lote:!x.lote&&ntBaseArq(x)===base&&velha(x)===velha(n)));
  const parte=x=>{const m=NT_PARTE_RE.exec(str(x.rotulo))||NT_PARTE_RE.exec(str(x.arquivo));return m?+m[1]:1;};
  // as partes de uma mesma sessão foram guardadas de trás para frente: ordena pela 1ª aparição da sessão e pela parte
  const chave=x=>str(x.rotulo).replace(NT_PARTE_RE,""),prim=new Map();
  its.forEach((x,i)=>{if(!prim.has(chave(x)))prim.set(chave(x),i);});
  return its.map((x,i)=>({x,i})).sort((a,b)=>prim.get(chave(a.x))-prim.get(chave(b.x))||parte(a.x)-parte(b.x)||a.i-b.i).map(o=>o.x);
}
const NT_PROMPT=[
"Você é supervisora clínica em Terapia Cognitivo-Comportamental e ajuda uma psicóloga a organizar o caso de uma paciente. Leia as anotações abaixo (de uma sessão ou de um documento antigo do caso, já anonimizadas) e sugira o que vale levar para as partes do caso.",
"",
"O MAIS IMPORTANTE: só sugira o que ajuda a entender o caso — por que ela tem esses problemas, por que não consegue resolvê-los sozinha e o que dificulta a melhora. O foco é sempre a Lista de problemas, as metas e os obstáculos. Fato do dia a dia, relato solto ou detalhe que não muda o entendimento do caso fica de fora. Poucas sugestões boas valem mais que muitas: no máximo 8 por anotação (menos, se ela trouxer pouco de novo; nenhuma, se não trouxer nada). Na Conceitualização, só as crenças e as situações principais.",
"",
"NÃO REPETIR: mais abaixo vêm o que já está escrito no caso e as sugestões que ainda esperam a decisão dela. Não sugira nada que já esteja lá, nem com outras palavras. Só volte a um assunto se a anotação trouxer uma informação nova sobre ele, e então escreva só a parte nova.",
"",
"JUNTAR: o que for da mesma pessoa ou do mesmo assunto vira um item só, em texto corrido, com as partes separadas por ponto e vírgula (;). Ex.: em vez de três itens sobre o pai, um item \"Pai: ...; ...; ...\". O mesmo vale para uma lista de distorções, de emoções ou de comportamentos.",
"",
"Responda SOMENTE com um JSON neste formato, sem nenhum texto antes ou depois:",
'{"itens":[{"destino":"<chave>","texto":"<frase curta>"}]}',
"",
"Chaves que podem ser usadas (use só estas):",
...NT_DESTINOS.filter(([k])=>k!=="conceit.situacao"&&k!=="vida.evento").map(([k,l])=>"- "+k+" ("+l.split(" · ")[1]+"): "+NT_DICA[k]),
'- conceit.situacao: uma situação concreta e marcante, com o que ela pensou e sentiu. Formato: {"destino":"conceit.situacao","situacao":"...","pensamento":"...","significado":"...","emocoes":"...","comportamento":"..."} (deixe vazio o que não estiver nas anotações)',
'- vida.evento: um acontecimento da história de vida que ajuda a entender o caso. Formato: {"destino":"vida.evento","fase":"infancia|adolescencia|adulta","idade":"...","texto":"..."}',
"",
"Como escolher a chave: o item tem que responder à pergunta da chave. Se não responder bem a nenhuma, deixe o item de fora. O que mais confunde:",
"- Lista de problemas = queixas de agora. Fatores de vulnerabilidade e Dados da infância e da história = o que aconteceu antes e a deixou mais vulnerável.",
"- Modificadores situacionais = o que é de fora dela (pessoas, trabalho, casa, dinheiro), inclusive os gatilhos: o que acontece fora dela e faz o problema voltar ou piorar. Fatores de manutenção = padrões dela (de pensar, sentir ou agir) que mantêm o problema.",
"- Crenças nucleares = ideias absolutas sobre si, os outros ou o mundo (\"sou incapaz\"). Pressupostos / regras = \"se… então…\", \"eu deveria…\". Estratégias compensatórias = o que ela faz para lidar com essas crenças. Use estas três chaves da Conceitualização para crenças (elas já aparecem na Formulação); formulacao.crencas só para o que não couber nelas.",
"- Uma dificuldade que ela quer superar vai em metas.nova (ela já aparece na Lista de problemas).",
"- Uma situação concreta com o que ela pensou e sentiu vai em conceit.situacao; Sistemas afetados é o jeito como o problema costuma aparecer, não uma situação.",
"- Obstáculos do tratamento = o que pode atrapalhar a terapia (faltas, não fazer as tarefas, pouca motivação). Pontos fortes = o que ajuda.",
"",
"Regras: não invente nada que não esteja nas anotações; frases curtas, em português; pensamentos automáticos entre aspas, como ela falou; mantenha marcadores como [nome] como estão; a mesma informação só uma vez, no lugar que mais combina; nada de diagnóstico."
].join("\n");
// o que já está escrito nos campos para onde a IA leva as coisas (para ela não repetir), sem passar do limite do pedido
function ntContexto(d,max,nota){
  const one=s=>str(s).replace(/\s*\n+\s*/g," / ");
  const out=[];
  NT_DESTINOS.forEach(([k,l])=>{
    let v="";
    if(k==="metas.nova")v=d.metas.map(m=>str(m.dificuldade)).filter(Boolean).join(" / ");
    else if(k==="vida.evento")v=NT_FASES.flatMap(f=>d.vida[f].map(e=>str(e.evento))).filter(Boolean).join(" / ");
    else if(k==="conceit.situacao")v=d.conceit.situacoes.filter(s=>str(s.situacao)||str(s.pensamento)).map(s=>str(s.situacao)+(str(s.pensamento)?" — "+str(s.pensamento):"")).join(" / ");
    else v=one(getPath(d,k));
    if(v)out.push("- "+k+": "+v.slice(0,1500));
  });
  // as sugestões que ainda esperam decisão (das outras notas: as desta são trocadas pelas novas): também não repetir
  const pend=ntPend(d,(dest,x)=>!(nota&&arr(nota.sugestoes).includes(x))).map(({x})=>"- "+x.destino+": "+(x.destino==="conceit.situacao"?str(x.situacao)+" — "+str(x.pensamento):str(x.texto)));
  let t=(out.length?"# O que já está escrito no caso (não repetir)\n\n"+out.join("\n"):"")+(pend.length?"\n\n# Sugestões que ainda esperam a decisão dela (não repetir)\n\n"+pend.join("\n"):"");
  return t.length>max?t.slice(0,max)+"\n[…]":t;
}
function ntOrder(d){return d.notas.itens.map((n,i)=>({n,i})).sort((a,b)=>(str(b.n.data)>str(a.n.data)?1:str(b.n.data)<str(a.n.data)?-1:b.i-a.i));}
// o texto já está no campo de destino? (para não repetir)
function ntJaTem(d,x){
  if(x.destino==="metas.nova")return d.metas.some(m=>str(m.dificuldade).toLowerCase()===str(x.texto).toLowerCase());
  if(x.destino==="vida.evento")return NT_FASES.some(f=>d.vida[f].some(e=>str(e.evento).toLowerCase()===str(x.texto).toLowerCase()));
  if(x.destino==="conceit.situacao")return d.conceit.situacoes.some(s=>str(s.situacao)&&str(s.situacao).toLowerCase()===str(x.situacao).toLowerCase());
  return str(getPath(d,x.destino)).toLowerCase().includes(str(x.texto).toLowerCase());
}
function ntResumo(x){
  if(x.destino==="conceit.situacao")return [["situacao","Situação"],["pensamento","Pensamento"],["significado","Significado"],["emocoes","Emoções"],["comportamento","Comportamento"]]
    .filter(([k])=>str(x[k])).map(([k,l])=>l+": "+str(x[k])).join(" · ");
  if(x.destino==="vida.evento")return str(x.texto)+(str(x.idade)?" ("+str(x.idade)+")":"")+" — "+({infancia:"infância",adolescencia:"adolescência",adulta:"vida adulta"}[x.fase]||"fase a classificar");
  return str(x.texto);
}
// na nota, só o resumo: quantas sugestões esperam em cada aba, com o atalho para lá
function ntResumoNota(d,n,i,pend){
  const c=ntPorAba(d,(dest,x)=>pend.includes(x)),feitas=n.sugestoes.length-pend.length;
  return '<div class="cx-linked cx-nt-sug cx-noprint"><span class="eyebrow">Sugestões da IA'+(n.extraida_em?" · "+fmtShort(n.extraida_em):"")+'</span>'+
    (n.cortada&&pend.length?'<p class="hint">O texto é longo e a resposta da IA chegou cortada: pode faltar alguma coisa do fim. Se precisar, divida a nota em duas e leve cada uma.</p>':'')+
    (pend.length?'<p class="hint">'+(pend.length>1?pend.length+" sugestões estão":"1 sugestão está")+' nas abas, embaixo do campo onde cada uma entraria. Lá você insere, ajusta ou descarta, junto com o que já está escrito.</p>'+
      '<div class="btns">'+Object.keys(NT_ABA).filter(a=>c[a]).map(a=>'<button class="btn cx-small" data-cx="sec" data-arg="'+a+'">'+NT_ABA[a]+' ('+c[a]+')</button>').join("")+
      '<button class="btn ghost cx-small" data-cx="nt-clear" data-arg="'+i+'">Descartar as desta nota</button></div>'
     :'<p class="hint">Você já decidiu todas as sugestões desta nota'+(feitas?" ("+feitas+" no caso)":"")+'.</p>')+'</div>';
}
// aberta ou fechada: a mais recente começa aberta; fechada, só o resumo (como as dificuldades nas Metas)
const ntAberta=(n,k)=>C.ntAbertas.has(n.id)?C.ntAbertas.get(n.id):k===0;
function ntResumoTxt(n){
  const t=str(n.texto)||str(n.pauta);if(!t)return "Nota vazia.";
  const l=t.replace(/\s*\n+\s*/g," · ");return l.length>220?l.slice(0,220).replace(/\s+\S*$/,"")+"…":l;
}
function notasHTML(){
  const d=D(),ns=ntOrder(d);
  return '<p class="hint">Suas anotações de cada sessão, do jeito que você escreve. Cada nota tem a <b>pauta</b> (o que você já pensou levar), as <b>anotações da sessão</b> e o que fica <b>para a próxima</b>; a nota nova já começa com o que você deixou para ela. <b>Levar para as outras abas</b>: a IA lê as anotações (com os nomes trocados antes de enviar), sugere o que vai para a Formulação, a Conceitualização, as Metas e a Linha da vida, e escreve o <b>prontuário da sessão</b>. Também dá para <b>importar um Word ou PDF</b>: o texto vira uma nota e segue o mesmo caminho.</p>'+
    '<div class="btns cx-noprint"><button class="btn" data-cx="nt-new">+ Nova nota</button>'+
      '<label class="btn ghost'+(C.ntLendo?" disabled":"")+'" style="cursor:pointer">'+(C.ntLendo?"Lendo o arquivo…":"Importar Word ou PDF")+
      '<input type="file" id="cx-nt-import" accept="'+DOC_ACCEPT+'" hidden'+(C.ntLendo?" disabled":"")+'></label></div>'+
    ntTodasHTML(d)+prTodasHTML(d)+
    ns.map(({n,i},k)=>{
      const p="notas.itens."+i,key=C.pid+":n:"+n.id,busy=C.iaBusy===key,conf=C.ntConfirm===n.id,sug=n.sugestoes||[];
      const pend=sug.filter(x=>!x.aplicada),ps=ntPrSessao(d,n),prBusy=!!ps&&C.iaBusy===C.pid+":s:"+ps.id;
      const aberta=ntAberta(n,k)||busy||prBusy||conf||C.prConfirm==="n:"+n.id||dictOn(n),doc=ntDoc(n);
      const status=[pend.length?pend.length+(pend.length>1?" sugestões esperando":" sugestão esperando"):"",ps&&str(ps.evolucao)?"prontuário ✓":"",n.extraida_em||doc?"":"ainda não lida pela IA"].filter(Boolean);
      return '<div class="panel cx-sessao cx-nota'+(aberta?"":" fechada")+'" id="nt-'+esc(n.id)+'"><div class="cx-meta-head">'+
          '<button class="icon-btn cx-noprint" data-cx="nt-abrir" data-arg="'+esc(n.id)+'" aria-expanded="'+aberta+'" aria-label="'+(aberta?"Fechar":"Abrir")+' esta nota">'+(aberta?"▾":"▸")+'</button>'+
          '<b class="cx-grow">'+(n.rotulo||n.arquivo?'<span class="cx-nt-arq">'+esc(n.rotulo||n.arquivo)+'</span>':n.data?"Sessão de "+fmtDate(n.data):"Nota sem data")+'</b>'+
          inp(p+".data","date","",' aria-label="'+(doc?"Data do documento":"Data da sessão")+'" style="width:auto"')+delBtn(p,"Apagar nota")+'</div>'+
        (!aberta?'<p class="cx-nt-resumo" data-cx="nt-abrir" data-arg="'+esc(n.id)+'">'+esc(ntResumoTxt(n))+'</p>'+(status.length?'<div class="cx-chips">'+status.map(t=>tag(esc(t))).join("")+'</div>':'')+'</div>':
        (n.sessao?'<p class="hint">Sessão separada do arquivo '+esc(n.arquivo)+'. '+(n.data?'A data veio do título da sessão — confira.':'O título não tinha data: preencha a data da sessão.')+'</p>'
          :n.arquivo?'<p class="hint">Texto importado do arquivo'+(n.rotulo?' '+esc(n.arquivo):'')+'. A data veio do arquivo — corrija se for de outra sessão.</p>':'')+
        (doc?'':field("Para levar à sessão (pauta)",ta(p+".pauta","Assuntos que você já pensou, mensagens que ela mandou durante a semana…",2),"cx-nt-pauta"))+
        field(doc?"Anotações":"Anotações da sessão",ta(p+".texto","O que ela trouxe, falas importantes, situações, emoções, o que vocês trabalharam…"+(SR?" Ou dite pelo microfone.":""),5))+
        dictHTML(n)+
        (doc?'':field("Para a próxima sessão",ta(p+".proxima","O que você pensou em trabalhar na próxima sessão. A próxima nota já começa com isto na pauta.",2),"cx-nt-proxima"))+
        '<div class="btns cx-noprint">'+dictBtn(n)+'<button class="btn'+(conf?" warn":" ghost")+' cx-small" data-cx="nt-run" data-arg="'+i+'"'+(C.iaBusy||dictOn(n)?" disabled":"")+'>'+
          (busy?"Lendo a nota…":conf?(pend.length?"Trocar as sugestões?":"Enviar assim mesmo"):"Levar para as outras abas")+'</button>'+
          // o prontuário da sessão: sai junto com o Levar para as outras abas, ou por aqui
          (doc?"":ps&&str(ps.evolucao)&&!prBusy?'<button class="btn ghost cx-small" data-cx="sec" data-arg="prontuario">Ver no prontuário</button>'
            :'<button class="btn'+(C.prConfirm==="n:"+n.id?" warn":" ghost")+' cx-small" data-cx="nt-pr" data-arg="'+i+'"'+(C.iaBusy||dictOn(n)?" disabled":"")+'>'+(prBusy?"Escrevendo o prontuário…":C.prConfirm==="n:"+n.id?"Enviar assim mesmo":"Gerar prontuário")+'</button>')+
          // arquivo importado inteiro: separar nas sessões que estiverem nele
          (n.arquivo?'<button class="btn'+(C.ntSplitAsk===n.id?" warn":" ghost")+' cx-small" data-cx="nt-split" data-arg="'+i+'"'+(C.iaBusy||dictOn(n)?" disabled":"")+'>'+
            (C.ntSplitAsk===n.id?"Separar mesmo assim?":"Separar por sessão")+'</button>':'')+'</div>'+
        (C.ntSplitAsk===n.id?'<p class="hint cx-noprint">Esta nota já tem sugestões da IA: ao separar, elas saem (o que já foi levado continua nas outras abas). Clique de novo para separar.</p>':'')+
        (conf?'<div class="cx-linked cx-noprint">'+nomesHTML()+
          (pend.length?'<p class="hint">Esta nota já tem sugestões ainda não aplicadas; as novas substituem essas.</p>':'')+'<p class="hint">Clique de novo no botão para enviar.</p></div>':'')+
        (C.prConfirm==="n:"+n.id?'<div class="cx-linked cx-noprint">'+nomesHTML()+'<p class="hint">Clique de novo para gerar o prontuário.</p></div>':'')+
        (busy?'<p class="hint cx-noprint" aria-live="polite">A IA está lendo a nota e separando o que vai para cada aba…</p>':'')+
        (sug.length&&!busy?ntResumoNota(d,n,i,pend):'')+
      '</div>');
    }).join("")+
    (ns.length?'':'<div class="panel"><p class="hint">Nenhuma nota ainda.</p></div>');
}
// lê o JSON da IA e guarda só o que for válido
// pedido da IA para uma nota (o texto já conferido): a resposta vira as sugestões da nota
function ntJob(d,n){
  const ids=identifiers(d,C.ctx.patient),r=redact(str(n.texto),ids);
  // o que já está no caso vai junto (anonimizado), até caber no limite de 60 mil caracteres do pedido
  const ctx=redact(ntContexto(d,Math.max(0,57000-NT_PROMPT.length-r.text.length),n),ids).text;
  const job={text:NT_PROMPT+(ctx?"\n\n"+ctx:"")+"\n\n# "+(ntDoc(n)?"Documento importado (anonimizado)":"Anotações da sessão (anonimizadas)")+"\n\n"+r.text,modo:"extrair",key:C.pid+":n:"+n.id,
    ok:"Pronto.",falhou:"A IA respondeu fora do formato esperado. Tente de novo.",
    save:(dd,out)=>{
      const x=dd.notas.itens.find(z=>z.id===n.id),its=ntParse(out);if(!x||!its)return false;
      // mantém as que já foram aplicadas (histórico) e troca as pendentes pelas novas
      x.sugestoes=[...x.sugestoes.filter(z=>z.aplicada),...its];x.extraida_em=T.todayKey();x.cortada=its.cortada||undefined;job.salvou=true;
      const c={};its.forEach(z=>{const a=ntAba(z.destino);c[a]=(c[a]||0)+1;});job.c=c;
      job.ok=its.length?"Pronto: "+Object.keys(NT_ABA).filter(a=>c[a]).map(a=>NT_ABA[a]+" ("+c[a]+")").join(", ")+". As sugestões estão embaixo de cada campo, nessas abas."
        :"A IA não achou nada nesta nota para as outras abas.";
    }};
  return job;
}
/* Levar todas: as notas que a IA ainda não leu, da mais antiga para a mais nova, uma de cada vez.
   Sem o prontuário de cada uma (são, em geral, notas antigas, que já têm prontuário). */
const ntNaoLidas=d=>ntOrder(d).reverse().map(({n})=>n).filter(n=>str(n.texto)&&!n.extraida_em);
async function ntLevarTodas(fila){
  const pid=C.pid,lote={i:0,total:fila.length,parar:false,lidas:0,longas:0,falhas:0,c:{}};C.ntLote=lote;
  for(const n of fila){
    if(lote.parar||C.pid!==pid)break;
    lote.i++;
    const dd=C.cache[pid],nn=dd&&dd.notas.itens.find(z=>z.id===n.id);if(!nn||!str(nn.texto)||nn.extraida_em)continue;
    if(redact(str(nn.texto),identifiers(dd,C.ctx.patient)).text.length>NT_MAX){lote.longas++;continue;}
    const job=ntJob(dd,nn);job.quiet=true;
    await runIA(job);
    if(job.salvou){lote.lidas++;Object.entries(job.c||{}).forEach(([a,k])=>{lote.c[a]=(lote.c[a]||0)+k;});}
    else{lote.falhas++;if(job.erro==="rede"){lote.erroMsg=job.erroMsg;break;}} // sem conexão, sem crédito…: para aqui
  }
  C.ntLote=null;if(C.pid===pid)render();
  // muitas notas de uma vez repetem muito: as abas com 6 ou mais sugestões já saem organizadas
  let org=false;
  if(lote.lidas&&!lote.erroMsg&&!lote.parar)for(const a of Object.keys(NT_ABA)){
    if(C.pid!==pid)break;
    if(ntPendAba(C.cache[pid],a).length>=6){const r=await ntOrganizar(a,true);if(r&&r.antes)org=true;}
  }
  if(org){const c=ntPorAba(C.cache[pid]);lote.c=c;}
  const abas=Object.keys(NT_ABA).filter(a=>lote.c[a]).map(a=>NT_ABA[a]+" ("+lote.c[a]+")").join(", ")+(org?" — já organizadas: juntei as do mesmo assunto e tirei as repetidas":"");
  T.toast(lote.erroMsg?lote.erroMsg+" ("+lote.lidas+" de "+lote.total+" notas lidas antes de parar.)"
    :(lote.parar?"Parado. ":"")+lote.lidas+(lote.lidas===1?" nota lida":" notas lidas")+(abas?": "+abas+". As sugestões estão embaixo de cada campo, nessas abas.":".")+
      (lote.longas?" "+lote.longas+(lote.longas>1?" notas longas":" nota longa")+" demais para ler de uma vez: divida em duas.":"")+
      (lote.falhas?" "+lote.falhas+" com resposta fora do formato: use Levar para as outras abas nelas.":""));
}
// o botão (ou o andamento) do Levar todas: nas Notas de sessão e no alto da Formulação
function ntTodasHTML(d){
  if(C.ntLote)return '<div class="cx-linked cx-noprint cx-nt-lote" aria-live="polite"><span>A IA está lendo as notas: <b>'+C.ntLote.i+' de '+C.ntLote.total+'</b>…</span>'+
    '<button class="btn ghost cx-small" data-cx="nt-todas-parar"'+(C.ntLote.parar?" disabled":"")+'>'+(C.ntLote.parar?"Parando…":"Parar")+'</button></div>';
  const n=ntNaoLidas(d).length;if(!n)return "";
  return '<div class="cx-linked cx-noprint cx-nt-lote"><span>'+(n>1?n+" notas de sessão ainda não foram lidas":"1 nota de sessão ainda não foi lida")+' pela IA.</span>'+
    '<button class="btn'+(C.ntTodasOk?" warn":"")+' cx-small" data-cx="nt-todas"'+(C.iaBusy?" disabled":"")+'>'+(C.ntTodasOk?"Enviar assim mesmo":n>1?"Levar todas para as outras abas":"Levar para as outras abas")+'</button>'+
    (C.ntTodasOk?'<div class="cx-nt-lote-conf">'+nomesHTML()+'<p class="hint">Clique de novo para enviar.</p></div>':'')+'</div>';
}
/* Organizar as sugestões de uma aba: a IA, como supervisora, revisa as sugestões que esperam decisão junto com o que já
   está escrito nos campos — junta as do mesmo assunto (mesmo de sessões diferentes), tira as repetidas e as que não ajudam
   a entender o caso. Vai em partes de até 60 sugestões (cada parte é um pedido). */
const NT_REV_PROMPT=[
"Você é supervisora clínica em Terapia Cognitivo-Comportamental e revisa as sugestões que uma IA tirou das anotações de sessão de uma psicóloga, antes de ela decidir o que entra em cada parte do caso da paciente. Há sugestões demais, repetidas e pouco úteis: o seu trabalho é deixar só o que ajuda, bem organizado.",
"",
"O que fazer:",
"- Tire o que já está escrito no caso (mais abaixo), mesmo com outras palavras. Se a sugestão só acrescenta um detalhe novo ao que já está escrito, deixe só o detalhe novo.",
"- Junte num item só o que for da mesma pessoa ou do mesmo assunto, mesmo vindo de sessões diferentes, em texto corrido com as partes separadas por ponto e vírgula (;).",
"- Deixe de fora o que não ajuda a entender por que ela tem esses problemas, por que não consegue resolvê-los sozinha ou o que dificulta a melhora. O foco é a Lista de problemas, as metas e os obstáculos.",
"- Na Conceitualização, fique só com as crenças e as situações principais (no máximo 3 situações).",
"- Confira se cada item está na chave certa (Modificadores situacionais = de fora dela, inclusive gatilhos; Fatores de manutenção = padrões dela que mantêm o problema); se não estiver, troque o destino para uma das chaves desta lista.",
"- Não invente nada além do que está nas sugestões. Mantenha marcadores como [nome] como estão.",
"",
"Responda SOMENTE com um JSON, sem nenhum texto antes ou depois. Em \"de\", os códigos das sugestões que o item junta ou aproveita (toda sugestão que ficar de fora simplesmente não aparece em nenhum \"de\"):",
'{"itens":[{"de":["S1","S4"],"destino":"<chave>","texto":"..."}]}',
'Para conceit.situacao, em vez de "texto": "situacao","pensamento","significado","emocoes","comportamento". Para vida.evento, também "fase" (infancia|adolescencia|adulta) e "idade".'
].join("\n");
const ntPendAba=(d,aba)=>ntPend(d,dest=>ntAba(dest)===aba);
function ntRevPartes(ps){
  // em partes de até 60, sem separar as sugestões de um mesmo campo (a não ser que ele sozinho passe de 60)
  const grupos=[...ps.reduce((m,z)=>(m.has(z.x.destino)?m.get(z.x.destino).push(z):m.set(z.x.destino,[z]),m),new Map()).values()];
  const partes=[];let cur=[];
  grupos.forEach(g=>{for(let k=0;k<g.length;k+=60){const pedaco=g.slice(k,k+60);if(cur.length&&cur.length+pedaco.length>60){partes.push(cur);cur=[];}cur=cur.concat(pedaco);}});
  if(cur.length)partes.push(cur);
  return partes;
}
function ntRevJob(d,parte,aba){
  const ids=identifiers(d,C.ctx.patient),dests=[...new Set(parte.map(z=>z.x.destino))];
  const one=s=>str(s).replace(/\s*\n+\s*/g," / ");
  const campo=k=>k==="metas.nova"?d.metas.map(m=>str(m.dificuldade)).filter(Boolean).join(" / "):k==="vida.evento"?NT_FASES.flatMap(f=>d.vida[f].map(e=>str(e.evento))).filter(Boolean).join(" / ")
    :k==="conceit.situacao"?d.conceit.situacoes.filter(s=>str(s.situacao)||str(s.pensamento)).map(s=>str(s.situacao)+" — "+str(s.pensamento)).join(" / "):one(getPath(d,k));
  const chaves=dests.map(k=>"- "+k+" ("+(NT_NOME[k]||k).split(" · ")[1]+"): "+(NT_DICA[k]||"")).join("\n");
  const escrito=dests.map(k=>{const v=campo(k);return v?"- "+k+": "+v.slice(0,3000):null;}).filter(Boolean).join("\n");
  const cod=new Map();
  const lista=parte.map((z,k)=>{const c="S"+(k+1);cod.set(c,z);return c+" ["+z.x.destino+"] ("+(ntDoc(z.n)?"documento ":"sessão ")+ntQuandoX(z.n,z.x)+") "+(z.x.destino==="conceit.situacao"?ntResumo(z.x):z.x.destino==="vida.evento"?str(z.x.texto)+(str(z.x.idade)?" (idade: "+str(z.x.idade)+")":"")+(z.x.fase?" [fase: "+z.x.fase+"]":""):str(z.x.texto));}).join("\n");
  const job={text:NT_REV_PROMPT+"\n\n# Chaves desta revisão\n\n"+chaves+(escrito?"\n\n# O que já está escrito no caso\n\n"+redact(escrito,ids).text:"")+"\n\n# Sugestões a revisar\n\n"+lista,
    modo:"revisar",key:C.pid+":org:"+aba,quiet:true,
    save:(dd,out)=>{
      const a=out.indexOf("{"),b=out.lastIndexOf("}");let j=null;if(a>=0&&b>a){try{j=JSON.parse(out.slice(a,b+1));}catch(_){}}
      if(!j||!Array.isArray(j.itens))return false;
      // as originais (pelo id, que a tela pode ter recarregado): saem todas; ficam só os itens revisados
      const achar=x=>{for(const n of dd.notas.itens){const y=arr(n.sugestoes).find(z=>z.id===x.id&&!z.aplicada);if(y)return {n,x:y};}return null;};
      const orig=parte.map(z=>achar(z.x)).filter(Boolean);
      const novos=[];
      j.itens.forEach(it=>{
        const fontes=arr(obj(it).de).map(c=>cod.get(String(c))).filter(Boolean).map(z=>achar(z.x)).filter(Boolean);
        const dest=dests.includes(obj(it).destino)||ntAba(obj(it).destino)===aba&&NT_NOME[obj(it).destino]?obj(it).destino:null;
        const x=dest&&fontes.length&&ntItens({itens:[{...obj(it),destino:dest}]})[0];if(!x)return;
        const datas=[...new Set(fontes.map(f=>str(f.n.data)).filter(Boolean))].sort();
        // juntou várias: "sessões" (ou "notas", se entrou algum documento importado)
        if(datas.length>1){x.datas=datas;x.rot=fontes.every(f=>!ntDoc(f.n))?"sessões":"notas";}
        x.revisada=true;
        // fica na nota mais recente das que ela junta (o link "sessão…" abre essa)
        const nota=fontes.map(f=>f.n).sort((p,q)=>str(q.data).localeCompare(str(p.data)))[0];
        novos.push({nota,x});
      });
      orig.forEach(({n,x})=>{n.sugestoes=n.sugestoes.filter(z=>z!==x);});
      novos.forEach(({nota,x})=>nota.sugestoes.push(x));
      job.antes=orig.length;job.depois=novos.length;
    }};
  return job;
}
async function ntOrganizar(aba,silencioso){
  const pid=C.pid,d=C.cache[pid];if(!d||C.iaBusy)return null;
  const partes=ntRevPartes(ntPendAba(d,aba));if(!partes.length)return null;
  const r={antes:0,depois:0,erro:null};C.ntOrg={aba,i:0,total:partes.length};
  for(const parte of partes){
    if(C.pid!==pid)break;
    C.ntOrg.i++;render();
    const job=ntRevJob(C.cache[pid],parte,aba);
    await runIA(job);
    if(job.antes!=null){r.antes+=job.antes;r.depois+=job.depois;}
    else{r.erro=job.erro==="rede"?job.erroMsg:"A IA respondeu fora do formato em uma parte; ela ficou como estava.";if(job.erro==="rede")break;}
  }
  C.ntOrg=null;if(C.pid===pid)render();
  if(!silencioso)T.toast(r.antes?NT_ABA[aba]+": "+r.antes+(r.antes>1?" sugestões viraram ":" sugestão virou ")+r.depois+", juntando as do mesmo assunto e tirando as repetidas e as que não ajudam."+(r.erro?" "+r.erro:""):(r.erro||"Nada para organizar."));
  return r;
}
// o botão (ou o andamento) do Organizar, no alto de cada aba com sugestões
function ntOrgHTML(d,aba){
  if(C.ntOrg&&C.ntOrg.aba===aba)return '<div class="cx-linked cx-noprint cx-nt-lote" aria-live="polite"><span>A IA está organizando as sugestões'+(C.ntOrg.total>1?' (parte '+C.ntOrg.i+' de '+C.ntOrg.total+')':'')+'…</span></div>';
  const n=ntPendAba(d,aba).length;if(n<2)return "";
  return '<div class="cx-linked cx-noprint cx-nt-lote"><span><b>'+n+' sugestões da IA</b> esperando nesta aba. <b>Organizar</b> junta as do mesmo assunto (mesmo de sessões diferentes) e tira as repetidas e as que não ajudam a entender o caso.</span>'+
    '<button class="btn cx-small" data-cx="nt-org" data-arg="'+aba+'"'+(C.iaBusy||C.ntOrg||C.ntLote?" disabled":"")+'>Organizar as sugestões</button></div>';
}
function ntParse(out){
  const a=out.indexOf("{"),b=out.lastIndexOf("}");if(a<0||b<a)return null;
  let j,cortada=false;try{j=JSON.parse(out.slice(a,b+1));}catch(_){j=null;}
  // resposta cortada no meio: fecha a lista depois do último item inteiro
  for(let k=b,n=0;!j&&k>a&&n<60;k=out.lastIndexOf("}",k-1),n++){try{j=JSON.parse(out.slice(a,k+1)+"]}");cortada=true;}catch(_){}}
  if(!j)return null;
  const its=ntItens(j);its.cortada=cortada;return its;
}
function ntItens(j){
  const lim=x=>String(x==null?"":x).trim().slice(0,800);
  return arr(obj(j).itens).map(obj).filter(x=>NT_NOME[x.destino]).map(x=>{
    const o={id:uid("x"),destino:x.destino,texto:lim(x.texto),aplicada:false};
    if(x.destino==="conceit.situacao")["situacao","pensamento","significado","emocoes","comportamento"].forEach(k=>o[k]=lim(x[k]));
    if(x.destino==="vida.evento"){o.fase=NT_FASES.includes(x.fase)?x.fase:"";o.idade=lim(x.idade).slice(0,40);}
    return o;
  }).filter(o=>o.destino==="conceit.situacao"?str(o.situacao)||str(o.pensamento):str(o.texto));
}
// leva um item para a aba de destino; devolve false se não coube (ex.: as 3 situações já preenchidas)
function ntAplica(d,x,quando,doc){
  // sugestão que juntou várias sessões: "(sessões 25/06/25, 01/07/25)"
  const varias=/,/.test(quando),marca=" ("+(varias?(x.rot||"sessões"):doc?"documento":"sessão")+" "+quando+")";
  if(x.destino==="metas.nova"){d.metas.push({id:uid("m"),dificuldade:str(x.texto),meta:"",submetas:"",manutencao:"",obstaculos:"",origem:doc?"Documento importado ("+quando+")":(varias?"Notas das sessões de ":"Nota da sessão de ")+quando});return true;}
  if(x.destino==="vida.evento"){const f=NT_FASES.includes(x.fase)?x.fase:"adulta";d.vida[f].push({id:uid("e"),tipo:"marcante",idade:str(x.idade),evento:str(x.texto)+marca,impacto:""});return true;}
  if(x.destino==="conceit.situacao"){
    const s=d.conceit.situacoes.find(z=>!str(z.situacao)&&!str(z.pensamento));if(!s)return false;
    ["situacao","pensamento","significado","emocoes","comportamento"].forEach(k=>{if(str(x[k]))s[k]=str(x[k]);});
    s.situacao=str(s.situacao)+marca;return true;
  }
  const cur=str(getPath(d,x.destino));
  setPath(d,x.destino,(cur?cur+"\n":"")+str(x.texto)+marca);return true;
}

/* As sugestões da IA não ficam na nota: cada uma aparece embaixo do campo para onde iria, e ela decide ali,
   junto com o que já está escrito. Na nota fica só o resumo de quantas foram para cada aba. */
// sugestões ainda sem decisão cujo destino passa no filtro, da sessão mais antiga para a mais nova
function ntPend(d,f){
  const out=[];
  d.notas.itens.forEach((n,i)=>arr(n.sugestoes).forEach((x,j)=>{if(!x.aplicada&&f(x.destino,x))out.push({n,i,x,j});}));
  return out.sort((a,b)=>str(a.n.data)<str(b.n.data)?-1:str(a.n.data)>str(b.n.data)?1:a.i-b.i||a.j-b.j);
}
const ntQuando=n=>fmtShort(n.data||T.todayKey()),ntDoc=n=>!!n.arquivo&&!n.sessao;
// a sugestão pode juntar várias sessões (Organizar as sugestões): x.datas = as datas de todas elas
const ntQuandoX=(n,x)=>arr(x.datas).length>1?arr(x.datas).map(k=>fmtShort(k)).join(", "):ntQuando(n);
// uma sugestão como item de lista, igual às "Das outras abas": o texto, de onde veio, Inserir e ×
function ntSugItem(d,{n,i,x,j},sub,fases){
  const k=i+"."+j,ja=ntJaTem(d,x),varias=arr(x.datas).length>1;
  const origem=(varias?(x.rot||"sessões")+" ":ntDoc(n)?"documento ":"sessão ")+(n.data||varias?ntQuandoX(n,x):"sem data");
  return '<li class="cx-nt-item cx-nt-li"><span class="cx-nt-txt">'+(sub?'<b>'+esc(sub)+':</b> ':'')+esc(ntResumo(x))+
      ' <span class="cx-nt-dest">(<button class="linkish" data-cx="nt-ver" data-arg="'+esc(n.id)+'" title="Abrir a nota de onde veio">'+esc(origem)+'</button>'+(ja?" · já está no campo":"")+')</span></span>'+
    '<span class="cx-nt-acts">'+(fases?FASES_VIDA.map(([f,nome])=>'<button class="btn ghost cx-small" data-cx="nt-ok" data-arg="'+k+'" data-fase="'+f+'">'+nome+'</button>').join("")
      :'<button class="btn ghost cx-small" data-cx="nt-ok" data-arg="'+k+'">'+(ja?"Já está":"Inserir")+'</button>')+
    '<button class="icon-btn cx-small" data-cx="nt-no" data-arg="'+k+'" aria-label="Descartar sugestão" title="Descartar">×</button></span></li>';
}
// caixa de sugestões das notas embaixo de um campo (vazio se não houver nenhuma)
function ntSugHTML(d,f,o){
  o=o||{};const ps=ntPend(d,f);if(!ps.length)return "";
  // embed: dentro da caixa "Das outras abas" da Formulação, junto do que as outras abas já dizem
  return '<div class="'+(o.embed?"cx-nt-sug cx-nt-embed":"cx-linked cx-nt-sug cx-noprint")+'"><div class="cx-linked-head"><span class="eyebrow">'+(o.titulo||(o.embed?"Das notas de sessão (sugestão da IA)":"Sugestão da IA, das notas"))+(ps.length>1?" ("+ps.length+")":"")+'</span>'+
      (ps.length>1&&!o.fases?'<button class="linkish cx-small" data-cx="nt-ok-all" data-arg="'+ps.map(z=>z.i+"."+z.j).join(",")+'">Inserir todas</button>':'')+'</div>'+
    (o.dica?'<p class="hint">'+o.dica+'</p>':'')+
    '<ul class="cx-nt-list">'+ps.map(z=>ntSugItem(d,z,o.sub&&o.sub(z.x),o.fases)).join("")+'</ul></div>';
}
const ntSugCampo=(d,dest)=>ntSugHTML(d,k=>k===dest);
// quantas sugestões esperam em cada aba (para o menu e para a nota)
function ntPorAba(d,f){const c={};ntPend(d,f||(()=>true)).forEach(({x})=>{const a=ntAba(x.destino);c[a]=(c[a]||0)+1;});return c;}
// decide um item: insere (ou só marca, se já estiver lá); false se não coube
function ntDecide(d,n,x){
  if(ntJaTem(d,x)){x.aplicada=true;x.ja=true;return true;}
  if(!ntAplica(d,x,ntQuandoX(n,x),ntDoc(n)))return false;
  x.aplicada=true;x.aplicada_em=T.todayKey();return true;
}

/* ---------- Tarefa gradativa: escada de tarefas, do 1º degrau (o mais fácil, embaixo) ao último ---------- */
const TG_TITULO="Tarefa gradativa";
function tarefaHTML(){
  const d=D(),g=d.tarefa.degraus,last=g.length-1;
  return '<p class="hint cx-noprint">Os degraus vão do mais fácil (o 1º, lá embaixo) ao mais difícil. A escada vira uma imagem para imprimir ou mandar para ela; marque ✓ o que ela já conseguiu.</p>'+
    '<div class="panel cx-tg-edit cx-noprint">'+field("Título da folha",inp("tarefa.titulo","text",TG_TITULO))+
    (g.length?'<div class="cx-tg-list">'+g.map((x,i)=>{
      const p="tarefa.degraus."+i;
      return '<div class="cx-item'+(x.feito?" done":"")+'"><button class="cx-check" data-cx="done" data-arg="'+p+'" aria-pressed="'+!!x.feito+'" aria-label="Degrau feito">✓</button>'+
        '<span class="cx-num">'+(i+1)+'</span><div class="cx-item-body">'+inp(p+".texto","text",i?"Próximo degrau":"1º degrau: o mais fácil")+'</div>'+
        '<span class="cx-tg-move"><button class="icon-btn" data-cx="tg-move" data-arg="'+i+'" data-dir="-1" aria-label="Descer um degrau"'+(i?"":" disabled")+'>↓</button>'+
        '<button class="icon-btn" data-cx="tg-move" data-arg="'+i+'" data-dir="1" aria-label="Subir um degrau"'+(i<last?"":" disabled")+'>↑</button></span>'+
        delBtn(p,"Apagar degrau")+'</div>';
    }).join("")+'</div>':'<p class="muted">Nenhum degrau ainda.</p>')+
    (C.tgPaste?'<label>Um degrau por linha, do mais fácil para o mais difícil<textarea id="cx-tg-paste" rows="5" placeholder="Ex.:\nArrumar a cama ao acordar\nCaminhar 10 minutos 2x na semana\nLigar para uma amiga"></textarea></label>'+
      '<div class="btns"><button class="btn" data-cx="tg-paste-ok">Adicionar à escada</button><button class="btn ghost" data-cx="tg-paste">Fechar</button></div>'
     :'<div class="btns"><button class="btn" data-cx="tg-add">+ Degrau</button><button class="btn ghost" data-cx="tg-paste">Colar lista</button>'+
      (g.length?'<button class="btn ghost" data-cx="tg-app">→ Levar degraus para o app dela</button>':'')+'</div>')+'</div>'+
    '<figure class="tg-figure"><canvas id="tg-canvas" role="img" aria-label="Escada da tarefa gradativa"></canvas></figure>'+
    (g.some(x=>str(x.texto))?'<div class="btns cx-noprint"><button class="btn" data-cx="tg-print">Imprimir / PDF</button><button class="btn ghost" data-cx="tg-png">Baixar imagem</button>'+
      (navigator.canShare?'<button class="btn ghost" data-cx="tg-share">Compartilhar</button>':'')+'</div>':'');
}
// quebra o texto em linhas que cabem na largura
function tgWrap(ctx,text,max){
  const out=[];let line="";
  String(text).split(/\s+/).filter(Boolean).forEach(w=>{
    while(ctx.measureText(w).width>max&&w.length>1){ // palavra maior que a linha: corta
      let k=w.length;while(k>1&&ctx.measureText(w.slice(0,k)).width>max)k--;
      if(line){out.push(line);line="";}out.push(w.slice(0,k));w=w.slice(k);
    }
    const t=line?line+" "+w:w;
    if(ctx.measureText(t).width>max&&line){out.push(line);line=w;}else line=t;
  });
  if(line)out.push(line);
  return out.length?out:[""];
}
/* Desenha a escada no estilo da folha dela: cada degrau é um traço que sobe para a direita, e o texto de cada
   degrau fica logo abaixo dele, à direita do próprio degrau (nenhum degrau de cima passa por cima do texto). */
function tgDraw(canvas,titulo,degraus,scale){
  const W=1000,pad=34,fs=19,lh=25,ink="#3B2F28",tinta="#2B2320",ok="#5B7A45";
  const font='500 '+fs+'px "Nunito Sans",system-ui,sans-serif',fontOk='700 '+fs+'px "Nunito Sans",system-ui,sans-serif';
  const g=degraus.filter(x=>str(x.texto)),n=g.length;
  const m=document.createElement("canvas").getContext("2d");m.font=font;
  const dx=n>1?Math.max(30,Math.min(84,(W-2*pad-320)/(n-1))):0,tread=Math.max(dx,70);
  const xs=g.map((_,i)=>pad+i*dx);
  const linhas=g.map((x,i)=>tgWrap(m,(x.feito?"✓ ":"")+str(x.texto),W-pad-(xs[i]+14)));
  const titleH=70,bands=linhas.map(l=>Math.max(52,l.length*lh+22));
  const tituloTxt=(str(titulo)||TG_TITULO)+":";
  // no alto da escada vai o bonequinho comemorando (com medalha): precisa de uns 125 px acima do último degrau,
  // e desce mais um pouco se ficar embaixo do título (escadas curtas, o topo fica à esquerda)
  m.font='500 40px "Fredoka","Trebuchet MS",sans-serif';const tituloW=m.measureText(tituloTxt).width;m.font=font;
  const figX=n?xs[n-1]+tread/2:0,figH=128;
  const topo=pad+(n&&figX-64<pad+tituloW+16?titleH+figH+14:Math.max(titleH+12,figH));
  const H=topo+(n?bands.reduce((a,b)=>a+b,0):60)+pad;
  const ys=[];let y=topo;for(let i=n-1;i>=0;i--){ys[i]=y;y+=bands[i];}
  scale=scale||Math.min(2,window.devicePixelRatio||1)*1.5;
  canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);
  canvas.style.aspectRatio=W+" / "+H;
  const c=canvas.getContext("2d");c.setTransform(scale,0,0,scale,0,0);
  c.fillStyle="#fff";c.fillRect(0,0,W,H);
  c.fillStyle=ink;c.font='500 40px "Fredoka","Trebuchet MS",sans-serif';c.textBaseline="top";
  c.fillText(tituloTxt,pad,pad);
  if(!n){c.font=font;c.fillStyle="#8C7A6D";c.fillText("Escreva os degraus para montar a escada.",pad,pad+titleH+16);return;}
  c.strokeStyle=tinta;c.lineWidth=7;c.lineCap="square";c.lineJoin="miter";
  c.beginPath();
  c.moveTo(xs[0],ys[0]+30);
  for(let i=0;i<n;i++){c.lineTo(xs[i],ys[i]);c.lineTo(xs[i]+(i===n-1?tread:dx),ys[i]);}
  c.stroke();
  tgFigura(c,figX,ys[n-1]-4,tinta);
  c.textBaseline="alphabetic";
  linhas.forEach((ls,i)=>ls.forEach((t,k)=>{
    const x=xs[i]+14,yy=ys[i]+12+fs+k*lh;
    if(k===0&&g[i].feito){c.font=fontOk;c.fillStyle=ok;c.fillText("✓",x,yy);const w=c.measureText("✓ ").width;c.font=font;c.fillStyle=ink;c.fillText(t.slice(2),x+w,yy);}
    else{c.font=font;c.fillStyle=ink;c.fillText(t,x,yy);}
  }));
}
// bonequinho de braços para cima, com medalha no peito e confete em volta, em pé no último degrau (x = centro, y = chão)
function tgFigura(c,x,y,tinta){
  c.save();
  // confete
  [[-52,-104,"#B5502F",.5],[-40,-60,"#966516",-.4],[46,-110,"#5B7A45",.3],[54,-66,"#8F6650",-.6],[-24,-122,"#966516",.9],[30,-130,"#B5502F",-.2],[-60,-84,"#5B7A45",.2],[64,-90,"#966516",.7]]
    .forEach(([dx,dy,cor,a])=>{c.save();c.translate(x+dx,y+dy);c.rotate(a);c.fillStyle=cor;c.fillRect(-5,-2.5,10,5);c.restore();});
  // brilhos
  c.strokeStyle="#966516";c.lineWidth=2.5;c.lineCap="round";
  [[-34,-132],[40,-48]].forEach(([dx,dy])=>{c.beginPath();c.moveTo(x+dx-6,y+dy);c.lineTo(x+dx+6,y+dy);c.moveTo(x+dx,y+dy-6);c.lineTo(x+dx,y+dy+6);c.stroke();});
  // corpo, pernas e braços para cima
  c.strokeStyle=tinta;c.lineWidth=6;c.lineCap="round";c.lineJoin="round";
  c.beginPath();
  c.moveTo(x-13,y);c.lineTo(x,y-32);c.lineTo(x+13,y);   // pernas
  c.moveTo(x,y-32);c.lineTo(x,y-66);                       // tronco
  c.moveTo(x-26,y-98);c.lineTo(x,y-60);c.lineTo(x+26,y-98); // braços
  c.stroke();
  c.fillStyle=tinta;[[-26,-98],[26,-98]].forEach(([dx,dy])=>{c.beginPath();c.arc(x+dx,y+dy,4.5,0,7);c.fill();});
  // cabeça e rosto feliz
  c.fillStyle="#F3D9C4";c.beginPath();c.arc(x,y-82,14,0,7);c.fill();c.lineWidth=4;c.stroke();
  c.fillStyle=tinta;[-5,5].forEach(d=>{c.beginPath();c.arc(x+d,y-85,1.9,0,7);c.fill();});
  c.lineWidth=2.2;c.beginPath();c.arc(x,y-81,6,.15*Math.PI,.85*Math.PI);c.stroke();
  // medalha: fita em V e o disco dourado com estrela
  c.lineWidth=4;c.lineCap="butt";
  c.strokeStyle="#B5502F";c.beginPath();c.moveTo(x-8,y-64);c.lineTo(x-1,y-46);c.stroke();
  c.strokeStyle="#4F7593";c.beginPath();c.moveTo(x+8,y-64);c.lineTo(x+1,y-46);c.stroke();
  c.fillStyle="#E0A82E";c.strokeStyle="#966516";c.lineWidth=2;c.beginPath();c.arc(x,y-38,10,0,7);c.fill();c.stroke();
  c.fillStyle="#FFF4D6";c.beginPath();
  for(let k=0;k<10;k++){const r=k%2?2.8:6.2,a=-Math.PI/2+k*Math.PI/5;c.lineTo(x+r*Math.cos(a),y-38+r*Math.sin(a));}
  c.closePath();c.fill();
  c.restore();
}
let tgTimer=0;
function tgRedraw(){
  clearTimeout(tgTimer);
  tgTimer=setTimeout(()=>{const cv=document.getElementById("tg-canvas"),d=D();if(cv&&d)tgDraw(cv,d.tarefa.titulo,d.tarefa.degraus);},60);
}
function tgBlob(){
  return new Promise(res=>{const d=D(),cv=document.createElement("canvas");tgDraw(cv,d.tarefa.titulo,d.tarefa.degraus,2);cv.toBlob(res,"image/png");});
}
const tgFile=()=>(str(D().tarefa.titulo)||TG_TITULO).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w-]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase()+".png";

/* ---------- Cartas de intimidade: o baralho em fases; clicar na carta vira, como na mesa ---------- */
const cartasFase=d=>CARTAS.fases.find(x=>x.id===d.cartas.fase)||CARTAS.fases[0];
// as cartas da fase: as do baralho (com o que ela editou) e as que ela criou; "todas" inclui as que ela tirou
function cartasDe(d,fid,todas){
  const f=CARTAS.fases.find(x=>x.id===fid)||CARTAS.fases[0],oc=new Set(d.cartas.ocultas);
  const base=f.cartas.map(([id,titulo,texto,dica])=>{
    const e=obj(d.cartas.editadas[id]),v=k=>k in e?str(e[k]):null;
    return {id,titulo:v("titulo")??titulo,texto:v("texto")??texto,dica:v("dica")??dica,editada:Object.keys(e).length>0,oculta:oc.has(id)};
  });
  const own=d.cartas.proprias.map((c,i)=>({id:c.id,titulo:str(c.titulo),texto:str(c.texto),dica:str(c.dica),fase:c.fase,i,propria:true})).filter(c=>c.fase===f.id);
  const all=[...base,...own];
  if(todas)return all;
  // embaralhada: segue a ordem sorteada; cartas novas vão para o fim
  const ordem=C.cartasOrdem[f.id]||[],pos=id=>{const i=ordem.indexOf(id);return i<0?1e6:i;};
  return all.filter(c=>!c.oculta&&(c.titulo||c.texto)).sort((a,b)=>pos(a.id)-pos(b.id));
}
function cartaHTML(d,c,f,n){
  const vir=C.cartasViradas.has(c.id),feita=d.cartas.feitas[c.id];
  return '<div class="cx-carta-wrap"><button class="cx-carta'+(vir?" virada":"")+'" data-cx="carta-virar" data-arg="'+esc(c.id)+'" aria-pressed="'+vir+'">'+
    '<span class="cx-carta-in"><span class="cx-carta-verso" aria-hidden="'+vir+'"><span class="cx-carta-logo">'+esc(CARTAS.nome)+'</span>'+
      '<span class="cx-carta-fase">Fase '+n+'</span><span>'+esc(f.nome)+'</span><span class="cx-sr">Carta virada para baixo. Clique para virar.</span></span>'+
    '<span class="cx-carta-frente" aria-hidden="'+!vir+'"><b class="cx-carta-tit">'+esc(c.titulo)+'</b><span class="cx-carta-txt">'+esc(c.texto)+'</span>'+
      (c.dica?'<i class="cx-carta-dica">'+esc(c.dica)+'</i>':'')+
      '<span class="cx-carta-pe">Fase '+n+' · '+esc(f.nome)+(feita?' <span class="cx-carta-ok">✓ feita</span>':'')+'</span></span></span></button>'+
    (C.cartasFull?'':'<button class="btn ghost cx-small" data-cx="carta-feita" data-arg="'+esc(c.id)+'" aria-pressed="'+!!feita+'">'+(feita?"✓ Feita em "+fmtShort(feita):"Marcar como feita")+'</button>')+'</div>';
}
function cartaEdHTML(c){
  const p=c.propria?"cartas.proprias."+c.i:"cartas.editadas."+c.id,box=(k,ph,rows)=>rows
    ?'<textarea data-cp="'+p+"."+k+'" rows="'+rows+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'>'+esc(c[k])+'</textarea>'
    :'<input type="text" data-cp="'+p+"."+k+'" value="'+esc(c[k])+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'>';
  return '<div class="panel cx-carta-ed'+(c.oculta?" oculta":"")+'">'+(c.oculta?'<span class="cx-tag">fora do baralho</span>':c.propria?'<span class="cx-tag">criada por você</span>':'')+
    field("Título",box("titulo","Título da carta"))+field("Texto",box("texto","O que a carta pede",3))+field("Dica (opcional)",box("dica","Uma observação curta, no pé da carta",1))+
    '<div class="btns">'+(c.propria?delBtn("cartas.proprias."+c.i,"Apagar esta carta")
      :'<button class="btn ghost cx-small" data-cx="carta-ocultar" data-arg="'+esc(c.id)+'">'+(c.oculta?"Usar de novo":"Tirar do baralho")+'</button>'+
       (c.editada?'<button class="btn ghost cx-small" data-cx="carta-original" data-arg="'+esc(c.id)+'">Voltar ao texto original</button>':''))+'</div></div>';
}
// o que vai para o app dela: as fases escolhidas, com as cartas como estão neste caso (na ordem do baralho)
function cartasParaApp(d,ids){
  return {nome:CARTAS.nome,regras:CARTAS.regras,em:T.todayKey(),
    fases:CARTAS.fases.filter(f=>ids.includes(f.id)).map(f=>({id:f.id,nome:f.nome,quem:f.quem,sobre:f.sobre,
      cartas:cartasDe(d,f.id,true).filter(c=>!c.oculta&&(c.titulo||c.texto)).map(c=>({id:c.id,titulo:c.titulo,texto:c.texto,dica:c.dica}))})).filter(f=>f.cartas.length)};
}
const cartasNoApp=()=>C.ctx&&C.ctx.patient&&C.ctx.patient.config?C.ctx.patient.config.cartas:null;
function cartasAppHTML(d){
  const no=cartasNoApp(),ids=no?no.fases.map(f=>f.id):[];
  const sel=C.cartasAppSel||new Set(ids.length?ids:CARTAS.fases.slice(0,CARTAS.fases.indexOf(cartasFase(d))+1).map(f=>f.id));
  let st='As cartas ainda não estão no app dela.';
  if(no){
    const n=no.fases.reduce((s,f)=>s+f.cartas.length,0),nomes=no.fases.map(f=>"fase "+(CARTAS.fases.findIndex(x=>x.id===f.id)+1));
    // mudou alguma carta das fases que estão no app desde que foram para lá?
    const agora=T.normConfig({cartas:cartasParaApp(d,ids)}).cartas,mudou=JSON.stringify(agora&&agora.fases)!==JSON.stringify(no.fases);
    st='<b>No app dela'+(no.em?' desde '+fmtShort(no.em):'')+':</b> '+nomes.join(", ").replace(/, ([^,]*)$/," e $1")+' ('+n+' cartas).'+
      (mudou?' <b>Você mudou cartas depois disso: clique em Atualizar para ela ver.</b>':'');
  }
  return '<div class="panel cx-cartas-app"><h3>No app da paciente</h3><p class="hint">'+st+' Ela abre em <b>Cartas</b>, sozinha ou com a parceria: uma carta por vez, toca para virar e passa com as setas.</p>'+
    '<div class="cx-print-opts">'+CARTAS.fases.map((f,i)=>'<label class="cx-inline"><input type="checkbox" data-cxcartaapp="'+f.id+'" style="width:auto"'+(sel.has(f.id)?" checked":"")+'> Fase '+(i+1)+' · '+esc(f.nome)+'</label>').join("")+'</div>'+
    '<div class="btns"><button class="btn" data-cx="cartas-app">'+(no?"Atualizar no app dela":"Liberar no app dela")+'</button>'+
    (no?'<button class="btn ghost" data-cx="cartas-app-tirar">Tirar do app</button>':'')+'</div></div>';
}
function cartasHTML(){
  const d=D(),f=cartasFase(d),n=CARTAS.fases.indexOf(f)+1,lista=cartasDe(d,f.id),full=C.cartasFull,ed=C.cartasEdit&&!full;
  const fases='<div class="cx-cartas-fases">'+CARTAS.fases.map((x,i)=>'<button class="cx-chip" data-cx="cartas-fase" data-arg="'+x.id+'" aria-pressed="'+(x===f)+'">'+
    '<span>Fase '+(i+1)+' · '+esc(x.nome)+'</span><small>'+esc(x.quem)+'</small></button>').join("")+'</div>';
  const feitas=lista.filter(c=>d.cartas.feitas[c.id]).length;
  const bar='<div class="btns cx-cartas-bar">'+(ed
    ?'<button class="btn" data-cx="carta-add">+ Carta nova nesta fase</button><button class="btn ghost" data-cx="cartas-editar">Pronto</button>'
    :'<button class="btn ghost" data-cx="cartas-embaralhar">Embaralhar</button><button class="btn ghost" data-cx="cartas-baixo">Virar todas para baixo</button>'+
     (full?'<button class="btn" data-cx="cartas-tela">Sair da tela cheia</button>'
       :'<button class="btn ghost" data-cx="cartas-tela">Tela cheia (para mostrar)</button><button class="btn ghost" data-cx="cartas-editar">Editar as cartas</button>'))+'</div>';
  const regras='<details class="panel cx-cartas-regras"><summary>Como usar o baralho</summary><ol>'+CARTAS.regras.map(r=>'<li>'+esc(r)+'</li>').join("")+'</ol></details>';
  const corpo=ed
    ?'<p class="hint">As mudanças valem só para este caso. As cartas que você criar entram no fim da fase.</p><div class="cx-cartas-ed">'+cartasDe(d,f.id,true).map(cartaEdHTML).join("")+'</div>'
    :(lista.length?'<div class="cx-cartas-grid">'+lista.map(c=>cartaHTML(d,c,f,n)).join("")+'</div>':'<p class="muted">Nenhuma carta nesta fase. Em <b>Editar as cartas</b>, crie uma ou traga de volta as que tirou.</p>');
  const html='<div class="cx-cartas" data-fase="'+f.id+'">'+
    (full?'':'<p class="hint">Baralho <b>'+esc(CARTAS.nome)+'</b>, para trabalhar a intimidade e a sexualidade em fases, do autoconhecimento ao toque a dois (foco sensorial). Clique numa carta para virar; em <b>Tela cheia</b>, só as cartas aparecem, para mostrar na sessão.</p>')+
    fases+'<p class="cx-cartas-sobre"><b>'+esc(f.quem)+'.</b> '+esc(f.sobre)+(feitas&&!full?' <span class="muted">'+feitas+' de '+lista.length+' feitas.</span>':'')+'</p>'+
    bar+corpo+(ed||full?'':cartasAppHTML(d))+(ed?'':regras)+'</div>';
  return full?'<div class="cx-cartas-full" role="dialog" aria-modal="true" aria-label="Cartas em tela cheia">'+html+'</div>':html;
}

// a trilha de reforçadores (pontos, histórico, evolução por atividade) vem pronta do painel
function ativacaoHTML(){
  return '<p class="hint">A trilha de reforçadores dela: pontos, o que fez hoje, a evolução de cada atividade da hierarquia e os reforçadores. Em <b>Configurar</b> ficam os reforçadores, as atividades, a comemoração e os pontos.</p>'+
    '<div class="cx-ativacao">'+(C.ctx&&C.ctx.ativacao?C.ctx.ativacao.html():"")+'</div>';
}
const RENDER={ativacao:ativacaoHTML,cartas:cartasHTML,tarefa:tarefaHTML,notas:notasHTML,prontuario:prontuarioHTML,ia:iaHTML,anamnese:anamneseHTML,vida:vidaHTML,metas:metasHTML,valores:valoresHTML,distorcoes:distorcoesHTML,conceit:conceitHTML,plano:planoHTML,formulacao:formulacaoHTML};

function navHTML(list){
  const d=D(),pend=ntPorAba(d);
  return list.map(([k,l])=>'<button class="cx-chip" data-cx="sec" data-arg="'+k+'" aria-pressed="'+(C.sec===k)+'"><span>'+l+'</span><small>'+progress(d,k)+'</small>'+
    (pend[k]?'<i class="cx-badge" title="Sugestões da IA esperando nesta aba" aria-label="'+pend[k]+(pend[k]>1?" sugestões":" sugestão")+' da IA">'+pend[k]+'</i>':'')+'</button>').join("");
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
  const fid=!fp&&a&&a.id&&root.contains(a)?a.id:null; // campos da Configuração (dentro da Ativação comportamental) têm id
  const y=window.scrollY;
  const p=C.ctx.patient;
  // folha da Formulação / Conceitualização na frente: ela já tem o próprio cabeçalho, e precisa da página inteira
  // (o prontuário com introdução também: abre com "Prontuário Psicológico" e a identificação)
  const first=Array.isArray(C.printAll)?(printables().find(([k])=>C.printAll.includes(k))||[])[0]:null;
  const sheetFirst=!!SHEETS[first]||(first==="prontuario"&&prTemIntro(D()));
  root.innerHTML=
    (sheetFirst?'':'<div class="cx-printhead"><h2>'+printTitle()+' · '+esc(p.name)+'</h2><span>'+new Date().toLocaleDateString("pt-BR")+'</span></div>')+
    '<div class="cx-head cx-noprint"><div class="cx-head-text"><span class="eyebrow">Formulação de caso</span><span id="cx-status" class="cx-status'+(C.error?" err":"")+'">'+statusText()+'</span></div>'+
      '<span class="btns"><label class="btn ghost cx-small" style="cursor:pointer" title="Planilha da formulação (Excel), Word ou PDF">Importar arquivo<input type="file" id="cx-import" accept=".xlsx,.xls,.ods,'+DOC_ACCEPT+'" hidden></label>'+
      '<button class="btn ghost cx-small" data-cx="print">Imprimir / PDF</button></span></div>'+
    (C.imp?importHTML():'')+(C.printPick&&!C.printAll?printPickHTML():'')+
    '<p class="hint cx-noprint">Só você vê esta aba. O app da paciente não tem acesso a nada daqui.</p>'+
    '<nav class="cx-nav cx-noprint" id="cx-nav" aria-label="Partes da formulação">'+navHTML(MAIN)+'</nav>'+
    (C.printAll?printables().filter(([k])=>C.printAll.includes(k)).map(([k,l])=>SHEETS[k]?'<section class="cx-section cx-sheet-sec">'+SHEETS[k]()+'</section>':'<section class="cx-section">'+
        // uma parte só: o título já está no cabeçalho
        (C.printAll.length>1?'<h2 class="cx-section-title">'+l+'</h2>':'')+(k==="ia"?iaPrintHTML():k==="prontuario"?prPrintHTML():RENDER[k]())+'</section>').join("")
      :'<div class="cx-body"><section class="cx-section">'+
        (EXTRA.some(([k])=>k===C.sec)?'<h2 class="cx-res-title">'+(EXTRA.find(([k])=>k===C.sec)[1])+'</h2>':'')+RENDER[C.sec]()+'</section>'+
        '<aside class="cx-side cx-noprint" aria-label="Recursos"><span class="eyebrow">Recursos</span><nav class="cx-side-nav" id="cx-side">'+navHTML(EXTRA)+'</nav>'+
        '<p class="hint">Use quando fizerem sentido para o caso.</p></aside></div>');
  root.querySelectorAll("textarea").forEach(grow);
  if(C.dict&&(C.dict.pid!==C.pid||(C.sec!=="prontuario"&&C.sec!=="notas")||C.printAll))dictStop();
  // no celular a navegação rola de lado: mantém a parte aberta à vista
  ["cx-nav","cx-side"].forEach(id=>{
    const nav=document.getElementById(id),chip=nav&&nav.querySelector('[aria-pressed="true"]');
    if(chip){const n=nav.getBoundingClientRect(),c=chip.getBoundingClientRect();if(c.left<n.left||c.right>n.right)nav.scrollLeft+=c.left-n.left-(n.width-c.width)/2;}
  });
  document.documentElement.classList.toggle("cx-sem-rolar",C.cartasFull&&C.sec==="cartas"&&!C.printAll);
  if(C.sec==="tarefa"&&!C.printAll){const cv=document.getElementById("tg-canvas");if(cv)tgDraw(cv,D().tarefa.titulo,D().tarefa.degraus);}
  if(fp){const el=root.querySelector('[data-cp="'+fp+'"]');if(el){el.focus({preventScroll:true});if(sel)try{el.setSelectionRange(sel[0],sel[1]);}catch(_){}}}
  else if(fid){const el=document.getElementById(fid);if(el&&root.contains(el))el.focus({preventScroll:true});}
  window.scrollTo(0,y);
}

/* ---------- imprimir / PDF: ela escolhe as partes (uma só, várias ou tudo) ---------- */
// partes que dá para imprimir, na ordem do PDF (o prontuário, que tem o próprio formato, vai por último)
function printables(){
  const d=D(),fora=new Set(["ativacao","tarefa","cartas","notas","prontuario"]);
  return [...SECTIONS.filter(([k])=>!fora.has(k)&&(k!=="ia"||str(d.ia.resposta))),["prontuario","Prontuário"]];
}
const printAllKeys=()=>printables().map(([k])=>k).filter(k=>k!=="prontuario");
function printTitle(){
  const a=C.printAll;if(!Array.isArray(a)||a.length!==1)return "Formulação de caso";
  return (SECTIONS.find(([k])=>k===a[0])||[,"Formulação de caso"])[1];
}
function printPickHTML(){
  const sel=new Set(C.printPick);
  return '<div class="panel cx-import cx-print-pick cx-noprint"><h3>O que vai no PDF?</h3>'+
    '<div class="cx-print-opts">'+printables().map(([k,l])=>'<label class="cx-inline"><input type="checkbox" data-cxprint="'+k+'" style="width:auto"'+(sel.has(k)?" checked":"")+'> '+l+'</label>').join("")+'</div>'+
    '<p class="hint">Cada parte começa numa página nova. Na janela que abrir, escolha <b>Salvar como PDF</b> (ou a impressora).</p>'+
    '<div class="btns"><button class="btn" data-cx="print-go"'+(sel.size?"":" disabled")+'>Imprimir / salvar PDF</button>'+
      '<button class="btn ghost cx-small" data-cx="print-all">Marcar tudo</button><button class="btn ghost cx-small" data-cx="print-none">Desmarcar tudo</button>'+
      '<button class="btn ghost cx-small" data-cx="print-no">Cancelar</button></div></div>';
}
function doPrint(keys){
  C.printAll=keys;C.printPick=null;render();fitSheets();
  // o nome do arquivo PDF sai do título da página
  const t0=document.title;document.title=printTitle()+" - "+C.ctx.patient.name;
  window.addEventListener("afterprint",()=>{document.title=t0;C.printAll=false;render();},{once:true});
  setTimeout(()=>window.print(),50);
}

/* ---------- importar formulação antiga (planilha) ---------- */
const IMP_PARTES=[["anamnese","Anamnese","resposta","respostas"],["vida","Linha da vida e história","item","itens"],["metas","Metas (LDM)","meta","metas"],
  ["valores","Valores","área","áreas"],["distorcoes","Distorções","distorção marcada","distorções marcadas"],["conceit","Conceitualização","caixa","caixas"],
  ["plano","Plano de tratamento","item","itens"],["formulacao","Formulação","quadro","quadros"]];
function importHTML(){
  const m=C.imp,d=D(),hasPlan=planTotals(d).total>0;
  const parts=IMP_PARTES.filter(([k])=>m.counts[k]>0);
  return '<div class="panel cx-import cx-noprint"><h3>Importar planilha</h3><p class="hint">'+esc(m.name)+'</p>'+
    (parts.length?'<p>Encontrei nesta planilha:</p><div class="list">'+parts.map(([k,l,s1,sn])=>{
      const n=m.counts[k],off=k==="plano"&&hasPlan;
      return '<label class="cx-inline"><input type="checkbox" data-cximp="'+k+'" style="width:auto"'+(m.sel[k]&&!off?" checked":"")+(off?" disabled":"")+'> <b>'+l+'</b> <span class="muted">'+n+' '+(n===1?s1:sn)+
        (off?' — esta paciente já tem um plano, ele não será trocado':'')+'</span></label>';
    }).join("")+'</div>'+
    '<p class="hint">Nada do que você já escreveu é apagado: a planilha só preenche os campos vazios e acrescenta metas e eventos da linha da vida. Os eventos entram como "Marcante (a classificar)" — classifique depois em Linha da vida.</p>'+
    '<div class="btns"><button class="btn" data-cx="imp-ok">Importar</button><button class="btn ghost" data-cx="imp-no">Cancelar</button></div>'
    :'<p>Não encontrei respostas nesta planilha. Ela segue o modelo "Formulação de caso"?</p><div class="btns"><button class="btn ghost" data-cx="imp-no">Fechar</button></div>')+'</div>';
}
// preenche só o que está vazio; devolve quantos campos entraram e quantos ficaram como estavam
function applyImport(d,f,sel){
  let filled=0,kept=0;
  const fill=(o,k,v)=>{v=str(v);if(!v)return;if(!str(o[k])){o[k]=v;filled++;}else if(str(o[k])!==v)kept++;};
  if(sel.anamnese)Object.entries(f.anamnese).forEach(([k,v])=>fill(d.anamnese,k,v));
  if(sel.vida){
    f.vida.eventos.forEach(e=>{const list=d.vida[e.fase];if(list.some(x=>str(x.evento)===e.evento))return;list.push({id:uid("e"),tipo:"marcante",idade:"",evento:e.evento,impacto:e.impacto});filled++;});
    fill(d.vida,"historia",f.vida.historia);
  }
  if(sel.metas)f.metas.forEach(m=>{if(d.metas.some(x=>str(x.dificuldade)===str(m.dificuldade)&&str(x.meta)===str(m.meta)))return;
    d.metas.push({id:uid("m"),dificuldade:"",meta:"",submetas:"",manutencao:"",obstaculos:"",...m});filled++;});
  if(sel.valores)Object.entries(f.valores).forEach(([k,v])=>{
    const o=d.valores.atual[k]=obj(d.valores.atual[k]);fill(o,"texto",v.texto);
    ["imp","suc"].forEach(x=>{if(v[x]==null)return;if(num(o[x])==null){o[x]=v[x];filled++;}else if(num(o[x])!==v[x])kept++;});
  });
  if(sel.distorcoes)Object.entries(f.distorcoes).forEach(([id,v])=>{const r=d.distorcoes[id]=obj(d.distorcoes[id]);if(!r.marcada){r.marcada=true;filled++;}fill(r,"exemplos",v.exemplos);});
  if(sel.conceit){
    CONCEIT_TOPO.forEach(([k])=>fill(d.conceit,k,f.conceit[k]));
    f.conceit.situacoes.forEach((s,i)=>Object.entries(s).forEach(([k,v])=>fill(d.conceit.situacoes[i],k,v)));
  }
  if(sel.plano&&f.plano.length&&!planTotals(d).total){
    d.plano.fases=f.plano.map((ph,i)=>({id:"f"+(i+1),nome:ph.nome,porque:ph.porque,itens:ph.itens.map(it=>({id:uid("i"),texto:it.texto,como:it.como,feito:!!it.feito,data:it.feito?T.todayKey():null}))}));
    filled+=f.plano.reduce((s,ph)=>s+ph.itens.length,0);
  }
  if(sel.formulacao)Object.entries(f.formulacao).forEach(([k,v])=>{
    if(k==="sistemas"){const o=d.formulacao.sistemas=obj(d.formulacao.sistemas);Object.entries(v).forEach(([sk,sv])=>fill(o,sk,sv));}
    else fill(d.formulacao,k,v);
  });
  return {filled,kept};
}
async function readImport(file){
  const I=window.TrilhaImport;
  try{
    const XLSX=await I.loadXLSX();
    const f=await I.parse(XLSX,new Uint8Array(await file.arrayBuffer()));
    const counts=I.counts(f),sel={};IMP_PARTES.forEach(([k])=>sel[k]=counts[k]>0);
    C.imp={name:file.name,found:f,counts,sel,pid:C.pid};
  }catch(e){
    T.toast(e&&e.message==="xlsx"?"Não consegui carregar o leitor de planilhas. Confira a internet.":"Não consegui ler esta planilha. Ela precisa estar em Excel (.xlsx).");
    return;
  }
  render();window.scrollTo(0,0);
}

/* ---------- ações ---------- */
const inRoot=el=>el&&el.closest&&el.closest("#case-root");
function focusFirst(sel){const el=document.querySelector("#case-root "+sel);if(el)el.focus();}
function focusLast(sel){const els=document.querySelectorAll("#case-root "+sel);if(els.length)els[els.length-1].focus();}
function hasContent(x){return typeof x==="string"?!!x.trim():x&&typeof x==="object"?Object.entries(x).some(([k,v])=>k!=="id"&&k!=="tipo"&&k!=="feito"&&hasContent(v)):false;}

document.addEventListener("input",e=>{
  const t=e.target;if(!inRoot(t))return;
  if(t.dataset.cxia!=null){C.iaDraft=t.value;grow(t);return;}
  if(!t.dataset.cp||t.tagName==="SELECT"||t.type==="date")return;
  setPath(D(),t.dataset.cp,t.value);if(t.dataset.cp==="ia.resposta")D().ia.data=T.todayKey();grow(t);schedule();updateNav();
  const mm=/^metas\.(\d+)\.(meta|dificuldade)$/.exec(t.dataset.cp);if(mm)plSincMeta(D(),D().metas[+mm[1]]);
  if(t.dataset.cp.startsWith("tarefa."))tgRedraw();
});
// Esc fecha a tela cheia das cartas
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&C.cartasFull&&C.sec==="cartas"&&D()){C.cartasFull=false;render();focusFirst('[data-cx="cartas-tela"]');}
});
document.addEventListener("change",e=>{
  const t=e.target;if(!inRoot(t))return;
  if(t.id==="cx-pr-import"){const f=t.files&&t.files[0];t.value="";if(f&&D())prImportar(f);return;}
  if(t.id==="cx-import"||t.id==="cx-nt-import"){
    const f=t.files&&t.files[0];t.value="";if(!f||!D())return;
    // planilha do modelo: importação por campos; Word/PDF/texto: vira nota de sessão
    if(t.id==="cx-import"&&/\.(xlsx|xls|ods)$/i.test(f.name))readImport(f);else importDoc(f);
    return;
  }
  if(t.dataset.cximp!=null){C.imp.sel[t.dataset.cximp]=t.checked;return;}
  if(t.dataset.cxprint!=null&&C.printPick){
    const k=t.dataset.cxprint;C.printPick=C.printPick.filter(x=>x!==k);if(t.checked)C.printPick.push(k);
    const go=document.querySelector('#case-root [data-cx="print-go"]');if(go)go.disabled=!C.printPick.length;return;
  }
  if(t.dataset.cxcartaapp!=null){C.cartasAppSel=new Set([...document.querySelectorAll("#case-root [data-cxcartaapp]")].filter(x=>x.checked).map(x=>x.dataset.cxcartaapp));return;}
  if(t.dataset.cxcmp!=null){C.cmpIdx=Number(t.value)||0;render();return;}
  if(t.dataset.cxhyp!=null){C.iaHyp=t.checked;C.iaDraft=null;render();return;}
  if(!t.dataset.cp||(t.tagName!=="SELECT"&&t.type!=="date"))return;
  setPath(D(),t.dataset.cp,t.dataset.num!=null?num(t.value):t.value);schedule();render();
});
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-cx]");if(!b||!inRoot(b))return;
  const act=b.dataset.cx,arg=b.dataset.arg,d=D();
  if(act==="nome-tog"){if(C.nomesSel.has(arg))C.nomesSel.delete(arg);else C.nomesSel.add(arg);render();return;}
  if(act!=="del")C.confirmDel=null;
  if(act!=="ia-run")C.iaConfirm=false;
  if(act!=="pr-run"&&act!=="pr-intro"&&act!=="nt-pr")C.prConfirm=null;
  if(act!=="nt-run")C.ntConfirm=null;
  if(act!=="nt-todas")C.ntTodasOk=false;
  if(act!=="pr-todas")C.prTodasOk=false;
  if(act!=="nt-split")C.ntSplitAsk=null;
  if(act!=="dict"&&act!=="dict-ok")C.dictAsk=null;
  if(act==="retry"){C.load[C.pid]=null;render();ensureLoaded(C.pid);return;}
  if(!d)return;
  // alterações não salvas no Configurar da Ativação comportamental: salvar ou descartar antes de sair
  if(act==="sec"&&C.sec==="ativacao"&&arg!=="ativacao"&&C.ctx.ativacao&&C.ctx.ativacao.dirty&&C.ctx.ativacao.dirty()){T.toast("Salve ou descarte as alterações da Configuração antes de sair.");return;}
  if(act==="sec"){C.sec=arg;C.printPick=null;if(arg==="ia")C.iaDraft=null;render();if(arg==="ativacao"&&C.ctx.ativacao)C.ctx.ativacao.refresh();const r=document.getElementById("case-root");if(r&&r.getBoundingClientRect().top<0)r.scrollIntoView();return;}
  if(act==="print"){
    // abre a escolha já marcando a parte aberta (se der para imprimir) ou a formulação inteira
    C.printPick=C.printPick?null:printables().some(([k])=>k===C.sec)?[C.sec]:printAllKeys();
    render();if(C.printPick)window.scrollTo(0,0);return;
  }
  if(act==="print-go"){const keys=printables().map(([k])=>k).filter(k=>(C.printPick||[]).includes(k));if(keys.length)doPrint(keys);return;}
  if(act==="print-all"){C.printPick=printAllKeys();render();return;}
  if(act==="print-none"){C.printPick=[];render();return;}
  if(act==="print-no"){C.printPick=null;render();return;}
  if(act==="del"){
    const parts=arg.split("."),i=Number(parts.pop()),list=getPath(d,parts.join("."));
    if(!Array.isArray(list))return;
    if(hasContent(list[i])&&C.confirmDel!==arg){C.confirmDel=arg;render();return;}
    C.confirmDel=null;list.splice(i,1);schedule();render();return;
  }
  if(act==="add-ev"){d.vida[arg].push({id:uid("e"),tipo:"positivo",idade:"",evento:"",impacto:""});schedule();render();focusLast('[data-cp^="vida.'+arg+'."][data-cp$=".evento"]');return;}
  if(act==="add-meta"){const m={id:uid("m"),dificuldade:"",meta:"",submetas:"",manutencao:"",obstaculos:""};d.metas.push(m);C.metaAbertas.add(m.id);schedule();render();focusLast('[data-cp$=".dificuldade"]');return;}
  if(act==="metas-compact"){C.metasCompact=!C.metasCompact;setPref("cx-metas-compactas",C.metasCompact);C.metaAbertas.clear();render();return;}
  if(act==="meta-open"){if(C.metaAbertas.has(arg))C.metaAbertas.delete(arg);else C.metaAbertas.add(arg);render();return;}
  if(act==="meta-sup"){const m=d.metas[Number(arg)];if(!m)return;m.superada=!m.superada;m.superada_em=m.superada?T.todayKey():null;schedule();render();return;}
  if(act==="meta-move"){
    const i=Number(arg),j=i+Number(b.dataset.dir);
    if(j<0||j>=d.metas.length)return;
    [d.metas[i],d.metas[j]]=[d.metas[j],d.metas[i]];schedule();render();
    const el=document.querySelector('#case-root [data-cx="meta-move"][data-arg="'+j+'"][data-dir="'+b.dataset.dir+'"]');if(el&&!el.disabled)el.focus();
    return;
  }
  if(act==="sugestoes"){C.semSugestoes=!C.semSugestoes;setPref("cx-sem-sugestoes",C.semSugestoes);render();return;}
  if(act==="add-item"){d.plano.fases[Number(arg)].itens.push({id:uid("i"),texto:"",como:"",feito:false,data:null});schedule();render();focusLast('[data-cp^="plano.fases.'+arg+'.itens."][data-cp$=".texto"]');return;}
  if(act==="done"){const it=getPath(d,arg);it.feito=!it.feito;it.data=it.feito?T.todayKey():null;schedule();render();return;}
  if(act==="mark"){const r=d.distorcoes[arg]=obj(d.distorcoes[arg]);r.marcada=!r.marcada;schedule();render();return;}
  if(act==="only"){C.onlyMarked=!C.onlyMarked;render();return;}
  // virar a carta não redesenha a tela (senão a animação some): só troca a classe
  if(act==="carta-virar"){
    const on=!C.cartasViradas.has(arg);if(on)C.cartasViradas.add(arg);else C.cartasViradas.delete(arg);
    b.classList.toggle("virada",on);b.setAttribute("aria-pressed",on);
    b.querySelector(".cx-carta-verso").setAttribute("aria-hidden",on);b.querySelector(".cx-carta-frente").setAttribute("aria-hidden",!on);
    return;
  }
  if(act==="carta-feita"){const fe=d.cartas.feitas;if(fe[arg])delete fe[arg];else fe[arg]=T.todayKey();schedule();render();return;}
  if(act==="cartas-fase"){d.cartas.fase=arg;schedule();render();return;}
  if(act==="cartas-embaralhar"){
    const ids=cartasDe(d,d.cartas.fase).map(c=>c.id);
    for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
    C.cartasOrdem[cartasFase(d).id]=ids;ids.forEach(id=>C.cartasViradas.delete(id));render();return;
  }
  if(act==="cartas-baixo"){cartasDe(d,d.cartas.fase).forEach(c=>C.cartasViradas.delete(c.id));render();return;}
  if(act==="cartas-editar"){C.cartasEdit=!C.cartasEdit;render();return;}
  if(act==="cartas-tela"){C.cartasFull=!C.cartasFull;C.cartasEdit=false;render();focusFirst('[data-cx="cartas-tela"]');return;}
  if(act==="carta-ocultar"){const oc=d.cartas.ocultas,i=oc.indexOf(arg);if(i>=0)oc.splice(i,1);else oc.push(arg);schedule();render();return;}
  if(act==="carta-original"){delete d.cartas.editadas[arg];schedule();render();return;}
  if(act==="cartas-app"||act==="cartas-app-tirar"){
    if(!C.ctx.setCartas)return;
    let cartas=null;
    if(act==="cartas-app"){
      const ids=[...document.querySelectorAll("#case-root [data-cxcartaapp]")].filter(x=>x.checked).map(x=>x.dataset.cxcartaapp);
      if(!ids.length){T.toast("Escolha pelo menos uma fase.");return;}
      cartas=cartasParaApp(d,ids);
      if(!cartas.fases.length){T.toast("Essas fases estão sem cartas.");return;}
    }
    b.disabled=true;const ok=await C.ctx.setCartas(cartas);b.disabled=false;
    if(!ok)return;
    C.cartasAppSel=null;render();
    T.toast(cartas?"As cartas estão no app dela. Ela vê na próxima vez que abrir o app.":"As cartas saíram do app dela.");return;
  }
  if(act==="carta-add"){d.cartas.proprias.push({id:uid("k"),fase:cartasFase(d).id,titulo:"",texto:"",dica:""});schedule();render();focusLast('[data-cp^="cartas.proprias."][data-cp$=".titulo"]');return;}
  if(act==="ia-regen"){C.iaDraft=null;render();T.toast("Texto montado de novo a partir da formulação.");return;}
  if(act==="ia-run"){
    if(C.iaBusy)return;
    const el=document.getElementById("cx-ia-text"),text=el?el.value.trim():"";
    if(!text){T.toast("O texto para a IA está vazio. Clique em Gerar de novo.");return;}
    if(str(d.ia.resposta)&&!C.iaConfirm){C.iaConfirm=true;render();return;}
    C.iaConfirm=false;
    runIA({text,modo:"caso",key:C.pid+":caso",ok:"Análise pronta e salva na formulação.",save:(dd,out)=>{dd.ia.resposta=out;dd.ia.data=T.todayKey();}});return;
  }
  if(act==="an-use"||act==="an-keep"||act==="an-both"){
    const c=obj(d.anamnese_paciente[arg]),v=str(c.valor);
    if(act==="an-use")d.anamnese[arg]=v;
    if(act==="an-both")d.anamnese[arg]=str(d.anamnese[arg])+"\n"+v;
    delete d.anamnese_paciente[arg];schedule();render();return;
  }
  if(act==="imp-no"){C.imp=null;render();return;}
  if(act==="imp-ok"){
    const m=C.imp;if(!m||m.pid!==C.pid){C.imp=null;render();return;}
    const r=applyImport(d,m.found,m.sel);
    C.imp=null;schedule();render();
    T.toast(r.filled?"Importado: "+r.filled+(r.filled===1?" campo preenchido":" campos preenchidos")+(r.kept?". "+r.kept+(r.kept===1?" campo que já tinha texto ficou":" campos que já tinham texto ficaram")+" como estava"+(r.kept===1?"":"m")+".":"."):"Nada novo: o que estava na planilha já está aqui.");
    return;
  }
  if(act==="dict"){dictClick(arg);return;}
  if(act==="dict-no"){render();return;}
  if(act==="dict-ok"){C.dictAsk=null;C.dictCloudOk=true;dictStop();dictStart(arg,false);return;}
  if(act==="pr-new"){
    d.prontuario.sessoes.push({id:uid("s"),data:T.todayKey(),hora:"",evolucao:""});
    schedule();render();focusFirst('[data-cp="prontuario.sessoes.'+(d.prontuario.sessoes.length-1)+'.evolucao"]');return;
  }
  if(act==="pr-run"){
    if(C.iaBusy)return;
    const s=d.prontuario.sessoes[Number(arg)],nota=s&&prNota(d,s);if(!s)return;
    if(!nota||!str(nota.texto)){T.toast("A nota desta sessão está vazia. Escreva em Notas de sessão.");return;}
    const r=redact(str(nota.texto),identifiers(d,C.ctx.patient)),names=nomesSuspeitos(d,r.text);
    // antes de mandar: nomes que a troca automática não conhece, ou uma evolução que seria substituída
    if(C.prConfirm!==s.id&&(names.length||str(s.evolucao))){C.prConfirm=s.id;C.prNames=names;C.nomesSel=new Set();render();return;}
    if(C.prConfirm===s.id)nomesGuardar(d);
    C.prConfirm=null;
    runIA(prJob(d,s,"Evolução organizada. Revise antes de considerar final."));
    return;
  }
  // a nota da sessão vira o prontuário dela (o mesmo que o Organizar com IA do Prontuário)
  if(act==="nt-pr"){
    if(C.iaBusy)return;
    const n=d.notas.itens[Number(arg)];if(!n)return;
    if(!str(n.texto)){T.toast("Escreva a nota primeiro.");return;}
    // antes de mandar: nomes que a troca automática não conhece
    const names=nomesSuspeitos(d,redact(str(n.texto),identifiers(d,C.ctx.patient)).text);
    if(C.prConfirm!=="n:"+n.id&&names.length){C.prConfirm="n:"+n.id;C.prNames=names;C.nomesSel=new Set();render();return;}
    if(C.prConfirm==="n:"+n.id)nomesGuardar(d);
    C.prConfirm=null;
    await ntProntuario(d,n);return;
  }
  if(act==="pr-intro"){
    if(C.iaBusy)return;
    const txt=prAnamneseTexto(d);if(!txt){T.toast("Preencha a Anamnese primeiro.");return;}
    if(C.prConfirm!=="intro"&&str(d.prontuario.intro)){C.prConfirm="intro";render();return;}
    C.prConfirm=null;
    runIA({text:PR_INTRO_PROMPT+"\n\n# Respostas da anamnese (anonimizadas)\n\n"+redact(txt,identifiers(d,C.ctx.patient)).text,modo:"sessao",key:C.pid+":intro",
      ok:"Parágrafo da introdução escrito. Revise antes de entregar.",
      save:(dd,out)=>{dd.prontuario.intro=out;dd.prontuario.intro_ia=T.todayKey();}});
    return;
  }
  if(act==="pr-print"){doPrint(["prontuario"]);return;}
  if(act==="ia-copy"){
    const el=document.getElementById("cx-ia-text");
    try{await navigator.clipboard.writeText(el.value);T.toast("Copiado. Cole na IA e depois traga a resposta para o campo 2.");}
    catch(_){el.focus();el.select();T.toast("Selecionei o texto. Copie com Ctrl+C.");}
    return;
  }
  if(act==="plan-metas"){
    let n=0;
    d.metas.forEach((m,i)=>{
      const t=str(m.meta)||str(m.dificuldade);if(m.superada||!t||plJaTem(d,t)||d.plano.fases.some(f=>f.itens.some(it=>it.meta_id===m.id)))return;
      d.plano.sugestoes.push({id:uid("p"),fase:"",texto:t,como:"",origem:"metas",meta:String(i+1),meta_id:m.id,obstaculos:lines(m.obstaculos).join("; ")});n++;
    });
    if(!n){T.toast(d.metas.length?"Todas as metas já estão no plano.":"Ainda não há metas na Lista de metas.");return;}
    schedule();render();T.toast(n+(n>1?" metas":" meta")+" para colocar no plano: escolha a fase de cada uma.");return;
  }
  if(act==="plan-add-fase"){
    d.plano.fases.push({id:uid("f"),nome:"Nova fase",porque:"",itens:[]});
    schedule();render();focusFirst('[data-cp="plano.fases.'+(d.plano.fases.length-1)+'.nome"]');return;
  }
  if(act==="plan-move"){
    const [fi,j]=String(arg).split(".").map(Number),f=d.plano.fases[fi],k=j+Number(b.dataset.dir);
    if(!f||!f.itens[j]||k<0||k>=f.itens.length)return;
    [f.itens[j],f.itens[k]]=[f.itens[k],f.itens[j]];schedule();render();return;
  }
  // uma fase de cada vez (cada uma vê o que as anteriores acabaram de sugerir, para não repetir)
  if(act==="plan-ia-todas"){
    if(C.iaBusy)return;
    if(!iaData(d,false)){T.toast("Preencha o caso primeiro (Metas, Formulação…): a IA parte do que já está nele.");return;}
    const pid=C.pid;let n=0;
    for(const f of D().plano.fases.slice()){
      if(C.pid!==pid)break;
      C.plTodas=str(f.nome)||"fase";const job=plJob(C.cache[pid],f);if(!job)continue;
      await runIA(job);n+=job.novos||0;
    }
    C.plTodas=null;if(C.pid===pid)render();
    T.toast(n?n+(n>1?" ideias":" ideia")+" no total, embaixo de cada fase. Insira as que fizerem sentido.":"A IA não achou nada novo além do que já está no plano.");
    return;
  }
  if(act==="plan-ia"){
    if(C.iaBusy)return;
    const f=d.plano.fases[Number(arg)];if(!f)return;
    const job=plJob(d,f);
    if(!job){T.toast("Preencha o caso primeiro (Metas, Formulação…): a IA parte do que já está nele.");return;}
    runIA(job);return;
  }
  if(act==="plan-ok"||act==="plan-no"){
    const x=d.plano.sugestoes.find(z=>z.id===arg);if(!x)return;
    if(act==="plan-no")d.plano.sugestoes=d.plano.sugestoes.filter(z=>z!==x);
    else if(!plInsere(d,x,b.dataset.fase))return;
    schedule();render();return;
  }
  if(act==="plan-ok-all"){
    d.plano.sugestoes.filter(z=>z.fase===arg).forEach(x=>plInsere(d,x));
    schedule();render();return;
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
  if(act==="nt-split"){
    const n=d.notas.itens[Number(arg)];if(!n||!n.arquivo||C.iaBusy)return;
    const grupo=ntGrupoArquivo(d,n);if(!grupo.length)return;
    const texto=grupo.map(x=>str(x.texto)).join("\n\n");
    // ano que falta: a data do arquivo (nota inteira) ou hoje; as sessões já separadas mantêm a data que têm
    const rot=x=>str(x.rotulo).replace(NT_PARTE_RE,"");
    const ref=grupo.filter(x=>!x.sessao).map(x=>str(x.data)).filter(Boolean).sort().pop()||T.todayKey();
    const fixas=new Map(grupo.filter(x=>x.sessao&&str(x.data)).map(x=>[rot(x),x.data]));
    const achou=ntSessoes(texto,ref,fixas);
    if(!achou){C.ntSplitAsk=null;render();
      T.toast("Não achei títulos de sessão neste texto ("+NT_EX_TITULO+"). Você pode escrever os títulos no texto, uma sessão por linha, e clicar de novo.");return;}
    // já separado do mesmo jeito: não mexe (nem perde as sugestões)
    const atuais=[...new Set(grupo.filter(x=>x.sessao).map(rot))];
    if(atuais.join("\n")===achou.sessoes.map(x=>x.rotulo).join("\n")){C.ntSplitAsk=null;render();
      T.toast("Já está separado: achei as mesmas "+atuais.length+" sessões. Se faltar alguma, confira se o título dela tem a data ("+NT_EX_TITULO+").");return;}
    if(grupo.some(x=>arr(x.sugestoes).length)&&C.ntSplitAsk!==n.id){C.ntSplitAsk=n.id;render();return;}
    C.ntSplitAsk=null;
    const fica=d.notas.itens.filter(x=>!grupo.includes(x));d.notas.itens.splice(0,d.notas.itens.length,...fica);
    const {novas,ss}=ntCriarNotas(d,texto,ref,ntBaseArq(n),fixas);
    schedule();render();ntMostra(novas);T.toast(ntAvisoSessoes(ss));return;
  }
  if(act==="nt-new"){
    // a pauta já vem com o que ela deixou "para a próxima sessão" na nota anterior
    const ant=ntOrder(d).map(z=>z.n).find(z=>str(z.proxima));
    const n={id:uid("n"),data:T.todayKey(),pauta:ant?str(ant.proxima):"",texto:"",proxima:"",sugestoes:[]};d.notas.itens.push(n);C.ntAbertas.clear();C.ntAbertas.set(n.id,true);schedule();render();
    focusFirst('[data-cp="notas.itens.'+(d.notas.itens.length-1)+'.texto"]');return;
  }
  if(act==="nt-abrir"){
    const k=ntOrder(d).findIndex(z=>z.n.id===arg);if(k<0)return;
    C.ntAbertas.set(arg,!ntAberta(ntOrder(d)[k].n,k));render();return;
  }
  if(act==="nt-run"){
    if(C.iaBusy)return;
    const n=d.notas.itens[Number(arg)];if(!n)return;
    if(!str(n.texto)){T.toast("Escreva a nota primeiro.");return;}
    const r=redact(str(n.texto),identifiers(d,C.ctx.patient)),names=nomesSuspeitos(d,r.text),pend=n.sugestoes.some(x=>!x.aplicada);
    if(C.ntConfirm!==n.id&&r.text.length<=NT_MAX&&(names.length||pend)){C.ntConfirm=n.id;C.prNames=names;C.nomesSel=new Set();render();return;}
    if(r.text.length>NT_MAX){T.toast("Esta nota é longa demais para a IA ler de uma vez. Divida o texto em duas notas.");C.ntConfirm=null;render();return;}
    if(C.ntConfirm===n.id)nomesGuardar(d);
    C.ntConfirm=null;
    const job=ntJob(d,n),pid=C.pid;
    await runIA(job);
    // nota de sessão: em seguida já escreve o prontuário dela (se ainda não tiver um)
    const dd=C.cache[pid],nn=dd&&dd.notas.itens.find(z=>z.id===n.id),ps=nn&&ntPrSessao(dd,nn);
    if(job.salvou&&C.pid===pid&&nn&&!ntDoc(nn)&&!(ps&&str(ps.evolucao)))await ntProntuario(dd,nn,job.ok+" E o prontuário desta sessão já está na aba Prontuário (revise antes de considerar final).");
    return;
  }
  // todas as notas que a IA ainda não leu, uma de cada vez (sem o prontuário de cada uma: são notas antigas)
  if(act==="nt-todas"){
    if(C.iaBusy||C.ntLote)return;
    const fila=ntNaoLidas(d);
    if(!fila.length){T.toast("Todas as notas já foram lidas pela IA.");return;}
    const ids=identifiers(d,C.ctx.patient),names=[...new Set(fila.flatMap(n=>nomesSuspeitos(d,redact(str(n.texto),ids).text)))].slice(0,40);
    if(!C.ntTodasOk&&names.length){C.ntTodasOk=true;C.prNames=names;C.nomesSel=new Set();render();return;}
    if(C.ntTodasOk)nomesGuardar(d);
    C.ntTodasOk=false;
    await ntLevarTodas(fila);return;
  }
  if(act==="nt-org"){if(NT_ABA[arg])await ntOrganizar(arg);return;}
  if(act==="pr-todas"){
    if(C.iaBusy||C.prLote||C.ntLote)return;
    const fila=ntSemProntuario(d);if(!fila.length){T.toast("Todas as notas de sessão já têm prontuário.");return;}
    const ids=identifiers(d,C.ctx.patient),names=[...new Set(fila.flatMap(n=>nomesSuspeitos(d,redact(str(n.texto),ids).text)))].slice(0,40);
    if(!C.prTodasOk&&names.length){C.prTodasOk=true;C.prNames=names;C.nomesSel=new Set();render();return;}
    if(C.prTodasOk)nomesGuardar(d);
    C.prTodasOk=false;
    await ntGerarProntuarios(fila);return;
  }
  if(act==="pr-todas-parar"){if(C.prLote)C.prLote.parar=true;render();return;}
  if(act==="nt-todas-parar"){if(C.ntLote)C.ntLote.parar=true;render();return;}
  if(act==="nt-clear"){const n=d.notas.itens[Number(arg)];if(!n)return;n.sugestoes=n.sugestoes.filter(x=>x.aplicada);schedule();render();return;}
  // sugestões no campo de destino: "i.j" = nota i, sugestão j
  const ntItem=k=>{const [i,j]=String(k).split(".").map(Number),n=d.notas.itens[i],x=n&&n.sugestoes[j];return x&&!x.aplicada?{n,x}:null;};
  if(act==="nt-ok"||act==="nt-ok-all"){
    const its=String(arg).split(",").map(ntItem).filter(Boolean);if(!its.length)return;
    if(b.dataset.fase&&NT_FASES.includes(b.dataset.fase))its.forEach(({x})=>{x.fase=b.dataset.fase;});
    const sem=its.filter(({n,x})=>!ntDecide(d,n,x)).length;
    schedule();render();
    if(sem)T.toast("Os 3 quadros de situação já estão preenchidos: apague ou limpe um para trazer esta.");
    return;
  }
  if(act==="nt-no"){
    const z=ntItem(arg);if(!z)return;
    z.n.sugestoes.splice(z.n.sugestoes.indexOf(z.x),1);schedule();render();return;
  }
  if(act==="nt-ver"){
    const n=d.notas.itens.find(z=>z.id===arg);if(!n)return;
    C.sec="notas";C.printPick=null;C.ntAbertas.set(n.id,true);render();
    const el=document.getElementById("nt-"+n.id);if(el)el.scrollIntoView({block:"start"});return;
  }
  if(act==="tg-add"){d.tarefa.degraus.push({id:uid("g"),texto:"",feito:false,data:null});schedule();render();focusLast('[data-cp^="tarefa.degraus."][data-cp$=".texto"]');return;}
  if(act==="tg-move"){
    const g=d.tarefa.degraus,i=Number(arg),j=i+Number(b.dataset.dir);
    if(j<0||j>=g.length)return;
    [g[i],g[j]]=[g[j],g[i]];schedule();render();
    const el=document.querySelector('#case-root [data-cx="tg-move"][data-arg="'+j+'"][data-dir="'+b.dataset.dir+'"]');if(el&&!el.disabled)el.focus();
    return;
  }
  if(act==="tg-paste"){C.tgPaste=!C.tgPaste;render();if(C.tgPaste){const t=document.getElementById("cx-tg-paste");if(t)t.focus();}return;}
  if(act==="tg-paste-ok"){
    const el=document.getElementById("cx-tg-paste"),xs=lines(el?el.value:"");
    if(!xs.length){T.toast("Cole pelo menos um degrau, um por linha.");return;}
    xs.forEach(t=>d.tarefa.degraus.push({id:uid("g"),texto:t,feito:false,data:null}));
    C.tgPaste=false;schedule();render();T.toast(xs.length+(xs.length>1?" degraus adicionados":" degrau adicionado")+" no alto da escada.");return;
  }
  if(act==="tg-app"){
    const names=d.tarefa.degraus.map(x=>str(x.texto)).filter(Boolean);
    if(!names.length){T.toast("Escreva os degraus primeiro.");return;}
    b.disabled=true;const n=await C.ctx.addActivities(names);b.disabled=false;
    if(n<0)return;
    T.toast(n?n+(n>1?" degraus viraram atividades":" degrau virou atividade")+" do app dela. O SUDS você completa em Ativação comportamental → Configurar.":"Esses degraus já estão no app dela.");return;
  }
  if(act==="tg-print"){
    document.body.classList.add("tg-printing");
    window.addEventListener("afterprint",()=>document.body.classList.remove("tg-printing"),{once:true});
    setTimeout(()=>window.print(),50);return;
  }
  if(act==="tg-png"){
    const blob=await tgBlob();if(!blob){T.toast("Não consegui gerar a imagem.");return;}
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=tgFile();document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);T.toast("Imagem baixada. Dá para mandar pelo WhatsApp.");return;
  }
  if(act==="tg-share"){
    const blob=await tgBlob(),file=blob&&new File([blob],tgFile(),{type:"image/png"});
    if(!file||!navigator.canShare||!navigator.canShare({files:[file]})){T.toast("Este navegador não compartilha imagens. Use Baixar imagem.");return;}
    try{await navigator.share({files:[file],title:str(d.tarefa.titulo)||TG_TITULO});}catch(_){}
    return;
  }
  if(act==="to-trilha"){
    const names=lines(d.metas[Number(arg)].submetas);
    if(!names.length){T.toast("Escreva as submetas primeiro, uma por linha.");return;}
    b.disabled=true;
    const n=await C.ctx.addActivities(names);
    b.disabled=false;
    if(n<0)return; // o painel já avisou o erro
    T.toast(n?n+(n>1?" atividades adicionadas":" atividade adicionada")+" ao app dela. O SUDS você completa em Ativação comportamental → Configurar.":"Essas submetas já estão no app dela.");
    return;
  }
});
window.addEventListener("beforeunload",e=>{if(Object.keys(C.dirty).length||C.saving||C.iaBusy){e.preventDefault();e.returnValue="";}});
window.addEventListener("online",()=>{if(Object.keys(C.dirty).length)flush();});

window.TrilhaCase={
  html(){return '<div id="case-root" class="cx"></div>';},
  // ctx: {sb, patient, addActivities(nomes) -> quantas entraram, ou -1 se deu erro, setCartas(cartas|null) -> salvou?}
  mount(ctx){
    if(C.pid&&C.pid!==ctx.patient.id){dictStop();C.dictAsk=null;C.imp=null;C.confirmDel=null;C.cmpIdx=0;C.iaDraft=null;C.iaHyp=false;C.iaConfirm=false;C.prConfirm=null;
      C.cartasViradas.clear();C.cartasOrdem={};C.cartasEdit=false;C.cartasFull=false;C.cartasAppSel=null;flush();}
    C.ctx=ctx;C.pid=ctx.patient.id;
    render();
    // busca de novo sempre que abre (pode ter sido editada em outro aparelho), sem atropelar o que está sendo digitado
    if(!C.dirty[C.pid]&&!C.saving)ensureLoaded(C.pid);
  },
  flush,
  pending(){return Object.keys(C.dirty).length>0||!!C.saving;},
  section(){return C.sec;},
  setSection(k){if(SECTIONS.some(([x])=>x===k))C.sec=k;},
  _test:{normalize,vlq,scoresOf,linked,age,redact,identifiers,iaData,tgWrap,tgDraw,ntParse,ntPartes,ntSessoes,ntGrupoArquivo,ntPend,NT_PROMPT}
};
})();
