import "server-only";

import {
  getCurrentCaregiver,
  getCurrentUser,
} from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/caregiver/access";

/**
 * Who the intelligence endpoints are allowed to answer about.
 *
 * The important design decision: these endpoints accept NO user id from
 * the client. An elder gets their own data; a caregiver gets the elder
 * they are actively linked to, resolved server-side from their session.
 *
 * That makes a forged id impossible by construction rather than by
 * validation — there is no parameter to forge. A caregiver cannot ask
 * about another family's elder because there is no way to name one.
 */

export type ViewerRole = "ELDER" | "CAREGIVER";

export interface IntelligenceTarget {
  userId: string;
  viewer: ViewerRole;
}

export async function resolveIntelligenceTarget(): Promise<IntelligenceTarget | null> {
  // An elder session always refers to itself.
  const user = await getCurrentUser();
  if (user) return { userId: user.id, viewer: "ELDER" };

  // A caregiver session resolves to their linked elder, or nothing.
  const caregiver = await getCurrentCaregiver();
  if (caregiver) {
    const linked = await linkedUserFor(caregiver.id);
    if (linked) return { userId: linked.id, viewer: "CAREGIVER" };
  }

  return null;
}
