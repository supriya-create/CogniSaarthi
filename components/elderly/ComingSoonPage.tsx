import { Hammer, type LucideIcon } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/Button";
import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * A feature that is planned but not built.
 *
 * It says so plainly, in the same voice as the rest of the app, and
 * shows nothing that could be mistaken for working — no sample
 * photographs, no example reminders, no disabled controls hinting
 * at behaviour that does not exist.
 */
export function ComingSoonPage({
  title,
  body,
  Icon,
  dict,
}: {
  title: string;
  body: string;
  Icon: LucideIcon;
  dict: Dict;
}) {
  return (
    <PageShell
      header={<ElderlyHeader backHref="/home" backLabel={dict.back} />}
      nav={<BottomNav dict={dict} />}
    >
      <div className="mx-auto max-w-md py-6 text-center">
        <span
          aria-hidden
          className="mx-auto flex size-20 items-center justify-center rounded-2xl border border-border bg-surface-alt text-text-muted"
        >
          <Icon className="size-10" strokeWidth={1.75} />
        </span>

        <h1 className="mt-7 font-serif text-3xl font-semibold">{title}</h1>

        <p className="mt-4 text-xl leading-relaxed text-text-muted">{body}</p>

        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-base font-semibold text-text-muted">
          <Hammer className="size-5" aria-hidden />
          {dict.comingSoon}
        </p>

        <div className="mt-10">
          <LinkButton href="/games" variant="outline" fullWidth>
            {dict.navGames}
          </LinkButton>
        </div>
      </div>
    </PageShell>
  );
}
