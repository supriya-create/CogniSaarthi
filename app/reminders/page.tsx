import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import {
  ReminderList,
  type ReminderItemDTO,
} from "@/components/elderly/ReminderList";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/dictionaries";
import { syncReminderDay } from "@/lib/reminders/sync";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);
  const timeZone = user.preference?.timeZone ?? "Asia/Kolkata";

  const dayItems = await syncReminderDay(user.id, timeZone);
  const items: ReminderItemDTO[] = dayItems.map((i) => ({
    reminderId: i.reminderId,
    scheduledFor: i.scheduledFor.toISOString(),
    title: i.title,
    description: i.description,
    category: i.category,
    priority: i.priority,
    timeMinutes: i.timeMinutes,
    state: i.state,
  }));

  return (
    <PageShell
      header={<ElderlyHeader backHref="/home" backLabel={dict.back} />}
      nav={<BottomNav dict={dict} />}
    >
      <ReminderList
        items={items}
        language={language}
        voicePrefs={{
          voiceEnabled: user.preference?.voiceEnabled ?? false,
          reminderVoice: user.preference?.reminderVoice ?? true,
          autoReadReminders: user.preference?.autoReadReminders ?? false,
          speechRate: user.preference?.speechRate ?? "NORMAL",
        }}
      />
    </PageShell>
  );
}
