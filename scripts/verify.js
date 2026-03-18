#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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

function run(command, args) {
  console.log(`[verify] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

loadEnvFile();

const target = process.argv[2] ?? "all";

const tasks = {
  server: [
    ["pnpm", ["--filter", "server", "exec", "prisma", "validate", "--schema", "prisma/schema.prisma"]],
    ["pnpm", ["--filter", "server", "lint:check"]],
    ["pnpm", ["--filter", "server", "build"]],
    ["pnpm", ["--filter", "server", "test"]],
  ],
  web: [
    ["pnpm", ["--filter", "web", "lint"]],
    ["pnpm", ["--filter", "web", "exec", "tsc", "-b"]],
    ["pnpm", ["--filter", "web", "exec", "vite", "build"]],
  ],
};

if (target !== "all" && !(target in tasks)) {
  console.error(`[verify] Unknown target: ${target}`);
  process.exit(1);
}

const queue =
  target === "all" ? [...tasks.server, ...tasks.web] : tasks[target];

for (const [command, args] of queue) {
  run(command, args);
}
