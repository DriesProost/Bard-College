# Phase 1 results — version 1.1.0, 20 October 2026

Phase 1 is implemented. **Phase 2 has not started.** This report distinguishes tests performed in the Linux cloud from Windows/account/learner checks still required.

## Implemented boundary

- Independent Writing and Music faculty navigation and progress summaries. The shipped release has **38 Writing lessons, zero Music lessons**; Music is an honest Phase 2 placeholder, with no credit inherited from lyrical lessons.
- All 30 original `lesson-*` IDs retained. Eight new units cover near rhyme, metrical variation, symbolism, form choice, ballad scenes, satire, voice and independent transfer. Every existing explanation and criterion set was revised, with content versions incremented. Lesson 18 explicitly teaches language tension rather than awarding harmonic competence.
- Each lesson has a short minimum task, optional resumable extension, original strong/weaker contrast, brief observation, source scope and unfamiliar challenge. Existing work can be used for larger revision tasks; the application does not require writing a complete song in five minutes.
- Participation/XP/completion dates are preserved separately from append-only, draft-linked criterion reports. Introduced/supported/independent/retained reports are explicitly self-reported. Retained reports require a prior independent/retained record at the same version and different work on the designated challenge. These checks do not certify mastery or educational effectiveness. AI does not assign levels.
- Local attempt history preserves original/revised text, observations, prompt, content version, completion and saved-feedback metadata before changes. Earlier drafts can be inspected/restored; current work is protected by a history entry when it changes.
- Consistent pre-migration SQLite recovery copy, additive transactional migration, version ledger and idempotent restart. Existing projects, snapshots, profile, settings, encrypted-key binding, attempt text/revision/feedback and XP survive. Unknown historical events remain unassigned rather than becoming Music credit.
- Data-only curriculum schema v2 with v1 custom-file compatibility, stable IDs, source validation, acyclic dependencies and independent faculty graphs. Pristine legacy defaults upgrade after backup. Custom files stay unchanged until a per-lesson merge preview is applied; selected versions replace content, unselected custom versions/IDs are retained and new lessons are added. Prior custom conflicts remain available for later reconsideration.
- GPT-6 Luna remains exclusive. Requests include the actual selected minimum/fresh task and criteria. The tutor preserves intent, distinguishes documentary evidence from self-report and makes no claim to hear audio. Books, extracts, source images and access codes remain private, outside the repository and excluded from app packaging.

No music lessons, musical editor, recording/playback or AI audio assessment is implemented in Phase 1. The existing permission handler still denies renderer permissions, including microphone access; Phase 2 must introduce its explicitly scoped local-recording permission design and test it on Windows. This is intentional, not an assertion that recording already works.

## Checks executed

| Check                                                   | Actual result                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production TypeScript/Vite/Electron build               | Passed (`npm run build`).                                                                                                                                                                                                          |
| Real SQLite and core/content/migration/tutor unit tests | **30 passed** (`npm test`).                                                                                                                                                                                                        |
| Source desktop journeys in production mode              | **4 passed, 1 Windows-only test skipped** under Xvfb.                                                                                                                                                                              |
| Relocated packaged Linux application                    | Same **4 journeys passed**, same Windows-only skip, using `/tmp/bard-phase1-standalone/bards-college` outside the repository, temporary working directory, `app.isPackaged`/ASAR/file-URL checks and no Vite server.               |
| Core offline journey                                    | Renderer offline plus blocked main/renderer networking; writing, saving, revisions, settings, snapshots, export and restart pass. AI-provider journey uses a test-only simulated transport/cipher, not a paid account.             |
| Legacy upgrade desktop journey                          | Pristine old curriculum becomes 38 lessons; old lyrical completion/project retained; Music participation/evidence remain zero; a new Writing unit, independent/retained reports, fresh attempt history and restart pass.           |
| Custom-content desktop journey                          | Old custom curriculum remains 30 lessons until explicit merge; adding eight retains the edited explanation and creates recovery copy.                                                                                              |
| Database preservation and recovery                      | WAL data included in backup; restored backup opens/migrates and retains project, completion and feedback. Snapshot/profile/settings/ciphertext/XP preservation, rollback after failed schema migration and idempotent reopen pass. |
| Content failure handling                                | Unknown schema versions do not overwrite files; recovery-copy failure stops upgrade; unknown custom sources are retained with unverified scope; graph cycles and cross-faculty required dependencies rejected.                     |
| Evidence safeguards                                     | Completion grants no evidence; duplicate report deduplication; transactional rollback of an invalid report batch; retained-work prerequisites; version-specific counts; no Music attribution from historical Lute events.          |
| AI boundaries                                           | Fixed `gpt-6-luna`/official endpoint, minimal connection test, real SDK request shape through fixture, criterion IDs/fresh prompt, intent/performance limitations and no source-extract payload.                                   |
| Packaged content                                        | Both Windows/Linux ASARs contain 38 Writing lessons and match current main/store/content/tutor/default/legacy files byte-for-byte. Neither contains private PDF/EPUB/MOBI/AZW3/ZIP files, private-library paths or test fixtures.  |
| Formatting and whitespace                               | Prettier checks passed; `git diff --check` passed.                                                                                                                                                                                 |

Linux desktop test launches use `--no-sandbox` only because the cloud runner lacks sandbox support. Production/Windows launch configuration remains sandboxed. OS encryption mocks are confined to tests and are not bundled.

The desktop tests caught an asynchronous controlled-checkbox issue when starting a fresh challenge; the UI now updates its checked state immediately, saves the earlier attempt and then clears the new draft. The regression journey passes. Earlier assertions for the old 30-lesson count and mandatory sequential completion were updated to the approved 38-lesson, recommendation-based design, rather than masking an unexpected regression.

## Windows artefact

`release/Bards-College-Setup-1.1.0-x64.exe` was cross-built with electron-builder/NSIS. It is **unsigned**, 140,653,962 bytes (approximately 135 MiB). SHA-256:

```text
1ff73e85034f24c1a386ec7920056a1831914d5b479d7b86c6606af3ee99c25c
```

The sidecar `.sha256` and `release/phase1-package-verification.json` record the artefact and package checks. The installer was checked with 7-Zip archive testing and SHA-256 verification; neither is execution on Windows. The existing installer preserves personal app data during uninstall. The previous version 1.0.0 installer/report remain historical, not the Phase 1 build.

## Still requires a Windows PC / account / educator

1. Install/update 1.1.0 on Windows 10/11 x64; launch independently of VS Code/Node; verify file locking, backup paths (including spaces/non-ASCII names), curriculum merge and restart on a copied real legacy profile. Confirm uninstall preserves personal data.
2. Run the included native DPAPI restart/removal test in a real Windows user session. Linux cipher fixtures do not validate DPAPI.
3. Enter the key locally and use Test AI Connection for an actual minimal GPT-6 Luna call. No personal key or paid live request was available here. Verify feedback with the account's actual model access.
4. Perform keyboard/screen-reader checks with Windows assistive tooling. Diagram/music/microphone validation belongs to Phase 2 and was not performed or claimed.
5. Trial lessons with learners and educators, especially the five-minute integration tasks and transfer prompts. Self-report and AI feedback are not evidence that learning outcomes have improved.

## Stop point

Review Phase 1 before beginning Phase 2. The approved Music plan remains 36 lessons, beginning with the first nine as a separately validated usable composition experience. Its local audio controls and permissions require implementation and native testing in that next phase; no AI audio assessment is authorised.
