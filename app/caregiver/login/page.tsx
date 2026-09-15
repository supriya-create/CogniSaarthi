import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/caregiver/AuthShell";
import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { LoginForm } from "./LoginForm";

export default async function CaregiverLoginPage() {
  const caregiver = await getCurrentCaregiver();
  if (caregiver) redirect("/caregiver");

  return (
    <AuthShell
      title="Caregiver sign in"
      subtitle="Follow how your family member is getting on."
      footer={
        <Link
          href="/"
          className="rounded-lg px-2 py-1 font-semibold underline underline-offset-4 transition-colors hover:text-text"
        >
          Back to Cognisaarthi
        </Link>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
