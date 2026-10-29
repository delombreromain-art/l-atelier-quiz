"use client";

import Image from "next/image";
import { useRef, useState, type MouseEvent, type PointerEvent, type SyntheticEvent } from "react";
import {
  DECOR_LOGO_LAYER_DEFAULT,
  INTRODUCTION_DELAYED_SCENE_DEFAULTS,
  INTRODUCTION_LAYER_DEFAULTS,
  type IntroductionLayer,
  type IntroductionLayerId,
  type IntroductionLayers,
} from "@/lib/quiz";

const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const LAYER_FIELDS: { id: IntroductionLayerId; label: string }[] = [
  { id: "logo", label: "Logo L’Atelier Quiz" },
  { id: "questionsPanel", label: "Panneau 60 QUESTIONS / THÈMES VARIÉS" },
  { id: "history", label: "Thème Histoire" },
  { id: "geography", label: "Thème Géographie" },
  { id: "science", label: "Thème Sciences" },
  { id: "cinema", label: "Thème Cinéma" },
  { id: "hourglass", label: "Sablier" },
];
const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
type Corner = typeof CORNERS[number];
type DragState = { id: IntroductionLayerId; ids: IntroductionLayerId[]; mode: "move" | Corner; pointerX: number; pointerY: number; initial: Partial<Record<IntroductionLayerId, IntroductionLayer>>; bounds: LayerBounds; startSelection: IntroductionLayerId[]; additive: boolean; moved: boolean };
type LayerBounds = { x: number; y: number; width: number; height: number };

const assetUrl = (path: string | null) => path ? `/${path.replace(/^\/+/, "")}` : null;

export function IntroductionEditor({
  background,
  backgroundIsFallback,
  layers,
  mode = "full",
  busy,
  onUploadBackground,
  onRemoveBackground,
  onUploadLayer,
  onUpdateLayers,
}: {
  background: string | null;
  backgroundIsFallback: boolean;
  layers: IntroductionLayers;
  mode?: "full" | "delayed" | "main";
  busy: string;
  onUploadBackground: (file: File) => void;
  onRemoveBackground: () => void;
  onUploadLayer: (id: IntroductionLayerId, file: File) => void;
  onUpdateLayers: (next: IntroductionLayers) => void;
}) {
  const layerFields = mode === "delayed"
    ? [{ id: "logo" as const, label: "Logo · apparition différée" }, { id: "questionsPanel" as const, label: "Panneau 60 QUESTIONS · apparition différée" }]
    : mode === "main"
      ? [{ id: "logo" as const, label: "Logo global du quiz" }]
      : LAYER_FIELDS;
  const backgroundBusyKey = mode === "delayed" ? "introduction-delayed-image" : mode === "main" ? "background" : "introduction-image";
  const layerBusyKey = (id: IntroductionLayerId) => mode === "delayed" ? `introduction-delayed-layer-${id}` : mode === "main" ? "logo" : `introduction-layer-${id}`;
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [selectedIds, setSelectedIds] = useState<IntroductionLayerId[]>([]);
  const [asPreview, setAsPreview] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [aspectByLayer, setAspectByLayer] = useState<Partial<Record<IntroductionLayerId, number>>>({});

  const updateLayer = (id: IntroductionLayerId, patch: Partial<IntroductionLayer>) => {
    onUpdateLayers({ ...layers, [id]: { ...layers[id], ...patch } });
  };

  const imageLoaded = (id: IntroductionLayerId, event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight) return;
    const aspect = image.naturalHeight / image.naturalWidth;
    setAspectByLayer((current) => ({ ...current, [id]: aspect }));
    const layer = layers[id];
    const fittedWidth = Math.min(layer.width, VIDEO_HEIGHT / aspect);
    updateLayer(id, {
      width: fittedWidth,
      x: Math.min(layer.x, VIDEO_WIDTH - fittedWidth),
      y: Math.min(layer.y, VIDEO_HEIGHT - fittedWidth * aspect),
    });
  };

  const visibleLayerIds = layerFields.map(({ id }) => id).filter((id) => layers[id].image && layers[id].visible);
  const activeSelection = selectedIds.filter((id) => visibleLayerIds.includes(id));
  const getBounds = (ids: IntroductionLayerId[]): LayerBounds | null => {
    const active = ids.filter((id) => visibleLayerIds.includes(id));
    if (!active.length) return null;
    const left = Math.min(...active.map((id) => layers[id].x));
    const top = Math.min(...active.map((id) => layers[id].y));
    const right = Math.max(...active.map((id) => layers[id].x + layers[id].width));
    const bottom = Math.max(...active.map((id) => layers[id].y + layers[id].width * (aspectByLayer[id] ?? 1)));
    return { x: left, y: top, width: right - left, height: bottom - top };
  };

  const beginDrag = (event: PointerEvent, id: IntroductionLayerId, mode: DragState["mode"], ids = [id]) => {
    if (asPreview || !stageRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = getBounds(ids);
    if (!bounds) return;
    const initial = Object.fromEntries(ids.map((layerId) => [layerId, { ...layers[layerId] }])) as DragState["initial"];
    const additive = mode === "move" && (event.ctrlKey || event.metaKey);
    if (!additive) setSelectedIds(ids);
    dragRef.current = { id, ids, mode, pointerX: event.clientX, pointerY: event.clientY, initial, bounds, startSelection: activeSelection, additive, moved: false };
    stageRef.current.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent) => {
    const drag = dragRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!drag || !rect || rect.width === 0 || rect.height === 0) return;
    const dx = (event.clientX - drag.pointerX) * VIDEO_WIDTH / rect.width;
    const dy = (event.clientY - drag.pointerY) * VIDEO_HEIGHT / rect.height;
    const { initial, ids, mode } = drag;
    if (!drag.moved && (Math.abs(event.clientX - drag.pointerX) > 3 || Math.abs(event.clientY - drag.pointerY) > 3)) {
      drag.moved = true;
      setSelectedIds(ids);
    }

    if (mode === "move") {
      const { bounds } = drag;
      const rawX = bounds.x + dx;
      const rawY = bounds.y + dy;
      const groupX = Math.abs(rawX + bounds.width / 2 - VIDEO_WIDTH / 2) < 18 ? (VIDEO_WIDTH - bounds.width) / 2 : Math.min(VIDEO_WIDTH - bounds.width, Math.max(0, rawX));
      const groupY = Math.abs(rawY + bounds.height / 2 - VIDEO_HEIGHT / 2) < 18 ? (VIDEO_HEIGHT - bounds.height) / 2 : Math.min(VIDEO_HEIGHT - bounds.height, Math.max(0, rawY));
      const next = { ...layers };
      ids.forEach((layerId) => {
        const start = initial[layerId];
        if (!start) return;
        next[layerId] = { ...start, x: start.x + groupX - bounds.x, y: start.y + groupY - bounds.y };
      });
      onUpdateLayers(next);
      return;
    }

    const left = mode.endsWith("left");
    const top = mode.startsWith("top");
    const { bounds } = drag;
    const anchorX = left ? bounds.x + bounds.width : bounds.x;
    const anchorY = top ? bounds.y + bounds.height : bounds.y;
    const scaleX = (bounds.width + (left ? -dx : dx)) / bounds.width;
    const scaleY = (bounds.height + (top ? -dy : dy)) / bounds.height;
    const scale = Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY;
    const minScale = Math.max(...ids.map((layerId) => 40 / (initial[layerId]?.width ?? 40)));
    let maxScale = Infinity;
    ids.forEach((layerId) => {
      const start = initial[layerId];
      if (!start) return;
      const aspect = aspectByLayer[layerId] ?? 1;
      const offsetX = start.x - anchorX;
      const offsetY = start.y - anchorY;
      if (offsetX < 0) maxScale = Math.min(maxScale, anchorX / -offsetX);
      if (offsetX + start.width > 0) maxScale = Math.min(maxScale, (VIDEO_WIDTH - anchorX) / (offsetX + start.width));
      if (offsetY < 0) maxScale = Math.min(maxScale, anchorY / -offsetY);
      if (offsetY + start.width * aspect > 0) maxScale = Math.min(maxScale, (VIDEO_HEIGHT - anchorY) / (offsetY + start.width * aspect));
    });
    const boundedScale = Math.min(maxScale, Math.max(minScale, scale));
    const next = { ...layers };
    ids.forEach((layerId) => {
      const start = initial[layerId];
      if (!start) return;
      const width = start.width * boundedScale;
      next[layerId] = {
        ...start,
        x: anchorX + (start.x - anchorX) * boundedScale,
        y: anchorY + (start.y - anchorY) * boundedScale,
        width: Math.max(40, width),
      };
    });
    onUpdateLayers(next);
  };

  const endDrag = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (drag?.additive && !drag.moved) {
      setSelectedIds(drag.startSelection.includes(drag.id)
        ? drag.startSelection.filter((id) => id !== drag.id)
        : [...drag.startSelection, drag.id]);
    }
    dragRef.current = null;
    if (stageRef.current?.hasPointerCapture(event.pointerId)) stageRef.current.releasePointerCapture(event.pointerId);
  };

  const cancelDrag = (event: PointerEvent) => {
    dragRef.current = null;
    if (stageRef.current?.hasPointerCapture(event.pointerId)) stageRef.current.releasePointerCapture(event.pointerId);
  };

  const selectFromList = (event: MouseEvent, id: IntroductionLayerId) => {
    const additive = event.ctrlKey || event.metaKey;
    setSelectedIds((current) => additive
      ? current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id]
      : [id]);
  };

  const centerLayer = (id: IntroductionLayerId, axis: "horizontal" | "vertical") => {
    const layer = layers[id];
    const height = layer.width * (aspectByLayer[id] ?? 1);
    updateLayer(id, axis === "horizontal"
      ? { x: (VIDEO_WIDTH - layer.width) / 2 }
      : { y: (VIDEO_HEIGHT - height) / 2 });
  };

  const resetLayer = (id: IntroductionLayerId) => {
    const defaults = mode === "main"
      ? DECOR_LOGO_LAYER_DEFAULT
      : mode === "delayed" && id === "logo"
        ? INTRODUCTION_DELAYED_SCENE_DEFAULTS.logo
        : mode === "delayed"
          ? INTRODUCTION_DELAYED_SCENE_DEFAULTS.questionsPanel
          : INTRODUCTION_LAYER_DEFAULTS[id];
    updateLayer(id, { x: defaults.x, y: defaults.y, width: defaults.width, zIndex: defaults.zIndex, visible: true });
  };

  const moveOrder = (id: IntroductionLayerId, direction: -1 | 1) => {
    const ordered = layerFields.map((field) => field.id).sort((a, b) => layers[a].zIndex - layers[b].zIndex);
    const index = ordered.indexOf(id);
    const nextIndex = Math.max(0, Math.min(ordered.length - 1, index + direction));
    if (nextIndex === index) return;
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    const next = { ...layers };
    ordered.forEach((layerId, order) => { next[layerId] = { ...next[layerId], zIndex: order + 1 }; });
    onUpdateLayers(next);
  };

  const orderedLayers = layerFields.map((field) => ({ ...field, config: layers[field.id] })).sort((a, b) => a.config.zIndex - b.config.zIndex);
  const selectionBounds = getBounds(activeSelection);

  return <div className={`intro-composer ${mode === "delayed" ? "intro-composer-delayed" : ""}`}>
    <div className="intro-editor-heading"><div><strong>COMPOSITION 16:9</strong><small>Glissez les calques. Ctrl+clic pour en sélectionner plusieurs et déplacer ou redimensionner le groupe{activeSelection.length > 1 ? ` · ${activeSelection.length} sélectionnés` : ""}.</small></div><div className="intro-editor-view-tools"><button type="button" className={showGuides && !asPreview ? "active" : ""} onClick={() => setShowGuides((current) => !current)}>Repères</button><button type="button" className={asPreview ? "active" : ""} onClick={() => setAsPreview((current) => !current)}>{asPreview ? "Modifier les calques" : "Aperçu sans poignées"}</button></div></div>
    <div
      ref={stageRef}
      className={`intro-stage ${asPreview ? "intro-stage-clean" : ""}`}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      onPointerDown={() => { if (!asPreview) setSelectedIds([]); }}
      aria-label="Éditeur visuel de l’introduction au format 16:9"
    >
      {background && <Image src={assetUrl(background) || ""} alt="Fond de l’introduction" fill unoptimized draggable={false} className="intro-stage-background" />}
      {!background && <div className="intro-stage-empty">IMPORTER UNE IMAGE DE FOND 16:9</div>}
      {orderedLayers.filter(({ config }) => config.image && config.visible).map(({ id, label, config }) => {
        const aspect = aspectByLayer[id] ?? 1;
        const height = config.width * aspect;
        const selected = activeSelection.includes(id) && !asPreview;
        return <div
          key={id}
          className={`intro-stage-layer ${selected ? "selected" : ""}`}
          style={{ left: `${config.x / VIDEO_WIDTH * 100}%`, top: `${config.y / VIDEO_HEIGHT * 100}%`, width: `${config.width / VIDEO_WIDTH * 100}%`, height: `${height / VIDEO_HEIGHT * 100}%`, zIndex: config.zIndex }}
          onPointerDown={(event) => {
            const additive = event.ctrlKey || event.metaKey;
            const ids = additive
              ? activeSelection.includes(id) ? activeSelection : [...activeSelection, id]
              : activeSelection.includes(id) ? activeSelection : [id];
            beginDrag(event, id, "move", ids);
          }}
          title={`${label} · glisser pour déplacer`}
        >
          <Image src={assetUrl(config.image) || ""} alt={label} fill unoptimized draggable={false} onLoad={(event) => imageLoaded(id, event)} className="intro-stage-layer-image" />
        </div>;
      })}
      {selectionBounds && !asPreview && <div
        className="intro-selection-box"
        style={{ left: `${selectionBounds.x / VIDEO_WIDTH * 100}%`, top: `${selectionBounds.y / VIDEO_HEIGHT * 100}%`, width: `${selectionBounds.width / VIDEO_WIDTH * 100}%`, height: `${selectionBounds.height / VIDEO_HEIGHT * 100}%` }}
        aria-label={`${activeSelection.length} calque${activeSelection.length > 1 ? "s" : ""} sélectionné${activeSelection.length > 1 ? "s" : ""}`}
      >{CORNERS.map((corner) => <button key={corner} type="button" className={`intro-resize-handle ${corner}`} aria-label={`Redimensionner ${activeSelection.length > 1 ? "le groupe" : LAYER_FIELDS.find(({ id }) => id === activeSelection[0])?.label}`} onPointerDown={(event) => beginDrag(event, activeSelection[0], corner, activeSelection)} />)}</div>}
      {showGuides && !asPreview && <>
        <div className="intro-align-guide vertical" />
        <div className="intro-align-guide horizontal" />
      </>}
    </div>
    <div className="intro-layer-list">
      <div className="intro-layer-list-heading"><strong>{mode === "main" ? "LOGO GLOBAL" : mode === "delayed" ? "CALQUES DIFFÉRÉS" : "CALQUES PNG TRANSPARENTS"}</strong><small>Le fond reste indépendant. Importez chaque élément en PNG.</small></div>
      <div className="intro-background-row">
        <div className="intro-layer-thumb background-thumb">{background ? <Image src={assetUrl(background) || ""} alt="Miniature du fond" width={144} height={81} unoptimized /> : <span>FOND 16:9</span>}</div>
        <div className="intro-layer-info"><strong>{mode === "main" ? "Fond global" : mode === "delayed" ? "Nouveau fond" : "Image de fond"}</strong><small>{mode === "main" ? "Fond partagé par les questions et les thèmes" : mode === "delayed" ? "Fond réservé à la scène suivante" : backgroundIsFallback ? "Fond global du quiz · utilisé en l’absence d’un fond d’introduction dédié" : background ? "Fond principal de l’introduction" : "Fond principal · facultatif pour la composition"}</small></div>
        <label className="upload-button">{busy === backgroundBusyKey ? "Import…" : background ? "Remplacer" : "Importer le fond"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadBackground(file); event.currentTarget.value = ""; }} /></label>
        {background && !backgroundIsFallback && <button type="button" className="text-button" onClick={onRemoveBackground}>Supprimer</button>}
      </div>
      {orderedLayers.map(({ id, label, config }) => <div className={`intro-layer-row ${activeSelection.includes(id) ? "chosen" : ""}`} key={id}>
        <button type="button" className="intro-layer-thumb" onClick={(event) => selectFromList(event, id)} aria-label={`Sélectionner ${label}`}>
          {config.image ? <Image src={assetUrl(config.image) || ""} alt={`Miniature : ${label}`} width={80} height={62} unoptimized /> : <span>PNG</span>}
        </button>
        <div className="intro-layer-info"><strong>{label}</strong><small>{config.image ? `${Math.round(config.width)} × ${Math.round(config.width * (aspectByLayer[id] ?? 1))} px · calque ${config.zIndex}` : "PNG transparent · non importé"}</small></div>
        <div className="intro-layer-actions">
          <label className="upload-button">{busy === layerBusyKey(id) ? "Import…" : config.image ? "Remplacer" : "Importer PNG"}<input type="file" accept={mode === "main" ? "image/png,image/jpeg,image/webp" : "image/png"} disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadLayer(id, file); event.currentTarget.value = ""; }} /></label>
          {config.image && <>
            <button type="button" className="text-button" onClick={() => updateLayer(id, { image: null })}>Supprimer</button>
            <label className="intro-layer-visible"><input type="checkbox" checked={config.visible} onChange={(event) => updateLayer(id, { visible: event.target.checked })} /> Visible</label>
            <button type="button" className="text-button" onClick={() => centerLayer(id, "horizontal")}>Centrer H</button>
            <button type="button" className="text-button" onClick={() => centerLayer(id, "vertical")}>Centrer V</button>
            <button type="button" className="text-button" onClick={() => moveOrder(id, -1)} aria-label={`Descendre ${label}`}>↓</button>
            <button type="button" className="text-button" onClick={() => moveOrder(id, 1)} aria-label={`Monter ${label}`}>↑</button>
            <button type="button" className="text-button" onClick={() => resetLayer(id)}>Réinitialiser</button>
          </>}
        </div>
      </div>)}
    </div>
  </div>;
}
