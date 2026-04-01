import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    const sitePassword = process.env.SITE_PASSWORD;

    if (!sitePassword) {
      return NextResponse.json(
        { error: "SITE_PASSWORD is not set" },
        { status: 500 }
      );
    }

    if ((password ?? "").trim() !== sitePassword.trim()) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("moobie_auth", "yes", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
