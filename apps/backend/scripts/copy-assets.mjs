import { cp, mkdir, rm } from "node:fs/promises";
await mkdir("build/agents", { recursive: true });
await cp("src/database/schema.sql", "build/database/schema.sql");
await cp("src/agents/profiles", "build/agents/profiles", { recursive: true });
// Also retire obsolete files when this script is run without a preceding clean build.
for (const name of ["curie", "herodotus", "holmes", "tesla"]) {
  await rm(`build/agents/profiles/${name}.json`, { force: true });
}
await mkdir("build/agents/visitors", { recursive: true });
await cp("src/agents/visitors/catalog.json", "build/agents/visitors/catalog.json");
