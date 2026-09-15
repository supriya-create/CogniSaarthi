import { z } from "zod";

/**
 * Every request body crosses one of these before it reaches Prisma.
 * Shared between the API routes and the forms that call them.
 */

export const languageSchema = z.enum(["EN", "HI", "AS"]);
export const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);
export const fontScaleSchema = z.enum(["COMFORTABLE", "LARGE", "EXTRA_LARGE"]);

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Please enter a name.")
  .max(40, "That name is a little too long.");

export const onboardingSchema = z.object({
  name: nameSchema,
  language: languageSchema,
});

export const profileUpdateSchema = z.object({
  name: nameSchema.optional(),
  language: languageSchema.optional(),
  fontScale: fontScaleSchema.optional(),
  avatarId: z.string().min(1).max(32).optional(),
  reduceMotion: z.boolean().optional(),
  preferredDifficulty: difficultySchema.optional(),
  // Phase 3 voice assistance preferences.
  voiceEnabled: z.boolean().optional(),
  autoReadInstructions: z.boolean().optional(),
  speechRate: z.enum(["SLOW", "NORMAL"]).optional(),
  // Phase 4 timezone + notification experience.
  timeZone: z.string().trim().min(1).max(64).optional(),
  reminderVoice: z.boolean().optional(),
  autoReadReminders: z.boolean().optional(),
  notificationSound: z.boolean().optional(),
});

export const caregiverLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const caregiverSignupSchema = z.object({
  name: nameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200),
  connectCode: z
    .string()
    .trim()
    .min(1, "Enter the code shown on your family member's profile."),
});

export const memoryCategorySchema = z.enum([
  "PERSON",
  "PLACE",
  "THING",
  "MOMENT",
]);
export const speechRateSchema = z.enum(["SLOW", "NORMAL"]);

/** Memory fields shared by create and update (image handled separately). */
export const memoryFieldsSchema = z.object({
  category: memoryCategorySchema,
  title: z.string().trim().min(1, "A name or title is needed.").max(60),
  relationship: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  enabled: z.boolean().optional(),
});

export const voicePrefsSchema = z.object({
  voiceEnabled: z.boolean().optional(),
  autoReadInstructions: z.boolean().optional(),
  speechRate: speechRateSchema.optional(),
});

export const startSessionSchema = z.object({
  gameId: z.string().min(1),
  difficulty: difficultySchema,
  /** Reserved for offline replay; makes the write idempotent. */
  clientSessionId: z.string().min(8).max(64).optional(),
});

export const roundSchema = z.object({
  index: z.number().int().min(0).max(50),
  correct: z.number().int().min(0).max(100),
  total: z.number().int().min(1).max(100),
  mistakes: z.number().int().min(0).max(200),
  hintsUsed: z.number().int().min(0).max(50),
  responseTimeMs: z.number().int().min(0).max(1000 * 60 * 30),
  detail: z.record(z.string(), z.unknown()).optional(),
});

export const completeSessionSchema = z.object({
  sessionId: z.string().min(1),
  durationMs: z.number().int().min(0).max(1000 * 60 * 60),
  rounds: z.array(roundSchema).min(1).max(50),
});

// ------------------------- Phase 4: reminders -------------------------

export const reminderCategorySchema = z.enum([
  "MEDICATION",
  "APPOINTMENT",
  "DAILY_ROUTINE",
  "COGNITIVE_ACTIVITY",
  "FAMILY",
  "OTHER",
]);
export const recurrenceTypeSchema = z.enum([
  "ONCE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
]);
export const reminderPrioritySchema = z.enum(["NORMAL", "IMPORTANT"]);

const timeStringSchema = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, "Enter a time as HH:MM.");
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD.");

export const reminderInputSchema = z
  .object({
    title: z.string().trim().min(1, "A title is needed.").max(80),
    description: z.string().trim().max(300).optional().or(z.literal("")),
    category: reminderCategorySchema,
    priority: reminderPrioritySchema.optional(),
    time: timeStringSchema,
    recurrence: recurrenceTypeSchema,
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    monthDay: z.number().int().min(1).max(31).optional().nullable(),
    startDate: dateStringSchema,
    endDate: dateStringSchema.optional().nullable(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.recurrence !== "WEEKLY" || (v.weekdays !== undefined && v.weekdays.length > 0),
    { message: "Choose at least one weekday.", path: ["weekdays"] },
  );

export const acknowledgeReminderSchema = z.object({
  reminderId: z.string().min(1),
  scheduledFor: z.string().min(1),
  action: z.enum(["DONE", "SKIP", "LATER"]),
});

export const noteCategorySchema = z.enum([
  "GENERAL",
  "MOOD",
  "ACTIVITY",
  "SLEEP",
  "APPETITE",
  "OTHER",
]);

export const noteInputSchema = z.object({
  body: z.string().trim().min(1, "Write a short note.").max(500),
  category: noteCategorySchema.optional(),
  date: dateStringSchema.optional(),
});

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1, "A name is needed.").max(60),
  phone: z.string().trim().min(3, "Enter a phone number.").max(30),
  relationship: z.string().trim().max(40).optional().or(z.literal("")),
});

export const caregiverPrefsSchema = z.object({
  reminderNotifications: z.boolean().optional(),
  cognitiveActivityReminders: z.boolean().optional(),
  alertNotifications: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
});

export const alertActionSchema = z.object({
  action: z.enum(["read", "resolve", "dismiss"]),
});

// ------------------------- Phase 5: offline sync -------------------------

/**
 * Payloads pushed up by the offline queue. Everything is re-validated
 * here: the client's identity, ownership, scores and timestamps are all
 * re-derived or re-checked server-side, never trusted as sent.
 */

const isoDateString = z
  .string()
  .min(1)
  .max(40)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid timestamp.");

export const gameSessionSyncPayloadSchema = z.object({
  /** Client-generated idempotency key — the server de-duplicates on it. */
  clientSessionId: z.string().min(8).max(64),
  gameId: z.string().min(1).max(64),
  difficulty: difficultySchema,
  language: languageSchema,
  startedAt: isoDateString,
  completedAt: isoDateString,
  durationMs: z.number().int().min(0).max(1000 * 60 * 60),
  rounds: z.array(roundSchema).min(1).max(50),
});

export const reminderAckSyncPayloadSchema = z.object({
  reminderId: z.string().min(1).max(64),
  scheduledFor: isoDateString,
  action: z.enum(["DONE", "SKIP", "LATER"]),
  /** When the person actually answered, for deterministic conflicts. */
  eventAt: isoDateString,
});

export const syncOperationSchema = z.object({
  id: z.string().min(1).max(64),
  entityType: z.enum(["GAME_SESSION", "REMINDER_LOG"]),
  entityId: z.string().min(1).max(200),
  operation: z.enum(["CREATE", "UPDATE", "ACKNOWLEDGE", "DELETE"]),
  payload: z.unknown(),
});

export const syncPushSchema = z.object({
  operations: z.array(syncOperationSchema).min(1).max(100),
});

/**
 * Phase 7 — research consent.
 *
 * Note the absence of a `userId`: identity comes from the elder's own
 * session cookie. A body cannot nominate whose consent is being
 * changed, which is what makes "a caregiver cannot consent for an
 * elder" a property of the type rather than a rule someone has to
 * remember to check.
 *
 * `.strict()` so an extra field is a 400 rather than something ignored.
 */
export const researchConsentSchema = z
  .object({
    action: z.enum(["GRANT", "DECLINE", "WITHDRAW"]),
  })
  .strict();

export type ResearchConsentInput = z.infer<typeof researchConsentSchema>;

export type SyncOperationInput = z.infer<typeof syncOperationSchema>;

export type ReminderInput = z.infer<typeof reminderInputSchema>;
export type NoteInput = z.infer<typeof noteInputSchema>;
export type EmergencyContactInput = z.infer<typeof emergencyContactSchema>;

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type CaregiverLoginInput = z.infer<typeof caregiverLoginSchema>;
export type CaregiverSignupInput = z.infer<typeof caregiverSignupSchema>;
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;
