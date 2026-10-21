> Current Phase 2 results and remaining Windows checks: [PHASE2_VALIDATION.md](PHASE2_VALIDATION.md). Historical release results below are retained as a record.

> Historical validation for version 1.0.0. Current Phase 1 / version 1.1.0 results are in [PHASE1_VALIDATION.md](PHASE1_VALIDATION.md).

# Release validation — Bard’s College 1.0.0

Date: 20 October 2026. Built and tested in the Linux cloud. The source is local working-tree work; this report does not claim a GitHub release or Windows installation has been published/tested.

## Deliverables

- `release/Bards-College-Setup-1.0.0-x64.exe` — self-contained Windows 10/11 x64 installer, **140,623,685 bytes**, built by electron-builder 26.15.3 / NSIS with Electron 40.10.6.
- `release/Bards-College-Setup-1.0.0-x64.exe.sha256` — SHA-256 checksum.
- `release/package-verification.json` — archive/source comparisons, architecture and signing observations.
- [WINDOWS_VALIDATION.md](WINDOWS_VALIDATION.md) — PC acceptance checklist and optional native tests.
- [CURRICULUM_REVIEW.md](CURRICULUM_REVIEW.md) — all thirty lessons reviewed, fifteen revised, weak/repetitive areas and remaining limitations identified.

Installer SHA-256:

```text
3631c3a5fb0e74d6aa7a2fe4d41146e1cf72c91247dc25a763259957f5f3b2b2
```

Both installer and app have an empty PE certificate table: **unsigned**. No publisher signing certificate was supplied. Build-tool messages containing “signing” are not evidence of an Authenticode signature. The NSIS installer stub is normal PE32/i386; the application payload is PE32+/AMD64. The payload includes its runtime and does not require Node.js, VS Code or a development server on the destination PC.

## Results

| Check                                                         | Result                              | Evidence / limit                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript and Vite production build                          | Passed                              | `npm run build` compiles renderer, privileged process and sandboxed preload.                                                                                                                                                                    |
| Core automated tests                                          | **21 passed; 0 failed**             | Real SQLite persistence, migrations, retained feedback, snapshots, progression, model/host pinning, SDK safeguards, connection responses/errors, credential failure handling, uninstall manifest safety.                                        |
| Production desktop journeys from source                       | **2 passed**                        | Real Electron, actual IPC and SQLite; offline core flow and simulated-provider AI/revision flow.                                                                                                                                                |
| Relocated packaged application                                | **2 passed**                        | Packaged Linux app copied to `/tmp/bard-standalone-validation/application`; launched with a temporary working directory outside the repository. `app.isPackaged`, ASAR location and file-based renderer URL checked. No Vite process needed.    |
| Offline core behaviour                                        | Passed in the desktop journey       | Renderer marked offline; renderer HTTP and main-process fetch blocked. Profile/goals, lessons, completion, writing, autosave, snapshots, export, settings, history and restarts work. A physical Windows network disconnect remains a PC check. |
| Full learning loop                                            | Passed with a simulated provider    | Open → goals → lesson/reflection → main-process SDK feedback → revision with preserved earlier notes → transfer to Scriptorium → Songbook → restart → saved answer/revision/feedback. No paid API call was made.                                |
| Connection-test presentation                                  | Passed with simulated responses     | Success only for completed nonempty response; invalid key, model access and offline errors displayed clearly. Only `gpt-6-luna`; no substitutions or automatic retries.                                                                         |
| Key isolation and failure behaviour                           | Passed in portable tests            | Saved key excluded from renderer state; plaintext/unavailable keyring rejected; encryption failure keeps existing encrypted binding; decrypt failure asks for re-entry.                                                                         |
| Native Windows DPAPI automated test                           | **1 skipped on Linux**              | Included in the desktop suite; requires an actual Windows account. It checks encrypt-at-rest, restart/decryption and removal with a dummy key, without an API request.                                                                          |
| Windows NSIS compilation                                      | Passed                              | Custom NSIS script uses standard wizard pages, per-user installation, shortcuts/uninstall registration and a generated exact-file removal manifest. Writes its uninstaller during installation; does not require a Wine step at build time.     |
| Windows and Linux ASAR contents                               | Passed                              | Main, tutor, vault, preload, curriculum, index, icon and built assets match final source/build output byte-for-byte. Test fixtures/source test folders are excluded. Runtime package dependencies are OpenAI and Zod only.                      |
| Installer archive integrity                                   | Passed                              | 7-Zip tested the completed NSIS archive without errors. The Windows app executable and ASAR were also extracted from the installer and matched against the packaged payload.                                                                    |
| Formatting and lockfile consistency                           | Passed                              | Prettier check; `npm ci --dry-run --ignore-scripts`.                                                                                                                                                                                            |
| Windows installer execution / shortcuts / upgrade / uninstall | **Unrun**                           | No Windows machine is available in this task. Compile/archive checks do not establish native installer behaviour.                                                                                                                               |
| Live API and account/model availability                       | **Unrun**                           | No personal API key was configured for a real paid call here. Use Settings → Test AI Connection on Windows.                                                                                                                                     |
| Native accessibility, display scaling and Windows file locks  | **Unrun**                           | Requires PC checks, including normal Windows sandboxing. Linux CI alone uses the container-only `--no-sandbox` test flag; production launch does not add it.                                                                                    |
| Educational outcomes                                          | **Not yet evaluated with learners** | Originality comparison is limited to consulted source snapshots; teaching effectiveness and advanced timing require human/learner review.                                                                                                       |

## Fixes made during validation

- Lesson notes survive revision and restart, with the assessed source text retained so earlier notes are labelled clearly. Question text is no longer cleared by ordinary draft autosaves.
- Opening a lesson draft in the Scriptorium carries the student’s revised text instead of opening an empty project.
- A failed protective snapshot prevents restoring an earlier draft over unsaved work.
- First-run data-directory creation is explicit and a second process focuses the current profile instead of competing for its database.
- The API key uses OS-backed `safeStorage` (Windows DPAPI); no plaintext fallback. Encryption failures are sanitised and do not overwrite an earlier working key.
- The OpenAI endpoint and model are fixed; SDK logging and retries are disabled. Ambient IDE/shell API-endpoint settings cannot redirect the saved personal key.
- Settings includes the requested real, minimal **Test AI Connection** action with explicit confirmation, usage display and clear failure states. It sends no student passage/profile.
- Installer resources include the app icon and an English per-user wizard. Uninstall preserves personal user data and removes only shipped files/empty installation directories.
- Fifteen lessons were tightened for sequencing, examples and scope; all thirty IDs remain stable. Existing customised user curricula are preserved rather than overwritten.

The next release gate is the Windows acceptance checklist, especially native DPAPI after restart and a real GPT-6 Luna response. Those remain explicit validation tasks, not assumed successes.
