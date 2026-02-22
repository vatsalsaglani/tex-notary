#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const path = require("node:path");

function canLoadBetterSqlite() {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(":memory:");
    db.close();
    return true;
  } catch (error) {
    const message = String(error && (error.stack || error.message || error));
    if (message.includes("NODE_MODULE_VERSION") || error?.code === "ERR_DLOPEN_FAILED") {
      return false;
    }

    throw error;
  }
}

if (canLoadBetterSqlite()) {
  process.exit(0);
}

console.log("[api] Detected better-sqlite3 ABI mismatch. Rebuilding for current Node...");

const workspaceRoot = path.resolve(__dirname, "../../..");
const npmExecPath = process.env.npm_execpath;

const rebuild = (() => {
  if (npmExecPath) {
    // Use the same Node + npm CLI currently running this script.
    return spawnSync(process.execPath, [npmExecPath, "rebuild", "better-sqlite3"], {
      cwd: workspaceRoot,
      stdio: "inherit",
      env: process.env
    });
  }

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnSync(npmCmd, ["rebuild", "better-sqlite3"], {
    cwd: workspaceRoot,
    stdio: "inherit",
    env: process.env
  });
})();

if (rebuild.status !== 0) {
  process.exit(rebuild.status ?? 1);
}

if (!canLoadBetterSqlite()) {
  console.error("[api] better-sqlite3 is still not loadable after rebuild.");
  process.exit(1);
}

console.log("[api] better-sqlite3 is ready for this Node version.");
