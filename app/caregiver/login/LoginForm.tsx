"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/caregiver/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.status === 401) {
        setError("That email and password do not match an account.");
        setSubmitting(false);
        return;
      }
      if (!response.ok) throw new Error("login failed");

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
        label="Email"
        type="email"
        size="md"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Field
        label="Password"
        type="password"
        size="md"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
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
        {submitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-base text-text-muted">
        Don&apos;t have an account?{" "}
        <Link
          href="/caregiver/signup"
          className="font-semibold text-primary underline underline-offset-4"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
