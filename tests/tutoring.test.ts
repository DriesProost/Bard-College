import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Store } from "../electron/store.js";
import { setCurriculum, lessons } from "../src/shared/curriculum.js";
import {
  dailyPractice,
  REVIEW_LIMIT,
  evidenceOptions,
  reviewedDraft,
} from "../src/shared/tutoring.js";
import {
  defaultProfile,
  defaultSettings,
  type State,
} from "../src/shared/model.js";
import { introduceLesson, askTutor } from "../electron/tutor.js";
import { guidanceFixture, feedbackFixture } from "./tutor-support.js";
import type OpenAI from "openai";
setCurriculum(JSON.parse(fs.readFileSync("curriculum/lessons.json", "utf8")));
function temporary(fn: (file: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bard-guidance-"));
  try {
    fn(path.join(dir, "college.sqlite"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const attempt = () => ({
  lessonId: lessons[0].id,
  body: "A teaspoon cooled beside the untouched cup.",
  revision: "",
  reflection: "A daily habit interrupted",
  complete: true,
});
test("lesson completion requires real-session review of the current draft, version and exercise; old completion survives", () =>
  temporary((file) => {
    const s = new Store(file),
      a = attempt();
    s.saveAttempt({ ...a, complete: false });
    assert.throws(() => s.saveAttempt(a), /Professor/);
    assert.equal(s.state().attempts[0].completedAt, "");
    const session = s.startTutorSession(a.lessonId, guidanceFixture);
    s.appendTutorTurn(a.lessonId, session.id, a.body, feedbackFixture);
    assert.throws(
      () =>
        s.saveAttempt({
          ...a,
          revision: "The untouched cup waited by the gate.",
        }),
      /current|Professor/,
    );
    assert.throws(
      () => s.saveAttempt({ ...a, practicePrompt: lessons[0].transferPrompt }),
      /Professor/,
    );
    s.saveAttempt({ ...a, reflection: "" });
    assert.equal(s.state().attempts[0].reflection, "");
    assert.ok(s.state().attempts[0].completedAt);
    assert.ok(s.tutorSession(a.lessonId)!.completedAt);
    assert.equal(s.state().evidence.length, 0);
    const completed = s.state().attempts[0].completedAt;
    s.saveAttempt({ ...a, body: a.body + " A new thought.", complete: false });
    assert.equal(s.state().attempts[0].completedAt, completed);
    s.close();
  }));
test("review limit is persisted across restarts, enforced per session, and explicit restart preserves previous records", () =>
  temporary((file) => {
    let s = new Store(file);
    const session = s.startTutorSession(lessons[0].id, guidanceFixture);
    for (let i = 0; i < REVIEW_LIMIT; i++)
      s.appendTutorTurn(
        session.scope,
        session.id,
        `draft ${i}`,
        feedbackFixture,
      );
    assert.throws(
      () => s.checkTutorSession(session.scope, session.id),
      /three reviews/,
    );
    s.close();
    s = new Store(file);
    assert.equal(s.tutorSession(session.scope)!.turns.length, 3);
    assert.throws(
      () =>
        s.appendTutorTurn(session.scope, session.id, "fourth", feedbackFixture),
      /three reviews/,
    );
    const fresh = s.startTutorSession(session.scope, guidanceFixture);
    assert.equal(fresh.turns.length, 0);
    assert.notEqual(fresh.id, session.id);
    assert.equal(
      s.get<any>("tutor-session:" + session.id, null).turns.length,
      3,
    );
    assert.throws(
      () => s.checkTutorSession(session.scope, session.id),
      /Start or resume/,
    );
    const studio = s.startTutorSession("studio", null);
    s.appendTutorTurn("studio", studio.id, "A separate verse", feedbackFixture);
    assert.equal(s.tutorSession(fresh.scope)!.turns.length, 0);
    s.close();
  }));
test("daily task stays on completed practice today, remains independent by faculty, and starts clearly on a later day", () =>
  temporary((file) => {
    const s = new Store(file);
    let state = s.state() as State;
    let d = dailyPractice(state, "writing")!;
    assert.equal(d.lesson.id, lessons[0].id);
    assert.equal(d.done, false);
    const a = attempt(),
      session = s.startTutorSession(a.lessonId, guidanceFixture);
    s.saveAttempt({ ...a, complete: false });
    s.appendTutorTurn(a.lessonId, session.id, a.body, feedbackFixture);
    s.saveAttempt(a);
    state = s.state() as State;
    d = dailyPractice(state, "writing")!;
    assert.equal(d.done, true);
    assert.equal(d.lesson.id, a.lessonId);
    assert.equal(d.reviewed, true);
    assert.equal(dailyPractice(state, "music")!.done, false);
    const tomorrow = dailyPractice(state, "writing", "2099-01-01")!;
    assert.equal(tomorrow.done, false);
    assert.equal(tomorrow.lesson.id, lessons[1].id);
    s.close();
  }));
test("AI introduction uses only Luna, the installed minimum/fresh task and criteria; no fabricated replacement exercise", async () => {
  let captured: any;
  const client = {
    responses: {
      parse: async (r: any) => {
        captured = r;
        return {
          output_parsed: guidanceFixture,
          usage: { input_tokens: 20, output_tokens: 30 },
        };
      },
    },
  } as unknown as OpenAI;
  const l = lessons[0],
    r = await introduceLesson(
      "test",
      l.id,
      l.transferPrompt,
      defaultProfile,
      defaultSettings,
      client,
    );
  assert.equal(captured.model, "gpt-6-luna");
  assert.equal(captured.store, false);
  const data = JSON.parse(captured.input);
  assert.equal(data.task, l.transferPrompt);
  assert.deepEqual(data.criteria, l.assessment);
  assert.match(captured.instructions, /Do not replace or enlarge/);
  assert.deepEqual(r.guidance, guidanceFixture);
  assert.equal(r.usage.output, 30);
  await assert.rejects(
    () =>
      introduceLesson(
        "test",
        l.id,
        "Invent a different task",
        defaultProfile,
        defaultSettings,
        client,
      ),
    /Unknown/,
  );
});
test("last review closes the conversation without another question; stale reviews are not current-draft approval", async () => {
  let captured: any;
  const client = {
    responses: {
      parse: async (r: any) => {
        captured = r;
        return { output_parsed: feedbackFixture };
      },
    },
  } as unknown as OpenAI;
  await askTutor(
    "test",
    { text: "The old gate creaked.", confirmed: false },
    defaultProfile,
    { ...defaultSettings, confirmRequests: true },
    0,
    client,
    true,
  );
  assert.match(captured.instructions, /Do not ask another question/);
  assert.equal(captured.model, "gpt-6-luna");
  const session = {
    id: crypto.randomUUID(),
    scope: lessons[0].id,
    contentVersion: lessons[0].version,
    practicePrompt: "",
    createdAt: new Date().toISOString(),
    completedAt: "",
    guidance: guidanceFixture,
    turns: [
      {
        text: "original",
        feedback: feedbackFixture,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  assert.equal(reviewedDraft(session, "original"), true);
  assert.equal(reviewedDraft(session, "changed"), false);
});
test("self-check meanings distinguish helped work from independent choices and transfer without grades", () => {
  assert.match(evidenceOptions.supported.meaning, /hints|step-by-step/);
  assert.match(
    evidenceOptions.independent.meaning,
    /Getting feedback afterwards is fine/,
  );
  assert.match(evidenceOptions.retained.meaning, /different work/);
  assert.match(evidenceOptions.introduced.label, /learning/);
});
