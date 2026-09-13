"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Language } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { LanguageSelector } from "@/components/elderly/LanguageSelector";
import { ProgressDots } from "@/components/elderly/ProgressDots";
import { LogoMark } from "@/components/ui/Logo";
import { getDict } from "@/lib/i18n/dictionaries";

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
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-4 sm:px-6">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="-ml-2 inline-flex min-h-[3rem] items-center gap-1 rounded-xl px-3 py-2 text-lg font-semibold transition-colors hover:bg-surface-alt"
          >
            <ChevronLeft className="size-6" aria-hidden />
            {dict.back}
          </button>
        ) : (
          <span className="min-h-[3rem]" />
        )}

        <div className="flex flex-1 justify-end">
          <ProgressDots
            total={STEPS.length}
            filled={stepIndex + 1}
            label={dict.onboardStepLabel}
            ofLabel={dict.onboardOf}
            size="sm"
          />
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 pb-8 sm:px-6"
      >
        {/* key= restarts the entrance animation on each step */}
        <div key={step} className="animate-fade-up">
          {step === "welcome" ? (
            <div className="text-center">
              <LogoMark className="mx-auto size-28" />
              <h1 className="mt-8 font-serif text-4xl font-semibold leading-tight">
                {dict.onboardWelcomeTitle}
              </h1>
              <p className="mx-auto mt-5 max-w-md text-xl leading-relaxed text-text-muted">
                {dict.tagline}
              </p>
            </div>
          ) : null}

          {step === "name" ? (
            <div>
              <h1 className="font-serif text-3xl font-semibold leading-tight">
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
              <h1 className="font-serif text-3xl font-semibold leading-tight">
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
              <LogoMark className="mx-auto size-24" />
              <h1 className="mt-8 font-serif text-4xl font-semibold leading-tight">
                {dict.onboardReadyTitle}
              </h1>
              <p className="mx-auto mt-5 max-w-md text-xl leading-relaxed text-text-muted">
                {dict.onboardReadyBody}
              </p>
              {submitError ? (
                <p role="alert" className="mt-5 text-lg font-medium text-error">
                  {submitError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-xl px-4 pb-8 sm:px-6">
        {step === "ready" ? (
          <Button fullWidth onClick={finish} disabled={submitting}>
            {submitting ? dict.loading : dict.start}
          </Button>
        ) : (
          <Button
            fullWidth
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
