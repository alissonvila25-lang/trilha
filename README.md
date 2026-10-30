# Organizer Clinica (antes "Trilha de Reforçadores")

App (PWA) de economia de fichas para acompanhar exposições da hierarquia SUDS.

- **Paciente** (`index.html`): abre um link com um código secreto, sem criar conta, e instala o app na tela inicial.
  Cada atividade feita no dia vale 1 ponto. Ao marcar uma atividade, pergunta como foi de verdade — a escala de
  Realidade da planilha (0/25/50/75/100), que dá para pular ou editar depois pelo próprio chip. Quando falta pouco
  para um reforçador, o app avisa: faltando 5 pontos para reforçadores de até 99 pontos, e faltando 10 para os de
  100 ou mais. Ao alcançar um reforçador, aparece uma comemoração (confete, balões ou fogos). Marcações feitas sem
  internet ficam guardadas e são enviadas depois.
- **Psicóloga** (`admin.html`): entra com e-mail e senha, cadastra pacientes, edita reforçadores e atividades
  (sempre em ordem crescente: reforçadores pelos pontos, atividades pelo SUDS), vê os pontos e o histórico, faz
  ajustes manuais e gera o link ou QR code de acesso. Cada paciente tem duas abas: *Formulação* e *Paciente*. Os pontos, o histórico
  e a configuração da trilha ficam em Formulação → Recursos → *Ativação comportamental* (*Acompanhar* e *Configurar*), onde
  "Evolução por atividade" mostra a sequência de respostas de Realidade de cada atividade — o número caindo com a repetição é
  sinal de que a ansiedade real está diminuindo com a exposição.

Os dados ficam no [Supabase](https://supabase.com) (plano gratuito). O site é estático e está publicado na
[Vercel](https://vercel.com) (plano gratuito): **https://trilha-vert.vercel.app/**

- Painel da psicóloga: https://trilha-vert.vercel.app/admin.html
- A paciente recebe o link gerado no painel: `https://trilha-vert.vercel.app/?p=CODIGO`

## Estrutura

```
supabase/schema.sql   tabelas, regras de acesso (RLS) e funções usadas pelo app da paciente
supabase/functions/analisar-caso/   função que manda a formulação anonimizada para o Claude
web/                  site estático (o que vai para a Vercel; Root Directory do projeto = "web")
  index.html, patient.js   app da paciente
  admin.html, admin.js     painel da psicóloga
  core.js, app.css         regras de pontuação, telas e comemorações compartilhadas
  sw.js, manifest.webmanifest, icons/   PWA (instalação e uso sem internet)
  config.js                URL e chave pública do Supabase
  case.js, case.css        aba Formulação (anamnese, metas, formulação, conceitualização, plano, prontuário, recursos)
  importar.js              lê formulações antigas em Excel (modelo "Formulação de caso")
  anamnese.html, anamnese.js, anamnese-campos.js   anamnese que a paciente preenche pelo link
  library.js, library.css  Biblioteca de materiais (PDF e imagens) com modo apresentação
  consulta.js              Consulta clínica: IA que procura na Biblioteca e pesquisa na internet, com fontes
  criar.js, criar.css      Criar com IA: materiais para as sessões (folha para imprimir) e conteúdo para o Instagram
```

## Configuração (uma vez)

1. **Criar o projeto no Supabase**: em supabase.com, crie uma conta e um projeto (região São Paulo).
2. **Criar o banco**: no projeto, abra *SQL Editor*, cole todo o conteúdo de `supabase/schema.sql` e clique em *Run*.
3. **Criar o login da psicóloga**: em *Authentication → Users → Add user → Create new user*, informe o e-mail
   e uma senha e marque *Auto Confirm User*.
4. **Bloquear cadastros novos**: em *Authentication → Sign In / Providers*, desligue *Allow new users to sign up*.
   Assim ninguém consegue criar conta pelo painel.
5. **Ligar o site ao banco**: em *Project Settings → API*, copie a *Project URL* e a chave *anon public*
   para `web/config.js`. A chave anon é pública por design: a proteção vem das regras do banco.
6. **Publicar**: publique a pasta `web/` (veja abaixo).

## Ligar a IA (Formulação, Prontuário, Consulta clínica e Criar com IA)

*Analisar com Claude*, *Organizar com IA*, a *Consulta clínica* e o *Criar com IA* chamam a função `analisar-caso` do Supabase,
que guarda a chave da Anthropic (a chave nunca vai para o site). Sem a chave, os botões só avisam que a IA
não está ligada; copiar e colar continua funcionando.

1. Em [platform.claude.com](https://platform.claude.com): criar a conta, pôr crédito (*Settings → Billing*),
   definir um limite mensal de gasto (*Settings → Limits*) e criar uma chave (*Settings → API keys*). A
   assinatura do Claude no site não vale para a API. A pesquisa na internet da Consulta vem ligada; se der
   erro, conferir *Settings → Capabilities → Web search* (custa US$ 10 a cada 1.000 pesquisas, além do texto).
2. No Supabase: *Edge Functions → Secrets* (ou *Project Settings → Edge Functions*) → adicionar
   `ANTHROPIC_API_KEY` com a chave.
3. Opcionais: o modelo de cada tarefa, `ANTHROPIC_MODEL_CASO` (Formulação; padrão `claude-opus-5-5`),
   `ANTHROPIC_MODEL_SESSAO` (Prontuário), `ANTHROPIC_MODEL_PLANO` (ideias do plano) e `ANTHROPIC_MODEL_REVISAR` (Organizar as sugestões), padrão `claude-opus-5-5`, `ANTHROPIC_MODEL_CONSULTA` (Consulta), `ANTHROPIC_MODEL_RECURSO`
   (materiais para as sessões) e `ANTHROPIC_MODEL_MARKETING` (Instagram), todos com padrão `claude-sonnet-5-5`; e `IA_EMAILS` (e-mails que podem usar a IA, separados por vírgula, espaço ou
   linha; vazio = qualquer login do painel). Cada uso grava no log da função uma linha `uso` com tokens e custo
   estimado, sem nenhum texto (Supabase → Edge Functions → analisar-caso → Logs).

Para publicar uma mudança na função: Supabase CLI (`supabase functions deploy analisar-caso`) ou o editor de
Edge Functions no painel do Supabase.

## Publicar na Vercel

O projeto está importado do GitHub na Vercel, com *Root Directory* = `web`. A cada push na branch `main`,
a Vercel publica sozinha, sem passo manual.

Para importar em outra conta: [vercel.com](https://vercel.com) → *Add New → Project* → escolher o repositório →
em *Root Directory* trocar `./` por `web` → *Framework Preset*: `Other` → *Deploy*. O domínio pode ser
personalizado depois em *Project Settings → Domains*.

Este repositório também tem um workflow de GitHub Pages (`.github/workflows/pages.yml`), mantido como
alternativa/backup; não é o endereço usado no dia a dia.

## Uso

- **Painel**: os botões (pacientes, nova paciente, editar, Biblioteca, Consulta clínica, Criar com IA, Cores,
  Atualizar, Sair) ficam numa barra de ícones à esquerda; os ⋯ abrem os nomes. O **olhinho** no canto superior
  direito esconde nomes e dados de identificação (asteriscos na lista, campos mascarados) para gravar a tela; vale
  só na tela, a impressão sai normal, e fica lembrado no aparelho. **Arquivar** (aba Paciente) tira da lista quem
  terminou o acompanhamento, sem apagar nada (ids em user_metadata.arquivados); *Arquivadas* na barra mostra de novo.
- **Psicóloga**: *+ Paciente* → abre em Ativação comportamental → *Configurar*: cadastrar reforçadores e atividades (o botão *Colar lista* aceita
  colunas copiadas do Excel; a lista se ordena sozinha) → aba *Paciente* → enviar o link ou mostrar o QR code.
  Com o *Celular (WhatsApp)* salvo (no cadastro ou na aba Paciente), *Enviar no WhatsApp dela* abre direto a
  conversa com ela, com a mensagem pronta; sem celular, o WhatsApp abre a lista de conversas para escolher.
  Para acompanhar: Formulação → Recursos → *Ativação comportamental*.
- **Anamnese pela paciente**: aba *Paciente* → *Anamnese para ela preencher* → *Enviar pelo WhatsApp*. As respostas
  entram sozinhas na Anamnese quando a psicóloga abre a Formulação (campos vazios; os diferentes ela escolhe).
- **Prontuário**: guarda só a evolução de cada sessão (data e horário); as anotações ficam nas Notas de sessão e a
  sessão do prontuário fica ligada à nota (nota_id). A IA escreve o prontuário da sessão com as regras da Beatriz (título "PRONTUÁRIO: SESSÃO DD/MM (horário)", um parágrafo, ética e
  sigilo do CFP; os prontuários das sessões anteriores vão como ficha de continuidade); *Escrever de novo pela nota*
  refaz. Anotações escritas no prontuário antes dessa mudança viraram notas de sessão (mesma data), sem perder nada. A *Introdução do prontuário*
  (identificação da Anamnese + um parágrafo de anamnese, que a IA escreve com as mesmas regras) abre o prontuário
  impresso. *Importar Word ou PDF* traz prontuários antigos: cada sessão do arquivo (título como "PRONTUÁRIO: SESSÃO
  20/10 (14h)") vira uma sessão, com data e horário, e entra como histórico e continuidade. *🎤 Ditar* (nas Notas de sessão) escreve a anotação pela voz (no Chrome do computador o reconhecimento roda no próprio aparelho; em navegadores que só fazem isso on-line, pede confirmação antes).
- **Notas de sessão**: Formulação → *Notas de sessão* (ao lado do Prontuário, mas fora dele). Uma nota por sessão, com
  a data, ditado por voz e três quadros: *pauta* (o que levar), *anotações da sessão* e *para a próxima* (a nota seguinte
  já começa com isso na pauta; vai para o prontuário como plano de ação). Fechada, a nota mostra só um resumo. *Levar para as outras abas*: a IA lê a nota anonimizada e sugere o que vai para a
  Formulação, a Conceitualização, as Metas e a Linha da vida, e em seguida escreve o prontuário da sessão (aba
  Prontuário, ligado à nota; *Gerar prontuário* faz só essa parte). Na Formulação, as sugestões ficam dentro da caixa
  *Das outras abas*, como itens de lista (Inserir / ×). A IA lê cada nota como supervisora clínica: recebe o que já está
  escrito no caso e as sugestões pendentes, para não repetir, e junta o mesmo assunto em texto corrido com ";".
  *Organizar as sugestões* (no alto de cada aba; sozinho depois do Levar todas) revisa as pendentes com o Opus (modo
  "revisar"): junta as do mesmo assunto de sessões diferentes e tira as repetidas e as que não ajudam. Na conferência de
  nomes, ela toca nos que são nomes: ficam em d.nomes (viram [nome]) e o resto em d.nao_nomes. *Gerar os prontuários de
  todas* faz o prontuário de cada nota de sessão que ainda não tem. *Levar todas para as outras abas* (nas Notas e no alto da Formulação) lê, uma a uma, as notas que
  a IA ainda não leu, conferindo antes os nomes de todas de uma vez (sem o prontuário de cada uma). Cada sugestão aparece embaixo do campo onde entraria
  (o menu mostra quantas esperam em cada aba; a nota só mostra o resumo, com atalhos): ela edita, *Inserir* ou ×
  descarta ali mesmo, junto com o que já está escrito, e o que entra leva "(sessão dd/mm/aa)". O que já estiver lá não
  se repete. O pedido à IA leva a pergunta de cada campo, como na tela, para cada item cair no lugar certo. *Importar Word ou PDF* (.docx, PDF com texto ou .txt) põe o
  texto do arquivo numa nota (data = última alteração do arquivo; itens levados entram com "(documento dd/mm/aa)").
  Arquivo com várias sessões (títulos como "PRIMEIRA SESSÃO 10/03", "2ª sessão - 17/03", "Sessão 3 (24/03/2025)" ou só a
  data na linha) vira uma nota por sessão, com a data do título (sem ano: o mais recente que mantém a ordem); o que vem
  antes da 1ª sessão fica numa nota à parte. Também valem "TERAPIA 12/06 ÀS 15H" (terapia, psicoterapia, consulta,
  encontro, retorno, atendimento + data ou número), linha curta em maiúsculas com data, "Data: 17/03",
  "Segunda-feira, 24 de março" e "17 mar 2025". Toda nota de arquivo tem *Separar por sessão*: junta as notas da mesma
  importação e separa de novo (as sessões que já existiam mantêm a data; se nada mudou, não mexe; se não achar
  títulos, ela pode escrevê-los no texto e clicar de novo). Arquivo grande vira várias notas (até 40 mil caracteres cada). Word antigo
  (.doc) e PDF escaneado não são lidos.
- **Metas (LDM)**: em ordem de prioridade (↑ ↓ mudam a ordem), ✓ marca a dificuldade superada (com data) e *Ver só as
  dificuldades* recolhe os cartões para abrir um por um. Na *Formulação*, *Ocultar sugestões das outras abas* esconde os
  quadros "Das outras abas" (a escolha fica guardada no navegador).
- **Tarefa gradativa**: Formulação → Recursos → *Tarefa gradativa*. Os degraus vão do mais fácil (embaixo) ao mais
  difícil (*+ Degrau* ou *Colar lista*, ↑ ↓ para reordenar, ✓ para marcar o que ela já conseguiu). A escada é desenhada
  na hora e sai em *Imprimir / PDF*, *Baixar imagem* (PNG para mandar pelo WhatsApp) ou *Compartilhar*; *Levar degraus
  para o app dela* transforma os degraus em atividades.
- **Cartas de intimidade**: Formulação → Recursos → *Cartas de intimidade*. Baralho próprio (*Encontros*, texto em
  `web/cartas.js`), em 4 fases: Conhecer-se (individual), Conversar, Tocar sem pressa e Explorar juntos (foco
  sensorial). Clicar na carta vira; *Embaralhar*, *Virar todas para baixo*, *Marcar como feita* (guarda a data) e *Tela
  cheia* (só as cartas, para mostrar na sessão; Esc sai). Em *Editar as cartas* ela muda o texto, tira cartas do
  baralho ou cria as dela; isso vale só para aquele caso. A fase em que o caso está fica guardada.
  Em *No app da paciente* ela marca as fases e clica *Liberar no app dela*: uma cópia dessas fases (com as edições do
  caso) vai em `patients.config.cartas`, e o app da paciente ganha a aba **Cartas**, estilo flashcard: uma carta por
  vez, toque para virar, ‹ › (ou setas do teclado, ou arrastar no celular) para passar, *Embaralhar* e troca de fase; a
  posição fica guardada no aparelho. Mudou carta depois? O quadro avisa e *Atualizar no app dela* manda de novo;
  *Tirar do app* some com a aba. Salvar a Configuração não mexe nas cartas.
- **Importar formulação antiga**: Formulação → *Importar arquivo*. Planilha (.xlsx do modelo): mostra o que achou antes
  de gravar e só preenche o que estiver vazio. Word ou PDF: vira uma nota de sessão (veja acima) e a IA distribui.
- **Imprimir / PDF da Formulação**: abre *O que vai no PDF?* com as partes para marcar (já vem marcada a parte aberta;
  *Marcar tudo* = a formulação inteira, sem o prontuário). Com uma parte só, o título e o nome sugerido do arquivo são
  dela (ex.: "Conceitualização - Ana").
  A *Formulação* e a *Conceitualização* saem como folha de formulário (quadros com borda; o diagrama com as caixas
  ligadas e as 3 situações lado a lado), cada uma numa folha A4: com pouco texto os quadros crescem até encher a
  página, com muito texto a folha toda encolhe para caber.
- **Plano de tratamento**: gira em torno das metas: *Trazer as metas* (cada uma pede a fase, com os obstáculos; o item
  fica ligado à meta e acompanha quando ela muda) e, em cada fase, *Ideias da IA
  para esta fase* ou *para todas as fases* (o que trabalhar + como, a partir do caso anonimizado; nada entra sem ela
  inserir). Os itens têm ↑ ↓ para mudar a ordem, e o *como* cresce com o texto. As fases intermediária e final
  aparecem sempre (mesmo vazias); *+ Fase* cria outra.
- **Cores**: na barra lateral. 11 paletas (Café, a original, Sálvia, Oceano, Lavanda, Rosé, Grafite, Cinza, Branco, Preto, Amarelo e Chocolate), com contraste
  conferido. A escolha fica na conta da psicóloga (user_metadata.tema) e vai na config de cada paciente
  (config.tema), então o app delas segue; ouro/coral e as cores do SUDS e da Realidade não mudam.
- **Biblioteca**: na barra lateral. PDF e imagens até 50 MB; PowerPoint/Canva entram salvos como PDF.
  O texto dos PDFs é extraído no navegador ao enviar e entra na Consulta clínica (PDF digitalizado como imagem
  não tem texto; materiais antigos: *Preparar* no cartão).
- **Consulta clínica**: na barra lateral, fora das pacientes. A IA procura nos PDFs da Biblioteca, pesquisa a
  literatura atual na internet, cruza as duas e cita as fontes (material e página, ou link). Fica no histórico.
  **Memória**: a resposta que ela marca como *confiável* vira fonte das próximas perguntas parecidas (a IA consulta
  a memória primeiro, depois a Biblioteca, depois a internet). Enquanto ela escreve, aparecem as perguntas
  parecidas já feitas, para abrir de graça.
- **Criar com IA**: na barra lateral, fora das pacientes. *Recurso para a sessão*: ficha, registro, psicoeducação,
  exercício guiado, tarefa de casa, hierarquia de exposição, cartão de enfrentamento ou dinâmica; a IA procura antes
  nos PDFs da Biblioteca e sai uma folha pronta para *Imprimir / PDF* (as notas para a psicóloga e as fontes ficam
  fora da impressão). *Instagram*: carrossel, post, Reels, stories ou ideias do mês, seguindo as regras de
  publicidade do CFP, com a assinatura (nome e CRP) guardada no login; cada slide, legenda e hashtags tem o próprio
  *Copiar*. Nos dois: *Pedir um ajuste à IA*, *Editar texto* e histórico em *Já criados*.
- **Paciente**: abrir o link → *Adicionar à tela inicial* → *Ativar avisos*.
  No iPhone, os avisos só funcionam com o app instalado na tela inicial (iOS 16.4 ou mais novo).

### Limites conhecidos

- Os avisos aparecem quando ela marca uma atividade, com o app aberto ou em segundo plano. Lembretes com o
  app fechado (por exemplo "você ainda não marcou hoje") exigiriam Web Push com um servidor, que ainda não existe.
- Os pontos são acumulativos: alcançar um reforçador não desconta pontos. *Recomeçar ciclo* zera o total.
- A paciente pode marcar ou corrigir até 7 dias para trás.

## Privacidade

A tabela de pacientes guarda apenas o nome ou apelido digitado pela psicóloga, o celular (opcional, só para
abrir o WhatsApp; o link da paciente não recebe), a configuração e as marcações diárias. Recomenda-se usar só o primeiro nome ou um apelido. Quem tiver o link da paciente consegue abrir o app
dela; se o link vazar, use *Gerar novo código* no painel.
