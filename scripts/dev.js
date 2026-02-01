#!/usr/bin/env node
/* eslint-disable no-console */
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
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

const HEALTH_BASE = process.env.VITE_PROXY_API ?? "http://127.0.0.1:3000";
const HEALTH_URL = new URL("/api/health", HEALTH_BASE);
const MAX_ATTEMPTS = Number(process.env.LUVTALK_HEALTH_ATTEMPTS ?? 60);
const DELAY_MS = Number(process.env.LUVTALK_HEALTH_DELAY ?? 1000);

const procs = new Set();

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  procs.add(child);

  child.on("exit", (code) => {
    procs.delete(child);
    if (command.includes("server") && procs.size) {
      console.log("[dev] server stopped – terminating remaining processes");
      cleanup(code ?? 0);
    }
  });

  return child;
}

function cleanup(code = 0) {
  for (const child of procs) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }
  process.exit(code);
}

process.once("SIGINT", () => cleanup(0));
process.once("SIGTERM", () => cleanup(0));

async function waitForHealth() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await checkHealth();
      console.log("[dev] API health check succeeded");
      return;
    } catch (error) {
      const remaining = MAX_ATTEMPTS - attempt;
      console.log(
        `[dev] API not ready (${(error && error.message) || "unknown error"}). Retrying... (${remaining} tries left)`,
      );
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }
  throw new Error("API health check timed out");
}

function checkHealth() {
  return new Promise((resolve, reject) => {
    const client = HEALTH_URL.protocol === "https:" ? https : http;
    const request = client.get(HEALTH_URL, (res) => {
      res.resume();
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
        } else {
          reject(new Error(`Status ${res.statusCode}`));
        }
      });
    });
    request.on("error", reject);
  });
}

async function run() {
  console.log("[dev] starting NestJS server…");
  spawnProcess("pnpm", ["--filter", "server", "dev"]);
  await waitForHealth();
  console.log("[dev] starting web dev server…");
  spawnProcess("pnpm", ["--filter", "web", "dev"]);
}

run().catch((error) => {
  console.error("[dev] failed to bootstrap dev environment:", error);
  cleanup(1);
});
