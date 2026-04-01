import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";
import type { Movie } from "@/lib/types";

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function weightedPick(candidates: Movie[], votes: Map<string, number>) {
  const weighted: Movie[] = [];
  for (const movie of candidates) {
    const weight = Math.max(1, votes.get(movie.id) ?? 0);
    for (let i = 0; i < weight; i += 1) weighted.push(movie);
  }
  return pickOne(weighted);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const maxRuntime = body.max_runtime ? Number(body.max_runtime) : null;
    const mode = String(body.mode ?? "vote-rotation");
    const data = await getDashboardData();

    const candidates = data.availableMovies.filter((movie) =>
      maxRuntime && Number.isFinite(maxRuntime) ? (movie.runtime_minutes ?? 0) <= maxRuntime : true
    );
    if (candidates.length === 0) {
      return NextResponse.json({ error: "No movies match that filter." }, { status: 400 });
    }

    const voteMap = new Map(data.votes.map((row) => [row.movie_id, row.vote_count]));
    const nextUp = data.rotation[0] ?? null;
    let result: { title: string; runtime_minutes: number | null; reason: string };

    if (mode === "short-night") {
      const sorted = [...candidates].sort((a, b) => (a.runtime_minutes ?? 999) - (b.runtime_minutes ?? 999)).slice(0, 10);
      const picked = pickOne(sorted);
      result = { title: picked.title, runtime_minutes: picked.runtime_minutes, reason: "Biased toward shorter runtimes." };
    } else if (mode === "epic-night") {
      const sorted = [...candidates].sort((a, b) => (b.runtime_minutes ?? 0) - (a.runtime_minutes ?? 0)).slice(0, 10);
      const picked = pickOne(sorted);
      result = { title: picked.title, runtime_minutes: picked.runtime_minutes, reason: "Biased toward longer runtimes." };
    } else if (mode === "turn-rotation") {
      const picked = weightedPick(candidates, voteMap);
      result = {
        title: picked.title,
        runtime_minutes: picked.runtime_minutes,
        reason: nextUp
          ? `Turn rotation points to ${nextUp.name} next. Votes are still weighted, but the current on-deck member is highlighted first.`
          : "Turn rotation mode is on. This favors keeping the queue fair.",
      };
    } else if (mode === "vote-rotation") {
      const topVoteCount = Math.max(...candidates.map((movie) => voteMap.get(movie.id) ?? 0));
      const topPool = candidates.filter((movie) => (voteMap.get(movie.id) ?? 0) === topVoteCount);
      const picked = pickOne(topPool.length > 0 ? topPool : candidates);
      result = {
        title: picked.title,
        runtime_minutes: picked.runtime_minutes,
        reason: nextUp
          ? `This leans on the highest vote totals and keeps ${nextUp.name} in view as the next person up in the rotation.`
          : "This leans on the highest vote totals first.",
      };
    } else {
      const picked = pickOne(candidates);
      result = { title: picked.title, runtime_minutes: picked.runtime_minutes, reason: "Pure random pick." };
    }

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not pick a movie." }, { status: 500 });
  }
}
