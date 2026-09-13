import { redirect } from "next/navigation";

import { LogoMark } from "@/components/ui/Logo";
import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { SignupForm } from "./SignupForm";

export default async function CaregiverSignupPage() {
  const caregiver = await getCurrentCaregiver();
  if (caregiver) redirect("/caregiver");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-5 py-10">
      <main id="main" className="w-full max-w-md">
        <div className="text-center">
          <LogoMark className="mx-auto size-16" />
          <h1 className="mt-6 font-serif text-3xl font-semibold">
            Create a caregiver account
          </h1>
          <p className="mt-2 text-lg text-text-muted">
            You will need the connection code from your family member&apos;s
            profile.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <SignupForm />
        </div>
      </main>
    </div>
  );
}
