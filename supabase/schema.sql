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
  celebrated  text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists public.days (
  patient_id uuid not null references public.patients (id) on delete cascade,
  day        date not null,
  done       text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (patient_id, day)
);

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
                      from public.days d where d.patient_id = p.id), '{}'::json)
  )
  from public.patients p
  where p.token = upper(p_token);
$$;

create or replace function public.patient_set_day(p_token text, p_day date, p_done text[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
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
  insert into public.days (patient_id, day, done, updated_at)
  values (v_id, p_day, coalesce(p_done, '{}'), now())
  on conflict (patient_id, day)
  do update set done = excluded.done, updated_at = now();
  return true;
end;
$$;

create or replace function public.patient_mark_celebrated(p_token text, p_ids text[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.patients
     set celebrated = array(select distinct unnest(celebrated || coalesce(p_ids, '{}')))
   where token = upper(p_token);
  return found;
end;
$$;

revoke all on function public.patient_state(text) from public;
revoke all on function public.patient_set_day(text, date, text[]) from public;
revoke all on function public.patient_mark_celebrated(text, text[]) from public;
revoke all on function public.new_patient_token() from public;
grant execute on function public.patient_state(text) to anon, authenticated;
grant execute on function public.patient_set_day(text, date, text[]) to anon, authenticated;
grant execute on function public.patient_mark_celebrated(text, text[]) to anon, authenticated;
grant execute on function public.new_patient_token() to authenticated;
-- o Supabase concede EXECUTE a anon por padrão em funções novas; o gerador de códigos é só da psicóloga
revoke execute on function public.new_patient_token() from anon;
