import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import {
  MemoryManager,
  type ManagedMemory,
} from "@/components/caregiver/MemoryManager";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { linkedUserFor } from "@/lib/memories/queries";
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

  // `linkedUserFor` has already established that this caregiver is
  // actively linked to this elder, so the query is scoped to that
  // elder's id and cannot reach another family's memories.
  const rows = await prisma.personalMemory.findMany({
    where: { userId: user.id },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    include: { audio: { select: { id: true } } },
  });

  // Only what the manager needs — never a database row wholesale, and
  // never a stored file path, which has no business in a client
  // bundle even though it is only ever a bare filename.
  const memories: ManagedMemory[] = rows.map((memory) => ({
    id: memory.id,
    category: memory.category,
    title: memory.title,
    relationship: memory.relationship,
    description: memory.description,
    enabled: memory.enabled,
    hasImage: memory.imagePath !== null,
    hasAudio: memory.audio !== null,
  }));

  return (
    <CaregiverShell
      action={<SignOutButton label={dict.signOut} />}
      nav
      language={language}
    >
      <Link
        href="/caregiver"
        className="inline-flex min-h-[2.75rem] items-center gap-1 rounded-lg pr-3 text-base font-semibold text-text-muted hover:text-text"
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
