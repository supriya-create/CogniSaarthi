import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoMark } from "@/components/ui/Logo";
import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { LoginForm } from "./LoginForm";

export default async function CaregiverLoginPage() {
  const caregiver = await getCurrentCaregiver();
  if (caregiver) redirect("/caregiver");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-5 py-10">
      <main id="main" className="w-full max-w-md">
        <div className="text-center">
          <LogoMark className="mx-auto size-16" />
          <h1 className="mt-6 font-serif text-3xl font-semibold">
            Caregiver sign in
          </h1>
          <p className="mt-2 text-lg text-text-muted">
            Follow how your family member is getting on.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-base text-text-muted">
          <Link href="/" className="underline underline-offset-4">
            Back to Cognisaarthi
          </Link>
        </p>
      </main>
    </div>
  );
}
