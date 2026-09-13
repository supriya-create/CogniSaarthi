import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

/**
 * Request-scoped accessors. `cache()` means the root layout, the
 * page and any server component can all ask "who is this?" while
 * only one query reaches the database per request.
 */

export const getCurrentUser = cache(async () => {
  const session = await getSession("ELDER");
  if (!session) return null;

  return prisma.user.findUnique({
    where: { id: session.sub },
    include: { preference: true },
  });
});

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

export const getCurrentCaregiver = cache(async () => {
  const session = await getSession("CAREGIVER");
  if (!session) return null;

  return prisma.caregiver.findUnique({ where: { id: session.sub } });
});

export type CurrentCaregiver = NonNullable<
  Awaited<ReturnType<typeof getCurrentCaregiver>>
>;

/** Use in elder pages. Sends anyone without a profile to onboarding. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");
  return user;
}

/** Use in caregiver pages. */
export async function requireCaregiver(): Promise<CurrentCaregiver> {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) redirect("/caregiver/login");
  return caregiver;
}
