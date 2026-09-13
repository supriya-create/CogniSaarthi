import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * Password hashing for caregiver accounts, built on Node's own
 * scrypt. Elderly users never have a password, so this is only
 * reached from the caregiver routes.
 *
 * Stored format: `scrypt$<salt-hex>$<hash-hex>` — self-describing,
 * so the algorithm can be migrated later without a data guess.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const derived = await scryptAsync(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length,
  );

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
