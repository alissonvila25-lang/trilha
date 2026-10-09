# Organizer Clinica (antes "Trilha de Reforçadores")

App (PWA) de economia de fichas para acompanhar exposições da hierarquia SUDS.

- **Paciente** (`index.html`): abre um link com um código secreto, sem criar conta, e instala o app na tela inicial.
  Cada atividade feita no dia vale 1 ponto. Ao marcar uma atividade, pergunta como foi de verdade — a escala de
  Realidade da planilha (0/25/50/75/100), que dá para pular ou editar depois pelo próprio chip. Quando falta pouco
  para um reforçador, o app avisa: faltando 5 pontos para reforçadores de até 99 pontos, e faltando 10 para os de
  100 ou mais. Ao alcançar um reforçador, aparece uma comemoração (confete, balões ou fogos). Marcações feitas sem
  internet ficam guardadas e são enviadas depois.
- **Psicóloga** (`admin.html`): entra com e-mail e senha, cadastra pacientes, edita reforçadores e atividades,
  vê os pontos e o histórico, faz ajustes manuais e gera o link ou QR code de acesso. No Resumo, "Evolução por
  atividade" mostra a sequência de respostas de Realidade de cada atividade — o número caindo com a repetição é
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

## Ligar a IA (Formulação, Prontuário e Consulta clínica)

*Analisar com Claude*, *Organizar com IA* e a *Consulta clínica* chamam a função `analisar-caso` do Supabase,
que guarda a chave da Anthropic (a chave nunca vai para o site). Sem a chave, os botões só avisam que a IA
não está ligada; copiar e colar continua funcionando.

1. Em [platform.claude.com](https://platform.claude.com): criar a conta, pôr crédito (*Settings → Billing*),
   definir um limite mensal de gasto (*Settings → Limits*) e criar uma chave (*Settings → API keys*). A
   assinatura do Claude no site não vale para a API. A pesquisa na internet da Consulta vem ligada; se der
   erro, conferir *Settings → Capabilities → Web search* (custa US$ 10 a cada 1.000 pesquisas, além do texto).
2. No Supabase: *Edge Functions → Secrets* (ou *Project Settings → Edge Functions*) → adicionar
   `ANTHROPIC_API_KEY` com a chave.
3. Opcionais: o modelo de cada tarefa, `ANTHROPIC_MODEL_CASO` (Formulação; padrão `claude-opus-5-5`),
   `ANTHROPIC_MODEL_SESSAO` (Prontuário; padrão `claude-sonnet-5-5`) e `ANTHROPIC_MODEL_CONSULTA` (Consulta;
   padrão `claude-sonnet-5-5`); e `IA_EMAILS` (e-mails que podem usar a IA, separados por vírgula, espaço ou
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

- **Psicóloga**: *+ Paciente* → cadastrar reforçadores e atividades (o botão *Colar lista* aceita colunas
  copiadas do Excel) → *Link de acesso* → enviar o link ou mostrar o QR code.
- **Anamnese pela paciente**: aba *Paciente* → *Anamnese para ela preencher* → *Enviar pelo WhatsApp*. As respostas
  entram sozinhas na Anamnese quando a psicóloga abre a Formulação (campos vazios; os diferentes ela escolhe).
- **Prontuário**: Formulação → *Prontuário* → *+ Nova sessão*; *Organizar com IA* vira a anotação em registro de evolução. *🎤 Ditar* escreve a anotação pela voz (no Chrome do computador o reconhecimento roda no próprio aparelho; em navegadores que só fazem isso on-line, pede confirmação antes).
- **Importar formulação antiga**: Formulação → *Importar planilha* (.xlsx do modelo). Mostra o que achou antes de gravar
  e só preenche o que estiver vazio.
- **Biblioteca**: botão *Biblioteca* no topo. PDF e imagens até 50 MB; PowerPoint/Canva entram salvos como PDF.
  O texto dos PDFs é extraído no navegador ao enviar e entra na Consulta clínica (PDF digitalizado como imagem
  não tem texto; materiais antigos: *Preparar* no cartão).
- **Consulta clínica**: botão no topo, fora das pacientes. A IA procura nos PDFs da Biblioteca, pesquisa a
  literatura atual na internet, cruza as duas e cita as fontes (material e página, ou link). Fica no histórico.
  **Memória**: a resposta que ela marca como *confiável* vira fonte das próximas perguntas parecidas (a IA consulta
  a memória primeiro, depois a Biblioteca, depois a internet). Enquanto ela escreve, aparecem as perguntas
  parecidas já feitas, para abrir de graça.
- **Paciente**: abrir o link → *Adicionar à tela inicial* → *Ativar avisos*.
  No iPhone, os avisos só funcionam com o app instalado na tela inicial (iOS 16.4 ou mais novo).

### Limites conhecidos

- Os avisos aparecem quando ela marca uma atividade, com o app aberto ou em segundo plano. Lembretes com o
  app fechado (por exemplo "você ainda não marcou hoje") exigiriam Web Push com um servidor, que ainda não existe.
- Os pontos são acumulativos: alcançar um reforçador não desconta pontos. *Recomeçar ciclo* zera o total.
- A paciente pode marcar ou corrigir até 7 dias para trás.

## Privacidade

A tabela de pacientes guarda apenas o nome ou apelido digitado pela psicóloga, a configuração e as marcações
diárias. Recomenda-se usar só o primeiro nome ou um apelido. Quem tiver o link da paciente consegue abrir o app
dela; se o link vazar, use *Gerar novo código* no painel.
