/**
 * VOICE COMMAND PARSING (pure and testable)
 * -----------------------------------------------------------------
 * A deliberately small, controlled command set — not open-ended
 * natural language, and not an LLM. Given a spoken (or typed)
 * transcript, match it to one known intent or return null. The
 * matcher is keyword-based and multilingual: it recognises phrases
 * in English, Hindi and Assamese, so a person who speaks a command
 * in their own language is understood when the browser's speech
 * engine transcribes it.
 *
 * Reliability over breadth: it is better to recognise a few commands
 * every time than many commands sometimes.
 */

export type VoiceCommand =
  | "START_ACTIVITY"
  | "OPEN_GAMES"
  | "OPEN_MEMORIES"
  | "GO_HOME"
  | "OPEN_PROFILE"
  | "REPEAT"
  | "STOP";

/**
 * Phrase fragments per command, matched as normalised substrings.
 * Order in COMMAND_ORDER decides precedence when two could match.
 */
const PATTERNS: Record<VoiceCommand, string[]> = {
  REPEAT: [
    "repeat",
    "say again",
    "again",
    "hear again",
    "read again",
    "once more",
    // Hindi
    "फिर से",
    "दोहरा",
    "दुबारा",
    // Assamese
    "আকৌ",
    "পুনৰ",
  ],
  STOP: [
    "stop",
    "quit",
    "cancel",
    "exit",
    "close",
    // Hindi
    "बंद",
    "रोक",
    // Assamese
    "বন্ধ",
    "ৰখাও",
  ],
  OPEN_MEMORIES: [
    "memor", // memory / memories
    "my photos",
    "photos",
    "family",
    "people",
    // Hindi
    "याद",
    "यादें",
    "तस्वीर",
    // Assamese
    "স্মৃতি",
    "ফটো",
  ],
  OPEN_PROFILE: [
    "profile",
    "settings",
    "my details",
    // Hindi
    "जानकारी",
    "सेटिंग",
    // Assamese
    "তথ্য",
  ],
  OPEN_GAMES: [
    "games",
    "game",
    "activities",
    "all activities",
    // Hindi
    "खेल",
    // Assamese
    "খেল",
  ],
  GO_HOME: [
    "home",
    "go back",
    "go home",
    "back",
    "main screen",
    // Hindi
    "घर",
    "वापस",
    // Assamese
    "ঘৰ",
    "উভতি",
  ],
  START_ACTIVITY: [
    "start today",
    "start activity",
    "start",
    "begin",
    "play",
    "let s play",
    "let s begin",
    "play today",
    "today's journey",
    "todays journey",
    "start journey",
    // Hindi
    "शुरू",
    "आरंभ",
    // Assamese
    "আৰম্ভ",
    "যাত্ৰা",
  ],
};

/**
 * Precedence: specific/short actions first so, e.g. "repeat the game"
 * is REPEAT not OPEN_GAMES, and "games" is OPEN_GAMES not
 * START_ACTIVITY (which also lists "play").
 */
const COMMAND_ORDER: VoiceCommand[] = [
  "REPEAT",
  "STOP",
  "OPEN_MEMORIES",
  "OPEN_PROFILE",
  "OPEN_GAMES",
  "GO_HOME",
  "START_ACTIVITY",
];

/** Lowercase, strip punctuation, collapse whitespace. Script-safe. */
export function normaliseTranscript(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,!?;:"'()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a transcript into a known command, or null if none matches.
 * `language` is accepted for future per-language tuning; matching is
 * currently language-agnostic (all phrase sets are tried).
 */
export function parseCommand(transcript: string): VoiceCommand | null {
  const text = normaliseTranscript(transcript);
  if (!text) return null;

  for (const command of COMMAND_ORDER) {
    if (PATTERNS[command].some((pattern) => text.includes(pattern))) {
      return command;
    }
  }
  return null;
}

/** Where each navigation command should take the user. */
export const COMMAND_ROUTE: Partial<Record<VoiceCommand, string>> = {
  START_ACTIVITY: "/games",
  OPEN_GAMES: "/games",
  OPEN_MEMORIES: "/memories",
  GO_HOME: "/home",
  OPEN_PROFILE: "/profile",
};
