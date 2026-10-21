import { contextBridge, ipcRenderer } from "electron";
const invoke = (channel: string, ...args: unknown[]) =>
  ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld(
  "bard",
  Object.freeze({
    onCloseRequested: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("prepare-close", listener);
      return () => ipcRenderer.removeListener("prepare-close", listener);
    },
    finishClose: () => invoke("close-ready"),
    load: () => invoke("load"),
    prepareMicrophone: () => invoke("prepare-microphone"),
    listRecordings: (lessonId: string) => invoke("recordings-list", lessonId),
    saveRecording: (request: unknown) => invoke("recordings-save", request),
    readRecording: (lessonId: string, id: string) =>
      invoke("recordings-read", lessonId, id),
    deleteRecording: (lessonId: string, id: string) =>
      invoke("recordings-delete", lessonId, id),
    saveProfile: (p: unknown) => invoke("profile", p),
    saveSettings: (s: unknown) => invoke("settings", s),
    saveProject: (p: unknown) => invoke("project", p),
    deleteProject: (id: string) => invoke("delete", id),
    snapshot: (id: string) => invoke("snapshot", id),
    history: (id: string) => invoke("history", id),
    applyCurriculumUpdate: (ids: string[]) => invoke("curriculum-update", ids),
    attemptHistory: (id: string) => invoke("attempt-history", id),
    recordEvidence: (request: unknown) => invoke("evidence", request),
    saveAttempt: (a: unknown) => invoke("attempt", a),
    tutor: (r: unknown) => invoke("tutor", r),
    testAIConnection: (confirmed: boolean) => invoke("test-ai", confirmed),
    setKey: (key: string) => invoke("key", key),
    exportProject: (id: string, format: string) => invoke("export", id, format),
  }),
);
