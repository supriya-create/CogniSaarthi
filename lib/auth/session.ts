import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * One session primitive, two kinds of subject.
 *
 * An elderly user gets a session at the end of onboarding with no
 * password at all — a shared home tablet should not greet someone
 * with dementia with a login form. A caregiver gets one after
 * entering credentials.
 *
 * The two roles use SEPARATE cookies on purpose. Cognisaarthi is
 * built for a shared family device: a daughter checking the
 * dashboard on her mother's tablet must not sign her mother out,
 * because her mother has no password to sign back in with. A single
 * cookie would make the caregiver feature quietly destructive.
 *
 * A third subject type later (a clinician, a paired device) adds a
 * role and a cookie name here and nothing else.
 */

export type SessionRole = "ELDER" | "CAREGIVER";

export type Session = {
  sub: string;
  role: SessionRole;
};

const COOKIES: Record<SessionRole, string> = {
  ELDER: "cs_elder",
  CAREGIVER: "cs_caregiver",
};

const MAX_AGE: Record<SessionRole, number> = {
  // A year: elders should not be signed out by expiry.
  ELDER: 60 * 60 * 24 * 365,
  CAREGIVER: 60 * 60 * 24 * 30,
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error("AUTH_SECRET is not set. Copy .env.example to .env.");
  }
  return new TextEncoder().encode(value);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE[session.role]}s`)
    .sign(secret());
}

async function readToken(
  token: string | undefined,
  expectedRole: SessionRole,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    // The role is checked against the cookie it arrived in, so a
    // token cannot be replayed into the other role's slot.
    if (typeof payload.sub !== "string" || payload.role !== expectedRole) {
      return null;
    }
    return { sub: payload.sub, role: expectedRole };
  } catch {
    // Expired, tampered with, or signed by an older secret.
    return null;
  }
}

export async function startSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(COOKIES[session.role], await createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE[session.role],
  });
}

export async function endSession(role: SessionRole): Promise<void> {
  const store = await cookies();
  store.delete(COOKIES[role]);
}

export async function getSession(
  role: SessionRole,
): Promise<Session | null> {
  const store = await cookies();
  return readToken(store.get(COOKIES[role])?.value, role);
}
