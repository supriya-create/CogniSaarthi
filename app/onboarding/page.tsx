import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { OnboardingFlow } from "./OnboardingFlow";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/home");

  return <OnboardingFlow />;
}
