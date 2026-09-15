import { CircleCheck, Images, ListChecks, ShieldCheck } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { CardIcon } from "@/components/ui/Card";
import { GlowDecor } from "@/components/ui/Decor";
import { ResearchConsentCard } from "@/components/elderly/ResearchConsentCard";
import { requireUser } from "@/lib/auth/current-user";
import { getDict, localeTag } from "@/lib/i18n/dictionaries";
import { getConsentStatus } from "@/lib/privacy/server";
import { formatDayLabel } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

/**
 * Privacy & Data, for the elder.
 *
 * Short by design. The rule from §19 is "do not overwhelm elderly
 * users", so this page answers three questions and stops: what have you
 * chosen, what does Cognisaarthi keep for you, and is this medical (no).
 *
 * The full policy lives in docs/, for whoever wants it. It is not
 * transcribed here, because a wall of text on this screen would make the
 * consent choice harder to find rather than better informed.
 */
export default async function PrivacyPage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  const consent = await getConsentStatus(user.id);

  // Formatted on the server so both renders agree — the same reason
  // DataFreshness takes a pre-formatted label.
  const lastUpdatedLabel = consent.updatedAt
    ? formatDayLabel(consent.updatedAt, localeTag(language))
    : null;

  const keeps = [
    { Icon: ListChecks, text: dict.privacyKeepsActivities },
    { Icon: Images, text: dict.privacyKeepsMemories },
    { Icon: CircleCheck, text: dict.privacyKeepsReminders },
  ];

  return (
    <PageShell
      header={
        <ElderlyHeader backHref="/profile" backLabel={dict.back} dict={dict} />
      }
      nav={
        <BottomNav
          dict={dict}
          voice={
            user.preference?.voiceEnabled
              ? { language, speechRate: user.preference.speechRate }
              : undefined
          }
        />
      }
    >
      <section className="panel surface-glow relative isolate overflow-hidden p-6">
        <GlowDecor className="-top-20 -right-16 size-56" />
        <div className="relative flex items-start gap-4">
          <CardIcon tone="primary" size="md">
            <ShieldCheck className="size-8" />
          </CardIcon>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl leading-tight font-semibold">
              {dict.privacyTitle}
            </h1>
            <p className="mt-2 text-lg leading-relaxed text-text-muted">
              {dict.privacyIntro}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <ResearchConsentCard
          language={language}
          initial={consent}
          lastUpdatedLabel={lastUpdatedLabel}
        />
      </div>

      <section className="panel mt-8 p-6">
        <h2 className="font-serif text-2xl leading-tight font-semibold">
          {dict.privacyKeepsHeading}
        </h2>
        <ul className="mt-4 flex flex-col gap-4">
          {keeps.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-lg leading-relaxed">
              <Icon className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 rounded-2xl border border-border bg-surface-alt/60 px-5 py-4 text-base leading-relaxed text-text-muted">
        {dict.privacyNotMedical}
      </p>
    </PageShell>
  );
}
