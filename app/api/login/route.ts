import { NextResponse } from "next/server";
import { AuthConfigurationError, checkPassword, createSession, isSameOrigin, SESSION_COOKIE, SESSION_SECONDS } from "../../../lib/auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  try {
    const form = await request.formData();
    const password = form.get("password");
    if (typeof password !== "string" || password.length > 1024 || !checkPassword(password)) {
      return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
    }
    const response = NextResponse.redirect(new URL("/", request.url), 303);
    response.cookies.set(SESSION_COOKIE, createSession(), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error(`Journal configuration: ${error.message}`);
      return new Response("Journal sign-in is unavailable. Check the server’s password and session-secret settings.", { status: 503 });
    }
    console.error("Journal sign-in failed unexpectedly.");
    return new Response("Unable to sign in. Please try again.", { status: 500 });
  }
}
