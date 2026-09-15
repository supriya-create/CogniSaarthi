import { House } from "lucide-react";

import { LinkButton } from "@/components/ui/Button";
import { MessageScreen } from "@/components/ui/MessageScreen";

export default function NotFound() {
  return (
    <MessageScreen
      title="We could not find that page."
      body="Let's go back to somewhere familiar."
      action={
        <LinkButton
          href="/home"
          fullWidth
          icon={<House className="size-6" aria-hidden />}
        >
          Home
        </LinkButton>
      }
    />
  );
}
