import type { State } from "./model.js";
export const ranks = [
  "Tavern Whelp",
  "Apprentice Minstrel",
  "Wandering Bard",
  "Silver-Tongued Troubadour",
  "Master of the Quill",
  "Bard of Legend",
];
export function progression(events: State["events"]) {
  const xp = events.reduce((s, e) => s + e.xp, 0);
  return {
    xp,
    rank: ranks[Math.min(5, Math.floor(xp / 250))],
    next: 250 - (xp % 250),
    level: Math.min(6, Math.floor(xp / 250) + 1),
  };
}
export function streak(
  events: State["events"],
  today = new Date().toLocaleDateString("en-CA"),
) {
  const days = new Set(events.map((e) => e.day));
  let date = new Date(today + "T12:00:00");
  if (!days.has(today)) date.setDate(date.getDate() - 1);
  let count = 0;
  while (days.has(date.toLocaleDateString("en-CA"))) {
    count++;
    date.setDate(date.getDate() - 1);
  }
  return count;
}
export function syllables(text: string) {
  return (text.toLowerCase().match(/[a-z]+/g) || []).reduce(
    (sum, word) =>
      sum +
      Math.max(1, (word.replace(/e$/, "").match(/[aeiouy]+/g) || []).length),
    0,
  );
}

export function dueReview(
  state: Pick<State, "attempts" | "events" | "curriculum">,
  now = new Date(),
) {
  const due = state.attempts
    .filter((a) => a.completedAt)
    .map((a) => {
      const reviews = state.events
        .filter((e) => e.key.startsWith(`practice:${a.lessonId}:`))
        .sort((a, b) => b.day.localeCompare(a.day));
      const last = reviews[0]?.day || a.completedAt.slice(0, 10);
      const elapsed =
        (now.getTime() - new Date(last + "T12:00:00").getTime()) / 86400000;
      const interval = [1, 3, 7, 14][Math.min(3, reviews.length)];
      return { id: a.lessonId, overdue: elapsed - interval };
    })
    .filter((a) => a.overdue >= 0)
    .sort((a, b) => b.overdue - a.overdue);
  return state.curriculum.find((l) => l.id === due[0]?.id);
}

/** Participation is separate from criterion evidence; historical Lute tags never imply Music. */
export function facultyProgress(
  state: Pick<State, "curriculum" | "attempts" | "events" | "evidence">,
  faculty: import("./curriculum.js").Faculty,
) {
  const path = state.curriculum.filter((l) => l.faculty === faculty),
    ids = new Set(path.map((l) => l.id));
  const attempts = state.attempts.filter(
    (a) => ids.has(a.lessonId) && a.faculty === faculty,
  );
  const evidence = state.evidence.filter((e) => e.faculty === faculty);
  const latest = new Map<string, State["evidence"][number]>();
  for (const e of evidence) {
    const lesson = path.find((l) => l.id === e.lessonId);
    if (lesson?.version === e.contentVersion) latest.set(e.criterionId, e);
  }
  return {
    total: path.length,
    completed: attempts.filter((a) => a.completedAt).length,
    participation: attempts.filter((a) => a.body.trim() || a.revision.trim())
      .length,
    xp: state.events
      .filter((e) => e.faculty === faculty)
      .reduce((n, e) => n + e.xp, 0),
    introduced: [...latest.values()].filter((e) => e.level === "introduced")
      .length,
    supported: [...latest.values()].filter((e) => e.level === "supported")
      .length,
    independent: [...latest.values()].filter((e) => e.level === "independent")
      .length,
    retained: [...latest.values()].filter((e) => e.level === "retained").length,
    evidenceRecords: evidence.length,
    next: path.find(
      (l) => !attempts.some((a) => a.lessonId === l.id && a.completedAt),
    ),
  };
}
