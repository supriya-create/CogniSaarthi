import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { profileUpdateSchema } from "@/lib/validation/schemas";

/**
 * Updates the person's own profile. Every field is optional so the
 * profile screen can save just what changed.
 */
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = profileUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const {
    name,
    avatarId,
    language,
    fontScale,
    reduceMotion,
    preferredDifficulty,
    voiceEnabled,
    autoReadInstructions,
    speechRate,
    timeZone,
    reminderVoice,
    autoReadReminders,
    notificationSound,
  } = parsed.data;

  // Preference fields shared by create and update.
  const preferenceData = {
    ...(language !== undefined && { language }),
    ...(fontScale !== undefined && { fontScale }),
    ...(reduceMotion !== undefined && { reduceMotion }),
    ...(preferredDifficulty !== undefined && { preferredDifficulty }),
    ...(voiceEnabled !== undefined && { voiceEnabled }),
    ...(autoReadInstructions !== undefined && { autoReadInstructions }),
    ...(speechRate !== undefined && { speechRate }),
    ...(timeZone !== undefined && { timeZone }),
    ...(reminderVoice !== undefined && { reminderVoice }),
    ...(autoReadReminders !== undefined && { autoReadReminders }),
    ...(notificationSound !== undefined && { notificationSound }),
  };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(avatarId !== undefined && { avatarId }),
      ...(language !== undefined && { language }),
      preference: {
        // A user created before preferences existed still gets a row.
        upsert: { create: preferenceData, update: preferenceData },
      },
    },
  });

  return NextResponse.json({ ok: true });
}
