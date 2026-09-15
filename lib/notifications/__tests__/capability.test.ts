import { describe, expect, it } from "vitest";

import {
  assessNotifications,
  canAskForPermission,
  canShowNotifications,
  type NotificationEnvironment,
} from "@/lib/notifications/capability";

/**
 * The capability rule decides what an elderly person is offered. The
 * failure this guards against is a switch that turns on and silently
 * never notifies anybody — so every environment must resolve to one
 * unambiguous state, and only one of them may show an enable button.
 */

/** A modern browser on https with permission not yet asked. */
const supported: NotificationEnvironment = {
  isSecureContext: true,
  hasNotificationApi: true,
  hasServiceWorker: true,
  permission: "default",
};

describe("a supported browser", () => {
  it("needs permission before it is ready", () => {
    expect(assessNotifications(supported)).toEqual({
      state: "NEEDS_PERMISSION",
    });
  });

  it("is READY once permission is granted", () => {
    expect(
      assessNotifications({ ...supported, permission: "granted" }),
    ).toEqual({ state: "READY" });
  });

  it("only reports it can show when permission is granted", () => {
    expect(
      canShowNotifications(
        assessNotifications({ ...supported, permission: "granted" }),
      ),
    ).toBe(true);
    expect(canShowNotifications(assessNotifications(supported))).toBe(false);
  });
});

describe("an unsupported browser", () => {
  it("reports a missing Notification API", () => {
    expect(
      assessNotifications({ ...supported, hasNotificationApi: false }),
    ).toEqual({ state: "UNSUPPORTED", reason: "NO_NOTIFICATION_API" });
  });

  it("reports a missing service worker", () => {
    expect(
      assessNotifications({ ...supported, hasServiceWorker: false }),
    ).toEqual({ state: "UNSUPPORTED", reason: "NO_SERVICE_WORKER" });
  });

  it("blames the insecure context first, because it causes the rest", () => {
    // On plain http the other APIs are withheld, so reporting "no
    // service worker" would send somebody after the wrong problem.
    expect(
      assessNotifications({
        isSecureContext: false,
        hasNotificationApi: false,
        hasServiceWorker: false,
        permission: null,
      }),
    ).toEqual({ state: "UNSUPPORTED", reason: "INSECURE_CONTEXT" });
  });

  it("never offers to ask for permission", () => {
    for (const env of [
      { ...supported, hasNotificationApi: false },
      { ...supported, hasServiceWorker: false },
      { ...supported, isSecureContext: false },
    ]) {
      expect(canAskForPermission(assessNotifications(env))).toBe(false);
      expect(canShowNotifications(assessNotifications(env))).toBe(false);
    }
  });
});

describe("permission denied", () => {
  const denied = assessNotifications({ ...supported, permission: "denied" });

  it("is its own state, not folded into NEEDS_PERMISSION", () => {
    expect(denied).toEqual({ state: "DENIED" });
  });

  it("never offers an enable button", () => {
    // Asking again opens no prompt, so a button would do nothing —
    // the interface explains the browser setting instead.
    expect(canAskForPermission(denied)).toBe(false);
  });

  it("cannot show notifications", () => {
    expect(canShowNotifications(denied)).toBe(false);
  });
});

describe("asking for permission", () => {
  it("is offered only when a prompt would actually appear", () => {
    expect(canAskForPermission(assessNotifications(supported))).toBe(true);
    expect(
      canAskForPermission(
        assessNotifications({ ...supported, permission: "granted" }),
      ),
    ).toBe(false);
  });
});
