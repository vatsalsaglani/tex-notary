import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const desktopRoot = path.resolve(__dirname, "..");
const outputDir = path.join(desktopRoot, "resources", "bin");
const version = (process.env.PANDOC_VERSION ?? "3.9").replace(/^v/, "");
const forceDownload = process.env.PANDOC_FORCE_DOWNLOAD === "1";

function resolveAssetName() {
  if (process.platform === "darwin") {
    if (process.arch === "arm64") {
      return `pandoc-${version}-arm64-macOS.zip`;
    }
    return `pandoc-${version}-x86_64-macOS.zip`;
  }

  if (process.platform === "win32") {
    return `pandoc-${version}-windows-x86_64.zip`;
  }

  if (process.platform === "linux") {
    if (process.arch === "arm64") {
      return `pandoc-${version}-linux-arm64.tar.gz`;
    }
    return `pandoc-${version}-linux-amd64.tar.gz`;
  }

  throw new Error(`Unsupported platform for pandoc bundling: ${process.platform}-${process.arch}`);
}

function extractArchive(archivePath, extractDir) {
  if (archivePath.endsWith(".zip")) {
    if (process.platform === "win32") {
      execFileSync(
        "powershell",
        ["-NoProfile", "-Command", `Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force`],
        { stdio: "inherit" }
      );
      return;
    }

    execFileSync("unzip", ["-q", archivePath, "-d", extractDir], { stdio: "inherit" });
    return;
  }

  if (archivePath.endsWith(".tar.gz")) {
    execFileSync("tar", ["-xzf", archivePath, "-C", extractDir], { stdio: "inherit" });
    return;
  }

  throw new Error(`Unsupported archive format: ${archivePath}`);
}

function findPandocBinary(searchRoot) {
  const executable = process.platform === "win32" ? "pandoc.exe" : "pandoc";
  const queue = [searchRoot];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      continue;
    }

    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === executable) {
        return fullPath;
      }
    }
  }

  return null;
}

async function main() {
  const asset = resolveAssetName();
  const releaseUrl = `https://github.com/jgm/pandoc/releases/download/${version}/${asset}`;
  const destination = path.join(outputDir, process.platform === "win32" ? "pandoc.exe" : "pandoc");

  fs.mkdirSync(outputDir, { recursive: true });

  if (!forceDownload && fs.existsSync(destination)) {
    // eslint-disable-next-line no-console
    console.log(`[desktop] Using existing bundled pandoc at ${destination}`);
    return;
  }

  fs.rmSync(path.join(outputDir, "pandoc"), { force: true });
  fs.rmSync(path.join(outputDir, "pandoc.exe"), { force: true });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tex-notary-pandoc-"));
  const archivePath = path.join(tempDir, asset);
  const extractDir = path.join(tempDir, "extract");

  fs.mkdirSync(extractDir, { recursive: true });

  // eslint-disable-next-line no-console
  console.log(`[desktop] Downloading ${releaseUrl}`);
  const response = await fetch(releaseUrl);
  if (!response.ok) {
    throw new Error(`Failed to download pandoc asset: ${response.status} ${response.statusText}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(archivePath, data);

  extractArchive(archivePath, extractDir);

  const foundBinary = findPandocBinary(extractDir);
  if (!foundBinary) {
    throw new Error("Unable to locate pandoc binary inside extracted archive.");
  }

  fs.copyFileSync(foundBinary, destination);

  if (process.platform !== "win32") {
    fs.chmodSync(destination, 0o755);
  }

  // eslint-disable-next-line no-console
  console.log(`[desktop] Bundled pandoc binary at ${destination}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[desktop] Pandoc fetch failed:", error);
  process.exitCode = 1;
});
