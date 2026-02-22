const { contextBridge } = require("electron");

const runtime = {
  apiBase: process.env.OVERLEAF_API_BASE ?? "",
  isElectron: true,
  platform: process.platform,
  isMac: process.platform === "darwin"
};

contextBridge.exposeInMainWorld("__OVERLEAF_API_BASE__", runtime.apiBase);
contextBridge.exposeInMainWorld("__TEX_NOTARY_RUNTIME__", runtime);
