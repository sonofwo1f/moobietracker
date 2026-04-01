'use client';

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nextPath = params.get("next") || "/";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy(true);
      setError("");
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Could not sign in.");
      window.location.href = nextPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authWrap">
      <section className="authCard">
        <div className="authHeader">
          <span className="eyebrow">Private clubhouse</span>
          <h1>Moobie Clurb</h1>
          <p>Enter the shared club password to get in.</p>
        </div>
        <form onSubmit={handleSubmit} className="authForm">
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Club password"
            />
          </label>
          {error ? <div className="messageBar dangerBar">{error}</div> : null}
          <button type="submit" disabled={busy}>
            {busy ? "Unlocking..." : "Unlock site"}
          </button>
        </form>
      </section>
    </main>
  );
}
