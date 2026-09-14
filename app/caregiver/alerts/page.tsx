import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import { CaregiverNav } from "@/components/caregiver/CaregiverNav";
import { AlertCenter, type AlertDTO } from "@/components/caregiver/AlertCenter";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/caregiver/access";
import {
  getAlertsForCaregiver,
  syncAlerts,
  type AlertFilter,
} from "@/lib/caregiver/alerts";
import { formatDayLabel } from "@/lib/utils/date";
import { localeTag } from "@/lib/i18n/dictionaries";
import { SignOutButton } from "../SignOutButton";

export const dynamic = "force-dynamic";

const FILTERS: AlertFilter[] = ["all", "unread", "important", "resolved"];

export default async function CaregiverAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const caregiver = await requireCaregiver();
  const user = await linkedUserFor(caregiver.id);

  if (!user) {
    return (
      <CaregiverShell action={<SignOutButton />} nav={<CaregiverNav />}>
        <EmptyState
          title="No one is connected to your account yet."
          body="Once you are connected, meaningful updates about their day will appear here."
        />
      </CaregiverShell>
    );
  }

  const timeZone = user.preference?.timeZone ?? "Asia/Kolkata";
  // Recompute alerts before reading (lazy — there is no background job).
  await syncAlerts(user.id, timeZone);

  const sp = await searchParams;
  const filter: AlertFilter = FILTERS.includes(sp.filter as AlertFilter)
    ? (sp.filter as AlertFilter)
    : "all";

  const alerts = await getAlertsForCaregiver(caregiver.id, user.id, filter);
  const locale = localeTag(user.preference?.language ?? user.language);

  const dtos: AlertDTO[] = alerts.map((a) => ({
    id: a.id,
    severity: a.severity,
    title: a.title,
    body: a.body,
    status: a.status,
    when: formatDayLabel(a.createdAt, locale),
  }));

  return (
    <CaregiverShell action={<SignOutButton />} nav={<CaregiverNav />}>
      <AlertCenter alerts={dtos} filter={filter} />
    </CaregiverShell>
  );
}
