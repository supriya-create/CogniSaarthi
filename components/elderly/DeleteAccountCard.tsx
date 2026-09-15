"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Images, ListChecks, Bell, LifeBuoy, TriangleAlert } from "lucide-react";
import type { Language } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { getDict } from "@/lib/i18n/dictionaries";
import { wipeLocalDataOnSignOut } from "@/lib/offline/actions";

/**
 * Deleting your own account.
 *
 * This is the single irreversible action in Cognisaarthi, taken by
 * somebody who may have difficulty holding several steps in mind at
 * once. The design follows from that:
 *
 *  - **Nothing happens on arrival.** Opening this page, or even
 *    pressing the first button, deletes nothing. The first press only
 *    reveals what deletion would do.
 *
 *  - **Two deliberate presses, not a typed passphrase.** Asking an
 *    elderly user to type "DELETE" to prove intent tests their
 *    keyboard, not their intent, and would strand anyone using voice.
 *    Two presses separated by a plain list of what disappears is the
 *    honest test. The confirmation token the API requires is supplied
 *    by the code, where it belongs — it guards against a stray
 *    request, not against the user.
 *
 *  - **"Keep my account" is the prominent button.** The destructive
 *    one is a plain danger-styled control beneath it. Somebody who
 *    arrived here by accident, or who has forgotten why, should find
 *    the safe way out first and largest.
 *
 *  - **The local copy goes too.** Server deletion cannot reach this
 *    device's IndexedDB, so it is wiped here before we navigate away.
 */
export function DeleteAccountCard({ language }: { language: Language }) {
  const router = useRouter();
  const dict = getDict(language);

  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");

  const losses = [
    { Icon: Images, text: dict.deleteGoesMemories },
    { Icon: ListChecks, text: dict.deleteGoesActivities },
    { Icon: Bell, text: dict.deleteGoesReminders },
    { Icon: LifeBuoy, text: dict.deleteGoesContacts },
  ];

  async function performDelete() {
    setStatus("working");

    let response: Response;
    try {
      response = await fetch("/api/privacy/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE_MY_ACCOUNT" }),
      });
    } catch {
      setStatus("error");
      return;
    }

    if (!response.ok) {
      setStatus("error");
      return;
    }

    // The server row is gone. Clear this device's replica and the
    // cached pages before leaving, so a shared tablet does not keep a
    // readable copy of somebody who no longer exists.
    await wipeLocalDataOnSignOut();

    router.replace("/");
    router.refresh();
  }

  return (
    <section className="panel mt-8 border-error/30 p-6">
      <h2 className="flex items-center gap-3 font-serif text-2xl leading-tight font-semibold">
        <TriangleAlert className="size-6 shrink-0 text-error" aria-hidden />
        {dict.deleteTitle}
      </h2>
      <p className="mt-2 text-lg leading-relaxed text-text-muted">
        {dict.deleteIntro}
      </p>

      {!confirming ? (
        <div className="mt-5">
          <Button
            variant="danger"
            size="lg"
            onClick={() => setConfirming(true)}
          >
            {dict.deleteStart}
          </Button>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border-2 border-error/30 bg-error-soft/40 p-5">
          <h3 className="font-serif text-xl font-semibold">
            {dict.deleteConfirmHeading}
          </h3>

          <p className="mt-3 text-lg font-medium">{dict.deleteWhatGoes}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {losses.map(({ Icon, text }) => (
              <li
                key={text}
                className="flex items-start gap-3 text-lg leading-relaxed"
              >
                <Icon className="mt-1 size-6 shrink-0 text-error" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-lg leading-relaxed font-semibold">
            {dict.deleteCannotUndo}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {/* The safe choice first, full width, and primary. */}
            <Button
              fullWidth
              size="xl"
              onClick={() => {
                setConfirming(false);
                setStatus("idle");
              }}
              disabled={status === "working"}
            >
              {dict.deleteKeepAccount}
            </Button>

            <Button
              variant="danger"
              size="lg"
              fullWidth
              onClick={performDelete}
              disabled={status === "working"}
            >
              {status === "working" ? dict.deleteWorking : dict.deleteConfirm}
            </Button>
          </div>

          {status === "error" ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-lg font-medium text-error"
            >
              {dict.deleteFailed}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
