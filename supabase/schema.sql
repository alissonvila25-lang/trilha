-- Trilha de Reforçadores: esquema do Supabase.
-- Rode este arquivo inteiro no SQL Editor do projeto (uma vez).
--
-- Modelo de acesso:
--   * A psicóloga faz login (Supabase Auth) e só enxerga os pacientes dela (RLS).
--   * A paciente não tem conta: o app dela chama as funções patient_* com o
--     código secreto do link. As tabelas ficam fechadas para o papel anônimo.

create table if not exists public.patients (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  token       text not null unique,
  config      jsonb not null default '{}'::jsonb,
  point_offset integer not null default 0,
  -- quantas vezes cada reforçador já foi comemorado: {"r1": 2, "r2": 1}. Reforçador é reusável —
  -- a cada N pontos (N = o custo dele) ela ganha de novo, tipo ficha trocada por prêmio repetidas
  -- vezes, não um troféu de uma vez só.
  celebrated  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
-- idempotente: converte instalações antigas, onde "celebrated" era uma lista de ids (uma vez cada)
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='patients'
               and column_name='celebrated' and data_type='ARRAY') then
    alter table public.patients add column celebrated_novo jsonb not null default '{}'::jsonb;
    update public.patients
       set celebrated_novo = coalesce((select jsonb_object_agg(x, 1) from unnest(celebrated) x), '{}'::jsonb);
    alter table public.patients drop column celebrated;
    alter table public.patients rename column celebrated_novo to celebrated;
  end if;
end $$;

create table if not exists public.days (
  patient_id uuid not null references public.patients (id) on delete cascade,
  day        date not null,
  done       text[] not null default '{}',
  -- como cada atividade feita naquele dia realmente foi, na escala de Realidade da planilha
  -- (0/25/50/75/100), por id de atividade: {"a01": 75, "a06": 25}. Compare com o SUDS previsto
  -- da atividade (em config.activities) para acompanhar a ansiedade caindo com a exposição.
  realidade  jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (patient_id, day)
);
-- idempotente: adiciona a coluna em bancos que já tinham a tabela antes dela existir
alter table public.days add column if not exists realidade jsonb not null default '{}'::jsonb;

-- Formulação de caso (anamnese, linha da vida, valores, conceitualização, plano...). Tabela separada
-- de propósito: patients.config é entregue ao app da paciente por patient_state, e isto aqui é
-- prontuário — só a psicóloga dona da paciente lê ou escreve, e não existe função para o link dela.
create table if not exists public.case_notes (
  patient_id uuid primary key references public.patients (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 1000000),
  updated_at timestamptz not null default now()
);
alter table public.case_notes enable row level security;
drop policy if exists "dona gerencia formulacao" on public.case_notes;
create policy "dona gerencia formulacao" on public.case_notes
  for all to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.owner = auth.uid()))
  with check (exists (select 1 from public.patients p where p.id = patient_id and p.owner = auth.uid()));
-- o Supabase dá acesso a anon em tabelas novas; a RLS já barraria, mas prontuário fica fechado duas vezes
revoke all on public.case_notes from anon;

-- Código do link: 12 caracteres sem letras ambíguas (sem I, L, O, 0, 1).
create or replace function public.new_patient_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
           substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                  1 + (get_byte(b, i) % 31), 1), '')
  from (select extensions.gen_random_bytes(12) as b) r,
       generate_series(0, 11) as i;
$$;

alter table public.patients alter column token set default public.new_patient_token();

-- RLS: a psicóloga vê e altera apenas os próprios pacientes.
alter table public.patients enable row level security;
alter table public.days enable row level security;

drop policy if exists "dona gerencia pacientes" on public.patients;
create policy "dona gerencia pacientes" on public.patients
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists "dona gerencia dias" on public.days;
create policy "dona gerencia dias" on public.days
  for all to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.owner = auth.uid()))
  with check (exists (select 1 from public.patients p where p.id = patient_id and p.owner = auth.uid()));

-- ---------- Funções usadas pelo app da paciente (sem login) ----------

create or replace function public.patient_state(p_token text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'name', p.name,
    'config', p.config,
    'offset', p.point_offset,
    'celebrated', p.celebrated,
    'days', coalesce((select json_object_agg(d.day::text, d.done)
                      from public.days d where d.patient_id = p.id), '{}'::json),
    'realidade', coalesce((select json_object_agg(d.day::text, d.realidade)
                      from public.days d where d.patient_id = p.id), '{}'::json)
  )
  from public.patients p
  where p.token = upper(p_token);
$$;

-- a assinatura ganhou um parâmetro (p_realidade); troca de tipos não é "replace" no Postgres, então
-- a função de 3 parâmetros precisa ser removida explicitamente, ou fica duplicada (e o PostgREST
-- não sabe qual das duas chamar).
drop function if exists public.patient_set_day(text, date, text[]);
create or replace function public.patient_set_day(p_token text, p_day date, p_done text[], p_realidade jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_realidade jsonb := coalesce(p_realidade, '{}'::jsonb);
  v_val jsonb;
begin
  select id into v_id from public.patients where token = upper(p_token);
  if v_id is null then
    return false;
  end if;
  -- a paciente só registra de 7 dias atrás até hoje (1 dia de folga para fuso)
  if p_day < v_today - 8 or p_day > v_today + 1 then
    raise exception 'dia fora do intervalo permitido';
  end if;
  if coalesce(array_length(p_done, 1), 0) > 200 then
    raise exception 'lista grande demais';
  end if;
  if jsonb_typeof(v_realidade) <> 'object' then
    raise exception 'realidade deve ser um objeto';
  end if;
  if (select count(*) from jsonb_each(v_realidade)) > 200 then
    raise exception 'realidade grande demais';
  end if;
  -- só aceita os 5 valores da escala de Realidade da planilha (0/25/50/75/100)
  for v_val in select value from jsonb_each(v_realidade) loop
    if jsonb_typeof(v_val) <> 'number' or (v_val::text)::numeric not in (0,25,50,75,100) then
      raise exception 'valor de realidade inválido';
    end if;
  end loop;
  insert into public.days (patient_id, day, done, realidade, updated_at)
  values (v_id, p_day, coalesce(p_done, '{}'), v_realidade, now())
  on conflict (patient_id, day)
  do update set done = excluded.done, realidade = excluded.realidade, updated_at = now();
  return true;
end;
$$;

-- Substitui a lista inteira de "quantas vezes cada reforçador já comemorou". O app manda sempre o
-- objeto inteiro e já recalculado (comemorar mais, ou uma correção que baixa o total e tira algumas
-- vezes de volta) — mais simples e não tem como o banco e o app discordarem de quem soma o quê.
drop function if exists public.patient_mark_celebrated(text, text[]);
drop function if exists public.patient_prune_celebrated(text, text[]);
create or replace function public.patient_set_celebrated(p_token text, p_celebrated jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebrated jsonb := coalesce(p_celebrated, '{}'::jsonb);
  v_val jsonb;
begin
  if jsonb_typeof(v_celebrated) <> 'object' then
    raise exception 'celebrated deve ser um objeto';
  end if;
  if (select count(*) from jsonb_each(v_celebrated)) > 200 then
    raise exception 'celebrated grande demais';
  end if;
  -- cada valor é quantas vezes esse reforçador já comemorou: inteiro, 0 ou mais
  for v_val in select value from jsonb_each(v_celebrated) loop
    if jsonb_typeof(v_val) <> 'number' or (v_val::text)::numeric < 0
       or (v_val::text)::numeric <> floor((v_val::text)::numeric) or (v_val::text)::numeric > 100000 then
      raise exception 'valor de celebrated inválido';
    end if;
  end loop;
  update public.patients set celebrated = v_celebrated where token = upper(p_token);
  return found;
end;
$$;

-- Anamnese que a paciente preenche pelo link (anamnese.html?p=CODIGO). Cada envio fica guardado aqui
-- e o painel leva as respostas para a ficha (case_notes) quando a psicóloga abre a Formulação. Não
-- escreve direto em case_notes de propósito: o painel salva a ficha inteira de uma vez e apagaria um
-- envio que chegasse enquanto ela estivesse com a ficha aberta. A paciente só envia; nunca lê nada daqui.
create table if not exists public.anamnese_envios (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  data        jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 200000),
  created_at  timestamptz not null default now(),
  aplicado_em timestamptz
);
create index if not exists anamnese_envios_patient on public.anamnese_envios (patient_id, created_at);
alter table public.anamnese_envios enable row level security;
drop policy if exists "dona gerencia envios de anamnese" on public.anamnese_envios;
create policy "dona gerencia envios de anamnese" on public.anamnese_envios
  for all to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.owner = auth.uid()))
  with check (exists (select 1 from public.patients p where p.id = patient_id and p.owner = auth.uid()));
revoke all on public.anamnese_envios from anon;

create or replace function public.patient_send_anamnese(p_token text, p_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_key text;
  v_val jsonb;
begin
  select id into v_id from public.patients where token = upper(p_token);
  if v_id is null then
    return false;
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'anamnese deve ser um objeto';
  end if;
  if (select count(*) from jsonb_each(p_data)) > 80 then
    raise exception 'anamnese grande demais';
  end if;
  for v_key, v_val in select key, value from jsonb_each(p_data) loop
    if v_key !~ '^[a-z0-9_]{1,40}$' or jsonb_typeof(v_val) <> 'string' or char_length(v_val #>> '{}') > 8000 then
      raise exception 'campo de anamnese inválido';
    end if;
  end loop;
  -- um link vazado não vira jeito de encher o banco
  if (select count(*) from public.anamnese_envios
      where patient_id = v_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'muitos envios hoje';
  end if;
  insert into public.anamnese_envios (patient_id, data) values (v_id, p_data);
  return true;
end;
$$;

revoke all on function public.patient_send_anamnese(text, jsonb) from public;
grant execute on function public.patient_send_anamnese(text, jsonb) to anon, authenticated;

revoke all on function public.patient_state(text) from public;
revoke all on function public.patient_set_day(text, date, text[], jsonb) from public;
revoke all on function public.patient_set_celebrated(text, jsonb) from public;
revoke all on function public.new_patient_token() from public;
grant execute on function public.patient_state(text) to anon, authenticated;
grant execute on function public.patient_set_day(text, date, text[], jsonb) to anon, authenticated;
grant execute on function public.patient_set_celebrated(text, jsonb) to anon, authenticated;
grant execute on function public.new_patient_token() to authenticated;
-- o Supabase concede EXECUTE a anon por padrão em funções novas; o gerador de códigos é só da psicóloga
revoke execute on function public.new_patient_token() from anon;
