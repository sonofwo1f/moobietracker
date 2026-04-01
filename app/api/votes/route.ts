import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();
    const movieId = String(body.movie_id ?? "").trim();
    const memberId = String(body.member_id ?? "").trim();

    if (!movieId || !memberId) {
      return NextResponse.json({ error: "Movie and member are required." }, { status: 400 });
    }

    const { error } = await supabase
      .from("movie_votes")
      .upsert({ movie_id: movieId, member_id: memberId }, { onConflict: "movie_id,member_id", ignoreDuplicates: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save vote." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();
    const movieId = String(body.movie_id ?? "").trim();
    const memberId = String(body.member_id ?? "").trim();

    if (!movieId || !memberId) {
      return NextResponse.json({ error: "Movie and member are required." }, { status: 400 });
    }

    const { error } = await supabase.from("movie_votes").delete().eq("movie_id", movieId).eq("member_id", memberId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove vote." }, { status: 500 });
  }
}
