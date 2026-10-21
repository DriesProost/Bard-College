import { evidenceOptions } from "./shared/tutoring";
import { musicText } from "./shared/music";
import { useState } from "react";
import {
  faculties,
  criterionId,
  type Faculty,
  type Lesson,
} from "./shared/curriculum";
import { facultyProgress } from "./shared/progression";
import type { State, EvidenceLevel } from "./shared/model";

export function FacultySummary({ state }: { state: State }) {
  return (
    <div className="faculty-summaries">
      {faculties.map((f) => {
        const p = facultyProgress(state, f.id);
        return (
          <section
            key={f.id}
            className="faculty-summary"
            aria-label={`${f.label} progress`}
          >
            <h3>{f.label}</h3>
            <p>
              {p.completed} / {p.total} practices completed · {p.xp}{" "}
              participation XP
            </p>
            <p>{p.participation} lessons attempted</p>
            <p>
              {p.introduced} introduced · {p.supported} with support
            </p>
            <p>
              {p.independent} independent · {p.retained} retained criterion
              reports
            </p>
            <small>
              Self-reported evidence, not certified mastery.{" "}
              {p.total === 0
                ? "No Music lessons released in Phase 1."
                : "Old completion does not establish skill."}
            </small>
          </section>
        );
      })}
    </div>
  );
}
export function FacultyAcademy({
  state,
  faculty,
  onFaculty,
  onLearn,
  onSettings,
}: {
  state: State;
  faculty: Faculty;
  onFaculty: (f: Faculty) => void;
  onLearn: (id?: string) => void;
  onSettings: () => void;
}) {
  const current = faculties.find((f) => f.id === faculty)!;
  const path = state.curriculum.filter((l) => l.faculty === faculty),
    p = facultyProgress(state, faculty);
  return (
    <>
      <div className="faculty-picker" role="group" aria-label="Choose faculty">
        {faculties.map((f) => (
          <button
            className={f.id === faculty ? "primary" : "secondary"}
            aria-pressed={f.id === faculty}
            key={f.id}
            onClick={() => onFaculty(f.id)}
          >
            {f.label} faculty
          </button>
        ))}
      </div>
      <h1>{current.name}</h1>
      <p>{current.description}</p>
      <FacultySummary state={state} />
      {state.contentUpdate && (
        <div className="review-reminder">
          <p>
            A curriculum update is available. Your custom lessons are unchanged.
          </p>
          <button className="secondary" onClick={onSettings}>
            Review curriculum update
          </button>
        </div>
      )}
      {!path.length ? (
        <section className="paper-card">
          <h2>Music foundations are next</h2>
          <p>
            This independent faculty is ready for Phase 2. Writing and lyrical
            lessons award no Music skill evidence. Your Writing path is
            available at any time.
          </p>
        </section>
      ) : (
        <>
          <div className="academy-progress">
            <div>
              <strong>
                {p.completed} of {path.length} practices completed
              </strong>
              <progress max={path.length} value={p.completed} />
              <p>
                Completion records participation. Evidence is reviewed
                separately.
              </p>
            </div>
            <button className="primary" onClick={() => onLearn()}>
              Continue learning
            </button>
          </div>
          <div className="lesson-grid">
            {path.map((l, i) => {
              const attempt = state.attempts.find((a) => a.lessonId === l.id),
                complete = !!attempt?.completedAt;
              return (
                <button
                  key={l.id}
                  className={"curriculum-card " + (complete ? "complete" : "")}
                  onClick={() => onLearn(l.id)}
                >
                  <div className="card-top">
                    <span>LESSON {String(i + 1).padStart(2, "0")}</span>
                    <span>
                      {complete ? "Practice completed" : "Try this skill"}
                    </span>
                  </div>
                  <div className="eyebrow">{l.stage}</div>
                  <h2>{l.title}</h2>
                  <p>{l.objective}</p>
                  <div className="card-foot">
                    5 MINIMUM · OPTIONAL EXTENSION
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
export function ContentUpdatePanel({
  state,
  refresh,
  fail,
}: {
  state: State;
  refresh: () => Promise<State>;
  fail: (e: unknown) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  async function apply() {
    setBusy(true);
    try {
      await window.bard.applyCurriculumUpdate(selected);
      await refresh();
      setSelected([]);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="paper-card content-update">
      <h2>Curriculum and recovery copies</h2>
      <p>
        Your saved writing and progress are preserved when lesson content
        changes. Books remain private and are not installed.
      </p>
      {state.backups.database && (
        <p>
          Database recovery copy: <code>{state.backups.database}</code>
        </p>
      )}
      {state.backups.curriculum && (
        <p>
          Curriculum recovery copy: <code>{state.backups.curriculum}</code>
        </p>
      )}
      {state.contentUpdate ? (
        <>
          <p>
            {state.contentUpdate.added} new lessons can be added. Keep your
            current versions unless you select a replacement below. Applying
            saves a recovery copy first.
          </p>
          <details>
            <summary>
              Review {state.contentUpdate.conflicts.length} lesson differences
            </summary>
            {state.contentUpdate.conflicts.map((c) => (
              <label className="merge-choice" key={c.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, c.id]
                        : s.filter((id) => id !== c.id),
                    )
                  }
                />
                <span>
                  Use revised {c.title}
                  <small>Current: {c.currentObjective}</small>
                  <small>Proposed: {c.proposedObjective}</small>
                </span>
              </label>
            ))}
          </details>
          <button className="secondary" disabled={busy} onClick={apply}>
            {busy
              ? "Saving recovery copy…"
              : "Add new lessons and apply selected revisions"}
          </button>
          <p className="hint">
            Unselected custom versions remain intact. Leaving this panel keeps
            your curriculum unchanged.
          </p>
        </>
      ) : (
        <p>
          Curriculum is up to date. Existing lesson IDs and participation
          history are retained.
        </p>
      )}
    </section>
  );
}
const labels = Object.fromEntries(
  Object.entries(evidenceOptions).map(([key, value]) => [key, value.label]),
) as Record<EvidenceLevel, string>;
export function EvidencePanel({
  lesson,
  state,
  beforeSave,
  refresh,
  fail,
}: {
  lesson: Lesson;
  state: State;
  beforeSave: () => Promise<boolean>;
  refresh: () => Promise<State>;
  fail: (e: unknown) => void;
}) {
  const [choices, setChoices] = useState<Record<string, EvidenceLevel | "">>(
      {},
    ),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const history = state.evidence.filter((e) => e.lessonId === lesson.id);
  async function record() {
    setBusy(true);
    try {
      if (!(await beforeSave())) return;
      await window.bard.recordEvidence({
        lessonId: lesson.id,
        criteria: Object.entries(choices)
          .filter(([, level]) => level)
          .map(([id, level]) => ({
            criterionId: id,
            level: level as EvidenceLevel,
          })),
      });
      await refresh();
      setNotice(
        "Self-assessment saved with this draft. Completion and AI feedback are not mastery judgments.",
      );
      setChoices({});
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="paper-card evidence-panel">
      <details>
        <summary>Optional check-in: how much help did you need?</summary>
        <h2>Your own check-in</h2>
        <p>
          This is separate from the Professor’s feedback. Think about each point
          below and choose what best describes how you made this draft. “Not
          sure yet” is fine; you can skip this entire check-in. It does not
          change XP or decide whether you finish.
        </p>
        <details>
          <summary>What do the choices mean?</summary>
          <dl>
            {Object.entries(evidenceOptions).map(([key, option]) => (
              <div key={key}>
                <dt>
                  <strong>{option.label}</strong>
                </dt>
                <dd>{option.meaning}</dd>
              </div>
            ))}
          </dl>
          <p>
            For example: if a hint helped you replace an abstract phrase with a
            specific detail, choose “with help”. If you chose the detail
            yourself and only asked for feedback afterwards, “on my own” may
            fit.
          </p>
        </details>
        {lesson.assessment.map((c, i) => {
          const id = criterionId(lesson, i);
          return (
            <label key={id}>
              {c}
              <select
                aria-label={`Evidence for criterion ${i + 1}`}
                value={choices[id] || ""}
                onChange={(e) =>
                  setChoices((s) => ({
                    ...s,
                    [id]: e.target.value as EvidenceLevel | "",
                  }))
                }
              >
                <option value="">Not sure yet / skip</option>
                {Object.entries(labels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
              {choices[id] && (
                <small className="hint">
                  {evidenceOptions[choices[id] as EvidenceLevel].meaning}
                </small>
              )}
            </label>
          );
        })}
        <button
          className="secondary"
          disabled={busy || !Object.values(choices).some(Boolean)}
          onClick={record}
        >
          Save my check-in
        </button>
        <p className="hint">
          “I used it in a new exercise” needs a saved “on my own” check-in
          first, then different work using “Practise this skill with a new
          exercise”. No choice is an objective score.
        </p>
        {notice && <p role="status">{notice}</p>}
        <details>
          <summary>{history.length} saved criterion reports</summary>
          {history
            .slice()
            .reverse()
            .map((e) => (
              <div className="evidence-record" key={e.id}>
                <strong>
                  {labels[e.level]} · version {e.contentVersion}
                  {e.contentVersion !== lesson.version
                    ? " (earlier content)"
                    : ""}
                </strong>
                <p>
                  {e.criterionId} · {new Date(e.createdAt).toLocaleString()}
                </p>
                <blockquote>
                  {lesson.faculty === "music" ? musicText(e.draft) : e.draft}
                </blockquote>
                <p>{e.reflection}</p>
              </div>
            ))}
        </details>
      </details>
    </section>
  );
}
