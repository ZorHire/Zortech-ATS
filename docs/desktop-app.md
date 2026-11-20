# ZorHire desktop app (Windows)

A Windows app for recruiters. It shows ZorHire in its own window and has the
ZorHire Assistant built in, so recruiters don't need Chrome or the extension.

Download: https://zorhire.zortechs.in/desktop/ZorHire-Setup.exe

## What it does

- **ZorHire in its own window**, with a desktop and Start-menu shortcut.
- **Tabs for LinkedIn, Recruiter Lite and Naukri** (the **+** button). The recruiter
  signs in once and stays signed in, like a browser profile. Links to these sites
  from ZorHire open as tabs. WhatsApp and email links open the WhatsApp and mail apps.
- **The LinkedIn agent is built in.** It is the same agent as the Chrome extension,
  with the same limits and the same auto-pause on LinkedIn warnings.
  - It works in the **LinkedIn agent** tab. The recruiter can watch it there or
    answer a LinkedIn security check.
  - It connects to the recruiter's ZorHire account on its own, so there is no code to
    paste. Each PC shows up under *LinkedIn agent → Connected browsers and apps* as
    "Desktop app (PC name)", and can be disconnected there.
- **Save to ZorHire** works on LinkedIn profiles and Naukri Resdex/Recruit pages (the
  button on the page), and on any page (the Assistant panel or the right-click menu).
- **Free job-board posting.** Boards queued with *Post free* open as tabs within a
  minute, with the Fill form panel.
- **Desktop alerts.** New JD assignments, interviews, pipeline moves and vendor
  submissions show as Windows notifications; clicking one opens the page in ZorHire.
  The bell and the taskbar icon show the unread count.
- **Drop resumes anywhere in ZorHire.** Drag PDF or Word files from the desktop or
  Outlook onto any page, and they open in *Candidates → Bulk resume upload*. This also
  works in the browser version.
- **Runs in the tray.** Closing the window keeps alerts and the agent running.
  - Tray menu: pause the agent, run it now, start with Windows, check for updates, quit.
- **Updates itself.** It checks the ZorHire server every 6 hours, downloads new versions
  in the background, and offers "Restart to update".

Passwords: the app never reads or stores LinkedIn, Naukri or job-board passwords;
recruiters sign in on the sites themselves. The app keeps one ZorHire connection
code, encrypted with the Windows user's key (DPAPI).

## How it is built

`desktop/` is an Electron app.

| File | What it does |
|---|---|
| `src/main.js` | Window, tray, updates, IPC |
| `src/tabs.js` | Tabs (`WebContentsView`). ZorHire uses session `persist:zorhire`; websites use `persist:web` |
| `src/agent.js` | Port of `extension/background.js`: the agent loop, job-board tabs, message handling |
| `src/alerts.js` | Polls `/v1/notifications` with the recruiter's ZorHire sign-in |
| `src/preload-tools.js` | Gives the page scripts `chrome.runtime.sendMessage` in the isolated world; website code can't see it |
| `src/preload-app.js` | Exposes `window.zorhireDesktop` to ZorHire. The frontend reads it through `frontend/src/lib/desktop.ts` to adjust wording |
| `src/shell.html`, `src/shell.js` | Tab bar and Assistant panel |

- **Shared page scripts:** the page-side scripts are the extension's own files
  (`extension/inpage.js`, `linkedin-import.js`, `capture.js`, `autofill.js`), copied into
  the installer. Fix them once in `extension/` and both the extension and the app get
  the fix.
- **User agent:** websites see a plain Chrome user agent. ZorHire tabs add
  `ZorHireDesktop/<version>`.

## Develop

```powershell
cd desktop
npm install
npm start          # against https://zorhire.zortechs.in
npm run start:local  # against http://localhost:5173 (frontend) + http://localhost:5000/v1 (API)
```

`src/selftest.js` is a development-only end-to-end check: it signs in with a test token
and covers the bridge, auto-connect, Save to ZorHire, alerts and resume drop. Set
`ZORHIRE_SELFTEST=<output folder>` and `ZORHIRE_TEST_CTX=<json with token, userId,
tenantId>` to run it. It is not included in the installer.

## Release

1. Bump `version` in `desktop/package.json` and commit.
2. Tag and push the tag:

   ```powershell
   git tag desktop-v1.0.1
   ```

   ```powershell
   git push origin desktop-v1.0.1
   ```

3. `.github/workflows/desktop-release.yml` builds the installer on Windows. It uploads
   `ZorHire-Setup-<version>.exe`, `ZorHire-Setup.exe`, the blockmap and `latest.yml` to
   `/opt/zortech/desktop-releases` on the VPS, keeping the last 3 versions.
4. nginx serves that folder at `/desktop/`, and installed apps update from there.

The first release needs the nginx and docker-compose changes from this branch to be
deployed (they add the `/desktop/` route and mount).

## Code signing

The installer is not signed yet, so Windows SmartScreen shows "Windows protected your
PC". To install anyway, choose *More info → Run anyway*. That's fine for our own team.
Before giving the app to clients, buy a code-signing certificate (an OV or EV
certificate, about ₹15–30k a year) and add it to electron-builder:

- `win.certificateFile` and `CSC_KEY_PASSWORD`, or an Azure Trusted Signing account.
- Set `win.publisherName` at the same time so updates verify the signature.

## Limits

- **Sign-in:** "Sign in with Google" doesn't work on some sites inside embedded
  browsers. Use the site's email sign-in, or Microsoft or Apple where offered.
- **Platforms:** Windows only for now. A Mac build needs an Apple Developer account
  ($99 a year) for signing and notarisation.
- **Agent hours:** the agent runs only while the app is open or in the tray, the same
  as the extension needs Chrome open.
