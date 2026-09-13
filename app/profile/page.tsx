import { CircleCheck, CircleDashed, KeyRound } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { Avatar } from "@/components/elderly/Avatar";
import { requireUser } from "@/lib/auth/current-user";
import { getCaregiverLink } from "@/lib/db/queries";
import { getDict } from "@/lib/i18n/dictionaries";
import { formatConnectCode } from "@/lib/utils/connect-code";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  const link = await getCaregiverLink(user.id);

  return (
    <PageShell
      header={<ElderlyHeader backHref="/home" backLabel={dict.back} />}
      nav={<BottomNav dict={dict} />}
    >
      <div className="flex items-center gap-4">
        <Avatar avatarId={user.avatarId} size="lg" />
        <div className="min-w-0">
          <h1 className="font-serif text-3xl leading-tight font-semibold">
            {dict.profileTitle}
          </h1>
          <p className="mt-1 truncate text-lg text-text-muted">{user.name}</p>
        </div>
      </div>

      {/* Caregiver status is read-only here: the elder shares a code,
          the caregiver does the connecting from their own account. */}
      <section className="mt-8 rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <h2 className="font-serif text-xl font-semibold">
          {dict.profileCaregiver}
        </h2>

        {link ? (
          <p className="mt-3 flex items-center gap-2 text-lg font-medium text-success">
            <CircleCheck className="size-6 shrink-0" aria-hidden />
            {link.caregiver.name} — {dict.profileCaregiverConnected}
          </p>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-lg text-text-muted">
            <CircleDashed className="size-6 shrink-0" aria-hidden />
            {dict.profileCaregiverNone}
          </p>
        )}

        <div className="mt-5 rounded-xl border border-border bg-surface-alt p-4">
          <p className="flex items-center gap-2 text-base font-semibold text-text-muted">
            <KeyRound className="size-5 shrink-0" aria-hidden />
            {dict.profileConnectCode}
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.15em] tabular-nums">
            {formatConnectCode(user.connectCode)}
          </p>
          <p className="mt-2 text-base leading-snug text-text-muted">
            {dict.profileConnectCodeHelp}
          </p>
        </div>
      </section>

      <div className="mt-9">
        <ProfileForm
          initial={{
            name: user.name,
            avatarId: user.avatarId,
            language,
            fontScale: user.preference?.fontScale ?? "COMFORTABLE",
          }}
        />
      </div>
    </PageShell>
  );
}
