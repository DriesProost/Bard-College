import {
  meaningfulSketch,
  parseSketch,
  musicalContentKey,
} from "../src/shared/music.js";
import fs from "node:fs";
import pathModule from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  defaultProfile,
  defaultSettings,
  type State,
  type Project,
  type Profile,
  type Settings,
  type Attempt,
  type Feedback,
  type Snapshot,
  type Usage,
  type EvidenceLevel,
  type SkillEvidence,
  type AttemptHistory,
} from "../src/shared/model.js";
import { lessons, sources, criterionId } from "../src/shared/curriculum.js";
export class Store {
  db: DatabaseSync;
  backupPath = "";
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    try {
      const version = Number(
        (this.db.prepare("PRAGMA user_version").get() as any).user_version,
      );
      if (version > 2)
        throw Error(
          "This profile was created by a newer application. No changes were made.",
        );
      const existed = !!this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('attempts','projects','config') LIMIT 1",
        )
        .get();
      if (version < 2 && existed && path !== ":memory:") {
        const dir = pathModule.join(pathModule.dirname(path), "backups");
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        this.backupPath = pathModule.join(
          dir,
          `college-before-phase1-${Date.now()}-${crypto.randomUUID()}.sqlite`,
        );
        this.db.prepare("VACUUM INTO ?").run(this.backupPath);
        fs.chmodSync(this.backupPath, 0o600);
      }
      this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
      this.transaction(() => {
        this.db.exec(`
 CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,kind TEXT NOT NULL,completed INTEGER NOT NULL,updatedAt TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY,projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,title TEXT NOT NULL,body TEXT NOT NULL,createdAt TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS attempts(lessonId TEXT PRIMARY KEY,body TEXT NOT NULL,revision TEXT NOT NULL,reflection TEXT NOT NULL DEFAULT '',completedAt TEXT NOT NULL,feedback TEXT,feedbackText TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS events(key TEXT PRIMARY KEY,xp INTEGER NOT NULL,discipline TEXT NOT NULL,day TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS usage(input INTEGER NOT NULL,output INTEGER NOT NULL,cost REAL NOT NULL,createdAt TEXT NOT NULL);`);
        const columns = this.db
          .prepare("PRAGMA table_info(attempts)")
          .all() as {
          name: string;
        }[];
        if (!columns.some((c) => c.name === "reflection"))
          this.db.exec(
            "ALTER TABLE attempts ADD COLUMN reflection TEXT NOT NULL DEFAULT ''",
          );
        if (!columns.some((c) => c.name === "feedbackText"))
          this.db.exec(
            "ALTER TABLE attempts ADD COLUMN feedbackText TEXT NOT NULL DEFAULT ''",
          );
        const add = (table: string, name: string, definition: string) => {
          const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as {
            name: string;
          }[];
          if (!cols.some((c) => c.name === name))
            this.db.exec(
              `ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`,
            );
        };
        add("attempts", "feedbackVersion", "INTEGER NOT NULL DEFAULT 0");
        add("attempts", "faculty", "TEXT NOT NULL DEFAULT 'unassigned'");
        add("attempts", "contentVersion", "INTEGER NOT NULL DEFAULT 0");
        add("attempts", "practicePrompt", "TEXT NOT NULL DEFAULT ''");
        add("attempts", "legacy", "INTEGER NOT NULL DEFAULT 1");
        add("events", "faculty", "TEXT NOT NULL DEFAULT 'unassigned'");
        this.db
          .exec(`CREATE TABLE IF NOT EXISTS attempt_history(id INTEGER PRIMARY KEY,lessonId TEXT NOT NULL,faculty TEXT NOT NULL,contentVersion INTEGER NOT NULL,body TEXT NOT NULL,revision TEXT NOT NULL,reflection TEXT NOT NULL,practicePrompt TEXT NOT NULL,createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS skill_evidence(id INTEGER PRIMARY KEY,lessonId TEXT NOT NULL,faculty TEXT NOT NULL,contentVersion INTEGER NOT NULL,criterionId TEXT NOT NULL,level TEXT NOT NULL,draft TEXT NOT NULL,reflection TEXT NOT NULL,practicePrompt TEXT NOT NULL,reviewer TEXT NOT NULL,createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,appliedAt TEXT NOT NULL);`);
        add("attempt_history", "feedback", "TEXT");
        add("attempt_history", "feedbackText", "TEXT NOT NULL DEFAULT ''");
        add("attempt_history", "feedbackVersion", "INTEGER NOT NULL DEFAULT 0");
        add("attempt_history", "completedAt", "TEXT NOT NULL DEFAULT ''");
        if (version < 2) {
          const originalIds = Array.from(
            { length: 30 },
            (_, i) => `lesson-${i + 1}`,
          );
          for (const id of originalIds) {
            this.db
              .prepare("UPDATE attempts SET faculty='writing' WHERE lessonId=?")
              .run(id);
            for (const prefix of [
              "attempt:",
              "lesson:",
              "revision:",
              "practice:",
            ])
              this.db
                .prepare(
                  "UPDATE events SET faculty='writing' WHERE key=? OR key LIKE ?",
                )
                .run(prefix + id, prefix + id + ":%");
          }
          this.db
            .prepare(
              "UPDATE events SET faculty='writing' WHERE key LIKE 'finish:%' OR key LIKE 'revise:%'",
            )
            .run();
          this.db
            .prepare("INSERT OR IGNORE INTO schema_migrations VALUES(2,?)")
            .run(new Date().toISOString());
          this.db.exec("PRAGMA user_version=2");
        }
        if (this.backupPath) this.set("phase1DatabaseBackup", this.backupPath);
        else this.backupPath = this.get("phase1DatabaseBackup", "");
      });
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  get<T>(key: string, fallback: T): T {
    const row = this.db
      .prepare("SELECT value FROM config WHERE key=?")
      .get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : fallback;
  }
  set(key: string, value: unknown) {
    this.db
      .prepare(
        "INSERT INTO config VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, JSON.stringify(value));
  }
  profile() {
    return this.get<Profile>("profile", defaultProfile);
  }
  settings() {
    return this.get<Settings>("settings", defaultSettings);
  }
  state(): Omit<
    State,
    | "hasKey"
    | "secureStorage"
    | "credentialProtection"
    | "contentUpdate"
    | "backups"
  > {
    return {
      curriculum: lessons,
      curriculumVersion: 2,
      sources,
      evidence: this.db
        .prepare("SELECT * FROM skill_evidence ORDER BY id")
        .all() as SkillEvidence[],
      profile: this.profile(),
      settings: this.settings(),
      projects: this.projects(),
      attempts: (
        this.db.prepare("SELECT * FROM attempts").all() as unknown as (Omit<
          Attempt,
          "feedback"
        > & { feedback: string | null })[]
      ).map((a) => ({
        ...a,
        legacy: !!a.legacy,
        feedback: a.feedback ? JSON.parse(a.feedback) : null,
      })),
      events: this.db.prepare("SELECT * FROM events").all() as State["events"],
      usage: this.db.prepare("SELECT * FROM usage").all() as Usage[],
    };
  }
  projects() {
    return (
      this.db
        .prepare("SELECT * FROM projects ORDER BY updatedAt DESC")
        .all() as unknown as Project[]
    ).map((p) => ({ ...p, completed: !!p.completed }));
  }
  project(id: string) {
    return this.projects().find((p) => p.id === id);
  }
  event(
    key: string,
    xp: number,
    discipline: string,
    faculty: string = "writing",
  ) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO events(key,xp,discipline,day,faculty) VALUES(?,?,?,?,?)",
      )
      .run(
        key,
        xp,
        discipline,
        new Date().toLocaleDateString("en-CA"),
        faculty,
      );
  }
  saveProject(p: Omit<Project, "updatedAt">): Project {
    return this.transaction(() => {
      const old = this.project(p.id);
      const result = { ...p, updatedAt: new Date().toISOString() };
      this.db
        .prepare(
          "INSERT INTO projects VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,kind=excluded.kind,completed=excluded.completed,updatedAt=excluded.updatedAt",
        )
        .run(
          p.id,
          p.title,
          p.body,
          p.kind,
          Number(p.completed),
          result.updatedAt,
        );
      if (p.completed && p.body.trim().split(/\s+/).length >= 30) {
        this.event(`finish:${p.id}`, 40, "The Quill");
        if (!old?.completed) this.snapshot(p.id);
      }
      return result;
    });
  }
  deleteProject(id: string) {
    this.db.prepare("DELETE FROM projects WHERE id=?").run(id);
  }
  snapshot(id: string) {
    const p = this.project(id);
    if (!p) throw Error("Writing project not found.");
    const last = this.db
      .prepare(
        "SELECT body,title FROM snapshots WHERE projectId=? ORDER BY id DESC LIMIT 1",
      )
      .get(id) as { body: string; title: string } | undefined;
    if (last?.body === p.body && last.title === p.title) return;
    this.db
      .prepare(
        "INSERT INTO snapshots(projectId,title,body,createdAt) VALUES(?,?,?,?)",
      )
      .run(id, p.title, p.body, new Date().toISOString());
    if (last && Math.abs(last.body.length - p.body.length) >= 20)
      this.event(`revise:${id}`, 15, "The Quill");
  }
  history(id: string) {
    return this.db
      .prepare("SELECT * FROM snapshots WHERE projectId=? ORDER BY id DESC")
      .all(id) as Snapshot[];
  }
  saveAttempt(a: {
    lessonId: string;
    body: string;
    revision: string;
    reflection: string;
    complete: boolean;
    practicePrompt?: string;
  }) {
    const lesson = lessons.find((l) => l.id === a.lessonId);
    if (!lesson) throw Error("Unknown lesson.");
    this.transaction(() => {
      const old = this.db
        .prepare("SELECT * FROM attempts WHERE lessonId=?")
        .get(a.lessonId) as unknown as Attempt | undefined;
      const done =
        old?.completedAt || (a.complete ? new Date().toISOString() : "");
      if (a.complete && a.reflection.trim().length < 3)
        throw Error(
          "Add a short reflection explaining one creative choice before completing the lesson.",
        );
      if (lesson.faculty === "music" && a.body && !parseSketch(a.body))
        throw Error(
          "Invalid musical sketch. Your earlier saved attempt is unchanged.",
        );
      if (lesson.faculty === "music" && a.revision && !parseSketch(a.revision))
        throw Error("Invalid musical revision.");
      if (
        a.complete &&
        lesson.faculty === "music" &&
        !meaningfulSketch(a.revision || a.body)
      )
        throw Error(
          "Add an intention and at least one played or planned note before completing practice.",
        );
      if (
        a.complete &&
        lesson.faculty !== "music" &&
        a.body.trim().split(/\s+/).length < lesson.minimumWords
      )
        throw Error(
          `Write at least ${lesson.minimumWords} words for this short attempt. Completion records participation, not mastery.`,
        );
      if (a.practicePrompt && a.practicePrompt !== lesson.transferPrompt)
        throw Error("Unknown fresh challenge. Reload the lesson.");
      const changed =
        !old ||
        old.body !== a.body ||
        old.revision !== a.revision ||
        old.reflection !== a.reflection ||
        (old.practicePrompt || "") !== (a.practicePrompt || "") ||
        old.contentVersion !== lesson.version;
      if (changed && old) this.archiveAttempt(old);
      this.db
        .prepare(
          "INSERT INTO attempts(lessonId,body,revision,reflection,completedAt,feedback,faculty,contentVersion,practicePrompt,legacy) VALUES(?,?,?,?,?,NULL,?,?,?,0) ON CONFLICT(lessonId) DO UPDATE SET body=excluded.body,revision=excluded.revision,reflection=excluded.reflection,completedAt=excluded.completedAt,feedback=attempts.feedback,faculty=excluded.faculty,contentVersion=excluded.contentVersion,practicePrompt=excluded.practicePrompt,legacy=0",
        )
        .run(
          a.lessonId,
          a.body,
          a.revision,
          a.reflection,
          done,
          lesson.faculty,
          lesson.version,
          a.practicePrompt || "",
        );
      if (
        lesson.faculty === "music"
          ? meaningfulSketch(a.body)
          : a.body.trim().split(/\s+/).length >= lesson.minimumWords
      )
        this.event(
          `attempt:${lesson.id}`,
          10,
          lesson.discipline,
          lesson.faculty,
        );
      if (
        a.complete &&
        old?.completedAt &&
        a.body.trim() !== old.body.trim() &&
        a.reflection.trim() !== old.reflection?.trim()
      )
        this.event(
          `practice:${lesson.id}:${new Date().toLocaleDateString("en-CA")}`,
          5,
          lesson.discipline,
          lesson.faculty,
        );
      if (a.complete)
        this.event(
          `lesson:${lesson.id}`,
          30,
          lesson.discipline,
          lesson.faculty,
        );
      if (
        a.revision.trim().split(/\s+/).length >= lesson.minimumWords &&
        a.revision.trim() !== a.body.trim()
      )
        this.event(
          `revision:${lesson.id}`,
          15,
          lesson.discipline,
          lesson.faculty,
        );
    });
  }
  private archiveAttempt(a: Attempt) {
    this.db
      .prepare(
        "INSERT INTO attempt_history(lessonId,faculty,contentVersion,body,revision,reflection,practicePrompt,createdAt,feedback,feedbackText,feedbackVersion,completedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        a.lessonId,
        a.faculty || "unassigned",
        a.contentVersion || 0,
        a.body,
        a.revision,
        a.reflection || "",
        a.practicePrompt || "",
        new Date().toISOString(),
        typeof a.feedback === "string"
          ? a.feedback
          : a.feedback
            ? JSON.stringify(a.feedback)
            : null,
        a.feedbackText || "",
        a.feedbackVersion || 0,
        a.completedAt || "",
      );
  }
  attemptHistory(id: string) {
    const rows = this.db
      .prepare(
        "SELECT * FROM attempt_history WHERE lessonId=? ORDER BY id DESC",
      )
      .all(id) as any[];
    return rows.map((row) => ({
      ...row,
      feedback: row.feedback ? JSON.parse(row.feedback) : null,
    })) as AttemptHistory[];
  }
  recordEvidence(request: {
    lessonId: string;
    criteria: { criterionId: string; level: EvidenceLevel }[];
  }) {
    const lesson = lessons.find((l) => l.id === request.lessonId);
    if (!lesson) throw Error("Unknown lesson.");
    this.transaction(() => {
      const attempt = this.db
        .prepare("SELECT * FROM attempts WHERE lessonId=?")
        .get(lesson.id) as unknown as Attempt | undefined;
      if (
        !attempt ||
        !(attempt.revision || attempt.body).trim() ||
        attempt.reflection.trim().length < 3
      )
        throw Error("Save an attempt and a brief observation first.");
      if (attempt.contentVersion !== lesson.version)
        throw Error(
          "Save your current draft before recording evidence for this lesson version.",
        );
      const draft = attempt.revision || attempt.body;
      if (lesson.faculty === "music" && !meaningfulSketch(draft))
        throw Error(
          "Save a musical idea with an intention before reporting evidence.",
        );
      const allowed = lesson.assessment.map((_, i) => criterionId(lesson, i));
      if (
        !request.criteria.length ||
        new Set(request.criteria.map((c) => c.criterionId)).size !==
          request.criteria.length
      )
        throw Error("Choose distinct assessment criteria.");
      for (const c of request.criteria) {
        if (
          !allowed.includes(c.criterionId) ||
          !["introduced", "supported", "independent", "retained"].includes(
            c.level,
          )
        )
          throw Error("Unknown assessment criterion or evidence level.");
        if (c.level === "retained") {
          const previous = this.db
            .prepare(
              "SELECT draft FROM skill_evidence WHERE lessonId=? AND criterionId=? AND contentVersion=? AND level IN ('independent','retained') ORDER BY id DESC LIMIT 1",
            )
            .get(lesson.id, c.criterionId, lesson.version) as
            { draft: string } | undefined;
          if (
            !previous ||
            !attempt.practicePrompt ||
            attempt.practicePrompt !== lesson.transferPrompt ||
            (lesson.faculty === "music"
              ? musicalContentKey(previous.draft) === musicalContentKey(draft)
              : previous.draft.trim() === draft.trim())
          )
            throw Error(
              "First record an independent attempt, then try the fresh challenge with different work to report retained evidence.",
            );
        }
        const last = this.db
          .prepare(
            "SELECT * FROM skill_evidence WHERE lessonId=? AND criterionId=? ORDER BY id DESC LIMIT 1",
          )
          .get(lesson.id, c.criterionId) as SkillEvidence | undefined;
        if (
          last?.draft === draft &&
          last.level === c.level &&
          last.reflection === attempt.reflection &&
          last.contentVersion === lesson.version &&
          last.practicePrompt === (attempt.practicePrompt || "")
        )
          continue;
        this.db
          .prepare(
            "INSERT INTO skill_evidence(lessonId,faculty,contentVersion,criterionId,level,draft,reflection,practicePrompt,reviewer,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            lesson.id,
            lesson.faculty,
            lesson.version,
            c.criterionId,
            c.level,
            draft,
            attempt.reflection,
            attempt.practicePrompt || "",
            "self",
            new Date().toISOString(),
          );
      }
    });
  }
  feedback(
    lessonId: string,
    text: string,
    feedback: Feedback,
    contentVersion = lessons.find((l) => l.id === lessonId)?.version,
  ) {
    const a = this.db
      .prepare(
        "SELECT body,revision,contentVersion FROM attempts WHERE lessonId=?",
      )
      .get(lessonId) as
      { body: string; revision: string; contentVersion: number } | undefined;
    if (
      a &&
      a.contentVersion === contentVersion &&
      lessons.find((l) => l.id === lessonId)?.version === contentVersion &&
      (a.revision || a.body).trim() === text.trim()
    )
      this.db
        .prepare(
          "UPDATE attempts SET feedback=?, feedbackText=?, feedbackVersion=? WHERE lessonId=?",
        )
        .run(
          JSON.stringify(feedback),
          a.revision || a.body,
          lessons.find((l) => l.id === lessonId)?.version || 0,
          lessonId,
        );
  }
  recordUsage(u: Usage) {
    this.db
      .prepare("INSERT INTO usage VALUES(?,?,?,?)")
      .run(u.input, u.output, u.cost, u.createdAt);
  }
  close() {
    this.db.close();
  }
}
