import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const runtimeRaw = String(body.runtime_minutes ?? "").trim();
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

    const runtime = runtimeRaw === "" ? null : Number.isFinite(Number(runtimeRaw)) ? Number(runtimeRaw) : null;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("movies").insert({ title, runtime_minutes: runtime, status: "available", source_list: "manual" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add movie." }, { status: 500 });
  }
}
