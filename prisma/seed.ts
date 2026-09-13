import { PrismaClient } from "@prisma/client";

import { GAME_DEFINITIONS } from "../lib/game-engine/definitions";

/**
 * The Game table is populated from the same definitions the app
 * renders from, so the catalogue can never drift out of sync with
 * the code. English is stored as the canonical copy; the localised
 * strings stay in the definitions module where the UI reads them.
 */

const prisma = new PrismaClient();

async function main() {
  for (const [index, game] of GAME_DEFINITIONS.entries()) {
    const row = {
      name: game.name.EN,
      domain: game.domain,
      shortDescription: game.shortDescription.EN,
      instructions: game.instructions.EN,
      iconKey: game.iconKey,
      isActive: true,
      sortOrder: index,
    };

    await prisma.game.upsert({
      where: { id: game.id },
      create: { id: game.id, ...row },
      update: row,
    });

    console.log(`  seeded game: ${game.id}`);
  }

  console.log(`Seeded ${GAME_DEFINITIONS.length} games.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
