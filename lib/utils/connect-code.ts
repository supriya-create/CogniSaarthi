import { randomInt } from "node:crypto";

/**
 * Alphabet with the characters people misread aloud removed:
 * no 0/O, no 1/I/L, no 5/S, no 2/Z. The code gets read out over
 * the phone by someone who may not see it clearly.
 */
const ALPHABET = "ABCDEFGHJKMNPQRTUVWXY346789";
const LENGTH = 6;

export function generateConnectCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Display form: `ABC-123`, easier to read back than a run of six. */
export function formatConnectCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export function normaliseConnectCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
