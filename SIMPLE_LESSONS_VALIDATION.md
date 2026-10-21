# Simple lessons — version 1.4.0

The lesson page now follows the requested sequence in one column: **Explanation → Example → Your input → Teacher review → Done**.

The teacher’s explanation appears once, followed by the original example and a short pointer to what it demonstrates. The input states the approved minimum task directly and offers one first step. Teacher instructions require everyday wording, definitions for unfamiliar terms, one concrete action and a small output; they prohibit replacing/enlarging the approved task or adding a required reflection. Saved introductions from previous sessions are preserved; newly prepared introductions use the updated instructions.

There is one answer editor. Learners revise there after feedback rather than finding a second revision panel. Saving an edit preserves the previous attempt in history; older body/revision records remain readable and restorable. Empty edits save correctly rather than restoring the original implicitly. “Finish practice” follows the teacher review. No personal reflection or self-check is required to finish. A reflection remains available under More options for learners who want one; optional skill evidence still needs an actual observation and draft, as before.

**More options** contains the manual save button, personal note, expanded explanation/assessment points, optional longer work, new exercise action, self-checks, earlier attempts, source/verification references and the existing writing-desk export action. These are collapsed by default. The 38 Writing lessons, nine Music lessons, all deployed IDs, approved objectives/criteria and independent faculty progress are unchanged. Guitar editing, recording/playback, history and local privacy protections remain available. The three-review limit, GPT-6 Luna exclusivity and current-draft review requirement remain enforced. No later curriculum phases or audio analysis were added.

## Verification

- Production TypeScript/Electron/Vite build passed.
- **44 unit tests passed**, including session limits, current-draft completion, optional reflection without invented student text, Music calculations, existing SQLite data/history/evidence and credential protections.
- **Five source desktop journeys passed**, with the native Windows DPAPI test skipped on Linux. New checks verify the five section headings in order and that optional self-checks are hidden initially. The teacher journey finishes with no reflection, edits the same answer field and recovers original work from history after restart. Existing migration/custom-content and Music recording/restart journeys also pass.
- AI transport/cipher fixtures and the microphone input in desktop tests are simulated. No paid live API request or native Windows hardware test was performed. A simpler layout and automated checks are not evidence of educational effectiveness; user/learner testing remains necessary.

The earlier versioned validation reports are historical. Where they describe a required reflection or separate revision editor, this version supersedes that behavior. Native Windows install/upgrade/uninstall, DPAPI, microphone permissions and real guitar/interface checks remain necessary as described in the existing Windows acceptance checklist.

## Release check

The relocated packaged application also passed all **five desktop journeys**, with the Windows-only DPAPI test skipped. It ran from `/tmp/bard-simple-standalone` outside the repository without a development server. Windows and Linux ASAR checks confirmed the shipped modules and unchanged lesson objects, and excluded private books, recordings and test fixtures. The 1.4.0 Windows installer passed archive-integrity checks. It is unsigned and has not been executed on Windows here.

Installer size: 140,693,197 bytes. SHA-256: `9bedf33b750b5aa9333df89181dc5cf21b840f47f90e0ba7bd07cebaecac9afd`. The GitHub download provides three parts with a checksum-verifying assembly helper. Reconstruction was checked against this hash; the Windows helper itself still needs native Windows execution.
