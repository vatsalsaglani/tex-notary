import { app, BrowserWindow, dialog, shell } from "electron";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.ELECTRON_DEV === "1";
const webDevUrl = process.env.WEB_DEV_URL ?? "http://localhost:5173";
const isMac = process.platform === "darwin";

let mainWindow = null;
let apiServer = null;
let apiBaseUrl = null;

function desktopPath(...segments) {
  return path.resolve(__dirname, "..", ...segments);
}

function resolveDesktopIcon() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, "icons", "icon.png") : null,
    desktopPath("resources", "icons", "icon.png")
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function resolvePandocBinary() {
  const executable = process.platform === "win32" ? "pandoc.exe" : "pandoc";
  const resourcesPath = process.resourcesPath;

  const candidates = [
    resourcesPath ? path.join(resourcesPath, "bin", executable) : null,
    desktopPath("resources", "bin", executable)
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveTectonicBinary() {
  const executable = process.platform === "win32" ? "tectonic.exe" : "tectonic";
  const resourcesPath = process.resourcesPath;

  const candidates = [
    resourcesPath ? path.join(resourcesPath, "bin", executable) : null,
    desktopPath("resources", "bin", executable)
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function findOpenPort(start = 4310, stop = 4400) {
  return new Promise((resolve, reject) => {
    const attempt = (port) => {
      if (port > stop) {
        reject(new Error(`Unable to find a free port between ${start} and ${stop}.`));
        return;
      }

      const tester = net.createServer();
      tester.unref();

      tester.once("error", () => {
        attempt(port + 1);
      });

      tester.listen(port, "127.0.0.1", () => {
        tester.close(() => resolve(port));
      });
    };

    attempt(start);
  });
}

async function startApiServer() {
  const apiEntry = desktopPath("bundle", "api", "app.js");
  if (!fs.existsSync(apiEntry)) {
    throw new Error(`API bundle not found at ${apiEntry}. Run desktop prepare/bundle scripts first.`);
  }

  const dataRoot = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataRoot, { recursive: true });
  process.env.DATA_ROOT = dataRoot;

  const pandocBinary = resolvePandocBinary();
  if (pandocBinary) {
    process.env.PANDOC_BIN = pandocBinary;
  }

  const tectonicBinary = resolveTectonicBinary();
  if (tectonicBinary) {
    process.env.LATEX_TECTONIC_BIN = tectonicBinary;
  }

  const port = await findOpenPort();
  const apiModule = await import(pathToFileURL(apiEntry).href);
  const apiApp = apiModule.createApp();

  await new Promise((resolve, reject) => {
    const server = apiApp.listen(port, "127.0.0.1", () => {
      apiServer = server;
      resolve();
    });

    server.once("error", reject);
  });

  apiBaseUrl = `http://127.0.0.1:${port}`;
}

function createWindow() {
  process.env.OVERLEAF_API_BASE = apiBaseUrl ?? "http://127.0.0.1:4000";

  const window = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    title: isMac ? "" : "TeX Notary",
    icon: resolveDesktopIcon(),
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: isMac ? { x: 14, y: 14 } : undefined,
    vibrancy: isMac ? "sidebar" : undefined,
    visualEffectState: isMac ? "active" : undefined,
    backgroundColor: isMac ? "#00000000" : "#f4f6fa",
    webPreferences: {
      preload: desktopPath("src", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isMac) {
    try {
      window.setWindowButtonVisibility(true);
    } catch {
      // Ignore unsupported runtime cases.
    }
  }

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://") && !url.startsWith(apiBaseUrl ?? "")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (isDev) {
    window.loadURL(webDevUrl);
  } else {
    window.loadFile(desktopPath("bundle", "web", "index.html"));
  }

  return window;
}

async function bootstrap() {
  try {
    await startApiServer();
    mainWindow = createWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await dialog.showErrorBox("TeX Notary startup failed", message);
    app.quit();
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});

app.on("before-quit", () => {
  if (apiServer) {
    apiServer.close();
    apiServer = null;
  }
});

app.whenReady().then(bootstrap);
