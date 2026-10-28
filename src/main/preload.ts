import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { StudioAPI, Task } from "../shared/contracts";
const api: StudioAPI = {
  browserTest: (id, action, input) =>
    ipcRenderer.invoke("studio:browser-test", id, action, input),
  openWorkspace: (id) => ipcRenderer.invoke("studio:open-workspace", id),
  applyWorkspace: (id) => ipcRenderer.invoke("studio:apply-workspace", id),
  setupChecks: (id) => ipcRenderer.invoke("studio:setup-checks", id),
  updateStatus: () => ipcRenderer.invoke("studio:update-status"),
  checkUpdate: () => ipcRenderer.invoke("studio:update-check"),
  downloadUpdate: () => ipcRenderer.invoke("studio:update-download"),
  activateUpdate: (rollback) =>
    ipcRenderer.invoke("studio:update-activate", rollback),
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
  saveTask: (input, id) => ipcRenderer.invoke("studio:save-task", input, id),
  deleteTask: (id) => ipcRenderer.invoke("studio:delete-task", id),
  taskAction: (id, action, options) =>
    ipcRenderer.invoke("studio:action", id, action, options),
  codeDiff: (id) => ipcRenderer.invoke("studio:code-diff", id),
  openTarget: (id, external) =>
    ipcRenderer.invoke("studio:open-target", id, external),
  exportTask: (id) => ipcRenderer.invoke("studio:export", id),
  onTask: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, task: Task) =>
      callback(task);
    ipcRenderer.on("studio:task", listener);
    return () => ipcRenderer.removeListener("studio:task", listener);
  },
  onNotification: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) =>
      callback(message);
    ipcRenderer.on("studio:notification", listener);
    return () => ipcRenderer.removeListener("studio:notification", listener);
  },
};
contextBridge.exposeInMainWorld("studio", api);
