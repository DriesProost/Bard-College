# Guided lessons — version 1.3.0

This update follows the user’s request for lessons that always use the Professor, without a confirmation before every request. It supersedes the optional-AI lesson-completion behavior documented in earlier release reports. The approved 38 Writing lessons and first nine Music lessons, their IDs/objectives/criteria, student projects and progress are preserved. No later curriculum phases were added.

## Behavior

- Starting a lesson obtains a real, structured GPT-6 Luna introduction to the installed objective and minimum/fresh task. The Professor explains what to notice, one first step and a small finish line; instructions prohibit inventing a replacement exercise or writing the student’s answer. An unavailable API/key leaves the lesson unstarted and saved work intact. Cached introductions can be resumed without another paid introduction; drafting and independent local recording/playback remain available for an already started lesson.
- Each session has **one initial review and up to two follow-ups**. The limit is stored locally and enforced in the main process before any network call. Navigating or restarting the application does not reset it. The last review is instructed to close with a next step, not another question. A failed/refused response can be retried and does not count as a successful review; any returned token usage is still recorded. There are no automatic retries.
- “Finish practice” requires an introduction, feedback on the current draft and a brief student observation. It does not require AI praise or approval, a numerical score, or a self-check. Changed drafts need a new review. When the limit is reached, finish the reviewed work or explicitly start another session. A new session preserves the draft and previous session records; it is never silently started to extend a conversation. Existing completion dates and evidence are retained rather than retroactively revoked.
- The daily card is the main action in the Great Hall. It shows the selected faculty, actual minimum task, four steps (meet Professor, make an attempt, get feedback, finish) and a clear completed-for-today state. Writing and Music remain independent. Longer work remains optional.
- Self-reviews are an optional check-in, separate from the Professor’s feedback and from completion. Plain-language choices explain recognising an idea, doing it with help, choosing independently and using it in a new exercise. “Not sure yet / skip” is valid. Definitions and an example explain that receiving feedback afterwards does not itself make an independently chosen detail “with help”. Transfer still requires a prior independent report and different work in the new exercise; Music cannot demonstrate transfer by changing only its UUID or observation.
- “Practise this skill with a new exercise” replaces the unexplained unfamiliar-challenge checkbox. Its explanation says that it opens a fresh draft while keeping earlier work in attempt history. Returning to the original exercise is explicit. The Professor introduces the selected task; no faculty or skill mastery is granted by toggling exercises.
- Review and connection-test buttons submit directly, without repeated API notices or confirmation modals. Old `confirmRequests: true` settings are treated as disabled. Settings explains the request policy, usage and advisory budget. Budget estimates are not billing caps. The key remains OS-protected, GPT-6 Luna remains exclusive, and recordings/books are never uploaded.

## Storage and compatibility

Session introductions, review counts, reviewed drafts, feedback, timestamps and completion use versioned local session documents in the existing SQLite configuration store. This adds no database schema migration and does not rewrite existing project/attempt/evidence tables. Old session records are retained; active and today’s sessions are loaded for navigation/progress. Draft autosave, attempt history and close-time recording protection remain in place. Back up the whole closed profile, including recordings and SQLite WAL/SHM files when present. Do not use an older application to modify a live updated profile.

## Validation

- Production TypeScript/Electron/Vite build passed.
- **44 unit tests passed**, including current-draft/version/prompt completion guards, persisted review caps, explicit session restart without losing records, independent daily faculty states, fixed-model guided introductions, final-turn closing instructions, old confirmation preferences and self-check definitions.
- **Five production desktop journeys passed; one native Windows DPAPI test was skipped on Linux.** They cover offline writing/project persistence, AI-only lesson start/completion, a three-review conversation and blocked fourth request, clear daily completion, legacy Writing data and new-exercise preservation, credential/connection wiring, and Music tab/recording/revision/restart functionality.
- Provider and OS cipher fixtures are simulated. Chromium recording uses a simulated microphone. This is not proof of live GPT-6 Luna account access, native Windows DPAPI or real acoustic input quality.

Windows install/update/uninstall, DPAPI, microphone privacy settings and actual guitar/interface playback still require the native PC acceptance checks in [PHASE2_VALIDATION.md](PHASE2_VALIDATION.md). Staff engraving and AI audio assessment are not implemented. Neither app completion nor AI feedback establishes educational effectiveness.

A startup save-handshake race found during testing was fixed: an immediate close before the renderer can accept edits no longer waits for a save listener that has not been registered. Normal closes still flush pending drafts and recordings.

## Packaged release check

The relocated packaged Linux application passed the same **five desktop journeys**, with the native Windows DPAPI test skipped. It ran from `/tmp/bard-guided-standalone` outside the repository without a development server. Windows and Linux ASAR checks confirmed 38 unchanged Writing lesson objects, nine Music lessons, exact shipped source-build modules, and no private books, recordings or test fixtures. The unsigned 1.3.0 Windows installer passed archive-integrity checks; its 140,693,345 bytes have SHA-256 `36cb60a39ceaba213b59a1a82edd4cfc0602c4d14058e6d16bc29159ceb1ba98`.

The GitHub download contains three installer parts and `Assemble-Windows-Installer.cmd`; joining those parts was checked against the built installer hash. Execution of that Windows helper and native Windows installation still require a Windows PC. The helper does not run the installer automatically or change system security settings.
