"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, LogOut } from "lucide-react";
import type { FontScale, Language } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Avatar } from "@/components/elderly/Avatar";
import { LanguageSelector } from "@/components/elderly/LanguageSelector";
import { TextSizeSelector } from "@/components/elderly/TextSizeSelector";
import { AVATARS } from "@/lib/avatars";
import { getDict } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils/cn";

type Props = {
  initial: {
    name: string;
    avatarId: string;
    language: Language;
    fontScale: FontScale;
  };
};

/**
 * One form, saved with one button.
 *
 * Deliberately not auto-saving per field: a person who taps
 * something by accident should be able to leave without having
 * changed anything, and a single confirmed "Saved" is clearer
 * feedback than three silent ones.
 */
export function ProfileForm({ initial }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initial.name);
  const [avatarId, setAvatarId] = useState(initial.avatarId);
  const [language, setLanguage] = useState<Language>(initial.language);
  const [fontScale, setFontScale] = useState<FontScale>(initial.fontScale);

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [nameError, setNameError] = useState<string | null>(null);

  // Preview the chosen language immediately, as onboarding does.
  const dict = getDict(language);

  async function save() {
    if (name.trim().length === 0) {
      setNameError(dict.onboardNameError);
      return;
    }

    setStatus("saving");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          avatarId,
          language,
          fontScale,
        }),
      });
      if (!response.ok) throw new Error("save failed");

      setStatus("saved");
      // Pull the new language and text size through the root layout.
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  async function signOut() {
    await fetch("/api/session?role=ELDER", { method: "DELETE" });
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-9">
      <section>
        <h2 className="font-serif text-xl font-semibold">
          {dict.profileAvatar}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          {AVATARS.map((avatar) => {
            const selected = avatar.id === avatarId;
            return (
              <li key={avatar.id}>
                <button
                  type="button"
                  onClick={() => {
                    setAvatarId(avatar.id);
                    setStatus("idle");
                  }}
                  aria-pressed={selected}
                  aria-label={avatar.label}
                  className={cn(
                    "flex size-[4.5rem] items-center justify-center rounded-full border-2 transition-colors duration-150",
                    selected
                      ? "border-primary bg-primary-soft"
                      : "border-transparent hover:border-border-strong",
                  )}
                >
                  <Avatar avatarId={avatar.id} size="md" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <Field
          label={dict.profileName}
          value={name}
          maxLength={40}
          error={nameError}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(null);
            setStatus("idle");
          }}
        />
      </section>

      <section>
        <h2 className="font-serif text-xl font-semibold">
          {dict.profileLanguage}
        </h2>
        <div className="mt-4">
          <LanguageSelector
            value={language}
            onChange={(next) => {
              setLanguage(next);
              setStatus("idle");
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl font-semibold">
          {dict.profileTextSize}
        </h2>
        <div className="mt-4">
          <TextSizeSelector
            value={fontScale}
            onChange={(next) => {
              setFontScale(next);
              setStatus("idle");
            }}
            dict={dict}
          />
        </div>
      </section>

      <div>
        <Button
          fullWidth
          onClick={save}
          disabled={status === "saving"}
          icon={
            status === "saved" ? (
              <Check className="size-6" aria-hidden />
            ) : undefined
          }
        >
          {status === "saving"
            ? dict.loading
            : status === "saved"
              ? dict.saved
              : dict.profileSaveChanges}
        </Button>

        {status === "error" ? (
          <p role="alert" className="mt-3 text-center text-lg font-medium text-error">
            {dict.errorBody}
          </p>
        ) : null}
      </div>

      <div className="border-t border-border pt-7">
        <Button
          variant="danger"
          size="md"
          onClick={signOut}
          icon={<LogOut className="size-5" aria-hidden />}
        >
          {dict.profileSwitchUser}
        </Button>
      </div>
    </div>
  );
}
