"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Language } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { LanguageSelector } from "@/components/elderly/LanguageSelector";
import { GlowDecor, HillsDecor, LeafSprig } from "@/components/ui/Decor";
import { BrandLockup, LogoMark } from "@/components/ui/Logo";
import { getDict } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils/cn";

const STEPS = ["welcome", "name", "language", "ready"] as const;
type Step = (typeof STEPS)[number];

/**
 * Four screens, one question each, no registration form.
 *
 * The dictionary is resolved on every render from the language the
 * person has picked, so the moment they choose Assamese on step 3
 * the buttons around them change too. That immediate feedback is
 * the point of asking at all.
 */
export function OnboardingFlow() {
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Language>("EN");
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dict = getDict(language);
  const step: Step = STEPS[stepIndex];

  function goNext() {
    if (step === "name" && name.trim().length === 0) {
      setNameError(dict.onboardNameError);
      return;
    }
    setNameError(null);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setSubmitError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function finish() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), language }),
      });

      if (!response.ok) throw new Error("Onboarding failed");

      // refresh() so the root layout picks up the new session and
      // applies the chosen language before /home paints.
      router.replace("/home");
      router.refresh();
    } catch {
      setSubmitError(dict.errorBody);
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* The welcome screen should feel like somewhere, not like a
          form. The decoration is fixed behind the whole flow so the
          background does not jump between steps. */}
      <GlowDecor className="-top-32 -left-24 size-96" />
      <GlowDecor className="-top-24 -right-24 size-80" tone="secondary" />
      <LeafSprig className="absolute top-24 -left-12 !size-64 -rotate-12 opacity-[0.12]" />
      <HillsDecor className="h-32 opacity-70" />

      <header className="relative mx-auto flex w-full max-w-xl items-center gap-4 px-4 py-4 sm:px-6">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="-ml-2 inline-flex min-h-[3rem] cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-lg font-semibold transition-colors duration-200 hover:bg-surface-alt"
          >
            <ChevronLeft className="size-6" aria-hidden />
            {dict.back}
          </button>
        ) : (
          <span className="min-h-[3rem]" />
        )}

        {/* Progress as a segmented bar: how far along, and how much is
            left, without a number to decode. */}
        <div
          className="flex flex-1 items-center justify-end gap-1.5"
          role="img"
          aria-label={`${dict.onboardStepLabel}: ${stepIndex + 1} ${dict.onboardOf} ${STEPS.length}`}
        >
          {STEPS.map((name, index) => (
            <span
              key={name}
              aria-hidden
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 ease-out-soft",
                index <= stepIndex
                  ? "w-8 bg-primary"
                  : "w-4 bg-border-strong",
              )}
            />
          ))}
        </div>
      </header>

      <main
        id="main"
        className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 pb-8 sm:px-6"
      >
        {/* key= restarts the entrance animation on each step */}
        <div key={step} className="animate-fade-up">
          {step === "welcome" ? (
            <div className="text-center">
              <LogoMark className="animate-pop mx-auto size-28" />
              <h1 className="mt-8 font-serif text-4xl leading-tight font-semibold sm:text-5xl">
                {dict.onboardWelcomeTitle}
              </h1>
              <p className="mx-auto mt-5 max-w-md text-xl leading-relaxed text-text-muted">
                {dict.tagline}
              </p>
            </div>
          ) : null}

          {step === "name" ? (
            <div>
              <h1 className="font-serif text-3xl leading-tight font-semibold sm:text-4xl">
                {dict.onboardNameTitle}
              </h1>
              <div className="mt-7">
                <Field
                  label={dict.onboardNamePlaceholder}
                  hint={dict.onboardNameHelp}
                  value={name}
                  autoFocus
                  autoComplete="given-name"
                  maxLength={40}
                  error={nameError}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (nameError) setNameError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") goNext();
                  }}
                />
              </div>
            </div>
          ) : null}

          {step === "language" ? (
            <div>
              <h1 className="font-serif text-3xl leading-tight font-semibold sm:text-4xl">
                {dict.onboardLanguageTitle}
              </h1>
              <p className="mt-3 text-lg text-text-muted">
                {dict.onboardLanguageHelp}
              </p>
              <div className="mt-7">
                <LanguageSelector value={language} onChange={setLanguage} />
              </div>
            </div>
          ) : null}

          {step === "ready" ? (
            <div className="text-center">
              <div className="animate-pop">
                <BrandLockup tagline={dict.tagline} />
              </div>
              <h1 className="mt-9 font-serif text-4xl leading-tight font-semibold sm:text-5xl">
                {dict.onboardReadyTitle}
              </h1>
              <p className="mx-auto mt-4 max-w-md text-xl leading-relaxed text-text-muted">
                {dict.onboardReadyBody}
              </p>
              {submitError ? (
                <p
                  role="alert"
                  className="mx-auto mt-6 max-w-sm rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-lg font-medium text-error"
                >
                  {submitError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="relative mx-auto w-full max-w-xl px-4 pb-10 sm:px-6">
        {step === "ready" ? (
          <Button fullWidth size="xl" onClick={finish} disabled={submitting}>
            {submitting ? dict.loading : dict.start}
          </Button>
        ) : (
          <Button
            fullWidth
            size="xl"
            onClick={goNext}
            trailingIcon={<ChevronRight className="size-6" aria-hidden />}
          >
            {dict.next}
          </Button>
        )}
      </footer>
    </div>
  );
}
