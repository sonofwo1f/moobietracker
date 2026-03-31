import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load dashboard." }, { status: 500 });
  }
}
