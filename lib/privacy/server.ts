import "server-only";

import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/privacy/audit";
import {
  CURRENT_CONSENT_VERSION,
  resolveConsent,
  type ConsentStatus,
} from "@/lib/privacy/consent";

/**
 * PRIVACY — the database side of consent.
 * -----------------------------------------------------------------
 * Every function here takes a userId that came from an authenticated
 * ELDER session. None of them accept a caregiver id, and that is the
 * whole authorization model for consent: there is no code path by which
 * a caregiver can answer this question for someone else.
 *
 * See §9 of docs/privacy-and-consent.md — a caregiver link is a care
 * relationship, not established legal authority, and Cognisaarthi has
 * no way to verify guardianship. Rather than approximate it, the
 * capability is absent.
 */

export async function consentRecordsFor(userId: string) {
  return prisma.researchConsent.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

/** The person's current consent status, resolved through the pure rules. */
export async function getConsentStatus(userId: string): Promise<ConsentStatus> {
  return resolveConsent(await consentRecordsFor(userId));
}

/** True only when an explicit, current, un-withdrawn "yes" is on file. */
export async function researchEligible(userId: string): Promise<boolean> {
  return (await getConsentStatus(userId)).researchEligible;
}

/**
 * Record a "yes" for the current wording.
 *
 * Upsert on (userId, version) so tapping twice is harmless. A previous
 * withdrawal is cleared only because the person has just, explicitly,
 * been asked again and said yes — nothing here re-consents anyone
 * silently.
 */
export async function grantConsent(
  userId: string,
  now: Date = new Date(),
): Promise<ConsentStatus> {
  await prisma.researchConsent.upsert({
    where: {
      userId_version: { userId, version: CURRENT_CONSENT_VERSION },
    },
    create: {
      userId,
      version: CURRENT_CONSENT_VERSION,
      purpose: "RESEARCH_IMPROVEMENT",
      consented: true,
      consentedAt: now,
    },
    update: { consented: true, consentedAt: now, withdrawnAt: null },
  });

  await recordAudit({
    action: "RESEARCH_CONSENT_GRANTED",
    userId,
    detail: { version: CURRENT_CONSENT_VERSION },
  });

  return getConsentStatus(userId);
}

/**
 * Record "Not now".
 *
 * Stored rather than treated as silence, so the question is not asked
 * again on every visit. It is NOT a withdrawal: `withdrawnAt` stays
 * null, because nothing was ever granted to withdraw.
 */
export async function declineConsent(userId: string): Promise<ConsentStatus> {
  await prisma.researchConsent.upsert({
    where: {
      userId_version: { userId, version: CURRENT_CONSENT_VERSION },
    },
    create: {
      userId,
      version: CURRENT_CONSENT_VERSION,
      purpose: "RESEARCH_IMPROVEMENT",
      consented: false,
      consentedAt: null,
    },
    update: { consented: false, consentedAt: null },
  });

  return getConsentStatus(userId);
}

/**
 * Withdraw a consent that was previously granted.
 *
 * What this does NOT do is delete anything. The person's history, their
 * memories and their reminders are product data they rely on, and
 * withdrawing research consent is not a request to lose them. It ends
 * research ELIGIBILITY: activity from this moment on falls outside the
 * consented window, and a future export will not contain it.
 *
 * Withdrawing when nothing was granted is a no-op rather than an error,
 * so a double tap cannot manufacture a misleading audit trail.
 */
export async function withdrawConsent(
  userId: string,
  now: Date = new Date(),
): Promise<ConsentStatus> {
  const existing = await prisma.researchConsent.findUnique({
    where: {
      userId_version: { userId, version: CURRENT_CONSENT_VERSION },
    },
  });

  if (!existing || !existing.consented) return getConsentStatus(userId);

  await prisma.researchConsent.update({
    where: { id: existing.id },
    data: { consented: false, withdrawnAt: now },
  });

  await recordAudit({
    action: "RESEARCH_CONSENT_WITHDRAWN",
    userId,
    detail: { version: CURRENT_CONSENT_VERSION },
  });

  return getConsentStatus(userId);
}

/**
 * The consented window for one person, used to decide which activity
 * records may appear in an export. Null when no grant exists at all.
 */
export async function consentWindow(
  userId: string,
): Promise<{ consentedAt: Date | null; withdrawnAt: Date | null }> {
  const record = await prisma.researchConsent.findUnique({
    where: {
      userId_version: { userId, version: CURRENT_CONSENT_VERSION },
    },
    select: { consentedAt: true, withdrawnAt: true },
  });

  return {
    consentedAt: record?.consentedAt ?? null,
    withdrawnAt: record?.withdrawnAt ?? null,
  };
}
