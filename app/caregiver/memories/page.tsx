import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import { MemoryManager } from "@/components/caregiver/MemoryManager";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { getMemoriesForUser, linkedUserFor } from "@/lib/memories/queries";
import { getCaregiverDict, fill } from "@/lib/i18n/caregiver";
import { caregiverLanguage } from "@/lib/caregiver/preferences";
import { SignOutButton } from "../SignOutButton";

export default async function CaregiverMemoriesPage() {
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
          body={dict.notConnectedMemories}
        />
      </CaregiverShell>
    );
  }

  const memories = await getMemoriesForUser(user.id);

  return (
    <CaregiverShell
      action={<SignOutButton label={dict.signOut} />}
      nav
      language={language}
    >
      <Link
        href="/caregiver"
        className="inline-flex items-center gap-1 text-base font-semibold text-text-muted hover:text-text"
      >
        <ChevronLeft className="size-5" aria-hidden />
        {dict.backToDashboard}
      </Link>

      <h1 className="mt-3 font-serif text-3xl font-semibold">
        {fill(dict.memoriesTitle, { name: user.name })}
      </h1>
      <p className="mt-1.5 max-w-2xl text-base text-text-muted">
        {fill(dict.memoriesHelp, { name: user.name })}
      </p>

      <MemoryManager
        memories={memories}
        userName={user.name}
        language={language}
      />
    </CaregiverShell>
  );
}
