/* Preload for website tabs (LinkedIn, Naukri, job boards). It runs in Electron's isolated
 * world (id 999), the same world the app injects the extension's page scripts into, and
 * gives them the one Chrome API they use: chrome.runtime.sendMessage. Website code itself
 * cannot see or call any of this. */
const { ipcRenderer } = require("electron");

const runtime = {
  sendMessage(msg, callback) {
    const p = ipcRenderer.invoke("zh:ext-msg", msg).catch((e) => ({ ok: false, error: e.message }));
    if (typeof callback === "function") p.then(callback);
    return p;
  },
};

if (!globalThis.chrome || typeof globalThis.chrome !== "object") globalThis.chrome = {};
try { globalThis.chrome.runtime = runtime; } catch { globalThis.chrome = { runtime }; }
