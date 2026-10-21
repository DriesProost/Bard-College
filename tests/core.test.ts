import { saveReviewedAttempt } from "./tutor-support.js";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { Store } from "../electron/store.js";
import {
  AI_MODEL,
  askTutor,
  apiError,
  testAIConnection,
  createAIClient,
} from "../electron/tutor.js";
import { KeyVault } from "../electron/vault.js";
import { trustedSender } from "../electron/security.js";
import {
  setCurriculum,
  lessons,
  curriculumSchema,
} from "../src/shared/curriculum.js";
import {
  defaultProfile,
  defaultSettings,
  feedbackSchema,
  projectSchema,
} from "../src/shared/model.js";
import {
  progression,
  streak,
  syllables,
  dueReview,
} from "../src/shared/progression.js";
const curriculum = JSON.parse(
  readFileSync(new URL("../curriculum/lessons.json", import.meta.url), "utf8"),
);
setCurriculum(curriculum);
const feedback = {
  strength: "The cup makes absence visible.",
  reason: "A specific object invites inference.",
  improvements: ["Read the ending aloud and shorten one crowded phrase."],
  question: "What would the speaker leave unsaid?",
};
const attempt = (id = lessons[0].id) => ({
  lessonId: id,
  body: "The teaspoon waited by the window while the coffee cooled.",
  revision: "",
  reflection: "I chose a teaspoon to suggest a daily habit interrupted.",
  complete: true,
});
function withStore(fn: (s: Store, file: string) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), "bard-test-"));
  const file = path.join(dir, "test.sqlite");
  const s = new Store(file);
  try {
    fn(s, file);
  } finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
test("curriculum has 47 validated lessons, ordered dependencies and distinct exercises", () => {
  assert.equal(lessons.length, 47);
  assert.equal(new Set(lessons.map((l) => l.exercise)).size, 47);
  assert.equal(new Set(lessons.map((l) => l.id)).size, 47);
  for (const l of lessons) {
    assert.equal(l.minutes, 5);
    assert.equal(l.timing.notice + l.timing.write + l.timing.reflect, 5);
    assert.ok(l.assessment.length >= 2);
    assert.ok(l.exercise.length > 40);
  }
  const bad = structuredClone(curriculum);
  bad.lessons[0].skillDependencies = ["missing"];
  assert.equal(curriculumSchema.safeParse(bad).success, false);
  const duplicate = structuredClone(curriculum);
  duplicate.lessons[1].id = duplicate.lessons[0].id;
  assert.equal(curriculumSchema.safeParse(duplicate).success, false);
});
test("SQLite persists writing, profile and settings across connections; SQL text stays literal", () =>
  withStore((s, file) => {
    const p = {
      id: randomUUID(),
      title: "A bard's ballad",
      body: "'); DROP TABLE projects; --\nA quiet line.",
      kind: "Song" as const,
      completed: false,
    };
    s.saveProject(p);
    s.set("profile", { ...defaultProfile, name: "Dries" });
    const other = new Store(file);
    assert.equal(other.project(p.id)?.body, p.body);
    assert.equal(other.profile().name, "Dries");
    assert.equal(other.projects().length, 1);
    other.close();
  }));
test("snapshots deduplicate, preserve earlier writing, and cascade on delete", () =>
  withStore((s) => {
    const p = {
      id: randomUUID(),
      title: "First draft",
      body: "Original words",
      kind: "Poem" as const,
      completed: false,
    };
    s.saveProject(p);
    s.snapshot(p.id);
    s.snapshot(p.id);
    s.saveProject({
      ...p,
      body: "A revised set of words with a much longer ending.",
    });
    s.snapshot(p.id);
    assert.equal(s.history(p.id).length, 2);
    assert.equal(s.history(p.id)[1].body, "Original words");
    assert.equal(
      s.state().events.filter((e) => e.key.startsWith("revise")).length,
      1,
    );
    s.deleteProject(p.id);
    assert.equal(s.history(p.id).length, 0);
  }));
test("participation requires a brief attempt and reflection; XP is idempotent and does not establish skill", () =>
  withStore((s) => {
    assert.throws(
      () => saveReviewedAttempt(s, { ...attempt(), reflection: "" }),
      /reflection/,
    );
    assert.throws(
      () => saveReviewedAttempt(s, { ...attempt(), body: "few words" }),
      /at least 3 words/,
    );
    assert.equal(s.state().attempts.length, 0);
    saveReviewedAttempt(s, attempt());
    saveReviewedAttempt(s, attempt());
    assert.equal(
      s.state().events.reduce((sum, e) => sum + e.xp, 0),
      40,
    );
    saveReviewedAttempt(s, { ...attempt(), complete: false });
    assert.ok(s.state().attempts[0].completedAt);
    saveReviewedAttempt(s, attempt(lessons[1].id));
    assert.equal(s.state().attempts.length, 2);
  }));
test("feedback rejects stale responses and keeps earlier notes labelled with their source after revision", () =>
  withStore((s) => {
    saveReviewedAttempt(s, attempt());
    s.feedback(lessons[0].id, "stale text", feedback);
    assert.equal(s.state().attempts[0].feedback, null);
    s.feedback(lessons[0].id, attempt().body, feedback);
    assert.deepEqual(s.state().attempts[0].feedback, feedback);
    saveReviewedAttempt(s, { ...attempt(), body: attempt().body + " Again." });
    assert.deepEqual(s.state().attempts[0].feedback, feedback);
    assert.equal(s.state().attempts[0].feedbackText, attempt().body);
  }));
test("finished writing gets one milestone; unfinished fragments get none", () =>
  withStore((s) => {
    const p = {
      id: randomUUID(),
      title: "A complete piece",
      body: "one two",
      kind: "Song" as const,
      completed: true,
    };
    s.saveProject(p);
    assert.equal(s.state().events.length, 0);
    s.saveProject({ ...p, body: Array(35).fill("word").join(" ") });
    s.saveProject({ ...p, completed: false });
    s.saveProject({ ...p, body: Array(35).fill("word").join(" ") });
    assert.equal(
      s.state().events.filter((e) => e.key.startsWith("finish")).length,
      1,
    );
  }));
test("rank and streak reflect activity without erasing earned experience", () => {
  const events = [
    { key: "a", xp: 250, discipline: "The Quill", day: "2026-10-19" },
    { key: "b", xp: 10, discipline: "The Quill", day: "2026-10-18" },
  ];
  assert.equal(progression(events).rank, "Apprentice Minstrel");
  assert.equal(streak(events, "2026-10-20"), 2);
  assert.equal(streak(events, "2026-10-22"), 0);
  assert.equal(progression(events).xp, 260);
  assert.ok(syllables("A quiet morning") >= 3);
});
test("renderer boundary permits only exact app URL / designated dev origin", () => {
  const appFile = path.resolve("fixture-app", "dist", "index.html");
  const appURL = pathToFileURL(appFile).href;
  assert.equal(trustedSender(appURL, appFile, false), true);
  for (const url of [
    "https://evil.example",
    "file:///tmp/index.html",
    appURL + "?inject=1",
    "not a url",
  ])
    assert.equal(trustedSender(url, appFile, false), false);
  assert.equal(trustedSender("http://127.0.0.1:5173", "/x", true), true);
  assert.equal(trustedSender("http://127.0.0.1:51730", "/x", true), false);
  assert.equal(trustedSender("http://localhost:5173", "/x", true), false);
  assert.equal(
    projectSchema.safeParse({
      id: "../../key",
      title: "x",
      body: "x",
      kind: "Song",
      completed: false,
    }).success,
    false,
  );
  assert.equal(
    feedbackSchema.safeParse({ ...feedback, improvements: [] }).success,
    false,
  );
});
test("tutor uses Responses structured output, only pinned model, and lesson rubric", async () => {
  let captured: any;
  const client = {
    responses: {
      parse: async (req: any) => {
        captured = req;
        return {
          output_parsed: feedback,
          usage: { input_tokens: 300, output_tokens: 100 },
        };
      },
    },
  } as unknown as OpenAI;
  const result = await askTutor(
    "test-key",
    { text: attempt().body, lessonId: lessons[0].id, confirmed: true },
    defaultProfile,
    { ...defaultSettings, inputPrice: 1, outputPrice: 2 },
    0,
    client,
  );
  assert.equal(captured.model, AI_MODEL);
  assert.equal(captured.model, "gpt-6-luna");
  assert.equal(captured.store, false);
  assert.equal(captured.text.format.type, "json_schema");
  assert.ok(JSON.parse(captured.input).lesson.assessment.length);
  assert.equal(result.usage.cost, 0.0005);
  assert.deepEqual(result.feedback, feedback);
});
test("missing key blocks network; old confirmation settings and advisory budgets do not add repeated approvals", async () => {
  const r = { text: "A verse", confirmed: false };
  await assert.rejects(
    () => askTutor("", r, defaultProfile, defaultSettings, 0),
    /API key/,
  );
  let calls = 0;
  const client = {
    responses: {
      parse: async () => {
        calls++;
        return { output_parsed: null };
      },
    },
  } as unknown as OpenAI;
  await askTutor(
    "test",
    r,
    defaultProfile,
    {
      ...defaultSettings,
      confirmRequests: true,
      budget: 0.01,
      inputPrice: 10,
      outputPrice: 10,
    },
    100,
    client,
  );
  assert.equal(calls, 1);
});
test("API errors explain authentication, access, credits, rate limits and outages", () => {
  const error = (status: number, code?: string) =>
    new OpenAI.APIError(
      status,
      { code },
      "provider detail containing no user-safe context",
      new Headers(),
    );
  assert.match(apiError(error(401)), /key/);
  assert.match(apiError(error(404)), /no other model/);
  assert.match(apiError(error(403)), /unavailable/);
  assert.match(apiError(error(429, "insufficient_quota")), /credits/);
  assert.match(apiError(error(429)), /rate limited/);
  assert.match(apiError(error(503)), /temporarily/);
  assert.doesNotMatch(apiError(error(400)), /provider detail/);
  assert.match(apiError(new OpenAI.APIConnectionError({})), /connection/);
});
test("provider refusal still returns usage and never fabricates feedback", async () => {
  const client = {
    responses: {
      parse: async () => ({
        output_parsed: null,
        usage: { input_tokens: 50, output_tokens: 10 },
      }),
    },
  } as unknown as OpenAI;
  const result = await askTutor(
    "x",
    { text: "verse", confirmed: true },
    defaultProfile,
    defaultSettings,
    0,
    client,
  );
  assert.equal(result.feedback, null);
  assert.equal(result.usage.input, 50);
});

test("spaced review uses meaningful practice dates with expanding intervals", () => {
  const state = {
    curriculum: lessons,
    attempts: [
      {
        ...attempt(),
        completedAt: "2026-10-18T10:00:00Z",
        feedback: null,
        feedbackText: "",
      },
    ],
    events: [] as any[],
  };
  assert.equal(
    dueReview(state, new Date("2026-10-20T12:00:00Z"))?.id,
    lessons[0].id,
  );
  state.events = [
    {
      key: `practice:${lessons[0].id}:2026-10-20`,
      day: "2026-10-20",
      xp: 5,
      discipline: "The Quill",
    },
  ];
  assert.equal(dueReview(state, new Date("2026-10-22T12:00:00Z")), undefined);
  assert.equal(
    dueReview(state, new Date("2026-10-23T12:00:00Z"))?.id,
    lessons[0].id,
  );
});

test("connection test sends only a minimal fixed-model Responses request and meters usage", async () => {
  let sent: any;
  const client = {
    responses: {
      create: async (request: any) => {
        sent = request;
        return {
          status: "completed",
          output_text: "OK",
          usage: { input_tokens: 8, output_tokens: 2 },
        };
      },
    },
  } as unknown as OpenAI;
  const result = await testAIConnection(
    "fixture-key",
    { ...defaultSettings, inputPrice: 1, outputPrice: 2 },
    client,
  );
  assert.equal(result.success, true);
  assert.equal(sent.model, "gpt-6-luna");
  assert.equal(sent.input, "Reply with only OK.");
  assert.equal(sent.store, false);
  assert.equal(sent.max_output_tokens, 64);
  assert.equal(sent.instructions, undefined);
  assert.equal(result.usage.cost, 0.000012);
});
test("connection refusal, incomplete response and missing key never report success", async () => {
  for (const response of [
    { status: "incomplete", output_text: "" },
    { status: "completed", output_text: "" },
  ]) {
    const client = {
      responses: { create: async () => response },
    } as unknown as OpenAI;
    const result = await testAIConnection(
      "fixture-key",
      defaultSettings,
      client,
    );
    assert.equal(result.success, false);
    assert.match(result.message, /not confirmed/);
  }
  await assert.rejects(testAIConnection("", defaultSettings), /API key/);
});
test("connection errors preserve account, quota and network distinctions without leaking provider text", async () => {
  for (const [error, match] of [
    [
      new OpenAI.APIError(404, {}, "raw provider detail", new Headers()),
      /unavailable/,
    ],
    [
      new OpenAI.APIError(401, {}, "raw provider detail", new Headers()),
      /not accepted/,
    ],
    [
      new OpenAI.APIError(
        429,
        { code: "insufficient_quota" },
        "raw provider detail",
        new Headers(),
      ),
      /credits/,
    ],
    [new OpenAI.APIConnectionError({}), /connection/],
  ] as const) {
    const client = {
      responses: {
        create: async () => {
          throw error;
        },
      },
    } as unknown as OpenAI;
    await assert.rejects(
      testAIConnection("fixture-key", defaultSettings, client),
      match,
    );
  }
});
test("key vault rejects unavailable/plaintext protection, encrypts before saving and fails closed on decryption", () => {
  const config = new Map<string, unknown>();
  const storage = {
    get: <T>(k: string, f: T) => (config.has(k) ? (config.get(k) as T) : f),
    set: (k: string, v: unknown) => {
      config.set(k, v);
    },
  };
  let available = true;
  let backend = "gnome_libsecret";
  let decryptFails = false;
  const cipher = {
    isEncryptionAvailable: () => available,
    getSelectedStorageBackend: () => backend,
    encryptString: (v: string) =>
      Buffer.from("encrypted-fixture:" + Buffer.from(v).toString("base64")),
    decryptString: (v: Buffer) => {
      if (decryptFails) throw Error("OS error");
      return Buffer.from(
        v.toString().replace("encrypted-fixture:", ""),
        "base64",
      ).toString();
    },
  };
  const vault = new KeyVault(storage, cipher, "win32");
  assert.equal(vault.protection(), "Windows DPAPI");
  assert.throws(() => vault.read(), /Settings/);
  available = false;
  assert.throws(() => vault.save("fixture-secret"), /not saved/);
  assert.equal(vault.hasKey(), false);
  available = true;
  vault.save("fixture-secret");
  assert.doesNotMatch(JSON.stringify([...config]), /fixture-secret/);
  assert.equal(vault.read(), "fixture-secret");
  decryptFails = true;
  assert.throws(() => vault.read(), /cannot be unlocked/);
  vault.save("");
  assert.equal(vault.hasKey(), false);
  backend = "basic_text";
  assert.equal(new KeyVault(storage, cipher, "linux").available(), false);
});

test("opening an earlier database preserves attempts and feedback while migrating source labels", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bard-migration-"));
  const file = path.join(dir, "old.sqlite");
  try {
    const db = new DatabaseSync(file);
    db.exec(
      "CREATE TABLE attempts(lessonId TEXT PRIMARY KEY,body TEXT NOT NULL,revision TEXT NOT NULL,completedAt TEXT NOT NULL,feedback TEXT)",
    );
    db.prepare("INSERT INTO attempts VALUES(?,?,?,?,?)").run(
      lessons[0].id,
      attempt().body,
      "",
      "2026-10-20",
      JSON.stringify(feedback),
    );
    db.close();
    const migrated = new Store(file);
    try {
      const row = migrated.state().attempts[0];
      assert.equal(row.body, attempt().body);
      assert.deepEqual(row.feedback, feedback);
      assert.equal(row.feedbackText, "");
      assert.equal(row.reflection, "");
    } finally {
      migrated.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Windows uninstall manifest removes only shipped paths and refuses symbolic links", async () => {
  const { createRequire } = await import("node:module");
  const afterPack = createRequire(import.meta.url)("../build/after-pack.cjs");
  const fs = await import("node:fs/promises");
  const dir = mkdtempSync(path.join(tmpdir(), "bard-installer-"));
  try {
    const payload = path.join(dir, "payload");
    await fs.mkdir(path.join(payload, "resources"), { recursive: true });
    await fs.mkdir(path.join(dir, "release"));
    await fs.writeFile(path.join(payload, "College.exe"), "fixture");
    await fs.writeFile(path.join(payload, "$notes.txt"), "fixture");
    await fs.writeFile(path.join(payload, "resources", "app.asar"), "fixture");
    await afterPack({
      electronPlatformName: "win32",
      appOutDir: payload,
      packager: { projectDir: dir },
    });
    const manifest = await fs.readFile(
      path.join(dir, "release", "uninstall-files.nsh"),
      "utf8",
    );
    assert.match(manifest, /Delete "\$INSTDIR\\College.exe"/);
    assert.match(manifest, /Delete "\$INSTDIR\\resources\\app.asar"/);
    assert.doesNotMatch(manifest, /RMDir \/r|APPDATA|college.sqlite/);
    assert.ok(manifest.includes("$$notes.txt"));
    if (process.platform !== "win32") {
      await fs.symlink(
        path.join(payload, "College.exe"),
        path.join(payload, "unexpected-link"),
      );
      await assert.rejects(
        afterPack({
          electronPlatformName: "win32",
          appOutDir: payload,
          packager: { projectDir: dir },
        }),
        /symbolic link/,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("OS encryption failure does not overwrite a working encrypted key or expose the submitted key", () => {
  const values = new Map([["encryptedKey", "previous-encrypted-binding"]]);
  const config = {
    get: <T>(k: string, f: T) => (values.has(k) ? values.get(k) : f) as T,
    set: (k: string, v: unknown) => values.set(k, String(v)),
  };
  const vault = new KeyVault(
    config,
    {
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => "",
      encryptString: () => {
        throw Error("provider internal detail");
      },
      decryptString: () => "",
    },
    "win32",
  );
  assert.throws(
    () => vault.save("fixture-sensitive-key"),
    /new key was not saved/,
  );
  assert.equal(values.get("encryptedKey"), "previous-encrypted-binding");
});

test("saved personal keys use the fixed OpenAI host and disabled SDK logs despite ambient IDE configuration", () => {
  const previous = process.env.OPENAI_BASE_URL;
  const previousLog = process.env.OPENAI_LOG;
  try {
    process.env.OPENAI_BASE_URL = "https://untrusted.example/v1";
    process.env.OPENAI_LOG = "debug";
    const client = createAIClient("fixture-not-a-real-key");
    assert.equal(client.baseURL, "https://api.openai.com/v1");
    assert.equal(client.maxRetries, 0);
    assert.equal(client.timeout, 45000);
    assert.equal(client.logLevel, "off");
  } finally {
    if (previous === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = previous;
    if (previousLog === undefined) delete process.env.OPENAI_LOG;
    else process.env.OPENAI_LOG = previousLog;
  }
});
