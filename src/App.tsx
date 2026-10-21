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
              <section className="hero">
                <div className="hero-copy">
                  <div className="eyebrow gold">
                    <span className="dot" /> A WORD FROM YOUR PROFESSOR
                  </div>
                  <h2>
                    Every great ballad begins
                    <br />
                    with a single, imperfect line.
                  </h2>
                  <p>
                    Bring your curiosity. Leave perfection at the door.
                    <br />
                    Five minutes is enough to find something worth saying.
                  </p>
                  <button className="gold-button" onClick={() => learn()}>
                    Continue learning <ArrowRight size={17} />
                  </button>
                  <span className="hero-meta">
                    Your quill is ready. Take your time.
                  </span>
                </div>
                <Manuscript />
              </section>
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
                    title="Today’s small discovery"
                    label="THE DAILY PRACTICE"
                  />
                  <LessonCard state={state} faculty={faculty} onStart={learn} />
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
}: {
  state: State;
  faculty: Faculty;
  onStart: (id: string) => void;
}) {
  const l =
    lessons.find(
      (l) =>
        l.faculty === faculty &&
        !state.attempts.find((a) => a.lessonId === l.id)?.completedAt,
    ) ||
    lessons.filter((l) => l.faculty === faculty).at(-1) ||
    lessons[0];
  return (
    <div className="today-card">
      <div className="lesson-illustration">
        <Feather size={48} strokeWidth={1} />
        <span>
          {faculty === "music"
            ? "THE LUTE & THE IDEA"
            : "THE QUILL & THE CRAFT"}
        </span>
      </div>
      <div className="today-copy">
        <div className="eyebrow">
          {l.discipline} <span>· 5 MIN</span>
        </div>
        <h2>{l.title}</h2>
        <p>{l.objective}</p>
        <button className="text-button" onClick={() => onStart(l.id)}>
          Begin this lesson <ArrowRight size={16} />
        </button>
      </div>
    </div>
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
}) {
  const [passage, setPassage] = useState(text || ""),
    [question, setQuestion] = useState(""),
    [feedback, setFeedback] = useState<Feedback | null>(initial || null),
    [feedbackSource, setFeedbackSource] = useState(initialText || ""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [usage, setUsage] = useState("");
  const initialSignature = JSON.stringify(initial);
  useEffect(() => {
    setFeedback(initial || null);
    setFeedbackSource(initialText || "");
  }, [initialSignature, initialText]);
  const pricesKnown =
      state.settings.inputPrice > 0 && state.settings.outputPrice > 0,
    spent = state.usage.reduce((s, u) => s + u.cost, 0);
  const estimate =
    ((Math.ceil((text ?? passage).length / 3) + 1600) *
      state.settings.inputPrice) /
      1e6 +
    (1200 * state.settings.outputPrice) / 1e6;
  async function request(confirmed = false) {
    if (
      !confirmed &&
      (state.settings.confirmRequests ||
        (pricesKnown &&
          state.settings.budget > 0 &&
          spent + estimate > state.settings.budget))
    ) {
      setConfirm(true);
      return;
    }
    setConfirm(false);
    setBusy(true);
    try {
      await beforeRequest?.();
      const r = await window.bard.tutor({
        text: text ?? passage,
        lessonId,
        practicePrompt,
        question: question || undefined,
        previous: feedback || undefined,
        confirmed,
      });
      setFeedback(r.feedback);
      setFeedbackSource(text ?? passage);
      setUsage(
        `${r.usage.input + r.usage.output} tokens${pricesKnown ? ` · estimated $${r.usage.cost.toFixed(4)}` : " · set token prices in Settings for cost estimates"}`,
      );
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
      {feedback && (
        <>
          {feedbackSource.trim() !== (text ?? passage).trim() && (
            <p className="hint" role="note">
              Notes on your earlier draft. They are kept here while you revise;
              ask again for feedback on this version.
            </p>
          )}
          <FeedbackCard feedback={feedback} />
        </>
      )}
      <label>
        {feedback
          ? "A follow-up question (optional)"
          : "What would you like to explore? (optional)"}
        <input
          value={question}
          maxLength={2000}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Does the last line feel earned?"
        />
      </label>
      <button
        className="primary"
        disabled={busy || !(text ?? passage).trim() || !state.hasKey}
        onClick={() => request()}
      >
        {busy ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <Sparkles size={17} />
        )}{" "}
        {busy
          ? "The Professor is reading…"
          : feedback
            ? "Ask a follow-up"
            : "Ask the Professor"}
      </button>
      {!state.hasKey && (
        <p className="hint">
          Add your API key in Settings. Exercises and writing work without it.
        </p>
      )}
      <p className="hint">
        Only this passage, your question, feedback context, and learning profile
        are sent to OpenAI. No automatic requests. {usage}
      </p>
      {confirm && (
        <Modal
          title="Send this passage to the Professor?"
          onClose={() => setConfirm(false)}
        >
          <p>
            This request uses GPT-6 Luna. Your passage and learning context will
            be sent to OpenAI.
          </p>
          <p>
            {pricesKnown
              ? `Estimated request cost: $${estimate.toFixed(4)}. Recorded spending: $${spent.toFixed(4)}.`
              : "Cost estimate unavailable. Enter current GPT-6 Luna token prices in Settings; no prices are assumed."}
          </p>
          {pricesKnown &&
            state.settings.budget > 0 &&
            spent + estimate > state.settings.budget && (
              <p className="warning">
                This may exceed your ${state.settings.budget.toFixed(2)}{" "}
                advisory budget.
              </p>
            )}
          <p className="hint">
            Estimates and warnings are not hard billing limits. Check actual
            charges in your OpenAI account.
          </p>
          <button className="primary" onClick={() => request(true)}>
            Confirm request
          </button>
        </Modal>
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
  return (
    <>
      <button
        className="text-button back"
        onClick={async () => {
          if (await save(false)) onBack();
        }}
      >
        <ChevronLeft size={16} /> Back to the Academy
      </button>
      <div className="lesson-header">
        <div className="eyebrow">
          {lesson.discipline} · LESSON{" "}
          {lessons.filter((l) => l.faculty === lesson.faculty).indexOf(lesson) +
            1}{" "}
          OF {lessons.filter((l) => l.faculty === lesson.faculty).length} ·
          ABOUT 5 MINUTES
        </div>
        <h1>{lesson.title}</h1>
        <p>{lesson.objective}</p>
      </div>
      <div className="lesson-layout">
        <article className="paper-card lesson-concept">
          <span className="step-label">01 · THE IDEA</span>
          <h2>One thing to notice</h2>
          <p>{lesson.explanation}</p>
          <span className="step-label">02 · SEE IT AT WORK</span>
          <blockquote>{lesson.example}</blockquote>
          {lesson.weakExample && (
            <>
              <h3>A weaker fit for this intention</h3>
              <p>{lesson.weakExample}</p>
              <p className="hint">
                This is contextual craft advice, not a rule forbidding an
                artistic choice.
              </p>
            </>
          )}
          <h3>What to look for</h3>
          <ul className="assessment-list">
            {lesson.assessment.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {lesson.review.length > 0 && (
            <div className="review-links">
              <p className="hint">
                Before writing, recall one choice from an earlier exercise:
              </p>
              {lesson.review.map((id) => (
                <button
                  key={id}
                  className="text-button"
                  onClick={() => onNext(id)}
                >
                  {lessons.find((l) => l.id === id)?.title}{" "}
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          )}
          <details>
            <summary>Sources and teaching limits</summary>
            <p>
              Examples, tasks and assessment are original instructional design.
              Private books and excerpts are never automatically sent to the
              tutor.
            </p>
            {lesson.sources.map((id) => (
              <div key={id}>
                <strong>{state.sources[id]?.title || id}</strong>
                <p>
                  {state.sources[id]?.locator ||
                    "Legacy reference; exact scope not recorded."}
                </p>
                <p className="hint">
                  {state.sources[id]?.scope || "Unverified custom reference."}
                </p>
              </div>
            ))}
          </details>
          <div className="margin-note">
            <Leaf size={18} />
            <p>{personalPrompt(state.profile)}</p>
          </div>
        </article>
        <section className="paper-card exercise">
          <span className="step-label">03 · YOUR TURN</span>
          <h2>A little deliberate practice</h2>
          {lesson.transferPrompt && (
            <label className="challenge-toggle">
              <input
                type="checkbox"
                disabled={saving}
                checked={!!practicePrompt}
                onChange={async (e) => {
                  const fresh = e.target.checked;
                  const previous = practicePrompt;
                  setPracticePrompt(fresh ? lesson.transferPrompt : "");
                  if (!(await save(false))) {
                    setPracticePrompt(previous);
                    return;
                  }
                  setBody("");
                  setRevision("");
                  setReflection("");
                }}
              />
              Try an unfamiliar challenge (earlier work stays in attempt
              history)
            </label>
          )}
          <p>{practicePrompt || lesson.minimumTask || lesson.exercise}</p>
          {lesson.extension && (
            <details>
              <summary>Optional longer work — saved and resumable</summary>
              <p>{lesson.extension}</p>
              <p>{lesson.exercise}</p>
            </details>
          )}
          {attempt?.completedAt && (
            <p className="hint">
              Previously completed practice is retained. Completion is not skill
              evidence.
            </p>
          )}
          {!!attempt?.feedback &&
            attempt.feedbackVersion !== lesson.version && (
              <p className="hint">
                Saved feedback belongs to an earlier content version and is
                retained for reference.
              </p>
            )}
          <p className="hint">
            1 min notice · 3 min create · 1 min reflect. {lesson.reflection}
          </p>
          {lesson.faculty === "music" ? (
            <MusicWorkbench
              key={id + practicePrompt}
              example={lesson.musicExample}
              value={body}
              onChange={setBody}
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
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={20000}
                placeholder="An imperfect first line is a perfectly good beginning…"
              />
            </>
          )}
          <div className="editor-meta">
            <span>
              {lesson.faculty === "music"
                ? "Musical sketch"
                : `${words(body)} words`}
            </span>
            <span>{saved ? "Saved locally" : "Saving…"}</span>
          </div>
          {!unlocked && (
            <p className="hint">
              Recommended first:{" "}
              {lesson.skillDependencies
                .map((id) => lessons.find((l) => l.id === id)?.title)
                .join(", ")}
              . You can still practise or revisit a skill now; prior completion
              does not prove readiness.
            </p>
          )}
          <label>
            One choice worth noticing
            <textarea
              rows={2}
              maxLength={2000}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="I chose… because I wanted the reader to…"
            />
          </label>
          <div className="button-row">
            <button
              className="primary"
              disabled={
                saving ||
                (lesson.faculty === "music"
                  ? !meaningfulSketch(revision || body)
                  : words(body) < lesson.minimumWords) ||
                reflection.trim().length < 3
              }
              onClick={() => save(true)}
            >
              <Check size={16} />
              {attempt?.completedAt ? "Lesson completed" : "Complete practice"}
            </button>
            <button className="text-button" onClick={() => save(false)}>
              Save draft
            </button>
          </div>
          <p className="hint">
            Feedback is optional. Meaningful practice counts even while offline.
          </p>
        </section>
      </div>
      <section className="paper-card">
        <details>
          <summary
            onClick={() =>
              window.bard.attemptHistory(id).then(setAttemptHistory).catch(fail)
            }
          >
            Earlier saved attempts
          </summary>
          {!history.length && (
            <p>
              Earlier versions appear here after you change saved work. Your
              current draft is saved separately.
            </p>
          )}
          {history.map((h) => (
            <div key={h.id} className="evidence-record">
              <p>
                {new Date(h.createdAt).toLocaleString()} · content version{" "}
                {h.contentVersion || "legacy"}
              </p>
              <p>{h.practicePrompt || "Original exercise"}</p>
              <blockquote>
                {lesson.faculty === "music" ? musicText(h.body) : h.body}
              </blockquote>
              {h.revision && (
                <blockquote>
                  {lesson.faculty === "music"
                    ? musicText(h.revision)
                    : h.revision}
                </blockquote>
              )}
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
      </section>
      <EvidencePanel
        key={id}
        lesson={lesson}
        state={state}
        beforeSave={() => save(false)}
        refresh={refresh}
        fail={fail}
      />
      <section className="paper-card lesson-feedback">
        <span className="step-label">04 · REFLECT & REVISE</span>
        <h2>A conversation about your craft</h2>
        <Tutor
          state={state}
          fail={fail}
          refresh={refresh}
          text={revision || body}
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
        <details>
          <summary>Try a revision</summary>
          <div>
            <p>Keep your original. Give the idea another pass.</p>
            {lesson.faculty === "music" ? (
              <>
                {!revision && (
                  <button
                    className="secondary"
                    onClick={() => setRevision(body)}
                  >
                    Copy original into revision
                  </button>
                )}
                {revision && (
                  <MusicWorkbench
                    value={revision}
                    onChange={setRevision}
                    lessonId={id}
                    fail={fail}
                    beforeRecord={() => save(false)}
                    revision
                  />
                )}
              </>
            ) : (
              <>
                <textarea
                  aria-label="Keep your original. Give the idea another pass."
                  rows={5}
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  maxLength={20000}
                />
              </>
            )}
          </div>
          <button className="secondary" onClick={() => save(false)}>
            Save revision
          </button>
        </details>
      </section>
      <div className="button-row lesson-bottom">
        <button
          className="secondary"
          onClick={() =>
            onStudio({
              title: lesson.title + " — practice",
              body:
                lesson.faculty === "music"
                  ? musicText(revision || body)
                  : revision || body,
            })
          }
        >
          Open this draft in the Scriptorium <Feather size={16} />
        </button>
        {attempt?.completedAt &&
          lessons.filter((l) => l.faculty === lesson.faculty).indexOf(lesson) <
            lessons.filter((l) => l.faculty === lesson.faculty).length - 1 && (
            <button
              className="primary"
              onClick={() => {
                const path = lessons.filter(
                  (l) => l.faculty === lesson.faculty,
                );
                onNext(path[path.indexOf(lesson) + 1].id);
              }}
            >
              Next lesson <ArrowRight size={16} />
            </button>
          )}
      </div>
    </>
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
    [testConfirm, setTestConfirm] = useState(false),
    [testResult, setTestResult] = useState<{
      success: boolean;
      message: string;
      detail?: string;
    } | null>(null);
  async function testConnection() {
    setTestConfirm(false);
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
            onClick={() => setTestConfirm(true)}
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
          {testConfirm && (
            <Modal
              title="Test GPT-6 Luna connection?"
              onClose={() => setTestConfirm(false)}
            >
              <p>
                This sends only “Reply with only OK.” to OpenAI using{" "}
                <strong>gpt-6-luna</strong>, with a limit of 64 output tokens.
                There are no automatic retries or model substitutions.
              </p>
              <p>
                {state.settings.inputPrice > 0 && state.settings.outputPrice > 0
                  ? `Approximate cost: $${((10 * state.settings.inputPrice + 64 * state.settings.outputPrice) / 1e6).toFixed(6)}. Recorded spending: $${spent.toFixed(4)}.`
                  : "A small API charge may apply. No cost is assumed because token prices have not been configured."}
              </p>
              {state.settings.budget > 0 &&
                state.settings.inputPrice > 0 &&
                state.settings.outputPrice > 0 &&
                spent +
                  (10 * state.settings.inputPrice +
                    64 * state.settings.outputPrice) /
                    1e6 >
                  state.settings.budget && (
                  <p className="warning">
                    This may exceed your advisory budget.
                  </p>
                )}
              <p className="hint">
                This verifies a real response from the requested model, not
                merely that a key was entered. Budget warnings are not hard
                billing limits.
              </p>
              <button className="primary" onClick={testConnection}>
                Send connection test
              </button>
            </Modal>
          )}
          <p className="hint">
            Writing, lessons, and revision history work without an API key. An
            unavailable model never triggers a fallback.
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
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.confirmRequests}
              onChange={(e) => patch({ confirmRequests: e.target.checked })}
            />
            Confirm each request before sending
          </label>
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
            Zero disables the warning. This is a local estimate, not a hard
            billing limit. It does not include usage from other apps.
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
