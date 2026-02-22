import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PANDOC_TIMEOUT_MS = 12_000;

export interface MarkdownPreviewResult {
  markdown: string;
  warnings: string[];
}

function getBundledPandocCandidates() {
  const executable = process.platform === "win32" ? "pandoc.exe" : "pandoc";
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

  const candidates = [
    process.env.PANDOC_BIN?.trim(),
    resourcesPath ? path.join(resourcesPath, "bin", executable) : null,
    path.join(process.cwd(), "apps", "desktop", "resources", "bin", executable)
  ];

  return candidates.filter((candidate): candidate is string => Boolean(candidate));
}

function resolvePandocBinary() {
  const candidates = getBundledPandocCandidates();
  for (const candidate of candidates) {
    if (candidate === "pandoc" || fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "pandoc";
}

function normalizeWarnings(stderr: string) {
  return stderr
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isPandocReady() {
  const check = spawnSync(resolvePandocBinary(), ["--version"], {
    stdio: "ignore",
    timeout: 5_000
  });

  return check.status === 0;
}

export async function convertLatexToMarkdown(latex: string): Promise<MarkdownPreviewResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolvePandocBinary(), ["--from=latex", "--to=gfm+hard_line_breaks", "--wrap=none", "-"], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Pandoc preview timed out after ${Math.round(PANDOC_TIMEOUT_MS / 1000)}s`));
    }, PANDOC_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        const message = stderr.trim() || `pandoc exited with code ${code ?? "unknown"}`;
        reject(new Error(message));
        return;
      }

      resolve({
        markdown: stdout,
        warnings: normalizeWarnings(stderr)
      });
    });

    child.stdin.end(latex, "utf-8");
  });
}
