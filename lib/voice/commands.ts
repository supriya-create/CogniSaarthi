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
  // Phase 4 reminder commands. OPEN_REMINDERS / SHOW_TODAY / READ_REMINDERS
  // navigate or read out; MARK_DONE / REMIND_LATER act on the reminder in
  // focus and are only honoured on the reminders screen. OPEN_ALERTS is a
  // caregiver command and is never routed from the elder interface.
  | "OPEN_REMINDERS"
  | "SHOW_TODAY"
  | "READ_REMINDERS"
  | "MARK_DONE"
  | "REMIND_LATER"
  | "OPEN_ALERTS"
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
  READ_REMINDERS: [
    "read reminder",
    "read my reminder",
    "read out",
    "what are my reminder",
    "read the reminder",
    // Hindi
    "याद दिलाने पढ़",
    "पढ़कर सुना",
    // Assamese
    "মনত পেলোৱা পঢ়",
  ],
  MARK_DONE: [
    "mark done",
    "mark as done",
    "it is done",
    "i did it",
    "finished",
    "completed",
    "done it",
    // Hindi
    "हो गया",
    "कर लिया",
    // Assamese
    "কৰি ল",
    "শেষ হ",
  ],
  REMIND_LATER: [
    "remind me later",
    "remind later",
    "later",
    "not now",
    "afterward",
    // Hindi
    "बाद में",
    "अभी नहीं",
    // Assamese
    "পিছত",
    "এতিয়া নহয়",
  ],
  OPEN_REMINDERS: [
    "reminder",
    "reminders",
    "my reminder",
    // Hindi
    "याद दिला",
    // Assamese
    "মনত পেলো",
  ],
  SHOW_TODAY: [
    "my day",
    "routine",
    "schedule",
    "daily routine",
    "my routine",
    // Hindi
    "मेरा दिन",
    "दिनचर्या",
    // Assamese
    "মোৰ দিন",
    "ৰুটিন",
  ],
  OPEN_ALERTS: [
    "alerts",
    "notifications",
    "alert center",
  ],
  OPEN_MEMORIES: [
    "memor", // memory / memories
    "my photos",
    "photos",
    "people",
    // Hindi
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
  "MARK_DONE",
  "REMIND_LATER",
  "READ_REMINDERS",
  "OPEN_REMINDERS",
  "SHOW_TODAY",
  "OPEN_ALERTS",
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
  // Phase 4 navigations. MARK_DONE / REMIND_LATER / READ_REMINDERS act in
  // place on the reminders screen and so have no route. OPEN_ALERTS is a
  // caregiver-only destination and is deliberately not routed here.
  OPEN_REMINDERS: "/reminders",
  SHOW_TODAY: "/routine",
};
