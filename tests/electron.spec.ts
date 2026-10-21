import { test, expect, _electron as electron } from "@playwright/test";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { installAIFixture } from "./ai-fixture";
test("desktop workflow: profile, practice, autosave, revisions, export and restart", async () => {
  const config = mkdtempSync(path.join(tmpdir(), "bard-desktop-"));
  const launch = () =>
    electron.launch({
      executablePath: process.env.BARD_PACKAGED_EXECUTABLE,
      cwd: process.env.BARD_PACKAGED_EXECUTABLE ? config : undefined,
      args: [
        ...(process.env.BARD_PACKAGED_EXECUTABLE ? [] : ["."]),
        ...(process.env.BARD_TEST_DEV ? ["--dev"] : []),
        `--user-data-dir=${config}`,
        ...(process.platform === "linux" ? ["--no-sandbox"] : []),
      ],
      env: {
        ...process.env,
        DISPLAY: process.env.DISPLAY || ":99",
        XDG_CONFIG_HOME: config,
      },
      timeout: 30000,
    });
  let app = await launch();
  try {
    const page = await app.firstWindow();
    // Block both renderer HTTP and Node main-process HTTP for the core offline journey.
    if (!process.env.BARD_TEST_DEV) {
      await page.context().setOffline(true);
      await app.evaluate(({ session }) => {
        session.defaultSession.webRequest.onBeforeRequest(
          { urls: ["http://*/*", "https://*/*"] },
          (_details, callback) => callback({ cancel: true }),
        );
        globalThis.fetch = async () => {
          throw TypeError("Offline core-workflow test");
        };
      });
    }
    if (process.env.BARD_PACKAGED_EXECUTABLE) {
      expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(true);
      const appPath = await app.evaluate(({ app }) => app.getAppPath());
      expect(appPath).toContain("resources");
      expect(appPath).toContain("app.asar");
      expect(appPath).not.toContain("/workspace/Bard-College");
      expect(page.url().startsWith("file:")).toBe(true);
    }
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await expect(
      page.getByRole("heading", { name: "Welcome to Bard’s College" }),
    ).toBeVisible();
    await page.getByLabel("Your name").fill("Dries");
    await page.getByRole("button", { name: "Enter the College" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back, Dries." }),
    ).toBeVisible();
    mkdirSync("artifacts", { recursive: true });
    await page.screenshot({ path: "artifacts/great-hall.png", fullPage: true });
    expect(
      await page.evaluate(() => ({
        node: typeof (window as any).require,
        process: typeof (window as any).process,
        bridge: Object.keys(window.bard),
      })),
    ).toMatchObject({ node: "undefined", process: "undefined" });
    const boundary = await app.evaluate(async ({ BrowserWindow, app }) => {
      const attacker = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: app.getAppPath() + "/dist-electron/electron/preload.cjs",
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      await attacker.loadURL("data:text/html,<h1>Untrusted window</h1>");
      const result = await attacker.webContents.executeJavaScript(
        "window.bard.load().then(()=>'unexpected access').catch(e=>e.message)",
      );
      attacker.destroy();
      return result;
    });
    expect(boundary).toContain("Untrusted application request");
    const publicState = await page.evaluate(() => window.bard.load());
    expect(JSON.stringify(publicState)).not.toContain("encryptedKey");
    await page
      .getByRole("button", { name: "Continue learning", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Something you can touch" }),
    ).toBeVisible();
    await page
      .getByLabel("Your exercise")
      .fill(
        "One teaspoon dried beside the sink while the untouched coffee cooled.",
      );
    await page
      .getByLabel("One choice worth noticing")
      .fill(
        "The untouched coffee suggests someone missing without naming the feeling.",
      );
    await page.getByRole("button", { name: "Complete practice" }).click();
    await expect(
      page.getByRole("button", { name: "Lesson completed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ask the Professor", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "The Scriptorium", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create a writing project" })
      .click();
    await page
      .getByRole("textbox", { name: "Project title" })
      .fill("The ferry at dawn");
    await page
      .getByRole("textbox", { name: "Writing document" })
      .fill(
        "The ferry bell outlived the light.\nA coat lay folded on the shore.",
      );
    await expect(page.getByRole("status")).toHaveText("Saved locally");
    await page.getByRole("button", { name: "Snapshot", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Revision snapshot saved." }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Writing document" })
      .fill(
        "The ferry bell outlived the light.\nYour coat lay folded on the shore.\nThe tide returned once more.",
      );
    await page.getByRole("button", { name: "Snapshot", exact: true }).click();
    await page.getByRole("button", { name: "Drafts", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Your revision history" }),
    ).toBeVisible();
    await expect(page.locator(".snapshot")).toHaveCount(2);
    await page.locator(".snapshot").last().locator("summary").click();
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("snapshot");
      ipcMain.handle("snapshot", () => {
        throw Error("Snapshot storage unavailable (test fixture).");
      });
    });
    await page
      .locator(".snapshot")
      .last()
      .getByRole("button", { name: "Restore this draft" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Writing document" }),
    ).toHaveValue(/The tide returned once more/);
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Snapshot storage unavailable",
    );
    await page.getByRole("button", { name: "Dismiss error" }).click();
    const destination = path.join(config, "export.md");
    await app.evaluate(({ dialog }, dest) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: dest });
    }, destination);
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    await expect
      .poll(() => {
        try {
          return readFileSync(destination, "utf8");
        } catch {
          return "";
        }
      })
      .toContain("# The ferry at dawn");
    await page
      .getByRole("button", { name: "The Songbook", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "The ferry at dawn" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Settings & preferences" }).click();
    await page.getByLabel("Show line numbers").check();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByRole("status")).toHaveText("Preferences saved.");
    await page
      .getByRole("button", { name: "The Academy", exact: false })
      .click();
    await expect(page.locator(".curriculum-card")).toHaveCount(38);
    await page.setViewportSize({ width: 1000, height: 760 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await app.close();
    app = await launch();
    const reopened = await app.firstWindow();
    await expect(
      reopened.getByRole("heading", { name: "Welcome back, Dries." }),
    ).toBeVisible();
    await reopened
      .getByRole("button", { name: "The Songbook", exact: true })
      .click();
    await reopened
      .locator(".piece-open")
      .filter({ hasText: "The ferry at dawn" })
      .click();
    await expect(
      reopened.getByRole("textbox", { name: "Writing document" }),
    ).toHaveValue(/The tide returned once more/);
    await expect(reopened.locator(".line-numbers")).toBeVisible();
    await reopened
      .getByRole("textbox", { name: "Writing document" })
      .fill("The final keystroke must survive an immediate close.");
    const userData = await app.evaluate(({ app }) => app.getPath("userData"));
    await app.close();
    const content = JSON.parse(
      readFileSync(path.join(userData, "curriculum.json"), "utf8"),
    );
    content.lessons.push({
      ...content.lessons[29],
      id: "lesson-expansion",
      title: "A new page of craft",
      prerequisite: content.lessons[29].id,
    });
    writeFileSync(
      path.join(userData, "curriculum.json"),
      JSON.stringify(content),
    );
    app = await launch();
    const final = await app.firstWindow();
    await final
      .getByRole("button", { name: "The Songbook", exact: true })
      .click();
    await final
      .locator(".piece-open")
      .filter({ hasText: "The ferry at dawn" })
      .click();
    await expect(
      final.getByRole("textbox", { name: "Writing document" }),
    ).toHaveValue("The final keystroke must survive an immediate close.");
    await final
      .getByRole("button", { name: "The Academy", exact: false })
      .click();
    await expect(final.locator(".curriculum-card")).toHaveCount(39);
    await expect(
      final.getByRole("heading", { name: "A new page of craft" }),
    ).toBeVisible();
  } finally {
    await app.close();
    rmSync(config, { recursive: true, force: true });
  }
});

test("AI connection status and complete feedback → revision → songbook → restart journey (simulated provider)", async () => {
  const config = mkdtempSync(path.join(tmpdir(), "bard-ai-journey-"));
  const launch = () =>
    electron.launch({
      executablePath: process.env.BARD_PACKAGED_EXECUTABLE,
      cwd: process.env.BARD_PACKAGED_EXECUTABLE ? config : undefined,
      args: [
        ...(process.env.BARD_PACKAGED_EXECUTABLE ? [] : ["."]),
        `--user-data-dir=${config}`,
        ...(process.platform === "linux" ? ["--no-sandbox"] : []),
      ],
      env: {
        ...process.env,
        DISPLAY: process.env.DISPLAY || ":99",
        XDG_CONFIG_HOME: config,
      },
    });
  let app = await launch();
  try {
    await installAIFixture(app);
    let page = await app.firstWindow();
    await page.reload();
    await page.getByLabel("Your name").fill("Dries");
    await page.getByLabel("Your main form").selectOption("Lyrics");
    await page.getByRole("button", { name: "Enter the College" }).click();
    await page.getByRole("button", { name: "Settings & preferences" }).click();
    await expect(
      page.getByRole("button", { name: "Test AI Connection", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("OpenAI API key", { exact: true })
      .fill("fixture-not-a-real-key");
    await page.getByRole("button", { name: "Save key securely" }).click();
    await expect(
      page.getByLabel("OpenAI API key", { exact: true }),
    ).toHaveValue("");
    async function testConnection() {
      await page
        .getByRole("button", { name: "Test AI Connection", exact: true })
        .click();
      await page.getByRole("button", { name: "Send connection test" }).click();
    }
    await testConnection();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Connected successfully to GPT-6 Luna." }),
    ).toBeVisible();
    const calls = await app.evaluate(() => (globalThis as any).__bardCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      model: "gpt-6-luna",
      input: "Reply with only OK.",
      store: false,
      max_output_tokens: 64,
    });
    await installAIFixture(app, "unauthorized");
    await testConnection();
    await expect(page.getByRole("alert")).toContainText(
      "API key was not accepted",
    );
    await installAIFixture(app, "unavailable");
    await testConnection();
    await expect(page.getByRole("alert")).toContainText(
      "no other model will be used",
    );
    await installAIFixture(app, "offline");
    await testConnection();
    await expect(page.getByRole("alert")).toContainText(
      "Unable to reach OpenAI",
    );
    await installAIFixture(app);
    await page
      .getByRole("button", { name: "The Great Hall", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Continue learning", exact: true })
      .click();
    const original =
      "One teaspoon dried beside the sink while the untouched coffee cooled.";
    const revised =
      "One teaspoon dried beside the sink. The coffee cooled beside your empty chair.";
    await page.getByLabel("Your exercise").fill(original);
    await page
      .getByLabel("One choice worth noticing")
      .fill("The teaspoon shows a daily habit interrupted.");
    await page.getByRole("button", { name: "Complete practice" }).click();
    await expect(
      page.getByRole("button", { name: "Lesson completed" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Ask the Professor", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm request", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "What’s working" }),
    ).toBeVisible();
    await page.getByText("Try a revision", { exact: true }).click();
    await page
      .getByLabel("Keep your original. Give the idea another pass.")
      .fill(revised);
    await page
      .getByRole("button", { name: "Save revision", exact: true })
      .click();
    await expect(page.getByRole("note")).toContainText("earlier draft");
    await expect(
      page.getByRole("heading", { name: "What’s working" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Open this draft in the Scriptorium" })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Writing document" }),
    ).toHaveValue(revised);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    // Reopen fully offline. Saved feedback must remain available without the provider fixture.
    await page.context().setOffline(true);
    await page
      .getByRole("button", { name: "The Songbook", exact: true })
      .click();
    await page
      .locator(".piece-open")
      .filter({ hasText: "Something you can touch" })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Writing document" }),
    ).toHaveValue(revised);
    await page
      .getByRole("button", { name: "The Academy", exact: false })
      .click();
    await page.getByRole("button", { name: /LESSON 01/ }).click();
    await expect(page.getByLabel("Your exercise")).toHaveValue(original);
    await expect(
      page.getByRole("heading", { name: "What’s working" }),
    ).toBeVisible();
    await expect(page.getByRole("note")).toContainText("earlier draft");
    await page.getByText("Try a revision", { exact: true }).click();
    await expect(
      page.getByLabel("Keep your original. Give the idea another pass."),
    ).toHaveValue(revised);
  } finally {
    await app.close();
    rmSync(config, { recursive: true, force: true });
  }
});

test("Windows DPAPI saves encrypted bytes, unlocks after restart, and removes the key", async () => {
  test.skip(
    process.platform !== "win32",
    "Requires a real Windows user session; a Linux cipher fixture is not DPAPI verification.",
  );
  const config = mkdtempSync(path.join(tmpdir(), "bard-dpapi-"));
  const launch = () =>
    electron.launch({
      executablePath: process.env.BARD_PACKAGED_EXECUTABLE,
      args: [
        ...(process.env.BARD_PACKAGED_EXECUTABLE ? [] : ["."]),
        `--user-data-dir=${config}`,
      ],
    });
  let app = await launch();
  try {
    const page = await app.firstWindow();
    const available = await page.evaluate(() => window.bard.load());
    expect(available.secureStorage).toBe(true);
    expect(available.credentialProtection).toBe("Windows DPAPI");
    await page.evaluate(() =>
      window.bard.setKey("dpapi-fixture-not-a-real-api-key"),
    );
    expect(
      readFileSync(path.join(config, "college.sqlite")).includes(
        Buffer.from("dpapi-fixture-not-a-real-api-key"),
      ),
    ).toBe(false);
    await app.close();
    app = await launch();
    const reopened = await app.firstWindow();
    expect((await reopened.evaluate(() => window.bard.load())).hasKey).toBe(
      true,
    );
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(path.join(config, "college.sqlite"));
    const row = db
      .prepare("SELECT value FROM config WHERE key=?")
      .get("encryptedKey") as { value: string };
    db.close();
    const decrypted = await app.evaluate(
      ({ safeStorage }, ciphertext) =>
        safeStorage.decryptString(Buffer.from(ciphertext, "base64")) ===
        "dpapi-fixture-not-a-real-api-key",
      JSON.parse(row.value),
    );
    expect(decrypted).toBe(true);
    await reopened.evaluate(() => window.bard.setKey(""));
    expect((await reopened.evaluate(() => window.bard.load())).hasKey).toBe(
      false,
    );
  } finally {
    await app.close();
    rmSync(config, { recursive: true, force: true });
  }
});

test("Phase 1 upgrades a legacy profile offline, keeps Music separate and persists new Writing evidence and fresh attempts", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { defaultProfile, defaultSettings } =
    await import("../src/shared/model");
  const config = mkdtempSync(path.join(tmpdir(), "bard-phase1-"));
  writeFileSync(
    path.join(config, "curriculum.json"),
    readFileSync("curriculum/legacy-v1.json"),
  );
  const db = new DatabaseSync(path.join(config, "college.sqlite"));
  db.exec(`CREATE TABLE config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE projects(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,kind TEXT NOT NULL,completed INTEGER NOT NULL,updatedAt TEXT NOT NULL);
    CREATE TABLE attempts(lessonId TEXT PRIMARY KEY,body TEXT,revision TEXT,reflection TEXT,completedAt TEXT,feedback TEXT,feedbackText TEXT);
    CREATE TABLE events(key TEXT PRIMARY KEY,xp INTEGER,discipline TEXT,day TEXT);`);
  db.prepare("INSERT INTO config VALUES('profile',?)").run(
    JSON.stringify({
      ...defaultProfile,
      name: "Returning writer",
      onboarded: true,
    }),
  );
  db.prepare("INSERT INTO config VALUES('settings',?)").run(
    JSON.stringify(defaultSettings),
  );
  db.prepare("INSERT INTO projects VALUES(?,?,?,?,?,?)").run(
    "00000000-0000-4000-8000-000000000001",
    "Surviving ballad",
    "A saved song from before the two faculties.",
    "Song",
    0,
    "2026-10-19",
  );
  db.prepare("INSERT INTO attempts VALUES(?,?,?,?,?,?,?)").run(
    "lesson-17",
    "An old lyrical verse and chorus.",
    "Earlier revision",
    "An earlier choice",
    "2026-10-19",
    null,
    "",
  );
  db.prepare("INSERT INTO events VALUES(?,?,?,?)").run(
    "lesson:lesson-17",
    30,
    "The Lute",
    "2026-10-19",
  );
  db.close();
  const launch = () =>
    electron.launch({
      executablePath: process.env.BARD_PACKAGED_EXECUTABLE,
      cwd: process.env.BARD_PACKAGED_EXECUTABLE ? config : undefined,
      args: [
        ...(process.env.BARD_PACKAGED_EXECUTABLE ? [] : ["."]),
        `--user-data-dir=${config}`,
        ...(process.platform === "linux" ? ["--no-sandbox"] : []),
      ],
      env: {
        ...process.env,
        DISPLAY: process.env.DISPLAY || ":99",
        XDG_CONFIG_HOME: config,
      },
    });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await page.context().setOffline(true);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let state = await page.evaluate(() => window.bard.load());
    expect(state.curriculum).toHaveLength(47);
    expect(state.evidence).toHaveLength(0);
    expect(state.attempts[0].lessonId).toBe("lesson-17");
    expect(state.attempts[0].completedAt).toBe("2026-10-19");
    expect(state.backups.database).toBeTruthy();
    expect(state.backups.curriculum).toBeTruthy();
    await page
      .getByRole("button", { name: "The Academy", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Music faculty", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "The Conservatory of the Lute" }),
    ).toBeVisible();
    await expect(page.getByLabel("Music progress")).toContainText(
      "0 participation XP",
    );
    await expect(page.getByLabel("Writing progress")).toContainText(
      "30 participation XP",
    );
    await page
      .getByRole("button", { name: "Writing faculty", exact: true })
      .click();
    await expect(page.locator(".curriculum-card")).toHaveCount(38);
    await page.getByRole("button", { name: /Hear the rhyme distance/ }).click();
    await page
      .getByLabel("Your exercise")
      .fill("The lamp stayed bright. I left that night.");
    await page.getByLabel("One choice worth noticing").fill("Less settled");
    await page
      .getByRole("button", { name: "Complete practice", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Lesson completed", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Evidence for criterion 1")
      .selectOption("independent");
    await page
      .getByRole("button", { name: "Save skill evidence", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Self-assessment saved" }),
    ).toBeVisible();
    await page
      .getByLabel("Try an unfamiliar challenge", { exact: false })
      .check();
    await expect(page.getByLabel("Your exercise")).toHaveValue("");
    await page
      .getByLabel("Your exercise")
      .fill("Keep the lamp alive. I cannot promise life.");
    await page.getByLabel("One choice worth noticing").fill("Open ending");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByLabel("Evidence for criterion 1").selectOption("retained");
    await page
      .getByRole("button", { name: "Save skill evidence", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.bard.load())).evidence.length,
      )
      .toBe(2);
    await page.getByText("Earlier saved attempts", { exact: true }).click();
    await expect(
      page
        .locator(".evidence-record")
        .filter({ hasText: "The lamp stayed bright" })
        .first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "The Songbook", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Surviving ballad" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.context().setOffline(true);
    state = await page.evaluate(() => window.bard.load());
    expect(state.evidence.map((e) => e.level)).toEqual([
      "independent",
      "retained",
    ]);
    expect(state.projects[0].body).toBe(
      "A saved song from before the two faculties.",
    );
    expect(
      state.attempts.find((a) => a.lessonId === "lesson-17")?.completedAt,
    ).toBe("2026-10-19");
    expect(
      state.attempts.find((a) => a.lessonId === "writing-near-rhyme")
        ?.practicePrompt,
    ).toBeTruthy();
    expect(state.evidence.every((e) => e.faculty === "writing")).toBe(true);
    await page
      .getByRole("button", { name: "The Academy", exact: false })
      .click();
    mkdirSync("artifacts", { recursive: true });
    await page.screenshot({
      path: "artifacts/phase1-faculties.png",
      fullPage: true,
    });
  } finally {
    await app.close();
    rmSync(config, { recursive: true, force: true });
  }
});

test("custom curriculum merge preview retains edited content and saved work", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { defaultProfile } = await import("../src/shared/model");
  const config = mkdtempSync(path.join(tmpdir(), "bard-content-preview-"));
  const custom = JSON.parse(readFileSync("curriculum/legacy-v1.json", "utf8"));
  custom.lessons[0].explanation = "A treasured custom teaching note.";
  writeFileSync(path.join(config, "curriculum.json"), JSON.stringify(custom));
  const db = new DatabaseSync(path.join(config, "college.sqlite"));
  db.exec("CREATE TABLE config(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
  db.prepare("INSERT INTO config VALUES('profile',?)").run(
    JSON.stringify({ ...defaultProfile, onboarded: true }),
  );
  db.close();
  const app = await electron.launch({
    executablePath: process.env.BARD_PACKAGED_EXECUTABLE,
    cwd: process.env.BARD_PACKAGED_EXECUTABLE ? config : undefined,
    args: [
      ...(process.env.BARD_PACKAGED_EXECUTABLE ? [] : ["."]),
      `--user-data-dir=${config}`,
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY || ":99",
      XDG_CONFIG_HOME: config,
    },
  });
  try {
    const page = await app.firstWindow();
    await page.context().setOffline(true);
    expect(
      (await page.evaluate(() => window.bard.load())).curriculum,
    ).toHaveLength(30);
    await page
      .getByRole("button", { name: "Settings & preferences", exact: true })
      .click();
    await expect(
      page.getByText("17 new lessons can be added.", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Add new lessons and apply selected revisions",
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.bard.load())).curriculum.length,
      )
      .toBe(47);
    const state = await page.evaluate(() => window.bard.load());
    expect(state.curriculum[0].explanation).toBe(
      "A treasured custom teaching note.",
    );
    expect(state.backups.curriculum).toBeTruthy();
    await page
      .getByRole("button", { name: "The Academy", exact: false })
      .click();
    await page.getByRole("button", { name: /LESSON 01/ }).click();
    await expect(
      page.getByText("A treasured custom teaching note.", { exact: true }),
    ).toBeVisible();
  } finally {
    await app.close();
    rmSync(config, { recursive: true, force: true });
  }
});
