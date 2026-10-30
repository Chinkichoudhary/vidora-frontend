import React, { useEffect, useRef, useState } from "react";
import "./VideoEditor.css";

type VoiceSource = "ai" | "mine" | null;

type EScene = {
  uid: string;
  type: string;
  duration_frames: number;
  audio_file: string | null;
  audio_seconds: number | null;
  voice_source: VoiceSource;
  text_changed: boolean;
  [key: string]: any;
};

type EditorMeta = {
  hasAudio: boolean;
  used: number;
  limit: number;
  maxSeconds: number;
};

type FieldKind = "text" | "area" | "list" | "events" | "number";
type FieldDef = { key: string; label: string; kind: FieldKind; hint?: string };
type SchemaEntry = {
  label: string;
  frames: number;
  fields: FieldDef[];
  defaults: () => Record<string, any>;
};

const MAX_SCENE_SECONDS = 120;
const MIN_SCENE_SECONDS = 3;
const MAX_CLIP_SECONDS = 115;

const SCHEMA: Record<string, SchemaEntry> = {
  TitleIntro: {
    label: "Title",
    frames: 150,
    fields: [{ key: "topic", label: "Video title", kind: "text" }],
    defaults: () => ({ topic: "New title" }),
  },
  DefinitionScene: {
    label: "Definition",
    frames: 180,
    fields: [
      { key: "term", label: "Term", kind: "text" },
      { key: "explanation", label: "Explanation", kind: "area" },
    ],
    defaults: () => ({ term: "New term", explanation: "Explain the term here." }),
  },
  BulletScene: {
    label: "Bullet points",
    frames: 210,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "points", label: "Points", kind: "list", hint: "One point per line (max 8)" },
    ],
    defaults: () => ({ heading: "New heading", points: ["First point", "Second point", "Third point"] }),
  },
  ComparisonScene: {
    label: "Comparison",
    frames: 270,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "leftTitle", label: "Left title", kind: "text" },
      { key: "leftPoints", label: "Left points", kind: "list", hint: "One point per line" },
      { key: "rightTitle", label: "Right title", kind: "text" },
      { key: "rightPoints", label: "Right points", kind: "list", hint: "One point per line" },
    ],
    defaults: () => ({
      heading: "A vs B",
      leftTitle: "A",
      leftPoints: ["Point about A"],
      rightTitle: "B",
      rightPoints: ["Point about B"],
    }),
  },
  DiagramScene: {
    label: "Step diagram",
    frames: 270,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "steps", label: "Steps", kind: "list", hint: "One step per line, in order" },
    ],
    defaults: () => ({ heading: "How it works", steps: ["Step one", "Step two", "Step three"] }),
  },
  TimelineScene: {
    label: "Timeline",
    frames: 270,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "events", label: "Events", kind: "events" },
    ],
    defaults: () => ({
      heading: "Timeline",
      events: [
        { year: "2000", label: "First event" },
        { year: "2010", label: "Second event" },
      ],
    }),
  },
  StatsScene: {
    label: "Big number",
    frames: 210,
    fields: [
      { key: "label", label: "Small label", kind: "text" },
      { key: "number", label: "Number", kind: "number" },
      { key: "suffix", label: "Unit (e.g. Billion)", kind: "text" },
      { key: "description", label: "Description", kind: "area" },
    ],
    defaults: () => ({ label: "Did You Know?", number: 100, suffix: "", description: "Describe the number." }),
  },
  IconGridScene: {
    label: "Concept grid",
    frames: 240,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "description", label: "Description", kind: "area" },
    ],
    defaults: () => ({
      heading: "Key concepts",
      description: "Describe how these ideas connect.",
      iconNames: ["Wallet", "Award", "Coins", "TrendingUp", "Droplet", "Percent"],
    }),
  },
  QuoteScene: {
    label: "Key takeaway",
    frames: 180,
    fields: [
      { key: "quote", label: "Takeaway text", kind: "area" },
      { key: "attribution", label: "Small label", kind: "text" },
    ],
    defaults: () => ({ quote: "The one thing to remember.", attribution: "Key Takeaway" }),
  },
  OutroScene: {
    label: "Outro",
    frames: 210,
    fields: [
      { key: "summary", label: "Summary", kind: "area" },
      { key: "ctaText", label: "Button text", kind: "text" },
    ],
    defaults: () => ({ summary: "Summarize what viewers learned.", ctaText: "Watch Next Video" }),
  },
};

let uidCounter = 0;
const newUid = () => "s" + Date.now().toString(36) + uidCounter++;

const toEditorScene = (raw: any): EScene => {
  const audioFile: string | null = raw.audio_file || null;
  return {
    ...raw,
    uid: newUid(),
    audio_file: audioFile,
    audio_seconds: audioFile ? Number(raw.audio_seconds) || null : null,
    voice_source: audioFile ? (audioFile.includes("_voice_") ? "mine" : "ai") : null,
    text_changed: false,
    duration_frames: Number(raw.duration_frames) || 150,
  };
};

const toPayload = (s: EScene) => {
  const out: Record<string, any> = {
    type: s.type,
    duration_frames: s.duration_frames,
    audio_file: s.audio_file,
    audio_seconds: s.audio_seconds,
  };
  const def = SCHEMA[s.type];
  if (def) {
    def.fields.forEach((f) => {
      out[f.key] = s[f.key];
    });
  }
  if (s.type === "IconGridScene") out.iconNames = s.iconNames;
  return out;
};

const sceneSummary = (s: EScene): string =>
  String(s.topic || s.heading || s.term || s.quote || s.summary || s.label || "Untitled slide").slice(0, 60);

const minSecondsFor = (s: EScene): number =>
  s.audio_seconds ? Math.max(MIN_SCENE_SECONDS, Math.ceil(s.audio_seconds + 1)) : MIN_SCENE_SECONDS;

const fmtTime = (sec: number) => Math.floor(sec / 60) + "m " + Math.round(sec % 60) + "s";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const lines = (v: any): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).filter((x) => x.trim()) : [];

// ---- audio: convert any recording or file to a small mono WAV ----
const encodeWav = (samples: Float32Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
};

const blobToWav = async (blob: Blob): Promise<{ wav: Blob; seconds: number }> => {
  const arrayBuf = await blob.arrayBuffer();
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) throw new Error("This browser can't process audio. Try Chrome.");
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(arrayBuf);
  } catch {
    ctx.close();
    throw new Error("Could not read that audio. Try recording again or use a different file.");
  }
  ctx.close();
  if (decoded.duration < 0.3) throw new Error("The recording is too short.");

  const rate = 24000;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  const data = rendered.getChannelData(0);
  return { wav: encodeWav(data, rate), seconds: data.length / rate };
};

// ---- simplified slide preview ----
const SlidePreview: React.FC<{ scene: EScene }> = ({ scene: s }) => {
  let body: React.ReactNode = null;
  switch (s.type) {
    case "TitleIntro":
      body = <h1 className="ve-sl-title">{s.topic}</h1>;
      break;
    case "DefinitionScene":
      body = (
        <>
          <h2>{s.term}</h2>
          <p>{s.explanation}</p>
        </>
      );
      break;
    case "BulletScene":
      body = (
        <>
          <h2>{s.heading}</h2>
          <ul>{lines(s.points).map((p, i) => <li key={i}>{p}</li>)}</ul>
        </>
      );
      break;
    case "ComparisonScene":
      body = (
        <>
          <h2>{s.heading}</h2>
          <div className="ve-sl-cols">
            <div>
              <h3>{s.leftTitle}</h3>
              <ul>{lines(s.leftPoints).map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
            <div>
              <h3>{s.rightTitle}</h3>
              <ul>{lines(s.rightPoints).map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          </div>
        </>
      );
      break;
    case "DiagramScene":
      body = (
        <>
          <h2>{s.heading}</h2>
          <div className="ve-sl-steps">
            {lines(s.steps).map((p, i) => <span key={i}>{i + 1}. {p}</span>)}
          </div>
        </>
      );
      break;
    case "TimelineScene":
      body = (
        <>
          <h2>{s.heading}</h2>
          <ul>
            {(Array.isArray(s.events) ? s.events : []).map((e: any, i: number) => (
              <li key={i}><strong>{e.year}</strong> {e.label}</li>
            ))}
          </ul>
        </>
      );
      break;
    case "StatsScene":
      body = (
        <>
          <p className="ve-sl-small">{s.label}</p>
          <div className="ve-sl-big">{String(s.number ?? "")} {s.suffix}</div>
          <p>{s.description}</p>
        </>
      );
      break;
    case "IconGridScene":
      body = (
        <>
          <h2>{s.heading}</h2>
          <p>{s.description}</p>
        </>
      );
      break;
    case "QuoteScene":
      body = (
        <>
          <p className="ve-sl-quote">“{s.quote}”</p>
          <p className="ve-sl-small">{s.attribution}</p>
        </>
      );
      break;
    case "OutroScene":
      body = (
        <>
          <p className="ve-sl-quote">{s.summary}</p>
          <span className="ve-sl-cta">{s.ctaText}</span>
        </>
      );
      break;
    default:
      body = null;
  }
  return (
    <div className="ve-slide">
      <span className="ve-slide-badge">{SCHEMA[s.type] ? SCHEMA[s.type].label : s.type}</span>
      {body}
    </div>
  );
};

interface VideoEditorProps {
  api: string;
  token: string;
  jobId: string;
  onCancel: () => void;
  onUpgrade: () => void;
  onSaved: (newJobId: string, videoUrl: string, durationSeconds: number | null) => void;
}

const VideoEditor: React.FC<VideoEditorProps> = ({ api, token, jobId, onCancel, onUpgrade, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scenes, setScenes] = useState<EScene[]>([]);
  const [meta, setMeta] = useState<EditorMeta | null>(null);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [addType, setAddType] = useState("BulletScene");

  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [voiceBusy, setVoiceBusy] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recUidRef = useRef<string>("");
  const aliveRef = useRef(true);

  // load the scenes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${api}/edit/${jobId}`, {
          headers: { Authorization: "Bearer " + token },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Could not open the editor");
        if (cancelled) return;
        setScenes((data.scenes || []).map(toEditorScene));
        setMeta({
          hasAudio: !!data.has_audio,
          used: data.edit_renders_used || 0,
          limit: data.edit_renders_limit || 3,
          maxSeconds: data.max_seconds || 300,
        });
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message || "Could not open the editor");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, jobId, token]);

  // cleanup on leave
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current) recorderRef.current.onstop = null;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // play-all preview (voice + timing)
  useEffect(() => {
    if (previewIdx === null) return;
    const scene = scenes[previewIdx];
    if (!scene) {
      setPreviewIdx(null);
      return;
    }
    let audio: HTMLAudioElement | null = null;
    if (scene.audio_file) {
      audio = new Audio(`${api}/audio/${scene.audio_file}`);
      audio.play().catch(() => {});
    }
    const t = setTimeout(() => setPreviewIdx(previewIdx + 1), (scene.duration_frames / 30) * 1000);
    return () => {
      clearTimeout(t);
      if (audio) audio.pause();
    };
  }, [previewIdx, scenes, api]);

  const update = (fn: (prev: EScene[]) => EScene[]) => {
    setScenes(fn);
    setDirty(true);
  };

  const patchScene = (uid: string, patch: Record<string, any>, isText = false) =>
    update((prev) =>
      prev.map((s) =>
        s.uid === uid
          ? { ...s, ...patch, text_changed: s.text_changed || (isText && s.voice_source === "ai") }
          : s
      )
    );

  const cur: EScene | undefined = scenes[selected];
  const totalFrames = scenes.reduce((sum, s) => sum + s.duration_frames, 0);
  const totalSeconds = totalFrames / 30;

  const setField = (key: string, value: any) => {
    if (cur) patchScene(cur.uid, { [key]: value }, true);
  };

  const setDurationSeconds = (s: EScene, sec: number) => {
    const clamped = Math.min(MAX_SCENE_SECONDS, Math.max(minSecondsFor(s), Math.round(sec)));
    patchScene(s.uid, { duration_frames: clamped * 30 });
  };

  const selectSlide = (i: number) => {
    if (recording) return;
    setSelected(i);
    setVoiceError(null);
  };

  const addSlide = () => {
    const def = SCHEMA[addType];
    if (!def || recording) return;
    const ns: EScene = {
      uid: newUid(),
      type: addType,
      duration_frames: def.frames,
      audio_file: null,
      audio_seconds: null,
      voice_source: null,
      text_changed: false,
      ...def.defaults(),
    };
    update((prev) => {
      const next = [...prev];
      next.splice(selected + 1, 0, ns);
      return next;
    });
    setSelected(selected + 1);
  };

  const removeSlide = (idx: number) => {
    if (scenes.length <= 1 || recording) return;
    update((prev) => prev.filter((_, i) => i !== idx));
    setSelected((s) => Math.min(s > idx ? s - 1 : s, scenes.length - 2));
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= scenes.length || recording) return;
    update((prev) => {
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[to];
      next[to] = tmp;
      return next;
    });
    setSelected((s) => (s === idx ? to : s === to ? idx : s));
  };

  // ---- voice ----
  const uploadVoiceBlob = async (blob: Blob, uid: string) => {
    setVoiceError(null);
    setVoiceBusy("Processing your recording...");
    try {
      const { wav, seconds } = await blobToWav(blob);
      if (seconds < 0.5) throw new Error("The recording is too short.");
      if (seconds > MAX_CLIP_SECONDS) {
        throw new Error(`Each slide's voice can be up to ${MAX_CLIP_SECONDS} seconds. Try a shorter clip.`);
      }
      const form = new FormData();
      form.append("file", wav, "voice.wav");
      const res = await fetch(`${api}/edit/${jobId}/upload-voice`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      const needed = Math.ceil((data.audio_seconds + 1) * 30);
      update((prev) =>
        prev.map((s) =>
          s.uid === uid
            ? {
                ...s,
                audio_file: data.audio_file,
                audio_seconds: data.audio_seconds,
                voice_source: "mine",
                text_changed: false,
                duration_frames: Math.max(s.duration_frames, needed),
              }
            : s
        )
      );
    } catch (e: any) {
      setVoiceError(e.message || "Could not use this audio.");
    } finally {
      setVoiceBusy(null);
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const startRecording = async () => {
    if (!cur) return;
    setVoiceError(null);
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setVoiceError("Recording isn't supported in this browser. Try Chrome, or upload an audio file.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      recUidRef.current = cur.uid;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        uploadVoiceBlob(blob, recUidRef.current);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecSeconds(0);
      const started = Date.now();
      timerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - started) / 1000);
        setRecSeconds(sec);
        if (sec >= MAX_CLIP_SECONDS) stopRecording();
      }, 500);
    } catch {
      setVoiceError("Microphone access was blocked. Allow the microphone in your browser's address bar and try again.");
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !cur) return;
    await uploadVoiceBlob(file, cur.uid);
  };

  const removeVoice = () => {
    if (cur) patchScene(cur.uid, { audio_file: null, audio_seconds: null, voice_source: null, text_changed: false });
  };

  const regenerateVoice = async () => {
    if (!cur || !meta) return;
    if (!meta.hasAudio) {
      onUpgrade();
      return;
    }
    const uid = cur.uid;
    setVoiceError(null);
    setVoiceBusy("Writing a new narration and voice...");
    try {
      const res = await fetch(`${api}/edit/${jobId}/regenerate-voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ scene: toPayload(cur) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not generate the voice");
      update((prev) =>
        prev.map((s) =>
          s.uid === uid
            ? {
                ...s,
                audio_file: data.audio_file,
                audio_seconds: data.audio_seconds,
                voice_source: "ai",
                text_changed: false,
                duration_frames: Math.max(s.duration_frames, data.duration_frames),
              }
            : s
        )
      );
    } catch (e: any) {
      setVoiceError(e.message || "Could not generate the voice.");
    } finally {
      setVoiceBusy(null);
    }
  };

  // ---- save ----
  const saveEdits = async () => {
    if (!meta) return;
    setSaveError(null);
    if (totalSeconds > meta.maxSeconds) {
      setSaveError(
        `Your video is ${fmtTime(totalSeconds)} long. The limit on your plan is ${Math.floor(meta.maxSeconds / 60)} minutes. Shorten or delete some slides.`
      );
      return;
    }
    setSaving(true);
    setSaveStatus("Sending your edits...");
    try {
      const res = await fetch(`${api}/edit/${jobId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ scenes: scenes.map(toPayload) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not save your edits");

      const newId: string = data.job_id;
      const started = Date.now();
      while (true) {
        await sleep(4000);
        if (!aliveRef.current) return;
        const sres = await fetch(`${api}/job-status/${newId}`);
        const st = await sres.json();
        if (st.status === "error") throw new Error(st.error || "The render failed.");
        if (!st.status) throw new Error(st.error || "Lost track of the render. Please try again.");
        if (st.status === "done") {
          onSaved(newId, st.video_url, st.total_duration_seconds ?? null);
          return;
        }
        setSaveStatus(
          (st.step || "Rendering your video") + " · " + Math.floor((Date.now() - started) / 1000) + "s"
        );
      }
    } catch (e: any) {
      if (aliveRef.current) setSaveError(e.message || "Something went wrong. Please try again.");
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  };

  const handleCancel = () => {
    if (dirty && !window.confirm("Discard your changes?")) return;
    onCancel();
  };

  // ---- field renderer ----
  const renderField = (f: FieldDef): React.ReactNode => {
    if (!cur) return null;
    const val = cur[f.key];
    switch (f.kind) {
      case "text":
        return <input className="ve-input" value={val ?? ""} onChange={(e) => setField(f.key, e.target.value)} />;
      case "area":
        return (
          <textarea className="ve-input ve-area" rows={4} value={val ?? ""} onChange={(e) => setField(f.key, e.target.value)} />
        );
      case "list":
        return (
          <textarea
            className="ve-input ve-area"
            rows={5}
            placeholder={f.hint || "One item per line"}
            value={Array.isArray(val) ? val.join("\n") : ""}
            onChange={(e) => setField(f.key, e.target.value.split("\n"))}
          />
        );
      case "number":
        return (
          <input
            className="ve-input"
            type="number"
            value={val ?? ""}
            onChange={(e) => setField(f.key, e.target.value === "" ? "" : Number(e.target.value))}
          />
        );
      case "events": {
        const events: { year: string; label: string }[] = Array.isArray(val) ? val : [];
        return (
          <div className="ve-events">
            {events.map((ev, i) => (
              <div className="ve-event-row" key={i}>
                <input
                  className="ve-input ve-event-year"
                  placeholder="Year"
                  value={ev.year}
                  onChange={(e) =>
                    setField(f.key, events.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))
                  }
                />
                <input
                  className="ve-input"
                  placeholder="What happened"
                  value={ev.label}
                  onChange={(e) =>
                    setField(f.key, events.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <button
                  className="ve-icon-btn"
                  disabled={events.length <= 1}
                  onClick={() => setField(f.key, events.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="ve-link-btn"
              disabled={events.length >= 8}
              onClick={() => setField(f.key, [...events, { year: "", label: "" }])}
            >
              + Add event
            </button>
          </div>
        );
      }
      default:
        return null;
    }
  };

  if (loading) return <div className="ve ve-center">Opening the editor...</div>;
  if (loadError || !meta) {
    return (
      <div className="ve ve-center">
        <p className="ve-error">{loadError || "Could not open the editor."}</p>
        <button className="nav-btn" onClick={onCancel}>Back</button>
      </div>
    );
  }

  const left = Math.max(0, meta.limit - meta.used);
  const def = cur ? SCHEMA[cur.type] : undefined;

  return (
    <div className="ve">
      <div className="ve-top">
        <div>
          <h2 className="ve-title">Edit your video</h2>
          <p className="ve-muted">Change slides, add your own voice, then Save to render a new version.</p>
        </div>
        <div className="ve-top-actions">
          <span className="ve-pill">Length {fmtTime(totalSeconds)}</span>
          <span className="ve-pill">{left} of {meta.limit} edit renders left</span>
          <button className="nav-btn outline" disabled={recording || saving} onClick={() => setPreviewIdx(0)}>
            ▶ Play preview
          </button>
          <button className="nav-btn outline" disabled={saving} onClick={handleCancel}>Cancel</button>
          <button
            className="nav-btn"
            disabled={saving || recording || !!voiceBusy || left === 0 || scenes.length === 0}
            onClick={saveEdits}
          >
            Save &amp; Render
          </button>
        </div>
      </div>

      {saveError && <div className="auth-error">{saveError}</div>}
      {left === 0 && <div className="auth-notice">You've used all edit renders for this video.</div>}

      <div className="ve-body">
        <aside className="ve-list">
          {scenes.map((s, i) => (
            <div
              key={s.uid}
              className={"ve-item" + (i === selected ? " active" : "")}
              onClick={() => selectSlide(i)}
            >
              <div className="ve-item-num">{i + 1}</div>
              <div className="ve-item-main">
                <div className="ve-item-type">{SCHEMA[s.type] ? SCHEMA[s.type].label : s.type}</div>
                <div className="ve-item-title">{sceneSummary(s)}</div>
                <div className="ve-item-meta">
                  {Math.round(s.duration_frames / 30)}s ·{" "}
                  {s.audio_file ? (s.voice_source === "mine" ? "🎙 your voice" : "🔊 AI voice") : "silent"}
                </div>
              </div>
              <div className="ve-item-actions" onClick={(e) => e.stopPropagation()}>
                <button className="ve-icon-btn" disabled={i === 0} onClick={() => moveSlide(i, -1)}>▲</button>
                <button className="ve-icon-btn" disabled={i === scenes.length - 1} onClick={() => moveSlide(i, 1)}>▼</button>
                <button className="ve-icon-btn" disabled={scenes.length <= 1} onClick={() => removeSlide(i)}>🗑</button>
              </div>
            </div>
          ))}

          <div className="ve-add">
            <select className="ve-input" value={addType} onChange={(e) => setAddType(e.target.value)}>
              {Object.keys(SCHEMA).map((k) => (
                <option key={k} value={k}>{SCHEMA[k].label}</option>
              ))}
            </select>
            <button className="nav-btn" disabled={recording || scenes.length >= 40} onClick={addSlide}>
              + Add slide
            </button>
          </div>
        </aside>

        <section className="ve-panel">
          {cur && def ? (
            <>
              <div className="ve-preview-wrap">
                <SlidePreview scene={cur} />
                <p className="ve-muted ve-note">
                  Simplified preview. The final video uses the full animated design.
                </p>
              </div>

              <h3 className="ve-h3">Slide content · {def.label}</h3>
              {def.fields.map((f) => (
                <div className="ve-field" key={f.key}>
                  <label className="ve-label">{f.label}</label>
                  {renderField(f)}
                </div>
              ))}

              <h3 className="ve-h3">Slide length</h3>
              <div className="ve-duration">
                <button className="ve-icon-btn" onClick={() => setDurationSeconds(cur, cur.duration_frames / 30 - 5)}>−5s</button>
                <input
                  type="range"
                  min={minSecondsFor(cur)}
                  max={MAX_SCENE_SECONDS}
                  value={Math.round(cur.duration_frames / 30)}
                  onChange={(e) => setDurationSeconds(cur, Number(e.target.value))}
                />
                <button className="ve-icon-btn" onClick={() => setDurationSeconds(cur, cur.duration_frames / 30 + 5)}>+5s</button>
                <button className="ve-icon-btn" onClick={() => setDurationSeconds(cur, cur.duration_frames / 30 + 10)}>+10s</button>
                <strong>{Math.round(cur.duration_frames / 30)}s</strong>
              </div>
              {cur.audio_seconds ? (
                <p className="ve-muted">This slide can't be shorter than its voice ({Math.ceil(cur.audio_seconds + 1)}s).</p>
              ) : null}

              <h3 className="ve-h3">Voice for this slide</h3>
              <div className="ve-voice">
                {cur.audio_file ? (
                  <>
                    <div className="ve-voice-tag">
                      {cur.voice_source === "mine" ? "Your voice" : "AI voice"}
                      {cur.audio_seconds ? " · " + Math.round(cur.audio_seconds) + "s" : ""}
                    </div>
                    <audio key={cur.audio_file} controls className="ve-audio" src={`${api}/audio/${cur.audio_file}`} />
                    <button className="ve-link-btn" onClick={removeVoice}>Remove voice (make silent)</button>
                  </>
                ) : (
                  <p className="ve-muted">This slide is silent. Record your own voice to narrate it.</p>
                )}

                {cur.text_changed && (
                  <div className="ve-warn">
                    You changed this slide's text, but the AI voice still reads the old script. Record your own voice
                    or regenerate the AI voice.
                  </div>
                )}

                <div className="ve-voice-actions">
                  {recording ? (
                    <button className="ve-rec ve-rec-on" onClick={stopRecording}>■ Stop recording ({recSeconds}s)</button>
                  ) : (
                    <button className="ve-rec" disabled={!!voiceBusy || saving} onClick={startRecording}>● Record my voice</button>
                  )}
                  <label className={"ve-upload" + (voiceBusy || recording ? " disabled" : "")}>
                    Upload audio file
                    <input
                      type="file"
                      accept="audio/*"
                      style={{ display: "none" }}
                      disabled={!!voiceBusy || recording}
                      onChange={onPickFile}
                    />
                  </label>
                  <button className="ve-link-btn" disabled={!!voiceBusy || recording} onClick={regenerateVoice}>
                    ✨ Regenerate AI voice{meta.hasAudio ? "" : " (paid plans)"}
                  </button>
                </div>
                <p className="ve-muted">Read the slide aloud while recording. The slide lengthens to fit your voice.</p>
                {voiceBusy && <div className="auth-notice">{voiceBusy}</div>}
                {voiceError && <div className="auth-error">{voiceError}</div>}
              </div>
            </>
          ) : (
            <p className="ve-muted">Add a slide to get started.</p>
          )}
        </section>
      </div>

      {saving && (
        <div className="ve-overlay">
          <div className="ve-overlay-card">
            <div className="spinner-ring" style={{ margin: "0 auto 20px" }} />
            <h3>Rendering your edited video</h3>
            <p className="ve-muted">{saveStatus}</p>
            <p className="ve-muted">This takes a few minutes. Please keep this tab open.</p>
          </div>
        </div>
      )}

      {previewIdx !== null && scenes[previewIdx] && (
        <div className="ve-overlay">
          <div className="ve-overlay-card ve-overlay-wide">
            <p className="ve-muted">Slide {previewIdx + 1} of {scenes.length}</p>
            <SlidePreview scene={scenes[previewIdx]} />
            <button className="nav-btn outline" style={{ marginTop: 16 }} onClick={() => setPreviewIdx(null)}>
              Stop preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoEditor;