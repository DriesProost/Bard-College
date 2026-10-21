> Version 1.3.0 update: lessons now require a Professor introduction and review of the current draft. Session limits, clear daily steps, optional plain-language check-ins and the renamed new-exercise action are documented in [GUIDED_LESSONS_VALIDATION.md](GUIDED_LESSONS_VALIDATION.md). This supersedes earlier optional-AI completion behavior; the approved curriculum and historical progress are unchanged.

# Curriculum system — Phase 2

The shipped package now contains **38 Writing lessons**: all 30 original `lesson-*` IDs and eight `writing-*` extensions. Writing and Music are independent faculties. The first nine approved Music units are released, in their proposed order, with their objectives, readiness links and assessment principles. Historical lyrical “The Lute” events belong to Writing participation, never Music skill evidence.

The approved educational structure is documented in [WRITING_CURRICULUM.md](WRITING_CURRICULUM.md), [MUSIC_CURRICULUM.md](MUSIC_CURRICULUM.md), [LIBRARY_CATALOGUE.md](LIBRARY_CATALOGUE.md) and [CURRICULUM_GAP_ANALYSIS.md](CURRICULUM_GAP_ANALYSIS.md). These distinguish consulted prose, checked visual material, original design and unverified examples/audio. Music 10–36 and the seven shared studios remain proposals, not released lessons.

## Learning experience

Each lesson supplies an objective, explanation, original good/weaker contrast, achievable minimum task, optional resumable extension, criteria, short reflection, prerequisite/retrieval links, a fresh challenge and traceable source codes. The five-minute default is a practice allocation, not a guarantee of mastery or of writing a whole song. Larger revisions use existing work; an observation of a few words is sufficient for participation. Minimum text lengths detect an empty attempt, not quality.

Prerequisites are recommendations: learners may practise ahead or revisit a skill without a rigid completion lock. Original completion dates, drafts and XP remain visible even when new lessons are inserted earlier in the recommended route. A content change suggests practice without revoking completion.

Participation (attempts, completed practices and XP) and criterion evidence are separate. The learner can record introduced, tried-with-support, independently demonstrated or retained evidence. All current reports are explicitly **self-reported**, linked to their exact draft, reflection, prompt and content version. AI feedback does not automatically award a level. A retained report requires an earlier independent/retained report at that version plus different work on the designated fresh challenge; this is an evidence safeguard, not proof that learning occurred.

Earlier attempt versions and their feedback/source metadata are retained in local history when a saved draft changes. A fresh challenge starts a separate attempt in that history; a prior version can be restored. Criterion reports are append-only and survive subsequent revisions; prior-version reports remain visible but are excluded from current-version evidence counts. Review reminders use the existing adjustable 1/3/7/14-day design, not a validated learning-science claim.

## Data-only curriculum packages

`curriculum/lessons.json` is schema version 2. It contains lesson data and a minimal source registry; the renderer does not hard-code the lesson list. Faculty, stable ID, content version, stage, objective, explanation, contrasts, minimum/extended/fresh tasks, criteria, dependencies, review links, timing and source IDs are validated at load time. Graph checks reject missing references, cycles and cross-faculty required skills. The 30 deployed lyrical IDs cannot be moved to Music. Music examples optionally carry a validated `musicExample` timed sketch; they are data, independent of the editor. Standard staff engraving is not included.

`curriculum/legacy-v1.json` is the exact previously shipped baseline, used only to recognise an unmodified installed curriculum. Version 1 custom files remain readable through the adapter. Never overwrite a user's modified curriculum automatically.

On a fresh installation the app copies the new defaults. An exact pristine version 1 or Phase 1 default file is backed up and upgraded (JSON object-key order does not affect recognition). `legacy-phase1-v2.json` preserves that trusted baseline. Any other custom file is left intact: Settings provides a preview, allows selecting individual shipped replacements, and can add the missing new lessons while retaining unselected content and custom IDs. A recovery copy is written before applying a validated candidate. Unknown custom citations are labelled unverified rather than given invented authority. Unsupported schema versions and invalid graphs stop loading with an explanation; no reset to default occurs.

Installed content is stored in the app user-data `curriculum.json`. After a previewed merge the app reloads the package without rebuilding. Editing that local file while the app is closed also remains supported. Shipped-default edits require rebuilding the app package, but no React/Electron changes are necessary for lesson text or additions. Preserve stable IDs, increment content versions when semantics/criteria change, and validate the source scope manually as well as structurally.

## Data and recovery

The additive SQLite migration creates faculty attribution, content/prompt metadata, attempt history and criterion-evidence tables. Before changing an existing database it makes a consistent SQLite `VACUUM INTO` recovery copy, including committed data still in the WAL. Schema changes run in a transaction; a failure rolls them back. A migration ledger/version makes restart idempotent. Backup creation failure stops the upgrade. Existing projects, snapshots, settings, ciphertext, attempt fields, XP and completion dates are preserved. Unknown legacy events retain an unassigned attribution instead of being guessed into Music.

Settings shows the most recent recovery paths. Recovery is manual in Phase 1: close all app instances, preserve the entire current user-data folder (including any WAL/SHM files), then restore the selected backup into a clean copy of that folder. A pre-migration database backup can be opened by the current app and migrated again. Do not replace an open database, ignore its WAL, or remove your only copy. The books are never needed to open drafts or practise offline.

## Musical documents and recordings

Musical attempts use the existing body/revision/history/evidence fields as validated `bard-music-v1` JSON. No database schema migration is needed for Phase 2. Each sketch has a stable UUID, intent, optional self-reported observation, quarter-note tempo and up to two monophonic phrases of one or two bars. Notes specify high-to-low string index, fret, attack slot and duration in integer eighth notes. Missing slots mean explicit rests. Validation rejects overlapping notes, unsupported tunings/capos, out-of-range frets and notes crossing bar lines. Completion needs an intention, at least one documented note, and a brief reflection; it records participation only. The rubric still asks for the lesson-specific alternatives/comparisons. An example loaded unchanged is not independent creative evidence.

`src/shared/music.ts` owns tuning/pitch/rhythm validation and accessible document formatting. The Music editor supports counted 4/4, 3/4 and 6/8, keyboard entry, synthetic reference playback, optional C/Am chord-reference diagrams, and text alternatives. In 6/8, the displayed quarter-note tempo is converted explicitly to a dotted-quarter pulse; 3+3 grouping is distinct from 3/4's 2+2+2. Silence/holds are represented independently of attacks. Standard staff engraving, polyphony, ties across bars and audio analysis are outside this foundation editor.

Local recordings are stored in `recordings/` under the user profile as generated UUID `.webm` audio files and small `.json` manifests. Metadata links a lesson and saved sketch UUID; attempts/history preserve the sketch identity. Main validates the link before saving. Only fixed bounded IPC operations are exposed, never caller-chosen filesystem paths. Blob URLs allow local playback under CSP without renderer networking. Recording requires an explicit action, trusted main frame and audio-only permission. A two-minute limit, per-take limit and total quota bound capture/storage. Denial, missing/busy device, empty capture, save errors and playback errors have messages. A failed save keeps its bytes in memory for retry/discard; an ordinary close waits for capture/save. Sudden process/power loss can lose an in-progress take. Invalid/missing recording manifests are ignored, not automatically deleted. Audio files need the whole-profile backup; SQLite recovery copies alone do not include audio.

## AI and source integrity

Only GPT-6 Luna is used. The tutor receives the selected original lesson principle/objective/minimum or fresh task, criteria, chosen work and necessary learner context. It respects intent and contextual judgments, makes no numerical mastery assignment and explicitly distinguishes a text document from listening self-report. No audio is heard or assessed. Earlier feedback is retained with its source text/version, and a stale response cannot overwrite a different draft/content version.

Only minimal bibliographic references and original instructional content ship. The private reference books, extracted text, notation images, audio access codes and research notes remain outside the repository/build. Automatic book retrieval is not implemented. A separate approved design would be required before transmitting private reference excerpts or evaluating audio.

## Validation

See [PHASE2_VALIDATION.md](PHASE2_VALIDATION.md) for actual checks, failures corrected and remaining native Windows/learner-validation limits. The approved proposal documents describe future phases as well as Phase 1; this file describes the implemented boundary through Music lesson 9.
