import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { maxRecordingBytes, type Recording } from "../src/shared/music.js";
const metadataSchema = z
  .object({
    id: z.string().uuid(),
    lessonId: z.string().regex(/^music-[a-z0-9-]+$/),
    sketchId: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    mime: z.literal("audio/webm"),
    bytes: z.number().int().positive().max(maxRecordingBytes),
    createdAt: z.string().datetime(),
  })
  .strict();
/** Local-only recordings. Filenames are generated UUIDs; no caller-supplied paths. */
export class Recordings {
  constructor(readonly directory: string) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (
      !fs.lstatSync(directory).isDirectory() ||
      fs.lstatSync(directory).isSymbolicLink()
    )
      throw Error(
        "The recordings directory must be a local directory, not a link.",
      );
  }
  private file(id: string, ext: string) {
    return path.join(this.directory, z.string().uuid().parse(id) + ext);
  }
  list(lessonId: string): Recording[] {
    return fs
      .readdirSync(this.directory)
      .filter((n) => /^[0-9a-f-]{36}\.json$/.test(n))
      .flatMap((n) => {
        try {
          const file = path.join(this.directory, n);
          if (
            !fs.lstatSync(file).isFile() ||
            fs.lstatSync(file).size > 4096 ||
            fs.lstatSync(file).isSymbolicLink()
          )
            return [];
          const meta = metadataSchema.parse(
            JSON.parse(fs.readFileSync(file, "utf8")),
          );
          if (n !== meta.id + ".json") return [];
          const stat = fs.lstatSync(this.file(meta.id, ".webm"));
          return meta.lessonId === lessonId &&
            stat.isFile() &&
            !stat.isSymbolicLink() &&
            stat.size === meta.bytes
            ? [meta]
            : [];
        } catch {
          return [];
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  save(raw: {
    lessonId: string;
    sketchId: string;
    name: string;
    data: Uint8Array;
  }): Recording {
    if (
      !(raw.data instanceof Uint8Array) ||
      raw.data.length < 16 ||
      raw.data.length > maxRecordingBytes ||
      ![0x1a, 0x45, 0xdf, 0xa3].every((b, i) => raw.data[i] === b)
    )
      throw Error("Recording must be a WebM audio capture under 12 MiB.");
    const files = fs
      .readdirSync(this.directory)
      .filter((n) => n.endsWith(".webm"));
    if (
      files.length >= 200 ||
      files.reduce(
        (sum, n) => sum + fs.lstatSync(path.join(this.directory, n)).size,
        0,
      ) +
        raw.data.length >
        256 * 1024 * 1024
    )
      throw Error(
        "Local recording storage is full (200 takes or 256 MiB). Delete unwanted takes and try again.",
      );
    const meta = metadataSchema.parse({
      id: crypto.randomUUID(),
      lessonId: raw.lessonId,
      sketchId: raw.sketchId,
      name: raw.name,
      mime: "audio/webm",
      bytes: raw.data.length,
      createdAt: new Date().toISOString(),
    });
    const audio = this.file(meta.id, ".webm"),
      manifest = this.file(meta.id, ".json");
    let created = false;
    try {
      const fd = fs.openSync(audio, "wx", 0o600);
      created = true;
      try {
        fs.writeFileSync(fd, raw.data);
      } finally {
        fs.closeSync(fd);
      }
      fs.writeFileSync(manifest, JSON.stringify(meta), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (e) {
      if (created && fs.existsSync(audio)) fs.unlinkSync(audio);
      throw e;
    }
    return meta;
  }
  read(lessonId: string, id: string) {
    const meta = this.list(lessonId).find((r) => r.id === id);
    if (!meta)
      throw Error(
        "Recording not found or unreadable. Your sketch is still saved.",
      );
    const file = this.file(id, ".webm");
    const fd = fs.openSync(
      file,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
    );
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.size !== meta.bytes)
        throw Error("Recording changed on disk.");
      return { meta, data: new Uint8Array(fs.readFileSync(fd)) };
    } finally {
      fs.closeSync(fd);
    }
  }
  delete(lessonId: string, id: string) {
    if (!this.list(lessonId).some((r) => r.id === id))
      throw Error("Recording not found.");
    fs.unlinkSync(this.file(id, ".webm"));
    fs.unlinkSync(this.file(id, ".json"));
  }
}
