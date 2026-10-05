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
