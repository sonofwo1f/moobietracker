alter table public.members add column if not exists email text;
alter table public.members add column if not exists notifications_enabled boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'members_email_unique'
  ) then
    alter table public.members add constraint members_email_unique unique (email);
  end if;
exception
  when duplicate_table then null;
  when duplicate_object then null;
end $$;

create table if not exists public.movie_ratings (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(movie_id, member_id)
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  movie_night_id uuid references public.movie_nights(id) on delete cascade,
  event_type text not null,
  recipient_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'logged',
  created_at timestamptz not null default now()
);

drop trigger if exists trg_movie_ratings_updated_at on public.movie_ratings;
create trigger trg_movie_ratings_updated_at before update on public.movie_ratings for each row execute function public.set_updated_at();

alter table public.movie_ratings enable row level security;
alter table public.notification_events enable row level security;

drop policy if exists "Public read movie ratings" on public.movie_ratings;
create policy "Public read movie ratings" on public.movie_ratings for select using (true);

drop policy if exists "Public read notification events" on public.notification_events;
create policy "Public read notification events" on public.notification_events for select using (true);

create or replace view public.movie_rating_summary as
select
  mr.movie_id,
  m.title,
  round(avg(mr.rating)::numeric, 2) as average_rating,
  count(*)::integer as rating_count
from public.movie_ratings mr
join public.movies m on m.id = mr.movie_id
group by mr.movie_id, m.title
order by average_rating desc, rating_count desc, m.title;
