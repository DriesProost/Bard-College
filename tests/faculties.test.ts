import { saveReviewedAttempt } from "./tutor-support.js";
import { blankSketch, place } from "../src/shared/music.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { Store } from "../electron/store.js";
import { ContentManager } from "../electron/content.js";
import {
  setCurriculum,
  lessons,
  curriculumSchema,
  criterionId,
} from "../src/shared/curriculum.js";
import { facultyProgress } from "../src/shared/progression.js";
import { askTutor } from "../electron/tutor.js";
import { defaultProfile, defaultSettings } from "../src/shared/model.js";
import type OpenAI from "openai";
const shipped = path.resolve("curriculum/lessons.json"),
  legacyFile = path.resolve("curriculum/legacy-v1.json");
const content = JSON.parse(fs.readFileSync(shipped, "utf8")),
  legacy = JSON.parse(fs.readFileSync(legacyFile, "utf8"));
setCurriculum(content);
function temporary(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "bard-faculty-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const a = (id = lessons[0].id) => ({
  lessonId: id,
  body: "The gate creaked softly.",
  revision: "",
  reflection: "Quieter",
  complete: true,
});
test("Phase 1 contains all 30 deployed IDs and eight additions, independent graphs and traceable original tasks", () => {
  assert.equal(lessons.length, 47);
  for (const original of legacy.lessons) {
    const current = lessons.find((l) => l.id === original.id)!;
    assert.notEqual(current.explanation, original.explanation);
    assert.notDeepEqual(current.assessment, original.assessment);
    assert.ok(current.version > original.version);
  }
  for (let i = 1; i <= 30; i++)
    assert.ok(lessons.some((l) => l.id === `lesson-${i}`));
  assert.equal(lessons.filter((l) => l.id.startsWith("writing-")).length, 8);
  assert.ok(
    lessons.every(
      (l) =>
        l.minimumTask &&
        l.transferPrompt &&
        l.extension &&
        l.weakExample &&
        l.assessment.length >= 2,
    ),
  );
  assert.equal(new Set(lessons.map((l) => l.transferPrompt)).size, 47);
  for (const l of lessons)
    for (const id of l.sources) assert.ok(content.sources[id]);
  const cycle = structuredClone(content);
  cycle.lessons[0].skillDependencies = [cycle.lessons.at(-1).id];
  assert.equal(curriculumSchema.safeParse(cycle).success, false);
  const cross = structuredClone(content);
  cross.lessons[0].faculty = "music";
  assert.equal(curriculumSchema.safeParse(cross).success, false);
  assert.equal(curriculumSchema.safeParse(legacy).success, true);
});
test("pristine legacy curriculum upgrades with exact recovery copy and no repeated rewrite", () =>
  temporary((dir) => {
    const file = path.join(dir, "curriculum.json");
    fs.writeFileSync(file, JSON.stringify(legacy));
    const old = fs.readFileSync(file);
    const manager = new ContentManager(dir, shipped, legacyFile);
    assert.equal(manager.current.lessons.length, 47);
    assert.deepEqual(fs.readFileSync(manager.backupPath), old);
    assert.equal(manager.update, null);
    const again = new ContentManager(dir, shipped, legacyFile);
    assert.equal(again.update, null);
    assert.equal(fs.readdirSync(path.join(dir, "backups")).length, 1);
  }));
test("custom content is untouched until previewed merge; preserve custom IDs and unknown citation limitations", () =>
  temporary((dir) => {
    const custom = structuredClone(legacy);
    custom.lessons[0].explanation = "My own teaching note";
    custom.lessons.push({
      ...custom.lessons.at(-1),
      id: "lesson-custom",
      title: "Private custom lesson",
      sources: ["my-reference"],
    });
    const file = path.join(dir, "curriculum.json");
    fs.writeFileSync(file, JSON.stringify(custom));
    const before = fs.readFileSync(file);
    const m = new ContentManager(dir, shipped, legacyFile);
    assert.ok(m.update);
    assert.deepEqual(fs.readFileSync(file), before);
    const merged = m.apply([]);
    assert.equal(merged.lessons.length, 48);
    assert.equal(merged.lessons[0].explanation, "My own teaching note");
    assert.ok(merged.lessons.find((l) => l.id === "lesson-custom"));
    assert.match(merged.sources["my-reference"].scope, /Unverified/);
    assert.deepEqual(fs.readFileSync(m.backupPath), before);
    const id = lessons[0].id;
    m.apply([id]);
    assert.equal(
      m.current.lessons[0].explanation,
      content.lessons[0].explanation,
    );
    assert.throws(() => m.apply(["not-a-conflict"]), /Unknown/);
  }));
test("unknown content versions and failed recovery copy never overwrite custom content", () =>
  temporary((dir) => {
    const file = path.join(dir, "curriculum.json");
    const future = JSON.stringify({ ...content, version: 99 });
    fs.writeFileSync(file, future);
    assert.throws(() => new ContentManager(dir, shipped, legacyFile));
    assert.equal(fs.readFileSync(file, "utf8"), future);
    fs.writeFileSync(file, JSON.stringify(legacy));
    fs.writeFileSync(path.join(dir, "backups"), "occupied");
    const before = fs.readFileSync(file);
    assert.throws(() => new ContentManager(dir, shipped, legacyFile));
    assert.deepEqual(fs.readFileSync(file), before);
  }));
test("WAL migration recovery copy preserves projects, snapshots, attempts, feedback, settings, ciphertext and XP; lyrical Lute is Writing only", () =>
  temporary((dir) => {
    const file = path.join(dir, "college.sqlite");
    const original = new DatabaseSync(file);
    original.exec(`PRAGMA journal_mode=WAL; CREATE TABLE config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE projects(id TEXT PRIMARY KEY,title TEXT,body TEXT,kind TEXT,completed INTEGER,updatedAt TEXT);
 CREATE TABLE snapshots(id INTEGER PRIMARY KEY,projectId TEXT,title TEXT,body TEXT,createdAt TEXT);
 CREATE TABLE attempts(lessonId TEXT PRIMARY KEY,body TEXT,revision TEXT,reflection TEXT,completedAt TEXT,feedback TEXT,feedbackText TEXT);
 CREATE TABLE events(key TEXT PRIMARY KEY,xp INTEGER,discipline TEXT,day TEXT);`);
    const id = randomUUID();
    original
      .prepare("INSERT INTO projects VALUES(?,?,?,?,?,?)")
      .run(id, "Saved song", "original draft", "Song", 0, "2026-10-19");
    original
      .prepare("INSERT INTO snapshots VALUES(1,?,?,?,?)")
      .run(id, "Before", "older draft", "2026-10-18");
    const feedback = {
      strength: "A clear image",
      reason: "It gives detail",
      improvements: ["Try space"],
      question: "Why this image?",
    };
    original
      .prepare("INSERT INTO attempts VALUES(?,?,?,?,?,?,?)")
      .run(
        "lesson-17",
        "old lyrical verse",
        "old revision",
        "old choice",
        "2026-10-19",
        JSON.stringify(feedback),
        "old lyrical verse",
      );
    original
      .prepare("INSERT INTO events VALUES(?,?,?,?)")
      .run("lesson:lesson-17", 30, "The Lute", "2026-10-19");
    original
      .prepare("INSERT INTO events VALUES(?,?,?,?)")
      .run("lesson:unknown-custom", 12, "The Lute", "2026-10-19");
    for (const [key, value] of [
      ["profile", { ...defaultProfile, name: "Dries" }],
      ["settings", defaultSettings],
      ["encryptedKey", "ciphertext-fixture"],
    ] as const)
      original
        .prepare("INSERT INTO config VALUES(?,?)")
        .run(key, JSON.stringify(value));
    // Keep the WAL connection open: a copy of just the main DB would miss data.
    const s = new Store(file);
    try {
      const backup = new DatabaseSync(s.backupPath);
      assert.equal(
        (backup.prepare("SELECT body FROM projects").get() as any).body,
        "original draft",
      );
      assert.equal(
        (backup.prepare("PRAGMA user_version").get() as any).user_version,
        0,
      );
      backup.close();
      assert.equal(s.project(id)?.body, "original draft");
      assert.equal(s.history(id)[0].body, "older draft");
      assert.equal(s.profile().name, "Dries");
      assert.deepEqual(s.settings(), defaultSettings);
      assert.equal(s.get("encryptedKey", ""), "ciphertext-fixture");
      const state = s.state();
      assert.equal(state.attempts[0].completedAt, "2026-10-19");
      assert.equal(state.attempts[0].revision, "old revision");
      assert.deepEqual(state.attempts[0].feedback, feedback);
      assert.equal(
        state.events.reduce((n, e) => n + e.xp, 0),
        42,
      );
      assert.equal(facultyProgress(state, "writing").completed, 1);
      assert.equal(facultyProgress(state, "writing").xp, 30);
      assert.equal(facultyProgress(state, "music").xp, 0);
      assert.equal(facultyProgress(state, "music").evidenceRecords, 0);
      assert.equal(
        state.events.find((e) => e.key.includes("unknown"))?.faculty,
        "unassigned",
      );
      const second = new Store(file);
      second.close();
      assert.equal(fs.readdirSync(path.join(dir, "backups")).length, 1);
      const recoveredFile = path.join(dir, "recovered.sqlite");
      fs.copyFileSync(s.backupPath, recoveredFile);
      const recovered = new Store(recoveredFile);
      try {
        assert.equal(recovered.project(id)?.body, "original draft");
        assert.equal(recovered.state().attempts[0].completedAt, "2026-10-19");
        assert.deepEqual(recovered.state().attempts[0].feedback, feedback);
      } finally {
        recovered.close();
      }
    } finally {
      s.close();
      original.close();
    }
  }));
test("failed migration rolls back added columns/version and retains a usable pre-migration backup", () =>
  temporary((dir) => {
    const file = path.join(dir, "broken.sqlite");
    const old = new DatabaseSync(file);
    old.exec(
      "CREATE TABLE config(key TEXT PRIMARY KEY,payload TEXT); CREATE TABLE attempts(lessonId TEXT PRIMARY KEY,body TEXT,revision TEXT,completedAt TEXT,feedback TEXT)",
    );
    old.close();
    assert.throws(() => new Store(file));
    const db = new DatabaseSync(file);
    assert.equal(
      (db.prepare("PRAGMA user_version").get() as any).user_version,
      0,
    );
    assert.equal(
      (db.prepare("PRAGMA table_info(attempts)").all() as any[]).some(
        (c) => c.name === "faculty",
      ),
      false,
    );
    db.close();
    assert.equal(fs.readdirSync(path.join(dir, "backups")).length, 1);
  }));
test("completion is participation; criterion reports are append-only, self-reported, versioned and require fresh work for retained claims", () =>
  temporary((dir) => {
    const s = new Store(path.join(dir, "college.sqlite"));
    try {
      const l = lessons[0],
        id = criterionId(l, 0),
        criteria = [{ criterionId: id, level: "independent" as const }];
      saveReviewedAttempt(s, a());
      assert.equal(s.state().evidence.length, 0);
      s.recordEvidence({ lessonId: l.id, criteria });
      s.recordEvidence({ lessonId: l.id, criteria });
      assert.equal(s.state().evidence.length, 1);
      assert.equal(s.state().evidence[0].reviewer, "self");
      assert.throws(
        () =>
          s.recordEvidence({
            lessonId: l.id,
            criteria: [{ criterionId: id, level: "retained" }],
          }),
        /fresh challenge/,
      );
      saveReviewedAttempt(s, { ...a(), practicePrompt: l.transferPrompt });
      assert.throws(
        () =>
          s.recordEvidence({
            lessonId: l.id,
            criteria: [{ criterionId: id, level: "retained" }],
          }),
        /different work/,
      );
      saveReviewedAttempt(s, {
        ...a(),
        body: "The empty room smelled of warm bread.",
        reflection: "More welcoming",
        practicePrompt: l.transferPrompt,
      });
      s.recordEvidence({
        lessonId: l.id,
        criteria: [{ criterionId: id, level: "retained" }],
      });
      assert.equal(s.state().evidence.length, 2);
      assert.equal(s.state().evidence[0].draft, a().body);
      assert.equal(facultyProgress(s.state(), "writing").retained, 1);
      assert.equal(facultyProgress(s.state(), "music").retained, 0);
      assert.ok(s.attemptHistory(l.id).some((h) => h.body === a().body));
      assert.ok(s.state().attempts[0].completedAt);
      const before = s.state().evidence.length;
      assert.throws(() =>
        s.recordEvidence({
          lessonId: l.id,
          criteria: [
            { criterionId: criterionId(l, 1), level: "supported" },
            { criterionId: "bad-id", level: "independent" },
          ],
        }),
      );
      assert.equal(s.state().evidence.length, before);
      const changed = structuredClone(content);
      changed.lessons[0].version++;
      setCurriculum(changed);
      assert.equal(facultyProgress(s.state(), "writing").retained, 0);
      assert.throws(
        () => s.recordEvidence({ lessonId: l.id, criteria }),
        /current draft/,
      );
    } finally {
      s.close();
      setCurriculum(content);
    }
  }));
test("Music fixture stays independent and may be attempted without any Writing completion", () =>
  temporary((dir) => {
    const fixture = structuredClone(content);
    fixture.lessons.push({
      ...fixture.lessons[0],
      id: "music-fixture",
      faculty: "music",
      prerequisite: null,
      skillDependencies: [],
      review: [],
    });
    setCurriculum(fixture);
    const s = new Store(path.join(dir, "college.sqlite"));
    try {
      const sketch = blankSketch();
      sketch.intent = "A quiet answer";
      sketch.phrases[0] = place(sketch.phrases[0], 0, 0, 0, 2);
      saveReviewedAttempt(s, {
        ...a("music-fixture"),
        body: JSON.stringify(sketch),
      });
      assert.equal(facultyProgress(s.state(), "music").completed, 1);
      assert.equal(facultyProgress(s.state(), "writing").completed, 0);
      assert.equal(facultyProgress(s.state(), "music").xp, 40);
    } finally {
      s.close();
      setCurriculum(content);
    }
  }));
test("AI receives the actual fresh task, intent-preserving rules and criteria, with no private source extracts or mastery assignment", async () => {
  let captured: any;
  const client = {
    responses: {
      parse: async (req: any) => {
        captured = req;
        return { output_parsed: null };
      },
    },
  } as unknown as OpenAI;
  const l = lessons[0];
  await askTutor(
    "fixture",
    {
      text: "My original scene",
      lessonId: l.id,
      practicePrompt: l.transferPrompt,
      confirmed: true,
    },
    defaultProfile,
    defaultSettings,
    0,
    client,
  );
  const input = JSON.parse(captured.input);
  assert.equal(captured.model, "gpt-6-luna");
  assert.equal(input.lesson.exercise, l.transferPrompt);
  assert.equal(input.lesson.faculty, "writing");
  assert.equal(input.lesson.criteria[0].id, criterionId(l, 0));
  assert.equal(input.lesson.sources, undefined);
  assert.equal(input.lesson.sourceText, undefined);
  assert.match(captured.instructions, /no audio has been heard/);
  assert.match(captured.instructions, /Preserve the student/);
  await assert.rejects(
    askTutor(
      "fixture",
      {
        text: "x",
        lessonId: l.id,
        practicePrompt: "invented",
        confirmed: true,
      },
      defaultProfile,
      defaultSettings,
      0,
      client,
    ),
    /Unknown fresh challenge/,
  );
});
