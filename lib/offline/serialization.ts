/**
 * OFFLINE — serialisation helpers (pure).
 * -----------------------------------------------------------------
 * Everything written to IndexedDB or put on the sync queue must be a
 * plain, structured-cloneable value. Dates cross the boundary as ISO
 * strings so a record read back tomorrow means the same instant it did
 * today, whatever the device's clock formatting.
 *
 * The queue never stores executable code: `toStorablePayload` strips
 * anything that is not plain data, so a corrupted or tampered local
 * record cannot smuggle behaviour into the sync run. The server
 * re-validates every payload with Zod regardless.
 */

export function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

export function fromIso(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** A value safe to structured-clone into IndexedDB or JSON.stringify. */
export type Storable =
  | string
  | number
  | boolean
  | null
  | Storable[]
  | { [key: string]: Storable };

/**
 * Deep-copy a value keeping only plain data. Functions, symbols,
 * class instances and `undefined` are dropped; Dates become ISO
 * strings. Cycles are broken rather than throwing.
 */
export function toStorablePayload(value: unknown, seen = new WeakSet()): Storable {
  if (value === null) return null;

  const type = typeof value;
  if (type === "string" || type === "boolean") return value as Storable;
  if (type === "number") {
    return Number.isFinite(value as number) ? (value as number) : null;
  }
  if (type === "bigint") return (value as bigint).toString();
  if (type === "function" || type === "symbol" || type === "undefined") {
    return null;
  }

  if (value instanceof Date) return toIso(value);

  if (Array.isArray(value)) {
    if (seen.has(value)) return null;
    seen.add(value);
    return value.map((item) => toStorablePayload(item, seen));
  }

  if (type === "object") {
    const object = value as Record<string, unknown>;
    if (seen.has(object)) return null;
    seen.add(object);
    const result: Record<string, Storable> = {};
    for (const key of Object.keys(object)) {
      const converted = toStorablePayload(object[key], seen);
      // Drop keys whose value carried no data, keeping payloads small.
      if (converted !== null || object[key] === null) result[key] = converted;
    }
    return result;
  }

  return null;
}

/** A client-generated stable id. Uses crypto.randomUUID when present. */
export function newId(): string {
  const cryptoObj =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();

  // Fallback for older browsers: random + time, still collision-safe
  // enough to be an idempotency key for one device.
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${time}-${random}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The composite key identifying one reminder occurrence. */
export function occurrenceKey(
  reminderId: string,
  scheduledFor: Date | string,
): string {
  return `${reminderId}|${toIso(scheduledFor)}`;
}
