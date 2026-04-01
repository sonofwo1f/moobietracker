'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DashboardData, Member, Movie, MovieNight } from "@/lib/types";
import { MemberPickerWheel } from "@/components/MemberPickerWheel";

type ViewKey = "dashboard" | "schedule" | "backlog" | "history" | "wheel" | "settings";
type PickerResult = { title: string; runtime_minutes: number | null; reason: string } | null;
type ScheduleEditor = {
  movie_id: string;
  picked_by_member_id: string;
  scheduled_for: string;
  notes: string;
  attendee_ids: string[];
};

const NAV_ITEMS: { href: string; label: string; view: ViewKey }[] = [
  { href: "/", label: "Dashboard", view: "dashboard" },
  { href: "/schedule", label: "Schedule", view: "schedule" },
  { href: "/backlog", label: "Backlog", view: "backlog" },
  { href: "/history", label: "History", view: "history" },
  { href: "/wheel", label: "Wheel", view: "wheel" },
  { href: "/settings", label: "Settings", view: "settings" },
];

async function postJSON(url: string, body?: Record<string, unknown>, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Something went wrong.");
  return payload;
}

function formatDate(value: string | null) {
  if (!value) return "TBD";
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

function stars(value: number) {
  return "★".repeat(value) + "☆".repeat(5 - value);
}

function buildEditorState(night: MovieNight): ScheduleEditor {
  return {
    movie_id: night.movie_id,
    picked_by_member_id: night.picked_by_member_id ?? "",
    scheduled_for: night.scheduled_for ?? "",
    notes: night.notes ?? "",
    attendee_ids: night.attendees.map((attendee) => attendee.member_id),
  };
}

export function ClubShell({ initialData, view }: { initialData: DashboardData; view: ViewKey }) {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filterMaxRuntime, setFilterMaxRuntime] = useState("");
  const [pickerMode, setPickerMode] = useState("vote-rotation");
  const [pickerResult, setPickerResult] = useState<PickerResult>(null);
  const [editingNightId, setEditingNightId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<ScheduleEditor | null>(null);
  const [activeMemberId, setActiveMemberId] = useState(data.members[0]?.id ?? "");
  const [memberEmail, setMemberEmail] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [voteMovieId, setVoteMovieId] = useState("");
  const [ratingMovieId, setRatingMovieId] = useState("");
  const [ratingValue, setRatingValue] = useState("5");
  const [ratingReview, setRatingReview] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("moobie-active-member-id");
    if (stored && data.members.some((member) => member.id === stored)) {
      setActiveMemberId(stored);
    }
  }, [data.members]);

  useEffect(() => {
    if (!activeMemberId) return;
    window.localStorage.setItem("moobie-active-member-id", activeMemberId);
    const member = data.members.find((item) => item.id === activeMemberId);
    setMemberEmail(member?.email ?? "");
    setNotifyEnabled(Boolean(member?.notifications_enabled));
  }, [activeMemberId, data.members]);

  const activeMember = useMemo(() => data.members.find((member) => member.id === activeMemberId) ?? null, [data.members, activeMemberId]);
  const availableMovies = useMemo(() => {
    const max = Number(filterMaxRuntime);
    if (!filterMaxRuntime || Number.isNaN(max)) return data.availableMovies;
    return data.availableMovies.filter((movie) => (movie.runtime_minutes ?? 0) <= max);
  }, [data.availableMovies, filterMaxRuntime]);
  const voteLookup = useMemo(() => {
    const map = new Map<string, { vote_count: number; voters: string[] }>();
    for (const vote of data.votes) map.set(vote.movie_id, { vote_count: vote.vote_count, voters: vote.voters });
    return map;
  }, [data.votes]);
  const ratingLookup = useMemo(() => {
    const map = new Map<string, { average_rating: number; rating_count: number }>();
    for (const row of data.ratingSummary) map.set(row.movie_id, row);
    return map;
  }, [data.ratingSummary]);
  const myRatings = useMemo(() => data.ratings.filter((row) => row.member_id === activeMemberId), [data.ratings, activeMemberId]);
  const nextUp = data.rotation[0] ?? null;
  const topRated = data.ratingSummary.slice(0, 5);

  async function refresh() {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    const payload = await res.json();
    setData(payload);
  }

  function schedulableMoviesFor(night: MovieNight) {
    const movies = [...data.availableMovies];
    if (!movies.some((movie) => movie.id === night.movie.id)) movies.unshift(night.movie);
    return movies.sort((a, b) => a.title.localeCompare(b.title));
  }

  function startEditing(night: MovieNight) {
    setEditingNightId(night.id);
    setEditorState(buildEditorState(night));
  }

  function cancelEditing() {
    setEditingNightId(null);
    setEditorState(null);
  }

  function toggleEditorAttendee(memberId: string, checked: boolean) {
    setEditorState((current) => {
      if (!current) return current;
      const ids = new Set(current.attendee_ids);
      if (checked) ids.add(memberId);
      else ids.delete(memberId);
      return { ...current, attendee_ids: [...ids] };
    });
  }

  async function handleProfileSave() {
    if (!activeMemberId) return;
    try {
      setBusy("profile");
      setMessage(null);
      await postJSON("/api/members", { member_id: activeMemberId, email: memberEmail, notifications_enabled: notifyEnabled }, "PATCH");
      await refresh();
      setMessage("Profile preferences saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setBusy(null);
    }
  }

  async function handleScheduleMovie(formData: FormData) {
    try {
      setBusy("scheduleMovie");
      setMessage(null);
      await postJSON("/api/nights", {
        action: "schedule",
        movie_id: formData.get("movie_id"),
        picked_by_member_id: formData.get("picked_by_member_id"),
        scheduled_for: formData.get("scheduled_for"),
        notes: formData.get("notes"),
        attendee_ids: formData.getAll("attendee_ids"),
      });
      await refresh();
      setMessage("Movie night scheduled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not schedule movie.");
    } finally {
      setBusy(null);
    }
  }

  async function saveScheduledEdit() {
    if (!editingNightId || !editorState) return;
    try {
      setBusy(`edit-${editingNightId}`);
      setMessage(null);
      await postJSON("/api/nights", { action: "update_schedule", night_id: editingNightId, ...editorState });
      await refresh();
      cancelEditing();
      setMessage("Scheduled movie updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update scheduled movie.");
    } finally {
      setBusy(null);
    }
  }

  async function removeScheduledNight(nightId: string) {
    try {
      setBusy(`remove-${nightId}`);
      setMessage(null);
      await postJSON("/api/nights", { night_id: nightId }, "DELETE");
      await refresh();
      if (editingNightId === nightId) cancelEditing();
      setMessage("Scheduled movie removed and returned to the backlog.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove scheduled movie.");
    } finally {
      setBusy(null);
    }
  }

  async function markWatched(nightId: string) {
    try {
      setBusy(nightId);
      setMessage(null);
      await postJSON("/api/nights", { action: "mark_watched", night_id: nightId });
      await refresh();
      if (editingNightId === nightId) cancelEditing();
      setMessage("Marked as watched.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update movie night.");
    } finally {
      setBusy(null);
    }
  }

  async function runMoviePicker() {
    try {
      setBusy("picker");
      setMessage(null);
      const payload = await postJSON("/api/picker", { max_runtime: filterMaxRuntime || null, mode: pickerMode });
      setPickerResult(payload.result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not pick a movie.");
    } finally {
      setBusy(null);
    }
  }

  async function submitVote() {
    if (!voteMovieId || !activeMemberId) return;
    try {
      setBusy("vote");
      setMessage(null);
      await postJSON("/api/votes", { movie_id: voteMovieId, member_id: activeMemberId });
      await refresh();
      setMessage("Vote saved.");
      setVoteMovieId("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save vote.");
    } finally {
      setBusy(null);
    }
  }

  async function removeVote(movieId: string) {
    if (!activeMemberId) return;
    try {
      setBusy(`vote-remove-${movieId}`);
      setMessage(null);
      await postJSON("/api/votes", { movie_id: movieId, member_id: activeMemberId }, "DELETE");
      await refresh();
      setMessage("Vote removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove vote.");
    } finally {
      setBusy(null);
    }
  }

  async function saveRating() {
    if (!ratingMovieId || !activeMemberId) return;
    try {
      setBusy("rating");
      setMessage(null);
      await postJSON("/api/ratings", {
        movie_id: ratingMovieId,
        member_id: activeMemberId,
        rating: Number(ratingValue),
        review: ratingReview,
      });
      await refresh();
      setRatingMovieId("");
      setRatingValue("5");
      setRatingReview("");
      setMessage("Rating saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save rating.");
    } finally {
      setBusy(null);
    }
  }

  async function handleLogout() {
    await postJSON("/api/auth/logout");
    window.location.href = "/login";
  }

  function renderScheduleForm() {
    return (
      <section className="card">
        <div className="sectionHeading">
          <div>
            <span className="eyebrow">Plan the next one</span>
            <h2>Schedule a movie night</h2>
          </div>
          {nextUp ? <span className="badge">Next up: {nextUp.name}</span> : null}
        </div>
        <form
          action={(formData) => {
            void handleScheduleMovie(formData);
          }}
        >
          <label>
            Movie
            <select name="movie_id" required defaultValue="">
              <option value="" disabled>Select a movie</option>
              {data.availableMovies.map((movie) => (
                <option key={movie.id} value={movie.id}>
                  {movie.title} {movie.runtime_minutes ? `• ${movie.runtime_minutes} min` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Picked by
            <select name="picked_by_member_id" defaultValue={nextUp?.member_id ?? ""}>
              <option value="">No picker yet</option>
              {data.members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>
          <div className="grid two singleOnMobile">
            <label>
              Date
              <input name="scheduled_for" type="date" />
            </label>
            <label>
              Notes
              <input name="notes" type="text" placeholder="Theme, food, location, whatever helps" />
            </label>
          </div>
          <div>
            <div className="sectionLabel">Attendees</div>
            <div className="memberPills">
              {data.members.map((member) => (
                <label key={member.id} className="checkRow">
                  <input type="checkbox" name="attendee_ids" value={member.id} />
                  {member.name}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={busy === "scheduleMovie"}>
            {busy === "scheduleMovie" ? "Saving..." : "Schedule movie"}
          </button>
        </form>
      </section>
    );
  }

  function renderScheduledList() {
    return (
      <section className="card">
        <div className="sectionHeading">
          <div>
            <span className="eyebrow">Coming up</span>
            <h2>Upcoming movie nights</h2>
          </div>
          <span className="badge warning">{data.scheduledNights.length} scheduled</span>
        </div>
        <div className="stackList">
          {data.scheduledNights.length === 0 ? (
            <div className="emptyState">Nothing scheduled yet.</div>
          ) : (
            data.scheduledNights.map((night) => {
              const isEditing = editingNightId === night.id && editorState;
              return (
                <article className="featureCard" key={night.id}>
                  <div className="rowSplit">
                    <div>
                      <strong>{night.movie.title}</strong>
                      <p>{night.movie.runtime_minutes ? `${night.movie.runtime_minutes} min` : "Runtime TBD"} • {formatDate(night.scheduled_for)}</p>
                    </div>
                    <div className="rowActions">
                      <span className="badge">{night.picked_by?.name ?? "No picker"}</span>
                      <button className="secondary inline" type="button" onClick={() => startEditing(night)}>Edit</button>
                      <button className="inline" type="button" onClick={() => markWatched(night.id)} disabled={busy === night.id}>
                        {busy === night.id ? "Saving..." : "Mark watched"}
                      </button>
                      <button className="danger inline" type="button" onClick={() => removeScheduledNight(night.id)} disabled={busy === `remove-${night.id}`}>
                        {busy === `remove-${night.id}` ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                  {night.notes ? <p>{night.notes}</p> : null}
                  <p className="muted">
                    Attending: {night.attendees.length > 0 ? night.attendees.map((attendee) => attendee.member.name).join(", ") : "No one marked yet"}
                  </p>
                  {isEditing ? (
                    <div className="editPanel">
                      <label>
                        Movie
                        <select
                          value={editorState.movie_id}
                          onChange={(event) => setEditorState((current) => current ? { ...current, movie_id: event.target.value } : current)}
                        >
                          {schedulableMoviesFor(night).map((movie) => (
                            <option key={movie.id} value={movie.id}>{movie.title}</option>
                          ))}
                        </select>
                      </label>
                      <div className="grid two singleOnMobile">
                        <label>
                          Picked by
                          <select
                            value={editorState.picked_by_member_id}
                            onChange={(event) => setEditorState((current) => current ? { ...current, picked_by_member_id: event.target.value } : current)}
                          >
                            <option value="">No picker yet</option>
                            {data.members.map((member) => (
                              <option key={member.id} value={member.id}>{member.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Date
                          <input
                            type="date"
                            value={editorState.scheduled_for}
                            onChange={(event) => setEditorState((current) => current ? { ...current, scheduled_for: event.target.value } : current)}
                          />
                        </label>
                      </div>
                      <label>
                        Notes
                        <input
                          type="text"
                          value={editorState.notes}
                          onChange={(event) => setEditorState((current) => current ? { ...current, notes: event.target.value } : current)}
                        />
                      </label>
                      <div>
                        <div className="sectionLabel">Attendees</div>
                        <div className="memberPills">
                          {data.members.map((member) => (
                            <label key={member.id} className="checkRow">
                              <input
                                type="checkbox"
                                checked={editorState.attendee_ids.includes(member.id)}
                                onChange={(event) => toggleEditorAttendee(member.id, event.target.checked)}
                              />
                              {member.name}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="rowActions">
                        <button className="inline" type="button" onClick={saveScheduledEdit} disabled={busy === `edit-${night.id}`}>
                          {busy === `edit-${night.id}` ? "Saving..." : "Save changes"}
                        </button>
                        <button className="secondary inline" type="button" onClick={cancelEditing}>Cancel</button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    );
  }

  function renderBacklog() {
    return (
      <>
        <section className="card">
          <div className="sectionHeading">
            <div>
              <span className="eyebrow">Votes + randomizer</span>
              <h2>Backlog tools</h2>
            </div>
            <span className="badge">{availableMovies.length} available</span>
          </div>
          <div className="grid two singleOnMobile">
            <div className="featureCard">
              <label>
                Max runtime filter
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Leave blank for all"
                  value={filterMaxRuntime}
                  onChange={(event) => setFilterMaxRuntime(event.target.value)}
                />
              </label>
              <label>
                Picker mode
                <select value={pickerMode} onChange={(event) => setPickerMode(event.target.value)}>
                  <option value="vote-rotation">Votes first</option>
                  <option value="turn-rotation">Rotation aware</option>
                  <option value="short-night">Short night</option>
                  <option value="epic-night">Epic night</option>
                  <option value="pure-random">Pure random</option>
                </select>
              </label>
              <button type="button" onClick={runMoviePicker} disabled={busy === "picker"}>
                {busy === "picker" ? "Picking..." : "Pick a movie"}
              </button>
              {pickerResult ? (
                <div className="featureCard subtle">
                  <strong>{pickerResult.title}</strong>
                  <p>{pickerResult.runtime_minutes ? `${pickerResult.runtime_minutes} min` : "Runtime TBD"}</p>
                  <p>{pickerResult.reason}</p>
                </div>
              ) : null}
            </div>
            <div className="featureCard">
              <label>
                Vote as
                <select value={activeMemberId} onChange={(event) => setActiveMemberId(event.target.value)}>
                  {data.members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Movie to vote for
                <select value={voteMovieId} onChange={(event) => setVoteMovieId(event.target.value)}>
                  <option value="">Choose a movie</option>
                  {availableMovies.map((movie) => (
                    <option key={movie.id} value={movie.id}>{movie.title}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={submitVote} disabled={!voteMovieId || busy === "vote"}>
                {busy === "vote" ? "Saving..." : "Submit vote"}
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="sectionHeading">
            <div>
              <span className="eyebrow">Movie list</span>
              <h2>Available backlog</h2>
            </div>
          </div>
          <div className="stackList">
            {availableMovies.map((movie) => {
              const vote = voteLookup.get(movie.id);
              const myVote = data.votes.some((row) => row.movie_id === movie.id && row.voters.includes(activeMember?.name ?? ""));
              return (
                <article className="listItem" key={movie.id}>
                  <div>
                    <strong>{movie.title}</strong>
                    <p className="muted">
                      {movie.runtime_minutes ? `${movie.runtime_minutes} min` : "Runtime TBD"} • {vote?.vote_count ?? 0} vote(s)
                    </p>
                    {vote?.voters.length ? <p className="muted">Votes: {vote.voters.join(", ")}</p> : null}
                  </div>
                  <div className="rowActions">
                    {myVote ? (
                      <button className="secondary inline" type="button" onClick={() => removeVote(movie.id)} disabled={busy === `vote-remove-${movie.id}`}>
                        {busy === `vote-remove-${movie.id}` ? "Removing..." : "Remove my vote"}
                      </button>
                    ) : (
                      <button className="inline" type="button" onClick={() => { setVoteMovieId(movie.id); void submitVote(); }} disabled={!activeMemberId}>
                        Quick vote
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            {availableMovies.length === 0 ? <div className="emptyState">No movies left in the backlog.</div> : null}
          </div>
        </section>
      </>
    );
  }

  function renderHistory() {
    return (
      <>
        <section className="card">
          <div className="sectionHeading">
            <div>
              <span className="eyebrow">Club favorites</span>
              <h2>Top rated movies</h2>
            </div>
            <span className="badge">{data.stats.ratingsCount} ratings</span>
          </div>
          <div className="stackList">
            {topRated.length === 0 ? (
              <div className="emptyState">Once the club starts rating watched movies, the favorites board will show up here.</div>
            ) : (
              topRated.map((row) => (
                <article className="listItem" key={row.movie_id}>
                  <div>
                    <strong>{row.title}</strong>
                    <p className="muted">{row.average_rating.toFixed(1)} average • {row.rating_count} rating(s)</p>
                  </div>
                  <span className="badge success">{stars(Math.round(row.average_rating))}</span>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <div className="sectionHeading">
            <div>
              <span className="eyebrow">Rate watched movies</span>
              <h2>Your ratings</h2>
            </div>
          </div>
          <div className="grid two singleOnMobile">
            <div className="featureCard">
              <label>
                Member
                <select value={activeMemberId} onChange={(event) => setActiveMemberId(event.target.value)}>
                  {data.members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Movie
                <select value={ratingMovieId} onChange={(event) => setRatingMovieId(event.target.value)}>
                  <option value="">Choose a watched movie</option>
                  {data.watchedNights.map((night) => (
                    <option key={night.id} value={night.movie_id}>{night.movie.title}</option>
                  ))}
                </select>
              </label>
              <div className="grid two singleOnMobile">
                <label>
                  Rating
                  <select value={ratingValue} onChange={(event) => setRatingValue(event.target.value)}>
                    {["5", "4", "3", "2", "1"].map((value) => (
                      <option key={value} value={value}>{value} star{value === "1" ? "" : "s"}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Short review
                  <input value={ratingReview} onChange={(event) => setRatingReview(event.target.value)} placeholder="Optional note" />
                </label>
              </div>
              <button type="button" onClick={saveRating} disabled={!ratingMovieId || busy === "rating"}>
                {busy === "rating" ? "Saving..." : "Save rating"}
              </button>
            </div>
            <div className="featureCard">
              <strong>{activeMember?.name ?? "Member"} has rated {myRatings.length} movie(s)</strong>
              <div className="stackList compactTop">
                {myRatings.slice(0, 8).map((row) => (
                  <div className="listItem" key={`${row.movie_id}-${row.member_id}`}>
                    <div>
                      <strong>{row.movie.title}</strong>
                      <p className="muted">{stars(row.rating)}{row.review ? ` • ${row.review}` : ""}</p>
                    </div>
                  </div>
                ))}
                {myRatings.length === 0 ? <div className="emptyState">No ratings yet for this member.</div> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="sectionHeading">
            <div>
              <span className="eyebrow">Watched list</span>
              <h2>History</h2>
            </div>
          </div>
          <div className="stackList">
            {data.watchedNights.map((night) => {
              const rating = ratingLookup.get(night.movie_id);
              return (
                <article className="listItem" key={night.id}>
                  <div>
                    <strong>{night.movie.title}</strong>
                    <p className="muted">
                      Watched {formatDate(night.watched_on)} • Picked by {night.picked_by?.name ?? "Unknown"}
                    </p>
                    <p className="muted">
                      {rating ? `${rating.average_rating.toFixed(1)} avg from ${rating.rating_count} rating(s)` : "No ratings yet"}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  function renderSettings() {
    return (
      <>
        <section className="card">
          <div className="sectionHeading">
            <div>
              <span className="eyebrow">Access</span>
              <h2>Club profile</h2>
            </div>
            <button className="secondary inline" type="button" onClick={handleLogout}>Log out</button>
          </div>
          <div className="grid two singleOnMobile">
            <div className="featureCard">
              <label>
                Active member
                <select value={activeMemberId} onChange={(event) => setActiveMemberId(event.target.value)}>
                  {data.members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Email address
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  placeholder="hello@example.com"
                />
              </label>
              <label className="checkRow">
                <input type="checkbox" checked={notifyEnabled} onChange={(event) => setNotifyEnabled(event.target.checked)} />
                Email me when a movie night changes
              </label>
              <button type="button" onClick={handleProfileSave} disabled={busy === "profile"}>
                {busy === "profile" ? "Saving..." : "Save profile"}
              </button>
            </div>
            <div className="featureCard">
              <strong>Export the club history</strong>
              <p>Use these to save a local backup or pull the movie log into a spreadsheet.</p>
              <div className="rowActions compactTop">
                <a className="buttonLink inline secondaryLink" href="/api/export?format=json">Download JSON</a>
                <a className="buttonLink inline secondaryLink" href="/api/export?format=csv">Download CSV</a>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="sectionHeading">
            <div>
              <span className="eyebrow">Rotation board</span>
              <h2>Who is up next</h2>
            </div>
          </div>
          <div className="stackList">
            {data.rotation.map((row) => (
              <article className="listItem" key={row.member_id}>
                <div>
                  <strong>{row.rotation_rank}. {row.name}</strong>
                  <p className="muted">{row.watched_picks} watched • {row.scheduled_picks} scheduled • {row.total_turns} total turn(s)</p>
                </div>
                {row.rotation_rank === 1 ? <span className="badge success">On deck</span> : null}
              </article>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderDashboard() {
    return (
      <>
        <section className="card hero">
          <span className="eyebrow">Private movie clubhouse</span>
          <h1>Moobie Clurb</h1>
          <p className="subline">Shared tracker, votes, history, notifications, and now a cleaner multi-page setup with a club password gate.</p>
          <div className="statsGrid statsFive">
            <div className="stat"><div className="label">Movies</div><div className="value">{data.stats.totalMovies}</div></div>
            <div className="stat"><div className="label">Backlog</div><div className="value">{data.stats.availableCount}</div></div>
            <div className="stat"><div className="label">Scheduled</div><div className="value">{data.stats.scheduledCount}</div></div>
            <div className="stat"><div className="label">Watched</div><div className="value">{data.stats.watchedCount}</div></div>
            <div className="stat"><div className="label">Votes</div><div className="value">{data.stats.voteCount}</div></div>
          </div>
        </section>

        <div className="grid two singleOnMobile">
          <section className="card">
            <div className="sectionHeading">
              <div>
                <span className="eyebrow">Quick look</span>
                <h2>Upcoming</h2>
              </div>
              <Link className="buttonLink inline secondaryLink" href="/schedule">Open schedule</Link>
            </div>
            <div className="stackList">
              {data.scheduledNights.slice(0, 3).map((night) => (
                <article key={night.id} className="listItem">
                  <div>
                    <strong>{night.movie.title}</strong>
                    <p className="muted">{formatDate(night.scheduled_for)} • {night.picked_by?.name ?? "No picker"}</p>
                  </div>
                </article>
              ))}
              {data.scheduledNights.length === 0 ? <div className="emptyState">No scheduled movie nights yet.</div> : null}
            </div>
          </section>
          <section className="card">
            <div className="sectionHeading">
              <div>
                <span className="eyebrow">On deck</span>
                <h2>Rotation snapshot</h2>
              </div>
              <Link className="buttonLink inline secondaryLink" href="/wheel">Open wheel</Link>
            </div>
            <div className="stackList">
              {data.rotation.slice(0, 4).map((row) => (
                <article key={row.member_id} className="listItem">
                  <div>
                    <strong>{row.rotation_rank}. {row.name}</strong>
                    <p className="muted">{row.total_turns} total turn(s)</p>
                  </div>
                  {row.rotation_rank === 1 ? <span className="badge success">Next</span> : null}
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="grid two singleOnMobile">
          <section className="card">
            <div className="sectionHeading">
              <div>
                <span className="eyebrow">Favorites</span>
                <h2>Top rated</h2>
              </div>
              <Link className="buttonLink inline secondaryLink" href="/history">Open history</Link>
            </div>
            <div className="stackList">
              {topRated.slice(0, 4).map((row) => (
                <article key={row.movie_id} className="listItem">
                  <div>
                    <strong>{row.title}</strong>
                    <p className="muted">{row.average_rating.toFixed(1)} average from {row.rating_count} rating(s)</p>
                  </div>
                </article>
              ))}
              {topRated.length === 0 ? <div className="emptyState">No ratings yet.</div> : null}
            </div>
          </section>
          <section className="card">
            <div className="sectionHeading">
              <div>
                <span className="eyebrow">Backlog</span>
                <h2>Most wanted</h2>
              </div>
              <Link className="buttonLink inline secondaryLink" href="/backlog">Open backlog</Link>
            </div>
            <div className="stackList">
              {[...data.votes].sort((a, b) => b.vote_count - a.vote_count).slice(0, 4).map((row) => (
                <article key={row.movie_id} className="listItem">
                  <div>
                    <strong>{row.title}</strong>
                    <p className="muted">{row.vote_count} vote(s)</p>
                  </div>
                </article>
              ))}
              {data.votes.length === 0 ? <div className="emptyState">Votes will show up here once the club starts using them.</div> : null}
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <main className="appShell">
      <header className="topbar card">
        <div>
          <span className="eyebrow">Moobie Clurb</span>
          <h1 className="topTitle">Members only</h1>
        </div>
        <nav className="navTabs" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={item.view === view ? "navTab active" : "navTab"}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {message ? <div className="messageBar">{message}</div> : null}

      {view === "dashboard" ? renderDashboard() : null}
      {view === "schedule" ? (
        <>
          {renderScheduleForm()}
          {renderScheduledList()}
        </>
      ) : null}
      {view === "backlog" ? renderBacklog() : null}
      {view === "history" ? renderHistory() : null}
      {view === "wheel" ? <MemberPickerWheel members={data.rotation} /> : null}
      {view === "settings" ? renderSettings() : null}
    </main>
  );
}
