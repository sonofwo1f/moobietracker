import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Notify route hit");
    console.log("Body:", JSON.stringify(body));

    const { eventType, night, recipients } = body;

    if (!recipients || recipients.length === 0) {
      console.log("No recipients found");
      return NextResponse.json({ ok: true, message: "No recipients" });
    }

    const subjectMap: Record<string, string> = {
      scheduled: "New Movie Night Scheduled",
      updated: "Movie Night Updated",
      watched: "Movie Night Completed",
    };

    const subject = subjectMap[eventType] || "Moobie Clurb Update";

    const html = `
      <h2>Moobie Clurb Update</h2>
      <p><strong>Movie:</strong> ${night?.movie?.title ?? "Unknown"}</p>
      <p><strong>Date:</strong> ${night?.scheduled_for ?? "TBD"}</p>
      <p><strong>Picked By:</strong> ${night?.picked_by?.name ?? "N/A"}</p>
      <p><strong>Status:</strong> ${night?.status ?? "N/A"}</p>
      <p><strong>Notes:</strong> ${night?.notes || "None"}</p>
    `;

    const emails = recipients
      .map((r: any) => r.email)
      .filter(Boolean);

    console.log("Recipient emails:", emails);

    if (emails.length === 0) {
      console.log("Recipients exist but no valid email addresses");
      return NextResponse.json({ ok: true, message: "No valid recipient emails" });
    }

    const result = await resend.emails.send({
      from: process.env.NOTIFY_FROM_EMAIL!,
      to: emails,
      subject,
      html,
    });

    console.log("Resend result:", JSON.stringify(result));

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("Notify route failed:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
