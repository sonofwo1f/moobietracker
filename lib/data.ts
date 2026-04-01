import { getSupabaseAdmin } from "@/lib/supabase";
import type { DashboardData, FairnessRow, Member, Movie, MovieNight, VoteRow } from "@/lib/types";

type RawNight = {
  id: string;
  movie_id: string;
  picked_by_member_id: string | null;
  scheduled_for: string | null;
  watched_on: string | null;
  status: "scheduled" | "watched";
  notes: string | null;
  movie: Movie[] | Movie | null;
  picked_by: Member[] | Member | null;
  attendees:
    | {
        member_id: string;
        member: Member[] | Member | null;
      }[]
    | null;
};

type RawVote = {
  movie_id: string;
  member_id: string;
  movie: Movie[] | Movie | null;
  member: Member[] | Member | null;
};

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeNight(night: RawNight): MovieNight | null {
  const movie = firstOrNull<Movie>(night.movie);
  if (!movie) return null;

  return {
    id: night.id,
    movie_id: night.movie_id,
    picked_by_member_id: night.picked_by_member_id,
    scheduled_for: night.scheduled_for,
    watched_on: night.watched_on,
    status: night.status,
    notes: night.notes,
    movie,
    picked_by: firstOrNull<Member>(night.picked_by),
    attendees: (night.attendees ?? [])
      .map((attendee) => {
        const member = firstOrNull<Member>(attendee.member);
        return member ? { member_id: attendee.member_id, member } : null;
      })
      .filter((attendee): attendee is { member_id: string; member: Member } => attendee !== null),
  };
}

function buildVoteRows(rawVotes: RawVote[]): VoteRow[] {
  const map = new Map<string, VoteRow>();

  for (const vote of rawVotes) {
    const movie = firstOrNull<Movie>(vote.movie);
    const member = firstOrNull<Member>(vote.member);
    if (!movie || movie.status !== "available") continue;

    const existing = map.get(movie.id) ?? {
      movie_id: movie.id,
      title: movie.title,
      runtime_minutes: movie.runtime_minutes,
      vote_count: 0,
      voters: [],
    };

    existing.vote_count += 1;
    if (member) existing.voters.push(member.name);
    map.set(movie.id, existing);
  }

  return [...map.values()].sort((a, b) => b.vote_count - a.vote_count || a.title.localeCompare(b.title));
}

function buildRotationRows(fairness: FairnessRow[]) {
  return [...fairness]
    .map((row) => ({ ...row, total_turns: row.watched_picks + row.scheduled_picks }))
    .sort((a, b) => a.total_turns - b.total_turns || a.watched_picks - b.watched_picks || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, rotation_rank: index + 1 }));
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = getSupabaseAdmin();

  const [membersRes, moviesRes, nightsRes, fairnessRes, votesRes] = await Promise.all([
    supabase.from("members").select("id,name").order("name"),
    supabase.from("movies").select("id,title,runtime_minutes,status,source_list").order("title"),
    supabase
      .from("movie_nights")
      .select(`
        id,
        movie_id,
        picked_by_member_id,
        scheduled_for,
        watched_on,
        status,
        notes,
        movie:movies!movie_nights_movie_id_fkey(id,title,runtime_minutes,status,source_list),
        picked_by:members!movie_nights_picked_by_member_id_fkey(id,name),
        attendees:night_attendees(
          member_id,
          member:members!night_attendees_member_id_fkey(id,name)
        )
      `)
      .order("watched_on", { ascending: false, nullsFirst: false })
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("member_pick_stats").select("*").order("name"),
    supabase.from("movie_votes").select(`
      movie_id,
      member_id,
      movie:movies!movie_votes_movie_id_fkey(id,title,runtime_minutes,status,source_list),
      member:members!movie_votes_member_id_fkey(id,name)
    `),
  ]);

  for (const res of [membersRes, moviesRes, nightsRes, fairnessRes, votesRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const allMovies = (moviesRes.data ?? []) as Movie[];
  const fairness = (fairnessRes.data ?? []) as FairnessRow[];
  const allNights = ((nightsRes.data ?? []) as RawNight[])
    .map(normalizeNight)
    .filter((night): night is MovieNight => night !== null);
  const votes = buildVoteRows((votesRes.data ?? []) as RawVote[]);
  const rotation = buildRotationRows(fairness);

  return {
    members: (membersRes.data ?? []) as Member[],
    availableMovies: allMovies.filter((movie) => movie.status === "available"),
    scheduledNights: allNights.filter((night) => night.status === "scheduled"),
    watchedNights: allNights.filter((night) => night.status === "watched"),
    stats: {
      totalMovies: allMovies.length,
      availableCount: allMovies.filter((movie) => movie.status === "available").length,
      scheduledCount: allNights.filter((night) => night.status === "scheduled").length,
      watchedCount: allNights.filter((night) => night.status === "watched").length,
      voteCount: votes.reduce((sum, row) => sum + row.vote_count, 0),
    },
    fairness,
    rotation,
    votes,
  };
}
