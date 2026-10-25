"use client";

import Image from "next/image";
import { useRef, useState, type PointerEvent, type SyntheticEvent } from "react";
import { CONCLUSION_LAYER_2_DEFAULTS, CONCLUSION_LAYER_3_DEFAULTS, CONCLUSION_LAYER_DEFAULTS, type ConclusionLayer } from "@/lib/quiz";

const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const HANDLES = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
const IMAGE_FIELDS = [
  { id: "primary", label: "Badge MERCI · 0–2 s" },
  { id: "secondary", label: "Logo · fixe" },
  { id: "tertiary", label: "Badge À BIENTÔT · 2–5 s" },
] as const;
export type ConclusionImageId = typeof IMAGE_FIELDS[number]["id"];
type Handle = typeof HANDLES[number];
type DragState = { id: ConclusionImageId; mode: "move" | Handle; pointerX: number; pointerY: number; initial: ConclusionLayer; aspect: number };
type ConclusionLayers = Record<ConclusionImageId, ConclusionLayer>;
type ConclusionImages = Record<ConclusionImageId, string | null>;
const DEFAULT_LAYERS: ConclusionLayers = { primary: CONCLUSION_LAYER_DEFAULTS, secondary: CONCLUSION_LAYER_2_DEFAULTS, tertiary: CONCLUSION_LAYER_3_DEFAULTS };
const assetUrl = (path: string | null) => path ? `/${path.replace(/^\/+/, "")}` : null;

export function ConclusionEditor({
  backgroundImage,
  images,
  layers,
  busy,
  onUploadBackground,
  onRemoveBackground,
  onUpload,
  onRemove,
  onUpdate,
}: {
  backgroundImage: string | null;
  images: ConclusionImages;
  layers: ConclusionLayers;
  busy: string;
  onUploadBackground: (file: File) => void;
  onRemoveBackground: () => void;
  onUpload: (id: ConclusionImageId, file: File) => void;
  onRemove: (id: ConclusionImageId) => void;
  onUpdate: (id: ConclusionImageId, layer: ConclusionLayer) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [aspects, setAspects] = useState<Partial<Record<ConclusionImageId, number>>>({});
  const [selectedId, setSelectedId] = useState<ConclusionImageId>("primary");
  const [selected, setSelected] = useState(true);
  const [cleanPreview, setCleanPreview] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const selectedLayer = layers[selectedId];
  const selectedImage = images[selectedId];
  const selectedAspect = aspects[selectedId] ?? 1;
  const imageHeight = selectedLayer.width * selectedAspect;

  const beginDrag = (event: PointerEvent, id: ConclusionImageId, mode: DragState["mode"]) => {
    if (cleanPreview || !stageRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(id);
    setSelected(true);
    dragRef.current = { id, mode, pointerX: event.clientX, pointerY: event.clientY, initial: { ...layers[id] }, aspect: aspects[id] ?? 1 };
    stageRef.current.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent) => {
    const drag = dragRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!drag || !rect || !rect.width || !rect.height) return;
    const dx = (event.clientX - drag.pointerX) * VIDEO_WIDTH / rect.width;
    const dy = (event.clientY - drag.pointerY) * VIDEO_HEIGHT / rect.height;
    if (drag.mode === "move") {
      const height = drag.initial.width * drag.aspect;
      onUpdate(drag.id, {
        ...drag.initial,
        x: Math.min(VIDEO_WIDTH - drag.initial.width, Math.max(0, drag.initial.x + dx)),
        y: Math.min(VIDEO_HEIGHT - height, Math.max(0, drag.initial.y + dy)),
      });
      return;
    }
    const left = drag.mode.endsWith("left");
    const top = drag.mode.startsWith("top");
    const widthDeltaX = left ? -dx : dx;
    const widthDeltaY = (top ? -dy : dy) / drag.aspect;
    const maxWidth = Math.min(VIDEO_WIDTH, VIDEO_HEIGHT / drag.aspect);
    const width = Math.min(maxWidth, Math.max(40, drag.initial.width + (Math.abs(widthDeltaX) >= Math.abs(widthDeltaY) ? widthDeltaX : widthDeltaY)));
    const x = left ? drag.initial.x + drag.initial.width - width : drag.initial.x;
    const y = top ? drag.initial.y + drag.initial.width * drag.aspect - width * drag.aspect : drag.initial.y;
    onUpdate(drag.id, {
      width,
      x: Math.min(VIDEO_WIDTH - width, Math.max(0, x)),
      y: Math.min(VIDEO_HEIGHT - width * drag.aspect, Math.max(0, y)),
    });
  };

  const endDrag = (event: PointerEvent) => {
    dragRef.current = null;
    if (stageRef.current?.hasPointerCapture(event.pointerId)) stageRef.current.releasePointerCapture(event.pointerId);
  };

  const imageLoaded = (id: ConclusionImageId, event: SyntheticEvent<HTMLImageElement>) => {
    const element = event.currentTarget;
    if (!element.naturalWidth || !element.naturalHeight) return;
    const aspect = element.naturalHeight / element.naturalWidth;
    setAspects((current) => ({ ...current, [id]: aspect }));
    const layer = layers[id];
    const width = Math.min(layer.width, VIDEO_HEIGHT / aspect);
    const fitToFrame = width < layer.width;
    const next = {
      width,
      x: fitToFrame ? (VIDEO_WIDTH - width) / 2 : Math.min(VIDEO_WIDTH - width, Math.max(0, layer.x)),
      y: fitToFrame ? (VIDEO_HEIGHT - width * aspect) / 2 : Math.min(VIDEO_HEIGHT - width * aspect, Math.max(0, layer.y)),
    };
    if (next.width !== layer.width || next.x !== layer.x || next.y !== layer.y) onUpdate(id, next);
  };

  const updatePosition = (id: ConclusionImageId, axis: "horizontal" | "vertical") => {
    const layer = layers[id];
    const aspect = aspects[id] ?? 1;
    onUpdate(id, {
      ...layer,
      ...(axis === "horizontal" ? { x: (VIDEO_WIDTH - layer.width) / 2 } : { y: (VIDEO_HEIGHT - layer.width * aspect) / 2 }),
    });
  };

  const resetLayer = (id: ConclusionImageId) => {
    const defaults = DEFAULT_LAYERS[id];
    const aspect = aspects[id] ?? 1;
    const width = Math.min(defaults.width, VIDEO_HEIGHT / aspect);
    onUpdate(id, { width, x: (VIDEO_WIDTH - width) / 2, y: (VIDEO_HEIGHT - width * aspect) / 2 });
  };

  return <div className="intro-composer conclusion-composer">
    <div className="intro-editor-heading">
      <div><strong>COMPOSITION DE FIN · 16:9</strong><small>Glissez une image pour la déplacer. Attrapez un coin pour changer sa taille.</small></div>
      <div className="intro-editor-view-tools"><button type="button" className={showGuides && !cleanPreview ? "active" : ""} onClick={() => setShowGuides((value) => !value)}>Repères</button><button type="button" className={cleanPreview ? "active" : ""} onClick={() => setCleanPreview((value) => !value)}>{cleanPreview ? "Modifier les calques" : "Aperçu sans poignées"}</button></div>
    </div>
    <div ref={stageRef} className={`intro-stage conclusion-stage ${cleanPreview ? "intro-stage-clean" : ""}`} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerDown={() => { if (!cleanPreview) setSelected(false); }} aria-label="Éditeur visuel des images de conclusion au format 16:9">
      {backgroundImage ? <Image src={assetUrl(backgroundImage) || ""} alt="Fond dédié à la conclusion" fill unoptimized draggable={false} className="intro-stage-background" /> : <div className="conclusion-fallback-background" />}
      <div className="conclusion-preview-shade" />
      {IMAGE_FIELDS.map(({ id, label }) => {
        const image = images[id];
        if (!image) return null;
        const layer = layers[id];
        const aspect = aspects[id] ?? 1;
        const height = layer.width * aspect;
        const isSelected = selectedId === id && selected && !cleanPreview;
        return <div key={id} className={`intro-stage-layer conclusion-stage-layer ${isSelected ? "selected" : ""}`} style={{ left: `${layer.x / VIDEO_WIDTH * 100}%`, top: `${layer.y / VIDEO_HEIGHT * 100}%`, width: `${layer.width / VIDEO_WIDTH * 100}%`, height: `${height / VIDEO_HEIGHT * 100}%`, zIndex: IMAGE_FIELDS.findIndex((field) => field.id === id) + 2 }} onPointerDown={(event) => beginDrag(event, id, "move")} title={`${label} · glisser pour déplacer`}>
          <Image src={assetUrl(image) || ""} alt={label} fill unoptimized draggable={false} onLoad={(event) => imageLoaded(id, event)} className="intro-stage-layer-image" />
        </div>;
      })}
      {images[selectedId] && selected && !cleanPreview && <div className="intro-selection-box conclusion-selection-box" style={{ left: `${selectedLayer.x / VIDEO_WIDTH * 100}%`, top: `${selectedLayer.y / VIDEO_HEIGHT * 100}%`, width: `${selectedLayer.width / VIDEO_WIDTH * 100}%`, height: `${selectedLayer.width * selectedAspect / VIDEO_HEIGHT * 100}%` }} aria-label={`${IMAGE_FIELDS.find(({ id }) => id === selectedId)?.label} sélectionnée`}>{HANDLES.map((handle) => <button key={handle} type="button" className={`intro-resize-handle ${handle}`} aria-label={`Redimensionner ${IMAGE_FIELDS.find(({ id }) => id === selectedId)?.label}`} onPointerDown={(event) => beginDrag(event, selectedId, handle)} />)}</div>}
      {showGuides && !cleanPreview && <><div className="intro-align-guide vertical" /><div className="intro-align-guide horizontal" /></>}
      {!backgroundImage && !images.primary && !images.secondary && !images.tertiary && <div className="conclusion-empty-overlay">Ajoutez une image de fond ou un calque de conclusion ci-dessous</div>}
    </div>
    <div className="intro-layer-list conclusion-layer-list">
      <div className="intro-layer-list-heading"><strong>FOND DE CONCLUSION</strong><small>Ce fond remplace le fond global uniquement pendant la conclusion. Il remplit le cadre 16:9.</small></div>
      <div className="intro-background-row">
        <div className="intro-layer-thumb background-thumb">{backgroundImage ? <Image src={assetUrl(backgroundImage) || ""} alt="Miniature du fond de conclusion" width={144} height={81} unoptimized /> : <span>FOND</span>}</div>
        <div className="intro-layer-info"><strong>Image de fond de conclusion</strong><small>{backgroundImage ? "Utilisée uniquement dans cette séquence" : "Aucune image importée · fond sombre de secours"}</small></div>
        <div className="intro-layer-actions"><label className="upload-button">{busy === "conclusion-background" ? "Import…" : backgroundImage ? "Remplacer le fond" : "Importer le fond"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadBackground(file); event.currentTarget.value = ""; }} /></label>{backgroundImage && <button type="button" className="text-button" onClick={onRemoveBackground}>Supprimer</button>}</div>
      </div>
      <div className="intro-layer-list-heading conclusion-images-list-heading"><strong>CALQUES SUPERPOSÉS</strong><small>Chaque image conserve sa taille et sa position dans l’aperçu Remotion et le MP4.</small></div>
      {IMAGE_FIELDS.map(({ id, label }) => {
        const image = images[id];
        const layer = layers[id];
        const aspect = aspects[id] ?? 1;
        const busyKey = `conclusion-image-${id}`;
        return <div className={`intro-layer-row ${selectedId === id ? "chosen" : ""}`} key={id}>
          <button type="button" className="intro-layer-thumb conclusion-layer-thumb" onClick={() => { setSelectedId(id); setSelected(true); }} aria-label={`Sélectionner ${label}`}>{image ? <Image src={assetUrl(image) || ""} alt={`Miniature : ${label}`} width={80} height={62} unoptimized /> : <span>IMAGE</span>}</button>
          <div className="intro-layer-info"><strong>{label}</strong><small>{image ? `${Math.round(layer.width)} × ${Math.round(layer.width * aspect)} px · ${Math.round(layer.x)}, ${Math.round(layer.y)}` : "PNG, JPG ou WebP · transparence PNG conservée"}</small></div>
          <div className="intro-layer-actions">
            <label className="upload-button">{busy === busyKey ? "Import…" : image ? "Remplacer" : "Importer"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) { setSelectedId(id); setSelected(true); onUpload(id, file); } event.currentTarget.value = ""; }} /></label>
            {image && <><button type="button" className="text-button" onClick={() => onRemove(id)}>Supprimer</button><button type="button" className="text-button" onClick={() => updatePosition(id, "horizontal")}>Centrer H</button><button type="button" className="text-button" onClick={() => updatePosition(id, "vertical")}>Centrer V</button><button type="button" className="text-button" onClick={() => resetLayer(id)}>Réinitialiser</button></>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
