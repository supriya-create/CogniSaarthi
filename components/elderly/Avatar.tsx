import { getAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils/cn";

export function Avatar({
  avatarId,
  size = "md",
  className,
}: {
  avatarId: string | null | undefined;
  size?: "lg" | "md" | "sm";
  className?: string;
}) {
  const avatar = getAvatar(avatarId);

  const dimensions = {
    lg: "size-24 text-5xl",
    md: "size-14 text-3xl",
    sm: "size-10 text-xl",
  }[size];

  return (
    <span
      role="img"
      aria-label={avatar.label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-border",
        avatar.background,
        dimensions,
        className,
      )}
    >
      <span aria-hidden>{avatar.glyph}</span>
    </span>
  );
}
