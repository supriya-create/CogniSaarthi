import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import { CaregiverSettings } from "@/components/caregiver/CaregiverSettings";
import { EmergencyManager } from "@/components/caregiver/EmergencyManager";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/caregiver/access";
import { getCaregiverPreference } from "@/lib/caregiver/preferences";
import { getCaregiverDict } from "@/lib/i18n/caregiver";
import { getEmergencyContactsForUser } from "@/lib/caregiver/emergency";
import { SignOutButton } from "../SignOutButton";

export const dynamic = "force-dynamic";

export default async function CaregiverSettingsPage() {
  const caregiver = await requireCaregiver();
  // Read the full preference row here rather than calling
  // `caregiverLanguage` as well — this page needs every field anyway.
  const prefs = await getCaregiverPreference(caregiver.id);
  const language = prefs.language;
  const dict = getCaregiverDict(language);
  const user = await linkedUserFor(caregiver.id);

  if (!user) {
    return (
      <CaregiverShell
        action={<SignOutButton label={dict.signOut} />}
        nav
        language={language}
      >
        <EmptyState
          title={dict.notConnectedTitle}
          body={dict.notConnectedSettings}
        />
      </CaregiverShell>
    );
  }

  const contacts = await getEmergencyContactsForUser(user.id);
  const timeZone = user.preference?.timeZone ?? "Asia/Kolkata";

  return (
    <CaregiverShell
      action={<SignOutButton label={dict.signOut} />}
      nav
      language={language}
    >
      <h1 className="font-serif text-3xl font-semibold">{dict.settingsTitle}</h1>

      <div className="mt-6">
        <CaregiverSettings
          prefs={{
            language: prefs.language,
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
          language={language}
        />
      </div>
    </CaregiverShell>
  );
}
