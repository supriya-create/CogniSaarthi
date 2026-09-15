import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import {
  ReminderManager,
  type ReminderDTO,
} from "@/components/caregiver/ReminderManager";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/caregiver/access";
import { getRemindersForUser, toSchedule } from "@/lib/reminders/queries";
import { reminderScheduleSummary } from "@/lib/reminders/labels";
import { formatTimeMinutes } from "@/lib/reminders/recurrence";
import { localDayOf } from "@/lib/reminders/timezone";
import { SignOutButton } from "../SignOutButton";

export const dynamic = "force-dynamic";

function isoDay(date: Date, timeZone: string): string {
  const d = localDayOf(date, timeZone);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.year}-${p(d.month)}-${p(d.day)}`;
}

export default async function CaregiverRemindersPage() {
  const caregiver = await requireCaregiver();
  const user = await linkedUserFor(caregiver.id);

  if (!user) {
    return (
      <CaregiverShell action={<SignOutButton />} nav>
        <EmptyState
          title="No one is connected to your account yet."
          body="Connect to a family member first, then you can set up reminders for them."
        />
      </CaregiverShell>
    );
  }

  const timeZone = user.preference?.timeZone ?? "Asia/Kolkata";
  const reminders = await getRemindersForUser(user.id);

  const dtos: ReminderDTO[] = reminders.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    category: r.category,
    priority: r.priority,
    time: formatTimeMinutes(r.timeMinutes),
    recurrence: r.recurrence,
    weekdays: r.weekdays,
    monthDay: r.monthDay,
    startDate: isoDay(r.startDate, timeZone),
    endDate: r.endDate ? isoDay(r.endDate, timeZone) : null,
    enabled: r.enabled,
    scheduleSummary: reminderScheduleSummary(toSchedule(r)),
  }));

  return (
    <CaregiverShell action={<SignOutButton />} nav>
      <ReminderManager reminders={dtos} userName={user.name} />
    </CaregiverShell>
  );
}
