import { getSupabaseAdmin } from "@/lib/supabase";
import type { DashboardData, Member, Movie, MovieNight } from "@/lib/types";

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

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = getSupabaseAdmin();

  const [membersRes, moviesRes, nightsRes, fairnessRes] = await Promise.all([
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
      .order("created_at", { ascending: false }),
    supabase.from("member_pick_stats").select("*").order("name"),
  ]);

  for (const res of [membersRes, moviesRes, nightsRes, fairnessRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const allMovies = (moviesRes.data ?? []) as Movie[];

  const allNights: MovieNight[] = ((nightsRes.data ?? []) as RawNight[])
    .map((night) => {
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
        attendees: (night.attendees ?? []).map((attendee) => ({
          member_id: attendee.member_id,
          member: firstOrNull<Member>(attendee.member)!,
        })).filter((attendee) => attendee.member),
      };
    })
    .filter((night): night is MovieNight => night !== null);

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
    },
    fairness: fairnessRes.data ?? [],
  };
}
