import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/caregiver/AuthShell";
import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { SignupForm } from "./SignupForm";

export default async function CaregiverSignupPage() {
  const caregiver = await getCurrentCaregiver();
  if (caregiver) redirect("/caregiver");

  return (
    <AuthShell
      title="Create a caregiver account"
      subtitle="You will need the connection code from your family member's profile."
      footer={
        <Link
          href="/caregiver/login"
          className="rounded-lg px-2 py-1 font-semibold underline underline-offset-4 transition-colors hover:text-text"
        >
          I already have an account
        </Link>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
