import { House, LifeBuoy } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/Button";
import { GlowDecor, HillsDecor } from "@/components/ui/Decor";
import { SosContacts } from "@/components/elderly/SosContacts";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/dictionaries";
import { getEmergencyContactsForUser } from "@/lib/caregiver/emergency";

export const dynamic = "force-dynamic";

/**
 * The help screen.
 *
 * Calm, not alarming: no sirens, no red, no countdown. Warm green and
 * a photo-frame-sized contact card, because the thing being offered
 * here is a person, not an emergency service. Cognisaarthi dials a
 * number and nothing more — it never says help is on the way, because
 * it has not called anyone.
 */
export default async function HelpPage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  const contacts = await getEmergencyContactsForUser(user.id);

  return (
    <PageShell
      header={
        <ElderlyHeader backHref="/home" backLabel={dict.back} dict={dict} />
      }
      nav={<BottomNav dict={dict} />}
    >
      <section className="panel surface-glow relative isolate overflow-hidden px-6 py-9 text-center">
        <GlowDecor className="-top-16 left-1/2 size-64 -translate-x-1/2" />
        <HillsDecor className="h-16 opacity-60" />

        <span
          aria-hidden
          className="relative mx-auto flex size-20 items-center justify-center rounded-full border border-primary/20 bg-primary-soft text-primary shadow-lift"
        >
          <LifeBuoy className="size-10" strokeWidth={1.8} />
        </span>
        <h1 className="relative mt-5 font-serif text-3xl leading-tight font-semibold sm:text-4xl">
          {dict.sosTitle}
        </h1>
        <p className="relative mx-auto mt-3 max-w-sm text-lg leading-relaxed text-text-muted">
          {dict.sosContactLabel}
        </p>
      </section>

      <SosContacts
        contacts={contacts.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          relationship: c.relationship,
        }))}
        language={language}
      />

      <div className="mt-8">
        <LinkButton
          href="/home"
          variant="outline"
          fullWidth
          icon={<House className="size-6" aria-hidden />}
        >
          {dict.resultBackHome}
        </LinkButton>
      </div>
    </PageShell>
  );
}
