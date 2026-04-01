import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const memberId = String(body.member_id ?? "").trim();
    const emailRaw = String(body.email ?? "").trim().toLowerCase();
    const notificationsEnabled = Boolean(body.notifications_enabled);

    if (!memberId) return NextResponse.json({ error: "Member is required." }, { status: 400 });
    if (emailRaw && !/^\S+@\S+\.\S+$/.test(emailRaw)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("members")
      .update({ email: emailRaw || null, notifications_enabled: notificationsEnabled })
      .eq("id", memberId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update member profile." }, { status: 500 });
  }
}
