import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

async function syncAttendees(supabase: ReturnType<typeof getSupabaseAdmin>, movieNightId: string, attendeeIds: string[]) {
  const deleteRes = await supabase.from("night_attendees").delete().eq("movie_night_id", movieNightId);
  if (deleteRes.error) throw new Error(deleteRes.error.message);

  if (attendeeIds.length > 0) {
    const attendeeRows = attendeeIds.map((memberId: string) => ({ movie_night_id: movieNightId, member_id: memberId }));
    const attendeeRes = await supabase.from("night_attendees").insert(attendeeRows);
    if (attendeeRes.error) throw new Error(attendeeRes.error.message);
  }
}

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

      await syncAttendees(supabase, insertRes.data.id, attendeeIds);

      await supabase.from("movies").update({ status: "scheduled" }).eq("id", movieId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update_schedule") {
      const nightId = String(body.night_id ?? "").trim();
      const movieId = String(body.movie_id ?? "").trim();
      if (!nightId || !movieId) return NextResponse.json({ error: "Night and movie are required." }, { status: 400 });

      const pickedById = String(body.picked_by_member_id ?? "").trim() || null;
      const scheduledFor = String(body.scheduled_for ?? "").trim() || null;
      const notes = String(body.notes ?? "").trim();
      const attendeeIds = Array.isArray(body.attendee_ids) ? body.attendee_ids.map((v: unknown) => String(v)).filter(Boolean) : [];

      const currentNightRes = await supabase.from("movie_nights").select("movie_id,status").eq("id", nightId).single();
      if (currentNightRes.error || !currentNightRes.data) return NextResponse.json({ error: currentNightRes.error?.message ?? "Could not find movie night." }, { status: 400 });
      if (currentNightRes.data.status !== "scheduled") return NextResponse.json({ error: "Only scheduled movie nights can be edited." }, { status: 400 });

      const updateRes = await supabase.from("movie_nights").update({
        movie_id: movieId,
        picked_by_member_id: pickedById,
        scheduled_for: scheduledFor,
        notes,
      }).eq("id", nightId);
      if (updateRes.error) return NextResponse.json({ error: updateRes.error.message }, { status: 400 });

      await syncAttendees(supabase, nightId, attendeeIds);

      if (currentNightRes.data.movie_id !== movieId) {
        await supabase.from("movies").update({ status: "available" }).eq("id", currentNightRes.data.movie_id);
        await supabase.from("movies").update({ status: "scheduled" }).eq("id", movieId);
      }

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

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const nightId = String(body.night_id ?? "").trim();
    if (!nightId) return NextResponse.json({ error: "Night id is required." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const nightRes = await supabase.from("movie_nights").select("movie_id,status").eq("id", nightId).single();
    if (nightRes.error || !nightRes.data) return NextResponse.json({ error: nightRes.error?.message ?? "Could not find movie night." }, { status: 400 });
    if (nightRes.data.status !== "scheduled") return NextResponse.json({ error: "Only scheduled movie nights can be removed." }, { status: 400 });

    const attendeeDeleteRes = await supabase.from("night_attendees").delete().eq("movie_night_id", nightId);
    if (attendeeDeleteRes.error) return NextResponse.json({ error: attendeeDeleteRes.error.message }, { status: 400 });

    const deleteRes = await supabase.from("movie_nights").delete().eq("id", nightId);
    if (deleteRes.error) return NextResponse.json({ error: deleteRes.error.message }, { status: 400 });

    await supabase.from("movies").update({ status: "available" }).eq("id", nightRes.data.movie_id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove movie night." }, { status: 500 });
  }
}
