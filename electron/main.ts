import { Recordings } from "./recordings.js";
import { maxRecordingBytes, parseSketch } from "../src/shared/music.js";
import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  dialog,
  session,
} from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import { ContentManager } from "./content.js";
import { Store } from "./store.js";
import { KeyVault } from "./vault.js";
import { askTutor, testAIConnection } from "./tutor.js";
import { setCurriculum, lessons } from "../src/shared/curriculum.js";
import { trustedSender } from "./security.js";
import {
  profileSchema,
  settingsSchema,
  projectSchema,
  feedbackSchema,
} from "../src/shared/model.js";
// A trusted command-line override keeps desktop tests isolated from a real profile.
const testDataDirectory = app.commandLine.getSwitchValue("user-data-dir");
if (testDataDirectory) app.setPath("userData", path.resolve(testDataDirectory));
const here = path.dirname(fileURLToPath(import.meta.url));
const index = path.resolve(here, "../../dist/index.html");
const dev = !app.isPackaged && process.argv.includes("--dev");
let store: Store;
let content: ContentManager;
let window: BrowserWindow;
let busy = false;
let allowClose = false;
let closing = false;
let vault: KeyVault;
let microphoneUntil = 0;
function handle(channel: string, fn: (...args: any[]) => unknown) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !trustedSender(event.senderFrame.url, index, dev)
    )
      throw Error("Untrusted application request.");
    return fn(...args);
  });
}
const ownsProfile = app.requestSingleInstanceLock();
if (!ownsProfile) app.quit();
app.on("second-instance", () => {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
});
if (ownsProfile)
  app
    .whenReady()
    .then(async () => {
      await fs.mkdir(app.getPath("userData"), { recursive: true, mode: 0o700 });
      if (process.platform === "win32")
        app.setAppUserModelId("college.bards.desktop");
      store = new Store(path.join(app.getPath("userData"), "college.sqlite"));
      content = new ContentManager(
        app.getPath("userData"),
        path.join(app.getAppPath(), "curriculum/lessons.json"),
        path.join(app.getAppPath(), "curriculum/legacy-v1.json"),
        path.join(app.getAppPath(), "curriculum/legacy-phase1-v2.json"),
      );
      setCurriculum(content.current);
      vault = new KeyVault(store, safeStorage, process.platform);
      window = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 900,
        minHeight: 650,
        backgroundColor: "#102a24",
        title: "Bard's College",
        autoHideMenuBar: true,
        icon: path.join(app.getAppPath(), "build/icon.png"),
        webPreferences: {
          preload: path.join(here, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      window.on("close", (event) => {
        if (allowClose) return;
        event.preventDefault();
        if (closing) return;
        closing = true;
        window.webContents.send("prepare-close");
        setTimeout(() => {
          if (!closing || allowClose || window.isDestroyed()) return;
          const choice = dialog.showMessageBoxSync(window, {
            type: "warning",
            buttons: ["Keep writing", "Close anyway"],
            defaultId: 0,
            cancelId: 0,
            message: "The last changes could not be confirmed saved.",
            detail:
              "Keep the app open to retry saving, or close and risk losing recent edits.",
          });
          closing = false;
          if (choice === 1) {
            allowClose = true;
            window.close();
          }
        }, 8000).unref();
      });
      handle("close-ready", () => {
        allowClose = true;
        closing = false;
        window.close();
      });
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, url) => {
        if (!trustedSender(url, index, dev)) event.preventDefault();
      });
      const recordings = new Recordings(
        path.join(app.getPath("userData"), "recordings"),
      );
      const musicLesson = (raw: unknown) => {
        const id = z.string().max(100).parse(raw);
        if (!lessons.some((l) => l.id === id && l.faculty === "music"))
          throw Error("Unknown Music lesson.");
        return id;
      };
      handle("prepare-microphone", () => {
        microphoneUntil = Date.now() + 15000;
      });
      session.defaultSession.setPermissionCheckHandler(
        (wc, permission, _origin, details) =>
          wc === window.webContents &&
          permission === "media" &&
          details.isMainFrame &&
          details.mediaType === "audio" &&
          trustedSender(details.requestingUrl || "", index, dev) &&
          Date.now() < microphoneUntil &&
          trustedSender(wc.getURL(), index, dev),
      );
      session.defaultSession.setPermissionRequestHandler(
        (wc, permission, callback, details) => {
          const allowed =
            wc === window.webContents &&
            permission === "media" &&
            details.isMainFrame &&
            "mediaTypes" in details &&
            details.mediaTypes?.length === 1 &&
            details.mediaTypes[0] === "audio" &&
            Date.now() < microphoneUntil &&
            trustedSender(details.requestingUrl, index, dev);
          callback(!!allowed);
        },
      );
      handle("recordings-list", (lessonId) =>
        recordings.list(musicLesson(lessonId)),
      );
      handle("recordings-save", (raw) => {
        const r = z
          .object({
            lessonId: z.string(),
            sketchId: z.string().uuid(),
            name: z.string().trim().min(1).max(100),
            data: z
              .instanceof(Uint8Array)
              .refine((d) => d.length <= maxRecordingBytes),
          })
          .strict()
          .parse(raw);
        musicLesson(r.lessonId);
        const current = store
          .state()
          .attempts.find((a) => a.lessonId === r.lessonId);
        const attempts = [current, ...store.attemptHistory(r.lessonId)];
        if (
          !attempts.some(
            (a) =>
              a &&
              [a.body, a.revision].some(
                (body) => parseSketch(body)?.id === r.sketchId,
              ),
          )
        )
          throw Error(
            "Save the linked musical sketch before saving a recording.",
          );
        return recordings.save(r);
      });
      handle("recordings-read", (lessonId, id) =>
        recordings.read(musicLesson(lessonId), z.string().uuid().parse(id)),
      );
      handle("recordings-delete", (lessonId, id) =>
        recordings.delete(musicLesson(lessonId), z.string().uuid().parse(id)),
      );
      session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            "Content-Security-Policy": [
              dev
                ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:5173; media-src 'self' blob:; img-src 'self' data:"
                : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; media-src 'self' blob:; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-src 'none'",
            ],
          },
        }),
      );
      handle("load", () => ({
        ...store.state(),
        curriculumVersion: content.current.version,
        contentUpdate: content.update,
        backups: { database: store.backupPath, curriculum: content.backupPath },
        hasKey: vault.hasKey(),
        secureStorage: vault.available(),
        credentialProtection: vault.protection(),
      }));
      handle("curriculum-update", (raw) => {
        const ids = z.array(z.string().max(100)).max(500).parse(raw);
        setCurriculum(content.apply(ids));
      });
      handle("attempt-history", (id) =>
        store.attemptHistory(z.string().max(100).parse(id)),
      );
      handle("evidence", (raw) =>
        store.recordEvidence(
          z
            .object({
              lessonId: z.string().max(100),
              criteria: z
                .array(
                  z.object({
                    criterionId: z.string().max(160),
                    level: z.enum([
                      "introduced",
                      "supported",
                      "independent",
                      "retained",
                    ]),
                  }),
                )
                .min(1)
                .max(30),
            })
            .parse(raw),
        ),
      );
      handle("profile", (p) => store.set("profile", profileSchema.parse(p)));
      handle("settings", (s) => store.set("settings", settingsSchema.parse(s)));
      handle("project", (p) => store.saveProject(projectSchema.parse(p)));
      for (const [channel, fn] of [
        ["delete", (id: string) => store.deleteProject(id)],
        ["snapshot", (id: string) => store.snapshot(id)],
        ["history", (id: string) => store.history(id)],
      ] as const)
        handle(channel, (id) => fn(z.string().uuid().parse(id)));
      handle("attempt", (a) =>
        store.saveAttempt(
          z
            .object({
              lessonId: z.string().max(100),
              body: z.string().max(20000),
              revision: z.string().max(20000),
              reflection: z.string().max(2000),
              complete: z.boolean(),
              practicePrompt: z.string().max(4000).optional(),
            })
            .parse(a),
        ),
      );
      handle("key", (raw) => vault.save(z.string().trim().max(512).parse(raw)));
      handle("test-ai", async (confirmed) => {
        z.literal(true).parse(confirmed);
        if (busy) throw Error("An AI request is already running.");
        const key = vault.read();
        busy = true;
        try {
          const result = await testAIConnection(key, store.settings());
          store.recordUsage(result.usage);
          return result;
        } finally {
          busy = false;
        }
      });
      handle("tutor", async (raw) => {
        const r = z
          .object({
            text: z.string().trim().min(1).max(20000),
            lessonId: z.string().max(100).optional(),
            question: z.string().max(2000).optional(),
            previous: feedbackSchema.optional(),
            confirmed: z.boolean(),
            practicePrompt: z.string().max(4000).optional(),
          })
          .parse(raw);
        if (busy) throw Error("A tutor request is already running.");
        const key = vault.read();
        busy = true;
        try {
          const requestedVersion = lessons.find(
            (l) => l.id === r.lessonId,
          )?.version;
          const result = await askTutor(
            key,
            r,
            store.profile(),
            store.settings(),
            store.state().usage.reduce((s, u) => s + u.cost, 0),
          );
          store.recordUsage(result.usage);
          if (!result.feedback)
            throw Error(
              "The tutor returned incomplete feedback or declined this request. Token usage was recorded. Try a shorter passage.",
            );
          if (r.lessonId)
            store.feedback(
              r.lessonId,
              r.text,
              result.feedback,
              requestedVersion,
            );
          return result;
        } finally {
          busy = false;
        }
      });
      handle("export", async (id, format) => {
        const p = store.project(z.string().uuid().parse(id));
        if (!p) throw Error("Project not found.");
        const ext = z.enum(["md", "txt"]).parse(format);
        const result = await dialog.showSaveDialog(window, {
          defaultPath:
            p.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 100) + "." + ext,
          filters: [
            {
              name: ext === "md" ? "Markdown" : "Plain text",
              extensions: [ext],
            },
          ],
        });
        if (result.canceled || !result.filePath) return false;
        await fs.writeFile(
          result.filePath,
          (ext === "md" ? "# " + p.title + "\n\n" : p.title + "\n\n") + p.body,
          "utf8",
        );
        return true;
      });
      if (dev) void window.loadURL("http://127.0.0.1:5173");
      else void window.loadFile(index);
    })
    .catch((e) => {
      dialog.showErrorBox(
        "Bard’s College could not open",
        e instanceof Error ? e.message : "Startup failed",
      );
      app.quit();
    });
app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => store?.close());
