/* Small JSON settings store in the app's user-data folder (replaces chrome.storage.local).
 * The ZorHire connection code is encrypted with the Windows user's key (safeStorage, DPAPI)
 * so another Windows account on the same PC cannot read it from disk. */
const fs = require("fs");
const path = require("path");
const { app, safeStorage } = require("electron");

const SECRET_KEYS = new Set(["token"]);
let file;
let data = {};
let writeTimer = null;

function load() {
  file = path.join(app.getPath("userData"), "settings.json");
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const [k, v] of Object.entries(raw)) {
      if (SECRET_KEYS.has(k) && v && typeof v === "object" && v.enc) {
        try { data[k] = safeStorage.decryptString(Buffer.from(v.enc, "base64")); } catch { data[k] = ""; }
      } else data[k] = v;
    }
  } catch { data = {}; }
}

function flush() {
  writeTimer = null;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (SECRET_KEYS.has(k) && v && safeStorage.isEncryptionAvailable()) {
      out[k] = { enc: safeStorage.encryptString(String(v)).toString("base64") };
    } else if (!SECRET_KEYS.has(k) || !v) out[k] = v;
    // Without OS encryption the token is kept in memory only (asks to reconnect after restart).
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + ".tmp", JSON.stringify(out, null, 2));
  fs.renameSync(file + ".tmp", file);
}

function get(defaults) {
  return { ...defaults, ...data };
}

function set(obj) {
  Object.assign(data, obj);
  if (!writeTimer) writeTimer = setTimeout(flush, 200);
}

function flushNow() {
  if (writeTimer) { clearTimeout(writeTimer); flush(); }
}

module.exports = { load, get, set, flushNow };
