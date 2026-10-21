import { useEffect, useRef, useState } from "react";
import {
  blankSketch,
  counts,
  interval,
  meters,
  musicText,
  parseSketch,
  pitch,
  pitchName,
  place,
  slotsPerBar,
  slotState,
  stringNames,
  type MusicSketch,
  type Phrase,
  type Recording,
  maxRecordingBytes,
} from "./shared/music";
import { pendingSaves } from "./persistence";

export function MusicWorkbench({
  value,
  onChange,
  lessonId,
  fail,
  beforeRecord,
  example,
  revision = false,
}: {
  value: string;
  onChange: (value: string) => void;
  lessonId: string;
  fail: (e: unknown) => void;
  beforeRecord: () => Promise<boolean>;
  revision?: boolean;
  example?: MusicSketch;
}) {
  const initial = useRef(blankSketch());
  const sketch = parseSketch(value) || initial.current;
  const [fret, setFret] = useState(0),
    [duration, setDuration] = useState(2),
    [playing, setPlaying] = useState(false),
    [metronome, setMetronome] = useState(true);
  const audio = useRef<AudioContext | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = (next: MusicSketch) => onChange(JSON.stringify(next));
  function stop() {
    if (endTimer.current) clearTimeout(endTimer.current);
    void audio.current?.close();
    audio.current = null;
    setPlaying(false);
  }
  useEffect(
    () => () => {
      if (endTimer.current) clearTimeout(endTimer.current);
      void audio.current?.close();
    },
    [],
  );
  async function play(p: Phrase) {
    stop();
    try {
      const ctx = new AudioContext();
      audio.current = ctx;
      await ctx.resume();
      setPlaying(true);
      const tick = 30 / sketch.tempo,
        start = ctx.currentTime + 0.08,
        total = slotsPerBar(p.meter) * p.bars;
      const tone = (
        hz: number,
        at: number,
        length: number,
        volume: number,
        type: OscillatorType = "triangle",
      ) => {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(volume, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          at + Math.max(0.02, length),
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + length + 0.02);
      };
      for (const n of p.notes)
        tone(
          440 * 2 ** ((pitch(n.string, n.fret) - 69) / 12),
          start + n.tick * tick,
          n.duration * tick * 0.92,
          0.15,
        );
      if (metronome)
        for (let t = 0; t < total; t++) {
          const local = t % slotsPerBar(p.meter),
            beat = p.meter === "6/8" ? local % 3 === 0 : local % 2 === 0;
          if (beat)
            tone(
              local === 0 ? 1200 : 850,
              start + t * tick,
              0.035,
              0.05,
              "sine",
            );
        }
      endTimer.current = setTimeout(stop, (total * tick + 0.3) * 1000);
    } catch (e) {
      stop();
      fail(e);
    }
  }
  function changePhrase(index: number, next: Phrase) {
    stop();
    update({
      ...sketch,
      phrases: sketch.phrases.map((p, i) => (i === index ? next : p)),
    });
  }
  function edit(
    index: number,
    tick: number,
    string: number,
    noteFret: number | null,
  ) {
    try {
      changePhrase(
        index,
        place(sketch.phrases[index], tick, string, noteFret, duration),
      );
    } catch (e) {
      fail(e);
    }
  }
  return (
    <div className="music-workbench">
      <p className="hint">
        Standard tuning · no capo · high e at top, low E at bottom. Frets 0–24;
        0 means open. Each column is one eighth note. A dash is a rest; “hold”
        continues the previous note. These sketches are one note at a time.
      </p>
      {example && (
        <button
          className="secondary"
          onClick={async () => {
            if (
              value &&
              !window.confirm(
                "Load the original teaching example into this draft? Earlier saved work stays in attempt history.",
              )
            )
              return;
            if (await beforeRecord())
              update({ ...example, id: crypto.randomUUID() });
          }}
        >
          Load original demonstration
        </button>
      )}
      {!value && (
        <button className="secondary" onClick={() => update(sketch)}>
          Start a musical sketch
        </button>
      )}
      <label>
        Musical intention
        <input
          value={sketch.intent}
          maxLength={1000}
          placeholder="What should this idea suggest?"
          onChange={(e) => update({ ...sketch, intent: e.target.value })}
        />
      </label>
      <div className="music-controls">
        <label>
          Fret to place
          <input
            type="number"
            min={0}
            max={24}
            value={fret}
            onChange={(e) =>
              setFret(
                Math.max(0, Math.min(24, Math.trunc(Number(e.target.value)))),
              )
            }
          />
        </label>
        <label>
          Note length
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value={1}>Eighth · 1 slot</option>
            <option value={2}>Quarter · 2 slots</option>
            <option value={3}>Dotted quarter · 3 slots</option>
            <option value={4}>Half · 4 slots</option>
          </select>
        </label>
        <label>
          Quarter-note tempo
          <input
            type="number"
            min={30}
            max={200}
            value={sketch.tempo}
            onChange={(e) => {
              stop();
              update({
                ...sketch,
                tempo: Math.max(
                  30,
                  Math.min(200, Math.trunc(Number(e.target.value))),
                ),
              });
            }}
          />
        </label>
        <label className="challenge-toggle">
          <input
            type="checkbox"
            checked={metronome}
            onChange={(e) => setMetronome(e.target.checked)}
          />{" "}
          Counted pulse during playback
        </label>
      </div>
      <p className="hint">
        Choose fret and length, then click a string/count cell. Arrow keys move
        between cells; number keys place frets 0–9; use the fret field for
        10–24. Delete or Backspace makes a rest. A new note replaces covered
        notes; undo by restoring an earlier saved attempt. Notes stop at the bar
        line.
      </p>
      {sketch.phrases.map((p, index) => {
        const width = slotsPerBar(p.meter),
          total = width * p.bars;
        return (
          <section className="music-phrase" key={index} aria-label={p.name}>
            <h3>{p.name}</h3>
            <div className="music-controls">
              <label>
                {p.name} metre
                <select
                  aria-label={`${p.name} metre`}
                  value={p.meter}
                  onChange={(e) => {
                    const meter = e.target.value as Phrase["meter"];
                    if (
                      p.notes.length &&
                      !window.confirm(
                        "Changing metre clears this phrase’s notes. Your saved earlier attempt remains in history. Continue?",
                      )
                    )
                      return;
                    changePhrase(index, { ...p, meter, notes: [] });
                  }}
                >
                  {meters.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                {p.name} bars
                <select
                  aria-label={`${p.name} bars`}
                  value={p.bars}
                  onChange={(e) => {
                    const bars = Number(e.target.value);
                    if (
                      bars < p.bars &&
                      p.notes.some((n) => n.tick >= width) &&
                      !window.confirm("Remove the second bar from this phrase?")
                    )
                      return;
                    changePhrase(index, {
                      ...p,
                      bars,
                      notes: p.notes.filter((n) => n.tick < width * bars),
                    });
                  }}
                >
                  <option value={1}>One bar</option>
                  <option value={2}>Two bars</option>
                </select>
              </label>
              <button
                className="secondary"
                onClick={() => void play(p)}
                disabled={playing || !p.notes.length}
              >
                Play {p.name}
              </button>
              {playing && (
                <button className="secondary" onClick={stop}>
                  Stop playback
                </button>
              )}
            </div>
            <p className="hint">
              {p.meter === "6/8"
                ? `Two beats: 1-la-li 2-la-li. Dotted-quarter pulse ${Math.round(((sketch.tempo * 2) / 3) * 10) / 10}/minute.`
                : `${p.meter === "3/4" ? "Three" : "Four"} quarter-note beats per bar.`}{" "}
              Synthetic playback demonstrates the written plan; it does not
              reproduce or assess your playing.
            </p>
            <div className="tab-scroll">
              <table
                className="tab-grid"
                aria-label={`${p.name} six-string counted tablature`}
              >
                <thead>
                  <tr>
                    <th>String</th>
                    {Array.from({ length: total }, (_, t) => (
                      <th
                        key={t}
                        className={t % width === 0 ? "bar-start" : ""}
                        scope="col"
                      >
                        <small>bar {Math.floor(t / width) + 1}</small>
                        {counts(p.meter)[t % width]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stringNames.map((name, string) => (
                    <tr key={name}>
                      <th scope="row">
                        {name}
                        <small>{pitchName(pitch(string, 0))}</small>
                      </th>
                      {Array.from({ length: total }, (_, tick) => {
                        const { note, hold } = slotState(p, tick),
                          here = note?.string === string;
                        return (
                          <td
                            key={tick}
                            className={tick % width === 0 ? "bar-start" : ""}
                          >
                            <button
                              className={here ? "tab-note" : "tab-empty"}
                              aria-label={`${p.name}, ${name}, bar ${Math.floor(tick / width) + 1}, eighth slot ${(tick % width) + 1}, count ${counts(p.meter)[tick % width]}: ${here ? (hold ? "hold" : `fret ${note.fret}, ${pitchName(pitch(string, note.fret))}, ${note.duration} eighths`) : note ? "empty string" : "rest"}`}
                              onClick={() => edit(index, tick, string, fret)}
                              onKeyDown={(e) => {
                                const key = e.key;
                                if (
                                  [
                                    "ArrowRight",
                                    "ArrowLeft",
                                    "ArrowDown",
                                    "ArrowUp",
                                  ].includes(key)
                                ) {
                                  e.preventDefault();
                                  const nextTick = Math.max(
                                      0,
                                      Math.min(
                                        total - 1,
                                        tick +
                                          (key === "ArrowRight"
                                            ? 1
                                            : key === "ArrowLeft"
                                              ? -1
                                              : 0),
                                      ),
                                    ),
                                    nextString = Math.max(
                                      0,
                                      Math.min(
                                        5,
                                        string +
                                          (key === "ArrowDown"
                                            ? 1
                                            : key === "ArrowUp"
                                              ? -1
                                              : 0),
                                      ),
                                    );
                                  const buttons = e.currentTarget
                                    .closest("tbody")
                                    ?.querySelectorAll<HTMLButtonElement>(
                                      "button",
                                    );
                                  buttons?.[
                                    nextString * total + nextTick
                                  ]?.focus();
                                } else if (/^\d$/.test(key)) {
                                  e.preventDefault();
                                  edit(index, tick, string, Number(key));
                                } else if (
                                  key === "Delete" ||
                                  key === "Backspace"
                                ) {
                                  e.preventDefault();
                                  edit(index, tick, string, null);
                                }
                              }}
                            >
                              {here ? (hold ? "hold" : note.fret) : "—"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">
              {p.notes.length} attacks · {total} eighth-note slots · unfilled
              slots are explicit rests.
            </p>
            {p.notes.length >= 2 && (
              <p>
                First two attacks:{" "}
                {interval(
                  pitch(p.notes[0].string, p.notes[0].fret),
                  pitch(p.notes[1].string, p.notes[1].fret),
                )}
                .
              </p>
            )}
            {lessonId === "music-08" && (
              <p className="hint">
                C major palette: C D E F G A B.{" "}
                {p.notes.some(
                  (n) =>
                    ![0, 2, 4, 5, 7, 9, 11].includes(
                      pitch(n.string, n.fret) % 12,
                    ),
                )
                  ? "Your plan contains a pitch outside C major. Check its label, or explain a deliberate outside note."
                  : "The entered pitches belong to C major. This arithmetic check does not assess the musical answer."}
              </p>
            )}
          </section>
        );
      })}
      <label>
        Your listening or playing observation (optional)
        <textarea
          rows={2}
          value={sketch.observation}
          maxLength={2000}
          onChange={(e) => update({ ...sketch, observation: e.target.value })}
          placeholder="I played it and noticed… This is your self-report; the AI has not heard it."
        />
      </label>
      <details>
        <summary>Accessible text of the counted plan</summary>
        <pre className="music-transcript">
          {musicText(JSON.stringify(sketch))}
        </pre>
      </details>
      {lessonId === "music-06" && (
        <details>
          <summary>Optional chord-shape reference</summary>
          <p>
            These shapes are a reference, not a requirement for this pitch
            lesson. Open circles mean open strings; crosses mean muted strings.
            Text lists strings low E to high e.
          </p>
          <ChordDiagram name="C" frets={[null, 3, 2, 0, 1, 0]} />
          <ChordDiagram name="Am" frets={[null, 0, 2, 2, 1, 0]} />
        </details>
      )}
      {value && !revision && (
        <LocalRecorder
          lessonId={lessonId}
          sketchId={sketch.id}
          beforeRecord={beforeRecord}
          fail={fail}
        />
      )}
    </div>
  );
}
function ChordDiagram({
  name,
  frets,
}: {
  name: string;
  frets: (number | null)[];
}) {
  const text = `${name}: ${frets.map((f, i) => `${["low E", "A", "D", "G", "B", "high e"][i]} ${f === null ? "muted" : f === 0 ? "open" : `fret ${f}`}`).join(", ")}.`;
  return (
    <figure className="chord-diagram">
      <svg
        viewBox="0 0 140 140"
        width="140"
        height="140"
        role="img"
        aria-label={text}
      >
        <title>{text}</title>
        {frets.map((f, i) => (
          <g key={i}>
            <line
              x1={20 + i * 20}
              y1={30}
              x2={20 + i * 20}
              y2={130}
              stroke="currentColor"
            />
            <text
              x={20 + i * 20}
              y={20}
              textAnchor="middle"
              fill="currentColor"
            >
              {f === null ? "×" : f === 0 ? "○" : ""}
            </text>
            {f !== null && f > 0 && (
              <circle
                cx={20 + i * 20}
                cy={30 + (f - 0.5) * 25}
                r={6}
                fill="currentColor"
              />
            )}
          </g>
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={20}
            x2={120}
            y1={30 + i * 25}
            y2={30 + i * 25}
            stroke="currentColor"
            strokeWidth={i === 0 ? 3 : 1}
          />
        ))}
      </svg>
      <figcaption>{text}</figcaption>
    </figure>
  );
}
function recordingError(e: unknown) {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError" || e.name === "SecurityError")
      return "Microphone access was denied. On Windows, enable microphone access for desktop apps in Settings → Privacy & security → Microphone, then try again. Your sketch is saved.";
    if (e.name === "NotFoundError")
      return "No microphone was found. Connect or enable an input device and try again.";
    if (e.name === "NotReadableError")
      return "The microphone could not be opened. Check your input device and whether another app is using it.";
  }
  return e instanceof Error
    ? e.message
    : "Recording failed. Your musical sketch is still saved.";
}
function LocalRecorder({
  lessonId,
  sketchId,
  beforeRecord,
  fail,
}: {
  lessonId: string;
  sketchId: string;
  beforeRecord: () => Promise<boolean>;
  fail: (e: unknown) => void;
}) {
  const [takes, setTakes] = useState<Recording[]>([]),
    [status, setStatus] = useState(""),
    [active, setActive] = useState(false),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [selected, setSelected] = useState(""),
    [seconds, setSeconds] = useState(0),
    [unsaved, setUnsaved] = useState(false);
  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAudio = useRef<{ data: Uint8Array; name: string } | null>(null);
  const capture = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    finished = useRef<Promise<void> | null>(null),
    mounted = useRef(true),
    starting = useRef(false);
  const refresh = async () => {
    const list = await window.bard.listRecordings(lessonId);
    if (mounted.current) setTakes(list);
  };
  async function savePending() {
    const take = pendingAudio.current;
    if (!take) return;
    await window.bard.saveRecording({ lessonId, sketchId, ...take });
    pendingAudio.current = null;
    if (mounted.current) {
      setUnsaved(false);
      setStatus(
        "Recording saved locally. It will never be sent to the Professor.",
      );
    }
    await refresh();
  }
  async function stop() {
    const rec = capture.current;
    if (rec && rec.state !== "inactive") rec.stop();
    await finished.current;
  }
  useEffect(() => {
    mounted.current = true;
    void refresh().catch(fail);
    const flush = async () => {
      if (starting.current)
        throw Error("Finish the microphone permission request before closing.");
      await stop().catch((e) => {
        if (!pendingAudio.current) throw e;
      });
      if (pendingAudio.current) await savePending();
    };
    pendingSaves.add(flush);
    return () => {
      mounted.current = false;
      // Keep a failed take reachable by the close handshake even after navigation.
      void flush()
        .then(() => pendingSaves.delete(flush))
        .catch(fail);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [active]);
  async function start() {
    if (starting.current || capture.current?.state === "recording") return;
    starting.current = true;
    setBusy(true);
    setStatus("");
    try {
      if (!(await beforeRecord())) return;
      if (
        !navigator.mediaDevices?.getUserMedia ||
        !MediaRecorder.isTypeSupported("audio/webm")
      )
        throw Error(
          "Audio recording is unavailable on this system. Your tab sketch works offline without a microphone.",
        );
      await window.bard.prepareMicrophone();
      const input = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      stream.current = input;
      if (!mounted.current) {
        input.getTracks().forEach((t) => t.stop());
        return;
      }
      const rec = new MediaRecorder(input, {
        mimeType: "audio/webm",
        audioBitsPerSecond: 96000,
      });
      capture.current = rec;
      const chunks: Blob[] = [];
      let bytes = 0,
        failed = false;
      finished.current = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (rec.state !== "inactive") rec.stop();
        }, 120000);
        captureTimer.current = timer;
        rec.ondataavailable = (e) => {
          if (e.data.size) {
            bytes += e.data.size;
            if (bytes <= maxRecordingBytes) chunks.push(e.data);
            else {
              failed = true;
              setStatus(
                "Recording reached its 12 MiB limit. Try a shorter take.",
              );
              if (rec.state !== "inactive") rec.stop();
            }
          }
        };
        rec.onerror = () => {
          failed = true;
          setStatus(
            "The input device stopped or recording failed. Reconnect it and try again.",
          );
          if (rec.state !== "inactive") rec.stop();
        };
        rec.onstop = async () => {
          clearTimeout(timer);
          captureTimer.current = null;
          input.getTracks().forEach((t) => t.stop());
          capture.current = null;
          if (mounted.current) {
            setActive(false);
            setBusy(true);
          }
          try {
            if (!failed && bytes > 0) {
              const blob = new Blob(chunks, { type: "audio/webm" });
              pendingAudio.current = {
                name: `Take ${new Date().toLocaleString()}`,
                data: new Uint8Array(await blob.arrayBuffer()),
              };
              if (mounted.current) setUnsaved(true);
              await savePending();
            } else if (!failed && mounted.current)
              setStatus(
                "No audio was captured. Check your input device and try again.",
              );
            resolve();
          } catch (e) {
            if (mounted.current) setStatus(recordingError(e));
            reject(e);
          } finally {
            if (mounted.current) setBusy(false);
          }
        };
      });
      // A rejected background save is reported, and remains observable by the close handshake.
      void finished.current.catch(fail);
      rec.start(500);
      setSeconds(0);
      setActive(true);
      setStatus(
        "Recording locally — stop when your idea is captured. Maximum two minutes.",
      );
    } catch (e) {
      if (captureTimer.current) clearTimeout(captureTimer.current);
      captureTimer.current = null;
      if (capture.current?.state === "inactive") {
        capture.current = null;
        finished.current = null;
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      setStatus(recordingError(e));
    } finally {
      starting.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="local-recorder" aria-label="Local guitar recordings">
      <h3>Keep a guitar take</h3>
      <p className="hint">
        Optional microphone capture, up to two minutes. Takes stay on this
        computer, linked to this lesson and sketch. Recording is not skill
        assessment. Use headphones to avoid feedback.
      </p>
      <div className="button-row">
        <button
          className="secondary"
          disabled={busy || active || unsaved}
          onClick={() => void start()}
        >
          Record guitar
        </button>
        <button
          className="secondary"
          disabled={!active}
          onClick={() => void stop().catch(fail)}
        >
          Stop and save recording
        </button>
        {active && <span>{seconds}s</span>}
      </div>
      <p role="status">{status}</p>
      {unsaved && (
        <div className="button-row">
          <p>
            The take is still in memory. Retry saving before leaving this
            lesson.
          </p>
          <button
            className="secondary"
            onClick={async () => {
              setBusy(true);
              try {
                await savePending();
                finished.current = null;
              } catch (e) {
                setStatus(recordingError(e));
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            Retry saving take
          </button>
          <button
            className="text-button"
            onClick={() => {
              if (
                window.confirm(
                  "Discard the unsaved recording? This cannot be undone.",
                )
              ) {
                pendingAudio.current = null;
                finished.current = null;
                setUnsaved(false);
                setStatus(
                  "Unsaved take discarded. Your tab sketch remains saved.",
                );
              }
            }}
          >
            Discard unsaved take
          </button>
        </div>
      )}
      {takes.map((t) => (
        <div className="recording-row" key={t.id}>
          <span>
            {t.name}
            {t.sketchId !== sketchId ? " · earlier sketch" : ""} ·{" "}
            {Math.ceil(t.bytes / 1024)} KiB
          </span>
          <button
            className="text-button"
            onClick={async () => {
              try {
                const r = await window.bard.readRecording(lessonId, t.id);
                setUrl(
                  URL.createObjectURL(
                    new Blob([new Uint8Array(r.data)], { type: r.meta.mime }),
                  ),
                );
                setSelected(t.name);
              } catch (e) {
                setStatus(recordingError(e));
              }
            }}
          >
            Listen to {t.name}
          </button>
          <button
            className="text-button"
            onClick={async () => {
              if (
                !window.confirm(
                  "Delete this local recording permanently? Your tab sketch will remain.",
                )
              )
                return;
              try {
                await window.bard.deleteRecording(lessonId, t.id);
                setUrl("");
                setSelected("");
                await refresh();
              } catch (e) {
                setStatus(recordingError(e));
              }
            }}
          >
            Delete {t.name}
          </button>
        </div>
      ))}
      {url && (
        <label>
          {selected}
          <audio
            src={url}
            controls
            preload="metadata"
            onError={() =>
              setStatus(
                "This recording could not be played. Your tab sketch is unaffected.",
              )
            }
          />
        </label>
      )}
    </section>
  );
}
