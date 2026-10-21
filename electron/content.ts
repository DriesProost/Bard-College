import fs from "node:fs";
import path from "node:path";
import { curriculumSchema, type Curriculum } from "../src/shared/curriculum.js";

// Ignore JSON object-key order, but preserve every value and unknown custom field.
function canonical(value: any): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export type ContentUpdate = {
  added: number;
  conflicts: {
    id: string;
    title: string;
    currentObjective: string;
    proposedObjective: string;
  }[];
};
export class ContentManager {
  current: Curriculum;
  update: ContentUpdate | null = null;
  backupPath = "";
  readonly file: string;
  private shipped: Curriculum;
  constructor(
    readonly directory: string,
    shippedFile: string,
    legacyFile: string,
    phase1File?: string,
  ) {
    this.file = path.join(directory, "curriculum.json");
    this.shipped = curriculumSchema.parse(
      JSON.parse(fs.readFileSync(shippedFile, "utf8")),
    );
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (!fs.existsSync(this.file)) this.write(this.shipped);
    const backups = path.join(directory, "backups");
    if (fs.existsSync(backups)) {
      const files = fs
        .readdirSync(backups)
        .filter((n) => n.startsWith("curriculum-") && n.endsWith(".json"))
        .sort();
      if (files.length) this.backupPath = path.join(backups, files.at(-1)!);
    }
    const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
    this.current = curriculumSchema.parse(raw);
    const legacyRaw = JSON.parse(fs.readFileSync(legacyFile, "utf8"));
    if (
      canonical(raw) === canonical(legacyRaw) ||
      (phase1File &&
        canonical(raw) ===
          canonical(JSON.parse(fs.readFileSync(phase1File, "utf8"))))
    ) {
      this.backup();
      this.write(this.shipped);
      this.current = this.shipped;
    } else this.inspect();
  }
  private inspect() {
    const map = new Map(this.current.lessons.map((l) => [l.id, l]));
    const added = this.shipped.lessons.filter((l) => !map.has(l.id)).length;
    const conflicts = this.shipped.lessons
      .filter(
        (l) =>
          map.has(l.id) && JSON.stringify(map.get(l.id)) !== JSON.stringify(l),
      )
      .map((l) => ({
        id: l.id,
        title: l.title,
        currentObjective: map.get(l.id)!.objective,
        proposedObjective: l.objective,
      }));
    this.update = added || conflicts.length ? { added, conflicts } : null;
  }
  private backup() {
    const dir = path.join(this.directory, "backups");
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.backupPath = path.join(
      dir,
      `curriculum-${Date.now()}-${crypto.randomUUID()}.json`,
    );
    fs.copyFileSync(this.file, this.backupPath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(this.backupPath, 0o600);
  }
  private write(data: Curriculum) {
    const temp = this.file + "." + crypto.randomUUID() + ".tmp";
    try {
      fs.writeFileSync(temp, JSON.stringify(data, null, 2), {
        mode: 0o600,
        flag: "wx",
      });
      fs.renameSync(temp, this.file);
    } finally {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
  }
  apply(replaceIds: string[]) {
    const allowed = new Set(this.update?.conflicts.map((c) => c.id) || []);
    if (replaceIds.some((id) => !allowed.has(id)))
      throw Error("Unknown curriculum conflict. Reload the preview.");
    const existing = new Map(this.current.lessons.map((l) => [l.id, l]));
    const shippedIds = new Set(this.shipped.lessons.map((l) => l.id));
    const mergedSources = { ...this.shipped.sources, ...this.current.sources };
    for (const l of this.current.lessons)
      for (const key of l.sources)
        if (!mergedSources[key])
          mergedSources[key] = {
            title: key,
            locator: "Custom curriculum reference",
            scope:
              "Unverified custom attribution retained from the installed file. No access or accuracy is claimed.",
          };
    const candidate = curriculumSchema.parse({
      version: 2,
      sources: mergedSources,
      lessons: [
        ...this.shipped.lessons.map((l) =>
          existing.has(l.id) && !replaceIds.includes(l.id)
            ? {
                ...existing.get(l.id)!,
                minimumTask:
                  existing.get(l.id)!.minimumTask ||
                  existing.get(l.id)!.exercise,
                transferPrompt:
                  existing.get(l.id)!.transferPrompt || l.transferPrompt,
              }
            : l,
        ),
        ...this.current.lessons
          .filter((l) => !shippedIds.has(l.id))
          .map((l) => ({
            ...l,
            minimumTask: l.minimumTask || l.exercise,
            transferPrompt:
              l.transferPrompt ||
              "Try this skill on an unfamiliar subject and explain one choice.",
          })),
      ],
    });
    this.backup();
    this.write(candidate);
    this.current = candidate;
    this.inspect();
    return this.current;
  }
}
