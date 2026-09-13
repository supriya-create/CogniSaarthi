import { notFound } from "next/navigation";
import { House, RotateCcw } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/Button";
import { ResultCard } from "@/components/games/ResultCard";
import { requireUser } from "@/lib/auth/current-user";
import { getSessionForUser } from "@/lib/db/queries";
import { getDefinition } from "@/lib/game-engine/definitions";
import { toneFor } from "@/lib/game-engine/scoring";
import { getDifficultyRecommendation } from "@/lib/cognitive-performance/profile";
import { resultMessageKey } from "@/lib/cognitive-performance/recommendations";
import { getDict } from "@/lib/i18n/dictionaries";
import { difficultyLabel } from "@/lib/i18n/labels";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await requireUser();

  const session = await getSessionForUser(sessionId, user.id);
  if (!session?.result) notFound();

  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);
  const definition = getDefinition(session.gameId);
  const { result } = session;

  const totalCount = result.correctCount + result.incorrectCount;

  // Phase 2: a short personalised line. The engine's recommendation
  // (which reflects this session too) picks the tone — encouraging a
  // strong run, gently reassuring a harder one — without ever
  // exposing levels or internal reasoning to the person.
  const recommendation = await getDifficultyRecommendation(
    user.id,
    session.gameId,
  );
  const personalMessage = recommendation
    ? dict[
        resultMessageKey({
          score: result.score,
          direction: recommendation.direction,
          reason: recommendation.reason,
        })
      ]
    : null;

  return (
    <PageShell header={<ElderlyHeader backHref="/home" backLabel={dict.home} />}>
      <p className="text-center text-lg font-medium text-text-muted">
        {definition?.name[language] ?? session.game.name}
      </p>

      <div className="mt-4">
        <ResultCard
          tone={toneFor(result.score)}
          stars={result.stars}
          correctCount={result.correctCount}
          totalCount={totalCount}
          durationMs={session.durationMs ?? 0}
          difficultyLabel={difficultyLabel(session.difficulty, dict)}
          dict={dict}
        />
      </div>

      {personalMessage ? (
        <p className="mt-6 text-center text-lg leading-relaxed text-text-muted">
          {personalMessage}
        </p>
      ) : result.score < 50 ? (
        <p className="mt-6 text-center text-lg leading-relaxed text-text-muted">
          {dict.resultEncourage}
        </p>
      ) : null}

      <p className="mt-8 text-center text-xl font-medium">
        {dict.resultAnotherQuestion}
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <LinkButton
          href={`/games/${session.gameId}`}
          fullWidth
          icon={<RotateCcw className="size-6" aria-hidden />}
        >
          {dict.resultPlayAgain}
        </LinkButton>
        <LinkButton
          href="/home"
          variant="outline"
          fullWidth
          icon={<House className="size-6" aria-hidden />}
        >
          {dict.resultBackHome}
        </LinkButton>
      </div>
    </PageShell>
  );
}
