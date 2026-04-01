import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const memberId = String(body.member_id ?? "").trim();
    const movieId = String(body.movie_id ?? "").trim();
    const review = String(body.review ?? "").trim();
    const rating = Number(body.rating ?? 0);

    if (!memberId || !movieId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Member, movie, and a 1-5 rating are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("movie_ratings")
      .upsert({ member_id: memberId, movie_id: movieId, rating, review }, { onConflict: "movie_id,member_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save rating." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const memberId = String(body.member_id ?? "").trim();
    const movieId = String(body.movie_id ?? "").trim();
    if (!memberId || !movieId) {
      return NextResponse.json({ error: "Member and movie are required." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("movie_ratings").delete().eq("member_id", memberId).eq("movie_id", movieId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove rating." }, { status: 500 });
  }
}
