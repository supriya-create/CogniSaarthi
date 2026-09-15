import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  PrismaClient,
  type Difficulty,
  type MemoryCategory,
  type MemoryPresentationMode,
  type MemoryRecallOutcome,
} from "@prisma/client";

import { GAME_DEFINITIONS } from "../lib/game-engine/definitions";
import { summarise } from "../lib/game-engine/scoring";
import { hashPassword } from "../lib/auth/password";
import { momentPng, personPng, placePng, thingPng } from "./demo/png";

/**
 * A COMPLETE, DETERMINISTIC DEMO.
 * -----------------------------------------------------------------
 * `npm run db:seed:demo` builds one family with enough history behind
 * it that every screen has something real to show — a month of
 * activities, a Memory Lane schedule with memories at different
 * stages, reminders that have been answered, caregiver notes, and a
 * consent decision on the record.
 *
 * Three properties are deliberate:
 *
 *  1. **Everything is synthetic and says so.** The caregiver's address
 *     is on `.example`, a domain reserved by RFC 2606 precisely so it
 *     can never belong to anybody, and the connection code is DEMO01.
 *     The photographs are flat illustrations generated here, not
 *     photographs of anyone.
 *  2. **It is idempotent.** Re-running it removes the demo family and
 *     rebuilds it. It touches nothing else in the database — every
 *     delete is scoped to the two demo accounts by their fixed keys.
 *  3. **Dates are relative to today.** A demo recorded against fixed
 *     timestamps looks abandoned a week later; this one always shows a
 *     month of activity ending yesterday.
 *
 * What it deliberately does NOT create is a familiar-voice recording.
 * A synthesised tone is not a daughter saying "Ma, this is Meera", and
 * seeding one would be exactly the placeholder-mistaken-for-real-data
 * this codebase refuses to ship. Record one live from the caregiver's
 * Memories screen — it takes five seconds and demonstrates the whole
 * path, which is a better demo anyway.
 */

const prisma = new PrismaClient();

const DEMO_CONNECT_CODE = "DEMO01";
const DEMO_CAREGIVER_EMAIL = "demo.caregiver@cognisaarthi.example";
const DEMO_CAREGIVER_PASSWORD = "demo-password-1";

const IMAGE_ROOT = path.join(process.cwd(), "storage", "memory-images");
const AUDIO_ROOT = path.join(process.cwd(), "storage", "memory-audio");

/**
 * Remove one stored file.
 *
 * Written here rather than imported from `lib/memories/storage.ts`,
 * which is `server-only` and cannot be loaded by a `tsx` script. The
 * guard is repeated rather than skipped: only a bare filename is ever
 * stored, so anything else means the row has been tampered with, and a
 * seed script deleting an arbitrary path would be a worse bug than the
 * orphaned file it is cleaning up.
 */
async function removeStoredFile(root: string, name: string): Promise<void> {
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return;
  try {
    await unlink(path.join(root, name));
  } catch {
    // Already gone.
  }
}

const DAY = 86_400_000;
/** Midnight-ish today, so every generated timestamp is stable within a run. */
const TODAY = startOfToday();

function startOfToday(): Date {
  const now = new Date();
  now.setHours(9, 0, 0, 0);
  return now;
}

function daysAgo(days: number, hour = 10, minute = 0): Date {
  const date = new Date(TODAY.getTime() - days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * A small deterministic generator.
 *
 * `Math.random()` would make the demo different every run, which is
 * the one thing a demo must not be — a rehearsed walkthrough has to
 * find the same numbers on the screen it found last night.
 */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

// ---------------------------------------------------------------
// The family
// ---------------------------------------------------------------

type RGB = [number, number, number];

interface DemoMemory {
  key: string;
  category: MemoryCategory;
  title: string;
  relationship: string | null;
  description: string;
  image: () => Buffer;
  /**
   * The recall history to lay down, oldest first: how many days ago,
   * and how it went. This is what puts each memory in a different
   * place in the schedule, which is the whole point of the caregiver's
   * retention screen.
   */
  history: { daysAgo: number; outcome: MemoryRecallOutcome; step: number }[];
}

// Warm, muted palettes drawn from the product's own tokens.
const FOREST: RGB = [30, 81, 71];
const CLAY: RGB = [176, 74, 44];
const GOLD: RGB = [192, 132, 42];
const PAPER: RGB = [250, 246, 239];
const SAND: RGB = [242, 235, 224];
const SAGE: RGB = [111, 141, 126];

const MEMORIES: DemoMemory[] = [
  {
    key: "meera",
    category: "PERSON",
    title: "Meera",
    relationship: "Daughter",
    description: "Your eldest. She calls on Sunday evenings.",
    image: () => personPng(PAPER, SAND, FOREST),
    // Recognised at every step up to a week: HOLDING.
    history: [
      { daysAgo: 34, outcome: "RECOGNISED", step: 0 },
      { daysAgo: 34, outcome: "RECOGNISED", step: 1 },
      { daysAgo: 34, outcome: "RECOGNISED", step: 2 },
      { daysAgo: 33, outcome: "RECOGNISED", step: 3 },
      { daysAgo: 30, outcome: "RECOGNISED", step: 4 },
      { daysAgo: 23, outcome: "RECOGNISED", step: 5 },
      { daysAgo: 9, outcome: "RECOGNISED", step: 6 },
    ],
  },
  {
    key: "anil",
    category: "PERSON",
    title: "Anil",
    relationship: "Son",
    description: "He brings the shopping on Saturdays.",
    image: () => personPng(PAPER, SAND, CLAY),
    // Up to three days, then a wobble and a recovery: BUILDING.
    history: [
      { daysAgo: 28, outcome: "RECOGNISED", step: 0 },
      { daysAgo: 28, outcome: "RECOGNISED", step: 1 },
      { daysAgo: 28, outcome: "ASSISTED", step: 2 },
      { daysAgo: 28, outcome: "RECOGNISED", step: 1 },
      { daysAgo: 27, outcome: "RECOGNISED", step: 2 },
      { daysAgo: 26, outcome: "RECOGNISED", step: 3 },
    ],
  },
  {
    key: "jorhat",
    category: "PLACE",
    title: "The house in Jorhat",
    relationship: null,
    description: "Where you lived when the children were small.",
    image: () => placePng(PAPER, SAND, SAGE),
    // Held at a week and a fortnight, then needed a hand at a month:
    // NEEDS_REINFORCEMENT, and the one the caregiver alert is about.
    history: [
      { daysAgo: 60, outcome: "RECOGNISED", step: 0 },
      { daysAgo: 60, outcome: "RECOGNISED", step: 1 },
      { daysAgo: 60, outcome: "RECOGNISED", step: 2 },
      { daysAgo: 59, outcome: "RECOGNISED", step: 3 },
      { daysAgo: 56, outcome: "RECOGNISED", step: 4 },
      { daysAgo: 49, outcome: "RECOGNISED", step: 5 },
      { daysAgo: 35, outcome: "RECOGNISED", step: 6 },
      { daysAgo: 5, outcome: "NOT_RECOGNISED", step: 7 },
    ],
  },
  {
    key: "wedding",
    category: "MOMENT",
    title: "Meera's wedding",
    relationship: null,
    description: "The whole family together, the year after the flood.",
    image: () => momentPng(PAPER, SAND, GOLD),
    // A day or two in: BUILDING.
    history: [
      { daysAgo: 12, outcome: "RECOGNISED", step: 0 },
      { daysAgo: 12, outcome: "RECOGNISED", step: 1 },
      { daysAgo: 12, outcome: "RECOGNISED", step: 2 },
      { daysAgo: 11, outcome: "RECOGNISED", step: 3 },
    ],
  },
  {
    key: "flask",
    category: "THING",
    title: "Your tea flask",
    relationship: null,
    description: "The one Anil brought back from Shillong.",
    image: () => thingPng(PAPER, SAND, CLAY),
    // Just started: LEARNING.
    history: [{ daysAgo: 2, outcome: "RECOGNISED", step: 0 }],
  },
  {
    key: "nabanita",
    category: "PERSON",
    title: "Nabanita",
    relationship: "Granddaughter",
    description: "Anil's daughter. She is studying in Guwahati.",
    image: () => personPng(PAPER, SAND, SAGE),
    // Never practised: NEW, and due immediately — this is the one the
    // demo's first Memory Lane prompt will be about.
    history: [],
  },
];

interface DemoReminder {
  title: string;
  description: string | null;
  category: "MEDICATION" | "DAILY_ROUTINE" | "FAMILY" | "COGNITIVE_ACTIVITY";
  priority: "NORMAL" | "IMPORTANT";
  timeMinutes: number;
}

const REMINDERS: DemoReminder[] = [
  {
    title: "Morning medicine",
    description: "The blue box on the shelf.",
    category: "MEDICATION",
    priority: "IMPORTANT",
    timeMinutes: 8 * 60,
  },
  {
    title: "Walk in the garden",
    description: null,
    category: "DAILY_ROUTINE",
    priority: "NORMAL",
    timeMinutes: 17 * 60,
  },
  {
    title: "Meera calls",
    description: "She rings after her dinner.",
    category: "FAMILY",
    priority: "NORMAL",
    timeMinutes: 20 * 60,
  },
];

// ---------------------------------------------------------------
// Building it
// ---------------------------------------------------------------

/** Remove any previous run. Scoped to the two demo accounts only. */
async function clearPreviousDemo(): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { connectCode: DEMO_CONNECT_CODE },
    select: { id: true },
  });
  const caregiver = await prisma.caregiver.findUnique({
    where: { email: DEMO_CAREGIVER_EMAIL },
    select: { id: true },
  });

  // The image FILES first, while the rows that name them still exist.
  // Deleting the user cascades the memories away, and a file whose row
  // is gone is a file nothing will ever clean up — re-running this
  // script a dozen times would leave a dozen sets behind.
  if (user) {
    const memories = await prisma.personalMemory.findMany({
      where: { userId: user.id },
      select: { imagePath: true, audio: { select: { path: true } } },
    });
    for (const memory of memories) {
      if (memory.imagePath) await removeStoredFile(IMAGE_ROOT, memory.imagePath);
      if (memory.audio) await removeStoredFile(AUDIO_ROOT, memory.audio.path);
    }
  }

  // Cascades take preferences, sessions, memories, recall events,
  // reminders, logs, notes, alerts, contacts and consents with them.
  if (user) await prisma.user.delete({ where: { id: user.id } });
  if (caregiver) await prisma.caregiver.delete({ where: { id: caregiver.id } });
}

async function writeImage(bytes: Buffer): Promise<string> {
  await mkdir(IMAGE_ROOT, { recursive: true });
  const name = `demo-${randomUUID()}.png`;
  await writeFile(path.join(IMAGE_ROOT, name), bytes);
  return name;
}

/**
 * A month of activities with a gentle, believable arc.
 *
 * Scores are produced by `summarise()` from generated round data
 * rather than written directly — the same function every real write
 * goes through, so the demo cannot contain a score the product could
 * not have produced.
 */
async function seedSessions(userId: string): Promise<void> {
  const random = makeRandom(20260915);
  const games = GAME_DEFINITIONS.map((g) => g.id);
  const difficulties: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

  for (let day = 30; day >= 1; day--) {
    // Not every day: a demo that shows a perfect streak is a demo of
    // something nobody's life looks like.
    if (random() < 0.2) continue;

    const perDay = random() < 0.35 ? 2 : 1;
    for (let n = 0; n < perDay; n++) {
      const gameId = games[Math.floor(random() * games.length)];
      // Difficulty creeps up over the month, as the engine would.
      const level = day > 20 ? 0 : day > 8 ? 1 : random() < 0.5 ? 1 : 2;
      const difficulty = difficulties[level];

      const roundCount = 4;
      // Accuracy improves slowly, with real variation around it.
      const base = 0.6 + (30 - day) * 0.008 + (random() - 0.5) * 0.18;
      const rounds = Array.from({ length: roundCount }, (_, index) => {
        const correct = random() < Math.min(0.95, Math.max(0.3, base)) ? 1 : 0;
        return {
          index,
          correct,
          total: 1,
          mistakes: correct ? 0 : 1,
          hintsUsed: random() < 0.12 ? 1 : 0,
          responseTimeMs: Math.round(3500 + random() * 4000),
        };
      });

      const durationMs = rounds.reduce((sum, r) => sum + r.responseTimeMs, 0);
      const summary = summarise({ rounds, durationMs });
      const startedAt = daysAgo(day, 10 + n * 6, Math.floor(random() * 50));

      const session = await prisma.gameSession.create({
        data: {
          userId,
          gameId,
          difficulty,
          language: "EN",
          status: "COMPLETED",
          startedAt,
          completedAt: new Date(startedAt.getTime() + durationMs),
          durationMs,
          roundsTotal: roundCount,
          roundsCompleted: roundCount,
          clientSessionId: `demo-${day}-${n}-${gameId}`,
        },
        select: { id: true },
      });

      await prisma.gameResult.create({
        data: {
          sessionId: session.id,
          score: summary.score,
          accuracy: summary.accuracy,
          stars: summary.stars,
          correctCount: summary.correctCount,
          incorrectCount: summary.incorrectCount,
          mistakes: summary.mistakes,
          hints: summary.hints,
          totalResponseTimeMs: summary.totalResponseTimeMs,
          avgResponseTimeMs: summary.avgResponseTimeMs,
          rawRounds: rounds,
        },
      });
    }
  }
}

const PRESENTATION: Record<MemoryCategory, MemoryPresentationMode> = {
  PERSON: "PERSON_RECOGNITION",
  PLACE: "PLACE_RECOGNITION",
  THING: "CONTEXT_RECALL",
  MOMENT: "CONTEXT_RECALL",
};

async function seedMemories(
  userId: string,
  caregiverId: string,
): Promise<void> {
  const random = makeRandom(42);

  for (const definition of MEMORIES) {
    const imagePath = await writeImage(definition.image());

    const memory = await prisma.personalMemory.create({
      data: {
        userId,
        caregiverId,
        category: definition.category,
        title: definition.title,
        relationship: definition.relationship,
        description: definition.description,
        imagePath,
        enabled: true,
        createdAt: daysAgo(62),
      },
      select: { id: true },
    });

    for (const [index, event] of definition.history.entries()) {
      const occurredAt = daysAgo(
        event.daysAgo,
        10,
        // Minutes apart, so a run of prompts inside one sitting has a
        // believable order rather than all landing on the same instant.
        Math.min(59, index * 3 + Math.floor(random() * 2)),
      );

      await prisma.memoryRecallEvent.create({
        data: {
          userId,
          memoryId: memory.id,
          clientEventId: `demo-${definition.key}-${index}`,
          outcome: event.outcome,
          mode: "CHOICE",
          presentation: PRESENTATION[definition.category],
          intervalStep: event.step,
          responseTimeMs: Math.round(2200 + random() * 3500),
          occurredAt,
          createdAt: occurredAt,
        },
      });
    }
  }
}

async function seedReminders(
  userId: string,
  caregiverId: string,
): Promise<void> {
  const random = makeRandom(7);

  for (const definition of REMINDERS) {
    const reminder = await prisma.reminder.create({
      data: {
        userId,
        caregiverId,
        title: definition.title,
        description: definition.description,
        category: definition.category,
        priority: definition.priority,
        timeMinutes: definition.timeMinutes,
        recurrence: "DAILY",
        startDate: daysAgo(40),
        enabled: true,
      },
      select: { id: true },
    });

    // A fortnight of answers: mostly acknowledged, occasionally not.
    // "Mostly" matters — a demo in which every reminder was answered
    // shows a caregiver dashboard with nothing to look at.
    for (let day = 14; day >= 1; day--) {
      const scheduledFor = daysAgo(
        day,
        Math.floor(definition.timeMinutes / 60),
        definition.timeMinutes % 60,
      );
      const roll = random();
      const status =
        roll < 0.78 ? "DONE" : roll < 0.88 ? "SKIPPED" : "MISSED";

      await prisma.reminderLog.create({
        data: {
          reminderId: reminder.id,
          userId,
          scheduledFor,
          status,
          acknowledgedAt:
            status === "MISSED"
              ? null
              : new Date(scheduledFor.getTime() + 12 * 60_000),
        },
      });
    }
  }
}

async function main(): Promise<void> {
  console.log("Building the Cognisaarthi demo…\n");

  await clearPreviousDemo();

  const user = await prisma.user.create({
    data: {
      name: "Ratna",
      avatarId: "marigold",
      language: "EN",
      connectCode: DEMO_CONNECT_CODE,
      createdAt: daysAgo(64),
      preference: {
        create: {
          language: "EN",
          fontScale: "LARGE",
          preferredDifficulty: "EASY",
          // On, so the demo can show the voice controls without first
          // visiting settings.
          voiceEnabled: true,
          speechRate: "NORMAL",
          timeZone: "Asia/Kolkata",
        },
      },
    },
    select: { id: true },
  });

  const caregiver = await prisma.caregiver.create({
    data: {
      name: "Meera",
      email: DEMO_CAREGIVER_EMAIL,
      passwordHash: await hashPassword(DEMO_CAREGIVER_PASSWORD),
      createdAt: daysAgo(63),
      preference: { create: { language: "EN" } },
    },
    select: { id: true },
  });

  await prisma.caregiverLink.create({
    data: {
      caregiverId: caregiver.id,
      userId: user.id,
      relationship: "Daughter",
      status: "ACTIVE",
      createdAt: daysAgo(63),
    },
  });

  await seedSessions(user.id);
  console.log("  ✓ a month of activities");

  await seedMemories(user.id, caregiver.id);
  console.log(`  ✓ ${MEMORIES.length} memories, with recall history`);

  await seedReminders(user.id, caregiver.id);
  console.log(`  ✓ ${REMINDERS.length} daily reminders and a fortnight of answers`);

  await prisma.caregiverNote.createMany({
    data: [
      {
        userId: user.id,
        caregiverId: caregiver.id,
        date: daysAgo(3),
        category: "MOOD",
        body: "Bright today. Talked about the Jorhat house for a long while.",
      },
      {
        userId: user.id,
        caregiverId: caregiver.id,
        date: daysAgo(8),
        category: "ACTIVITY",
        body: "Did two activities before lunch without being asked.",
      },
    ],
  });

  await prisma.emergencyContact.create({
    data: {
      userId: user.id,
      name: "Meera",
      phone: "+91 90000 00000",
      relationship: "Daughter",
    },
  });

  // A consent decision ON THE RECORD, so the privacy screen shows a
  // real state rather than "not asked" — which is the least
  // interesting of the four things that screen can say.
  await prisma.researchConsent.create({
    data: {
      userId: user.id,
      version: "research-consent-v1",
      purpose: "RESEARCH_IMPROVEMENT",
      consented: true,
      consentedAt: daysAgo(60),
    },
  });
  console.log("  ✓ notes, an emergency contact and a consent decision");

  console.log(`
────────────────────────────────────────────────────────────
  The demo is ready. Everything below is synthetic.

  Elder        Ratna — open http://localhost:3000 and the
               elder session is created on first visit via
               onboarding, OR sign in as the caregiver below
               and use connection code ${DEMO_CONNECT_CODE}.

  Caregiver    ${DEMO_CAREGIVER_EMAIL}
               ${DEMO_CAREGIVER_PASSWORD}

  Memory Lane starts with "Nabanita", which has never been
  practised. "The house in Jorhat" is the one showing as
  needing reinforcement on the caregiver's retention screen.

  To demonstrate the familiar voice, record one live from
  the caregiver's Memories screen — nothing here fakes it.
────────────────────────────────────────────────────────────
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
