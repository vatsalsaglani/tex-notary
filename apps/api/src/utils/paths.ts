import path from "node:path";

export function resolveDataRoot(cwd = process.cwd()) {
  const configured = process.env.DATA_ROOT?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  const suffix = path.join("apps", "api");
  const normalized = path.normalize(cwd);

  if (normalized.endsWith(suffix)) {
    return path.resolve(cwd, "../../.data");
  }

  return path.resolve(cwd, ".data");
}
