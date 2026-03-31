export type Member = { id: string; name: string };
export type Movie = { id: string; title: string; runtime_minutes: number | null; status: "available" | "scheduled" | "watched"; source_list: string | null };
export type MovieNight = {
  id: string;
  movie_id: string;
  picked_by_member_id: string | null;
  scheduled_for: string | null;
  watched_on: string | null;
  status: "scheduled" | "watched";
  notes: string | null;
  movie: Movie;
  picked_by: Member | null;
  attendees: { member_id: string; member: Member }[];
};
export type DashboardData = {
  members: Member[];
  availableMovies: Movie[];
  scheduledNights: MovieNight[];
  watchedNights: MovieNight[];
  stats: { totalMovies: number; availableCount: number; scheduledCount: number; watchedCount: number };
  fairness: { member_id: string; name: string; watched_picks: number; scheduled_picks: number }[];
};
