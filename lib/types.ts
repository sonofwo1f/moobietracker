export type Member = {
  id: string;
  name: string;
  email?: string | null;
  notifications_enabled?: boolean | null;
};

export type Movie = {
  id: string;
  title: string;
  runtime_minutes: number | null;
  status: "available" | "scheduled" | "watched";
  source_list: string | null;
};

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

export type VoteRow = {
  movie_id: string;
  title: string;
  runtime_minutes: number | null;
  vote_count: number;
  voters: string[];
};

export type FairnessRow = {
  member_id: string;
  name: string;
  watched_picks: number;
  scheduled_picks: number;
};

export type RotationRow = FairnessRow & {
  total_turns: number;
  rotation_rank: number;
};

export type RatingRow = {
  movie_id: string;
  member_id: string;
  rating: number;
  review: string | null;
  movie: Movie;
  member: Member;
};

export type RatingSummaryRow = {
  movie_id: string;
  title: string;
  average_rating: number;
  rating_count: number;
};

export type DashboardData = {
  members: Member[];
  availableMovies: Movie[];
  scheduledNights: MovieNight[];
  watchedNights: MovieNight[];
  stats: {
    totalMovies: number;
    availableCount: number;
    scheduledCount: number;
    watchedCount: number;
    voteCount: number;
    ratingsCount: number;
  };
  fairness: FairnessRow[];
  rotation: RotationRow[];
  votes: VoteRow[];
  ratings: RatingRow[];
  ratingSummary: RatingSummaryRow[];
};
