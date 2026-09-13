/**
 * VOICE — public surface.
 *
 * `commands` and `answers` are pure and unit-tested. `speech` wraps
 * the browser Web Speech API (guarded for SSR). The React hook lives
 * in `useVoice.ts` and is imported directly by client components.
 */
export * from "@/lib/voice/commands";
export * from "@/lib/voice/answers";
export * from "@/lib/voice/speech";
