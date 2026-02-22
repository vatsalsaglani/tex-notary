import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "../../..");
const desktopRoot = path.resolve(__dirname, "..");

const apiDist = path.join(projectRoot, "apps", "api", "dist");
const webDist = path.join(projectRoot, "apps", "web", "dist");
const bundleRoot = path.join(desktopRoot, "bundle");
const requireWebBundle = process.env.ELECTRON_DEV !== "1";

if (!fs.existsSync(apiDist)) {
  throw new Error(`API dist not found at ${apiDist}. Run npm run build -w @overleaf-lite/api first.`);
}

if (!fs.existsSync(webDist) && requireWebBundle) {
  throw new Error(`Web dist not found at ${webDist}. Run npm run build -w @overleaf-lite/web first.`);
}

fs.rmSync(bundleRoot, { recursive: true, force: true });
fs.mkdirSync(bundleRoot, { recursive: true });

fs.cpSync(apiDist, path.join(bundleRoot, "api"), { recursive: true });

if (fs.existsSync(webDist)) {
  fs.cpSync(webDist, path.join(bundleRoot, "web"), { recursive: true });
}

// eslint-disable-next-line no-console
console.log("[desktop] Prepared bundle folder from api/web dist outputs.");
