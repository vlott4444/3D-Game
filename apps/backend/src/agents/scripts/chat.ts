import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { agentService } from "../../AgentService.js";

async function main(): Promise<void> {
  const playerId = process.argv[2] || "player-1";

  const terminal = createInterface({
    input: stdin,
    output: stdout,
  });

  console.log(`Игрок: ${playerId}`);
  console.log("NPC: Эйнштейн");
  console.log("Для выхода введи /exit.\n");

  try {
    while (true) {
      const message = (await terminal.question("Ты: ")).trim();

      if (message === "/exit") {
        break;
      }

      if (!message) {
        continue;
      }

      const startedAt = performance.now();
      console.log("Эйнштейн думает...");

      try {
        const reply = await agentService.reply({
          playerId,
          npcId: "einstein",
          message,
        });

        const seconds = (
          (performance.now() - startedAt) / 1000
        ).toFixed(1);

        console.log(`\nЭйнштейн: ${reply.text}`);
        console.log(`[Ответ за ${seconds} с]\n`);
      } catch (error) {
        console.error(
          "\nОшибка:",
          error instanceof Error ? error.message : error,
        );
        console.log();
      }
    }
  } finally {
    terminal.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
