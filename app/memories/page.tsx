import { Sparkles } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MemoryCard } from "@/components/elderly/MemoryCard";
import { requireUser } from "@/lib/auth/current-user";
import { getEnabledMemoriesForUser } from "@/lib/memories/queries";
import { getDict } from "@/lib/i18n/dictionaries";

export default async function MemoriesPage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  const memories = await getEnabledMemoriesForUser(user.id);
  const withPhotos = memories.filter((m) => m.imagePath !== null);

  return (
    <PageShell
      header={<ElderlyHeader backHref="/home" backLabel={dict.back} />}
      nav={<BottomNav
          dict={dict}
          voice={
            user.preference?.voiceEnabled
              ? { language, speechRate: user.preference.speechRate }
              : undefined
          }
        />}
    >
      <h1 className="font-serif text-3xl font-semibold">{dict.memoriesTitle}</h1>
      <p className="mt-2 text-lg text-text-muted">{dict.memoriesBody}</p>

      {memories.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={dict.memoriesTitle} body={dict.memoriesEmpty} />
        </div>
      ) : (
        <>
          {withPhotos.length >= 1 ? (
            <div className="mt-7 rounded-2xl border border-secondary/25 bg-secondary-soft p-5">
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
                <Sparkles className="size-5 text-secondary" aria-hidden />
                {dict.memoryActivityTitle}
              </h2>
              <p className="mt-1 text-base text-text-muted">
                {dict.memoryActivityInvite}
              </p>
              <div className="mt-4">
                <LinkButton href="/memories/remember" variant="secondary">
                  {dict.memoryActivityStart}
                </LinkButton>
              </div>
            </div>
          ) : null}

          <ul className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {memories.map((memory) => (
              <MemoryCard
                key={memory.id}
                id={memory.id}
                title={memory.title}
                relationship={memory.relationship}
                description={memory.description}
                hasImage={memory.imagePath !== null}
              />
            ))}
          </ul>
        </>
      )}
    </PageShell>
  );
}
