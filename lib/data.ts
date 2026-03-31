import { getSupabaseAdmin } from "@/lib/supabase";
import type { DashboardData } from "@/lib/types";

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = getSupabaseAdmin();
  const [membersRes, moviesRes, nightsRes, fairnessRes] = await Promise.all([
    supabase.from("members").select("id,name").order("name"),
    supabase.from("movies").select("id,title,runtime_minutes,status,source_list").order("title"),
    supabase.from("movie_nights").select(`
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
    `).order("watched_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("member_pick_stats").select("*").order("name")
  ]);
  for (const res of [membersRes, moviesRes, nightsRes, fairnessRes]) {
    if (res.error) throw new Error(res.error.message);
  }
  const allMovies = moviesRes.data ?? [];
  const allNights = (nightsRes.data ?? []) as DashboardData["scheduledNights"];
  return {
    members: membersRes.data ?? [],
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
