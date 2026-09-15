"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { clearCaregiverSnapshots } from "@/lib/offline/caregiver-store";

/**
 * Signing out ends the CAREGIVER session only — the elder keeps theirs,
 * because they have no password to sign back in with.
 *
 * Phase 7: it also removes the snapshot this device was holding. A
 * caregiver who signs out on a shared family tablet must not leave a
 * readable copy of someone's activity behind for whoever picks it up
 * next. The local wipe happens BEFORE the cookie is dropped, so a
 * failure part-way through leaves the account signed in with its data
 * gone rather than signed out with its data present.
 */
export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      variant="quiet"
      size="sm"
      icon={<LogOut className="size-5" aria-hidden />}
      onClick={async () => {
        await clearCaregiverSnapshots();
        await fetch("/api/session?role=CAREGIVER", { method: "DELETE" });
        router.replace("/caregiver/login");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
