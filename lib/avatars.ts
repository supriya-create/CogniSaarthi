/**
 * Avatar choices.
 *
 * Not photographs and not cartoon faces — a small set of warm,
 * familiar things a person can point at and call their own. Uploads
 * would mean handling images of a vulnerable person, which is a
 * decision for a later phase, not a Phase 1 convenience.
 */
export interface AvatarOption {
  id: string;
  glyph: string;
  /** Background utility class, drawn from the design tokens. */
  background: string;
  label: string;
}

export const AVATARS: AvatarOption[] = [
  { id: "marigold", glyph: "🌼", background: "bg-accent-soft", label: "Marigold" },
  { id: "tea", glyph: "🍵", background: "bg-secondary-soft", label: "Tea" },
  { id: "lotus", glyph: "🪷", background: "bg-primary-soft", label: "Lotus" },
  { id: "bird", glyph: "🐦", background: "bg-secondary-soft", label: "Bird" },
  { id: "boat", glyph: "🛶", background: "bg-accent-soft", label: "Boat" },
  { id: "lamp", glyph: "🪔", background: "bg-primary-soft", label: "Lamp" },
];

export const DEFAULT_AVATAR = AVATARS[0];

export function getAvatar(id: string | null | undefined): AvatarOption {
  return AVATARS.find((avatar) => avatar.id === id) ?? DEFAULT_AVATAR;
}
