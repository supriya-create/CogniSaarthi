import { Bell } from "lucide-react";

import { ComingSoonPage } from "@/components/elderly/ComingSoonPage";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/dictionaries";

export default async function RemindersPage() {
  const user = await requireUser();
  const dict = getDict(user.preference?.language ?? user.language);

  return (
    <ComingSoonPage
      title={dict.remindersTitle}
      body={dict.remindersBody}
      Icon={Bell}
      dict={dict}
    />
  );
}
