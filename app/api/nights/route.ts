import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (body.action === "schedule") {
      const movieId = String(body.movie_id ?? "").trim();
      if (!movieId) return NextResponse.json({ error: "Movie is required." }, { status: 400 });

      const pickedById = String(body.picked_by_member_id ?? "").trim() || null;
      const scheduledFor = String(body.scheduled_for ?? "").trim() || null;
      const notes = String(body.notes ?? "").trim();
      const attendeeIds = Array.isArray(body.attendee_ids) ? body.attendee_ids.map((v: unknown) => String(v)).filter(Boolean) : [];

      const insertRes = await supabase.from("movie_nights").insert({
        movie_id: movieId,
        picked_by_member_id: pickedById,
        scheduled_for: scheduledFor,
        status: "scheduled",
        notes,
      }).select("id").single();
      if (insertRes.error || !insertRes.data) return NextResponse.json({ error: insertRes.error?.message ?? "Could not schedule movie night." }, { status: 400 });

      if (attendeeIds.length > 0) {
        const attendeeRows = attendeeIds.map((memberId: string) => ({ movie_night_id: insertRes.data.id, member_id: memberId }));
        const attendeeRes = await supabase.from("night_attendees").insert(attendeeRows);
        if (attendeeRes.error) return NextResponse.json({ error: attendeeRes.error.message }, { status: 400 });
      }

      await supabase.from("movies").update({ status: "scheduled" }).eq("id", movieId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "mark_watched") {
      const nightId = String(body.night_id ?? "").trim();
      if (!nightId) return NextResponse.json({ error: "Night id is required." }, { status: 400 });

      const nightRes = await supabase.from("movie_nights").update({
        status: "watched",
        watched_on: new Date().toISOString().slice(0, 10),
      }).eq("id", nightId).select("movie_id").single();
      if (nightRes.error || !nightRes.data) return NextResponse.json({ error: nightRes.error?.message ?? "Could not update movie night." }, { status: 400 });

      await supabase.from("movies").update({ status: "watched" }).eq("id", nightRes.data.movie_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update movie night." }, { status: 500 });
  }
}
