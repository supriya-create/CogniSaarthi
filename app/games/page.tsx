import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { GameCard } from "@/components/games/GameCard";
import { requireUser } from "@/lib/auth/current-user";
import { getActiveGames, getGameIdsCompletedToday } from "@/lib/db/queries";
import { getDefinition } from "@/lib/game-engine/definitions";
import { getDict } from "@/lib/i18n/dictionaries";

export default async function GamesPage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  // The catalogue order and which games exist come from the database;
  // the localised copy and play logic come from the engine. A game is
  // only shown when both halves are present.
  const [rows, playedToday] = await Promise.all([
    getActiveGames(),
    getGameIdsCompletedToday(user.id),
  ]);

  const games = rows
    .map((row) => getDefinition(row.id))
    .filter((game) => game !== undefined);

  return (
    <PageShell
      header={<ElderlyHeader backHref="/home" backLabel={dict.back} />}
      nav={<BottomNav
          dict={dict}
          voice={
            user.preference?.voiceEnabled
              ? { language, speechRate: user.preference.speechRate }
              : undefined
          }
        />}
    >
      <h1 className="font-serif text-3xl font-semibold">{dict.gamesTitle}</h1>
      <p className="mt-2 text-lg text-text-muted">{dict.gamesSubtitle}</p>

      <div className="mt-7 flex flex-col gap-4">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            language={language}
            dict={dict}
            done={playedToday.has(game.id)}
          />
        ))}
      </div>
    </PageShell>
  );
}
