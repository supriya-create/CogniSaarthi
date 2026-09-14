import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import { CaregiverNav } from "@/components/caregiver/CaregiverNav";
import { MemoryManager } from "@/components/caregiver/MemoryManager";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { getMemoriesForUser, linkedUserFor } from "@/lib/memories/queries";
import { SignOutButton } from "../SignOutButton";

export default async function CaregiverMemoriesPage() {
  const caregiver = await requireCaregiver();
  const user = await linkedUserFor(caregiver.id);

  if (!user) {
    return (
      <CaregiverShell action={<SignOutButton />} nav={<CaregiverNav />}>
        <EmptyState
          title="No one is connected to your account yet."
          body="Connect to a family member first, then you can add memories for them."
        />
      </CaregiverShell>
    );
  }

  const memories = await getMemoriesForUser(user.id);

  return (
    <CaregiverShell action={<SignOutButton />} nav={<CaregiverNav />}>
      <Link
        href="/caregiver"
        className="inline-flex items-center gap-1 text-base font-semibold text-text-muted hover:text-text"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Back to dashboard
      </Link>

      <h1 className="mt-3 font-serif text-3xl font-semibold">
        {user.name}&apos;s memories
      </h1>
      <p className="mt-1.5 max-w-2xl text-base text-text-muted">
        Anything you add here can appear in {user.name}&apos;s Memories page and,
        if you allow it, in gentle recall activities. Only you and {user.name}{" "}
        can see these — photos are stored privately.
      </p>

      <MemoryManager memories={memories} userName={user.name} />
    </CaregiverShell>
  );
}
