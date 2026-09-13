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

const roundSchema = z.object({
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

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type CaregiverLoginInput = z.infer<typeof caregiverLoginSchema>;
export type CaregiverSignupInput = z.infer<typeof caregiverSignupSchema>;
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;
