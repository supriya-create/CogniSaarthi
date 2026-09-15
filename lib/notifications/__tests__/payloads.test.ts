import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LANGUAGES, getDict } from "@/lib/i18n/dictionaries";
import {
  buildSafeNotification,
  destinationForKind,
  EMITTED_NOTIFICATION_KINDS,
  NOTIFICATION_DESTINATION,
  type SafeNotificationKind,
} from "@/lib/notifications/payloads";

const KINDS = Object.keys(NOTIFICATION_DESTINATION) as SafeNotificationKind[];

describe("notification payloads carry no private content", () => {
  /**
   * The real guarantee is structural — `buildSafeNotification` takes a
   * kind and a dictionary, so there is no parameter through which a
   * name, a medication or a memory could arrive. These cases pin the
   * consequence of that design so a later signature change is caught.
   */
  const PRIVATE = [
    "Meera",
    "daughter",
    "Metformin",
    "500mg",
    "Jorhat",
    "medication",
    "medicine",
    "photo",
  ];

  for (const { code } of LANGUAGES) {
    it(`${code}: no built notification mentions anything private`, () => {
      const dict = getDict(code);
      for (const kind of KINDS) {
        const built = buildSafeNotification(kind, dict);
        const text = `${built.title} ${built.body}`.toLowerCase();
        for (const word of PRIVATE) {
          expect(text, `${code}/${kind} leaked "${word}"`).not.toContain(
            word.toLowerCase(),
          );
        }
      }
    });
  }

  it("puts only a kind in the click data, never content", () => {
    const built = buildSafeNotification("REMINDER_DUE", getDict("EN"));
    // Anything attached to the notification outlives the page, so the
    // payload is deliberately an enum value and nothing else.
    expect(built.kind).toBe("REMINDER_DUE");
    expect(Object.keys(built).sort()).toEqual(
      [
        "badge",
        "body",
        "icon",
        "kind",
        "renotify",
        "requireInteraction",
        "silent",
        "tag",
        "title",
        "url",
      ].sort(),
    );
  });
});

describe("notification payload shape", () => {
  for (const { code } of LANGUAGES) {
    it(`${code}: every kind builds non-empty, localised text`, () => {
      const dict = getDict(code);
      for (const kind of KINDS) {
        const built = buildSafeNotification(kind, dict);
        expect(built.title.length).toBeGreaterThan(0);
        expect(built.body.length).toBeGreaterThan(0);
      }
    });
  }

  it("never demands interaction and is never silent", () => {
    for (const kind of KINDS) {
      const built = buildSafeNotification(kind, getDict("EN"));
      // A banner that cannot be dismissed is a trap for somebody who
      // is confused by it; a silent one is not a reminder at all.
      expect(built.requireInteraction).toBe(false);
      expect(built.silent).toBe(false);
      expect(built.renotify).toBe(false);
    }
  });

  it("gives each kind its own collapse tag", () => {
    const tags = KINDS.map((k) => buildSafeNotification(k, getDict("EN")).tag);
    // Distinct, so an activity nudge never overwrites a reminder…
    expect(new Set(tags).size).toBe(KINDS.length);
    // …but stable, so eleven reminders collapse into one banner.
    expect(buildSafeNotification("REMINDER_DUE", getDict("EN")).tag).toBe(
      buildSafeNotification("REMINDER_DUE", getDict("HI")).tag,
    );
  });
});

describe("click destinations", () => {
  it("sends a reminder notification to /reminders", () => {
    expect(destinationForKind("REMINDER_DUE")).toBe("/reminders");
  });

  it("sends a daily activity notification to /home", () => {
    expect(destinationForKind("DAILY_ACTIVITY")).toBe("/home");
  });

  it("sends a Memory Lane notification to /memories/lane", () => {
    expect(destinationForKind("MEMORY_LANE_DUE")).toBe("/memories/lane");
  });

  it("resolves nothing for an unknown kind", () => {
    expect(destinationForKind("SOMETHING_ELSE")).toBeNull();
    expect(destinationForKind("")).toBeNull();
  });

  it("is not fooled by inherited object properties", () => {
    // A tampered or malformed `data.kind` must not resolve through the
    // prototype chain to something truthy.
    expect(destinationForKind("constructor")).toBeNull();
    expect(destinationForKind("__proto__")).toBeNull();
    expect(destinationForKind("toString")).toBeNull();
  });

  it("only ever resolves to a same-origin absolute path", () => {
    for (const destination of Object.values(NOTIFICATION_DESTINATION)) {
      expect(destination.startsWith("/")).toBe(true);
      expect(destination.startsWith("//")).toBe(false);
    }
  });
});

describe("what is actually emitted", () => {
  /**
   * Until Memory Lane shipped, this block asserted the OPPOSITE: that
   * MEMORY_LANE_DUE was never emitted, because /memories/lane did not
   * exist and a notification must not send somebody to a page that is
   * not there. The route exists now, so the assertion is inverted
   * rather than deleted — the rule it protects has not changed, only
   * which side of it this kind falls on.
   */
  it("emits Memory Lane notifications, now that the route exists", () => {
    expect(EMITTED_NOTIFICATION_KINDS).toContain("MEMORY_LANE_DUE");

    const page = path.join(
      process.cwd(),
      "app",
      "memories",
      "lane",
      "page.tsx",
    );
    expect(existsSync(page), "/memories/lane has no page").toBe(true);
  });

  it("emits only kinds that have a real destination", () => {
    for (const kind of EMITTED_NOTIFICATION_KINDS) {
      expect(destinationForKind(kind)).not.toBeNull();
    }
  });

  /**
   * The guarantee behind the one above, stated generally: every
   * destination any emitted notification can resolve to must be a
   * route that actually exists on disk.
   */
  it("only ever points at a route that exists", () => {
    for (const kind of EMITTED_NOTIFICATION_KINDS) {
      const destination = destinationForKind(kind);
      expect(destination).not.toBeNull();
      const page = path.join(
        process.cwd(),
        "app",
        ...destination!.split("/").filter(Boolean),
        "page.tsx",
      );
      expect(existsSync(page), `${kind} -> ${destination} has no page`).toBe(
        true,
      );
    }
  });
});

describe("the service worker agrees with the app", () => {
  /**
   * The worker is a plain script outside the bundle, so it cannot
   * import the map above and keeps its own copy. Drift would mean a
   * notification that opens the wrong page — or nothing at all — so
   * the two are compared here rather than trusted to stay in step.
   */
  const sw = readFileSync(
    path.join(process.cwd(), "public", "sw.js"),
    "utf8",
  );

  it("declares the same destination for every kind", () => {
    for (const [kind, destination] of Object.entries(
      NOTIFICATION_DESTINATION,
    )) {
      expect(sw, `sw.js is missing ${kind}`).toContain(
        `${kind}: "${destination}"`,
      );
    }
  });

  it("handles notificationclick", () => {
    expect(sw).toContain('addEventListener("notificationclick"');
  });

  it("has no push handler, because there is no push service", () => {
    // Web Push needs VAPID keys and a push service. Neither exists, so
    // a handler here would be a claim the product cannot honour.
    expect(sw).not.toContain('addEventListener("push"');
  });
});
