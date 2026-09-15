import { describe, expect, it } from "vitest";

import {
  backoffDelayMs,
  isDueForRetry,
  isRetryableError,
  MAX_ATTEMPTS,
  statusAfterFailure,
} from "@/lib/offline/queue";
import { resolveState } from "@/lib/offline/connectivity";
import { classifyHttpFailure } from "@/lib/offline/sync";

/**
 * Retry scheduling and connectivity, as pure rules. The property that
 * matters most: retrying is bounded, and giving up means PARKING the
 * work, never deleting it.
 */

describe("backoff", () => {
  it("retries immediately once, then backs off", () => {
    expect(backoffDelayMs(0)).toBe(0);
    expect(backoffDelayMs(1)).toBeGreaterThan(0);
    expect(backoffDelayMs(2)).toBeGreaterThan(backoffDelayMs(1));
    expect(backoffDelayMs(3)).toBeGreaterThan(backoffDelayMs(2));
  });

  it("is bounded — it never grows without limit", () => {
    const ceiling = backoffDelayMs(MAX_ATTEMPTS);
    expect(backoffDelayMs(50)).toBe(ceiling);
    expect(backoffDelayMs(5000)).toBe(ceiling);
  });
});

describe("error classification", () => {
  it("treats blips as retryable and rejections as permanent", () => {
    expect(isRetryableError("network")).toBe(true);
    expect(isRetryableError("timeout")).toBe(true);
    expect(isRetryableError("server_error")).toBe(true);
    expect(isRetryableError(null)).toBe(true); // unknown → worth retrying

    expect(isRetryableError("invalid_payload")).toBe(false);
    expect(isRetryableError("not_found")).toBe(false);
    expect(isRetryableError("conflict")).toBe(false);
  });

  it("maps HTTP statuses sensibly", () => {
    expect(classifyHttpFailure(401)).toEqual({
      errorCode: "unauthenticated",
      retryable: false,
    });
    expect(classifyHttpFailure(500).retryable).toBe(true);
    expect(classifyHttpFailure(503).retryable).toBe(true);
    expect(classifyHttpFailure(429).retryable).toBe(true);
    expect(classifyHttpFailure(400).retryable).toBe(false);
  });
});

describe("status after a failed attempt", () => {
  it("keeps retryable work pending until the attempt limit", () => {
    expect(statusAfterFailure(1, "network")).toBe("PENDING");
    expect(statusAfterFailure(MAX_ATTEMPTS - 1, "network")).toBe("PENDING");
  });

  it("parks work as FAILED rather than discarding it", () => {
    expect(statusAfterFailure(MAX_ATTEMPTS, "network")).toBe("FAILED");
    expect(statusAfterFailure(1, "invalid_payload")).toBe("FAILED");
  });

  it("waits for a sign-in rather than burning attempts", () => {
    expect(statusAfterFailure(1, "unauthenticated")).toBe("NEEDS_AUTH");
  });
});

describe("isDueForRetry", () => {
  const now = new Date("2026-09-14T12:00:00Z");

  it("is due when it has never been attempted", () => {
    expect(
      isDueForRetry({ attempts: 0, lastAttemptAt: null, status: "PENDING" }, now),
    ).toBe(true);
  });

  it("waits out the backoff window", () => {
    const justTried = new Date(now.getTime() - 100).toISOString();
    expect(
      isDueForRetry(
        { attempts: 3, lastAttemptAt: justTried, status: "PENDING" },
        now,
      ),
    ).toBe(false);

    const longAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    expect(
      isDueForRetry(
        { attempts: 3, lastAttemptAt: longAgo, status: "PENDING" },
        now,
      ),
    ).toBe(true);
  });

  it("never picks up work that is not pending", () => {
    for (const status of ["IN_FLIGHT", "DONE", "FAILED", "NEEDS_AUTH"] as const) {
      expect(
        isDueForRetry({ attempts: 0, lastAttemptAt: null, status }, now),
      ).toBe(false);
    }
  });
});

describe("connectivity state", () => {
  it("is offline whenever the browser says so", () => {
    expect(
      resolveState({ navigatorOnline: false, healthOk: true, syncing: true }),
    ).toBe("OFFLINE");
  });

  it("is offline when the server cannot actually be reached", () => {
    // Connected to a network, but no route to us.
    expect(
      resolveState({ navigatorOnline: true, healthOk: false, syncing: false }),
    ).toBe("OFFLINE");
  });

  it("reports syncing only when it believes it can reach us", () => {
    expect(
      resolveState({ navigatorOnline: true, healthOk: true, syncing: true }),
    ).toBe("SYNCING");
    expect(
      resolveState({ navigatorOnline: false, healthOk: null, syncing: true }),
    ).toBe("OFFLINE");
  });

  it("assumes online before a check has happened", () => {
    expect(
      resolveState({ navigatorOnline: true, healthOk: null, syncing: false }),
    ).toBe("ONLINE");
  });
});
