import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import { CaregiverSettings } from "@/components/caregiver/CaregiverSettings";
import { EmergencyManager } from "@/components/caregiver/EmergencyManager";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/caregiver/access";
import { getCaregiverPreference } from "@/lib/caregiver/preferences";
import { getEmergencyContactsForUser } from "@/lib/caregiver/emergency";
import { SignOutButton } from "../SignOutButton";

export const dynamic = "force-dynamic";

export default async function CaregiverSettingsPage() {
  const caregiver = await requireCaregiver();
  const user = await linkedUserFor(caregiver.id);

  if (!user) {
    return (
      <CaregiverShell action={<SignOutButton />} nav>
        <EmptyState
          title="No one is connected to your account yet."
          body="Connect to a family member to manage their reminders, contacts and your notification settings."
        />
      </CaregiverShell>
    );
  }

  const [prefs, contacts] = await Promise.all([
    getCaregiverPreference(caregiver.id),
    getEmergencyContactsForUser(user.id),
  ]);
  const timeZone = user.preference?.timeZone ?? "Asia/Kolkata";

  return (
    <CaregiverShell action={<SignOutButton />} nav>
      <h1 className="font-serif text-3xl font-semibold">Settings</h1>

      <div className="mt-6">
        <CaregiverSettings
          prefs={{
            reminderNotifications: prefs.reminderNotifications,
            cognitiveActivityReminders: prefs.cognitiveActivityReminders,
            alertNotifications: prefs.alertNotifications,
            weeklySummary: prefs.weeklySummary,
          }}
          timeZone={timeZone}
          userName={user.name}
        />
      </div>

      <div className="mt-10 border-t border-border pt-8">
        <EmergencyManager
          contacts={contacts.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            relationship: c.relationship,
          }))}
          userName={user.name}
        />
      </div>
    </CaregiverShell>
  );
}
