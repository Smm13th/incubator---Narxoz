-- Одноразовая миграция для схемы Асық Arena.
-- Запустить в Supabase SQL Editor под ролью владельца проекта.

-- Email не должен быть частью публичного профиля.
alter table public.profiles drop column if exists email;
alter table public.profiles drop constraint if exists username_len;
alter table public.profiles add constraint username_len
  check (char_length(username) between 1 and 20);

-- Игрок может вставлять только собственные результаты.
alter table public.results enable row level security;
drop policy if exists "Authenticated users can insert results" on public.results;
drop policy if exists "Insert own results" on public.results;
create policy "Insert own results" on public.results
  for insert with check (auth.uid() = user_id);

alter table public.results drop constraint if exists score_range;
alter table public.results add constraint score_range
  check (score between 0 and 40);
alter table public.results drop constraint if exists stars_range;
alter table public.results add constraint stars_range
  check (stars between 0 and 3);

alter table public.purchases drop constraint if exists uniq_purchase;
alter table public.purchases add constraint uniq_purchase
  unique (user_id, skin_id);

-- Создаёт профиль на основе метаданных регистрации Supabase Auth.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, username, university)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'username','Игрок'),
          coalesce(new.raw_user_meta_data->>'university','Другой ВУЗ'));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Лучший результат каждого игрока по каждому уровню, затем сумма по вузу.
create or replace view public.uni_leaderboard as
select university, sum(best)::int as total, count(distinct user_id)::int as players
from (
  select user_id, university, level_id, max(score) as best
  from public.results
  group by 1,2,3
) t
group by university
order by total desc;

-- Сумма лучших результатов игрока по уровням.
create or replace view public.player_leaderboard as
select username, university, sum(best)::int as total
from (
  select user_id, username, university, level_id, max(score) as best
  from public.results
  group by 1,2,3,4
) t
group by user_id, username, university
order by total desc
limit 20;

grant select on public.uni_leaderboard, public.player_leaderboard to anon, authenticated;
