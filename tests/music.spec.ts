import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { installAIFixture } from "./ai-fixture";
test("Music foundations: counted keyboard tab, synthetic playback, local capture, feedback boundaries, revision and offline restart", async () => {
  const config = mkdtempSync(path.join(tmpdir(), "bard-conservatory-"));
  // Start from the exact Phase 1 content to exercise automatic non-destructive upgrade.
  const phase1 = process.env.BARD_TEST_SOURCE || process.cwd();
  writeFileSync(
    path.join(config, "curriculum.json"),
    readFileSync(path.join(phase1, "curriculum/legacy-phase1-v2.json")),
  );
  const launch = () =>
    electron.launch({
      executablePath: process.env.BARD_PACKAGED_EXECUTABLE,
      cwd: process.env.BARD_PACKAGED_EXECUTABLE ? config : undefined,
      args: [
        ...(process.env.BARD_PACKAGED_EXECUTABLE ? [] : ["."]),
        `--user-data-dir=${config}`,
        "--use-fake-device-for-media-stream",
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
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await installAIFixture(app);
    await page.evaluate(() => window.bard.setKey("sk-test-only"));
    await page.getByLabel("Your name").fill("Dries");
    await page.getByRole("button", { name: "Enter the College" }).click();
    await page
      .getByRole("button", { name: "The Academy", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Music faculty", exact: true })
      .click();
    await expect(page.locator(".curriculum-card")).toHaveCount(9);
    await expect(page.getByLabel("Music progress")).toContainText(
      "0 participation XP",
    );
    await page.getByRole("button", { name: /An idea before a scale/ }).click();
    if (
      await page
        .getByRole("button", { name: "Start lesson", exact: true })
        .count()
    ) {
      await page
        .getByRole("button", { name: "Start lesson", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Load original demonstration",
          exact: true,
        }),
      ).toBeEnabled();
    }
    await page
      .getByRole("button", { name: "Load original demonstration", exact: true })
      .click();
    await page
      .getByLabel("Musical intention", { exact: true })
      .fill("A quiet question with a higher answer");
    const cell = page.getByRole("button", {
      name: /Idea A, high e, bar 1, eighth slot 1,/,
    });
    await cell.focus();
    await cell.press("3");
    await cell.press("ArrowRight");
    await page.keyboard.press("Delete");
    await expect(cell).toContainText("3");
    await expect(
      page.getByRole("button", {
        name: /Idea A, high e, bar 1, eighth slot 2,/,
      }),
    ).toHaveAttribute("aria-label", /rest/);
    await page
      .getByLabel("What did you try, and what changed?")
      .fill("The higher answer leaves a question.");
    await page
      .getByRole("button", { name: "Play Idea A", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Stop playback" }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Stop playback" }).first().click();
    await page
      .getByRole("button", { name: "Ask the Professor", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "What’s working" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Finish practice", exact: true })
      .click();
    let state = await page.evaluate(() => window.bard.load());
    expect(state.evidence).toHaveLength(0);
    expect(state.attempts.find((a) => a.lessonId === "music-01")!.faculty).toBe(
      "music",
    );
    expect(state.attempts.filter((a) => a.faculty === "writing")).toHaveLength(
      0,
    );
    await page
      .getByText("Optional check-in: how much help did you need?", {
        exact: true,
      })
      .click();
    await page.getByLabel("Evidence for criterion 1").selectOption("supported");
    await page
      .getByRole("button", { name: "Save my check-in", exact: true })
      .click();
    expect(
      await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          stream.getTracks().forEach((t) => t.stop());
          return "unexpected access";
        } catch (e) {
          return (e as DOMException).name;
        }
      }),
    ).toBe("NotAllowedError");
    await page.evaluate(() => window.bard.prepareMicrophone());
    expect(
      await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          stream.getTracks().forEach((t) => t.stop());
          return "unexpected camera";
        } catch (e) {
          return (e as DOMException).name;
        }
      }),
    ).toBe("NotAllowedError");
    // Simulate a disk/save failure, then retry the retained take without recording again.
    await app.evaluate(({ ipcMain }) => {
      (globalThis as any).__recordingHandler = (
        ipcMain as any
      )._invokeHandlers.get("recordings-save");
      ipcMain.removeHandler("recordings-save");
      ipcMain.handle("recordings-save", () => {
        throw Error("Recording storage unavailable (test fixture).");
      });
    });
    // Exercise real getUserMedia / MediaRecorder with Chromium's synthetic input, not a mocked recorder.
    await page
      .getByRole("button", { name: "Record guitar", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Stop and save recording",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(page.getByLabel("Local guitar recordings")).toContainText(
      "Recording locally",
    );
    await page.waitForTimeout(1200);
    await page
      .getByRole("button", { name: "Stop and save recording", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry saving take", exact: true }),
    ).toBeVisible();
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("recordings-save");
      ipcMain.handle("recordings-save", (globalThis as any).__recordingHandler);
    });
    await page
      .getByRole("button", { name: "Retry saving take", exact: true })
      .click();
    await page.getByLabel("Dismiss error", { exact: true }).click();
    await expect(page.getByLabel("Local guitar recordings")).toContainText(
      "Recording saved locally",
    );
    const takes = await page.evaluate(() =>
      window.bard.listRecordings("music-01"),
    );
    expect(takes).toHaveLength(1);
    expect(takes[0].bytes).toBeGreaterThan(100);
    await page.getByRole("button", { name: /Listen to Take/ }).click();
    await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
    const decoded = await page
      .locator("audio")
      .evaluate(async (audio: HTMLAudioElement) => {
        await audio.play();
        return { duration: audio.duration, paused: audio.paused };
      });
    expect(decoded.paused).toBe(false);
    expect(decoded.duration).toBeGreaterThan(0);
    await page.locator("audio").evaluate((a: HTMLAudioElement) => a.pause());
    // All nine examples can be opened and edited; 6/8 and two-bar miniature preserve their distinct count grids.
    await page.getByRole("button", { name: "Back to the Academy" }).click();
    await page.getByRole("button", { name: /Six eighths, two beats/ }).click();
    if (
      await page
        .getByRole("button", { name: "Start lesson", exact: true })
        .count()
    ) {
      await page
        .getByRole("button", { name: "Start lesson", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Load original demonstration",
          exact: true,
        }),
      ).toBeEnabled();
    }
    await page
      .getByRole("button", { name: "Load original demonstration", exact: true })
      .click();
    await expect(page.getByLabel("Idea A metre", { exact: true })).toHaveValue(
      "6/8",
    );
    await expect(
      page.getByLabel("Answer B metre", { exact: true }),
    ).toHaveValue("3/4");
    await expect(
      page.getByRole("table", { name: "Idea A six-string counted tablature" }),
    ).toContainText("la");
    await page.getByRole("button", { name: "Back to the Academy" }).click();
    await page.getByRole("button", { name: /First miniature/ }).click();
    if (
      await page
        .getByRole("button", { name: "Start lesson", exact: true })
        .count()
    ) {
      await page
        .getByRole("button", { name: "Start lesson", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Load original demonstration",
          exact: true,
        }),
      ).toBeEnabled();
    }
    await page
      .getByRole("button", { name: "Load original demonstration", exact: true })
      .click();
    await expect(page.getByLabel("Idea A bars", { exact: true })).toHaveValue(
      "2",
    );
    await page.getByRole("button", { name: "Back to the Academy" }).click();
    await page.getByRole("button", { name: /An idea before a scale/ }).click();
    await page
      .getByRole("button", {
        name: "Start another practice session",
        exact: true,
      })
      .click();
    await installAIFixture(app);
    await page.evaluate(() => window.bard.setKey("sk-test-only"));
    // Refresh hasKey without leaving the lesson.
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByRole("button", { name: "Ask the Professor", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "What’s working" }),
    ).toBeVisible();
    const calls = await app.evaluate(() => (globalThis as any).__bardCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe("gpt-6-luna");
    const input = JSON.parse(calls[0].input);
    expect(input.studentText).toContain("Written musical plan (not heard)");
    expect(calls[0].input).not.toContain("audio/webm");
    expect(calls[0].input).not.toContain(takes[0].id);
    await page.getByText("Try a revision", { exact: true }).click();
    await page
      .getByRole("button", { name: "Copy original into revision", exact: true })
      .click();
    await page
      .getByLabel("Musical intention", { exact: true })
      .last()
      .fill("A more open question");
    await page
      .getByRole("button", { name: "Save revision", exact: true })
      .click();
    await page.screenshot({
      path: "artifacts/phase2-conservatory.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.context().setOffline(true);
    await page
      .getByRole("button", { name: "The Academy", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Music faculty", exact: true })
      .click();
    await page.getByRole("button", { name: /An idea before a scale/ }).click();
    state = await page.evaluate(() => window.bard.load());
    expect(state.evidence[0].faculty).toBe("music");
    expect(
      state.attempts.find((a) => a.lessonId === "music-01")!.revision,
    ).toContain("A more open question");
    expect(
      await page.evaluate(() => window.bard.listRecordings("music-01")),
    ).toEqual(takes);
    await page.getByRole("button", { name: /Listen to Take/ }).click();
    await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: /Delete Take/ }).click();
    await expect
      .poll(() => page.evaluate(() => window.bard.listRecordings("music-01")))
      .toHaveLength(0);
    // Missing/denied device paths report actionable errors without modifying the saved sketch.
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("denied", "NotAllowedError");
      };
    });
    await page
      .getByRole("button", { name: "Record guitar", exact: true })
      .click();
    await expect(page.getByLabel("Local guitar recordings")).toContainText(
      "Microphone access was denied",
    );
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("missing", "NotFoundError");
      };
    });
    await page
      .getByRole("button", { name: "Record guitar", exact: true })
      .click();
    await expect(page.getByLabel("Local guitar recordings")).toContainText(
      "No microphone was found",
    );
    // Normal window close stops and saves an active capture before quitting.
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page
      .getByRole("button", { name: "The Academy", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Music faculty", exact: true })
      .click();
    await page.getByRole("button", { name: /An idea before a scale/ }).click();
    await page
      .getByRole("button", { name: "Record guitar", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Stop and save recording",
        exact: true,
      }),
    ).toBeEnabled();
    await page.waitForTimeout(1100);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    expect(
      await page.evaluate(() => window.bard.listRecordings("music-01")),
    ).toHaveLength(1);
  } finally {
    await app.close();
    rmSync(config, { recursive: true, force: true });
  }
});
