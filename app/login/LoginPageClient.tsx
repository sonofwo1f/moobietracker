"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");

  const next = searchParams.get("next") || "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push(next);
      router.refresh();
    } else {
      alert("Incorrect password");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Moobie Clurb</h1>
        <p className="text-sm opacity-70 mb-4">Enter the club password to continue.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border px-3 py-2"
          />
          <button
            type="submit"
            className="w-full rounded-lg border px-3 py-2 font-medium"
          >
            Enter
          </button>
        </form>
      </div>
    </main>
  );
}
