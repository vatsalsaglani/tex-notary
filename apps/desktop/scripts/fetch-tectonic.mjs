import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const desktopRoot = path.resolve(__dirname, "..");
const outputDir = path.join(desktopRoot, "resources", "bin");
const executable = process.platform === "win32" ? "tectonic.exe" : "tectonic";
const outputPath = path.join(outputDir, executable);
const requestedVersion = process.env.TECTONIC_VERSION?.trim().replace(/^v/, "") || "latest";
const forceDownload = process.env.TECTONIC_FORCE_DOWNLOAD === "1";

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

  if (archivePath.endsWith(".tar.gz") || archivePath.endsWith(".tar.xz")) {
    execFileSync("tar", ["-xf", archivePath, "-C", extractDir], { stdio: "inherit" });
    return;
  }

  throw new Error(`Unsupported archive format: ${archivePath}`);
}

function findBinary(searchRoot) {
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

function isArchiveAsset(name) {
  return (
    !name.endsWith(".sha256") &&
    !name.endsWith(".sha256sum") &&
    !name.endsWith(".sig") &&
    !name.endsWith(".asc") &&
    (name.endsWith(".tar.gz") || name.endsWith(".tar.xz") || name.endsWith(".zip"))
  );
}

function getAssetMatchers() {
  if (process.platform === "darwin") {
    if (process.arch === "arm64") {
      return [/aarch64-apple-darwin/i, /darwin.*arm64/i, /apple-darwin.*aarch64/i];
    }
    return [/x86_64-apple-darwin/i, /darwin.*(x64|x86_64)/i];
  }

  if (process.platform === "win32") {
    return [/x86_64-pc-windows-msvc/i, /windows.*(x64|x86_64|amd64)/i];
  }

  if (process.platform === "linux") {
    if (process.arch === "arm64") {
      return [/aarch64-unknown-linux-gnu/i, /linux.*(arm64|aarch64)/i];
    }
    return [/x86_64-unknown-linux-gnu/i, /linux.*(x64|x86_64|amd64)/i];
  }

  throw new Error(`Unsupported platform for tectonic bundling: ${process.platform}-${process.arch}`);
}

async function fetchReleaseJson() {
  const base = "https://api.github.com/repos/tectonic-typesetting/tectonic/releases";
  const urls =
    requestedVersion === "latest"
      ? [`${base}/latest`]
      : [`${base}/tags/tectonic%40${requestedVersion}`, `${base}/tags/v${requestedVersion}`, `${base}/tags/${requestedVersion}`];

  let lastError = null;
  for (const url of urls) {
    const response = await fetch(url, {
      headers: { "User-Agent": "tex-notary-desktop-builder" }
    });

    if (response.ok) {
      return response.json();
    }

    lastError = new Error(`release lookup failed (${response.status} ${response.statusText}) for ${url}`);
  }

  throw lastError ?? new Error("Failed to fetch Tectonic release metadata");
}

function pickAsset(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const matchers = getAssetMatchers();

  const candidates = assets.filter((asset) => isArchiveAsset(String(asset.name || "")));
  for (const matcher of matchers) {
    const found = candidates.find((asset) => matcher.test(String(asset.name || "")));
    if (found) {
      return found;
    }
  }

  const fallback = candidates.find((asset) => /tectonic/i.test(String(asset.name || "")));
  return fallback ?? null;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  if (!forceDownload && fs.existsSync(outputPath)) {
    // eslint-disable-next-line no-console
    console.log(`[desktop] Using existing bundled tectonic at ${outputPath}`);
    return;
  }

  const release = await fetchReleaseJson();
  const asset = pickAsset(release);
  if (!asset?.browser_download_url || !asset?.name) {
    throw new Error(
      `Could not find matching Tectonic asset for ${process.platform}-${process.arch} in release ${release.tag_name ?? "unknown"}`
    );
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tex-notary-tectonic-"));
  const archivePath = path.join(tempDir, String(asset.name));
  const extractDir = path.join(tempDir, "extract");
  fs.mkdirSync(extractDir, { recursive: true });

  // eslint-disable-next-line no-console
  console.log(`[desktop] Downloading ${asset.browser_download_url}`);
  const response = await fetch(String(asset.browser_download_url));
  if (!response.ok) {
    throw new Error(`Failed to download tectonic asset: ${response.status} ${response.statusText}`);
  }

  fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));
  extractArchive(archivePath, extractDir);

  const foundBinary = findBinary(extractDir);
  if (!foundBinary) {
    throw new Error("Unable to locate tectonic binary inside extracted archive.");
  }

  fs.copyFileSync(foundBinary, outputPath);
  if (process.platform !== "win32") {
    fs.chmodSync(outputPath, 0o755);
  }

  // eslint-disable-next-line no-console
  console.log(`[desktop] Bundled tectonic binary at ${outputPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[desktop] Tectonic fetch failed:", error);
  process.exitCode = 1;
});
