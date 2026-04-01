import { NextRequest, NextResponse } from "next/server";

const SITE_AUTH_COOKIE = "moobie_access";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const password = String(body.password ?? "");
    const expected = process.env.SITE_PASSWORD?.trim();

    if (!expected) {
      return NextResponse.json({ ok: true, disabled: true });
    }

    if (!password || password !== expected) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SITE_AUTH_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not sign in." }, { status: 500 });
  }
}
