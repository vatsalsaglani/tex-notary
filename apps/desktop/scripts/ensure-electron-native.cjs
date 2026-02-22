#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "..", "..");
const isWindows = process.platform === "win32";

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    stdio: "inherit"
  });
}

function resolveElectronVersion() {
  const packageJsonPath = path.join(desktopRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const fromBuild = packageJson?.build?.electronVersion;
  const fromDevDep = packageJson?.devDependencies?.electron;

  const candidate = String(fromBuild || fromDevDep || "").replace(/^[^\d]*/, "");
  if (!candidate) {
    throw new Error("Unable to resolve Electron version from apps/desktop/package.json");
  }

  return candidate;
}

function resolveBetterSqliteDir() {
  const pkgJson = require.resolve("better-sqlite3/package.json", {
    paths: [desktopRoot, repoRoot]
  });
  return path.dirname(pkgJson);
}

function installElectronPrebuild() {
  const electronVersion = resolveElectronVersion();
  const moduleDir = resolveBetterSqliteDir();
  const prebuildBin = require.resolve("prebuild-install/bin.js", {
    paths: [moduleDir, repoRoot]
  });

  const arch = process.env.npm_config_arch || process.arch;
  const platform = process.env.npm_config_platform || process.platform;

  process.stdout.write(
    `[desktop] Installing better-sqlite3 prebuild for electron v${electronVersion} (${platform}-${arch})...\n`
  );

  const prebuild = run(
    process.execPath,
    [
      prebuildBin,
      "--runtime=electron",
      `--target=${electronVersion}`,
      `--arch=${arch}`,
      `--platform=${platform}`
    ],
    moduleDir
  );

  if (prebuild.status === 0) {
    process.stdout.write("[desktop] better-sqlite3 electron prebuild installed.\n");
    return;
  }

  process.stdout.write(
    "[desktop] Prebuild download failed, falling back to electron-builder install-app-deps.\n"
  );
  const npmCmd = isWindows ? "npm.cmd" : "npm";
  const fallback = run(npmCmd, ["exec", "electron-builder", "install-app-deps"], desktopRoot);
  if (fallback.status !== 0) {
    process.exit(fallback.status || 1);
  }
}

try {
  installElectronPrebuild();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[desktop] Failed to prepare electron native dependency: ${message}\n`);
  process.exit(1);
}
