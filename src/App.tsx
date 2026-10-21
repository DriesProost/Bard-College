import {
  REVIEW_LIMIT,
  currentSession,
  reviewedDraft,
  dailyPractice,
} from "./shared/tutoring";
import { MusicWorkbench } from "./MusicWorkbench";
import { meaningfulSketch, musicText } from "./shared/music";
import { pendingSaves } from "./persistence";
import { useEffect, useRef, useState } from "react";
import {
  Feather,
  BookOpen,
  House,
  ScrollText,
  Library,
  Compass,
  Settings as SettingsIcon,
  ArrowRight,
  ChevronLeft,
  Check,
  Flame,
  Sparkles,
  Plus,
  Download,
  History,
  Trash2,
  PanelLeftClose,
  Music,
  Heart,
  Mic,
  Smile,
  MessageCircle,
  ShieldCheck,
  Leaf,
  Search,
  LoaderCircle,
} from "lucide-react";
import type {
  API,
  State,
  Project,
  Feedback,
  Profile,
  Settings,
  Snapshot,
  AttemptHistory,
} from "./shared/model";
import { disciplines, defaultProfile } from "./shared/model";
import {
  FacultyAcademy,
  FacultySummary,
  ContentUpdatePanel,
  EvidencePanel,
} from "./Faculty";
import {
  lessons,
  personalPrompt,
  setCurriculum,
  type Faculty,
} from "./shared/curriculum";
import {
  progression,
  streak,
  syllables,
  ranks,
  dueReview,
} from "./shared/progression";
declare global {
  interface Window {
    bard: API;
  }
}

const nav = [
  ["hall", "The Great Hall", House],
  ["academy", "The Academy", BookOpen],
  ["studio", "The Scriptorium", Feather],
  ["professor", "The Professor", MessageCircle],
  ["songbook", "The Songbook", Library],
  ["journey", "The Bard’s Journey", Compass],
] as const;
const icons = [Feather, Music, ScrollText, Smile, Heart, Mic];
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const cleanError = (e: unknown) =>
  String(e instanceof Error ? e.message : e).replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
export default function App() {
  const [state, setState] = useState<State | null>(null),
    [page, setPage] = useState("hall"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [lessonId, setLessonId] = useState("lesson-1"),
    [faculty, setFaculty] = useState<Faculty>("writing"),
    [projectId, setProjectId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(false),
    [loading, setLoading] = useState(true);
  const refresh = async () => {
    const s = await window.bard.load();
    setCurriculum({
      version: s.curriculumVersion,
      lessons: s.curriculum,
      sources: s.sources,
    });
    setState(s);
    return s;
  };
  useEffect(() => {
    if (!window.bard) {
      setError(
        "Open Bard’s College through the desktop application. Run npm run dev or npm start from the project folder.",
      );
      setLoading(false);
      return;
    }
    refresh()
      .then((s) => setOnboarding(!s.profile.onboarded))
      .catch((e) => setError(cleanError(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!window.bard) return;
    return window.bard.onCloseRequested(() => {
      Promise.all([...pendingSaves].map((save) => save()))
        .then(() => window.bard.finishClose())
        .catch((e) => setError(cleanError(e)));
    });
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  const fail = (e: unknown) => setError(cleanError(e));
  const openProject = (p: Project) => {
    setProjectId(p.id);
    setPage("studio");
  };
  const createProject = async (seed?: { title: string; body: string }) => {
    try {
      const p = await window.bard.saveProject({
        id: crypto.randomUUID(),
        title: seed?.title || "Untitled ballad",
        body: seed?.body || "",
        kind: "Song",
        completed: false,
      });
      await refresh();
      openProject(p);
    } catch (e) {
      fail(e);
    }
  };
  const newProject = () => createProject();
  const learn = (id?: string) => {
    const path = lessons.filter((l) => l.faculty === faculty);
    if (!id && !path.length) {
      setPage("academy");
      return;
    }
    setLessonId(
      id ||
        path.find(
          (l) => !state?.attempts.find((a) => a.lessonId === l.id)?.completedAt,
        )?.id ||
        path[path.length - 1].id,
    );
    setPage("lesson");
  };
  if (loading)
    return (
      <div className="splash">
        <Feather size={48} />
        <h1>Opening the College…</h1>
      </div>
    );
  if (!state)
    return (
      <div className="splash">
        <Feather size={48} />
        <h1>Bard’s College</h1>
        <p role="alert">{error}</p>
      </div>
    );
  const review = dueReview(state);
  const progress = progression(state.events),
    done = state.attempts.filter(
      (a) =>
        a.completedAt &&
        lessons.some((l) => l.id === a.lessonId && l.faculty === faculty),
    ).length;
  const facultyLessons = lessons.filter((l) => l.faculty === faculty);
  return (
    <div
      className={`app ${state.settings.reducedMotion ? "reduce-motion" : ""}`}
    >
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("hall");
          }}
        >
          <span className="crest">
            <Feather size={26} />
          </span>
          <span>
            Bard’s College<small>THE ART OF FINDING YOUR VOICE</small>
          </span>
        </a>
        <div className="nav-label">YOUR COLLEGE</div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={
                page === id || (page === "lesson" && id === "academy")
                  ? "active"
                  : ""
              }
              onClick={() => setPage(id)}
            >
              <Icon size={19} />
              {label}
              {id === "academy" && (
                <span className="nav-count">
                  {done}/{facultyLessons.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="daily-note">
            <Leaf size={19} />
            <p>
              A little practice.
              <br />
              <em>A lasting voice.</em>
            </p>
          </div>
          <button
            className={"settings-link " + (page === "settings" ? "active" : "")}
            onClick={() => setPage("settings")}
          >
            <SettingsIcon size={18} />
            Settings & preferences
          </button>
          <div className="profile">
            <div className="avatar">
              {state.profile.name.slice(0, 1).toUpperCase()}
            </div>
            <span>
              {state.profile.name}
              <small>{progress.rank}</small>
            </span>
            <span className="level">
              I
              {progress.level > 1
                ? "I".repeat(Math.min(4, progress.level - 1))
                : ""}
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            <span className="tiny-crest">✦</span>{" "}
            {page === "lesson"
              ? "The Academy"
              : nav.find((n) => n[0] === page)?.[1] || "Settings & preferences"}
          </span>
          <div className="top-right">
            <span className="offline">
              <i />
              Local-first · Your work is yours
            </span>
            <span className="streak">
              <Flame size={17} />
              {streak(state.events)} day streak
            </span>
          </div>
        </header>
        <main>
          {error && (
            <div className="alert" role="alert">
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {page === "hall" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
                  <h1>Welcome back, {state.profile.name}.</h1>
                  <p>Make a little room for your words today.</p>
                </div>
                <div className="date-badge">
                  {new Intl.DateTimeFormat("en", {
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  }).format(new Date())}
                </div>
              </div>
              <LessonCard
                state={state}
                faculty={faculty}
                onStart={learn}
                onFaculty={setFaculty}
              />
              <div className="stat-row">
                <div>
                  <span className="stat-icon">
                    <Compass />
                  </span>
                  <span>
                    <small>CURRENT RANK</small>
                    <strong>{progress.rank}</strong>
                  </span>
                  <span className="stat-tail">Level {progress.level}</span>
                </div>
                <div>
                  <span className="stat-icon">
                    <Sparkles />
                  </span>
                  <span>
                    <small>EXPERIENCE EARNED</small>
                    <strong>
                      {progress.xp} <em>XP</em>
                    </strong>
                  </span>
                  <span className="stat-tail">
                    {progress.next} to next rank
                  </span>
                </div>
                <div>
                  <span className="stat-icon">
                    <BookOpen />
                  </span>
                  <span>
                    <small>PRACTICES COMPLETED</small>
                    <strong>
                      {done} <em>/ {facultyLessons.length}</em>
                    </strong>
                  </span>
                  <span className="stat-tail">A voice in the making</span>
                </div>
              </div>
              <div className="dashboard-grid">
                <section>
                  <SectionTitle
                    title="Your study desk"
                    label="SAVE AND RETURN"
                  />

                  {review && (
                    <div className="review-reminder">
                      <Leaf size={18} />
                      <span>
                        <strong>A familiar skill, a fresh attempt</strong>
                        <small>
                          {review.title} · revisit when you have a moment
                        </small>
                      </span>
                      <button
                        className="text-button"
                        onClick={() => learn(review.id)}
                      >
                        Revisit <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                  <div className="section-line">
                    <h2>Your writing desk</h2>
                    <button
                      className="text-button"
                      onClick={() => setPage("songbook")}
                    >
                      View songbook <ArrowRight size={15} />
                    </button>
                  </div>
                  {state.projects.length ? (
                    <div className="recent-list">
                      {state.projects.slice(0, 3).map((p) => (
                        <button key={p.id} onClick={() => openProject(p)}>
                          <span className="document-icon">
                            <ScrollText />
                          </span>
                          <span>
                            <strong>{p.title}</strong>
                            <small>
                              {p.kind} · {words(p.body)} words
                            </small>
                          </span>
                          <ArrowRight size={17} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button className="empty-desk" onClick={newProject}>
                      <Feather />
                      <span>
                        A blank page, a world of possibilities.
                        <small>Start your first piece</small>
                      </span>
                      <Plus size={18} />
                    </button>
                  )}
                </section>
                <section className="skills-card">
                  <div className="eyebrow">TWO FACULTIES. YOUR OWN PACE.</div>
                  <h2>The craft you’re building</h2>
                  <SkillList state={state} />
                  <div className="quiet-note">
                    Progress comes from practice,
                    <br />
                    not perfection.
                  </div>
                </section>
              </div>
              <footer className="quote">
                “Words are, of course, the most powerful drug used by mankind.”
                <span>— RUDYARD KIPLING</span>
              </footer>
            </>
          )}
          {page === "academy" && (
            <FacultyAcademy
              state={state}
              faculty={faculty}
              onFaculty={setFaculty}
              onLearn={learn}
              onSettings={() => setPage("settings")}
            />
          )}
          {page === "lesson" && (
            <LessonView
              key={lessonId}
              id={lessonId}
              state={state}
              refresh={refresh}
              fail={fail}
              onBack={() => setPage("academy")}
              onStudio={createProject}
              onNext={learn}
            />
          )}
          {page === "studio" &&
            (projectId && state.projects.find((p) => p.id === projectId) ? (
              <Studio
                key={projectId}
                project={state.projects.find((p) => p.id === projectId)!}
                state={state}
                refresh={refresh}
                fail={fail}
                notify={setNotice}
              />
            ) : (
              <div className="blank-state">
                <Feather size={50} />
                <h1>Your Scriptorium awaits.</h1>
                <p>A quiet place to write, revise, and find your voice.</p>
                <button className="primary" onClick={newProject}>
                  Create a writing project <Plus size={17} />
                </button>
                <button
                  className="text-button"
                  onClick={() => setPage("songbook")}
                >
                  Open your songbook
                </button>
              </div>
            ))}
          {page === "songbook" && (
            <Songbook
              state={state}
              onOpen={openProject}
              onNew={newProject}
              refresh={refresh}
              fail={fail}
            />
          )}
          {page === "professor" && (
            <>
              <PageTitle
                eyebrow="THOUGHTFUL CRITICISM. YOUR CREATIVE CONTROL."
                title="A seat with the Professor"
                text="Bring a passage, a question, or a stubborn line. We’ll look closely, together."
              />
              <div className="professor-layout">
                <div className="tutor-intro">
                  <span className="professor-seal">
                    <Feather size={38} />
                  </span>
                  <h2>“Tell me what you’re trying to say.”</h2>
                  <p>
                    I’ll point out what works, explain why, and offer one or two
                    ways forward. The next line remains yours to write.
                  </p>
                  <div className="pill">
                    <ShieldCheck size={15} /> Only GPT-6 Luna · Sent on request
                  </div>
                </div>
                <Tutor state={state} fail={fail} refresh={refresh} />
              </div>
            </>
          )}
          {page === "journey" && (
            <>
              <PageTitle
                eyebrow="A RECORD OF PRACTICE, NOT A JUDGEMENT OF TALENT"
                title="The Bard’s Journey"
                text="Every thoughtful attempt moves you forward. Miss a day; your learning stays with you."
              />
              <section className="journey-banner">
                <Compass size={50} />
                <div>
                  <div className="eyebrow gold">YOUR CURRENT RANK</div>
                  <h2>{progress.rank}</h2>
                  <p>
                    {progress.xp} XP earned · {progress.next} XP to the next
                    milestone
                  </p>
                </div>
              </section>
              <FacultySummary state={state} />
              <div className="dashboard-grid">
                <section className="paper-card">
                  <h2>Your participation history</h2>
                  {ranks.map((r, i) => (
                    <div
                      className={
                        "rank-row " + (progress.level > i ? "earned" : "")
                      }
                      key={r}
                    >
                      <span>
                        {progress.level > i ? <Check size={18} /> : i + 1}
                      </span>
                      <div>
                        <strong>{r}</strong>
                        <small>{i * 250} XP</small>
                      </div>
                    </div>
                  ))}
                </section>
                <section className="skills-card">
                  <SkillList state={state} />
                  <h3>Practice with purpose</h3>
                  <p className="muted">
                    XP records participation, never skill levels. A short
                    attempt earns 10 XP; completing its practice earns 30 XP. A
                    revision earns 15 XP. Finishing an original piece of at
                    least 30 words earns 40 XP. Each milestone is awarded once
                    per lesson or piece.
                  </p>
                  <p className="muted">
                    No AI quality scores. No penalties for taking a break.
                  </p>
                </section>
              </div>
            </>
          )}
          {page === "settings" && (
            <SettingsView
              state={state}
              refresh={refresh}
              fail={fail}
              notify={setNotice}
              onProfile={() => setOnboarding(true)}
            />
          )}
        </main>
      </div>
      {onboarding && (
        <Onboarding
          profile={state.profile}
          onClose={() => setOnboarding(false)}
          onSave={async (p) => {
            try {
              await window.bard.saveProfile(p);
              await refresh();
              setOnboarding(false);
            } catch (e) {
              fail(e);
            }
          }}
        />
      )}
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
function SectionTitle({ title, label }: { title: string; label: string }) {
  return (
    <div className="section-heading">
      <div className="eyebrow">{label}</div>
      <h2>{title}</h2>
    </div>
  );
}
function Manuscript() {
  return (
    <div className="manuscript" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="star star-one">✧</div>
      <div className="star star-two">✦</div>
      <div className="book-cover">
        <div className="book-page">
          <span className="book-flourish">❧</span>
          <div className="book-title">
            The art of
            <br />
            <em>beginning.</em>
          </div>
          <span className="ink-line" />
          <span className="ink-line short" />
          <span className="ink-line" />
          <span className="ink-line short" />
          <span className="book-chapter">I.</span>
        </div>
      </div>
      <Feather className="hero-quill" size={155} strokeWidth={0.65} />
      <div className="inkwell" />
    </div>
  );
}
function SkillList({ state }: { state: State }) {
  return <FacultySummary state={state} />;
}
function LessonCard({
  faculty,
  state,
  onStart,
  onFaculty,
}: {
  state: State;
  faculty: Faculty;
  onStart: (id: string) => void;
  onFaculty: (faculty: Faculty) => void;
}) {
  const daily = dailyPractice(state, faculty);
  return (
    <section
      className="paper-card daily-practice"
      aria-label="Today’s practice"
    >
      <div className="faculty-picker" role="group" aria-label="Daily faculty">
        {(["writing", "music"] as const).map((f) => (
          <button
            className={faculty === f ? "primary" : "secondary"}
            aria-pressed={faculty === f}
            key={f}
            onClick={() => onFaculty(f)}
          >
            {f === "writing" ? "Writing" : "Music"}
          </button>
        ))}
      </div>
      {daily ? (
        <>
          <div className="eyebrow">
            TODAY’S FIVE-MINUTE LESSON · {faculty.toUpperCase()}
          </div>
          <h2>{daily.lesson.title}</h2>
          <p>
            <strong>Your small task:</strong>{" "}
            {daily.lesson.minimumTask || daily.lesson.exercise}
          </p>
          <ol className="daily-steps">
            <li className={daily.session?.guidance ? "done" : ""}>
              Meet your Professor <small>Notice one useful idea.</small>
            </li>
            <li className={daily.drafted ? "done" : ""}>
              Make a small attempt{" "}
              <small>A few lines or a short musical gesture.</small>
            </li>
            <li className={daily.reviewed ? "done" : ""}>
              Get feedback{" "}
              <small>
                Choose one useful next step. Two follow-ups at most.
              </small>
            </li>
            <li className={daily.done ? "done" : ""}>
              Finish today’s practice{" "}
              <small>Save your reviewed answer. Longer work can wait.</small>
            </li>
          </ol>
          <p className="daily-status" role="status">
            {daily.done
              ? "Done for today. Your work is saved."
              : daily.session?.guidance
                ? "Your lesson is in progress. Pick up where you left off."
                : "One lesson is enough today. Start whenever you’re ready."}
          </p>
          <button className="primary" onClick={() => onStart(daily.lesson.id)}>
            {daily.done
              ? "Reopen today’s lesson"
              : daily.session?.guidance
                ? "Resume today’s lesson"
                : "Start today’s lesson"}{" "}
            <ArrowRight size={16} />
          </button>
          <p className="hint">
            About 1 minute learning, 3 minutes creating, 1 minute reflecting.
            The Academy has the full path.
          </p>
        </>
      ) : (
        <p>Open the Academy to add lessons for this faculty.</p>
      )}
    </section>
  );
}
function FeedbackCard({ feedback }: { feedback: Feedback }) {
  return (
    <div className="feedback">
      <div className="eyebrow">
        <Feather size={16} /> THE PROFESSOR’S NOTES
      </div>
      <h3>What’s working</h3>
      <p>{feedback.strength}</p>
      <p className="muted">{feedback.reason}</p>
      <h3>A way forward</h3>
      <ul>
        {feedback.improvements.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
      <blockquote>{feedback.question}</blockquote>
    </div>
  );
}
function Tutor({
  state,
  fail,
  refresh,
  text,
  lessonId,
  practicePrompt,
  initial,
  initialText,
  beforeRequest,
  onBusyChange,
}: {
  state: State;
  fail: (e: unknown) => void;
  refresh: () => Promise<State>;
  text?: string;
  lessonId?: string;
  practicePrompt?: string;
  initial?: Feedback | null;
  initialText?: string;
  beforeRequest?: () => Promise<unknown>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const version = lessons.find((l) => l.id === lessonId)?.version || 0;
  const session = currentSession(
    state,
    lessonId || "studio",
    version,
    practicePrompt || "",
  );
  const last = session?.turns.at(-1);
  const [passage, setPassage] = useState(text || ""),
    [question, setQuestion] = useState(""),
    [feedback, setFeedback] = useState<Feedback | null>(
      last?.feedback || (session ? null : initial) || null,
    ),
    [feedbackSource, setFeedbackSource] = useState(
      last?.text || (session ? "" : initialText) || "",
    ),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy]);
  const count = session?.turns.length || 0,
    ended = count >= REVIEW_LIMIT || !!session?.completedAt;
  const ready = !lessonId || !!session?.guidance;
  useEffect(() => {
    setFeedback(last?.feedback || (session ? null : initial) || null);
    setFeedbackSource(last?.text || (session ? "" : initialText) || "");
    setQuestion("");
  }, [session?.id, count, JSON.stringify(initial), initialText]);
  async function request() {
    setBusy(true);
    try {
      await beforeRequest?.();
      const result = await window.bard.tutor({
        sessionId: session?.id,
        text: text ?? passage,
        lessonId,
        practicePrompt,
        question: question || undefined,
        confirmed: true,
      });
      setFeedback(result.feedback);
      setFeedbackSource(text ?? passage);
      setQuestion("");
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function restart() {
    setBusy(true);
    try {
      await beforeRequest?.();
      await window.bard.startTutorSession({
        lessonId,
        practicePrompt,
        restart: true,
      });
      setFeedback(null);
      setFeedbackSource("");
      setQuestion("");
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tutor-panel">
      {text === undefined && (
        <label>
          Your writing
          <textarea
            value={passage}
            onChange={(e) => setPassage(e.target.value)}
            maxLength={20000}
            rows={9}
            placeholder="Paste a verse or write a few lines here…"
          />
        </label>
      )}
      <p className="session-progress">
        {count} of {REVIEW_LIMIT} reviews used · one initial review and up to
        two follow-ups
      </p>
      {feedback && (
        <>
          {feedbackSource.trim() !== (text ?? passage).trim() && (
            <p className="hint" role="note">
              Notes on your earlier draft.{" "}
              {ended
                ? "Start another session if you want feedback on more changes."
                : "Submit this version when you’re ready."}
            </p>
          )}
          <FeedbackCard feedback={feedback} />
        </>
      )}
      {!ended && (
        <>
          <details>
            <summary>Ask a specific question (optional)</summary>
            <label>
              {feedback
                ? "One follow-up question (optional)"
                : "Anything you want the Professor to notice? (optional)"}
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={2000}
                placeholder={
                  lessonId?.startsWith("music-")
                    ? "Does the written answer contrast with the first gesture?"
                    : "Does the last line support my intention?"
                }
              />
            </label>
          </details>
          <button
            className="primary"
            disabled={
              busy || !(text ?? passage).trim() || !state.hasKey || !ready
            }
            onClick={() => void request()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}{" "}
            {busy
              ? "The Professor is reading…"
              : feedback
                ? `Ask a follow-up (${REVIEW_LIMIT - count} left)`
                : "Ask the Professor"}
          </button>
        </>
      )}
      {ended && (
        <div className="session-ending" role="status">
          <h3>
            {session?.completedAt
              ? "Practice finished"
              : "That’s enough feedback for this session"}
          </h3>
          <p>
            {lessonId
              ? "Keep the choice that serves your intention. Finish practice when you’re ready; you don’t need to keep asking questions."
              : "Take one useful idea back to your draft. There’s no need to keep the conversation going."}
          </p>
          <button
            className="text-button"
            disabled={busy || !state.hasKey}
            onClick={() => void restart()}
          >
            {busy ? "Preparing…" : "Start another practice session"}
          </button>
          <small>
            A new session keeps your draft and previous session records.
          </small>
        </div>
      )}
      {!state.hasKey && (
        <p className="hint">
          Add your API key in Settings to work with the Professor. Your drafts
          remain saved.
        </p>
      )}
    </div>
  );
}
function LessonView({
  id,
  state,
  refresh,
  fail,
  onBack,
  onStudio,
  onNext,
}: {
  id: string;
  state: State;
  refresh: () => Promise<State>;
  fail: (e: unknown) => void;
  onBack: () => void;
  onStudio: (draft: { title: string; body: string }) => void;
  onNext: (id: string) => void;
}) {
  const lesson = lessons.find((l) => l.id === id)!,
    attempt = state.attempts.find((a) => a.lessonId === id);
  const [body, setBody] = useState(attempt?.body || ""),
    [revision, setRevision] = useState(attempt?.revision || ""),
    [reflection, setReflection] = useState(attempt?.reflection || ""),
    [practicePrompt, setPracticePrompt] = useState(
      attempt?.practicePrompt || "",
    ),
    [history, setAttemptHistory] = useState<AttemptHistory[]>([]),
    [saved, setSaved] = useState(true),
    [saving, setSaving] = useState(false);
  const session = currentSession(state, id, lesson.version, practicePrompt);
  const [starting, setStarting] = useState(false),
    [tutorBusy, setTutorBusy] = useState(false);
  const reviewed = reviewedDraft(session, revision || body);
  async function startLesson(restart = false) {
    setStarting(true);
    try {
      if (!(await save(false))) return;
      await window.bard.startTutorSession({
        lessonId: id,
        practicePrompt,
        restart,
      });
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setStarting(false);
    }
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAttempt = useRef({ body, revision, reflection, practicePrompt });
  latestAttempt.current = { body, revision, reflection, practicePrompt };
  useEffect(() => {
    const flush = () => {
      if (timer.current) clearTimeout(timer.current);
      return window.bard.saveAttempt({
        lessonId: id,
        ...latestAttempt.current,
        complete: false,
      });
    };
    pendingSaves.add(flush);
    return () => {
      pendingSaves.delete(flush);
      void flush().then(refresh).catch(fail);
    };
  }, []);
  const unlocked = lesson.skillDependencies.every(
    (dep) => !!state.attempts.find((a) => a.lessonId === dep)?.completedAt,
  );
  useEffect(() => {
    if (
      body === (attempt?.body || "") &&
      revision === (attempt?.revision || "") &&
      reflection === (attempt?.reflection || "") &&
      practicePrompt === (attempt?.practicePrompt || "")
    )
      return;
    setSaved(false);
    const t = setTimeout(() => {
      window.bard
        .saveAttempt({
          lessonId: id,
          body,
          revision,
          reflection,
          practicePrompt,
          complete: false,
        })
        .then(() => {
          setSaved(true);
          return refresh();
        })
        .catch(fail);
    }, 700);
    timer.current = t;
    return () => clearTimeout(t);
  }, [body, revision, reflection, practicePrompt]);
  async function save(complete: boolean) {
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    try {
      await window.bard.saveAttempt({
        lessonId: id,
        body,
        revision,
        reflection,
        practicePrompt,
        complete,
      });
      await refresh();
      setSaved(true);
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setSaving(false);
    }
  }
  const input = revision || body;
  const changeInput = (value: string) => {
    setBody(value);
    setRevision("");
  };
  const path = lessons.filter((l) => l.faculty === lesson.faculty);
  return (
    <div className="simple-lesson">
      <button
        className="text-button back"
        onClick={async () => {
          if (await save(false)) onBack();
        }}
      >
        <ChevronLeft size={16} /> Back to the Academy
      </button>
      <header className="lesson-header">
        <div className="eyebrow">
          {lesson.faculty === "music" ? "MUSIC" : "WRITING"} · LESSON{" "}
          {path.indexOf(lesson) + 1} OF {path.length} · ABOUT 5 MINUTES
        </div>
        <h1>{lesson.title}</h1>
      </header>
      <section className="paper-card" aria-labelledby="explanation-title">
        <h2 id="explanation-title">1. Explanation</h2>
        {session?.guidance ? (
          <p>{session.guidance.explanation}</p>
        ) : (
          <>
            <p>Start the lesson for a short explanation from your teacher.</p>
            <button
              className="primary"
              disabled={starting || !state.hasKey}
              onClick={() => void startLesson()}
            >
              {starting ? "Preparing your lesson…" : "Start lesson"}
            </button>
            {!state.hasKey && <p>Add your API key in Settings to start.</p>}
          </>
        )}
      </section>
      <section className="paper-card" aria-labelledby="example-title">
        <h2 id="example-title">2. Example</h2>
        <blockquote>{lesson.example}</blockquote>
        {session?.guidance && <p>{session.guidance.notice}</p>}
      </section>
      <section className="paper-card" aria-labelledby="input-title">
        <h2 id="input-title">3. Your input</h2>
        <p className="plain-task">
          <strong>What to do:</strong>{" "}
          {practicePrompt || lesson.minimumTask || lesson.exercise}
        </p>
        {session?.guidance && (
          <p className="hint">{session.guidance.firstStep}</p>
        )}
        <fieldset className="lesson-work" disabled={!session?.guidance}>
          {lesson.faculty === "music" ? (
            <MusicWorkbench
              key={id + practicePrompt}
              example={lesson.musicExample}
              value={input}
              onChange={changeInput}
              lessonId={id}
              fail={fail}
              beforeRecord={() => save(false)}
            />
          ) : (
            <>
              <label className="sr-only" htmlFor="exercise">
                Your exercise
              </label>
              <textarea
                id="exercise"
                rows={7}
                value={input}
                onChange={(e) => changeInput(e.target.value)}
                maxLength={20000}
                placeholder="Write your answer here…"
              />
            </>
          )}
          <div className="editor-meta">
            <span>
              {lesson.faculty === "music"
                ? "Musical sketch"
                : `${words(input)} words`}
            </span>
            <span>{saved ? "Saved locally" : "Saving…"}</span>
          </div>
        </fieldset>
      </section>
      <section
        className="paper-card lesson-feedback"
        aria-labelledby="review-title"
      >
        <h2 id="review-title">4. Teacher review</h2>
        <Tutor
          state={state}
          fail={fail}
          refresh={refresh}
          text={input}
          onBusyChange={setTutorBusy}
          beforeRequest={async () => {
            if (timer.current) clearTimeout(timer.current);
            await window.bard.saveAttempt({
              lessonId: id,
              ...latestAttempt.current,
              complete: false,
            });
          }}
          practicePrompt={practicePrompt}
          lessonId={id}
          initial={attempt?.feedback}
          initialText={attempt?.feedbackText}
        />
        {session && session.turns.length > 0 && !session.completedAt && (
          <p className="hint">
            Want to change something? Edit your answer above, then ask for
            another review. You can also finish after one review.
          </p>
        )}
      </section>
      <section
        className="paper-card lesson-finish"
        aria-labelledby="done-title"
      >
        <h2 id="done-title">5. Done</h2>
        {session?.completedAt ? (
          <p role="status">
            Done for today. Your answer and teacher’s feedback are saved.
          </p>
        ) : (
          <p>
            {reviewed
              ? "You have your teacher’s feedback. You can finish now."
              : "Write your answer and get your teacher’s review, then finish here."}
          </p>
        )}
        <button
          className="primary"
          disabled={
            saving ||
            tutorBusy ||
            !reviewed ||
            !!session?.completedAt ||
            (lesson.faculty === "music"
              ? !meaningfulSketch(input)
              : words(input) < lesson.minimumWords)
          }
          onClick={() => save(true)}
        >
          <Check size={16} />
          {session?.completedAt ? "Practice finished" : "Finish practice"}
        </button>
        {session?.completedAt && path.indexOf(lesson) < path.length - 1 && (
          <button
            className="text-button"
            onClick={() => onNext(path[path.indexOf(lesson) + 1].id)}
          >
            Next lesson <ArrowRight size={16} />
          </button>
        )}
      </section>
      <details className="paper-card lesson-options">
        <summary>More options</summary>
        <button className="text-button" onClick={() => save(false)}>
          Save draft
        </button>
        <label>
          What did you try, and what changed? (optional)
          <textarea
            rows={2}
            maxLength={2000}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="A short note for yourself, if useful."
          />
        </label>
        <details>
          <summary>More explanation and what to look for</summary>
          <p>{lesson.objective}</p>
          <p>{lesson.explanation}</p>
          <p>{lesson.weakExample}</p>
          <ul>
            {lesson.assessment.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {lesson.skillDependencies.length > 0 && (
            <p>
              Useful earlier lessons:{" "}
              {lesson.skillDependencies
                .map((dep) => lessons.find((l) => l.id === dep)?.title)
                .join(", ")}
              . These are suggestions, not locks.
            </p>
          )}
        </details>
        {lesson.extension && (
          <details>
            <summary>Optional longer work — saved and resumable</summary>
            <p>{lesson.extension}</p>
          </details>
        )}
        {lesson.transferPrompt && (
          <details>
            <summary>Try a different exercise</summary>
            <p>
              This opens a fresh draft for the same skill. Your current work
              stays in earlier attempts. It is optional.
            </p>
            <button
              className="secondary"
              disabled={saving || starting}
              onClick={async () => {
                if (!(await save(false))) return;
                setPracticePrompt(practicePrompt ? "" : lesson.transferPrompt);
                setBody("");
                setRevision("");
                setReflection("");
              }}
            >
              {practicePrompt
                ? "Return to the original exercise"
                : "Practise this skill with a new exercise"}
            </button>
          </details>
        )}
        <EvidencePanel
          key={id}
          lesson={lesson}
          state={state}
          beforeSave={() => save(false)}
          refresh={refresh}
          fail={fail}
        />
        <details>
          <summary
            onClick={() =>
              window.bard.attemptHistory(id).then(setAttemptHistory).catch(fail)
            }
          >
            Earlier saved attempts
          </summary>
          {!history.length && (
            <p>Earlier versions appear here after you change saved work.</p>
          )}
          {history.map((h) => (
            <div className="evidence-record" key={h.id}>
              <p>{new Date(h.createdAt).toLocaleString()}</p>
              <blockquote>
                {lesson.faculty === "music"
                  ? musicText(h.revision || h.body)
                  : h.revision || h.body}
              </blockquote>
              <p>{h.reflection}</p>
              <button
                className="secondary"
                onClick={async () => {
                  if (!(await save(false))) return;
                  setBody(h.body);
                  setRevision(h.revision);
                  setReflection(h.reflection);
                  setPracticePrompt(
                    h.practicePrompt === lesson.transferPrompt
                      ? h.practicePrompt
                      : "",
                  );
                }}
              >
                Restore this attempt
              </button>
            </div>
          ))}
        </details>
        <details>
          <summary>Sources and teaching limits</summary>
          <p>
            Examples and exercises are original. The teacher reviews the written
            plan; recordings are not sent or heard.
          </p>
          {lesson.sources.map((key) => (
            <div key={key}>
              <strong>{state.sources[key]?.title || key}</strong>
              <p>{state.sources[key]?.locator}</p>
              <p>{state.sources[key]?.scope}</p>
            </div>
          ))}
        </details>
        <button
          className="text-button"
          onClick={() =>
            onStudio({
              title: lesson.title + " — practice",
              body: lesson.faculty === "music" ? musicText(input) : input,
            })
          }
        >
          Open this draft in the Scriptorium <Feather size={16} />
        </button>
      </details>
    </div>
  );
}

function Studio({
  project,
  state,
  refresh,
  fail,
  notify,
}: {
  project: Project;
  state: State;
  refresh: () => Promise<State>;
  fail: (e: unknown) => void;
  notify: (s: string) => void;
}) {
  const [draft, setDraft] = useState(project),
    [status, setStatus] = useState("Saved locally"),
    [snapshots, setSnapshots] = useState<Snapshot[] | null>(null),
    [focus, setFocus] = useState(false);
  const latest = useRef(draft),
    saved = useRef(JSON.stringify(project)),
    queue = useRef(Promise.resolve());
  latest.current = draft;
  const save = () => {
    const p = latest.current;
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (saved.current === JSON.stringify(p)) return;
        try {
          const result = await window.bard.saveProject({
            ...p,
            title: p.title.trim() || "Untitled piece",
          });
          saved.current = JSON.stringify(p);
          if (latest.current === p) setStatus("Saved locally");
          await refresh();
        } catch (e) {
          setStatus("Not saved — try again");
          fail(e);
          throw e;
        }
      });
    return queue.current;
  };
  useEffect(() => {
    if (saved.current === JSON.stringify(draft)) return;
    setStatus("Saving…");
    const t = setTimeout(() => void save().catch(() => {}), 650);
    return () => clearTimeout(t);
  }, [draft]);
  useEffect(() => {
    pendingSaves.add(save);
    return () => {
      pendingSaves.delete(save);
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void save()
          .then(() => notify("Writing saved locally."))
          .catch(() => {});
      }
      if (e.key === "Escape") setFocus(false);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      void save().catch(() => {});
    };
  }, []);
  const update = (patch: Partial<Project>) =>
    setDraft((d) => ({ ...d, ...patch }));
  async function snapshot() {
    try {
      await save();
      await window.bard.snapshot(project.id);
      await refresh();
      notify("Revision snapshot saved.");
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }
  async function history() {
    try {
      await save();
      setSnapshots(await window.bard.history(project.id));
    } catch (e) {
      fail(e);
    }
  }
  return (
    <div className={"studio " + (focus ? "focus-mode" : "")}>
      <div className="studio-toolbar">
        <div>
          <div className="eyebrow">THE SCRIPTORIUM</div>
          <span className="hint" role="status">
            {status}
          </span>
        </div>
        <div className="button-row">
          <button
            className="icon-button"
            title="Focus mode (Escape to leave)"
            aria-label="Toggle focus mode"
            onClick={() => setFocus(!focus)}
          >
            <PanelLeftClose size={18} />
          </button>
          <button className="secondary" onClick={snapshot}>
            <Plus size={15} /> Snapshot
          </button>
          <button className="secondary" onClick={history}>
            <History size={16} /> Drafts
          </button>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await save();
                if (await window.bard.exportProject(project.id, "md"))
                  notify("Markdown exported.");
              } catch (e) {
                fail(e);
              }
            }}
          >
            <Download size={16} /> Markdown
          </button>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await save();
                if (await window.bard.exportProject(project.id, "txt"))
                  notify("Plain text exported.");
              } catch (e) {
                fail(e);
              }
            }}
          >
            Text
          </button>
        </div>
      </div>
      <div
        className={
          "writing-paper " + (!state.settings.lightPaper ? "dark-paper" : "")
        }
      >
        <div className="writing-top">
          <select
            aria-label="Writing type"
            value={draft.kind}
            onChange={(e) =>
              update({ kind: e.target.value as Project["kind"] })
            }
          >
            {["Poem", "Lyrics", "Song", "Story"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={draft.completed}
              onChange={(e) => update({ completed: e.target.checked })}
            />
            Completed
          </label>
        </div>
        <input
          className="title-input"
          aria-label="Project title"
          value={draft.title}
          maxLength={160}
          onChange={(e) => update({ title: e.target.value })}
        />
        <div className="writing-tools">
          <span>MARKDOWN · YOUR WORDS, YOUR PACE</span>
          <select
            aria-label="Insert song section"
            value=""
            onChange={(e) => {
              if (e.target.value)
                update({
                  body:
                    draft.body +
                    (draft.body ? "\n\n" : "") +
                    "## " +
                    e.target.value +
                    "\n",
                });
            }}
          >
            <option value="">+ Add a section</option>
            {["Verse", "Chorus", "Bridge", "Outro"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="editor-area">
          {state.settings.lineNumbers && (
            <div className="line-numbers" aria-hidden="true">
              {draft.body.split("\n").map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}
          <textarea
            aria-label="Writing document"
            spellCheck
            value={draft.body}
            maxLength={100000}
            onChange={(e) => update({ body: e.target.value })}
            placeholder={
              "A verse, a thought, a half-remembered melody.\nBegin wherever you are."
            }
          />
        </div>
        <div className="paper-footer">
          <span>
            {words(draft.body)} words · ≈ {syllables(draft.body)} syllables
            (English estimate)
          </span>
          <span>Ctrl / ⌘ S to save</span>
        </div>
      </div>
      <details className="rhyme-note">
        <summary>A little help with rhyme</summary>
        <p>
          Speak your end word aloud. Collect several candidates before choosing.
          Try a near-rhyme if a perfect match distorts your meaning.
        </p>
        <div className="rhyme-families">
          light → night, bright, sight, white · near: life, time
          <br />
          stone → own, known, alone · near: home, road
          <br />
          rain → train, remain, again · near: name, change
        </div>
        <p className="hint">
          A small offline reference; pronunciation varies. Suggestions are never
          inserted into your work.
        </p>
      </details>
      {snapshots && (
        <Modal title="Your revision history" onClose={() => setSnapshots(null)}>
          {!snapshots.length ? (
            <p>No snapshots yet. Save one before your next revision.</p>
          ) : (
            snapshots.map((s) => (
              <details className="snapshot" key={s.id}>
                <summary>
                  {new Date(s.createdAt).toLocaleString()} · {s.title}
                </summary>
                <pre>{s.body}</pre>
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      if (!(await snapshot())) return;
                      update({ title: s.title, body: s.body });
                      setSnapshots(null);
                      notify(
                        "Earlier draft restored. Your current draft was preserved as a snapshot.",
                      );
                    } catch (e) {
                      fail(e);
                    }
                  }}
                >
                  Restore this draft
                </button>
              </details>
            ))
          )}
        </Modal>
      )}
    </div>
  );
}
function Songbook({
  state,
  onOpen,
  onNew,
  refresh,
  fail,
}: {
  state: State;
  onOpen: (p: Project) => void;
  onNew: () => void;
  refresh: () => Promise<State>;
  fail: (e: unknown) => void;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All pieces"),
    [deleting, setDeleting] = useState<Project | null>(null);
  const projects = state.projects.filter(
    (p) =>
      (p.title + " " + p.body).toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All pieces" ||
        (filter === "Completed" ? p.completed : !p.completed)),
  );
  return (
    <>
      <PageTitle
        eyebrow="A SHELF FOR EVERY STAGE OF YOUR CRAFT"
        title="Your Songbook"
        text="The finished pieces. The promising fragments. Every word belongs to you."
      />
      <div className="songbook-tools">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search your writing"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a piece…"
          />
        </label>
        <select
          aria-label="Filter writing"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["All pieces", "In progress", "Completed"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="primary" onClick={onNew}>
          <Plus size={17} /> New piece
        </button>
      </div>
      {!projects.length ? (
        <div className="blank-state">
          <Library size={45} />
          <h2>
            {query ? "No matching pieces." : "Stories waiting to be written."}
          </h2>
          <p>
            {query
              ? "Try another word."
              : "Open a fresh page and see where it leads."}
          </p>
        </div>
      ) : (
        <div className="songbook-grid">
          {projects.map((p) => (
            <article className="writing-card" key={p.id}>
              <div className="card-top">
                <span>{p.kind}</span>
                <span className="pill">
                  {p.completed ? "Completed" : "In progress"}
                </span>
              </div>
              <button className="piece-open" onClick={() => onOpen(p)}>
                <h2>{p.title}</h2>
                <p>{p.body.slice(0, 170) || "A page full of possibility…"}</p>
              </button>
              <div className="card-foot">
                <small>
                  {words(p.body)} words ·{" "}
                  {new Date(p.updatedAt).toLocaleDateString()}
                </small>
                <button
                  className="icon-button"
                  aria-label={"Delete " + p.title}
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {deleting && (
        <Modal title="Remove this piece?" onClose={() => setDeleting(null)}>
          <p>
            “{deleting.title}” and its revision snapshots will be permanently
            removed. Export anything you want to keep first.
          </p>
          <button
            className="danger"
            onClick={async () => {
              try {
                await window.bard.deleteProject(deleting.id);
                await refresh();
                setDeleting(null);
              } catch (e) {
                fail(e);
              }
            }}
          >
            Delete piece and drafts
          </button>
        </Modal>
      )}
    </>
  );
}
function SettingsView({
  state,
  refresh,
  fail,
  notify,
  onProfile,
}: {
  state: State;
  refresh: () => Promise<State>;
  fail: (e: unknown) => void;
  notify: (s: string) => void;
  onProfile: () => void;
}) {
  const [settings, setSettings] = useState<Settings>(state.settings),
    [key, setKey] = useState(""),
    [saving, setSaving] = useState(false),
    [testing, setTesting] = useState(false),
    [testResult, setTestResult] = useState<{
      success: boolean;
      message: string;
      detail?: string;
    } | null>(null);
  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await window.bard.testAIConnection(true);
      setTestResult({
        success: r.success,
        message: r.message,
        detail:
          `${r.usage.input + r.usage.output} tokens` +
          (state.settings.inputPrice > 0 && state.settings.outputPrice > 0
            ? ` · estimated $${r.usage.cost.toFixed(6)}`
            : " · cost estimate unavailable until token prices are configured"),
      });
      await refresh();
    } catch (e) {
      setTestResult({ success: false, message: cleanError(e) });
    } finally {
      setTesting(false);
    }
  }
  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));
  const spent = state.usage.reduce((s, u) => s + u.cost, 0);
  return (
    <>
      <PageTitle
        eyebrow="MAKE THE COLLEGE YOUR OWN"
        title="Settings & preferences"
        text="A comfortable writing desk, a considered practice, and control over your AI usage."
      />
      <ContentUpdatePanel state={state} refresh={refresh} fail={fail} />
      <div className="settings-grid">
        <section className="paper-card">
          <h2>Your Professor</h2>
          <div className="pill">
            <ShieldCheck size={16} />
            GPT-6 Luna only
          </div>
          <p>
            Keys are encrypted using your operating system’s credential
            protection. API calls run in the privileged desktop process. Keys
            are excluded from exports and renderer state.
          </p>
          <p className="hint">
            Secure storage:{" "}
            {state.secureStorage
              ? `available · ${state.credentialProtection}`
              : "unavailable in this OS session"}{" "}
            · API key: {state.hasKey ? "configured" : "not configured"}
          </p>
          <label>
            OpenAI API key
            <input
              type="password"
              autoComplete="off"
              value={key}
              maxLength={512}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                state.hasKey ? "Enter a replacement key" : "Enter your own key"
              }
            />
          </label>
          <div className="button-row">
            <button
              className="primary"
              disabled={
                !key.trim() || !state.secureStorage || saving || testing
              }
              onClick={async () => {
                setSaving(true);
                try {
                  await window.bard.setKey(key);
                  setTestResult(null);
                  setKey("");
                  await refresh();
                  notify("API key saved securely.");
                } catch (e) {
                  fail(e);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save key securely
            </button>
            {state.hasKey && (
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await window.bard.setKey("");
                    setTestResult(null);
                    setKey("");
                    await refresh();
                    notify("API key removed.");
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                Remove key
              </button>
            )}
          </div>
          <button
            className="secondary connection-test"
            disabled={
              !state.hasKey ||
              !state.secureStorage ||
              saving ||
              testing ||
              !!key.trim()
            }
            onClick={testConnection}
          >
            {testing ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <ShieldCheck size={16} />
            )}
            {testing ? "Testing GPT-6 Luna…" : "Test AI Connection"}
          </button>
          <p className="hint">
            Tests the saved key with one small, real API request. No writing or
            learning profile is sent.{" "}
            {key.trim() ? "Save the replacement key before testing." : ""}
          </p>
          {testResult && (
            <div
              className={
                testResult.success
                  ? "connection-result success"
                  : "connection-result failure"
              }
              role={testResult.success ? "status" : "alert"}
            >
              <strong>{testResult.message}</strong>
              {testResult.detail && <p>{testResult.detail}</p>}
            </div>
          )}
          <p className="hint">
            Drafts, recordings, and revision history remain local. Lessons
            require the Professor. An unavailable model never triggers a
            fallback.
          </p>
        </section>
        <section className="paper-card">
          <h2>A practice that fits you</h2>
          <p>
            {state.profile.name} · {state.profile.experience}
            <br />
            {state.profile.form} · {state.profile.minutes} minutes a day
          </p>
          <p className="muted">
            {state.profile.interests}
            <br />
            {state.profile.genres}
          </p>
          <button className="secondary" onClick={onProfile}>
            Edit learning profile
          </button>
          <h3>Your writing surface</h3>
          {(
            [
              ["lightPaper", "Light parchment"],
              ["lineNumbers", "Show line numbers"],
              ["reducedMotion", "Reduce motion"],
            ] as const
          ).map(([k, label]) => (
            <label className="checkbox" key={k}>
              <input
                type="checkbox"
                checked={settings[k]}
                onChange={(e) => patch({ [k]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </section>
        <section className="paper-card">
          <h2>Spending awareness</h2>
          <p>
            Lesson and review buttons send requests directly. There are no
            repeated confirmation popups. Each lesson has one introduction and
            at most three reviews per session.
          </p>
          <label>
            Advisory budget in USD
            <input
              type="number"
              min="0"
              max="10000"
              step="0.5"
              value={settings.budget}
              onChange={(e) => patch({ budget: Number(e.target.value) })}
            />
          </label>
          <p className="hint">
            Zero disables the budget reminder here. This is a local estimate,
            not a hard billing limit. It does not include usage from other apps.
          </p>
          <div className="price-fields">
            <label>
              Input USD / 1M tokens
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.inputPrice}
                onChange={(e) => patch({ inputPrice: Number(e.target.value) })}
              />
            </label>
            <label>
              Output USD / 1M tokens
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.outputPrice}
                onChange={(e) => patch({ outputPrice: Number(e.target.value) })}
              />
            </label>
          </div>
          <p className="hint">
            Enter current published GPT-6 Luna prices for your account. No rate
            is assumed. Cached tokens and other pricing variations can change
            actual charges.
          </p>
          <p>
            Recorded:{" "}
            {state.usage
              .reduce((s, u) => s + u.input + u.output, 0)
              .toLocaleString()}{" "}
            tokens ·{" "}
            {settings.inputPrice && settings.outputPrice
              ? "$" + spent.toFixed(4) + " estimated at recorded rates"
              : "Cost not configured"}
          </p>
        </section>
        <section className="paper-card">
          <h2>Your work stays with you</h2>
          <p>
            Writing and learning progress live in a SQLite database in this
            application’s local user-data folder. No cloud account is required.
          </p>
          <p>
            Use Markdown or plain-text export in the Scriptorium to keep
            portable copies. For a complete backup, close the app and copy the
            user-data folder described in the README.
          </p>
          <p className="hint">
            Keyboard: Ctrl/⌘ S saves writing. Escape leaves focus mode. All
            controls are keyboard accessible.
          </p>
        </section>
      </div>
      <button
        className="primary"
        onClick={async () => {
          try {
            await window.bard.saveSettings(settings);
            await refresh();
            notify("Preferences saved.");
          } catch (e) {
            fail(e);
          }
        }}
      >
        Save preferences <Check size={16} />
      </button>
    </>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-title">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Onboarding({
  profile,
  onSave,
  onClose,
}: {
  profile: Profile;
  onSave: (p: Profile) => Promise<void>;
  onClose: () => void;
}) {
  const [p, setP] = useState<Profile>(
      profile.onboarded ? profile : { ...defaultProfile, name: "" },
    ),
    [busy, setBusy] = useState(false);
  const patch = (v: Partial<Profile>) => setP((p) => ({ ...p, ...v }));
  return (
    <Modal
      title={
        profile.onboarded
          ? "Your learning profile"
          : "Welcome to Bard’s College"
      }
      onClose={onClose}
    >
      <div className="eyebrow">EVERY VOICE BEGINS SOMEWHERE</div>
      <p>
        Tell us a little about yours. You can change these preferences at any
        time.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave({ ...p, name: p.name.trim(), onboarded: true });
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Your name
          <input
            required
            maxLength={60}
            value={p.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="What shall the Professor call you?"
          />
        </label>
        <label>
          Creative interests
          <input
            maxLength={500}
            value={p.interests}
            onChange={(e) => patch({ interests: e.target.value })}
          />
        </label>
        <label>
          Musical genres
          <input
            maxLength={300}
            value={p.genres}
            onChange={(e) => patch({ genres: e.target.value })}
          />
        </label>
        <div className="price-fields">
          <label>
            Writing experience
            <select
              value={p.experience}
              onChange={(e) =>
                patch({ experience: e.target.value as Profile["experience"] })
              }
            >
              {["Beginning", "Some practice", "Experienced"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Your main form
            <select
              value={p.form}
              onChange={(e) =>
                patch({ form: e.target.value as Profile["form"] })
              }
            >
              {["Poetry", "Lyrics", "Stories", "A combination"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          A gentle daily goal
          <select
            value={p.minutes}
            onChange={(e) => patch({ minutes: Number(e.target.value) })}
          >
            {[5, 10, 15, 20, 30, 60].map((n) => (
              <option key={n} value={n}>
                {n} minutes
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          disabled={busy || !p.name.trim()}
          type="submit"
        >
          {busy ? "Saving…" : "Enter the College"}
          <ArrowRight size={16} />
        </button>
        <p className="hint">
          No pressure, no penalties. Your writing practice belongs to you.
        </p>
      </form>
    </Modal>
  );
}
