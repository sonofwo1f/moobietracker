import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const maxRuntime = body.max_runtime ? Number(body.max_runtime) : null;
    const mode = String(body.mode ?? "fairness");
    const data = await getDashboardData();

    const candidates = data.availableMovies.filter((movie) =>
      maxRuntime && Number.isFinite(maxRuntime) ? (movie.runtime_minutes ?? 0) <= maxRuntime : true
    );
    if (candidates.length === 0) {
      return NextResponse.json({ error: "No movies match that filter." }, { status: 400 });
    }

    let result: { title: string; runtime_minutes: number | null; reason: string };
    if (mode === "short-night") {
      const sorted = [...candidates].sort((a, b) => (a.runtime_minutes ?? 999) - (b.runtime_minutes ?? 999)).slice(0, 10);
      const picked = pickOne(sorted);
      result = { title: picked.title, runtime_minutes: picked.runtime_minutes, reason: "Biased toward shorter runtimes." };
    } else if (mode === "epic-night") {
      const sorted = [...candidates].sort((a, b) => (b.runtime_minutes ?? 0) - (a.runtime_minutes ?? 0)).slice(0, 10);
      const picked = pickOne(sorted);
      result = { title: picked.title, runtime_minutes: picked.runtime_minutes, reason: "Biased toward longer runtimes." };
    } else if (mode === "fairness") {
      const leastPicked = [...data.fairness].sort((a, b) => a.watched_picks - b.watched_picks)[0];
      const picked = pickOne(candidates);
      result = { title: picked.title, runtime_minutes: picked.runtime_minutes, reason: leastPicked ? `Suggested with fairness mode on. ${leastPicked.name} currently has the fewest watched picks.` : "Suggested with fairness mode on." };
    } else {
      const picked = pickOne(candidates);
      result = { title: picked.title, runtime_minutes: picked.runtime_minutes, reason: "Pure random pick." };
    }
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not pick a movie." }, { status: 500 });
  }
}
