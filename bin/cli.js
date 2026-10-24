#!/usr/bin/env node
import "@explita/env-loader/auto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");

if (!fs.existsSync(schemaPath)) {
  console.error(`❌ Error: schema.prisma not found at expected path: ${schemaPath}`);
  process.exit(1);
}

// Resolve prisma CLI binary
let prismaCliPath;
try {
  const prismaPkgPath = require.resolve("prisma/package.json");
  const prismaPkg = JSON.parse(fs.readFileSync(prismaPkgPath, "utf8"));
  const binRelative = typeof prismaPkg.bin === "string" ? prismaPkg.bin : prismaPkg.bin?.prisma;
  prismaCliPath = path.resolve(path.dirname(prismaPkgPath), binRelative);
} catch {
  // If resolution fails, fallback to npx prisma in path
  prismaCliPath = null;
}

const args = process.argv.slice(2);
const first = args[0];
const second = args[1];

const isHelp = !first || first === "--help" || first === "-h" || first === "help";

if (isHelp) {
  console.log(`
Explita Tunnel Plugin CLI

Usage:
  npx @explita/tunnel-server-plugin <command> [options]
  tunnel-plugin <command> [options]

Commands:
  db push, db:push     Push the bundled Prisma schema to the database

Options:
  --accept-data-loss   Ignore data loss warnings
  --force-reset        Force a reset of the database before push
  -h, --help           Show this help message
`);
  process.exit(0);
}

const isDbPush =
  (first === "db" && second === "push") ||
  first === "db:push" ||
  first === "push";

if (isDbPush) {
  const extraArgs =
    first === "db" && second === "push"
      ? args.slice(2)
      : args.slice(1);

  const hasHelpFlag = extraArgs.some((arg) => arg === "-h" || arg === "--help");
  const dbUrl = process.env.DATABASE_URL;

  if (!hasHelpFlag && !dbUrl) {
    console.error("\n❌ Error: DATABASE_URL is required to push database schema.");
    console.error("Please define DATABASE_URL in your .env file or environment.\n");
    process.exit(1);
  }

  console.log("🚀 Pushing Explita Tunnel schema to database...\n");

  const runner = prismaCliPath ? process.execPath : "npx";
  const runnerArgs = [
    ...(prismaCliPath ? [prismaCliPath] : ["prisma"]),
    "db",
    "push",
    `--schema=${schemaPath}`,
    ...(dbUrl ? [`--url=${dbUrl}`] : []),
    ...extraArgs.filter((arg) => !arg.startsWith("--url")),
  ];

  const child = spawn(runner, runnerArgs, {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
} else {
  console.error(`Unknown command: ${args.join(" ")}`);
  console.error("Run 'tunnel-plugin --help' for usage.");
  process.exit(1);
}
