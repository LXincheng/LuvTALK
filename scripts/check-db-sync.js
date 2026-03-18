#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const serverDir = path.resolve(__dirname, "..", "apps", "server");

function loadEnvFile() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function parsePort(value) {
  try {
    const port = new URL(value).port;
    return port || "5432";
  } catch {
    return "";
  }
}

function runPrismaStatus(label, databaseUrl, directUrl) {
  console.log(`[db-sync] Checking ${label} migrations`);
  const resolvedDirectUrl = directUrl || process.env.DIRECT_URL || databaseUrl;
  const directHost = parseHost(resolvedDirectUrl);
  const directPort = parsePort(resolvedDirectUrl);
  if (
    directHost.includes("pooler.supabase.com") &&
    directPort !== "5432"
  ) {
    console.error(
      `[db-sync] ${label} DIRECT_URL is pointing to Supabase transaction pooler (${directHost}:${directPort}). Prisma migrations require either the direct database host or Supavisor session mode on port 5432.`,
    );
    process.exit(1);
  }
  if (
    directHost.includes("pooler.supabase.com") &&
    directPort === "5432"
  ) {
    console.log(
      `[db-sync] ${label} DIRECT_URL is using Supavisor session mode (${directHost}:5432). This is acceptable for Prisma migrations when direct IPv6 access is unavailable.`,
    );
  }
  const env = {
    ...process.env,
    DATABASE_URL: resolvedDirectUrl,
    DIRECT_URL: resolvedDirectUrl,
  };
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "prisma",
      "migrate",
      "status",
      "--schema",
      "prisma/schema.prisma",
    ],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env,
      cwd: serverDir,
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

loadEnvFile();

const targets = [];
if (process.env.LOCAL_DATABASE_URL) {
  targets.push([
    "local",
    process.env.LOCAL_DATABASE_URL,
    process.env.LOCAL_DIRECT_URL,
  ]);
}
if (process.env.SUPABASE_DATABASE_URL) {
  targets.push([
    "supabase",
    process.env.SUPABASE_DATABASE_URL,
    process.env.SUPABASE_DIRECT_URL,
  ]);
}
if (targets.length === 0 && process.env.DATABASE_URL) {
  targets.push(["runtime", process.env.DATABASE_URL, process.env.DIRECT_URL]);
}

if (targets.length === 0) {
  console.error(
    "[db-sync] Missing DATABASE_URL or LOCAL_DATABASE_URL/SUPABASE_DATABASE_URL",
  );
  process.exit(1);
}

for (const [label, databaseUrl, directUrl] of targets) {
  runPrismaStatus(label, databaseUrl, directUrl);
}

if (
  process.env.LOCAL_DATABASE_URL &&
  process.env.SUPABASE_DATABASE_URL
) {
  console.log(
    "[db-sync] Local database and Supabase both match the current Prisma migration chain.",
  );
}
