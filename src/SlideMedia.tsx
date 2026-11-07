import React, { useState } from "react";

export const CHARACTERS = [
  { id: "robot", label: "Robot", emoji: "🤖" },
  { id: "bulb", label: "Idea bulb", emoji: "💡" },
  { id: "rocket", label: "Rocket", emoji: "🚀" },
  { id: "owl", label: "Teacher owl", emoji: "🦉" },
];

export const CHARACTER_EMOJI: Record<string, string> = {
  robot: "🤖",
  bulb: "💡",
  rocket: "🚀",
  owl: "🦉",
};

const POSITIONS = [
  { id: "top-right", label: "Top right" },
  { id: "right", label: "Middle right" },
  { id: "bottom-right", label: "Bottom right" },
  { id: "left", label: "Middle left" },
  { id: "bottom-left", label: "Bottom left" },
];

type Photo = { id: number; thumb: string; url: string; photographer: string; page: string };

const shrinkImage = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1280 / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("This browser can't process images."));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not process the image."))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a readable image."));
    };
    img.src = url;
  });

interface Props {
  api: string;
  token: string;
  jobId: string;
  scene: Record<string, any>;
  defaultQuery: string;
  disabled: boolean;
  onChange: (patch: Record<string, any>) => void;
}

const SlideMedia: React.FC<Props> = ({ api, token, jobId, scene, defaultQuery, disabled, onChange }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState(defaultQuery);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const auth = { Authorization: "Bearer " + token };
  const imageFile: string | null = scene.image_file || null;
  const character: string | null = scene.character || null;
  const imagePos: string = scene.image_pos || "top-right";
  const charPos: string = scene.char_pos || "bottom-right";
  const samePlace = !!imageFile && !!character && imagePos === charPos;

  const setImage = (file: string) =>
    onChange({
      image_file: file,
      image_pos: scene.image_pos || "top-right",
      image_size: scene.image_size || 26,
    });

  const upload = async (file: File) => {
    setError(null);
    setBusy("Uploading picture...");
    try {
      const blob = await shrinkImage(file);
      const form = new FormData();
      form.append("file", blob, "picture.jpg");
      const res = await fetch(`${api}/edit/${jobId}/upload-image`, { method: "POST", headers: auth, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setImage(data.image_file);
    } catch (e: any) {
      setError(e.message || "Could not add the picture.");
    } finally {
      setBusy(null);
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    setError(null);
    setBusy("Searching photos...");
    try {
      const res = await fetch(`${api}/edit/${jobId}/photos?q=${encodeURIComponent(query.trim())}`, { headers: auth });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Search failed");
      setPhotos(data.photos || []);
      if (!data.photos || data.photos.length === 0) setError("No photos found. Try different words.");
    } catch (e: any) {
      setError(e.message || "Search failed.");
    } finally {
      setBusy(null);
    }
  };

  const pick = async (p: Photo) => {
    setError(null);
    setBusy("Adding photo...");
    try {
      const res = await fetch(`${api}/edit/${jobId}/use-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ url: p.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not add the photo");
      setImage(data.image_file);
      setShowSearch(false);
    } catch (e: any) {
      setError(e.message || "Could not add the photo.");
    } finally {
      setBusy(null);
    }
  };

  const off = disabled || !!busy;

  return (
    <div className="ve-media">
      <div className="ve-media-block">
        <div className="ve-label">Picture</div>
        {imageFile ? (
          <div className="ve-media-row">
            <img className="ve-media-thumb" src={`${api}/audio/${imageFile}`} alt="Slide picture" />
            <div className="ve-media-controls">
              <select className="ve-input" value={imagePos} disabled={off} onChange={(e) => onChange({ image_pos: e.target.value })}>
                {POSITIONS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <label className="ve-muted">Size {scene.image_size || 26}%</label>
              <input
                type="range" min={15} max={60}
                value={scene.image_size || 26}
                disabled={off}
                onChange={(e) => onChange({ image_size: Number(e.target.value) })}
              />
              <button className="ve-link-btn" disabled={off} onClick={() => onChange({ image_file: null })}>
                Remove picture
              </button>
            </div>
          </div>
        ) : (
          <p className="ve-muted">No picture on this slide.</p>
        )}

        <div className="ve-voice-actions">
          <label className={"ve-upload" + (off ? " disabled" : "")}>
            Upload picture
            <input
              type="file" accept="image/*" style={{ display: "none" }} disabled={off}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) upload(f);
              }}
            />
          </label>
          <button className="ve-link-btn" disabled={off} onClick={() => setShowSearch((s) => !s)}>
            🔎 Find stock photos
          </button>
        </div>

        {showSearch && (
          <div className="ve-search">
            <div className="ve-media-row">
              <input
                className="ve-input" value={query} placeholder="e.g. brain, planets, money"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
              <button className="nav-btn" disabled={off} onClick={search}>Search</button>
            </div>
            {photos.length > 0 && (
              <div className="ve-photo-grid">
                {photos.map((p) => (
                  <img key={p.id} src={p.thumb} alt={"Photo by " + p.photographer} title={"Photo by " + p.photographer} onClick={() => !off && pick(p)} />
                ))}
              </div>
            )}
            <p className="ve-muted">
              Photos from{" "}
              <a href="https://pixabay.com" target="_blank" rel="noreferrer" className="auth-link">Pixabay</a>
            </p>
          </div>
        )}
      </div>

      <div className="ve-media-block">
        <div className="ve-label">Animated character</div>
        <div className="ve-char-grid">
          <button className={"ve-char" + (!character ? " active" : "")} disabled={off} onClick={() => onChange({ character: null })}>
            <span>🚫</span>None
          </button>
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              className={"ve-char" + (character === c.id ? " active" : "")}
              disabled={off}
              onClick={() =>
                onChange({
                  character: c.id,
                  char_pos: scene.char_pos || "bottom-right",
                  char_size: scene.char_size || 18,
                })
              }
            >
              <span>{c.emoji}</span>{c.label}
            </button>
          ))}
        </div>
        {character && (
          <div className="ve-media-controls">
            <select className="ve-input" value={charPos} disabled={off} onChange={(e) => onChange({ char_pos: e.target.value })}>
              {POSITIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <label className="ve-muted">Size {scene.char_size || 18}%</label>
            <input
              type="range" min={10} max={35}
              value={scene.char_size || 18}
              disabled={off}
              onChange={(e) => onChange({ char_size: Number(e.target.value) })}
            />
          </div>
        )}
      </div>

      {samePlace && (
        <div className="ve-warn">The picture and the character are in the same spot and will overlap. Move one of them.</div>
      )}
      <p className="ve-muted">Pictures and characters can cover slide text. Choose a corner away from the words. The final video shows the exact result.</p>
      {busy && <div className="auth-notice">{busy}</div>}
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
};

export default SlideMedia;