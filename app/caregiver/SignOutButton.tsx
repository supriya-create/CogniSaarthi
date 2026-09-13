"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      variant="quiet"
      size="sm"
      icon={<LogOut className="size-5" aria-hidden />}
      onClick={async () => {
        await fetch("/api/session?role=CAREGIVER", { method: "DELETE" });
        router.replace("/caregiver/login");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
