/* Preload for the window's own tab bar and Assistant panel (shell.html, a local file). */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zh", {
  init: () => ipcRenderer.invoke("shell:init"),
  activate: (id) => ipcRenderer.send("tabs:activate", id),
  close: (id) => ipcRenderer.send("tabs:close", id),
  nav: (id, action) => ipcRenderer.send("tabs:nav", id, action),
  open: (which) => ipcRenderer.send("tabs:open", which),
  openMenu: (x, y) => ipcRenderer.send("tabs:menu", x, y),
  setPanel: (open) => ipcRenderer.send("panel:set", open),
  assistantSet: (patch) => ipcRenderer.invoke("assistant:set", patch),
  run: () => ipcRenderer.invoke("assistant:run"),
  connect: () => ipcRenderer.invoke("assistant:connect"),
  disconnect: () => ipcRenderer.invoke("assistant:disconnect"),
  capture: () => ipcRenderer.invoke("assistant:capture"),
  installUpdate: () => ipcRenderer.send("update:install"),
  on: (channel, fn) => {
    const ok = ["tabs:state", "assistant:state", "assistant:error", "alerts:unread", "update:ready"];
    if (ok.includes(channel)) ipcRenderer.on(channel, (_e, payload) => fn(payload));
  },
});
