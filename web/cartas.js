/* Baralho "Encontros" (recurso Cartas de intimidade da Formulação): cartas para trabalhar a sexualidade e a
   intimidade, em fases, do autoconhecimento ao toque a dois. Texto próprio, baseado no foco sensorial
   (Masters e Johnson) e na TCC da sexualidade. Cada carta: [id, título, texto, dica]. Mudar um id desliga o que
   já foi marcado ou editado com o id antigo. */
window.TRILHA_CARTAS={
  nome:"Encontros",
  regras:[
    "As fases vão em ordem. Passem para a próxima só quando a anterior estiver confortável, combinando na sessão.",
    "Virem uma carta, leiam juntos e combinem quando fazer: ela pode ser o exercício da sessão ou a tarefa da semana.",
    "Qualquer pessoa pode pular uma carta ou pedir pausa, a qualquer momento, sem precisar explicar.",
    "Não há meta de desempenho: o objetivo é perceber e conversar, não chegar ao orgasmo nem à relação.",
    "Respeite os seus limites e os da outra pessoa. O que é combinado na sessão vale mais que a carta.",
    "Anotem como foi, para trazer à próxima sessão."
  ],
  fases:[
    {id:"f1",nome:"Conhecer-se",quem:"Individual",
      sobre:"Reflexões e exercícios para fazer sozinho(a): de onde vêm as ideias sobre sexo, o próprio corpo e o que acende ou apaga o desejo.",
      cartas:[
        ["c1-01","O que aprendi","O que você ouviu sobre sexo na infância e na adolescência? De quem? Que frases ficaram na sua cabeça até hoje?","Repare quais dessas ideias ainda guiam o que você sente e faz."],
        ["c1-02","Meu corpo, sem julgamento","Olhe para o seu corpo no espelho por alguns minutos, sem pressa. Descreva o que vê com palavras neutras, como se descrevesse uma paisagem.","Quando vier uma crítica, só note \"estou tendo um pensamento de crítica\" e volte a descrever."],
        ["c1-03","Mapa do desejo","O que costuma acender o seu desejo? Pense em lugares, horários, cheiros, palavras e no clima da relação. E o que costuma apagar?","O desejo também nasce da situação, não só da vontade que aparece sozinha."],
        ["c1-04","Tempo para mim","Reserve 20 minutos só para você nesta semana: um banho demorado, creme no corpo, uma música. O objetivo é sentir, não chegar a lugar nenhum.",""],
        ["c1-05","Pensamentos que atrapalham","Que pensamentos aparecem na hora da intimidade e tiram você do momento? (Por exemplo: \"vou demorar demais\", \"meu corpo está feio\".) Anote-os.","Traga a lista para a sessão."],
        ["c1-06","Sim, não, talvez","Faça três listas: o que você gosta ou gostaria (sim), o que não quer (não) e o que desperta curiosidade, mas ainda não sabe (talvez).","Ninguém precisa ver essas listas agora. Elas são suas."],
        ["c1-07","Uma boa lembrança","Lembre de um momento de intimidade, sexual ou não, em que você se sentiu bem. O que estava acontecendo? O que tornou aquele momento bom?",""],
        ["c1-08","Toque por toque","Explore o toque na própria pele: mãos, braços, pescoço, rosto. Varie a pressão e a velocidade. Que tipo de toque é mais agradável?","Curiosidade no lugar de expectativa."],
        ["c1-09","O que é sexo para mim","Complete, sem se censurar: \"Para mim, uma vida sexual boa seria…\"",""],
        ["c1-10","Corpo e emoção","Feche os olhos. Onde, no corpo, você sente a ansiedade? E o prazer? E a tranquilidade?","Saber onde cada um mora ajuda a perceber quando chegam."]
      ]},
    {id:"f2",nome:"Conversar",quem:"Em dupla",
      sobre:"Conversas para se aproximar, combinar sinais e falar de desejo sem cobrança. Ainda sem exercícios de toque.",
      cartas:[
        ["c2-01","Como começamos","Contem um ao outro como foi o começo de vocês. O que cada um lembra de mais gostoso daquela época?",""],
        ["c2-02","Do que eu gosto em você","Cada um diz três coisas de que gosta no outro: uma do jeito de ser, uma do corpo e uma de como cuida da relação.",""],
        ["c2-03","Pedidos claros","Cada um faz um pedido para a semana começando com \"Eu gostaria que…\". Um pedido concreto, possível e dito no positivo (o que fazer, não o que parar).",""],
        ["c2-04","Nossos sinais","Combinem um sinal, palavra ou gesto, para \"pausa\" e outro para \"gosto disso, continue\". Vocês vão usá-los nas próximas fases.","Respeitar a pausa sem cobrança é o que deixa os dois seguros."],
        ["c2-05","Sim, não, talvez a dois","Se cada um fez as listas da carta \"Sim, não, talvez\", comparem só os sim e os talvez em comum.","O não de cada um não precisa de explicação."],
        ["c2-06","O que nos afasta","Que situações do dia a dia esfriam a intimidade de vocês (cansaço, telas, filhos, brigas)? Escolham uma para mudar nesta semana.",""],
        ["c2-07","Escuta de 3 minutos","Um fala por 3 minutos sobre como se sente na vida sexual de vocês; o outro só escuta, sem responder. Depois, quem ouviu resume o que entendeu. Troquem.",""],
        ["c2-08","Jeitos de carinho","Cada um conta qual carinho do dia a dia faz se sentir amado(a): palavras, toque, tempo junto, ajuda ou presentes.",""],
        ["c2-09","Encontro marcado","Planejem um encontro a dois nesta semana, sem obrigação de sexo. Escolham o dia, a hora e o que vão fazer.",""],
        ["c2-10","Um desejo ainda não dito","Se se sentirem seguros, contem uma curiosidade ou fantasia leve. Quem escuta responde só com acolhimento, sem decidir nada agora.",""]
      ]},
    {id:"f3",nome:"Tocar sem pressa",quem:"Em dupla",
      sobre:"Foco sensorial: toque pelo corpo, sem seios e genitais e sem relação sexual, para perceber sem pressão.",
      cartas:[
        ["c3-01","O combinado","Nesta fase, o toque não inclui seios e genitais, e não há relação sexual, mesmo que dê vontade. Sem meta e sem desempenho: só perceber.","Tirar a meta é o que tira a pressão."],
        ["c3-02","Mãos que conversam","Sentem frente a frente e explorem as mãos um do outro por 10 minutos, de olhos fechados. Depois, contem o que sentiram.",""],
        ["c3-03","Quem toca, quem recebe","Um toca o corpo do outro (costas, braços, pernas) por 15 minutos, com curiosidade pela textura e pela temperatura. Quem recebe só percebe. Depois, troquem.","Quem toca toca pelo prazer de explorar, não para agradar."],
        ["c3-04","Mão sobre mão","Quem recebe coloca a mão sobre a mão de quem toca e mostra, sem palavras, a pressão e o ritmo que prefere.",""],
        ["c3-05","Banho de perceber","Tomem banho juntos, lavando um ao outro devagar, atentos à água, ao sabonete e ao toque. As regras desta fase continuam valendo.",""],
        ["c3-06","Texturas","Usem objetos diferentes no toque: uma pena, um tecido macio, creme, uma toalha morna. Quem recebe conta de qual gostou mais.",""],
        ["c3-07","Voltar para o corpo","Se durante o toque vierem pensamentos de cobrança ou preocupação, perceba e leve a atenção de volta ao ponto exato onde a pele está sendo tocada.",""],
        ["c3-08","De 0 a 10","De vez em quando, quem recebe diz baixinho uma nota de 0 a 10 para o quanto está agradável.","Ajuda quem toca a conhecer o outro, sem adivinhar."],
        ["c3-09","Depois do toque","No fim, conversem por 5 minutos: o que foi bom, o que foi neutro e o que foi desconfortável. Sem críticas, só descrição.",""],
        ["c3-10","De novo, outro dia","Repitam o toque duas ou três vezes nesta semana, em dias diferentes. Anotem como foi cada vez.",""]
      ]},
    {id:"f4",nome:"Explorar juntos",quem:"Em dupla",
      sobre:"O toque se amplia para o corpo inteiro, com seios e genitais, ainda sem a obrigação de chegar à relação.",
      cartas:[
        ["c4-01","Ampliar o mapa","Agora o toque pode incluir seios e genitais, como mais uma parte do corpo, sem pular direto para eles. A relação sexual continua fora do combinado por enquanto.","O combinado muda quando vocês conversarem sobre isso na sessão."],
        ["c4-02","Corpo inteiro","Comecem pelo corpo todo, como na fase anterior, e só depois incluam as áreas mais íntimas. Quem recebe pode guiar com a mão.",""],
        ["c4-03","Vai e volta","Se a excitação vier, deixem que ela suba e desça. Parem o toque íntimo por um tempo e depois voltem a ele.","Ver que a excitação volta tira o medo de perdê-la."],
        ["c4-04","Mostre como gosta","Cada um mostra como gosta de ser tocado, tocando a si mesmo enquanto o outro observa. Só se os dois estiverem à vontade.",""],
        ["c4-05","Com palavras","Um guia o outro com palavras: onde tocar, mais devagar, mais firme. Depois, invertam.","Usem o sinal de pausa sempre que quiserem."],
        ["c4-06","Outro cenário","Mudem algo no ambiente: outro cômodo, outra luz, uma música, um cheiro. Reparem no que muda no desejo.",""],
        ["c4-07","Fantasia contada","Contem um ao outro uma cena que acham excitante. Ela não precisa acontecer: contar já aproxima.",""],
        ["c4-08","Quando chegar a hora","Quando for combinado na sessão, a relação entra como mais uma possibilidade, não como objetivo. Comecem devagar, com quem sente mais receio no controle do ritmo.",""],
        ["c4-09","O que aprendemos","Conversem: o que descobriram sobre o corpo e o desejo de cada um? O que querem levar daqui?",""],
        ["c4-10","Para manter","Escolham dois hábitos para manter a intimidade viva (um encontro por semana, o toque sem meta, a escuta de 3 minutos…) e escrevam num lugar que os dois vejam.",""]
      ]}
  ]
};
