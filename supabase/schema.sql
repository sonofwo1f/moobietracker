create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  runtime_minutes integer,
  status text not null default 'available' check (status in ('available', 'scheduled', 'watched')),
  source_list text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movie_nights (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies(id) on delete cascade,
  picked_by_member_id uuid references public.members(id) on delete set null,
  scheduled_for date,
  watched_on date,
  status text not null check (status in ('scheduled', 'watched')),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.night_attendees (
  id uuid primary key default gen_random_uuid(),
  movie_night_id uuid not null references public.movie_nights(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(movie_night_id, member_id)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_movies_updated_at on public.movies;
create trigger trg_movies_updated_at before update on public.movies for each row execute function public.set_updated_at();

drop trigger if exists trg_movie_nights_updated_at on public.movie_nights;
create trigger trg_movie_nights_updated_at before update on public.movie_nights for each row execute function public.set_updated_at();

alter table public.members enable row level security;
alter table public.movies enable row level security;
alter table public.movie_nights enable row level security;
alter table public.night_attendees enable row level security;

drop policy if exists "Public read members" on public.members;
create policy "Public read members" on public.members for select using (true);
drop policy if exists "Public read movies" on public.movies;
create policy "Public read movies" on public.movies for select using (true);
drop policy if exists "Public read movie nights" on public.movie_nights;
create policy "Public read movie nights" on public.movie_nights for select using (true);
drop policy if exists "Public read attendees" on public.night_attendees;
create policy "Public read attendees" on public.night_attendees for select using (true);

insert into public.members (name)
values
  ('Karim'),
  ('Ed'),
  ('Karen'),
  ('Joey'),
  ('Nat'),
  ('Emily'),
  ('Candi'),
  ('Waya')
on conflict (name) do nothing;

insert into public.movies (title, runtime_minutes, status, source_list)
values
  ('The Crazies', 101, 'available', 'backlog'),
  ('Grind', 105, 'available', 'backlog'),
  ('Children of Men', 109, 'available', 'backlog'),
  ('Tombstone', 130, 'available', 'backlog'),
  ('The Lord of the Rings: The Fellowship of the Ring', 178, 'available', 'backlog'),
  ('The Lord of the Rings: The Two Towers', 179, 'available', 'backlog'),
  ('The Lord of the Rings: The Return of the King', 201, 'available', 'backlog'),
  ('Dallas Buyers Club', 117, 'available', 'backlog'),
  ('Silent Hill', 126, 'available', 'backlog'),
  ('Whiplash', 106, 'available', 'backlog'),
  ('Cool Runnings', 98, 'available', 'backlog'),
  ('Superbad', 113, 'available', 'backlog'),
  ('Brightburn', 90, 'available', 'backlog'),
  ('The Last Samurai', 154, 'available', 'backlog'),
  ('Shaun of the Dead', 99, 'available', 'backlog'),
  ('Hot Fuzz', 121, 'available', 'backlog'),
  ('The World''s End', 109, 'available', 'backlog'),
  ('Halloween (1978)', 91, 'available', 'backlog'),
  ('Halloween (2018)', 106, 'available', 'backlog'),
  ('The Texas Chain Saw Massacre (1974)', 83, 'available', 'backlog'),
  ('The Texas Chainsaw Massacre (2003)', 98, 'available', 'backlog'),
  ('The Revenant', 156, 'available', 'backlog'),
  ('Fury', 134, 'available', 'backlog'),
  ('About Time', 123, 'available', 'backlog'),
  ('Orphan: First Kill', 99, 'available', 'backlog'),
  ('Scott Pilgrim vs. the World', 112, 'available', 'backlog'),
  ('American Psycho', 102, 'available', 'backlog'),
  ('The Number 23', 98, 'available', 'backlog'),
  ('Minority Report', 145, 'available', 'backlog'),
  ('The Drummer', 99, 'available', 'backlog'),
  ('V for Vendetta', 132, 'available', 'backlog'),
  ('The Mummy (1999)', 125, 'available', 'backlog'),
  ('Us', 116, 'available', 'backlog'),
  ('The Whale', 117, 'available', 'backlog'),
  ('Chef', 114, 'available', 'backlog'),
  ('Crouching Tiger, Hidden Dragon', 120, 'available', 'backlog'),
  ('Spirited Away', 125, 'available', 'backlog'),
  ('My Neighbor Totoro', 86, 'available', 'backlog'),
  ('Howl''s Moving Castle', 119, 'available', 'backlog'),
  ('Swiss Army Man', 97, 'available', 'backlog'),
  ('The Peanut Butter Falcon', 98, 'available', 'backlog'),
  ('Ex Machina', 108, 'available', 'backlog'),
  ('Ever After: A Cinderella Story', 121, 'available', 'backlog'),
  ('Surf''s Up', 85, 'available', 'backlog'),
  ('Mars Attacks!', 106, 'available', 'backlog'),
  ('The Fabelmans', 151, 'available', 'backlog'),
  ('Vanilla Sky', 136, 'available', 'backlog'),
  ('Chicken Run', 84, 'available', 'backlog'),
  ('Wallace & Gromit: The Curse of the Were-Rabbit', 85, 'available', 'backlog'),
  ('Paddington', 95, 'available', 'backlog'),
  ('Paddington 2', 103, 'available', 'backlog'),
  ('Paddington in Peru (Paddington 3)', 106, 'available', 'backlog'),
  ('The Last Voyage of the Demeter', 118, 'available', 'backlog'),
  ('The Village', 108, 'available', 'backlog'),
  ('Sunshine', 107, 'available', 'backlog'),
  ('Les Misérables (2012)', 158, 'available', 'backlog'),
  ('The Talented Mr. Ripley', 139, 'available', 'backlog'),
  ('The Man from U.N.C.L.E. (2015)', 116, 'available', 'backlog')
on conflict (title) do update
set runtime_minutes = excluded.runtime_minutes,
    source_list = excluded.source_list;

insert into public.movies (title, status, source_list)
values
  ('Mission Impossible 3', 'watched', 'history'),
  ('Grand Budapest Hotel', 'watched', 'history'),
  ('28 Days Later', 'watched', 'history'),
  ('Orphan', 'watched', 'history'),
  ('28 Weeks Later', 'watched', 'history'),
  ('Fight Club', 'watched', 'history'),
  ('Sucker Punch', 'watched', 'history'),
  ('Nope', 'watched', 'history'),
  ('The Mummy', 'watched', 'history'),
  ('The Last Samurai', 'watched', 'history'),
  ('Saving Private Ryan', 'scheduled', 'history'),
  ('Inglourious Basterds', 'scheduled', 'history'),
  ('Nightmare Before Christmas', 'scheduled', 'history'),
  ('Eternal Sunshine of the Spotless Mind', 'scheduled', 'history'),
  ('The Unbearable Weight of Massive Talent', 'scheduled', 'history')
on conflict (title) do update
set status = case when public.movies.status = 'watched' then public.movies.status else excluded.status end,
    source_list = coalesce(public.movies.source_list, excluded.source_list);

update public.movies
set status = 'watched'
where title in ('Mission Impossible 3', 'Grand Budapest Hotel', '28 Days Later', 'Orphan', '28 Weeks Later', 'Fight Club', 'Sucker Punch', 'Nope', 'The Mummy', 'The Last Samurai');

insert into public.movie_nights (movie_id, picked_by_member_id, scheduled_for, watched_on, status, notes)
select
  movies.id,
  members.id,
  null,
  date '2023-02-11',
  'watched',
  ''
from public.movies movies
left join public.members members on members.name = 'Candi'
where movies.title = 'Mission Impossible 3'
union all
select
  movies.id,
  members.id,
  null,
  date '2023-10-21',
  'watched',
  ''
from public.movies movies
left join public.members members on members.name = 'Candi'
where movies.title = 'Grand Budapest Hotel'
union all
select
  movies.id,
  members.id,
  null,
  date '2023-10-21',
  'watched',
  ''
from public.movies movies
left join public.members members on members.name = 'Candi'
where movies.title = '28 Days Later'
union all
select
  movies.id,
  members.id,
  null,
  date '2024-02-22',
  'watched',
  ''
from public.movies movies
left join public.members members on members.name = 'Ed'
where movies.title = 'Orphan'
union all
select
  movies.id,
  members.id,
  null,
  date '2025-06-28',
  'watched',
  ''
from public.movies movies
left join public.members members on members.name = 'Ed'
where movies.title = '28 Weeks Later'
union all
select
  movies.id,
  members.id,
  null,
  date '2025-08-03',
  'watched',
  ''
from public.movies movies
left join public.members members on members.name = 'Candi'
where movies.title = 'Fight Club'
union all
select
  movies.id,
  members.id,
  null,
  date '2025-09-19',
  'watched',
  ''
from public.movies movies
left join public.members members on members.name = 'Karim'
where movies.title = 'Sucker Punch'
union all
select
  movies.id,
  members.id,
  null,
  date '2025-11-02',
  'watched',
  ''
from public.movies movies
left join public.members members on members.name = 'Emily'
where movies.title = 'Nope'
union all
select
  movies.id,
  members.id,
  null,
  date '2026-01-17',
  'watched',
  ''
from public.movies movies
left join public.members members on members.name = 'Waya'
where movies.title = 'The Mummy'
union all
select
  movies.id,
  members.id,
  null,
  date '2026-03-13',
  'watched',
  ''
from public.movies movies
left join public.members members on members.name = 'Karen'
where movies.title = 'The Last Samurai'
union all
select
  movies.id,
  members.id,
  null,
  null,
  'scheduled',
  ''
from public.movies movies
left join public.members members on members.name = 'Joey'
where movies.title = 'Saving Private Ryan'
union all
select
  movies.id,
  members.id,
  null,
  null,
  'scheduled',
  ''
from public.movies movies
left join public.members members on members.name = 'Joey'
where movies.title = 'Inglourious Basterds'
union all
select
  movies.id,
  members.id,
  null,
  null,
  'scheduled',
  ''
from public.movies movies
left join public.members members on members.name = 'Karim'
where movies.title = 'Nightmare Before Christmas'
union all
select
  movies.id,
  members.id,
  null,
  null,
  'scheduled',
  ''
from public.movies movies
left join public.members members on members.name = 'Karim'
where movies.title = 'Eternal Sunshine of the Spotless Mind'
union all
select
  movies.id,
  members.id,
  null,
  null,
  'scheduled',
  ''
from public.movies movies
left join public.members members on members.name = 'Karen'
where movies.title = 'The Unbearable Weight of Massive Talent'
;

create or replace view public.member_pick_stats as
select
  m.id as member_id,
  m.name,
  count(*) filter (where mn.status = 'watched') as watched_picks,
  count(*) filter (where mn.status = 'scheduled') as scheduled_picks
from public.members m
left join public.movie_nights mn on mn.picked_by_member_id = m.id
group by m.id, m.name
order by m.name;
