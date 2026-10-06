create table if not exists public.rj_jogadores (
  chave text primary key,
  nome text not null check (char_length(nome) between 1 and 30),
  criado timestamptz not null default now()
);
create table if not exists public.rj_partidas (
  id text primary key check (char_length(id) <= 80),
  jogo text not null check (char_length(jogo) <= 30),
  participantes text[] not null check (array_length(participantes, 1) between 2 and 30),
  vencedores text[] not null check (array_length(vencedores, 1) between 1 and 30),
  criado timestamptz not null default now()
);
alter table public.rj_jogadores enable row level security;
alter table public.rj_partidas enable row level security;
drop policy if exists "rj_jog_ler" on public.rj_jogadores;
drop policy if exists "rj_jog_inserir" on public.rj_jogadores;
drop policy if exists "rj_part_ler" on public.rj_partidas;
drop policy if exists "rj_part_inserir" on public.rj_partidas;
create policy "rj_jog_ler" on public.rj_jogadores for select to anon, authenticated using (true);
create policy "rj_jog_inserir" on public.rj_jogadores for insert to anon, authenticated with check (true);
create policy "rj_part_ler" on public.rj_partidas for select to anon, authenticated using (true);
create policy "rj_part_inserir" on public.rj_partidas for insert to anon, authenticated with check (true);
grant select, insert on public.rj_jogadores to anon, authenticated;
grant select, insert on public.rj_partidas to anon, authenticated;
-- remoção de jogadores (ranking e cadastro)
create table if not exists public.rj_removidos (
  chave text primary key check (char_length(chave) <= 40),
  nome text check (char_length(nome) <= 30),
  criado timestamptz not null default now()
);
alter table public.rj_removidos enable row level security;
drop policy if exists "rj_rem_ler" on public.rj_removidos;
drop policy if exists "rj_rem_inserir" on public.rj_removidos;
drop policy if exists "rj_rem_atualizar" on public.rj_removidos;
drop policy if exists "rj_rem_apagar" on public.rj_removidos;
drop policy if exists "rj_jog_apagar" on public.rj_jogadores;
create policy "rj_rem_ler" on public.rj_removidos for select to anon, authenticated using (true);
create policy "rj_rem_inserir" on public.rj_removidos for insert to anon, authenticated with check (true);
create policy "rj_rem_atualizar" on public.rj_removidos for update to anon, authenticated using (true) with check (true);
create policy "rj_rem_apagar" on public.rj_removidos for delete to anon, authenticated using (true);
create policy "rj_jog_apagar" on public.rj_jogadores for delete to anon, authenticated using (true);
grant select, insert, update, delete on public.rj_removidos to anon, authenticated;
grant delete on public.rj_jogadores to anon, authenticated;
-- ===== proteção do ranking: só o administrador (com senha) remove/restaura =====
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.rj_admin (id int primary key default 1 check (id = 1), hash text not null);
alter table public.rj_admin enable row level security;
revoke all on public.rj_admin from anon, authenticated;
drop policy if exists "rj_rem_inserir" on public.rj_removidos;
drop policy if exists "rj_rem_atualizar" on public.rj_removidos;
drop policy if exists "rj_rem_apagar" on public.rj_removidos;
drop policy if exists "rj_jog_apagar" on public.rj_jogadores;
revoke insert, update, delete on public.rj_removidos from anon, authenticated;
revoke update, delete on public.rj_jogadores from anon, authenticated;
revoke update, delete on public.rj_partidas from anon, authenticated;
create or replace function public.rj_admin_ok(senha text) returns boolean
language sql security definer set search_path = public, extensions as $$
  select exists (select 1 from public.rj_admin where hash = extensions.crypt(coalesce(senha, ''), hash));
$$;
create or replace function public.rj_remover(senha text, p_chave text, p_nome text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.rj_admin_ok(senha) then raise exception 'senha invalida'; end if;
  insert into public.rj_removidos (chave, nome) values (left(p_chave, 40), left(p_nome, 30))
    on conflict (chave) do update set nome = excluded.nome, criado = now();
  delete from public.rj_jogadores where chave = p_chave;
end $$;
create or replace function public.rj_restaurar(senha text, p_chave text, p_nome text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.rj_admin_ok(senha) then raise exception 'senha invalida'; end if;
  delete from public.rj_removidos where chave = p_chave;
  insert into public.rj_jogadores (chave, nome) values (p_chave, left(p_nome, 30)) on conflict do nothing;
end $$;
revoke all on function public.rj_admin_ok(text), public.rj_remover(text, text, text), public.rj_restaurar(text, text, text) from public;
grant execute on function public.rj_admin_ok(text), public.rj_remover(text, text, text), public.rj_restaurar(text, text, text) to anon, authenticated;
select (select count(*) from public.rj_removidos) as removidos, (select count(*) from public.rj_admin) as admins;
-- definir/trocar a senha (rode no SQL Editor, trocando SUA_SENHA_AQUI):
-- insert into public.rj_admin (id, hash) values (1, extensions.crypt('SUA_SENHA_AQUI', extensions.gen_salt('bf'))) on conflict (id) do update set hash = excluded.hash;
