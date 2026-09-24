# Trilha de Reforçadores

App (PWA) de economia de fichas para acompanhar exposições da hierarquia SUDS.

- **Paciente** (`index.html`): abre um link com um código secreto, sem criar conta, e instala o app na tela inicial.
  Cada atividade feita no dia vale 1 ponto. Quando falta pouco para um reforçador, o app avisa: faltando 5 pontos
  para reforçadores de até 99 pontos, e faltando 10 para os de 100 ou mais. Ao alcançar um reforçador, aparece
  uma comemoração (confete, balões ou fogos). Marcações feitas sem internet ficam guardadas e são enviadas depois.
- **Psicóloga** (`admin.html`): entra com e-mail e senha, cadastra pacientes, edita reforçadores e atividades,
  vê os pontos e o histórico, faz ajustes manuais e gera o link ou QR code de acesso.

Os dados ficam no [Supabase](https://supabase.com) (plano gratuito). O site é estático e pode ser hospedado
no GitHub Pages.

## Estrutura

```
supabase/schema.sql   tabelas, regras de acesso (RLS) e funções usadas pelo app da paciente
web/                  site estático (o que vai para o GitHub Pages)
  index.html, patient.js   app da paciente
  admin.html, admin.js     painel da psicóloga
  core.js, app.css         regras de pontuação, telas e comemorações compartilhadas
  sw.js, manifest.webmanifest, icons/   PWA (instalação e uso sem internet)
  config.js                URL e chave pública do Supabase
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
6. **Publicar**: publique a pasta `web/` no GitHub Pages (veja abaixo).

## Publicar no GitHub Pages

O workflow em `.github/workflows/pages.yml` publica a pasta `web/` a cada push na branch `main`.
No repositório, em *Settings → Pages*, escolha *Source: GitHub Actions*.

- Painel da psicóloga: `https://<usuario>.github.io/<repo>/admin.html`
- A paciente recebe o link gerado no painel: `https://<usuario>.github.io/<repo>/?p=CODIGO`

## Uso

- **Psicóloga**: *+ Paciente* → cadastrar reforçadores e atividades (o botão *Colar lista* aceita colunas
  copiadas do Excel) → *Link de acesso* → enviar o link ou mostrar o QR code.
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
