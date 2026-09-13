import type { CognitiveDomain, Difficulty, Language } from "@prisma/client";

/**
 * The contract every cognitive activity implements.
 *
 * A game contributes three things and nothing else:
 *   1. a `GameDefinition` — metadata + per-difficulty configuration
 *   2. a play component that emits a `SessionOutcome`
 *   3. its own grading rule, applied while producing round outcomes
 *
 * Everything downstream — scoring, persistence, the result screen,
 * history, the caregiver summary — is shared. Adding a fourth game
 * touches the definitions file, the registry, and nothing else.
 */

export type GameId =
  | "remember-objects"
  | "find-different"
  | "remember-sequence";

/** Which brand colour a game is presented in. */
export type GameAccent = "primary" | "secondary" | "tea";

export type Localised = Record<Language, string>;

export interface GameDefinition<TConfig = unknown> {
  id: GameId;
  domain: CognitiveDomain;
  iconKey: string;
  accent: GameAccent;
  /** Emoji shown on the activity card; decorative, always paired with text. */
  glyph: string;
  name: Localised;
  shortDescription: Localised;
  instructions: Localised;
  /** Deterministic Phase 1 difficulty presets. Not adaptive, not AI. */
  difficulties: Record<Difficulty, TConfig>;
}

/**
 * The result of one round.
 *
 * `correct` and `total` are ALREADY net of the game's own grading
 * rule — a game that penalises false positives subtracts them here.
 * `mistakes` is recorded as telemetry and is never scored twice.
 */
export interface RoundOutcome {
  index: number;
  correct: number;
  total: number;
  mistakes: number;
  hintsUsed: number;
  responseTimeMs: number;
  /** Per-game detail, persisted to GameResult.rawRounds for Phase 2. */
  detail?: Record<string, unknown>;
}

export interface SessionOutcome {
  rounds: RoundOutcome[];
  durationMs: number;
}

export interface ScoreSummary {
  score: number; // 0-100
  accuracy: number; // 0-1
  stars: number; // 1-5, presentation only
  correctCount: number;
  incorrectCount: number;
  mistakes: number;
  hints: number;
  totalResponseTimeMs: number;
  avgResponseTimeMs: number;
  roundsCompleted: number;
}

/** Props every play component receives. */
export interface GamePlayProps<TConfig = unknown> {
  config: TConfig;
  difficulty: Difficulty;
  language: Language;
  onComplete: (outcome: SessionOutcome) => void;
  onQuit: () => void;
}
