import { Images, Sparkles } from "lucide-react";
import type { MemoryCategory } from "@prisma/client";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrchidSprig } from "@/components/ui/Decor";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MemoryCard } from "@/components/elderly/MemoryCard";
import { requireUser } from "@/lib/auth/current-user";
import { getEnabledMemoriesForUser } from "@/lib/memories/queries";
import { getDict } from "@/lib/i18n/dictionaries";

/** The order the album is arranged in — people first, always. */
const CATEGORY_ORDER: MemoryCategory[] = [
  "PERSON",
  "PLACE",
  "THING",
  "MOMENT",
];

export default async function MemoriesPage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  const memories = await getEnabledMemoriesForUser(user.id);
  const withPhotos = memories.filter((m) => m.imagePath !== null);

  // Grouped into the four kinds so the page reads as an album with
  // sections rather than one long undifferentiated grid.
  const sections = CATEGORY_ORDER.map((category) => ({
    category,
    label: dict[`memoryCat${category}` as const],
    items: memories.filter((m) => m.category === category),
  })).filter((section) => section.items.length > 0);

  return (
    <PageShell
      header={
        <ElderlyHeader backHref="/home" backLabel={dict.back} dict={dict} />
      }
      nav={<BottomNav
          dict={dict}
          voice={
            user.preference?.voiceEnabled
              ? { language, speechRate: user.preference.speechRate }
              : undefined
          }
        />}
    >
      <SectionHeading
        as="h1"
        size="lg"
        title={dict.memoriesTitle}
        description={dict.memoriesBody}
      />

      {memories.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={dict.memoriesTitle}
            body={dict.memoriesEmpty}
            icon={<Images className="size-10" aria-hidden />}
          />
        </div>
      ) : (
        <>
          {withPhotos.length >= 1 ? (
            <section className="panel relative isolate mt-8 overflow-hidden border-secondary/25 bg-secondary-soft p-5 sm:p-6">
              <OrchidSprig className="pointer-events-none absolute -top-6 -right-6 !size-40 opacity-30" />
              <div className="relative flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2.5 font-serif text-xl font-semibold">
                    <Sparkles className="size-5 shrink-0 text-secondary" aria-hidden />
                    {dict.memoryActivityTitle}
                  </h2>
                  <p className="mt-1.5 text-base text-text-muted">
                    {dict.memoryActivityInvite}
                  </p>
                </div>
                <LinkButton
                  href="/memories/remember"
                  variant="secondary"
                  size="md"
                >
                  {dict.memoryActivityStart}
                </LinkButton>
              </div>
            </section>
          ) : null}

          {sections.map((section) => (
            <section key={section.category} className="mt-9">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl font-semibold">
                  {section.label}
                </h2>
                <span className="numeric text-base text-text-muted">
                  {section.items.length === 1
                    ? dict.memoryCountOne
                    : dict.memoryCountMany.replace(
                        "{n}",
                        String(section.items.length),
                      )}
                </span>
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {section.items.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    id={memory.id}
                    title={memory.title}
                    relationship={memory.relationship}
                    description={memory.description}
                    category={memory.category}
                    hasImage={memory.imagePath !== null}
                    language={language}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </PageShell>
  );
}
