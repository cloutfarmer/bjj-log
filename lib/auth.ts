import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "bjj-session";
export const SESSION_SECONDS = 60 * 60 * 24 * 30;

export class AuthConfigurationError extends Error {}

function passwordSecret(): string {
  const password = process.env.BJJ_PASSWORD;
  if (!password) throw new AuthConfigurationError("BJJ_PASSWORD is missing.");
  return password;
}

function sessionSecret(): string {
  const secret = process.env.BJJ_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new AuthConfigurationError("BJJ_SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function equal(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export function checkPassword(password: string): boolean {
  return equal(password, passwordSecret());
}

function signSession(expiry: string): string {
  // Include a password fingerprint so changing either credential invalidates sessions.
  const fingerprint = createHash("sha256").update(passwordSecret()).digest("hex");
  return createHmac("sha256", sessionSecret()).update(`${expiry}:${fingerprint}`).digest("hex");
}

export function createSession(): string {
  const expiry = String(Date.now() + SESSION_SECONDS * 1000);
  return `${expiry}.${signSession(expiry)}`;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const [expiry, signature, extra] = token.split(".");
  if (extra !== undefined || !/^\d+$/.test(expiry) || !signature || Number(expiry) <= Date.now()) return false;
  return equal(signature, signSession(expiry));
}

/** Reject cross-site writes even if the browser sends a session cookie. */
export function isSameOrigin(request: Request): boolean {
  return request.headers.get("origin") === new URL(request.url).origin;
}
