import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get("format") ?? "json";
    const data = await getDashboardData();

    if (format === "csv") {
      const rows = [
        ["Type", "Title", "Status", "Picked By", "Scheduled For", "Watched On", "Average Rating", "Rating Count"],
        ...data.scheduledNights.map((night) => [
          "scheduled",
          night.movie.title,
          night.status,
          night.picked_by?.name ?? "",
          night.scheduled_for ?? "",
          night.watched_on ?? "",
          data.ratingSummary.find((r) => r.movie_id === night.movie_id)?.average_rating ?? "",
          data.ratingSummary.find((r) => r.movie_id === night.movie_id)?.rating_count ?? "",
        ]),
        ...data.watchedNights.map((night) => [
          "watched",
          night.movie.title,
          night.status,
          night.picked_by?.name ?? "",
          night.scheduled_for ?? "",
          night.watched_on ?? "",
          data.ratingSummary.find((r) => r.movie_id === night.movie_id)?.average_rating ?? "",
          data.ratingSummary.find((r) => r.movie_id === night.movie_id)?.rating_count ?? "",
        ]),
      ];
      const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="moobie-clurb-export.csv"',
        },
      });
    }

    return NextResponse.json(data, {
      headers: {
        "Content-Disposition": 'attachment; filename="moobie-clurb-export.json"',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not export data." }, { status: 500 });
  }
}
