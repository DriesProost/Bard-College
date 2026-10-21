import { z } from "zod";
export const tuning = [64, 59, 55, 50, 45, 40] as const; // high e → low E, sounding MIDI
export const stringNames = ["high e", "B", "G", "D", "A", "low E"];
export const meters = ["4/4", "3/4", "6/8"] as const;
export type Meter = (typeof meters)[number];
export const slotsPerBar = (meter: Meter) => (meter === "4/4" ? 8 : 6);
export function counts(meter: Meter) {
  return meter === "6/8"
    ? ["1", "la", "li", "2", "la", "li"]
    : Array.from({ length: slotsPerBar(meter) }, (_, i) =>
        i % 2 ? "&" : String(i / 2 + 1),
      );
}
export function pitch(string: number, fret: number) {
  if (
    !Number.isInteger(string) ||
    string < 0 ||
    string > 5 ||
    !Number.isInteger(fret) ||
    fret < 0 ||
    fret > 24
  )
    throw Error("Invalid standard-tuning string or fret.");
  return tuning[string] + fret;
}
export function pitchName(midi: number) {
  return (
    ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"][
      ((midi % 12) + 12) % 12
    ] +
    (Math.floor(midi / 12) - 1)
  );
}
export function interval(a: number, b: number) {
  const n = Math.abs(b - a);
  return (
    [
      "unison",
      "minor second",
      "major second",
      "minor third",
      "major third",
      "perfect fourth",
      "tritone",
      "perfect fifth",
      "minor sixth",
      "major sixth",
      "minor seventh",
      "major seventh",
      "octave",
    ][n] || `${n} semitones`
  );
}
const noteSchema = z
  .object({
    tick: z.number().int().min(0).max(15),
    string: z.number().int().min(0).max(5),
    fret: z.number().int().min(0).max(24),
    duration: z.number().int().min(1).max(8),
  })
  .strict();
export const phraseSchema = z
  .object({
    name: z.string().max(60),
    meter: z.enum(meters),
    bars: z.number().int().min(1).max(2),
    notes: z.array(noteSchema).max(16),
  })
  .strict()
  .superRefine((p, ctx) => {
    const occupied = new Set<number>();
    for (const n of p.notes) {
      const width = slotsPerBar(p.meter);
      if (
        n.tick + n.duration > p.bars * width ||
        Math.floor(n.tick / width) !==
          Math.floor((n.tick + n.duration - 1) / width)
      )
        ctx.addIssue({
          code: "custom",
          message: "A note must fit within its counted bar.",
        });
      for (let t = n.tick; t < n.tick + n.duration; t++) {
        if (occupied.has(t))
          ctx.addIssue({
            code: "custom",
            message:
              "Overlapping notes: these foundation sketches are monophonic.",
          });
        occupied.add(t);
      }
    }
  });
export const sketchSchema = z
  .object({
    kind: z.literal("bard-music-v1"),
    id: z.string().uuid(),
    tuning: z.literal("standard"),
    capo: z.literal(0),
    intent: z.string().max(1000),
    observation: z.string().max(2000),
    tempo: z.number().int().min(30).max(200),
    phrases: z.array(phraseSchema).min(1).max(2),
  })
  .strict();
export type MusicSketch = z.infer<typeof sketchSchema>;
export type Phrase = MusicSketch["phrases"][number];
export function parseSketch(body: string): MusicSketch | null {
  try {
    return sketchSchema.parse(JSON.parse(body));
  } catch {
    return null;
  }
}
export function blankSketch(): MusicSketch {
  return {
    kind: "bard-music-v1",
    id: crypto.randomUUID(),
    tuning: "standard",
    capo: 0,
    intent: "",
    observation: "",
    tempo: 80,
    phrases: [
      { name: "Idea A", meter: "4/4", bars: 1, notes: [] },
      { name: "Answer B", meter: "4/4", bars: 1, notes: [] },
    ],
  };
}
export function slotState(phrase: Phrase, tick: number) {
  const note = phrase.notes.find(
    (n) => tick >= n.tick && tick < n.tick + n.duration,
  );
  return { note, hold: !!note && note.tick !== tick };
}
export function place(
  phrase: Phrase,
  tick: number,
  string: number,
  fret: number | null,
  duration: number,
): Phrase {
  const width = slotsPerBar(phrase.meter);
  if (tick < 0 || tick >= width * phrase.bars)
    throw Error("Slot outside phrase.");
  const length = Math.min(duration, width - (tick % width));
  // Editing a hold shortens its preceding note; replacing an attack replaces its duration.
  const notes = phrase.notes.flatMap((n) => {
    if (n.tick < tick && n.tick + n.duration > tick)
      return [{ ...n, duration: tick - n.tick }];
    if (n.tick >= tick && n.tick < tick + (fret === null ? 1 : length))
      return [];
    return [n];
  });
  if (fret !== null) notes.push({ tick, string, fret, duration: length });
  return phraseSchema.parse({
    ...phrase,
    notes: notes.sort((a, b) => a.tick - b.tick),
  });
}
export function meaningfulSketch(body: string) {
  const s = parseSketch(body);
  return !!s && !!s.intent.trim() && s.phrases.some((p) => p.notes.length > 0);
}
export function musicText(body: string): string {
  const s = parseSketch(body);
  if (!s) return body;
  return [
    `Written musical plan (not heard). Standard tuning E2 A2 D3 G3 B3 E4; no capo.`,
    `Intention: ${s.intent}`,
    `Tempo: ${s.tempo} quarter notes/minute (6/8 dotted-quarter pulse = ${Math.round(((s.tempo * 2) / 3) * 10) / 10}/minute).`,
    ...s.phrases.map((p) => {
      const width = slotsPerBar(p.meter);
      const events = Array.from({ length: width * p.bars }, (_, tick) => {
        const { note, hold } = slotState(p, tick);
        const position = `bar ${Math.floor(tick / width) + 1}, ${counts(p.meter)[tick % width]} (eighth slot ${(tick % width) + 1})`;
        return `${position}: ${hold ? "hold" : note ? `${stringNames[note.string]} fret ${note.fret}, ${pitchName(pitch(note.string, note.fret))}, ${note.duration} eighth(s)` : "rest"}`;
      });
      return `${p.name}: ${p.meter}; ${p.bars} bar(s); counted ${counts(p.meter).join(" ")}.\n${events.join("; ")}`;
    }),
    `Student listening/playing self-report (not verified): ${s.observation || "not supplied"}`,
  ].join("\n\n");
}
export type Recording = {
  id: string;
  lessonId: string;
  sketchId: string;
  name: string;
  mime: string;
  bytes: number;
  createdAt: string;
};
export const maxRecordingBytes = 12 * 1024 * 1024;

/** Retention needs changed musical work, rather than just a new UUID or reflection. */
export function musicalContentKey(body: string): string {
  const s = parseSketch(body);
  if (!s) return body.trim();
  return JSON.stringify({
    tuning: s.tuning,
    capo: s.capo,
    tempo: s.tempo,
    phrases: s.phrases.map((p) => ({
      meter: p.meter,
      bars: p.bars,
      notes: [...p.notes].sort((a, b) => a.tick - b.tick),
    })),
  });
}
