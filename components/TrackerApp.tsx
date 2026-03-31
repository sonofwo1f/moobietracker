'use client';

import { useMemo, useState } from "react";
import type { DashboardData } from "@/lib/types";

type PickerResult = { title: string; runtime_minutes: number | null; reason: string } | null;

async function postJSON(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Something went wrong.");
  }
  return payload;
}

export function TrackerApp({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState<string | null>(null);
  const [pickerResult, setPickerResult] = useState<PickerResult>(null);
  const [filterMaxRuntime, setFilterMaxRuntime] = useState("");
  const [pickerMode, setPickerMode] = useState("fairness");
  const [message, setMessage] = useState<string | null>(null);

  const availableMovies = useMemo(() => {
    const max = Number(filterMaxRuntime);
    if (!filterMaxRuntime || Number.isNaN(max)) return data.availableMovies;
    return data.availableMovies.filter((movie) => (movie.runtime_minutes ?? 0) <= max);
  }, [data.availableMovies, filterMaxRuntime]);

  async function refresh() {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    const payload = await res.json();
    setData(payload);
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

  async function markWatched(nightId: string) {
    try {
      setBusy(nightId);
      setMessage(null);
      await postJSON("/api/nights", { action: "mark_watched", night_id: nightId });
      await refresh();
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

  return (
    <main>
      <section className="card hero">
        <div>
          <h1>Moobie Clurb</h1>
          <p className="subline">Shared movie tracker, picker, schedule board, and fairness dashboard.</p>
        </div>
        <div className="grid three">
          <div className="stat">
            <div className="label">Total movies</div>
            <div className="value">{data.stats.totalMovies}</div>
          </div>
          <div className="stat">
            <div className="label">Available to pick</div>
            <div className="value">{data.stats.availableCount}</div>
          </div>
          <div className="stat">
            <div className="label">Already watched</div>
            <div className="value">{data.stats.watchedCount}</div>
          </div>
        </div>
        {message ? <p>{message}</p> : null}
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Pick the next movie</h2>
          <p>Run a quick picker. Fairness mode nudges the result toward members who have had fewer picks.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runPicker();
            }}
          >
            <label>
              Picker mode
              <select value={pickerMode} onChange={(e) => setPickerMode(e.target.value)}>
                <option value="fairness">Fairness</option>
                <option value="short-night">Short night</option>
                <option value="epic-night">Epic night</option>
                <option value="pure-random">Pure random</option>
              </select>
            </label>
            <label>
              Max runtime in minutes
              <input inputMode="numeric" placeholder="Optional, like 120" value={filterMaxRuntime} onChange={(e) => setFilterMaxRuntime(e.target.value)} />
            </label>
            <button type="submit" disabled={busy === "picker"}>
              {busy === "picker" ? "Picking..." : "Pick a movie"}
            </button>
          </form>

          {pickerResult ? (
            <div className="card" style={{ marginTop: 12, padding: 14 }}>
              <div className="badge success">Suggestion</div>
              <h3 style={{ marginTop: 10 }}>{pickerResult.title}</h3>
              <p>
                Runtime: {pickerResult.runtime_minutes ? `${pickerResult.runtime_minutes} min` : "Unknown"}<br />
                {pickerResult.reason}
              </p>
            </div>
          ) : null}
        </div>

        <div className="card">
          <h2>Add a movie</h2>
          <p>Add a new movie to the backlog without touching the database directly.</p>
          <form action={handleAddMovie}>
            <label>
              Movie title
              <input name="title" required placeholder="Movie title" />
            </label>
            <label>
              Runtime in minutes
              <input name="runtime_minutes" inputMode="numeric" placeholder="Optional" />
            </label>
            <button type="submit" disabled={busy === "addMovie"}>
              {busy === "addMovie" ? "Adding..." : "Add movie"}
            </button>
          </form>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Schedule a movie night</h2>
          <form action={handleScheduleMovie}>
            <label>
              Movie
              <select name="movie_id" required>
                <option value="">Choose one</option>
                {availableMovies.map((movie) => (
                  <option key={movie.id} value={movie.id}>
                    {movie.title}{movie.runtime_minutes ? ` (${movie.runtime_minutes} min)` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Picked by
              <select name="picked_by_member_id">
                <option value="">No pick owner yet</option>
                {data.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Scheduled date
              <input type="date" name="scheduled_for" />
            </label>
            <label>
              Notes
              <textarea name="notes" placeholder="Snacks, theme, host, or anything else" />
            </label>
            <div>
              <div style={{ marginBottom: 8, color: "var(--accent-2)" }}>Expected attendees</div>
              <div className="memberPills">
                {data.members.map((member) => (
                  <label className="pill" key={member.id}>
                    <input type="checkbox" name="attendee_ids" value={member.id} style={{ width: 16, height: 16 }} />
                    <span>{member.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" disabled={busy === "scheduleMovie"}>
              {busy === "scheduleMovie" ? "Saving..." : "Schedule movie night"}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Fairness board</h2>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Watched picks</th>
                  <th>Scheduled picks</th>
                </tr>
              </thead>
              <tbody>
                {data.fairness.map((row) => (
                  <tr key={row.member_id}>
                    <td>{row.name}</td>
                    <td>{row.watched_picks}</td>
                    <td>{row.scheduled_picks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footerNote">This is the simplest fairness view: who has had watched picks and who still has future picks queued up.</p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Upcoming / scheduled</h2>
        <div className="tableWrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Movie</th>
                <th>Picked by</th>
                <th>Date</th>
                <th>Attendees</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.scheduledNights.length === 0 ? (
                <tr>
                  <td colSpan={6}>No scheduled nights yet.</td>
                </tr>
              ) : (
                data.scheduledNights.map((night) => (
                  <tr key={night.id}>
                    <td>
                      <strong>{night.movie.title}</strong><br />
                      <span className="badge warning">{night.movie.runtime_minutes ? `${night.movie.runtime_minutes} min` : "Unknown runtime"}</span>
                    </td>
                    <td>{night.picked_by?.name ?? "—"}</td>
                    <td>{night.scheduled_for ?? "TBD"}</td>
                    <td>{night.attendees.map((a) => a.member.name).join(", ") || "—"}</td>
                    <td>{night.notes || "—"}</td>
                    <td>
                      <div className="rowActions">
                        <button className="inline secondary" onClick={() => void markWatched(night.id)} disabled={busy === night.id}>
                          {busy === night.id ? "Saving..." : "Mark watched"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Available backlog</h2>
        <div className="tableWrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Movie</th>
                <th>Runtime</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {availableMovies.map((movie) => (
                <tr key={movie.id}>
                  <td>{movie.title}</td>
                  <td>{movie.runtime_minutes ? `${movie.runtime_minutes} min` : "—"}</td>
                  <td>{movie.source_list ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Watch history</h2>
        <div className="tableWrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Movie</th>
                <th>Picked by</th>
                <th>Watched on</th>
                <th>Attendees</th>
              </tr>
            </thead>
            <tbody>
              {data.watchedNights.map((night) => (
                <tr key={night.id}>
                  <td>{night.movie.title}</td>
                  <td>{night.picked_by?.name ?? "—"}</td>
                  <td>{night.watched_on ?? "—"}</td>
                  <td>{night.attendees.map((a) => a.member.name).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
