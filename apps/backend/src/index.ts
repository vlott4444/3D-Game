import "dotenv/config";
import { listen } from "@colyseus/tools";
import app from "./app.config.js";
import { initDb } from "./database/db.js";

initDb();
listen(app);
