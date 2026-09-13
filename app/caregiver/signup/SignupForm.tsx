"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

const MESSAGES: Record<string, string> = {
  unknown_code:
    "We could not find that code. Ask your family member to read it from their profile screen.",
  email_taken: "An account already exists with that email.",
  invalid_input:
    "Please check the details above — the password needs at least 8 characters.",
};

export function SignupForm() {
  const router = useRouter();

  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    connectCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof values) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      setError(null);
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/caregiver/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          MESSAGES[data.error ?? ""] ??
            "Something went wrong. Let's try that again.",
        );
        setSubmitting(false);
        return;
      }

      router.replace("/caregiver");
      router.refresh();
    } catch {
      setError("Something went wrong. Let's try that again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field
        label="Your name"
        size="md"
        autoComplete="name"
        required
        value={values.name}
        onChange={update("name")}
      />
      <Field
        label="Email"
        type="email"
        size="md"
        autoComplete="email"
        required
        value={values.email}
        onChange={update("email")}
      />
      <Field
        label="Password"
        type="password"
        size="md"
        autoComplete="new-password"
        hint="At least 8 characters."
        required
        minLength={8}
        value={values.password}
        onChange={update("password")}
      />
      <Field
        label="Connection code"
        size="md"
        hint="The six-character code on your family member's profile screen."
        placeholder="ABC-123"
        required
        value={values.connectCode}
        onChange={update("connectCode")}
        className="font-mono tracking-widest uppercase"
      />

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-base font-medium text-error"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      <Button type="submit" size="md" fullWidth disabled={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-base text-text-muted">
        Already have an account?{" "}
        <Link
          href="/caregiver/login"
          className="font-semibold text-primary underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
