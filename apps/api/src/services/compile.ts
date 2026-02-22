import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import type { CompileInput, CompileExecutionResult } from "../types.js";
import { parseCompileLog } from "../utils/compile-log.js";
import { resolveDataRoot } from "../utils/paths.js";

const DATA_ROOT = resolveDataRoot();
const TMP_ROOT = path.join(DATA_ROOT, "tmp");
const PDF_ROOT = path.join(DATA_ROOT, "pdfs");
const DEFAULT_DOCKER_IMAGE = process.env.LATEX_DOCKER_IMAGE?.trim() || "blang/latex:ctanfull";
const COMPILE_TIMEOUT_MS = 60_000;

type CompileBackendPreference = "auto" | "docker" | "local";
type CompileBackend = "docker" | "local";
type LocalCompiler = "tectonic" | "latexmk" | "pdflatex";

function resolveBundledBinary(executable: string, envVar: string) {
  const fromEnv = process.env[envVar]?.trim();
  if (fromEnv) {
    if (fromEnv === executable || fs.existsSync(fromEnv)) {
      return fromEnv;
    }
  }

  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const candidates = [
    resourcesPath ? path.join(resourcesPath, "bin", executable) : null,
    path.join(process.cwd(), "apps", "desktop", "resources", "bin", executable)
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getBackendPreference(): CompileBackendPreference {
  const raw = process.env.LATEX_COMPILE_BACKEND?.trim().toLowerCase();
  if (raw === "docker" || raw === "local" || raw === "auto") {
    return raw;
  }
  return "auto";
}

function ensureDirs() {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  fs.mkdirSync(PDF_ROOT, { recursive: true });
}

function hasBinary(command: string) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
    timeout: 5_000
  });
  return result.status === 0;
}

function resolveTectonicBinary() {
  const executable = process.platform === "win32" ? "tectonic.exe" : "tectonic";
  const bundled = resolveBundledBinary(executable, "LATEX_TECTONIC_BIN");
  if (bundled && hasBinary(bundled)) {
    return bundled;
  }

  if (hasBinary("tectonic")) {
    return "tectonic";
  }

  return null;
}

function detectLocalCompiler(): LocalCompiler | null {
  if (resolveTectonicBinary()) {
    return "tectonic";
  }
  if (hasBinary("latexmk")) {
    return "latexmk";
  }
  if (hasBinary("pdflatex")) {
    return "pdflatex";
  }
  return null;
}

export function isDockerReady() {
  const check = spawnSync("docker", ["info"], {
    stdio: "ignore",
    timeout: 5_000
  });
  return check.status === 0;
}

function resolveBackend(preference: CompileBackendPreference, localCompiler: LocalCompiler | null): CompileBackend | null {
  const dockerReady = isDockerReady();

  if (preference === "local") {
    return localCompiler ? "local" : null;
  }

  if (preference === "docker") {
    return dockerReady ? "docker" : null;
  }

  if (localCompiler) {
    return "local";
  }

  if (dockerReady) {
    return "docker";
  }

  return null;
}

export function getCompileRuntimeInfo() {
  const localCompiler = detectLocalCompiler();
  const dockerReady = isDockerReady();
  const backendPreference = getBackendPreference();
  const selectedBackend = resolveBackend(backendPreference, localCompiler);

  return {
    backendPreference,
    selectedBackend,
    dockerReady,
    dockerImage: DEFAULT_DOCKER_IMAGE,
    localCompiler,
    compileReady: selectedBackend !== null
  };
}

async function runProcess(input: {
  command: string;
  args: string[];
  cwd: string;
}): Promise<{ code: number | null; log: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let combined = "";
    const onData = (chunk: Buffer) => {
      combined += chunk.toString("utf-8");
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Compile timed out after 60s"));
    }, COMPILE_TIMEOUT_MS);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, log: combined });
    });
  });
}

async function runLocalCompile(workDir: string, compiler: LocalCompiler) {
  if (compiler === "tectonic") {
    const tectonicCommand = resolveTectonicBinary();
    if (!tectonicCommand) {
      throw new Error("Tectonic compiler selected but binary is unavailable.");
    }

    return runProcess({
      command: tectonicCommand,
      args: ["main.tex", "--keep-logs", "--outdir", "out"],
      cwd: workDir
    });
  }

  if (compiler === "latexmk") {
    return runProcess({
      command: "latexmk",
      args: ["-pdf", "-interaction=nonstopmode", "-halt-on-error", "-output-directory=out", "main.tex"],
      cwd: workDir
    });
  }

  return runProcess({
    command: "pdflatex",
    args: ["-interaction=nonstopmode", "-halt-on-error", "-output-directory=out", "main.tex"],
    cwd: workDir
  });
}

async function runDockerCompile(workDir: string) {
  const platformArgs = process.arch === "arm64" ? ["--platform", "linux/amd64"] : [];
  const args = [
    "run",
    "--rm",
    ...platformArgs,
    "-v",
    `${workDir}:/work`,
    "-w",
    "/work",
    DEFAULT_DOCKER_IMAGE,
    "pdflatex",
    "-interaction=nonstopmode",
    "-halt-on-error",
    "-output-directory=/work/out",
    "main.tex"
  ];

  return runProcess({
    command: "docker",
    args,
    cwd: workDir
  });
}

function buildUnavailableMessage(runtime: ReturnType<typeof getCompileRuntimeInfo>) {
  return [
    `No compile backend available (preference: ${runtime.backendPreference}).`,
    "Install a local compiler (tectonic, latexmk, or pdflatex),",
    "or start Docker daemon and ensure Docker CLI is configured.",
    "For packaged desktop builds, bundle tectonic into resources/bin.",
    "You can force backend with LATEX_COMPILE_BACKEND=local|docker|auto."
  ].join(" ");
}

export async function compileLatex(input: CompileInput): Promise<CompileExecutionResult> {
  ensureDirs();

  const jobId = randomUUID();
  const workDir = path.join(TMP_ROOT, jobId);
  const outDir = path.join(workDir, "out");
  const texPath = path.join(workDir, "main.tex");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(texPath, input.content, "utf-8");

  const runtime = getCompileRuntimeInfo();
  if (!runtime.selectedBackend) {
    const message = buildUnavailableMessage(runtime);
    fs.rmSync(workDir, { recursive: true, force: true });
    return {
      status: "error",
      errors: [{ message, raw: message }],
      warnings: [],
      durationMs: 0,
      log: message
    };
  }

  const start = Date.now();
  const result = await (async () => {
    try {
      if (runtime.selectedBackend === "local") {
        if (!runtime.localCompiler) {
          throw new Error("Local backend selected but no local compiler found.");
        }
        return await runLocalCompile(workDir, runtime.localCompiler);
      }

      return await runDockerCompile(workDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { code: null, log: message };
    }
  })();

  const durationMs = Date.now() - start;
  const parsed = parseCompileLog(result.log);
  const compiledPdfPath = path.join(outDir, "main.pdf");

  if (result.code === 0 && fs.existsSync(compiledPdfPath)) {
    const projectPdfDir = path.join(PDF_ROOT, input.projectId);
    fs.mkdirSync(projectPdfDir, { recursive: true });
    const targetPdfPath = path.join(projectPdfDir, `${input.versionId}.pdf`);
    fs.copyFileSync(compiledPdfPath, targetPdfPath);

    fs.rmSync(workDir, { recursive: true, force: true });

    return {
      status: "success",
      errors: parsed.errors,
      warnings: parsed.warnings,
      durationMs,
      pdfAbsPath: targetPdfPath,
      log: result.log
    };
  }

  const fallbackErrors =
    parsed.errors.length > 0
      ? parsed.errors
      : [
          {
            message: "Compilation failed. Check LaTeX syntax and logs.",
            raw: result.log || "Compilation failed"
          }
        ];

  fs.rmSync(workDir, { recursive: true, force: true });

  return {
    status: "error",
    errors: fallbackErrors,
    warnings: parsed.warnings,
    durationMs,
    log: result.log
  };
}
