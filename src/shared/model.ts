import { z } from "zod";
export const disciplines = [
  "The Quill",
  "The Lute",
  "The Tale",
  "The Wit",
  "The Heart",
  "The Voice",
] as const;
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  interests: z.string().max(500),
  genres: z.string().max(300),
  experience: z.enum(["Beginning", "Some practice", "Experienced"]),
  form: z.enum(["Poetry", "Lyrics", "Stories", "A combination"]),
  minutes: z.number().int().min(5).max(60),
  onboarded: z.boolean(),
});
export const settingsSchema = z.object({
  confirmRequests: z.boolean(),
  budget: z.number().min(0).max(10000),
  inputPrice: z.number().min(0).max(10000),
  outputPrice: z.number().min(0).max(10000),
  lightPaper: z.boolean(),
  lineNumbers: z.boolean(),
  reducedMotion: z.boolean(),
});
export const projectSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  body: z.string().max(100000),
  kind: z.enum(["Poem", "Lyrics", "Song", "Story"]),
  completed: z.boolean(),
});
export const feedbackSchema = z.object({
  strength: z.string(),
  reason: z.string(),
  improvements: z.array(z.string()).min(1).max(2),
  question: z.string(),
});
export type Feedback = z.infer<typeof feedbackSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Project = z.infer<typeof projectSchema> & { updatedAt: string };
export type Snapshot = {
  id: number;
  projectId: string;
  title: string;
  body: string;
  createdAt: string;
};
export type EvidenceLevel =
  "introduced" | "supported" | "independent" | "retained";
export type SkillEvidence = {
  id: number;
  lessonId: string;
  faculty: import("./curriculum.js").Faculty;
  contentVersion: number;
  criterionId: string;
  level: EvidenceLevel;
  draft: string;
  reflection: string;
  practicePrompt: string;
  reviewer: "self";
  createdAt: string;
};
export type Attempt = {
  faculty?: import("./curriculum.js").Faculty | "unassigned";
  contentVersion?: number;
  practicePrompt?: string;
  legacy?: boolean;
  lessonId: string;
  body: string;
  revision: string;
  reflection: string;
  completedAt: string;
  feedback: Feedback | null;
  feedbackText: string;
  feedbackVersion?: number;
};
export type AttemptHistory = Attempt & { id: number; createdAt: string };
export type Usage = {
  input: number;
  output: number;
  cost: number;
  createdAt: string;
};
export type State = {
  curriculumVersion: 1 | 2;
  sources: import("./curriculum.js").Curriculum["sources"];
  evidence: SkillEvidence[];
  contentUpdate: import("../../electron/content.js").ContentUpdate | null;
  backups: { database: string; curriculum: string };
  curriculum: import("./curriculum.js").Lesson[];
  profile: Profile;
  settings: Settings;
  projects: Project[];
  attempts: Attempt[];
  events: {
    key: string;
    xp: number;
    discipline: string;
    day: string;
    faculty?: import("./curriculum.js").Faculty | "unassigned";
  }[];
  usage: Usage[];
  hasKey: boolean;
  secureStorage: boolean;
  credentialProtection: string;
};
export type TutorRequest = {
  practicePrompt?: string;
  text: string;
  lessonId?: string;
  question?: string;
  previous?: Feedback;
  confirmed: boolean;
};
export type API = {
  onCloseRequested: (callback: () => void) => () => void;
  finishClose: () => Promise<void>;
  load: () => Promise<State>;
  prepareMicrophone: () => Promise<void>;
  listRecordings: (
    lessonId: string,
  ) => Promise<import("./music.js").Recording[]>;
  saveRecording: (request: {
    lessonId: string;
    sketchId: string;
    name: string;
    data: Uint8Array;
  }) => Promise<import("./music.js").Recording>;
  readRecording: (
    lessonId: string,
    id: string,
  ) => Promise<{ meta: import("./music.js").Recording; data: Uint8Array }>;
  deleteRecording: (lessonId: string, id: string) => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  saveProject: (p: z.infer<typeof projectSchema>) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  snapshot: (id: string) => Promise<void>;
  history: (id: string) => Promise<Snapshot[]>;
  attemptHistory: (id: string) => Promise<AttemptHistory[]>;
  applyCurriculumUpdate: (replaceIds: string[]) => Promise<void>;
  recordEvidence: (request: {
    lessonId: string;
    criteria: { criterionId: string; level: EvidenceLevel }[];
  }) => Promise<void>;
  saveAttempt: (a: {
    practicePrompt?: string;
    lessonId: string;
    body: string;
    revision: string;
    reflection: string;
    complete: boolean;
  }) => Promise<void>;
  tutor: (r: TutorRequest) => Promise<{ feedback: Feedback; usage: Usage }>;
  testAIConnection: (
    confirmed: boolean,
  ) => Promise<{ success: boolean; message: string; usage: Usage }>;
  setKey: (key: string) => Promise<void>;
  exportProject: (id: string, format: "md" | "txt") => Promise<boolean>;
};
export const defaultProfile: Profile = {
  name: "Apprentice",
  interests: "Fantasy ballads, clever twists, emotional lyrics",
  genres: "Acoustic folk, humorous narrative songs",
  experience: "Beginning",
  form: "A combination",
  minutes: 5,
  onboarded: false,
};
export const defaultSettings: Settings = {
  confirmRequests: true,
  budget: 5,
  inputPrice: 0,
  outputPrice: 0,
  lightPaper: true,
  lineNumbers: false,
  reducedMotion: false,
};
