import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  blankSketch,
  counts,
  interval,
  meaningfulSketch,
  musicText,
  parseSketch,
  phraseSchema,
  pitch,
  pitchName,
  place,
  slotsPerBar,
  sketchSchema,
} from "../src/shared/music.js";
import { Recordings } from "../electron/recordings.js";
import { ContentManager } from "../electron/content.js";
import { Store } from "../electron/store.js";
import {
  setCurriculum,
  lessons,
  criterionId,
  curriculumSchema,
} from "../src/shared/curriculum.js";
import { facultyProgress } from "../src/shared/progression.js";
import { askTutor } from "../electron/tutor.js";
import { defaultProfile, defaultSettings } from "../src/shared/model.js";
import type OpenAI from "openai";
const shipped = path.resolve("curriculum/lessons.json"),
  legacy = path.resolve("curriculum/legacy-v1.json"),
  phase1 = path.resolve("curriculum/legacy-phase1-v2.json");
const content = JSON.parse(fs.readFileSync(shipped, "utf8"));
setCurriculum(content);
function temporary(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bard-music-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
function idea() {
  const s = blankSketch();
  s.intent = "An uncertain answer";
  s.phrases[0] = place(s.phrases[0], 0, 0, 0, 2);
  return s;
}
test("first nine approved Music units preserve order, readiness, sources, objectives and original playable examples; Writing remains byte-equivalent", () => {
  const writing = JSON.parse(fs.readFileSync(phase1, "utf8"));
  assert.deepEqual(content.lessons.slice(0, 38), writing.lessons);
  const units = lessons.filter((l) => l.faculty === "music");
  assert.deepEqual(
    units.map((l) => l.id),
    Array.from({ length: 9 }, (_, i) => `music-0${i + 1}`),
  );
  assert.deepEqual(units[6].skillDependencies, ["music-03", "music-06"]);
  assert.deepEqual(units[8].skillDependencies, ["music-04", "music-08"]);
  for (const l of units) {
    assert.ok(l.assessment.length >= 2);
    assert.ok(l.minimumTask);
    assert.ok(l.extension);
    assert.ok(l.musicExample);
    sketchSchema.parse(l.musicExample);
    for (const s of l.sources) assert.ok(content.sources[s]);
  }
  const durations = units[2].musicExample!.phrases[0];
  assert.deepEqual(
    durations.notes.map((n) => n.duration),
    [1, 1, 2, 2],
  );
  assert.equal(durations.notes.at(-1)!.tick, 6);
  assert.equal(units[4].musicExample!.phrases[0].meter, "6/8");
  assert.equal(units[4].musicExample!.phrases[1].meter, "3/4");
  assert.equal(units[8].musicExample!.phrases[0].bars, 2);
});
test("standard tuning, unisons, octaves and interval arithmetic are accurate across every fret", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((s) => pitch(s, 0)),
    [64, 59, 55, 50, 45, 40],
  );
  assert.equal(pitch(0, 0), pitch(1, 5));
  assert.equal(pitch(0, 0) - pitch(3, 2), 12);
  assert.equal(pitchName(pitch(0, 0)), "E4");
  assert.equal(pitchName(pitch(3, 2)), "E3");
  assert.equal(interval(pitch(0, 0), pitch(0, 7)), "perfect fifth");
  for (let s = 0; s < 6; s++)
    for (let f = 0; f <= 24; f++) assert.equal(pitch(s, f) - pitch(s, 0), f);
  for (const [s, f] of [
    [-1, 0],
    [6, 0],
    [0, -1],
    [0, 25],
    [0, 1.5],
  ])
    assert.throws(() => pitch(s, f));
});
test("rhythm grids distinguish 3/4 from 6/8, sum exact eighths and reject overlaps or bar overflow", () => {
  assert.equal(slotsPerBar("4/4"), 8);
  assert.equal(slotsPerBar("3/4"), 6);
  assert.deepEqual(counts("6/8"), ["1", "la", "li", "2", "la", "li"]);
  assert.deepEqual(counts("3/4"), ["1", "&", "2", "&", "3", "&"]);
  let p = idea().phrases[0];
  p = place(p, 1, 1, 5, 3);
  assert.equal(p.notes[0].duration, 1);
  assert.equal(p.notes[1].duration, 3);
  p = place(p, 2, 0, null, 1);
  assert.equal(p.notes[1].duration, 1);
  assert.equal(p.notes.length, 2);
  p = place(p, 7, 0, 3, 4);
  assert.equal(p.notes.at(-1)!.duration, 1);
  assert.equal(
    phraseSchema.safeParse({
      ...p,
      notes: [{ tick: 7, string: 0, fret: 0, duration: 2 }],
    }).success,
    false,
  );
  assert.equal(
    phraseSchema.safeParse({
      ...p,
      notes: [
        { tick: 0, string: 0, fret: 0, duration: 2 },
        { tick: 1, string: 1, fret: 1, duration: 1 },
      ],
    }).success,
    false,
  );
  assert.equal(
    parseSketch(JSON.stringify({ ...idea(), tuning: "drop-d" })),
    null,
  );
});
test("Phase 1 default upgrades once with recovery copy; edited content requires preview and preserves all work", () =>
  temporary((dir) => {
    const before = Buffer.from(
      JSON.stringify(
        curriculumSchema.parse(JSON.parse(fs.readFileSync(phase1, "utf8"))),
      ),
    );
    fs.writeFileSync(path.join(dir, "curriculum.json"), before);
    let manager = new ContentManager(dir, shipped, legacy, phase1);
    assert.equal(manager.current.lessons.length, 47);
    assert.deepEqual(fs.readFileSync(manager.backupPath), before);
    const backup = manager.backupPath;
    manager = new ContentManager(dir, shipped, legacy, phase1);
    assert.equal(manager.backupPath, backup);
    assert.equal(manager.update, null);
    const custom = JSON.parse(before.toString());
    custom.lessons[0].explanation = "My private explanation";
    fs.writeFileSync(manager.file, JSON.stringify(custom));
    manager = new ContentManager(dir, shipped, legacy, phase1);
    assert.equal(manager.current.lessons.length, 38);
    assert.equal(manager.update!.added, 9);
    assert.equal(
      manager.apply([]).lessons[0].explanation,
      "My private explanation",
    );
  }));
test("Music sketches, revisions, history and separate evidence survive restart without modifying Phase 1 projects", () =>
  temporary((dir) => {
    const file = path.join(dir, "college.sqlite");
    let store = new Store(file);
    const project = {
      id: crypto.randomUUID(),
      title: "Existing lyrics",
      body: "The gate creaked softly",
      kind: "Lyrics" as const,
      completed: false,
    };
    store.saveProject(project);
    const a = {
      lessonId: "music-01",
      body: JSON.stringify(idea()),
      revision: "",
      reflection: "A rising answer",
      complete: true,
    };
    store.saveAttempt(a);
    assert.equal(facultyProgress(store.state(), "music").completed, 1);
    assert.equal(facultyProgress(store.state(), "writing").completed, 0);
    assert.equal(store.state().evidence.length, 0);
    store.recordEvidence({
      lessonId: a.lessonId,
      criteria: [
        {
          criterionId: criterionId(
            lessons.find((l) => l.id === a.lessonId)!,
            0,
          ),
          level: "supported",
        },
      ],
    });
    const changed = idea();
    changed.phrases[0] = place(changed.phrases[0], 2, 0, 3, 2);
    store.saveAttempt({ ...a, revision: JSON.stringify(changed) });
    store.close();
    store = new Store(file);
    assert.equal(store.project(project.id)!.body, project.body);
    assert.equal(store.attemptHistory(a.lessonId).length, 1);
    assert.equal(store.state().attempts[0].revision, JSON.stringify(changed));
    assert.equal(store.state().evidence[0].faculty, "music");
    assert.throws(
      () => store.saveAttempt({ ...a, body: "bad json" }),
      /Invalid musical/,
    );
    assert.throws(
      () => store.saveAttempt({ ...a, body: JSON.stringify(blankSketch()) }),
      /intention/,
    );
    store.close();
  }));
test("recording bytes and lesson/sketch links survive restart, stay private and can be deleted; unsafe files rejected", () =>
  temporary((dir) => {
    let recordings = new Recordings(dir);
    const data = new Uint8Array(32);
    data.set([0x1a, 0x45, 0xdf, 0xa3]);
    const sketch = idea();
    const take = recordings.save({
      lessonId: "music-01",
      sketchId: sketch.id,
      name: "Quiet answer",
      data,
    });
    recordings = new Recordings(dir);
    assert.deepEqual(recordings.list("music-01"), [take]);
    assert.equal(recordings.list("music-02").length, 0);
    assert.deepEqual(recordings.read("music-01", take.id).data, data);
    assert.equal(take.sketchId, sketch.id);
    assert.throws(() => recordings.read("music-02", take.id), /not found/);
    assert.throws(
      () => recordings.read("music-01", "../../secrets"),
      /not found/,
    );
    assert.throws(
      () =>
        recordings.save({
          lessonId: "music-01",
          sketchId: sketch.id,
          name: "bad",
          data: new Uint8Array(32),
        }),
      /WebM/,
    );
    if (process.platform !== "win32")
      assert.equal(
        fs.statSync(path.join(dir, take.id + ".webm")).mode & 0o777,
        0o600,
      );
    recordings.delete("music-01", take.id);
    assert.equal(recordings.list("music-01").length, 0);
    assert.throws(() => recordings.read("music-01", take.id), /not found/);
    const outside = path.join(dir, "outside");
    fs.writeFileSync(outside, data);
    const malicious = crypto.randomUUID();
    if (process.platform !== "win32")
      fs.symlinkSync(outside, path.join(dir, malicious + ".webm"));
    fs.writeFileSync(
      path.join(dir, malicious + ".json"),
      JSON.stringify({ ...take, id: malicious }),
    );
    assert.equal(recordings.list("music-01").length, 0);
  }));
test("AI receives a counted musical document and self-report, exclusively Luna, never audio/recording paths or proof of performance", async () => {
  let captured: any;
  const client = {
    responses: {
      parse: async (r: any) => {
        captured = r;
        return { output_parsed: null };
      },
    },
  } as unknown as OpenAI;
  const s = idea();
  s.observation = "I played it softly";
  await askTutor(
    "test",
    { lessonId: "music-01", text: JSON.stringify(s), confirmed: true },
    defaultProfile,
    defaultSettings,
    0,
    client,
  );
  const input = JSON.parse(captured.input);
  assert.equal(captured.model, "gpt-6-luna");
  assert.equal(captured.store, false);
  assert.equal(input.studentText, musicText(JSON.stringify(s)));
  assert.match(input.studentText, /not heard/);
  assert.match(input.studentText, /self-report/);
  assert.match(input.studentText, /E4/);
  assert.ok(!captured.input.includes(s.id));
  assert.ok(!captured.input.includes("audio/webm"));
  assert.match(captured.instructions, /no audio has been heard/);
  assert.equal(meaningfulSketch(JSON.stringify(s)), true);
  assert.equal(meaningfulSketch(JSON.stringify(blankSketch())), false);
});
test("Music retention cannot be claimed by changing only a sketch UUID, name or observation", () =>
  temporary((dir) => {
    const store = new Store(path.join(dir, "college.sqlite"));
    const lesson = lessons.find((l) => l.id === "music-01")!;
    const sketch = idea(),
      a = {
        lessonId: lesson.id,
        body: JSON.stringify(sketch),
        revision: "",
        reflection: "An uncertain ending",
        complete: true,
      };
    store.saveAttempt(a);
    store.recordEvidence({
      lessonId: lesson.id,
      criteria: [{ criterionId: criterionId(lesson, 0), level: "independent" }],
    });
    const repeat = {
      ...sketch,
      id: crypto.randomUUID(),
      observation: "A new listening note",
    };
    store.saveAttempt({
      ...a,
      body: JSON.stringify(repeat),
      practicePrompt: lesson.transferPrompt,
    });
    assert.throws(
      () =>
        store.recordEvidence({
          lessonId: lesson.id,
          criteria: [
            { criterionId: criterionId(lesson, 0), level: "retained" },
          ],
        }),
      /different work/,
    );
    repeat.phrases[0] = place(repeat.phrases[0], 2, 0, 3, 2);
    store.saveAttempt({
      ...a,
      body: JSON.stringify(repeat),
      practicePrompt: lesson.transferPrompt,
    });
    store.recordEvidence({
      lessonId: lesson.id,
      criteria: [{ criterionId: criterionId(lesson, 0), level: "retained" }],
    });
    assert.equal(store.state().evidence.at(-1)!.level, "retained");
    store.close();
  }));
