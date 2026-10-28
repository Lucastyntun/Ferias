-- ============================================================
--  Esquema da base de dados Supabase para o Gestor de Férias
--  Cole TODO este script no SQL Editor do Supabase e clique em RUN.
--  (É seguro repetir — não duplica nada.)
-- ============================================================

-- ---------- Perfis de utilizador (ligados à autenticação Supabase) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null default 'funcionario',   -- 'admin' | 'funcionario'
  estado text not null default 'ativo',       -- 'ativo' | 'pendente' | 'suspenso'
  created_at timestamptz not null default now()
);

-- ---------- Definições (limite máximo de funcionários em férias por dia) ----------
create table if not exists public.settings (
  id int primary key default 1,
  max_simultaneos int not null default 3
);
insert into public.settings (id, max_simultaneos) values (1, 3)
  on conflict (id) do nothing;

-- ---------- Pedidos de férias ----------
create table if not exists public.requests (
  id bigint generated always as identity primary key,
  employee_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'Pendente',    -- Pendente | Aprovado | Recusado
  notes text default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.profiles  enable row level security;
alter table public.settings  enable row level security;
alter table public.requests  enable row level security;

-- Função auxiliar: papel do utilizador autenticado
create or replace function public.user_role()
returns text language sql stable security definer as $$
  select coalesce((select role from public.profiles where id = auth.uid()), '')
$$;

-- PROFILES
drop policy if exists "leer_perfis" on public.profiles;
create policy "leer_perfis" on public.profiles for select to authenticated using (true);

-- Qualquer utilizador autenticado pode criar o SEU próprio perfil
-- (permite ao site registar contas e ao admin criar perfis logo após signUp)
drop policy if exists "crear_perfil_proprio" on public.profiles;
create policy "crear_perfil_proprio" on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "actualizar_perfil_proprio" on public.profiles;
create policy "actualizar_perfil_proprio" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "admin_escreve_perfis" on public.profiles;
create policy "admin_escreve_perfis" on public.profiles for all to authenticated
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

-- SETTINGS (todos lêem; admin altera)
drop policy if exists "leer_settings" on public.settings;
create policy "leer_settings" on public.settings for select to authenticated using (true);

drop policy if exists "admin_edita_settings" on public.settings;
create policy "admin_edita_settings" on public.settings for update to authenticated
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

-- REQUESTS (todos autenticados lêem/criam; dono cancela pendentes; admin gere tudo)
drop policy if exists "leer_pedidos" on public.requests;
create policy "leer_pedidos" on public.requests for select to authenticated using (true);

drop policy if exists "crear_pedidos" on public.requests;
create policy "crear_pedidos" on public.requests for insert to authenticated with check (true);

drop policy if exists "dono_cancela_pendente" on public.requests;
create policy "dono_cancela_pendente" on public.requests for delete to authenticated
  using (created_by = auth.uid() and status = 'Pendente');

drop policy if exists "admin_gere_pedidos" on public.requests;
create policy "admin_gere_pedidos" on public.requests for all to authenticated
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

-- ============================================================
--  PASSO FINAL — criar o administrador inicial:
--  1. No painel do Supabase: Authentication -> Users -> "Add user"
--       email: admin@ferias.local   password: admin123
--       (deixe "Auto-confirmed password" marcado)
--  2. Copie o ID (UUID) do utilizador criado e execute:
--
--     insert into public.profiles (id, username, role, estado)
--     values ('COLE_O_UUID_AQUI', 'admin', 'admin', 'ativo')
--     on conflict (id) do nothing;
--
--  A partir daí pode iniciar sessão no site com
--  admin@ferias.local / admin123 e criar os restantes
--  utilizadores no painel de Administração.
-- ============================================================
