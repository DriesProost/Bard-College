> Latest release: **1.4.0** simplifies the lesson page to five steps. See [SIMPLE_LESSONS_VALIDATION.md](SIMPLE_LESSONS_VALIDATION.md). Reflections are optional; the earlier versioned notes below are historical. Native Windows checks still apply.

> Latest version: **1.3.0**. See [GUIDED_LESSONS_VALIDATION.md](GUIDED_LESSONS_VALIDATION.md) for AI-required lessons, daily steps, review limits and self-checks. Windows hardware, installation and DPAPI checks remain required. Older optional-AI behavior below is historical.

> Current release: use the **1.2.0** installer and [PHASE2_VALIDATION.md](PHASE2_VALIDATION.md) for the required Writing/Music, local recording, upgrade and native Windows acceptance checks. The original 1.0.0 artefact details below are historical; these general install/credential procedures still apply.

# Windows installation and acceptance check

The release build is `release/Bards-College-Setup-1.0.0-x64.exe`, a **self-contained Windows 10/11 x64 installer** produced with electron-builder and NSIS. It includes Electron, Chromium, the application, its runtime dependencies and the thirty lessons. **The installed app needs no VS Code, Node.js, Git, Vite server or internet connection to write or study.** Internet and an account with access to `gpt-6-luna` are needed only for AI requests.

The installer and application are unsigned because no publisher signing certificate was supplied. Windows may identify the publisher as unknown. No system security settings are disabled by this project. The accompanying `.sha256` file identifies this build; it does not replace a publisher signature.

## Install and first launch on your PC

1. Close any running copy of Bard’s College. Run the installer under your normal Windows account. It defaults to `%LOCALAPPDATA%\Programs\BardsCollege`, registers an uninstall entry, and creates Start menu and desktop shortcuts. It runs as the current user rather than requiring the application to run as administrator.
2. Start it from its shortcut with VS Code and all terminals closed. If desired, disconnect the internet **before first launch**. Enter your name, interests, genres, preferred writing form, experience and daily goal.
3. In the Academy, complete the first exercise and a short reflection. Close and reopen. Verify that your profile, completion and writing remain. Offline practice must not be blocked by a missing API key.
4. Open the Scriptorium, write a few lines, save a snapshot and revise them. Check the earlier snapshot, then export Markdown and plain text. Type a final word and close immediately; reopen and confirm that word was saved. Try a title with an apostrophe and ordinary non-ASCII characters.
5. In Settings, try line numbers, a dark/light writing surface and reduced motion. Check keyboard navigation, the dialog focus order, Ctrl+S, and window resizing at your normal Windows display scale (including 150%/200% if you use it).

## Verify Windows key protection and live AI

1. Reconnect the internet. Settings should report **available · Windows DPAPI**. If protection is unavailable, the app must refuse to store a key; there is no plaintext fallback.
2. Enter your key in the password field and select **Save key securely**. The field clears. The saved key is never shown on reload, returned through the renderer bridge, or included in writing exports. The encrypted blob lives in `college.sqlite` under the application’s user-data directory; on a normal installation this is generally `%APPDATA%\bards-college`.
3. Select **Test AI Connection**, then **Send connection test**. This sends the real prompt “Reply with only OK.” through the official OpenAI Responses API using **only `gpt-6-luna`**, with a maximum of 64 output tokens, no automatic retries and no student text/profile. It can incur a small charge. Usage is recorded; a USD estimate requires prices in Settings. No prices or hard billing limits are assumed.
4. A success message requires a completed, nonempty model response. An entered key alone is never reported as a successful connection. Check the error display with an invalid key, no model access, exhausted credits, a rate limit or a disconnected network where applicable. The application must not switch models. An incomplete/refused response is not a success. Do not deliberately spend credits just to exhaust an account.
5. Close and reopen. Test the saved key again without entering it: this verifies that Windows can unlock it after restart. Then open a completed lesson, request feedback, revise the answer and save it. Earlier notes should remain visible and labelled as notes on an earlier draft until you request new feedback. Open that revision in the Scriptorium and confirm the text is carried over.
6. Disconnect again. Restart and verify the original answer, revision, saved feedback, Songbook text, snapshots, exports and progression. Only AI requests should fail. Reconnect and retry explicitly; no hidden paid retries run in the background.
7. In Settings, remove the API key. The key should become “not configured” and AI buttons should be unavailable, while all local work still opens.

Windows DPAPI protects the key for the signed-in Windows account. This is not protection against malware already executing as that same user. Moving a database to another user/machine can make its key unreadable; re-enter the key rather than disabling protection.

## Upgrade and uninstall checks

Back up your work before testing installation changes. Close the app and copy the whole user-data folder. Reinstall the same release to verify it opens the existing profile. Then uninstall using Windows Installed Apps and reinstall. Personal work should remain because the installer never deletes user data. The uninstaller deletes only the exact files shipped by the build and removes empty installation subfolders; it does not recursively remove a folder containing unrelated files. Check shortcuts and the uninstall entry too.

The supported custom NSIS script is in `build/installer.nsi`. It writes the uninstaller during installation, uses one English-language wizard, and avoids the Wine-dependent pre-extraction step of electron-builder’s default installer. `build/after-pack.cjs` generates an exact payload-removal manifest. Windows UI, file-lock behaviour, upgrades and uninstall must still be exercised on Windows; a successful cross-compilation does not establish those behaviours.

## Optional developer validation on Windows

These commands require Node.js 24 in the **source checkout**, not on an end user’s installed application:

```powershell
npm ci
npm run build
npm test
npm run test:desktop
npm run dist:win
```

The native desktop suite includes a **real Windows DPAPI** test using a dummy key, encryption-at-rest, restart/decryption and removal. It is deliberately skipped on Linux. Other AI transport tests use an isolated simulated provider and incur no charges. The live connection button above is the account-specific check.

To run the same desktop checks against your installed executable instead of the development Electron binary:

```powershell
$env:BARD_PACKAGED_EXECUTABLE = "$env:LOCALAPPDATA\Programs\BardsCollege\Bard's College.exe"
npm exec playwright test
Remove-Item Env:BARD_PACKAGED_EXECUTABLE
```

The tests create temporary profiles via `--user-data-dir`; they do not use your actual writing or key. Run them with the normal installed app closed. Windows UI interaction, live model availability and account billing remain separate from the automated fixture tests.

## What this cloud can establish

The Linux cloud can build the Windows installer, verify the included Windows payload and archive, run all portable tests, and launch a relocated **packaged Linux build** outside the repository with renderer/main HTTP disabled for the offline journey. It cannot establish Windows installation, actual Windows DPAPI operation, Windows accessibility/display behaviour, SmartScreen reputation, or live access to your OpenAI account. The release validation report records passed, skipped and unrun checks separately.
