import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { StudioAPI, Task } from "../shared/contracts";
const api: StudioAPI = {
  compareDesigns: (before, after) =>
    ipcRenderer.invoke("studio:compare-designs", before, after),
  bootstrap: () => ipcRenderer.invoke("studio:bootstrap"),
  saveSettings: (settings) => ipcRenderer.invoke("studio:settings", settings),
  chooseDirectory: () => ipcRenderer.invoke("studio:directory"),
  importFiles: (kind, paths) =>
    ipcRenderer.invoke("studio:import", kind, paths),
  pathForFile: (file) => webUtils.getPathForFile(file),
  importImage: (bytes) => ipcRenderer.invoke("studio:import-image", bytes),
  imageThumbnail: (id) => ipcRenderer.invoke("studio:image-thumbnail", id),
  previewAsset: (id, page) => ipcRenderer.invoke("studio:preview", id, page),
  repository: (id, sync) => ipcRenderer.invoke("studio:repository", id, sync),
  testConnection: (target, id) =>
    ipcRenderer.invoke("studio:connection", target, id),
  openZentao: (type, id) =>
    ipcRenderer.invoke("studio:open-zentao", type, id),
  zentaoCatalog: () => ipcRenderer.invoke("studio:zentao-catalog"),
  saveTask: (input, id) => ipcRenderer.invoke("studio:save-task", input, id),
  taskAction: (id, action, options) =>
    ipcRenderer.invoke("studio:action", id, action, options),
  openTarget: (id) => ipcRenderer.invoke("studio:open-target", id),
  exportTask: (id) => ipcRenderer.invoke("studio:export", id),
  onTask: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, task: Task) =>
      callback(task);
    ipcRenderer.on("studio:task", listener);
    return () => ipcRenderer.removeListener("studio:task", listener);
  },
};
contextBridge.exposeInMainWorld("studio", api);
