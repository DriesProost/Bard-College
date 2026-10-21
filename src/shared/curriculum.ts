import { sketchSchema } from "./music.js";
import { z } from "zod";
import type { Profile } from "./model.js";
export const facultySchema = z.enum(["writing", "music"]);
export type Faculty = z.infer<typeof facultySchema>;
export const faculties = [
  {
    id: "writing" as const,
    name: "The College of the Quill",
    label: "Writing",
    description: "Poetry, lyrics, storytelling and an independent voice.",
  },
  {
    id: "music" as const,
    name: "The Conservatory of the Lute",
    label: "Music",
    description:
      "Nine practical foundations in original guitar composition. Tab first; no staff reading required.",
  },
];
export const lessonSchema = z.object({
  id: z.string().regex(/^(lesson|writing|music)-[a-z0-9-]+$/),
  title: z.string().min(1),
  faculty: facultySchema.default("writing"),
  discipline: z.enum([
    "The Quill",
    "The Lute",
    "The Tale",
    "The Wit",
    "The Heart",
    "The Voice",
  ]),
  musicExample: sketchSchema.optional(),
  objective: z.string().min(1),
  explanation: z.string().min(1),
  example: z.string().min(1),
  weakExample: z.string().default(""),
  exercise: z.string().min(1),
  minimumTask: z.string().default(""),
  extension: z.string().default(""),
  transferPrompt: z.string().default(""),
  minimumWords: z.number().int().min(1).max(100).default(8),
  prerequisite: z.string().nullable(),
  assessment: z.array(z.string().min(1)).min(1),
  skillDependencies: z.array(z.string()),
  review: z.array(z.string()),
  sources: z.array(z.string()),
  minutes: z.number().positive(),
  stage: z.string(),
  version: z.number().int().positive(),
  reflection: z.string(),
  timing: z.object({
    notice: z.number(),
    write: z.number(),
    reflect: z.number(),
  }),
});
export const sourceSchema = z.object({
  title: z.string(),
  locator: z.string(),
  scope: z.string(),
});
export const curriculumSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    lessons: z.array(lessonSchema).min(1),
    sources: z.record(z.string(), sourceSchema).default({}),
  })
  .superRefine((data, ctx) => {
    const map = new Map(data.lessons.map((l) => [l.id, l]));
    if (map.size !== data.lessons.length)
      ctx.addIssue({ code: "custom", message: "Duplicate lesson ID" });
    for (const l of data.lessons) {
      if (/^lesson-([1-9]|[12][0-9]|30)$/.test(l.id) && l.faculty !== "writing")
        ctx.addIssue({
          code: "custom",
          message: "Original lyrical lesson IDs belong to Writing",
        });
      for (const dep of [
        l.prerequisite,
        ...l.skillDependencies,
        ...l.review,
      ].filter(Boolean) as string[]) {
        if (!map.has(dep))
          ctx.addIssue({
            code: "custom",
            message: `Missing dependency: ${l.id} → ${dep}`,
          });
        else if (map.get(dep)!.faculty !== l.faculty)
          ctx.addIssue({
            code: "custom",
            message: "Independent faculties cannot require another faculty",
          });
      }
      if (data.version === 2) {
        for (const id of l.sources)
          if (!data.sources[id])
            ctx.addIssue({ code: "custom", message: `Missing source ${id}` });
        if (!l.minimumTask || !l.transferPrompt)
          ctx.addIssue({
            code: "custom",
            message: `Missing practice scaffolding: ${l.id}`,
          });
      }
    }
    const visited = new Set<string>(),
      active = new Set<string>();
    function visit(id: string) {
      if (active.has(id)) {
        ctx.addIssue({
          code: "custom",
          message: "Curriculum dependency cycle",
        });
        return;
      }
      if (visited.has(id) || !map.has(id)) return;
      active.add(id);
      const l = map.get(id)!;
      for (const dep of [
        l.prerequisite,
        ...l.skillDependencies,
        ...l.review,
      ].filter(Boolean) as string[])
        visit(dep);
      active.delete(id);
      visited.add(id);
    }
    for (const id of map.keys()) visit(id);
  });
export type Lesson = z.infer<typeof lessonSchema>;
export type Curriculum = z.infer<typeof curriculumSchema>;
export let lessons: Lesson[] = [];
export let sources: Curriculum["sources"] = {};
export function setCurriculum(data: unknown) {
  const parsed = curriculumSchema.parse(data);
  lessons = parsed.lessons;
  sources = parsed.sources;
  return lessons;
}
export function criterionId(lesson: Lesson, index: number) {
  return `${lesson.id}:criterion-${index + 1}`;
}
export function personalPrompt(profile: Profile) {
  return `You may draw on ${profile.interests || "everyday life"} or ${profile.genres || "any musical tradition"}. Your own subject is always welcome.`;
}
