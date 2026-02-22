import type { CompileMessage } from "@overleaf-lite/shared";

const lineRefRegexes = [
  /(?:^|\s)(?:main\.tex:)?(?<line>\d+):(?<column>\d+)\b/,
  /(?:main\.tex:|line\s+)(?<line>\d+)\b/i
];

function extractLocation(raw: string): { line?: number; column?: number } {
  for (const pattern of lineRefRegexes) {
    const match = raw.match(pattern);
    if (match?.groups?.line) {
      const line = Number.parseInt(match.groups.line, 10);
      const column = match.groups.column ? Number.parseInt(match.groups.column, 10) : undefined;
      if (!Number.isNaN(line)) {
        return { line, column };
      }
    }
  }

  return {};
}

export function parseCompileLog(log: string): {
  errors: CompileMessage[];
  warnings: CompileMessage[];
} {
  const errors: CompileMessage[] = [];
  const warnings: CompileMessage[] = [];

  for (const rawLine of log.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const location = extractLocation(line);

    if (/\bwarning\b/i.test(line)) {
      warnings.push({
        ...location,
        message: line.replace(/^warning:\s*/i, "").trim(),
        raw: line
      });
      continue;
    }

    if (/^!\s/.test(line) || /\berror\b/i.test(line)) {
      errors.push({
        ...location,
        message: line.replace(/^error:\s*/i, "").replace(/^!\s*/, "").trim(),
        raw: line
      });
    }
  }

  return { errors, warnings };
}
