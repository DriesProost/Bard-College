import { z } from "zod";
import type { Feedback, State } from "./model.js";
import type { Faculty } from "./curriculum.js";
import { meaningfulSketch } from "./music.js";
export const REVIEW_LIMIT = 3;
export const guidanceSchema = z.object({
  explanation: z.string().min(1).max(2000),
  notice: z.string().min(1).max(1000),
  firstStep: z.string().min(1).max(1000),
  finishLine: z.string().min(1).max(1000),
});
export type LessonGuidance = z.infer<typeof guidanceSchema>;
export type TutorSession = {
  id: string;
  scope: string;
  contentVersion: number;
  practicePrompt: string;
  createdAt: string;
  completedAt: string;
  guidance: LessonGuidance | null;
  turns: { text: string; feedback: Feedback; createdAt: string }[];
};
export const localDay = (time = new Date()) => time.toLocaleDateString("en-CA");
export function currentSession(
  state: Pick<State, "tutorSessions">,
  scope: string,
  version: number,
  prompt = "",
) {
  return (
    state.tutorSessions.find(
      (s) =>
        s.scope === scope &&
        s.contentVersion === version &&
        s.practicePrompt === prompt &&
        !s.completedAt,
    ) ||
    state.tutorSessions.find(
      (s) =>
        s.scope === scope &&
        s.contentVersion === version &&
        s.practicePrompt === prompt,
    )
  );
}
export function reviewedDraft(session: TutorSession | undefined, text: string) {
  return (
    !!session?.guidance &&
    !!session.turns.length &&
    session.turns.at(-1)!.text.trim() === text.trim()
  );
}
export function dailyPractice(
  state: State,
  faculty: Faculty,
  day = localDay(),
) {
  const path = state.curriculum.filter((l) => l.faculty === faculty);
  const done = state.tutorSessions.find(
    (s) =>
      s.completedAt &&
      localDay(new Date(s.completedAt)) === day &&
      path.some((l) => l.id === s.scope),
  );
  const active = state.tutorSessions.find(
    (s) => !s.completedAt && s.guidance && path.some((l) => l.id === s.scope),
  );
  const lesson =
    path.find((l) => l.id === (done || active)?.scope) ||
    path.find(
      (l) => !state.attempts.find((a) => a.lessonId === l.id)?.completedAt,
    ) ||
    path[0];
  if (!lesson) return null;
  const attempt = state.attempts.find((a) => a.lessonId === lesson.id);
  const session =
    done ||
    currentSession(
      state,
      lesson.id,
      lesson.version,
      attempt?.practicePrompt || "",
    );
  const text = attempt?.revision || attempt?.body || "";
  const drafted =
    lesson.faculty === "music"
      ? meaningfulSketch(text)
      : text.trim().split(/\s+/).filter(Boolean).length >= lesson.minimumWords;
  return {
    lesson,
    session,
    done: !!done,
    drafted: !!done || drafted,
    reviewed: !!done || reviewedDraft(session, text),
  };
}
export const evidenceOptions = {
  introduced: {
    label: "I’m still learning this",
    meaning:
      "You recognise the idea, but have not yet shown you can use it in your own work.",
  },
  supported: {
    label: "I can do this with help",
    meaning:
      "You used a worked example, hints or step-by-step help to make the choice in this draft.",
  },
  independent: {
    label: "I can do this on my own",
    meaning:
      "You made this choice yourself, without copying an example or following step-by-step instructions. Getting feedback afterwards is fine.",
  },
  retained: {
    label: "I used it in a new exercise",
    meaning:
      "After an ‘on my own’ attempt, you used the skill in different work on the new exercise. Changing only your explanation is not enough.",
  },
} as const;
