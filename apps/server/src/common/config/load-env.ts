import { config } from "dotenv";
import * as path from "path";
import { existsSync } from "fs";

// Resolve repo-root .env (workspace/apps/server/src -> ../../../.. -> repo root)
const repoRootEnvPath = path.resolve(__dirname, "../../../../../.env");

// Load .env once; fall back to default lookup so production/env vars still work.
config({ path: existsSync(repoRootEnvPath) ? repoRootEnvPath : undefined });

// Export a no-op to make tree-shaking less likely to drop side effects.
export const ensureEnvLoaded = (): void => undefined;
