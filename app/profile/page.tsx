import Link from "next/link";
import { CircleCheck, CircleDashed, ChevronRight, KeyRound, ShieldCheck } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { Avatar } from "@/components/elderly/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CardIcon } from "@/components/ui/Card";
import { GlowDecor } from "@/components/ui/Decor";
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
      <section className="panel surface-glow relative isolate overflow-hidden p-6">
        <GlowDecor className="-top-20 -right-16 size-56" />
        <div className="relative flex items-center gap-5">
          <span className="rounded-full border-2 border-surface shadow-lift">
            <Avatar avatarId={user.avatarId} size="lg" />
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl leading-tight font-semibold">
              {user.name}
            </h1>
            <p className="mt-1 truncate text-lg text-text-muted">
              {dict.profileTitle}
            </p>
          </div>
        </div>
      </section>

      {/* Caregiver status is read-only here: the elder shares a code,
          the caregiver does the connecting from their own account. */}
      <section className="panel mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-semibold">
            {dict.profileCaregiver}
          </h2>
          {link ? (
            <Badge
              tone="success"
              icon={<CircleCheck className="size-4 shrink-0" aria-hidden />}
            >
              {dict.profileCaregiverConnected}
            </Badge>
          ) : (
            <Badge
              tone="neutral"
              icon={<CircleDashed className="size-4 shrink-0" aria-hidden />}
            >
              {dict.profileCaregiverNone}
            </Badge>
          )}
        </div>

        {link ? (
          <p className="mt-3 text-lg font-medium">{link.caregiver.name}</p>
        ) : null}

        <div className="mt-5 rounded-2xl border border-dashed border-border-strong bg-surface-alt/70 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-base font-semibold text-text-muted">
            <KeyRound className="size-5 shrink-0" aria-hidden />
            {dict.profileConnectCode}
          </p>
          <p className="numeric mt-2.5 font-mono text-3xl font-bold tracking-[0.22em]">
            {formatConnectCode(user.connectCode)}
          </p>
          <p className="mt-2.5 text-base leading-snug text-text-muted">
            {dict.profileConnectCodeHelp}
          </p>
        </div>
      </section>

      {/* Privacy lives on its own page rather than as another section of
          the settings form: it is a choice, not a preference, and it
          should not be something you scroll past on the way to changing
          the text size. */}
      <Link
        href="/profile/privacy"
        className="panel panel-interactive mt-6 flex min-h-16 items-center gap-4 p-5"
      >
        <CardIcon tone="primary" size="sm">
          <ShieldCheck className="size-6" />
        </CardIcon>
        <span className="min-w-0 flex-1 text-xl font-semibold">
          {dict.privacyNav}
        </span>
        <ChevronRight className="size-6 shrink-0 text-text-muted" aria-hidden />
      </Link>

      <div className="mt-6">
        <ProfileForm
          initial={{
            name: user.name,
            avatarId: user.avatarId,
            language,
            fontScale: user.preference?.fontScale ?? "COMFORTABLE",
            voiceEnabled: user.preference?.voiceEnabled ?? false,
            autoReadInstructions:
              user.preference?.autoReadInstructions ?? false,
            speechRate: user.preference?.speechRate ?? "NORMAL",
            reminderVoice: user.preference?.reminderVoice ?? true,
            autoReadReminders: user.preference?.autoReadReminders ?? false,
            notificationSound: user.preference?.notificationSound ?? true,
          }}
        />
      </div>
    </PageShell>
  );
}
