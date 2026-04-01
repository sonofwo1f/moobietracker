import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { eventType, night, recipients } = body;

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const subjectMap: Record<string, string> = {
      scheduled: "🎬 New Movie Night Scheduled",
      updated: "🔄 Movie Night Updated",
      watched: "✅ Movie Night Completed",
    };

    const subject = subjectMap[eventType] || "Moobie Clurb Update";

    const html = `
      <h2>Moobie Clurb Update</h2>
      <p><strong>Movie:</strong> ${night.movie?.title}</p>
      <p><strong>Date:</strong> ${night.scheduled_for || "TBD"}</p>
      <p><strong>Picked By:</strong> ${night.picked_by?.name || "N/A"}</p>
      <p><strong>Status:</strong> ${night.status}</p>
      <p><strong>Notes:</strong> ${night.notes || "None"}</p>
    `;

    const emails = recipients
      .map((r: any) => r.email)
      .filter(Boolean);

    if (emails.length === 0) {
      return NextResponse.json({ ok: true });
    }

    await resend.emails.send({
      from: process.env.NOTIFY_FROM_EMAIL!,
      to: emails,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
