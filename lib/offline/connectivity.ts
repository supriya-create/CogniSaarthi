import type { ConnectionState } from "@/lib/offline/types";

/**
 * OFFLINE — connectivity.
 * -----------------------------------------------------------------
 * `navigator.onLine` only says the device has A network, not that it
 * can reach Cognisaarthi: a tablet on hotel Wi-Fi with no route out,
 * or on a mobile connection that has run out of data, still reports
 * true. So the browser events are treated as a HINT, confirmed by an
 * occasional very small request to our own health endpoint.
 *
 * Health checks are throttled hard — an elderly user's tablet should
 * not be spending battery polling the network.
 */

/** Never check the server more often than this. */
const HEALTH_MIN_INTERVAL_MS = 30_000;
/** A health check that takes longer than this counts as offline. */
const HEALTH_TIMEOUT_MS = 4_000;

/** Pure: the state to show, given what we know. */
export function resolveState(input: {
  navigatorOnline: boolean;
  /** null when we have not confirmed either way yet. */
  healthOk: boolean | null;
  syncing: boolean;
}): ConnectionState {
  if (!input.navigatorOnline) return "OFFLINE";
  if (input.healthOk === false) return "OFFLINE";
  // Only claim SYNCING when we actually believe we can reach the server.
  if (input.syncing) return "SYNCING";
  return "ONLINE";
}

type Listener = () => void;

class ConnectivityMonitor {
  private listeners = new Set<Listener>();
  private healthOk: boolean | null = null;
  private syncing = false;
  private lastCheck = 0;
  private started = false;
  private cachedState: ConnectionState = "ONLINE";

  private navigatorOnline(): boolean {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine !== false;
  }

  /** Cached so useSyncExternalStore gets a stable snapshot value. */
  getSnapshot = (): ConnectionState => {
    const next = resolveState({
      navigatorOnline: this.navigatorOnline(),
      healthOk: this.healthOk,
      syncing: this.syncing,
    });
    if (next !== this.cachedState) this.cachedState = next;
    return this.cachedState;
  };

  /** The server always renders as if connected; the client corrects it. */
  getServerSnapshot = (): ConnectionState => "ONLINE";

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    this.start();
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;

    window.addEventListener("online", () => {
      // The browser thinks we are back; confirm it before believing it.
      this.healthOk = null;
      this.emit();
      void this.checkHealth(true);
    });

    window.addEventListener("offline", () => {
      this.healthOk = false;
      this.emit();
    });
  }

  setSyncing(value: boolean): void {
    if (this.syncing === value) return;
    this.syncing = value;
    this.emit();
  }

  /** Tell the monitor what a real request just discovered. */
  reportReachable(ok: boolean): void {
    if (this.healthOk === ok) return;
    this.healthOk = ok;
    this.emit();
  }

  /**
   * Ask the server whether it is really reachable. Throttled, and a
   * no-op when the browser already knows the device is offline.
   */
  async checkHealth(force = false): Promise<boolean> {
    if (!this.navigatorOnline()) {
      this.reportReachable(false);
      return false;
    }
    if (typeof fetch === "undefined") return true;

    const now = Date.now();
    if (!force && now - this.lastCheck < HEALTH_MIN_INTERVAL_MS) {
      return this.healthOk !== false;
    }
    this.lastCheck = now;

    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
      : null;

    try {
      const response = await fetch("/api/health", {
        method: "GET",
        cache: "no-store",
        signal: controller?.signal,
      });
      const ok = response.ok;
      this.reportReachable(ok);
      return ok;
    } catch {
      this.reportReachable(false);
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export const connectivity = new ConnectivityMonitor();

/** Convenience for non-React callers. */
export function isOnline(): boolean {
  return connectivity.getSnapshot() !== "OFFLINE";
}
