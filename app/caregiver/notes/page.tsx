import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import { NotesManager, type NoteDTO } from "@/components/caregiver/NotesManager";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/caregiver/access";
import { getNotesWithAuthors } from "@/lib/caregiver/notes";
import { formatDayLabel } from "@/lib/utils/date";
import { localeTag } from "@/lib/i18n/dictionaries";
import { getCaregiverDict } from "@/lib/i18n/caregiver";
import { caregiverLanguage } from "@/lib/caregiver/preferences";
import { SignOutButton } from "../SignOutButton";

export const dynamic = "force-dynamic";

export default async function CaregiverNotesPage() {
  const caregiver = await requireCaregiver();
  const language = await caregiverLanguage(caregiver.id);
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
          body={dict.notConnectedNotes}
        />
      </CaregiverShell>
    );
  }

  const notes = await getNotesWithAuthors(user.id);
  const locale = localeTag(user.preference?.language ?? user.language);

  const dtos: NoteDTO[] = notes.map((n) => ({
    id: n.id,
    body: n.body,
    category: n.category,
    when: formatDayLabel(n.date, locale),
    mine: n.caregiverId === caregiver.id,
    author: n.caregiver.name,
  }));

  return (
    <CaregiverShell
      action={<SignOutButton label={dict.signOut} />}
      nav
      language={language}
    >
      <NotesManager notes={dtos} userName={user.name} language={language} />
    </CaregiverShell>
  );
}
