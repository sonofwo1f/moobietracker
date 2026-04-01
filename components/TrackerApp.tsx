'use client';

import { useMemo, useState } from "react";
import type { DashboardData, MovieNight } from "@/lib/types";

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
  if (!res.ok) {
    throw new Error(payload.error || "Something went wrong.");
  }
  return payload;
}

function formatDate(value: string | null) {
  if (!value) return "TBD";
  return new Date(`${value}T12:00:00`).toLocaleDateString();
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
  const [pickerResult, setPickerResult] = useState<PickerResult>(null);
  const [filterMaxRuntime, setFilterMaxRuntime] = useState("");
  const [pickerMode, setPickerMode] = useState("vote-rotation");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedVoter, setSelectedVoter] = useState(data.members[0]?.id ?? "");
  const [voteMovieId, setVoteMovieId] = useState("");
  const [editingNightId, setEditingNightId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<ScheduleEditor | null>(null);

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

  const nextUp = data.rotation[0] ?? null;

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
    setMessage(null);
  }

  function cancelEditing() {
    setEditingNightId(null);
    setEditorState(null);
  }

  function toggleEditorAttendee(memberId: string, checked: boolean) {
    setEditorState((current) => {
      if (!current) return current;
      const currentIds = new Set(current.attendee_ids);
      if (checked) currentIds.add(memberId);
      else currentIds.delete(memberId);
      return { ...current, attendee_ids: [...currentIds] };
    });
  }

  async function handleAddMovie(formData: FormData) {
    try {
      setBusy("addMovie");
      setMessage(null);
      await postJSON("/api/movies", {
        title: formData.get("title"),
        runtime_minutes: formData.get("runtime_minutes"),
      });
      await refresh();
      setMessage("Movie added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add movie.");
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
      await postJSON("/api/nights", {
        action: "update_schedule",
        night_id: editingNightId,
        ...editorState,
      });
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
      const payload = await postJSON("/api/picker", {
        max_runtime: filterMaxRuntime || null,
        mode: pickerMode,
      });
      setPickerResult(payload.result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not pick a movie.");
    } finally {
      setBusy(null);
    }
  }

  async function castVote() {
    try {
      if (!selectedVoter || !voteMovieId) {
        setMessage("Choose a member and a movie first.");
        return;
      }
      setBusy("vote");
      setMessage(null);
      await postJSON("/api/votes", { member_id: selectedVoter, movie_id: voteMovieId });
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
      if (!selectedVoter) {
        setMessage("Choose a member first.");
        return;
      }
      setBusy(`unvote-${movieId}`);
      setMessage(null);
      await postJSON("/api/votes", { member_id: selectedVoter, movie_id: movieId }, "DELETE");
      await refresh();
      setMessage("Vote removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove vote.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main>
      <section className="card hero">
        <div>
          <div className="eyebrow">Moobie Clurb HQ</div>
          <h1>Vote smarter, rotate turns, pick faster.</h1>
          <p className="subline">Shared movie tracker with club voting, an on-deck rotation, and an iPhone-friendly layout.</p>
        </div>
        <div className="statsGrid">
          <div className="stat"><div className="label">Total movies</div><div className="value">{data.stats.totalMovies}</div></div>
          <div className="stat"><div className="label">Available</div><div className="value">{data.stats.availableCount}</div></div>
          <div className="stat"><div className="label">Watched</div><div className="value">{data.stats.watchedCount}</div></div>
          <div className="stat"><div className="label">Votes cast</div><div className="value">{data.stats.voteCount}</div></div>
        </div>
        {message ? <div className="messageBar">{message}</div> : null}
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Club picker</h2>
          <p>Use votes plus turn rotation, or switch to a runtime-based mode.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runPicker();
            }}
          >
            <label>
              Picker mode
              <select value={pickerMode} onChange={(e) => setPickerMode(e.target.value)}>
                <option value="vote-rotation">Votes + turn rotation</option>
                <option value="turn-rotation">Turn rotation first</option>
                <option value="short-night">Short night</option>
                <option value="epic-night">Epic night</option>
                <option value="pure-random">Pure random</option>
              </select>
            </label>
            <label>
              Max runtime in minutes
              <input inputMode="numeric" placeholder="Optional, like 120" value={filterMaxRuntime} onChange={(e) => setFilterMaxRuntime(e.target.value)} />
            </label>
            <button type="submit" disabled={busy === "picker"}>{busy === "picker" ? "Picking..." : "Pick a movie"}</button>
          </form>
          {pickerResult ? (
            <div className="featureCard compactTop">
              <div className="badge success">Suggestion</div>
              <h3>{pickerResult.title}</h3>
              <p>Runtime: {pickerResult.runtime_minutes ? `${pickerResult.runtime_minutes} min` : "Unknown"}</p>
              <p>{pickerResult.reason}</p>
            </div>
          ) : null}
        </div>

        <div className="card">
          <h2>On deck</h2>
          <p>The rotation favors whoever has had the fewest total turns so far.</p>
          {nextUp ? (
            <div className="featureCard">
              <div className="eyebrow">Next up</div>
              <h3>{nextUp.name}</h3>
              <p>{nextUp.total_turns} total turns so far, with {nextUp.watched_picks} already watched and {nextUp.scheduled_picks} still queued.</p>
            </div>
          ) : null}
          <div className="stackList compactTop">
            {data.rotation.slice(0, 4).map((row) => (
              <div className="listItem" key={row.member_id}>
                <div>
                  <strong>#{row.rotation_rank} {row.name}</strong>
                  <div className="muted">Watched {row.watched_picks} · Scheduled {row.scheduled_picks}</div>
                </div>
                <span className="badge">{row.total_turns} turns</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Cast votes</h2>
          <p>Pick a club member, then vote for anything still in the backlog.</p>
          <div className="voteControls">
            <label>
              Voting as
              <select value={selectedVoter} onChange={(e) => setSelectedVoter(e.target.value)}>
                {data.members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
            <label>
              Movie
              <select value={voteMovieId} onChange={(e) => setVoteMovieId(e.target.value)}>
                <option value="">Choose one</option>
                {availableMovies.map((movie) => (
                  <option key={movie.id} value={movie.id}>{movie.title}{movie.runtime_minutes ? ` (${movie.runtime_minutes} min)` : ""}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void castVote()} disabled={busy === "vote"}>{busy === "vote" ? "Saving..." : "Cast vote"}</button>
          </div>

          <div className="stackList compactTop">
            {data.votes.length === 0 ? (
              <div className="emptyState">No votes yet. Be the first one.</div>
            ) : (
              data.votes.slice(0, 6).map((vote) => (
                <div className="listItem" key={vote.movie_id}>
                  <div>
                    <strong>{vote.title}</strong>
                    <div className="muted">{vote.voters.join(", ") || "No voters yet"}</div>
                  </div>
                  <div className="rowActions">
                    <span className="badge warning">{vote.vote_count} vote{vote.vote_count === 1 ? "" : "s"}</span>
                    <button className="inline secondary" type="button" onClick={() => void clearVote(vote.movie_id)} disabled={busy === `unvote-${vote.movie_id}`}>
                      {busy === `unvote-${vote.movie_id}` ? "Removing..." : "Remove mine"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h2>Schedule a movie night</h2>
          <p>{nextUp ? `Recommended pick owner: ${nextUp.name}.` : "Pick an owner or leave it open."}</p>
          <form action={handleScheduleMovie}>
            <label>
              Movie
              <select name="movie_id" required>
                <option value="">Choose one</option>
                {availableMovies.map((movie) => {
                  const voteInfo = voteLookup.get(movie.id);
                  return (
                    <option key={movie.id} value={movie.id}>
                      {movie.title}
                      {movie.runtime_minutes ? ` (${movie.runtime_minutes} min)` : ""}
                      {voteInfo ? ` · ${voteInfo.vote_count} vote${voteInfo.vote_count === 1 ? "" : "s"}` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Picked by
              <select name="picked_by_member_id" defaultValue={nextUp?.member_id ?? ""}>
                <option value="">No pick owner yet</option>
                {data.members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
            <label>
              Scheduled date
              <input type="date" name="scheduled_for" />
            </label>
            <label>
              Notes
              <textarea name="notes" placeholder="Host, snacks, theme, arrival time, whatever helps" />
            </label>
            <div>
              <div className="sectionLabel">Expected attendees</div>
              <div className="memberPills">
                {data.members.map((member) => (
                  <label className="pill" key={member.id}>
                    <input type="checkbox" name="attendee_ids" value={member.id} style={{ width: 16, height: 16 }} />
                    <span>{member.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" disabled={busy === "scheduleMovie"}>{busy === "scheduleMovie" ? "Saving..." : "Schedule movie night"}</button>
          </form>
        </div>
      </section>

      <section className="grid two singleOnMobile">
        <div className="card">
          <h2>Upcoming / scheduled</h2>
          <div className="stackList compactTop">
            {data.scheduledNights.length === 0 ? (
              <div className="emptyState">No scheduled nights yet.</div>
            ) : (
              data.scheduledNights.map((night) => {
                const isEditing = editingNightId === night.id && editorState;
                const editableMovies = schedulableMoviesFor(night);

                return (
                  <div className="featureCard" key={night.id}>
                    <div className="rowSplit">
                      <div>
                        <h3>{night.movie.title}</h3>
                        <div className="muted">{night.movie.runtime_minutes ? `${night.movie.runtime_minutes} min` : "Unknown runtime"}</div>
                      </div>
                      <span className="badge">{formatDate(night.scheduled_for)}</span>
                    </div>
                    <p>Picked by: {night.picked_by?.name ?? "—"}</p>
                    <p>Attending: {night.attendees.map((a) => a.member.name).join(", ") || "—"}</p>
                    <p>Notes: {night.notes || "—"}</p>

                    {isEditing ? (
                      <div className="editPanel compactTop">
                        <label>
                          Movie
                          <select
                            value={editorState.movie_id}
                            onChange={(e) => setEditorState((current) => current ? { ...current, movie_id: e.target.value } : current)}
                          >
                            {editableMovies.map((movie) => {
                              const voteInfo = voteLookup.get(movie.id);
                              return (
                                <option key={movie.id} value={movie.id}>
                                  {movie.title}
                                  {movie.runtime_minutes ? ` (${movie.runtime_minutes} min)` : ""}
                                  {voteInfo ? ` · ${voteInfo.vote_count} vote${voteInfo.vote_count === 1 ? "" : "s"}` : ""}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                        <label>
                          Picked by
                          <select
                            value={editorState.picked_by_member_id}
                            onChange={(e) => setEditorState((current) => current ? { ...current, picked_by_member_id: e.target.value } : current)}
                          >
                            <option value="">No pick owner yet</option>
                            {data.members.map((member) => (
                              <option key={member.id} value={member.id}>{member.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Scheduled date
                          <input
                            type="date"
                            value={editorState.scheduled_for}
                            onChange={(e) => setEditorState((current) => current ? { ...current, scheduled_for: e.target.value } : current)}
                          />
                        </label>
                        <label>
                          Notes
                          <textarea
                            value={editorState.notes}
                            onChange={(e) => setEditorState((current) => current ? { ...current, notes: e.target.value } : current)}
                          />
                        </label>
                        <div>
                          <div className="sectionLabel">Expected attendees</div>
                          <div className="memberPills">
                            {data.members.map((member) => (
                              <label className="pill" key={member.id}>
                                <input
                                  type="checkbox"
                                  checked={editorState.attendee_ids.includes(member.id)}
                                  onChange={(e) => toggleEditorAttendee(member.id, e.target.checked)}
                                  style={{ width: 16, height: 16 }}
                                />
                                <span>{member.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="rowActions compactTop">
                          <button type="button" onClick={() => void saveScheduledEdit()} disabled={busy === `edit-${night.id}`}>
                            {busy === `edit-${night.id}` ? "Saving..." : "Save changes"}
                          </button>
                          <button className="secondary" type="button" onClick={cancelEditing}>Cancel</button>
                        </div>
                      </div>
                    ) : null}

                    <div className="rowActions compactTop">
                      <button className="secondary" type="button" onClick={() => startEditing(night)} disabled={busy === `remove-${night.id}` || busy === night.id}>
                        Edit
                      </button>
                      <button className="secondary" onClick={() => void markWatched(night.id)} disabled={busy === night.id}>
                        {busy === night.id ? "Saving..." : "Mark watched"}
                      </button>
                      <button className="danger" type="button" onClick={() => void removeScheduledNight(night.id)} disabled={busy === `remove-${night.id}`}>
                        {busy === `remove-${night.id}` ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <h2>Add a movie</h2>
          <p>Drop a new title into the shared backlog.</p>
          <form action={handleAddMovie}>
            <label>
              Movie title
              <input name="title" required placeholder="Movie title" />
            </label>
            <label>
              Runtime in minutes
              <input name="runtime_minutes" inputMode="numeric" placeholder="Optional" />
            </label>
            <button type="submit" disabled={busy === "addMovie"}>{busy === "addMovie" ? "Adding..." : "Add movie"}</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>Backlog pulse</h2>
        <div className="stackList compactTop">
          {availableMovies.map((movie) => {
            const voteInfo = voteLookup.get(movie.id);
            return (
              <div className="listItem" key={movie.id}>
                <div>
                  <strong>{movie.title}</strong>
                  <div className="muted">{movie.runtime_minutes ? `${movie.runtime_minutes} min` : "Runtime unknown"} · {movie.source_list ?? "source unknown"}</div>
                </div>
                <span className="badge warning">{voteInfo?.vote_count ?? 0} vote{(voteInfo?.vote_count ?? 0) === 1 ? "" : "s"}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Watch history</h2>
        <div className="stackList compactTop">
          {data.watchedNights.map((night) => (
            <div className="listItem" key={night.id}>
              <div>
                <strong>{night.movie.title}</strong>
                <div className="muted">Picked by {night.picked_by?.name ?? "—"} · Watched {formatDate(night.watched_on)}</div>
              </div>
              <span className="badge">{night.attendees.length} attending</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
