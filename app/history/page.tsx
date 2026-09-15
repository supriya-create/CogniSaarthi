import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ActivityItem } from "@/components/elderly/ActivityItem";
import { UnsyncedHistory } from "@/components/elderly/UnsyncedHistory";
import { requireUser } from "@/lib/auth/current-user";
import { getRecentSessions } from "@/lib/db/queries";
import { getDict } from "@/lib/i18n/dictionaries";
import { isToday } from "@/lib/utils/date";

export default async function HistoryPage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  const sessions = await getRecentSessions(user.id);
  const today = sessions.filter((s) => isToday(s.startedAt));
  const earlier = sessions.filter((s) => !isToday(s.startedAt));

  const groups = [
    { key: "today", title: dict.historyToday, items: today },
    { key: "earlier", title: dict.historyEarlier, items: earlier },
  ].filter((group) => group.items.length > 0);

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
        title={dict.historyTitle}
        description={dict.historySubtitle}
      />

      {/* Anything played on this device that has not reached the server
          yet — so history is never empty just because the network is. */}
      <UnsyncedHistory language={language} />

      {groups.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={dict.historyEmpty}
            action={
              <LinkButton href="/games" fullWidth>
                {dict.historyEmptyAction}
              </LinkButton>
            }
          />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="mt-9">
            <h2 className="font-serif text-xl font-semibold">{group.title}</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {group.items.map((session) => (
                <ActivityItem
                  key={session.id}
                  session={session}
                  language={language}
                  dict={dict}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </PageShell>
  );
}
