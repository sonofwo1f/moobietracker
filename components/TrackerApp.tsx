'use client';

import { useEffect, useMemo, useState } from "react";
import type { DashboardData, Member, MovieNight } from "@/lib/types";

type PickerResult = { title: string; runtime_minutes: number | null; reason: string } | null;
type ScheduleEditor = {
  movie_id: string;
  picked_by_member_id: string;
  scheduled_for: string;
  notes: string;
  attendee_ids: string[];
};

async function postJSON(url: string, body: Record<string, unknown>, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

export function TrackerApp({ initialData }: { initialData: DashboardData }) {
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

  async function refresh() {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    setData(await res.json());
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
      setMessage(notifyEnabled ? "Movie night scheduled. Notification event logged too." : "Movie night scheduled.");
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

  async function runPicker() {
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

  async function castVote() {
    try {
      if (!activeMemberId || !voteMovieId) return setMessage("Pick a member and a movie first.");
      setBusy("vote");
      setMessage(null);
      await postJSON("/api/votes", { member_id: activeMemberId, movie_id: voteMovieId });
      await refresh();
      setMessage("Vote saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save vote.");
    } finally {
      setBusy(null);
    }
  }

  async function clearVote(movieId: string) {
    try {
      if (!activeMemberId) return setMessage("Choose a member first.");
      setBusy(`unvote-${movieId}`);
      setMessage(null);
      await postJSON("/api/votes", { member_id: activeMemberId, movie_id: movieId }, "DELETE");
      await refresh();
      setMessage("Vote removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove vote.");
    } finally {
      setBusy(null);
    }
  }

  async function saveRating() {
    try {
      if (!activeMemberId || !ratingMovieId) return setMessage("Pick a member and a watched movie first.");
      setBusy("rating");
      setMessage(null);
      await postJSON("/api/ratings", {
        member_id: activeMemberId,
        movie_id: ratingMovieId,
        rating: Number(ratingValue),
        review: ratingReview,
      });
      await refresh();
      setMessage("Rating saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save rating.");
    } finally {
      setBusy(null);
    }
  }

  async function removeRating(movieId: string) {
    try {
      if (!activeMemberId) return setMessage("Choose a member first.");
      setBusy(`remove-rating-${movieId}`);
      setMessage(null);
      await postJSON("/api/ratings", { member_id: activeMemberId, movie_id: movieId }, "DELETE");
      await refresh();
      setMessage("Rating removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove rating.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main>
      <section className="card hero">
        <div>
          <div className="eyebrow">Moobie Clurb HQ</div>
          <h1>Club identity, ratings, exports, and smarter scheduling.</h1>
          <p className="subline">This version keeps the mobile-first tracker, adds remembered member identity, watched-movie ratings, backup export buttons, and notification-ready scheduling.</p>
        </div>
        <div className="statsGrid statsFive">
          <div className="stat"><div className="label">Total movies</div><div className="value">{data.stats.totalMovies}</div></div>
          <div className="stat"><div className="label">Available</div><div className="value">{data.stats.availableCount}</div></div>
          <div className="stat"><div className="label">Scheduled</div><div className="value">{data.stats.scheduledCount}</div></div>
          <div className="stat"><div className="label">Votes cast</div><div className="value">{data.stats.voteCount}</div></div>
          <div className="stat"><div className="label">Ratings</div><div className="value">{data.stats.ratingsCount}</div></div>
        </div>
        {message ? <div className="messageBar">{message}</div> : null}
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Your club profile</h2>
          <p>Choose who you are on this device, add an email, and opt in for future schedule notifications.</p>
          <label>
            Active member
            <select value={activeMemberId} onChange={(e) => setActiveMemberId(e.target.value)}>
              {data.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>
          <label>
            Email
            <input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="name@example.com" />
          </label>
          <label className="checkRow">
            <input type="checkbox" checked={notifyEnabled} onChange={(e) => setNotifyEnabled(e.target.checked)} />
            <span>Receive schedule notifications when something is added or changed</span>
          </label>
          <div className="rowActions compactTop">
            <button className="inline" onClick={() => void handleProfileSave()} disabled={busy === "profile"}>{busy === "profile" ? "Saving..." : "Save profile"}</button>
            <span className="muted">Identity is remembered on this device. Email delivery can be turned on later with a webhook or mail provider.</span>
          </div>
        </div>

        <div className="card">
          <h2>Backup and export</h2>
          <p>Download a full JSON backup or a simple CSV snapshot anytime.</p>
          <div className="rowActions compactTop">
            <a className="buttonLink" href="/api/export?format=json">Download JSON backup</a>
            <a className="buttonLink secondaryLink" href="/api/export?format=csv">Download CSV</a>
          </div>
          <div className="featureCard compactTop">
            <div className="eyebrow">Next up</div>
            <h3>{nextUp?.name ?? "Nobody yet"}</h3>
            <p>{nextUp ? `${nextUp.total_turns} total turns so far. Rotation still favors whoever has had the fewest turns.` : "Rotation will appear once members have activity."}</p>
          </div>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Club picker</h2>
          <form onSubmit={(e) => { e.preventDefault(); void runPicker(); }}>
            <label>Picker mode
              <select value={pickerMode} onChange={(e) => setPickerMode(e.target.value)}>
                <option value="vote-rotation">Votes + turn rotation</option>
                <option value="turn-rotation">Turn rotation first</option>
                <option value="short-night">Short night</option>
                <option value="epic-night">Epic night</option>
                <option value="pure-random">Pure random</option>
              </select>
            </label>
            <label>Max runtime in minutes
              <input inputMode="numeric" placeholder="Optional, like 120" value={filterMaxRuntime} onChange={(e) => setFilterMaxRuntime(e.target.value)} />
            </label>
            <button type="submit" disabled={busy === "picker"}>{busy === "picker" ? "Picking..." : "Pick a movie"}</button>
          </form>
          {pickerResult ? <div className="featureCard compactTop"><div className="badge success">Suggestion</div><h3>{pickerResult.title}</h3><p>{pickerResult.runtime_minutes ? `${pickerResult.runtime_minutes} min` : "Unknown runtime"}</p><p>{pickerResult.reason}</p></div> : null}
        </div>

        <div className="card">
          <h2>Voting</h2>
          <p>Votes now default to your active member profile.</p>
          <label>Movie to vote for
            <select value={voteMovieId} onChange={(e) => setVoteMovieId(e.target.value)}>
              <option value="">Choose a movie</option>
              {availableMovies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}
            </select>
          </label>
          <button onClick={() => void castVote()} disabled={busy === "vote"}>{busy === "vote" ? "Saving..." : `Vote as ${activeMember?.name ?? "member"}`}</button>
          <div className="stackList compactTop scrollList">
            {data.votes.slice(0, 8).map((vote) => (
              <div className="listItem" key={vote.movie_id}>
                <div>
                  <strong>{vote.title}</strong>
                  <div className="muted">{vote.vote_count} votes · {vote.voters.join(", ") || "No voters yet"}</div>
                </div>
                <button className="inline secondary" onClick={() => void clearVote(vote.movie_id)} disabled={busy === `unvote-${vote.movie_id}`}>Remove mine</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Schedule a movie night</h2>
        <form action={handleScheduleMovie}>
          <div className="grid two singleOnMobile compactTop">
            <label>Movie
              <select name="movie_id" required>
                <option value="">Choose a movie</option>
                {availableMovies.map((movie) => (
                  <option key={movie.id} value={movie.id}>{movie.title}{movie.runtime_minutes ? ` · ${movie.runtime_minutes} min` : ""}</option>
                ))}
              </select>
            </label>
            <label>Picked by
              <select name="picked_by_member_id" defaultValue={activeMemberId || nextUp?.member_id || ""}>
                {data.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label>Date
              <input type="date" name="scheduled_for" />
            </label>
            <label>Notes
              <input name="notes" placeholder="Theme, host, snacks, anything helpful" />
            </label>
          </div>
          <div className="sectionLabel compactTop">Attendees</div>
          <div className="memberPills">
            {data.members.map((member) => (
              <label key={member.id} className="pill"><input type="checkbox" name="attendee_ids" value={member.id} defaultChecked={member.id === activeMemberId} /> {member.name}</label>
            ))}
          </div>
          <button className="compactTop" type="submit" disabled={busy === "scheduleMovie"}>{busy === "scheduleMovie" ? "Scheduling..." : "Schedule movie night"}</button>
        </form>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Upcoming / scheduled</h2>
          <div className="stackList compactTop">
            {data.scheduledNights.length === 0 ? <div className="emptyState">Nothing scheduled yet.</div> : data.scheduledNights.map((night) => {
              const isEditing = editingNightId === night.id && editorState;
              return (
                <div className="featureCard" key={night.id}>
                  <div className="rowSplit"><strong>{night.movie.title}</strong><span className="badge warning">{formatDate(night.scheduled_for)}</span></div>
                  <p>Picked by {night.picked_by?.name ?? "Unknown"}</p>
                  <p>{night.notes || "No notes yet."}</p>
                  <div className="muted">Attendees: {night.attendees.map((a) => a.member.name).join(", ") || "None yet"}</div>
                  <div className="rowActions">
                    <button className="inline secondary" onClick={() => startEditing(night)}>Edit</button>
                    <button className="inline" onClick={() => void markWatched(night.id)} disabled={busy === night.id}>Mark watched</button>
                    <button className="inline danger" onClick={() => void removeScheduledNight(night.id)} disabled={busy === `remove-${night.id}`}>Remove</button>
                  </div>
                  {isEditing ? (
                    <div className="editPanel">
                      <label>Movie
                        <select value={editorState.movie_id} onChange={(e) => setEditorState({ ...editorState, movie_id: e.target.value })}>
                          {schedulableMoviesFor(night).map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}
                        </select>
                      </label>
                      <label>Picked by
                        <select value={editorState.picked_by_member_id} onChange={(e) => setEditorState({ ...editorState, picked_by_member_id: e.target.value })}>
                          <option value="">Unassigned</option>
                          {data.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                        </select>
                      </label>
                      <label>Date
                        <input type="date" value={editorState.scheduled_for} onChange={(e) => setEditorState({ ...editorState, scheduled_for: e.target.value })} />
                      </label>
                      <label>Notes
                        <textarea value={editorState.notes} onChange={(e) => setEditorState({ ...editorState, notes: e.target.value })} />
                      </label>
                      <div className="memberPills">
                        {data.members.map((member) => (
                          <label key={member.id} className="pill"><input type="checkbox" checked={editorState.attendee_ids.includes(member.id)} onChange={(e) => toggleEditorAttendee(member.id, e.target.checked)} /> {member.name}</label>
                        ))}
                      </div>
                      <div className="rowActions">
                        <button className="inline" onClick={() => void saveScheduledEdit()} disabled={busy === `edit-${night.id}`}>Save changes</button>
                        <button className="inline secondary" onClick={cancelEditing}>Cancel</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2>Ratings + club favorites</h2>
          <p>Rate watched movies from 1 to 5 stars. Your rating sticks to your active member profile.</p>
          <div className="grid two singleOnMobile compactTop">
            <label>Watched movie
              <select value={ratingMovieId} onChange={(e) => setRatingMovieId(e.target.value)}>
                <option value="">Choose a watched movie</option>
                {data.watchedNights.map((night) => <option key={night.id} value={night.movie_id}>{night.movie.title}</option>)}
              </select>
            </label>
            <label>Rating
              <select value={ratingValue} onChange={(e) => setRatingValue(e.target.value)}>
                {[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
              </select>
            </label>
          </div>
          <label className="compactTop">Short note
            <input value={ratingReview} onChange={(e) => setRatingReview(e.target.value)} placeholder="What worked, what surprised you, why it ruled or did not" />
          </label>
          <button className="compactTop" onClick={() => void saveRating()} disabled={busy === "rating"}>{busy === "rating" ? "Saving..." : `Save rating as ${activeMember?.name ?? "member"}`}</button>
          <div className="featureCard compactTop">
            <div className="eyebrow">Top rated right now</div>
            <div className="stackList">
              {data.ratingSummary.slice(0, 5).map((row) => (
                <div className="listItem" key={row.movie_id}>
                  <div>
                    <strong>{row.title}</strong>
                    <div className="muted">{row.average_rating.toFixed(2)} average · {row.rating_count} rating{row.rating_count === 1 ? "" : "s"}</div>
                  </div>
                  <span className="badge success">{row.average_rating.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="sectionLabel compactTop">Your recent ratings</div>
          <div className="stackList scrollList">
            {myRatings.length === 0 ? <div className="emptyState">No ratings from this member yet.</div> : myRatings.slice().reverse().map((row) => (
              <div className="listItem" key={`${row.movie_id}-${row.member_id}`}>
                <div>
                  <strong>{row.movie.title}</strong>
                  <div className="muted">{stars(row.rating)}{row.review ? ` · ${row.review}` : ""}</div>
                </div>
                <button className="inline secondary" onClick={() => void removeRating(row.movie_id)} disabled={busy === `remove-rating-${row.movie_id}`}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
