// Apoio da IA da Formulação: recebe o texto JÁ anonimizado montado no painel e devolve a
// análise do Claude em texto corrido, aos pedaços (stream), para ir aparecendo na tela.
// A chave da Anthropic fica só aqui (secret ANTHROPIC_API_KEY), nunca no site.
// Secrets opcionais: ANTHROPIC_MODEL (padrão abaixo), IA_EMAILS (lista separada por vírgula
// de quem pode usar; vazio = qualquer login do painel, que já não aceita cadastro novo).

const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-5-5";
const MAX_TOKENS = 4000; // ~1 min de resposta: cabe com folga no limite de tempo da função
const MAX_CHARS = 60000;
const FIM = "\u0000FIM:"; // marcador no fim do stream: "corte" (resposta cortada por tamanho) ou "erro"

const SYSTEM = [
  "Você apoia uma psicóloga clínica no Brasil no raciocínio diagnóstico de casos de Terapia Cognitivo-Comportamental.",
  "Siga as instruções que vêm junto com os dados do caso.",
  "A resposta será lida numa caixa de texto simples: não use markdown (nada de #, **, tabelas ou blocos de código).",
  "Use títulos numerados em linha própria e itens começando com hífen. Seja objetivo, sem repetir os dados de volta.",
].join(" ");

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

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405, h);

  // só quem está logada no painel (a chave anon também é um JWT válido, por isso confere o usuário)
  const auth = req.headers.get("authorization") || "";
  const u = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { authorization: auth, apikey: ANON } });
  if (!u.ok) return json({ erro: "login" }, 401, h);
  const user = await u.json();
  const permitidos = (Deno.env.get("IA_EMAILS") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (permitidos.length && !permitidos.includes(String(user.email || "").toLowerCase())) {
    return json({ erro: "permissao" }, 403, h);
  }

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ erro: "sem-chave" }, 503, h);

  let texto = "";
  try {
    const b = await req.json();
    texto = typeof b?.texto === "string" ? b.texto.trim() : "";
  } catch (_) { /* corpo inválido: cai no tamanho abaixo */ }
  if (texto.length < 50 || texto.length > MAX_CHARS) return json({ erro: "tamanho" }, 400, h);

  let up: Response;
  try {
    up = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        stream: true,
        messages: [{ role: "user", content: texto }],
      }),
    });
  } catch (e) {
    console.error("anthropic fetch", String(e));
    return json({ erro: "ia" }, 502, h);
  }
  if (!up.ok || !up.body) {
    // só o começo do erro, sem o texto do caso
    const t = await up.text().catch(() => "");
    console.error("anthropic", up.status, t.slice(0, 300));
    const erro = up.status === 401 || up.status === 403 ? "chave-invalida"
      : /credit|billing/i.test(t) ? "credito"
      : up.status === 429 || up.status === 529 ? "limite"
      : "ia";
    return json({ erro, status: up.status }, 502, h);
  }

  // SSE da Anthropic -> texto puro, pedaço a pedaço
  const reader = up.body.getReader();
  const enc = new TextEncoder(), dec = new TextDecoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      let buf = "";
      try {
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
            if (m.type === "content_block_delta" && m.delta?.type === "text_delta") ctrl.enqueue(enc.encode(m.delta.text));
            else if (m.type === "message_delta" && m.delta?.stop_reason === "max_tokens") ctrl.enqueue(enc.encode(FIM + "corte"));
            else if (m.type === "error") {
              console.error("anthropic stream", JSON.stringify(m.error || {}).slice(0, 300));
              ctrl.enqueue(enc.encode(FIM + "erro"));
            }
          }
        }
      } catch (e) {
        console.error("stream", String(e));
        ctrl.enqueue(enc.encode(FIM + "erro"));
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { ...h, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
});
