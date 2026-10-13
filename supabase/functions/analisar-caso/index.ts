// Apoio da IA da Formulação e do Prontuário: recebe o texto JÁ anonimizado montado no painel e devolve a
// resposta do Claude em texto corrido, aos pedaços (stream), para ir aparecendo na tela.
// Modo "consulta" (Consulta clínica, sem dados de paciente): o Claude procura na memória (consultas que ela
// marcou como confiáveis) e na Biblioteca de quem está logada (busca com o login dela, então vale o RLS),
// e pesquisa na internet; o stream leva, além do texto, quadros de controle "\u0000tipo:json\u0001"
// (busca, fim, fontes).
// Modos "recurso" (material para a sessão: ficha, psicoeducação, exercício) e "marketing" (conteúdo para o Instagram
// dela, dentro das regras de publicidade do CFP): mesmo stream com quadros de controle; o recurso também procura na
// Biblioteca. Os dois escrevem numa marcação simples (# título, ## seção, - item, ___ linha...) que o painel vira folha.
// A chave da Anthropic fica só aqui (secret ANTHROPIC_API_KEY), nunca no site.
// Secrets opcionais: ANTHROPIC_MODEL_CASO / _SESSAO / _CONSULTA / _RECURSO / _MARKETING (modelo de cada tarefa; padrões abaixo),
// IA_EMAILS (quem pode usar; vazio = qualquer login do painel, que já não aceita cadastro novo).
// Cada uso grava no log da função uma linha "uso" com tokens e custo estimado (sem nenhum texto).

// Opus no raciocínio diagnóstico (mais delicado, pouco usado); Sonnet (metade do preço, mais rápido) no resto
const PADRAO: Record<string, string> = {
  caso: "claude-opus-5-5", sessao: "claude-sonnet-5-5", consulta: "claude-sonnet-5-5", recurso: "claude-sonnet-5-5", marketing: "claude-sonnet-5-5",
};
// US$ por milhão de tokens [entrada, saída]; cache: escrita 1,25x e leitura 0,05x da entrada; busca US$ 0,01
const PRECOS: Record<string, [number, number]> = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10] };
const modeloDe = (modo: string, pedido?: unknown) =>
  typeof pedido === "string" && Object.hasOwn(PRECOS, pedido) ? pedido
    : Deno.env.get("ANTHROPIC_MODEL_" + modo.toUpperCase()) || PADRAO[modo];
const MAX_CHARS = 60000;
const FIM = "\u0000FIM:"; // marcador no fim do stream: "corte" (resposta cortada por tamanho) ou "erro"

const FORMATO = "A resposta será lida numa caixa de texto simples: não use markdown (nada de #, **, tabelas ou blocos de código). " +
  "Use títulos numerados em linha própria e itens começando com hífen.";
// caso = apoio ao raciocínio diagnóstico da formulação inteira; sessao = evolução de uma sessão para o prontuário
const MODOS: Record<string, { system: string; maxTokens: number }> = {
  caso: {
    system: "Você apoia uma psicóloga clínica no Brasil no raciocínio diagnóstico de casos de Terapia Cognitivo-Comportamental. " +
      "Siga as instruções que vêm junto com os dados do caso. " + FORMATO + " Seja objetivo, sem repetir os dados de volta.",
    maxTokens: 4000, // ~1 min de resposta: cabe com folga no limite de tempo da função
  },
  sessao: {
    system: "Você ajuda uma psicóloga clínica no Brasil a redigir registros de evolução para o prontuário psicológico. " +
      "Siga as instruções que vêm junto com as anotações da sessão. " + FORMATO,
    maxTokens: 1500,
  },
};

const CONSULTA_MAX_TOKENS = 3000;
const consultaSystem = () => [
  "Você é o assistente de consulta clínica de uma psicóloga no Brasil (Terapia Cognitivo-Comportamental e terapias baseadas em evidências). " +
  "Responda dúvidas clínicas e teóricas em português, com linguagem técnica e objetiva. Hoje é " + new Date().toISOString().slice(0, 10) + ".",
  "Antes de responder, use as fontes nesta ordem:\n" +
  "1. A ferramenta buscar_memoria: respostas de consultas anteriores que a própria psicóloga revisou e marcou como confiáveis, com a data e as fontes de cada uma. " +
  "Se uma delas já responde à pergunta e tem menos de 12 meses, aproveite-a (citando) e use a internet só para o que faltar ou para conferir novidades; " +
  "se tiver mais de 12 meses, confira na internet se algo mudou.\n" +
  "2. A ferramenta buscar_biblioteca, que procura nos livros e documentos que ela importou para a biblioteca pessoal. Faça de 1 a 3 buscas com palavras-chave em português " +
  "(termos técnicos, sinônimos e variações, por exemplo: ansiedade ansiosa ansioso).\n" +
  "3. A pesquisa na internet, para conferir e atualizar com a literatura atual. Prefira artigos revisados por pares (PubMed, SciELO, periódicos), " +
  "revisões sistemáticas e meta-análises (Cochrane), diretrizes (NICE, APA, OMS) e o Conselho Federal de Psicologia. Evite blogs, sites comerciais e redes sociais.",
  "Cruze as informações: diga quando a biblioteca, a memória e a literatura atual concordam, quando divergem e o que mudou recentemente. " +
  "Se não houver base suficiente, diga isso claramente em vez de supor. Não invente referências.",
  "É apoio ao raciocínio clínico: não faça diagnóstico de pessoas reais. Se a pergunta trouxer dados que identifiquem alguém, não os repita.",
  "Escreva tudo em português: quando a fonte estiver em inglês, traduza com suas palavras em vez de copiar trechos em inglês. " +
  "Não anuncie as buscas; escreva só a resposta, depois de pesquisar. " + FORMATO +
  " Seja direto (até cerca de 500 palavras, a não ser que a pergunta peça mais). Termine com o título \"Biblioteca × literatura atual\" e um resumo curto do cruzamento. " +
  "Não escreva lista de referências no final: as fontes citadas são listadas automaticamente.",
].join("\n\n");
const CONSULTA_TOOLS = [
  {
    name: "buscar_memoria",
    description: "Procura nas consultas anteriores que a psicóloga revisou e marcou como confiáveis. Busca por palavras em português; devolve até 4 " +
      "consultas com a data, a pergunta, a resposta e as fontes que ela usou.",
    input_schema: {
      type: "object",
      properties: { palavras: { type: "string", description: "Palavras-chave em português, por exemplo: exposição fobia social evidência" } },
      required: ["palavras"],
    },
  },
  {
    name: "buscar_biblioteca",
    description: "Procura páginas nos livros e documentos (PDF) que a psicóloga importou para a biblioteca pessoal. A busca é por palavras em português (qualquer uma das palavras conta; " +
      "páginas com mais palavras vêm primeiro) e devolve até 6 páginas com o título do material e o número da página.",
    input_schema: {
      type: "object",
      properties: { palavras: { type: "string", description: "Palavras-chave em português, por exemplo: reestruturação cognitiva fobia social exposição" } },
      required: ["palavras"],
    },
  },
  { type: "web_search_20250305", name: "web_search", max_uses: 4, user_location: { type: "approximate", country: "BR", timezone: "America/Sao_Paulo" } },
];

// marcação simples dos modos que criam material: o painel transforma em folha (e imprime)
const MARCACAO = "Escreva neste formato simples (o painel transforma em folha pronta); não use nenhum outro markdown:\n" +
  "# Título (só uma vez, na primeira linha)\n" +
  "## Título de seção\n" +
  "### Subtítulo\n" +
  "- item de lista\n" +
  "1. passo numerado\n" +
  "[ ] item para marcar\n" +
  "___ (sozinho na linha) = uma linha em branco para escrever; repita a linha para dar mais espaço\n" +
  "| Coluna | Coluna | = tabela: a primeira linha é o cabeçalho; linhas com as células vazias viram espaço para preencher\n" +
  "> texto = quadro de destaque (dica, lembrete)\n" +
  "**palavra** = negrito\n" +
  "Separe os parágrafos com uma linha em branco.";
const hoje = () => "Hoje é " + new Date().toISOString().slice(0, 10) + ".";
const recursoSystem = () => [
  "Você cria materiais terapêuticos para uma psicóloga clínica no Brasil (Terapia Cognitivo-Comportamental e terapias baseadas em evidências): " +
  "fichas de exercício, registros e diários, psicoeducação, roteiros de exercícios guiados, tarefas de casa, hierarquias de exposição, " +
  "cartões de enfrentamento e dinâmicas para sessão. " + hoje(),
  "Antes de escrever, use a ferramenta buscar_biblioteca (1 ou 2 buscas com palavras-chave em português) para basear o material nos livros e " +
  "documentos que ela importou; se achar algo útil, siga a abordagem e a terminologia desses materiais. Use a pesquisa na internet só se precisar " +
  "conferir a técnica, preferindo fontes científicas e diretrizes. Não invente referências.",
  "O material é para a paciente usar: linguagem clara e acolhedora, em segunda pessoa (você), frases curtas, sem jargão (ou com o termo explicado), " +
  "adaptado à faixa etária pedida. Inclua como preencher ou usar e um exemplo curto quando ajudar. Dê espaço para escrever proporcional ao que se pede. " +
  "Nunca inclua nomes ou dados de pacientes (se o pedido trouxer, não repita) e não faça diagnóstico.",
  "Tamanho: o material da paciente cabe em 1 ou 2 páginas impressas (cerca de 300 a 700 palavras, sem contar os espaços para escrever), " +
  "a não ser que o pedido peça mais; prefira poucas seções bem feitas a muitas. As notas para a psicóloga, em até cerca de 200 palavras.",
  "Depois do material, termine com a seção \"## Para a psicóloga\" (ela não vai impressa): objetivo terapêutico, como aplicar na sessão, cuidados e " +
  "adaptações, e em que o material se baseia (a biblioteca dela ou a literatura).",
  "Se o pedido trouxer um MATERIAL ATUAL e um AJUSTE PEDIDO, devolva o material inteiro já com o ajuste, no mesmo formato. " +
  "Escreva tudo em português e só o material, sem comentários antes ou depois.",
  MARCACAO,
].join("\n\n");
const marketingSystem = () => [
  "Você ajuda uma psicóloga clínica no Brasil a criar conteúdo para o Instagram dela: educativo, acolhedor e que aproxima as pessoas da psicoterapia. " + hoje(),
  "Siga o Código de Ética Profissional do Psicólogo (art. 20) e as orientações dos Conselhos de Psicologia sobre publicidade:\n" +
  "- conteúdo informativo e educativo sobre saúde mental, sem diagnosticar quem lê nem oferecer tratamento pela rede social;\n" +
  "- nada de prometer ou prever resultados (como \"cure sua ansiedade em 5 sessões\"), de sensacionalismo ou de explorar o sofrimento para vender;\n" +
  "- nada de preço, promoção ou desconto como propaganda;\n" +
  "- nada de depoimentos de pacientes, casos reais ou qualquer coisa que exponha ou permita identificar alguém atendido;\n" +
  "- não se comparar com outros profissionais nem desmerecê-los;\n" +
  "- citar só formações, títulos e abordagens que ela informar; não invente nada sobre ela;\n" +
  "- em suicídio e autolesão, não detalhe métodos e inclua o CVV (ligue 188) e o convite a procurar ajuda.",
  "Se vier uma assinatura (nome e CRP), use-a no fim da legenda; se não vier, escreva \"[Seu nome] · CRP [número]\" para ela completar " +
  "(a publicidade da psicóloga precisa ter nome e CRP).",
  "Formatos:\n" +
  "- Carrossel: uma seção \"## Slide N\" para cada slide (até 10, texto curto; o 1º é o gancho, o último é o convite com a assinatura), depois \"## Legenda\" e \"## Hashtags\".\n" +
  "- Post único: \"## Arte\" (texto curto da imagem), \"## Legenda\" e \"## Hashtags\".\n" +
  "- Reels: \"## Roteiro\" (com os tempos e o que aparece na tela), \"## Texto na tela\", \"## Legenda\" e \"## Hashtags\".\n" +
  "- Stories: uma seção \"## Story N\" para cada tela, com sugestão de enquete ou caixinha de perguntas quando couber.\n" +
  "- Ideias para o mês: uma seção \"## Semana N\" com 2 ou 3 ideias (formato e gancho de cada uma).",
  "Legenda com até cerca de 150 palavras, linguagem simples, parágrafos curtos, poucos emojis, terminando com um convite leve (salvar, compartilhar, " +
  "comentar ou agendar uma conversa), sem pressão. Hashtags: de 5 a 12, em português, misturando amplas e específicas.",
  "Comece com \"# \" e um título curto do conteúdo. Se o pedido trouxer um CONTEÚDO ATUAL e um AJUSTE PEDIDO, devolva o conteúdo inteiro já ajustado. " +
  "Escreva em português e só o conteúdo, sem comentários antes ou depois.",
  MARCACAO,
].join("\n\n");
const RECURSO_TOOLS = [
  CONSULTA_TOOLS[1],
  { type: "web_search_20250305", name: "web_search", max_uses: 2, user_location: { type: "approximate", country: "BR", timezone: "America/Sao_Paulo" } },
];
// tarefas que rodam em voltas (ferramentas) e devolvem o stream com quadros de controle
// marcar = põe " [n]" depois do trecho citado (na consulta); no material da paciente as fontes vão só na lista
// deno-lint-ignore no-explicit-any
type Agente = { system: () => string; tools: any[]; maxTokens: number; marcar: boolean; max: number };
const AGENTES: Record<string, Agente> = {
  consulta: { system: consultaSystem, tools: CONSULTA_TOOLS, maxTokens: CONSULTA_MAX_TOKENS, marcar: true, max: 4000 },
  recurso: { system: recursoSystem, tools: RECURSO_TOOLS, maxTokens: 6000, marcar: false, max: 20000 },
  marketing: { system: marketingSystem, tools: [], maxTokens: 2500, marcar: false, max: 20000 },
};

const ORIGENS = [
  "https://trilha-vert.vercel.app",
  "https://organizer-clinica.vercel.app",
  ...(Deno.env.get("IA_ORIGENS") || "").split(",").map((s) => s.trim()).filter(Boolean),
];
function cors(origin: string | null): Record<string, string> {
  const ok = origin && (ORIGENS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return ok
    ? {
      "Access-Control-Allow-Origin": origin!,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    }
    : { "Vary": "Origin" };
}
const json = (body: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...h, "content-type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ||
  JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default;

const enc = new TextEncoder();
const anthropic = (key: string, body: Record<string, unknown>, signal?: AbortSignal) =>
  fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });
async function erroDe(up: Response) {
  // só o começo do erro, sem o texto enviado
  const t = await up.text().catch(() => "");
  console.error("anthropic", up.status, t.slice(0, 300));
  return up.status === 401 || up.status === 403 ? "chave-invalida"
    : /credit|billing/i.test(t) ? "credito"
    : up.status === 429 || up.status === 529 ? "limite"
    : up.status === 400 && /web search/i.test(t) ? "busca-desligada"
    : "ia";
}
// consumo de um uso (todas as chamadas à API somadas); entrada = tokens fora do cache
type Uso = { chamadas: number; entrada: number; cacheGrava: number; cacheLe: number; saida: number; buscas: number };
const novoUso = (): Uso => ({ chamadas: 0, entrada: 0, cacheGrava: 0, cacheLe: 0, saida: 0, buscas: 0 });
// deno-lint-ignore no-explicit-any
function contar(u: Uso, m: any) {
  if (m.type === "message_start") {
    const x = m.message?.usage || {};
    u.chamadas++;
    u.entrada += x.input_tokens || 0;
    u.cacheGrava += x.cache_creation_input_tokens || 0;
    u.cacheLe += x.cache_read_input_tokens || 0;
  } else if (m.type === "message_delta" && m.usage) {
    u.saida += m.usage.output_tokens || 0;
    u.buscas += m.usage.server_tool_use?.web_search_requests || 0;
  }
}
function registrarUso(modo: string, modelo: string, u: Uso) {
  const [pe, ps] = PRECOS[modelo] || [0, 0];
  const usd = Math.round(((u.entrada * pe + u.cacheGrava * pe * 1.25 + u.cacheLe * pe * 0.05 + u.saida * ps) / 1e6 + u.buscas * 0.01) * 10000) / 10000;
  const r = { modo, modelo, ...u, usd };
  console.log("uso " + JSON.stringify(r));
  return r;
}
// cache: a cada volta a conversa inteira é reenviada; marcando o fim dela, o que se repete sai por 5% do preço
// deno-lint-ignore no-explicit-any
function marcarCache(messages: any[]) {
  for (const m of messages) if (Array.isArray(m.content)) for (const b of m.content) delete b.cache_control;
  const ult = messages[messages.length - 1];
  if (ult?.role === "user" && Array.isArray(ult.content) && ult.content.length) {
    ult.content[ult.content.length - 1].cache_control = { type: "ephemeral" };
  }
}

// lê o SSE da Anthropic e entrega cada mensagem já em JSON
// deno-lint-ignore no-explicit-any
async function eventos(body: ReadableStream<Uint8Array>, on: (m: any) => void) {
  const reader = body.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = ev.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data) continue;
      let m;
      try { m = JSON.parse(data); } catch (_) { continue; }
      on(m);
    }
  }
}
// devolve o stream de texto e mantém a função viva até ele terminar (senão o Supabase pode encerrar no meio)
function streamDe(work: (send: (s: string) => void) => Promise<void>, h: Record<string, string>) {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const w = writable.getWriter();
  const send = (s: string) => { w.write(enc.encode(s)).catch(() => {}); };
  const p = work(send)
    .catch((e) => { console.error("stream", String(e)); send(FIM + "erro"); })
    .finally(() => w.close().catch(() => {}));
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil?.(p);
  return new Response(readable, { headers: { ...h, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

type Fonte = {
  n: number; tipo: "web" | "biblioteca" | "memoria"; titulo: string;
  url?: string; doc?: string; pagina?: number; consulta?: string; data?: string;
  consultada?: boolean; // página da Biblioteca que a IA leu mas não citou
};
// o que cada resultado devolvido à IA representa, para montar a lista de fontes quando ela citar
type Origem = Omit<Fonte, "n">;
const dataBR = (iso: string) => { const d = String(iso).slice(0, 10).split("-"); return d.length === 3 ? d[2] + "/" + d[1] + "/" + d[0] : ""; };
// deno-lint-ignore no-explicit-any
const fontesTexto = (fs: any) => Array.isArray(fs) && fs.length
  ? "Fontes usadas nesta consulta: " + fs.map((f) => "[" + f.n + "] " + (f.tipo === "web" ? (f.titulo || "") + " — " + f.url
    : f.tipo === "biblioteca" ? "Biblioteca: " + f.titulo + (f.pagina ? ", p. " + f.pagina : "") : "Memória: " + f.titulo)).join("; ")
  : "Esta consulta não tinha fontes citadas.";
async function rpc(fn: string, auth: string, args: Record<string, unknown>) {
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { authorization: auth, apikey: ANON, "content-type": "application/json" },
      body: JSON.stringify(args),
    });
    if (r.ok) { const j = await r.json(); return Array.isArray(j) ? j : null; }
    console.error(fn, r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.error(fn, String(e)); }
  return null;
}
// ferramentas nossas: biblioteca (páginas dos documentos importados) e memória (consultas confiáveis),
// sempre com o login dela, então o RLS vale
// deno-lint-ignore no-explicit-any
async function rodarFerramenta(b: any, auth: string, origens: Map<string, Origem>) {
  const r0 = { type: "tool_result", tool_use_id: b.id };
  const palavras = String(b.input?.palavras || "").slice(0, 500);
  if (b.name === "buscar_biblioteca") {
    const rows = await rpc("library_search", auth, { q: palavras, n: 6 });
    if (!rows) return { ...r0, content: "A busca na biblioteca falhou agora. Siga com as outras fontes e avise isso na resposta.", is_error: true };
    if (!rows.length) return { ...r0, content: "Nada encontrado na biblioteca com essas palavras. Tente outras (sinônimos, termos técnicos) ou siga com a internet." };
    return {
      ...r0,
      content: rows.map((x) => {
        const source = "biblioteca:" + x.doc_id + "#p" + x.page;
        origens.set(source, { tipo: "biblioteca", titulo: x.title, doc: x.doc_id, pagina: x.page });
        return {
          type: "search_result", source, title: x.title + " — p. " + x.page,
          content: [{ type: "text", text: String(x.text).slice(0, 6000) }], citations: { enabled: true },
        };
      }),
    };
  }
  if (b.name === "buscar_memoria") {
    const rows = await rpc("memoria_search", auth, { q: palavras, n: 4 });
    if (!rows) return { ...r0, content: "A busca na memória falhou agora. Siga com as outras fontes.", is_error: true };
    if (!rows.length) return { ...r0, content: "Nenhuma consulta confiável anterior sobre isso. Siga com a biblioteca e a internet." };
    return {
      ...r0,
      content: rows.map((x) => {
        const source = "memoria:" + x.id, data = dataBR(x.created_at);
        origens.set(source, { tipo: "memoria", titulo: x.pergunta, consulta: x.id, data });
        return {
          type: "search_result", source, title: "Consulta confiável de " + data + ": " + x.pergunta,
          content: [{ type: "text", text: String(x.resposta).slice(0, 8000) }, { type: "text", text: fontesTexto(x.fontes) }],
          citations: { enabled: true },
        };
      }),
    };
  }
  return { ...r0, content: "Ferramenta desconhecida.", is_error: true };
}
// uma resposta da API (pode parar no meio para usar a biblioteca): repassa o texto, avisa as buscas,
// numera as fontes citadas e devolve os blocos para continuar a conversa
async function lerResposta(
  body: ReadableStream<Uint8Array>,
  send: (s: string) => void,
  ctl: (t: string, d: unknown) => void,
  // deno-lint-ignore no-explicit-any
  registrar: (c: any) => number,
  uso: Uso,
  marcar = true,
) {
  // deno-lint-ignore no-explicit-any
  const blocos: any[] = [];
  let stop: string | null = null;
  await eventos(body, (m) => {
    contar(uso, m);
    if (m.type === "content_block_start") {
      const b = { ...m.content_block };
      if (b.type === "tool_use" || b.type === "server_tool_use") b._json = "";
      blocos[m.index] = b;
    } else if (m.type === "content_block_delta") {
      const b = blocos[m.index], d = m.delta;
      if (!b || !d) return;
      if (d.type === "text_delta") { b.text = (b.text || "") + d.text; send(d.text); }
      else if (d.type === "input_json_delta") b._json += d.partial_json;
      else if (d.type === "citations_delta") (b.citations ||= []).push(d.citation);
      // o raciocínio do modelo (thinking) precisa voltar inteiro, com a assinatura, na próxima volta
      else if (d.type === "thinking_delta") b.thinking = (b.thinking || "") + d.thinking;
      else if (d.type === "signature_delta") b.signature = (b.signature || "") + d.signature;
    } else if (m.type === "content_block_stop") {
      const b = blocos[m.index];
      if (!b) return;
      if (b._json !== undefined) {
        try { b.input = b._json ? JSON.parse(b._json) : (b.input || {}); } catch (_) { b.input = {}; }
        delete b._json;
        if (b.type === "server_tool_use" && b.name === "web_search") ctl("busca", { onde: "web", q: String(b.input.query || "") });
        if (b.type === "tool_use") ctl("busca", { onde: b.name === "buscar_memoria" ? "memoria" : "biblioteca", q: String(b.input.palavras || "") });
      }
      if (b.type === "text") {
        if (Array.isArray(b.citations) && b.citations.length) {
          const ns = [...new Set(b.citations.map(registrar).filter((n: number) => n > 0))];
          if (ns.length && marcar) send(" [" + ns.join(", ") + "]");
        } else delete b.citations;
      }
    } else if (m.type === "message_delta") {
      if (m.delta?.stop_reason) stop = m.delta.stop_reason;
    } else if (m.type === "error") {
      throw new Error("anthropic stream " + JSON.stringify(m.error || {}).slice(0, 200));
    }
  });
  return { content: blocos.filter(Boolean), stop };
}

async function agente(nome: string, pergunta: string, auth: string, key: string, modelo: string, h: Record<string, string>) {
  const cfg = AGENTES[nome];
  const t0 = Date.now();
  const ac = new AbortController();
  // o Supabase gratuito encerra a função em 150 s: perto disso para de pesquisar e, no limite, corta
  const timer = setTimeout(() => ac.abort(), 135000);
  // deno-lint-ignore no-explicit-any
  const messages: any[] = [{ role: "user", content: [{ type: "text", text: pergunta }] }];
  const system = [{ type: "text", text: cfg.system(), cache_control: { type: "ephemeral" } }];
  const uso = novoUso();
  const pedir = (semFerramentas: boolean) => {
    marcarCache(messages);
    return anthropic(key, {
      model: modelo, max_tokens: cfg.maxTokens, system, messages,
      ...(cfg.tools.length ? { tools: cfg.tools } : {}),
      ...(cfg.tools.length && semFerramentas ? { tool_choice: { type: "none" } } : {}),
    }, ac.signal);
  };
  let up: Response;
  try { up = await pedir(false); } catch (e) {
    clearTimeout(timer);
    console.error("anthropic fetch", String(e));
    return json({ erro: "ia" }, 502, h);
  }
  if (!up.ok || !up.body) { clearTimeout(timer); return json({ erro: await erroDe(up), status: up.status }, 502, h); }

  const fontes: Fonte[] = [], porChave = new Map<string, number>(), origens = new Map<string, Origem>();
  // deno-lint-ignore no-explicit-any
  const registrar = (c: any) => {
    let k: string, f: Origem;
    if (c?.type === "web_search_result_location" && c.url) { k = c.url; f = { tipo: "web", titulo: String(c.title || c.url), url: c.url }; }
    else if (c?.type === "search_result_location" && c.source) {
      k = c.source;
      f = origens.get(c.source) ||
        { tipo: String(c.source).startsWith("memoria:") ? "memoria" : "biblioteca", titulo: String(c.title || "Biblioteca") };
    } else return 0;
    if (!porChave.has(k)) { fontes.push({ n: fontes.length + 1, ...f }); porChave.set(k, fontes.length); }
    return porChave.get(k)!;
  };
  return streamDe(async (send) => {
    const ctl = (t: string, d: unknown) => send("\u0000" + t + ":" + JSON.stringify(d) + "\u0001");
    try {
      for (let volta = 1; ; volta++) {
        const { content, stop } = await lerResposta(up.body!, send, ctl, registrar, uso, cfg.marcar);
        messages.push({ role: "assistant", content });
        if (stop === "tool_use") {
          const res = [];
          for (const b of content) if (b.type === "tool_use") res.push(await rodarFerramenta(b, auth, origens));
          messages.push({ role: "user", content: res });
        } else if (stop !== "pause_turn") {
          if (stop === "max_tokens") ctl("fim", "corte");
          break;
        }
        if (volta >= 6) { ctl("fim", "erro"); break; }
        // depois de algumas voltas ou perto do limite de tempo: responde com o que já achou
        up = await pedir(volta >= 4 || Date.now() - t0 > 80000);
        if (!up.ok || !up.body) { ctl("fim", await erroDe(up)); break; }
      }
    } catch (e) {
      console.error(nome, String(e));
      ctl("fim", ac.signal.aborted ? "tempo" : "erro");
    }
    clearTimeout(timer);
    // no material da paciente a IA nem sempre cita: lista também as primeiras páginas da Biblioteca que ela leu
    if (!cfg.marcar) {
      let n = 0;
      for (const [k, o] of origens) {
        if (n >= 4) break;
        if (o.tipo === "biblioteca" && !porChave.has(k)) { fontes.push({ n: fontes.length + 1, ...o, consultada: true }); porChave.set(k, fontes.length); n++; }
      }
    }
    ctl("fontes", fontes);
    const r = registrarUso(nome, modelo, uso);
    ctl("uso", { modelo, usd: r.usd, segundos: Math.round((Date.now() - t0) / 1000) });
  }, h);
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405, h);

  // só quem está logada no painel (a chave anon também é um JWT válido, por isso confere o usuário)
  const auth = req.headers.get("authorization") || "";
  const u = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { authorization: auth, apikey: ANON } });
  if (!u.ok) return json({ erro: "login" }, 401, h);
  const user = await u.json();
  // aceita os e-mails separados por vírgula, ponto e vírgula, espaço ou linha, com ou sem aspas
  const permitidos = (Deno.env.get("IA_EMAILS") || "").split(/[\s,;]+/)
    .map((s) => s.replace(/^["'<]+|[">']+$/g, "").trim().toLowerCase()).filter(Boolean);
  if (permitidos.length && !permitidos.includes(String(user.email || "").toLowerCase())) {
    return json({ erro: "permissao" }, 403, h);
  }

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ erro: "sem-chave" }, 503, h);

  let texto = "", nome = "caso", pedido: unknown;
  try {
    const b = await req.json();
    texto = typeof b?.texto === "string" ? b.texto.trim() : "";
    if (typeof b?.modo === "string" && (Object.hasOwn(AGENTES, b.modo) || Object.hasOwn(MODOS, b.modo))) nome = b.modo;
    pedido = b?.modelo; // só vale um dos modelos da tabela de preços (comparação entre modelos)
  } catch (_) { /* corpo inválido: cai no tamanho abaixo */ }
  const modelo = modeloDe(nome, pedido);
  if (Object.hasOwn(AGENTES, nome)) {
    if (texto.length < 10 || texto.length > AGENTES[nome].max) return json({ erro: "tamanho" }, 400, h);
    return agente(nome, texto, auth, key, modelo, h);
  }
  const modo = MODOS[nome];
  if (texto.length < 50 || texto.length > MAX_CHARS) return json({ erro: "tamanho" }, 400, h);

  let up: Response;
  try {
    up = await anthropic(key, { model: modelo, max_tokens: modo.maxTokens, system: modo.system, messages: [{ role: "user", content: texto }] });
  } catch (e) {
    console.error("anthropic fetch", String(e));
    return json({ erro: "ia" }, 502, h);
  }
  if (!up.ok || !up.body) return json({ erro: await erroDe(up), status: up.status }, 502, h);

  // SSE da Anthropic -> texto puro, pedaço a pedaço
  const uso = novoUso();
  return streamDe(async (send) => {
    await eventos(up.body!, (m) => {
      contar(uso, m);
      if (m.type === "content_block_delta" && m.delta?.type === "text_delta") send(m.delta.text);
      else if (m.type === "message_delta" && m.delta?.stop_reason === "max_tokens") send(FIM + "corte");
      else if (m.type === "error") {
        console.error("anthropic stream", JSON.stringify(m.error || {}).slice(0, 300));
        send(FIM + "erro");
      }
    });
    registrarUso(nome, modelo, uso);
  }, h);
});
