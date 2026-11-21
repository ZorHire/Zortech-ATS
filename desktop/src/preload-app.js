/* Preload for ZorHire tabs: lets the web app know it runs in the desktop app, so it can
 * show desktop-only touches (built-in LinkedIn agent instead of the Chrome extension,
 * opening LinkedIn/Naukri as app tabs). Nothing else from the desktop is exposed. */
const { contextBridge, ipcRenderer } = require("electron");

const info = ipcRenderer.sendSync("app:info");

contextBridge.exposeInMainWorld("zorhireDesktop", {
  isDesktop: true,
  version: info.version,
  platform: info.platform,
  openTool: (url) => ipcRenderer.send("app:open-tool", String(url)),
});
