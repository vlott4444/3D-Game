import { cp, mkdir } from "node:fs/promises";
await mkdir("build/agents", { recursive: true });
await cp("src/database/schema.sql", "build/database/schema.sql");
await cp("src/agents/profiles", "build/agents/profiles", { recursive: true });
