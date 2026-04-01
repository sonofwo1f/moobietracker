create table if not exists public.movie_votes (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(movie_id, member_id)
);

alter table public.movie_votes enable row level security;

drop policy if exists "Public read movie votes" on public.movie_votes;
create policy "Public read movie votes" on public.movie_votes for select using (true);
