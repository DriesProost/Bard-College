# Bard’s College

A local-first Windows desktop college for poetry and songwriting. Electron, React, TypeScript, Vite, Tailwind CSS, SQLite and the official OpenAI JavaScript SDK. Writing, saved work, lesson browsing, progress and saved feedback remain local. Lessons now start with the Professor and require AI feedback to finish. The Professor requires your own API key and access to **`gpt-6-luna`**; there is no model fallback.

## Download

[Download the repository ZIP](https://github.com/DriesProost/Bard-College/archive/refs/heads/main.zip), extract it, and follow [the Windows instructions](downloads/windows/README.md). The installer is included in three parts with a checksum-verifying helper. No development tools are needed to install.

## Install on Windows

Use `release/Bards-College-Setup-1.4.0-x64.exe` on Windows 10/11 x64. The installed application is self-contained: **no VS Code, Node.js, Git or development server is required; local writing and saved recordings work offline, while new lesson introductions and reviews require the API**. AI needs a connection and your own API key. The installer is unsigned; see [WINDOWS_VALIDATION.md](WINDOWS_VALIDATION.md) for installation, key protection and the PC acceptance check.

For development, install Node.js 24 LTS and Git, clone the repository, then run `npm ci` and `npm run dev`. Main-process edits need a restart. Use `npm run build` followed by `npm start` to run the production application from source. Run `npm run dist:win` to produce the NSIS installer in `release/` (normal Windows builds do not need Wine). The supported custom NSIS script generates its unsigned uninstaller at installation time; the exact-file removal manifest preserves unrelated files and personal user data. Only English installer strings are configured.

All dependency versions are recorded in `package-lock.json`. Electron and packaging assets are downloaded from their official distribution endpoints with checksum/TLS verification. Corporate proxies must trust their certificates normally. Do not disable TLS or checksum checks.

## A first visit

Enter your name, interests, genres, experience, preferred form and daily goal. The Great Hall shows a clear five-minute task for the chosen faculty. Start with the Professor’s introduction, make a small attempt, get feedback and finish when you have the teacher’s review. One review is enough; at most two follow-ups are available per session. Completion does not require praise or prove mastery. The Academy has 38 Writing lessons and nine Music foundations; prerequisite links recommend skills without locking one faculty behind the other. The dashboard also suggests spaced revisits after 1, 3, 7 and 14 days; missing a day does not remove progress.

The Scriptorium supports plain text and Markdown source, named song sections, autosave, optional line numbers, approximate **English** syllable counts, manual revision snapshots, completion markers, focus mode and Markdown/plain-text export. This is intentionally a multiline Markdown editor rather than a WYSIWYG document editor. Save a snapshot before an experiment; restoring a draft preserves the current version first. Ctrl/⌘ S saves. Escape leaves focus mode. The Songbook searches titles and text and filters completed pieces. Deleting a piece also deletes its snapshots; the confirmation explains this.

## The Professor and your key

Open Settings and enter your own OpenAI API key. The key is encrypted using Electron `safeStorage`: Windows uses DPAPI, macOS Keychain-backed encryption, and supported Linux keyrings. The app **refuses** to save/use keys with an unavailable keyring or Linux `basic_text` fallback. The encrypted bytes are stored in the local SQLite config table. The saved key is never returned to the renderer, exported or logged. The API endpoint is fixed to `https://api.openai.com/v1` and SDK logging is explicitly off, so unrelated IDE/shell endpoint or debug-log settings cannot redirect this key or enable request logging. The Settings password input necessarily holds a newly typed key until it is saved; the input is then cleared. Removing the key removes the encrypted binding. In Windows Settings the protection is identified as Windows DPAPI. **Test AI Connection** sends one real, minimal GPT-6 Luna request when clicked, reports success or a clear account/network error, and records its available usage. It sends no writing or profile. A missing/invalid key or incomplete response is never reported as a successful connection.

Calls originate only in the Electron main process using `responses.parse` for feedback and `responses.create` for the minimal connection test, a validated JSON schema, `store: false`, a 45-second timeout and no automatic retries. The only model constant is in `electron/tutor.ts`. Model availability depends on your account. Authentication, unavailable-model/access, quota, rate-limit, connection and provider errors have user-facing messages; they never cause a model substitution. A refusal/incomplete response does not fabricate feedback. Available usage is still recorded for incomplete responses. Provider errors without usage cannot be metered locally.

Only the selected original lesson context, submitted passage or readable counted musical plan, optional question/previous feedback, relevant lesson/rubric and learning-profile context are sent. Recording bytes, filenames and file paths are never included. Requests begin from lesson/review buttons; they do not need repeated confirmation. Routine feedback explains a strength and one or two next steps without rewriting the work. A text-only tutor cannot verify actual singing, chords or delivery.

Request confirmation popups are disabled, including for existing profiles. A lesson has one introduction and at most three reviews per session. Enter **current prices from your account's published GPT-6 Luna pricing** in Settings if you want USD estimates. No price is invented. Budget warnings and estimates are advisory, local and approximate; they are not hard billing limits and do not include other clients or account activity. Cached-input pricing and other billing details can differ. Settings indicates when prices are missing; no price is invented.

## Data, backup and curriculum editing

The user-data folder is normally `%APPDATA%\bards-college` on Windows, `~/Library/Application Support/bards-college` on macOS, or `$XDG_CONFIG_HOME/bards-college` / `~/.config/bards-college` on Linux. The authoritative path is Electron's `app.getPath('userData')`. Close the app before copying the **whole folder**, including `college.sqlite`, any WAL/SHM files, `curriculum.json`, and the entire `recordings/` directory (audio plus JSON manifests). Portable writing exports contain only the title and text. The key is OS-account-bound; re-enter it after moving a backup to another machine/user.

The current package retains all 38 Writing lessons unchanged and the approved first nine Music lessons. Music offers keyboard-editable six-string tab, counted rhythm in 4/4, 3/4 and 6/8, synthetic playback, and local microphone capture/playback. Participation and self-reported criterion evidence remain separate in each faculty. GPT-6 Luna remains the only AI model. Music 10–36 and shared studios are deferred.

`curriculum/lessons.json` is a validated data-only schema v2 package; legacy v1 custom files remain readable. A pristine old curriculum is backed up and upgraded automatically; custom versions are left intact until a per-lesson merge preview in Settings is applied. No books or extracted source material are shipped. Lesson dependencies are skill recommendations, not a global completion lock; the two faculty graphs are independent. Installed file edits still work while the app is closed.

The additive SQLite migration makes a consistent pre-change recovery copy (including WAL data) and preserves drafts, revisions, feedback, snapshots, completion dates, settings, ciphertext and XP. Earlier attempt versions and skill reports remain accessible; old lyrical Lute work grants no Music evidence. Completion records participation, not mastery. See [CURRICULUM.md](CURRICULUM.md) for source/assessment/content maintenance and [GUIDED_LESSONS_VALIDATION.md](GUIDED_LESSONS_VALIDATION.md) for current behavior and checks.

## Architecture and security

- `electron/main.ts`: desktop lifecycle, validated and sender-checked IPC, OS-backed key encryption, native export dialogs. Context isolation and renderer sandboxing are on; Node integration is off. New windows, untrusted navigation and unrelated permissions are blocked. Audio-only microphone access is limited to the trusted main frame after an explicit recording action. Production CSP disallows renderer network access.
- `electron/preload.cts`: a fixed, minimal bridge; no generic IPC, filesystem or credential access. Save-on-close coordinates pending renderer saves before closing.
- `electron/store.ts`: parameterised SQLite persistence, transactions, draft history and idempotent activity milestones.
- `electron/tutor.ts`: fixed model, Responses API, rubric context, validated feedback, spending checks and sanitised errors.
- `src/shared/`: validated data contracts, curriculum schema, progression and approximate language helpers.
- `src/`: React views and responsive parchment/forest design. Reduced motion respects OS preferences and an app setting; native dialogs trap focus.

Progress levels describe **practice**, not measured mastery. New completion requires a meaningful attempt, the Professor’s feedback on the current draft. AI approval, praise and a numerical score are never required. Milestones are idempotent, revision XP is bounded per piece/lesson, and revisiting a completed lesson awards at most five XP per lesson per day only after text and reflection change. This discourages meaningless toggling, but is not an anti-cheat system.

## Local guitar practice

Open The Academy → Music faculty. Each lesson provides a five-minute minimum, original comparison, practical example, optional extension and offline assessment criteria. Load the demonstration to explore it, then adapt it to your own musical intent. Choose a fret and duration and click a string/count cell; arrows navigate, digits enter frets 0–9, and Delete inserts a rest. The fret field supports 10–24. Each column is one eighth note; holds and rests are explicit. Standard tuning and no capo are the current scope. Sounding note names and accessible counted text accompany the tab; standard staff engraving is not included.

Once your lesson has started, use Record guitar to grant microphone access and capture up to two minutes. Stop and save creates a local WebM/Opus take linked to the lesson/sketch; Listen and Delete work offline after restart. Storage is capped at 200 takes / 256 MiB, with a 12 MiB limit per take. A failed save offers retry/discard. Recordings are ordinary private-profile files, not encrypted by the API-key vault. Copy the whole closed profile for backup. The professor has not heard the recordings and cannot assess performance, intonation or guitar comfort. Synthetic playback is a reference for the documented rhythm/pitches, not an imitation or evaluation of your playing.

## Simple lesson flow

Version 1.4.0 presents one column: **Explanation → Example → Your input → Teacher review → Done**. The teacher uses a short explanation and points to the supplied example; the input shows one concrete task. Edit the same answer box after feedback. Reflections are optional. Sources, extra practice, self-checks, earlier attempts and export sit under **More options**, away from the main flow. Existing lesson IDs, content, progress and drafts are preserved; earlier versions of an edited answer remain in attempt history. See [SIMPLE_LESSONS_VALIDATION.md](SIMPLE_LESSONS_VALIDATION.md).

## Guided daily lessons

Version 1.3.0 adds the requested AI-guided flow: the Professor introduces the approved task, reviews your attempt, and offers at most two follow-ups. Finish after one useful review if that is enough. The final review closes the conversation instead of asking another question. Limits persist after restart; starting another session is an explicit choice that preserves your work. Lessons need an API key/connection for introductions and new reviews; independent writing and saved recordings remain local.

The Great Hall shows one clear daily task and completion state for the chosen faculty. Optional self-checks explain each choice in ordinary language; they are not AI scores or a completion requirement. “Practise this skill with a new exercise” opens a fresh task while saving the earlier attempt. See [GUIDED_LESSONS_VALIDATION.md](GUIDED_LESSONS_VALIDATION.md).

## Validation

```powershell
npm run build
npm test
npm run test:desktop
```

The core tests use real SQLite files and cover persistence/reopen, literal SQL-like writing, snapshots/deletion, recommended skill dependencies/brief reflection, feedback source labels and preservation during revision, XP deduplication, streaks, curriculum integrity, model/schema/request safeguards and provider error mapping. OpenAI transport tests use a fake provider and incur no API charges. Desktop tests launch the actual production Electron app and exercise onboarding, lessons, autosave, snapshots (including failed-restore protection), native export, settings, renderer isolation and persistence over restart, including an immediate-close save. A second journey uses a simulated main-process HTTP provider and test-only cipher to exercise the real IPC/SDK/UI feedback–revision–Songbook flow and connection status messages. This does not substitute for a live API call or DPAPI verification. A separate native DPAPI test is included for Windows and skipped on Linux. The suite can target a relocated packaged executable with BARD_PACKAGED_EXECUTABLE.

On a Linux CI machine provide Xvfb and `DISPLAY`; this cloud's desktop test uses `--no-sandbox` solely because the container cannot supply the Chromium OS sandbox. **The normal application launch does not disable it.** Windows test runs use the normal desktop session. The test flag does not change the application's context isolation, preload bridge or Node-integration settings.

Verified in the provided Linux cloud: TypeScript/production build, core automated tests and actual Electron workflow under a virtual display. The Windows installer is cross-built here. Windows installer execution, Windows DPAPI behaviour and live GPT-6 Luna access require separate Windows/account validation. The packaged Linux application is also validated from a separate directory without Vite or repository runtime dependencies. See [WINDOWS_VALIDATION.md](WINDOWS_VALIDATION.md). This does not claim a model exists on every API account. No API key or credits were supplied for a paid end-to-end call. Educational outcomes require learner testing; the app is a researched teaching foundation, not a validated guarantee of improvement.
