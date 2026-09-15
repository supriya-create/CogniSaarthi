"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BellRing,
  Check,
  LogOut,
  Languages,
  MonitorCog,
  Type,
  UserRound,
  Volume2,
} from "lucide-react";
import type { FontScale, Language, SpeechRate } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SettingsGroup, SettingsRow } from "@/components/ui/Settings";
import { Switch } from "@/components/ui/Switch";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Avatar } from "@/components/elderly/Avatar";
import { LanguageSelector } from "@/components/elderly/LanguageSelector";
import { NotificationSetting } from "@/components/elderly/NotificationSetting";
import { TextSizeSelector } from "@/components/elderly/TextSizeSelector";
import { AVATARS } from "@/lib/avatars";
import { getDict } from "@/lib/i18n/dictionaries";
import { wipeLocalDataOnSignOut } from "@/lib/offline/actions";
import { cn } from "@/lib/utils/cn";

type Props = {
  initial: {
    name: string;
    avatarId: string;
    language: Language;
    fontScale: FontScale;
    voiceEnabled: boolean;
    autoReadInstructions: boolean;
    speechRate: SpeechRate;
    reminderVoice: boolean;
    autoReadReminders: boolean;
    notificationSound: boolean;
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
  const [voiceEnabled, setVoiceEnabled] = useState(initial.voiceEnabled);
  const [autoRead, setAutoRead] = useState(initial.autoReadInstructions);
  const [speechRate, setSpeechRate] = useState<SpeechRate>(initial.speechRate);
  const [reminderVoice, setReminderVoice] = useState(initial.reminderVoice);
  const [autoReadReminders, setAutoReadReminders] = useState(
    initial.autoReadReminders,
  );
  const [notificationSound, setNotificationSound] = useState(
    initial.notificationSound,
  );

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
          voiceEnabled,
          autoReadInstructions: autoRead,
          speechRate,
          reminderVoice,
          autoReadReminders,
          notificationSound,
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
    // Clear this device's local copy and cached pages BEFORE dropping
    // the session: on a shared family tablet, the next person must not
    // be able to see the last person's activities.
    await wipeLocalDataOnSignOut();
    await fetch("/api/session?role=ELDER", { method: "DELETE" });
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup
        icon={<UserRound className="size-6" aria-hidden />}
        title={dict.profileTitle}
      >
        <SettingsRow
          label={dict.profileAvatar}
          stacked
          control={
            <ul className="flex flex-wrap gap-3">
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
                        "flex size-[4.5rem] cursor-pointer items-center justify-center rounded-full border-2",
                        "transition-[background-color,border-color,transform] duration-200 ease-out-soft hover:scale-105",
                        selected
                          ? "border-primary bg-primary-soft shadow-soft"
                          : "border-transparent hover:border-border-strong",
                      )}
                    >
                      <Avatar avatarId={avatar.id} size="md" />
                    </button>
                  </li>
                );
              })}
            </ul>
          }
        />

        <SettingsRow
          control={
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
          }
        />
      </SettingsGroup>

      <SettingsGroup
        icon={<Languages className="size-6" aria-hidden />}
        title={dict.profileLanguage}
      >
        <SettingsRow
          control={
            <LanguageSelector
              value={language}
              onChange={(next) => {
                setLanguage(next);
                setStatus("idle");
              }}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup
        icon={<Type className="size-6" aria-hidden />}
        title={dict.profileTextSize}
      >
        <SettingsRow
          control={
            <TextSizeSelector
              value={fontScale}
              onChange={(next) => {
                setFontScale(next);
                setStatus("idle");
              }}
              dict={dict}
            />
          }
        />
      </SettingsGroup>

      {/* Light or dark. Saved on this device rather than on the
          account: the same person uses a bright kitchen tablet in the
          morning and a phone in a dark room at night. */}
      <SettingsGroup
        icon={<MonitorCog className="size-6" aria-hidden />}
        title={dict.profileAppearance}
        description={dict.profileAppearanceHelp}
      >
        <SettingsRow
          control={
            <ThemeToggle
              labels={{
                light: dict.themeLight,
                dark: dict.themeDark,
                system: dict.themeSystem,
              }}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup
        icon={<Volume2 className="size-6" aria-hidden />}
        title={dict.profileVoice}
        description={dict.profileVoiceHelp}
      >
        <SettingsRow
          control={
            <Switch
              checked={voiceEnabled}
              label={dict.profileVoiceOn}
              onChange={(next) => {
                setVoiceEnabled(next);
                setStatus("idle");
              }}
            />
          }
        />

        {voiceEnabled ? (
          <SettingsRow
            control={
              <Switch
                checked={autoRead}
                label={dict.profileAutoRead}
                onChange={(next) => {
                  setAutoRead(next);
                  setStatus("idle");
                }}
              />
            }
          />
        ) : null}

        {voiceEnabled ? (
          <SettingsRow
            label={dict.profileSpeechSpeed}
            stacked
            control={
              <div
                role="radiogroup"
                aria-label={dict.profileSpeechSpeed}
                className="flex gap-3"
              >
                {(["SLOW", "NORMAL"] as const).map((rate) => {
                  const selected = speechRate === rate;
                  return (
                    <button
                      key={rate}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setSpeechRate(rate);
                        setStatus("idle");
                      }}
                      className={cn(
                        "min-h-[3rem] flex-1 cursor-pointer rounded-xl border-2 px-4 py-2.5 text-lg font-semibold",
                        "transition-[background-color,border-color,box-shadow] duration-200 ease-gentle",
                        selected
                          ? "border-primary bg-primary-soft shadow-soft"
                          : "border-border-strong bg-surface hover:bg-surface-alt",
                      )}
                    >
                      {rate === "SLOW" ? dict.speedSlow : dict.speedNormal}
                    </button>
                  );
                })}
              </div>
            }
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup
        icon={<BellRing className="size-6" aria-hidden />}
        title={dict.profileNotifications}
        description={dict.profileNotificationsHelp}
      >
        <SettingsRow
          control={
            <Switch
              checked={notificationSound}
              label={dict.profileNotificationSound}
              onChange={(next) => {
                setNotificationSound(next);
                setStatus("idle");
              }}
            />
          }
        />

        {voiceEnabled ? (
          <SettingsRow
            control={
              <Switch
                checked={reminderVoice}
                label={dict.profileReminderVoice}
                onChange={(next) => {
                  setReminderVoice(next);
                  setStatus("idle");
                }}
              />
            }
          />
        ) : null}

        {voiceEnabled && reminderVoice ? (
          <SettingsRow
            control={
              <Switch
                checked={autoReadReminders}
                label={dict.profileAutoReadReminders}
                onChange={(next) => {
                  setAutoReadReminders(next);
                  setStatus("idle");
                }}
              />
            }
          />
        ) : null}
      </SettingsGroup>

      {/* Device alerts sit OUTSIDE the saved form on purpose: browser
          permission belongs to this device, not to the account, so it
          is not something "Save changes" could apply — and a control
          that looked like it was saved with the rest would imply the
          setting follows the person to another tablet. It does not. */}
      <NotificationSetting language={language} />

      {/* The save control follows the page down so it is reachable
          without scrolling back up from the bottom of a long form. */}
      <div className="sticky bottom-4 z-10">
        <Button
          fullWidth
          size="xl"
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
          <p
            role="alert"
            className="mt-3 rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-center text-lg font-medium text-error"
          >
            {dict.errorBody}
          </p>
        ) : null}
      </div>

      <div className="mt-2 flex justify-center border-t border-border pt-7">
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
