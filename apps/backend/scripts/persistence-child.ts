import { initDb } from "../src/database/db.js";
import { createPlayer, findById, saveState } from "../src/database/players.repo.js";
initDb(process.argv[2]);
if (process.argv[3] === "write") {
  createPlayer("crash", "crash-test", "unused");
  saveState("crash", { roomId: "test", posX: 7, posY: -3, rotY: 2, height: 1.18 });
  console.log("COMMITTED");
  setInterval(() => {}, 1000);
} else {
  const p = findById("crash");
  if (p?.pos_x !== 7 || p.pos_y !== -3) process.exit(1);
  console.log("RESTORED", p.pos_x, p.pos_y);
}
