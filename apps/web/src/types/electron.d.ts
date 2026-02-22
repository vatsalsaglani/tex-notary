export {};

declare global {
  interface TexNotaryRuntime {
    apiBase: string;
    isElectron: boolean;
    platform: string;
    isMac: boolean;
  }

  interface Window {
    __OVERLEAF_API_BASE__?: string;
    __TEX_NOTARY_RUNTIME__?: TexNotaryRuntime;
  }
}
