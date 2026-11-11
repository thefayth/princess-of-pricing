import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("popDesktop", {
  vaultStatus: () => ipcRenderer.invoke("vault:status"),
  listObservations: () => ipcRenderer.invoke("vault:list-observations"),
  pair: (code: string) => ipcRenderer.invoke("vault:pair", code),
  sync: () => ipcRenderer.invoke("vault:sync"),
});
