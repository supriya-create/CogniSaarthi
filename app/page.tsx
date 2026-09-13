import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * The front door. Someone returning to the app should land on their
 * home screen, not on a marketing page they have to get past.
 */
export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? "/home" : "/onboarding");
}
