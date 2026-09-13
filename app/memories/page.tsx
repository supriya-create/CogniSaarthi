import { Heart } from "lucide-react";

import { ComingSoonPage } from "@/components/elderly/ComingSoonPage";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/dictionaries";

export default async function MemoriesPage() {
  const user = await requireUser();
  const dict = getDict(user.preference?.language ?? user.language);

  return (
    <ComingSoonPage
      title={dict.memoriesTitle}
      body={dict.memoriesBody}
      Icon={Heart}
      dict={dict}
    />
  );
}
