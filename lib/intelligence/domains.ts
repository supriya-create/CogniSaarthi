import type { CognitiveDomain } from "@prisma/client";

import { GAME_DEFINITIONS } from "@/lib/game-engine/definitions";

/**
 * THE DOMAINS THAT ACTUALLY EXIST.
 * -----------------------------------------------------------------
 * `CognitiveDomain` in the schema lists six values, but only four are
 * exercised by a real activity today. PROCESSING_SPEED and
 * EXECUTIVE_FUNCTION have no game, so there is no honest data for them
 * — the intelligence layer must not manufacture a profile, a trend or a
 * recommendation for a domain nobody has ever played.
 *
 * This list is derived from the game definitions rather than hardcoded,
 * so adding a fifth activity automatically brings its domain into the
 * intelligence layer with no change here.
 */

/** Domains with at least one real activity, in display order. */
export const ACTIVE_DOMAINS: CognitiveDomain[] = [...new Set(
  GAME_DEFINITIONS.map((game) => game.domain),
)];

/** Which activities exercise a domain. */
export function gamesForDomain(domain: CognitiveDomain): string[] {
  return GAME_DEFINITIONS.filter((game) => game.domain === domain).map(
    (game) => game.id,
  );
}

export function domainOfGame(gameId: string): CognitiveDomain | null {
  return GAME_DEFINITIONS.find((game) => game.id === gameId)?.domain ?? null;
}

/** True when a domain is backed by a playable activity. */
export function isActiveDomain(domain: CognitiveDomain): boolean {
  return ACTIVE_DOMAINS.includes(domain);
}

/**
 * Caregiver-facing (English) domain labels. Deliberately describes the
 * ACTIVITY area, not a faculty of the brain: "Memory activities", never
 * "memory function".
 */
export const DOMAIN_LABEL: Record<CognitiveDomain, string> = {
  SHORT_TERM_MEMORY: "Memory",
  ATTENTION: "Attention",
  WORKING_MEMORY: "Sequencing",
  LANGUAGE: "Language",
  PROCESSING_SPEED: "Processing speed",
  EXECUTIVE_FUNCTION: "Planning",
};

/** The elder-facing dictionary key for a domain name. */
export const DOMAIN_DICT_KEY: Record<
  CognitiveDomain,
  "domainSHORT_TERM_MEMORY" | "domainATTENTION" | "domainWORKING_MEMORY" | "domainLANGUAGE"
> = {
  SHORT_TERM_MEMORY: "domainSHORT_TERM_MEMORY",
  ATTENTION: "domainATTENTION",
  WORKING_MEMORY: "domainWORKING_MEMORY",
  LANGUAGE: "domainLANGUAGE",
  // No activity exists for these; they fall back to a generic label and
  // are never surfaced, because ACTIVE_DOMAINS excludes them.
  PROCESSING_SPEED: "domainATTENTION",
  EXECUTIVE_FUNCTION: "domainWORKING_MEMORY",
};
