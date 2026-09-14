import { LifeBuoy } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { SosContacts } from "@/components/elderly/SosContacts";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/dictionaries";
import { getEmergencyContactsForUser } from "@/lib/caregiver/emergency";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  const contacts = await getEmergencyContactsForUser(user.id);

  return (
    <PageShell
      header={<ElderlyHeader backHref="/home" backLabel={dict.back} />}
      nav={<BottomNav dict={dict} />}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary"
        >
          <LifeBuoy className="size-7" />
        </span>
        <h1 className="font-serif text-3xl leading-tight font-semibold">
          {dict.sosTitle}
        </h1>
      </div>

      <SosContacts
        contacts={contacts.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          relationship: c.relationship,
        }))}
        language={language}
      />
    </PageShell>
  );
}
