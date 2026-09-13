import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MemoryActivity } from "@/components/elderly/MemoryActivity";
import { requireUser } from "@/lib/auth/current-user";
import { getEnabledMemoriesForUser } from "@/lib/memories/queries";
import { buildMemoryRounds, type MemoryItem } from "@/lib/memories/activity";
import { getDict } from "@/lib/i18n/dictionaries";

export default async function RememberPage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  const memories = await getEnabledMemoriesForUser(user.id);
  const items: MemoryItem[] = memories.map((m) => ({
    id: m.id,
    category: m.category,
    title: m.title,
    relationship: m.relationship,
    hasImage: m.imagePath !== null,
  }));

  const rounds = buildMemoryRounds(items);

  // Need at least one memory with a photo to run the activity.
  if (rounds.length === 0) {
    return (
      <PageShell
        header={<ElderlyHeader backHref="/memories" backLabel={dict.back} />}
      >
        <div className="mt-6">
          <EmptyState
            title={dict.memoryActivityTitle}
            body={dict.memoryActivityNotEnough}
            action={
              <LinkButton href="/memories" fullWidth>
                {dict.back}
              </LinkButton>
            }
          />
        </div>
      </PageShell>
    );
  }

  return (
    <MemoryActivity
      rounds={rounds}
      language={language}
      voiceEnabled={user.preference?.voiceEnabled ?? false}
      speechRate={user.preference?.speechRate ?? "NORMAL"}
    />
  );
}
