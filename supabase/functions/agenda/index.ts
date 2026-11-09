// Agenda <-> Google Agenda, nos dois sentidos, sem login no Google.
//
// GET  ?t=CODIGO  -> as sessões da psicóloga em formato iCalendar (.ics), para o Google Agenda assinar ("Do URL").
//                    Sem login (o Google não manda): o código secreto da conta é a chave. Os dados vêm da função
//                    agenda_feed do banco, que só entrega a agenda de quem tem aquele código.
// POST (logada)   -> lê o "endereço secreto no formato iCal" da agenda dela no Google (guardado em agenda_config) e
//                    devolve o texto do .ics, porque o navegador não consegue ler o Google direto (CORS).
//
// Publicar com verify_jwt desligado: a assinatura do Google chega sem JWT. O POST confere o login aqui dentro.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const TZ = "America/Sao_Paulo";
const MAX_GOOGLE = 3 * 1024 * 1024; // .ics do Google acima disso fica de fora

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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Vary": "Origin",
    }
    : { "Vary": "Origin" };
}
const json = (body: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...h, "content-type": "application/json" } });

/* ---------- .ics das sessões ---------- */
type Horario = { id: string; nome: string; frequencia: string; inicio: string; hora: string | null };
type Excecao = { id: string; patient_id: string; nome: string; data: string; tipo: string; hora: string | null };

// texto do iCalendar: escapa \ ; , e quebra de linha
const txt = (s: string) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// linhas de no máximo 75 bytes, continuação começando com espaço
function dobra(linha: string): string {
  const enc = new TextEncoder(), out: string[] = [];
  let cur = "", n = 0;
  for (const ch of linha) {
    const b = enc.encode(ch).length;
    if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; n = 0; }
    cur += ch; n += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}
const dia = (d: string) => d.replace(/-/g, "");
const hhmm = (h: string | null) => (h || "").slice(0, 5);
// data e hora locais (São Paulo) somando minutos, sem depender do fuso do servidor
function local(d: string, h: string, mais = 0): string {
  const [a, m, di] = d.split("-").map(Number), [hh, mm] = h.split(":").map(Number);
  const t = new Date(Date.UTC(a, m - 1, di, hh, mm + mais));
  const p = (x: number) => String(x).padStart(2, "0");
  return t.getUTCFullYear() + p(t.getUTCMonth() + 1) + p(t.getUTCDate()) + "T" + p(t.getUTCHours()) + p(t.getUTCMinutes()) + "00";
}
const diaSeguinte = (d: string) => { const [a, m, di] = d.split("-").map(Number); return new Date(Date.UTC(a, m - 1, di + 1)).toISOString().slice(0, 10); };

export function montarIcs(dados: { duracao: number; horarios: Horario[]; excecoes: Excecao[] }, agora = new Date()): string {
  const stamp = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const dur = Math.min(240, Math.max(10, Number(dados.duracao) || 50));
  const L: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Organizer Clinica//Agenda//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Sessões (Organizer Clinica)", "X-WR-TIMEZONE:" + TZ, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
    // o Brasil não tem horário de verão desde 2019: um fuso fixo de -3h
    "BEGIN:VTIMEZONE", "TZID:" + TZ, "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:-0300", "TZOFFSETTO:-0300", "TZNAME:-03", "END:STANDARD", "END:VTIMEZONE"];
  const quando = (d: string, h: string | null, fim: boolean) => h
    ? "DT" + (fim ? "END" : "START") + ";TZID=" + TZ + ":" + local(d, hhmm(h), fim ? dur : 0)
    : "DT" + (fim ? "END" : "START") + ";VALUE=DATE:" + dia(fim ? diaSeguinte(d) : d);
  for (const h of dados.horarios || []) {
    const desm = (dados.excecoes || []).filter((e) => e.patient_id === h.id && e.tipo === "desmarcada");
    L.push("BEGIN:VEVENT", "UID:sessao-" + h.id + "@organizer-clinica", "DTSTAMP:" + stamp, "SUMMARY:" + txt(h.nome),
      quando(h.inicio, h.hora, false), quando(h.inicio, h.hora, true),
      "RRULE:FREQ=WEEKLY;INTERVAL=" + (h.frequencia === "quinzenal" ? 2 : 1));
    if (desm.length) L.push(h.hora ? "EXDATE;TZID=" + TZ + ":" + desm.map((e) => local(e.data, hhmm(h.hora))).join(",") : "EXDATE;VALUE=DATE:" + desm.map((e) => dia(e.data)).join(","));
    L.push("END:VEVENT");
  }
  for (const e of (dados.excecoes || []).filter((x) => x.tipo === "extra")) {
    L.push("BEGIN:VEVENT", "UID:extra-" + e.id + "@organizer-clinica", "DTSTAMP:" + stamp, "SUMMARY:" + txt(e.nome + " (sessão extra)"),
      quando(e.data, e.hora, false), quando(e.data, e.hora, true), "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(dobra).join("\r\n") + "\r\n";
}

/* ---------- endereço do Google: só o formato do "endereço secreto iCal" ---------- */
export const googleOk = (u: string) => /^https:\/\/calendar\.google\.com\/calendar\/ical\/[^\s/]+\/[^\s/]+\/basic\.ics$/.test(String(u || ""));

Deno.serve(async (req: Request) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

  if (req.method === "GET") {
    const t = new URL(req.url).searchParams.get("t") || "";
    if (!/^[A-Za-z0-9]{24,64}$/.test(t)) return new Response("link inválido", { status: 404 });
    const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/agenda_feed", {
      method: "POST",
      headers: { authorization: "Bearer " + ANON, apikey: ANON, "content-type": "application/json" },
      body: JSON.stringify({ p_token: t }),
    }).catch(() => null);
    if (!r || !r.ok) return new Response("indisponível", { status: 503 });
    const dados = await r.json();
    if (!dados) return new Response("link inválido ou desligado", { status: 404 });
    return new Response(montarIcs(dados), {
      status: 200,
      headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store", "content-disposition": "inline; filename=sessoes.ics" },
    });
  }

  if (req.method !== "POST") return new Response(null, { status: 405, headers: h });
  // só quem está logada no painel (a chave anon também é um JWT válido, por isso confere o usuário)
  const auth = req.headers.get("authorization") || "";
  const u = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { authorization: auth, apikey: ANON } }).catch(() => null);
  if (!u || !u.ok) return json({ erro: "login" }, 401, h);
  // o endereço vem do banco, com o login dela (RLS): ninguém lê o Google de outra conta
  const c = await fetch(SUPABASE_URL + "/rest/v1/agenda_config?select=google_url", { headers: { authorization: auth, apikey: ANON } }).catch(() => null);
  const linha = c && c.ok ? (await c.json())[0] : null;
  const url = linha && linha.google_url;
  if (!url) return json({ erro: "sem-endereco" }, 404, h);
  if (!googleOk(url)) return json({ erro: "endereco" }, 400, h);
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const g = await fetch(url, { signal: ctl.signal });
    // segue redirecionamento só se continuar no Google
    if (g.url && !/^https:\/\/([a-z0-9-]+\.)*(google\.com|googleusercontent\.com)\//.test(g.url)) return json({ erro: "google" }, 502, h);
    if (!g.ok) return json({ erro: g.status === 404 ? "google-404" : "google" }, 502, h);
    const corpo = await g.text();
    if (corpo.length > MAX_GOOGLE) return json({ erro: "grande" }, 502, h);
    if (!corpo.startsWith("BEGIN:VCALENDAR")) return json({ erro: "google" }, 502, h);
    return new Response(corpo, { status: 200, headers: { ...h, "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" } });
  } catch (_) {
    return json({ erro: "google" }, 502, h);
  } finally {
    clearTimeout(timer);
  }
});
