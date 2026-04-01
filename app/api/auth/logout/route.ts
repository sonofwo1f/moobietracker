import { NextResponse } from "next/server";

const SITE_AUTH_COOKIE = "moobie_access";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SITE_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
