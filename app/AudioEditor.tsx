"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { RecordingClip, RecordingTake } from "@/lib/quiz";

type AudioEditorProps = {
  label: string;
  path: string | null;
  take: Blob | null;
  takeDuration: number | null;
  originalPath: string | null;
  duration: number | null;
  takes: RecordingTake[];
  clips: RecordingClip[];
  montageEnabled: boolean;
  selectedTakeId: string | null;
  onSelectTake: (id: string | null) => void;
  onUpdateClips: (clips: RecordingClip[]) => Promise<void>;
  onNewTake: () => void;
  canAddTake: boolean;
  hideSave: boolean;
  onAddTake: () => Promise<void>;
  onMontageValidated: () => void;
  disabled?: boolean;
  onSave: (blob: Blob, duration: number, originalBlob?: Blob, originalDuration?: number, isNewTake?: boolean, replaceTakeId?: string) => Promise<void>;
  onSaved: () => void;
  onCancelTake: () => void;
};

export type AudioEditorHandle = { save: () => Promise<void>; play: () => Promise<void> };

type Drag = { mode: "new" | "left" | "right" | "move"; pointer: number; origin: number; start: number; end: number; moved: boolean };
type ClipTrimDrag = { id: string; edge: "left" | "right"; pointer: number; x: number; start: number; end: number; width: number };

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const rest = (safe % 60).toFixed(2).padStart(5, "0");
  return `${minutes}:${rest}`;
};

const encodeWav = (buffer: AudioBuffer) => {
  const channels = buffer.numberOfChannels;
  const bytesPerSample = 2;
  const dataSize = buffer.length * channels * bytesPerSample;
  const output = new ArrayBuffer(44 + dataSize);
  const view = new DataView(output);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, dataSize, true);
  let offset = 44;
  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let frame = 0; frame < buffer.length; frame += 1) for (let channel = 0; channel < channels; channel += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true); offset += bytesPerSample;
  }
  return new Blob([output], { type: "audio/wav" });
};

const extractBuffer = (context: BaseAudioContext, source: AudioBuffer, from: number, to: number, fadeEdges = false) => {
  const first = Math.max(0, Math.floor(from * source.sampleRate));
  const last = Math.min(source.length, Math.ceil(to * source.sampleRate));
  const length = last - first;
  if (length < Math.ceil(source.sampleRate * 0.05)) throw new Error("La sélection est trop courte pour être conservée.");
  const output = context.createBuffer(source.numberOfChannels, length, source.sampleRate);
  const fade = Math.min(Math.floor(source.sampleRate * 0.005), Math.floor(length / 4));
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const input = source.getChannelData(channel);
    const samples = output.getChannelData(channel);
    samples.set(input.subarray(first, last));
    if (fadeEdges && fade > 0) {
      for (let i = 0; i < fade; i += 1) {
        const factor = i / fade;
        samples[i] *= factor;
        samples[length - 1 - i] *= factor;
      }
    }
  }
  return output;
};

const removeBufferRange = (context: BaseAudioContext, source: AudioBuffer, from: number, to: number) => {
  const first = Math.max(0, Math.floor(from * source.sampleRate));
  const last = Math.min(source.length, Math.ceil(to * source.sampleRate));
  const removed = last - first;
  const fade = first > 0 && last < source.length ? Math.min(Math.floor(source.sampleRate * 0.005), first, source.length - last) : 0;
  const outputLength = source.length - removed - fade;
  if (outputLength < Math.ceil(source.sampleRate * 0.05)) throw new Error("La coupe supprimerait presque toute la prise.");
  const output = context.createBuffer(source.numberOfChannels, outputLength, source.sampleRate);
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const input = source.getChannelData(channel);
    const samples = output.getChannelData(channel);
    if (fade > 0) {
      const joinStart = first - fade;
      samples.set(input.subarray(0, joinStart));
      for (let i = 0; i < fade; i += 1) {
        const mix = (i + 1) / (fade + 1);
        samples[joinStart + i] = input[first - fade + i] * (1 - mix) + input[last + i] * mix;
      }
      samples.set(input.subarray(last + fade), first);
    } else {
      samples.set(input.subarray(0, first));
      samples.set(input.subarray(last), first);
      const edgeFade = Math.min(Math.floor(source.sampleRate * 0.005), Math.floor(outputLength / 4));
      if (first === 0) for (let i = 0; i < edgeFade; i += 1) samples[i] *= i / edgeFade;
      if (last === source.length) for (let i = 0; i < edgeFade; i += 1) samples[outputLength - 1 - i] *= i / edgeFade;
    }
  }
  return output;
};

const composeMontage = async (takes: RecordingTake[], clips: RecordingClip[]) => {
  if (!clips.length) throw new Error("Ajoutez au moins un extrait au montage.");
  const context = new AudioContext();
  try {
    const sources = new Map<string, AudioBuffer>();
    for (const takeId of [...new Set(clips.map((clip) => clip.takeId))]) {
      const take = takes.find((item) => item.id === takeId);
      if (!take) throw new Error("Une prise source du montage est introuvable.");
      const response = await fetch(take.path.startsWith("/") ? take.path : `/${take.path}`);
      if (!response.ok) throw new Error("Une prise source n’a pas pu être chargée.");
      sources.set(takeId, await context.decodeAudioData(await response.arrayBuffer()));
    }
    const sampleRate = 48000;
    const channelCount = Math.max(1, ...[...sources.values()].map((source) => source.numberOfChannels));
    const segments = clips.map((clip) => {
      const source = sources.get(clip.takeId)!;
      const start = Math.min(source.duration, Math.max(0, clip.start));
      const end = Math.min(source.duration, Math.max(start, clip.end));
      const frames = Math.max(1, Math.round((end - start) * sampleRate));
      return { clip, source, sourceStart: start * source.sampleRate, frames, channels: Array.from({ length: source.numberOfChannels }, (_, channel) => source.getChannelData(channel)) };
    });
    const overlaps = segments.map((segment, index) => {
      if (index === 0 || clips[index - 1].pauseAfter > 0) return 0;
      return Math.min(Math.round(segment.clip.transitionMs * sampleRate / 1000), Math.floor(segment.frames / 4), Math.floor(segments[index - 1].frames / 4));
    });
    const gaps = clips.map((clip, index) => index < clips.length - 1 ? Math.round(clip.pauseAfter * sampleRate) : 0);
    const totalFrames = segments.reduce((sum, segment) => sum + segment.frames, 0) - overlaps.reduce((sum, frames) => sum + frames, 0) + gaps.reduce((sum, frames) => sum + frames, 0);
    if (totalFrames < sampleRate * 0.05) throw new Error("Le montage est trop court pour être exporté.");
    const output = context.createBuffer(channelCount, totalFrames, sampleRate);
    const outputChannels = Array.from({ length: channelCount }, (_, channel) => output.getChannelData(channel));
    let cursor = 0;
    segments.forEach((segment, index) => {
      const overlap = overlaps[index];
      const writeStart = cursor - overlap;
      for (let frame = 0; frame < segment.frames; frame += 1) {
        const sourcePosition = segment.sourceStart + frame * segment.source.sampleRate / sampleRate;
        const sourceFrame = Math.floor(sourcePosition);
        const fraction = sourcePosition - sourceFrame;
        const mix = overlap && frame < overlap ? (frame + 1) / (overlap + 1) : 1;
        for (let channel = 0; channel < channelCount; channel += 1) {
          const data = segment.channels[Math.min(channel, segment.channels.length - 1)];
          const first = data[Math.min(sourceFrame, data.length - 1)] ?? 0;
          const second = data[Math.min(sourceFrame + 1, data.length - 1)] ?? first;
          const sample = first + (second - first) * fraction;
          const targetFrame = writeStart + frame;
          outputChannels[channel][targetFrame] = overlap && frame < overlap
            ? outputChannels[channel][targetFrame] * (1 - mix) + sample * mix
            : sample;
        }
      }
      cursor = writeStart + segment.frames + gaps[index];
    });
    return { buffer: output, blob: encodeWav(output), duration: output.duration };
  } finally { if (context.state !== "closed") await context.close().catch(() => undefined); }
};

export const AudioEditor = forwardRef<AudioEditorHandle, AudioEditorProps>(function AudioEditor({ label, path, take, takeDuration, originalPath, duration, takes, clips, montageEnabled, selectedTakeId, onSelectTake, onUpdateClips, onNewTake, canAddTake, hideSave, onAddTake, onMontageValidated, disabled = false, onSave, onSaved, onCancelTake }, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const montageAudioRef = useRef<HTMLAudioElement>(null);
  const sourcePreviewRef = useRef<HTMLAudioElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const clipTrimDragRef = useRef<ClipTrimDrag | null>(null);
  const initialBufferRef = useRef<AudioBuffer | null>(null);
  const originalBufferRef = useRef<AudioBuffer | null>(null);
  const [initialBuffer, setInitialBuffer] = useState<AudioBuffer | null>(null);
  const [originalReady, setOriginalReady] = useState(false);
  const [history, setHistory] = useState<AudioBuffer[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingSelection, setPlayingSelection] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [montageClips, setMontageClips] = useState<RecordingClip[]>(clips);
  const montageDraftRef = useRef<RecordingClip[]>(clips);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(clips[0]?.id ?? null);
  const montageHistoryRef = useRef<RecordingClip[][]>([clips]);
  const montageHistoryIndexRef = useRef(0);
  const [montageHistoryState, setMontageHistoryState] = useState(0);
  const [montagePreviewUrl, setMontagePreviewUrl] = useState("");
  const [montageDuration, setMontageDuration] = useState(0);
  const [montagePlayhead, setMontagePlayhead] = useState(0);
  const [montageIsPlaying, setMontageIsPlaying] = useState(false);
  const [montageZoom, setMontageZoom] = useState(1);
  const [takeWaveforms, setTakeWaveforms] = useState<Record<string, { path: string; peaks: number[] }>>({});
  const [montageBusy, setMontageBusy] = useState(false);
  const [montageError, setMontageError] = useState("");
  const buffer = history[historyIndex] ?? null;
  const totalDuration = buffer?.duration ?? duration ?? 0;
  const dirty = historyIndex > 0;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const selectedClip = montageClips.find((clip) => clip.id === selectedClipId) ?? null;
  const montageLength = montageClips.reduce((sum, clip, index) => sum + clip.end - clip.start + (index < montageClips.length - 1 ? clip.pauseAfter : 0), 0);
  const montageUndoAvailable = montageHistoryState > 0;
  const montageRedoAvailable = montageHistoryState < montageHistoryRef.current.length - 1;

  useEffect(() => {
    let cancelled = false;
    const missing = takes.filter((item) => takeWaveforms[item.id]?.path !== item.path);
    if (!missing.length) return;
    const loadPeaks = async () => {
      const context = new AudioContext();
      try {
        const entries = await Promise.all(missing.map(async (item) => {
          try {
            const response = await fetch(item.path.startsWith("/") ? item.path : `/${item.path}`);
            if (!response.ok) return null;
            const audio = await context.decodeAudioData(await response.arrayBuffer()); const channel = audio.getChannelData(0); const count = 56;
            const waveform = Array.from({ length: count }, (_, index) => {
              const from = Math.floor(index * channel.length / count); const to = Math.max(from + 1, Math.floor((index + 1) * channel.length / count));
              let peak = 0; for (let frame = from; frame < Math.min(channel.length, to); frame += 1) peak = Math.max(peak, Math.abs(channel[frame])); return peak;
            });
            return [item.id, { path: item.path, peaks: waveform }] as const;
          } catch { return null; }
        }));
        if (!cancelled) setTakeWaveforms((current) => ({ ...current, ...Object.fromEntries(entries.filter((item): item is readonly [string, { path: string; peaks: number[] }] => Boolean(item))) }));
      } finally { if (context.state !== "closed") await context.close().catch(() => undefined); }
    };
    void loadPeaks();
    return () => { cancelled = true; };
  }, [takeWaveforms, takes]);

  useEffect(() => {
    let cancelled = false;
    let context: AudioContext | null = null;
    setLoading(true); setLoadError(""); setSelection(null); setHistory([]); setHistoryIndex(0); setZoom(1);
    const decodePath = async (audioPath: string) => {
      const url = audioPath.startsWith("/") ? audioPath : `/${audioPath}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Impossible de charger l’enregistrement.");
      return context!.decodeAudioData(await response.arrayBuffer());
    };
    const load = async () => {
      try {
        context = new AudioContext();
        const current = take ? await context.decodeAudioData(await take.arrayBuffer()) : path ? await decodePath(path) : null;
        if (!current) { setLoading(false); return; }
        let original = current;
        if (!take && originalPath && path && originalPath !== path) {
          try { original = await decodePath(originalPath); }
          catch { if (!cancelled) setLoadError("La copie originale est introuvable ; la prise active reste modifiable."); }
        }
        if (cancelled) return;
        initialBufferRef.current = current; originalBufferRef.current = original;
        setInitialBuffer(current); setHistory([current]); setHistoryIndex(0); setPlayhead(0); setOriginalReady(true); setLoading(false);
      } catch (cause) {
        if (!cancelled) { setLoadError(cause instanceof Error ? cause.message : "Impossible de lire cette prise dans le navigateur."); setLoading(false); }
      } finally { if (context && context.state !== "closed") await context.close().catch(() => undefined); }
    };
    void load();
    return () => { cancelled = true; };
  }, [originalPath, path, take]);

  useEffect(() => {
    if (JSON.stringify(clips) === JSON.stringify(montageDraftRef.current)) return;
    montageDraftRef.current = clips; setMontageClips(clips); setSelectedClipId(clips[0]?.id ?? null);
    montageHistoryRef.current = [clips]; montageHistoryIndexRef.current = 0; setMontageHistoryState(0);
  }, [clips]);

  useEffect(() => {
    if (!buffer) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(encodeWav(buffer));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [buffer]);

  useEffect(() => () => { if (montagePreviewUrl) URL.revokeObjectURL(montagePreviewUrl); }, [montagePreviewUrl]);
  useEffect(() => () => { sourcePreviewRef.current?.pause(); montageAudioRef.current?.pause(); }, []);

  const peaks = useMemo(() => {
    if (!buffer) return [];
    const bins = Math.min(2400, Math.max(700, Math.ceil(buffer.duration * 100)));
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
    return Array.from({ length: bins }, (_, bin) => {
      const start = Math.floor(bin * buffer.length / bins);
      const end = Math.max(start + 1, Math.floor((bin + 1) * buffer.length / bins));
      let peak = 0; let sum = 0;
      for (const channel of channels) for (let index = start; index < Math.min(buffer.length, end); index += 1) {
        const sample = channel[index]; peak = Math.max(peak, Math.abs(sample)); sum += sample * sample;
      }
      const count = Math.max(1, (end - start) * channels.length);
      return { peak, rms: Math.sqrt(sum / count) };
    });
  }, [buffer]);

  useEffect(() => {
    const content = timelineRef.current; const canvas = canvasRef.current;
    if (!content || !canvas || !buffer || !peaks.length) return;
    const draw = () => {
      const width = content.clientWidth; const height = 124; const ratio = window.devicePixelRatio || 1;
      if (!width) return;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0d120f"; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#66734b"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
      const stride = Math.max(1, Math.ceil(peaks.length / width));
      ctx.lineWidth = Math.max(1, Math.min(2, width / peaks.length * 1.4));
      for (let x = 0; x < width; x += 1) {
        const peakIndex = Math.min(peaks.length - 1, Math.floor(x / width * peaks.length));
        let amplitude = 0;
        for (let item = peakIndex; item < Math.min(peaks.length, peakIndex + stride); item += 1) amplitude = Math.max(amplitude, peaks[item].peak);
        const bar = Math.max(1.5, amplitude * height * 0.46);
        ctx.strokeStyle = amplitude > 0.72 ? "#e3c870" : "#b9aa68";
        ctx.beginPath(); ctx.moveTo(x + 0.5, height / 2 - bar); ctx.lineTo(x + 0.5, height / 2 + bar); ctx.stroke();
      }
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(content);
    return () => observer.disconnect();
  }, [buffer, peaks]);

  const commit = useCallback((next: AudioBuffer) => {
    setHistory((current) => [...current.slice(0, historyIndex + 1), next]);
    setHistoryIndex((index) => index + 1); setSelection(null); setPlayhead(Math.min(playhead, next.duration)); setError("");
  }, [historyIndex, playhead]);

  const withContext = (operation: (context: AudioContext, audioBuffer: AudioBuffer) => AudioBuffer) => {
    if (!buffer) return;
    const context = new AudioContext();
    try { commit(operation(context, buffer)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Le montage audio a échoué."); }
    finally { void context.close().catch(() => undefined); }
  };

  const commitMontage = (next: RecordingClip[], selectedId = next.at(-1)?.id ?? null) => {
    const lastCommitted = montageHistoryRef.current[montageHistoryIndexRef.current];
    if (JSON.stringify(next) === JSON.stringify(lastCommitted)) { montageDraftRef.current = next; return; }
    const nextHistory = [...montageHistoryRef.current.slice(0, montageHistoryIndexRef.current + 1), next];
    montageHistoryRef.current = nextHistory; montageHistoryIndexRef.current = nextHistory.length - 1;
    montageDraftRef.current = next;
    setMontageHistoryState(montageHistoryIndexRef.current); setMontageClips(next); setSelectedClipId(selectedId); setMontageError("");
    montageAudioRef.current?.pause(); if (montagePreviewUrl) URL.revokeObjectURL(montagePreviewUrl); setMontagePreviewUrl(""); setMontageDuration(0);
    setMontageBusy(true);
    void onUpdateClips(next).catch((cause) => setMontageError(cause instanceof Error ? cause.message : "Le montage n’a pas pu être sauvegardé.")).finally(() => setMontageBusy(false));
  };
  const undoMontage = () => {
    if (montageHistoryIndexRef.current <= 0) return;
    montageHistoryIndexRef.current -= 1;
    const next = montageHistoryRef.current[montageHistoryIndexRef.current];
    montageDraftRef.current = next;
    setMontageHistoryState(montageHistoryIndexRef.current); setMontageClips(next); setSelectedClipId(next.at(-1)?.id ?? null);
    montageAudioRef.current?.pause(); if (montagePreviewUrl) URL.revokeObjectURL(montagePreviewUrl); setMontagePreviewUrl(""); setMontageDuration(0);
    setMontageBusy(true); void onUpdateClips(next).catch((cause) => setMontageError(cause instanceof Error ? cause.message : "Annulation impossible.")).finally(() => setMontageBusy(false));
  };
  const redoMontage = () => {
    if (montageHistoryIndexRef.current >= montageHistoryRef.current.length - 1) return;
    montageHistoryIndexRef.current += 1;
    const next = montageHistoryRef.current[montageHistoryIndexRef.current];
    montageDraftRef.current = next;
    setMontageHistoryState(montageHistoryIndexRef.current); setMontageClips(next); setSelectedClipId(next.at(-1)?.id ?? null);
    montageAudioRef.current?.pause(); if (montagePreviewUrl) URL.revokeObjectURL(montagePreviewUrl); setMontagePreviewUrl(""); setMontageDuration(0);
    setMontageBusy(true); void onUpdateClips(next).catch((cause) => setMontageError(cause instanceof Error ? cause.message : "Rétablissement impossible.")).finally(() => setMontageBusy(false));
  };
  const createClipFromTake = async (takeId: string, start: number, end: number): Promise<RecordingClip> => {
    const source = takes.find((item) => item.id === takeId);
    if (!source) throw new Error("La prise sélectionnée est introuvable.");
    const count = 56;
    let waveform: number[] = [];
    if (takeId === selectedTakeId && buffer && totalDuration > 0) {
      const first = Math.floor(start / totalDuration * peaks.length); const last = Math.max(first + 1, Math.ceil(end / totalDuration * peaks.length));
      waveform = Array.from({ length: count }, (_, index) => {
        const peakStart = first + Math.floor(index * (last - first) / count); const peakEnd = Math.max(peakStart + 1, first + Math.floor((index + 1) * (last - first) / count));
        return Math.max(0, ...peaks.slice(peakStart, peakEnd).map((item) => item.peak));
      });
    } else {
      const context = new AudioContext();
      try {
        const response = await fetch(source.path.startsWith("/") ? source.path : `/${source.path}`);
        if (!response.ok) throw new Error("La forme d’onde de la prise ne peut pas être chargée.");
        const audio = await context.decodeAudioData(await response.arrayBuffer());
        const data = audio.getChannelData(0); const first = Math.floor(start * audio.sampleRate); const last = Math.max(first + 1, Math.ceil(end * audio.sampleRate));
        waveform = Array.from({ length: count }, (_, index) => {
          const from = Math.min(last - 1, first + Math.floor(index * (last - first) / count)); const to = Math.min(last, Math.max(from + 1, first + Math.floor((index + 1) * (last - first) / count)));
          let peak = 0; for (let frame = from; frame < to; frame += 1) peak = Math.max(peak, Math.abs(data[frame])); return peak;
        });
      } finally { if (context.state !== "closed") await context.close().catch(() => undefined); }
    }
    return { id: crypto.randomUUID(), takeId, start, end, pauseAfter: 0, transitionMs: 8, waveform };
  };
  const addSelectedExcerpt = async () => {
    if (!selection || !selectedTakeId) return;
    try { commitMontage([...montageClips, await createClipFromTake(selectedTakeId, selection.start, selection.end)]); }
    catch (cause) { setMontageError(cause instanceof Error ? cause.message : "L’extrait n’a pas pu être ajouté."); }
  };
  const addWholeTake = async (takeId: string, beforeId?: string) => {
    const source = takes.find((item) => item.id === takeId); if (!source) return;
    try {
      const clip = await createClipFromTake(takeId, 0, source.duration);
      const beforeIndex = beforeId ? montageClips.findIndex((item) => item.id === beforeId) : -1;
      if (beforeIndex < 0) commitMontage([...montageClips, clip]);
      else { const next = [...montageClips]; next.splice(beforeIndex, 0, clip); commitMontage(next, clip.id); }
    } catch (cause) { setMontageError(cause instanceof Error ? cause.message : "La prise n’a pas pu être ajoutée."); }
  };
  const duplicateClip = (clip: RecordingClip) => {
    const index = montageClips.findIndex((item) => item.id === clip.id); const copy = { ...clip, id: crypto.randomUUID(), pauseAfter: 0 };
    const next = [...montageClips]; next.splice(index + 1, 0, copy); commitMontage(next, copy.id);
  };
  const beginClipTrim = (event: React.PointerEvent<HTMLButtonElement>, clip: RecordingClip, edge: "left" | "right") => {
    event.preventDefault(); event.stopPropagation();
    const block = event.currentTarget.closest(".audio-montage-clip");
    if (!block) return;
    clipTrimDragRef.current = { id: clip.id, edge, pointer: event.pointerId, x: event.clientX, start: clip.start, end: clip.end, width: block.getBoundingClientRect().width };
    setSelectedClipId(clip.id); event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveClipTrim = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = clipTrimDragRef.current; if (!drag || drag.pointer !== event.pointerId) return;
    event.preventDefault();
    const range = drag.end - drag.start; const delta = (event.clientX - drag.x) / Math.max(1, drag.width) * range;
    const next = montageDraftRef.current.map((clip) => clip.id !== drag.id ? clip : drag.edge === "left"
      ? { ...clip, start: Math.min(drag.end - 0.05, Math.max(0, drag.start + delta)) }
      : { ...clip, end: Math.max(drag.start + 0.05, Math.min(takes.find((item) => item.id === clip.takeId)?.duration ?? drag.end, drag.end + delta)) });
    montageDraftRef.current = next; setMontageClips(next);
  };
  const endClipTrim = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (clipTrimDragRef.current?.pointer !== event.pointerId) return;
    clipTrimDragRef.current = null; event.stopPropagation(); commitMontage(montageClips);
  };
  const reorderClip = (fromId: string, toId: string) => {
    const from = montageClips.findIndex((clip) => clip.id === fromId); const to = montageClips.findIndex((clip) => clip.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...montageClips]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); commitMontage(next);
  };
  const editClip = (id: string, patch: Partial<RecordingClip>, persist = false) => {
    const next = montageDraftRef.current.map((clip) => clip.id === id ? { ...clip, ...patch } : clip);
    montageDraftRef.current = next; setMontageClips(next);
    if (persist) commitMontage(next);
  };
  const removeClip = (id: string) => commitMontage(montageClips.filter((clip) => clip.id !== id));
  const setMontagePreview = (blob: Blob, seconds: number) => {
    const url = URL.createObjectURL(blob);
    montageAudioRef.current?.pause();
    if (montagePreviewUrl) URL.revokeObjectURL(montagePreviewUrl); setMontagePreviewUrl(url); setMontageDuration(seconds);
    window.setTimeout(() => { const player = montageAudioRef.current; if (player) void player.play().catch(() => undefined); }, 0);
  };
  const previewMontage = async () => {
    setMontageBusy(true); setMontageError("");
    try { const result = await composeMontage(takes, montageClips); setMontagePreview(result.blob, result.duration); }
    catch (cause) { setMontageError(cause instanceof Error ? cause.message : "La prévisualisation du montage a échoué."); }
    finally { setMontageBusy(false); }
  };
  const validateMontage = async () => {
    setMontageBusy(true); setMontageError("");
    try {
      const result = await composeMontage(takes, montageClips);
      setSaving(true); await onSave(result.blob, result.duration); onMontageValidated();
    } catch (cause) { setMontageError(cause instanceof Error ? cause.message : "Le montage n’a pas pu être validé."); }
    finally { setSaving(false); setMontageBusy(false); }
  };
  const previewSource = (sourcePath: string) => {
    sourcePreviewRef.current?.pause();
    const audio = new Audio(sourcePath.startsWith("/") ? sourcePath : `/${sourcePath}`);
    sourcePreviewRef.current = audio; void audio.play().catch(() => setMontageError("La lecture de cette prise est impossible."));
  };
  const restartMontage = () => { const player = montageAudioRef.current; if (player) { player.currentTime = 0; setMontagePlayhead(0); void player.play().catch(() => undefined); } };
  const seekMontage = (event: React.MouseEvent<HTMLDivElement>) => {
    const player = montageAudioRef.current; if (!player || !player.duration) return;
    const bounds = event.currentTarget.getBoundingClientRect(); player.currentTime = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * player.duration;
  };
  const dropTakeAt = (event: React.DragEvent<HTMLElement>, beforeId?: string) => {
    const takeId = event.dataTransfer.getData("application/x-atelier-take-id");
    if (!takeId) return false;
    event.preventDefault(); event.stopPropagation(); void addWholeTake(takeId, beforeId); return true;
  };
  const previewClip = (clip: RecordingClip) => {
    const source = takes.find((item) => item.id === clip.takeId); if (!source) return;
    sourcePreviewRef.current?.pause();
    const audio = new Audio(source.path.startsWith("/") ? source.path : `/${source.path}`);
    sourcePreviewRef.current = audio;
    audio.onloadedmetadata = () => { audio.currentTime = clip.start; void audio.play().catch(() => setMontageError("La lecture de cet extrait est impossible.")); };
    audio.ontimeupdate = () => { if (audio.currentTime >= clip.end) audio.pause(); };
  };
  const previewJoin = async (index: number) => {
    const previous = montageClips[index - 1]; const next = montageClips[index]; if (!previous || !next) return;
    const left = { ...previous, start: Math.max(previous.start, previous.end - 0.4), pauseAfter: 0 };
    const right = { ...next, end: Math.min(next.end, next.start + 0.4), pauseAfter: 0 };
    setMontageBusy(true); setMontageError("");
    try { const joined = await composeMontage(takes, [left, right]); setMontagePreview(joined.blob, joined.duration); }
    catch (cause) { setMontageError(cause instanceof Error ? cause.message : "L’écoute du raccord a échoué."); }
    finally { setMontageBusy(false); }
  };

  const undo = useCallback(() => { setHistoryIndex((index) => Math.max(0, index - 1)); setSelection(null); }, []);
  const redo = useCallback(() => { setHistoryIndex((index) => Math.min(history.length - 1, index + 1)); setSelection(null); }, [history.length]);
  const cancelEdits = useCallback(() => {
    if (initialBufferRef.current) { setHistory([initialBufferRef.current]); setHistoryIndex(0); setSelection(null); setPlayhead(0); setError(""); }
  }, []);
  const restoreOriginal = useCallback(() => {
    const original = originalBufferRef.current; const current = initialBufferRef.current;
    if (!original || !current || original === current) { cancelEdits(); return; }
    setHistory([current, original]); setHistoryIndex(1); setSelection(null); setPlayhead(0); setError("");
  }, [cancelEdits]);

  const setFromClientX = useCallback((clientX: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || !totalDuration) return 0;
    return Math.min(totalDuration, Math.max(0, (clientX - rect.left) / rect.width * totalDuration));
  }, [totalDuration]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!buffer || disabled || saving) return;
    (event.currentTarget.closest(".voice-audio-editor") as HTMLElement | null)?.focus();
    const position = setFromClientX(event.clientX);
    const rect = timelineRef.current?.getBoundingClientRect(); if (!rect) return;
    const target = event.target as HTMLElement;
    const handle = target.dataset.handle;
    let mode: Drag["mode"] = "new";
    if (handle === "left") mode = "left";
    else if (handle === "right") mode = "right";
    else if (target.dataset.selection === "true" && selection) mode = "move";
    dragRef.current = { mode, pointer: event.pointerId, origin: position, start: selection?.start ?? position, end: selection?.end ?? position, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (mode === "new") setSelection({ start: position, end: position });
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current; if (!drag || drag.pointer !== event.pointerId) return;
    const position = setFromClientX(event.clientX);
    if (Math.abs(position - drag.origin) > 0.015) drag.moved = true;
    if (drag.mode === "new") setSelection({ start: Math.min(drag.origin, position), end: Math.max(drag.origin, position) });
    if (drag.mode === "left") setSelection({ start: Math.min(position, drag.end - 0.01), end: drag.end });
    if (drag.mode === "right") setSelection({ start: drag.start, end: Math.max(position, drag.start + 0.01) });
    if (drag.mode === "move") {
      const width = drag.end - drag.start; const start = Math.max(0, Math.min(totalDuration - width, drag.start + position - drag.origin));
      setSelection({ start, end: start + width });
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current; if (!drag || drag.pointer !== event.pointerId) return;
    const position = setFromClientX(event.clientX);
    if (drag.mode === "new" && !drag.moved) { setSelection(null); setPlayhead(position); if (audioRef.current) audioRef.current.currentTime = position; }
    dragRef.current = null;
  };

  const play = useCallback(async (selectionOnly = false) => {
    const audio = audioRef.current; if (!audio || !previewUrl) return;
    if (selectionOnly && selection) { audio.currentTime = selection.start; setPlayingSelection(true); }
    else setPlayingSelection(false);
    await audio.play();
  }, [previewUrl, selection]);
  const stop = () => { const audio = audioRef.current; if (audio) { audio.pause(); audio.currentTime = 0; } setPlayhead(0); setPlayingSelection(false); };
  const pauseOrPlay = () => { const audio = audioRef.current; if (!audio) return; if (audio.paused) void play(); else audio.pause(); };
  const removeSelection = () => { if (selection) withContext((context, source) => removeBufferRange(context, source, selection.start, selection.end)); };
  const keepSelection = () => { if (selection) withContext((context, source) => extractBuffer(context, source, selection.start, selection.end, true)); };
  const save = useCallback(async () => {
    if (!buffer || (!dirty && !take)) return;
    setSaving(true); setError(""); if (audioRef.current) audioRef.current.pause();
    try {
      const originalBlob = take && dirty ? take : undefined;
      await onSave(encodeWav(buffer), buffer.duration, originalBlob, originalBlob ? takeDuration ?? buffer.duration : undefined, Boolean(take), montageEnabled && !take ? selectedTakeId ?? undefined : undefined);
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "La sauvegarde de la prise a échoué."); }
    finally { setSaving(false); }
  }, [buffer, dirty, montageEnabled, onSave, onSaved, selectedTakeId, take, takeDuration]);

  useImperativeHandle(ref, () => ({ save, play: () => play() }), [save, play]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    if (event.key === "Enter" && event.target === event.currentTarget && take) { event.preventDefault(); if (canAddTake) void onAddTake(); else void save(); }
    else if (event.code === "Space") { event.preventDefault(); pauseOrPlay(); }
    else if (event.key === "Delete" && selection) { event.preventDefault(); removeSelection(); }
    else if (event.key.toLowerCase() === "z" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); if (event.shiftKey) { if (montageRedoAvailable) redoMontage(); else redo(); } else if (montageUndoAvailable) undoMontage(); else undo(); }
    else if (event.key.toLowerCase() === "y" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); if (montageRedoAvailable) redoMontage(); else redo(); }
    else if (event.key === "Escape") { setSelection(null); }
    else if (event.key === "+" || event.key === "=") { setZoom((value) => Math.min(12, value * 1.4)); }
    else if (event.key === "-") { setZoom((value) => Math.max(1, value / 1.4)); }
  };

  const tickInterval = useMemo(() => {
    if (!totalDuration) return 1;
    const rough = totalDuration / 9; const power = 10 ** Math.floor(Math.log10(rough)); const normal = rough / power;
    return (normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 5 ? 5 : 10) * power;
  }, [totalDuration]);
  const ticks = useMemo(() => Array.from({ length: Math.floor(totalDuration / tickInterval) + 1 }, (_, index) => index * tickInterval), [tickInterval, totalDuration]);
  const selectedDuration = selection ? selection.end - selection.start : 0;

  return <section className="voice-audio-editor" tabIndex={0} aria-label={`Éditeur audio pour ${label}`} onKeyDown={handleKeyDown}>
    <div className="audio-editor-heading"><div><strong>ÉDITION AUDIO</strong><span>{dirty ? "Modifications non enregistrées" : "Le fichier original reste intact jusqu’à la sauvegarde"}</span></div><div className="audio-editor-history"><button type="button" title="Annuler · Ctrl+Z" aria-label="Annuler la modification" disabled={!canUndo || disabled || saving} onClick={undo}>↶</button><button type="button" title="Rétablir · Ctrl+Y" aria-label="Rétablir la modification" disabled={!canRedo || disabled || saving} onClick={redo}>↷</button></div></div>
    {montageEnabled && <section className="audio-takes-panel" aria-label="Prises disponibles"><div className="audio-montage-section-heading"><div><strong>PRISES DISPONIBLES</strong><span>Les sources restent conservées. Glissez une carte vers le montage pour ajouter la prise entière.</span></div><button type="button" className="audio-reset-button" disabled={disabled || saving || montageBusy || canAddTake} onClick={onNewTake}>＋ Nouvelle prise</button></div>
      <div className="audio-take-list">{takes.map((item, index) => <article className={`audio-take-card${selectedTakeId === item.id && !take ? " active" : ""}`} key={item.id} draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-atelier-take-id", item.id); event.dataTransfer.effectAllowed = "copy"; }}><span className="audio-take-index">P{index + 1}</span><div className="audio-take-meta"><strong>Prise {index + 1}</strong><small>{formatTime(item.duration)} · originale conservée</small><span className="audio-take-wave" aria-label={`Forme d’onde de la prise ${index + 1}`}>{(takeWaveforms[item.id]?.peaks ?? []).map((height, bar) => <i key={bar} style={{ height: `${Math.max(2, height * 100)}%` }} />)}</span></div><button type="button" className="audio-reset-button" disabled={disabled || saving} onClick={() => onSelectTake(item.id)}>Éditer</button><button type="button" className="audio-take-play" aria-label={`Écouter la prise ${index + 1}`} onClick={() => previewSource(item.path)}>▶</button></article>)}
        {canAddTake && <article className="audio-take-pending"><span>●</span><div><strong>Nouvelle prise prête</strong><small>{formatTime(takeDuration ?? 0)} · à enregistrer avant d’en faire une autre</small></div><button type="button" disabled={disabled || saving || montageBusy} onClick={() => void onAddTake()}>{montageBusy ? "Enregistrement…" : "Enregistrer la prise"}</button></article>}
        {!takes.length && !canAddTake && <p className="audio-take-empty">Aucune prise sauvegardée pour cette narration.</p>}
      </div>
    </section>}
    {loading && <div className="audio-editor-loading">Analyse du signal audio…</div>}
    {(loadError || error) && <p className="recorder-error" role="alert">{loadError || error}</p>}
    {!loading && buffer && <>
      <div className="audio-timeline-scroll" ref={scrollRef}>
        <div className="audio-timeline-content" ref={timelineRef} style={{ width: `${zoom * 100}%` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null; }}>
          <div className="audio-timeline-ruler" aria-hidden="true">{ticks.map((tick) => <span key={tick} style={{ left: `${tick / totalDuration * 100}%` }}>{formatTime(tick)}</span>)}</div>
          <canvas ref={canvasRef} className="audio-wave-canvas" aria-label="Forme d’onde réelle de la prise" />
          {selection && <div className="audio-wave-selection" data-selection="true" style={{ left: `${selection.start / totalDuration * 100}%`, width: `${selectedDuration / totalDuration * 100}%` }}>
            <button type="button" className="audio-selection-handle left" data-handle="left" aria-label="Déplacer le début de la sélection" />
            <button type="button" className="audio-selection-handle right" data-handle="right" aria-label="Déplacer la fin de la sélection" />
          </div>}
          <div className="audio-playhead" style={{ left: `${playhead / totalDuration * 100}%` }} />
        </div>
      </div>
      <div className="audio-editor-readout"><strong>{formatTime(playhead)}</strong><span>/</span><strong>{formatTime(totalDuration)}</strong>{selection && <em>Sélection {formatTime(selection.start)} – {formatTime(selection.end)} · {formatTime(selectedDuration)}</em>}</div>
      {previewUrl && <audio ref={audioRef} src={previewUrl} preload="auto" onTimeUpdate={(event) => { const time = event.currentTarget.currentTime; setPlayhead(time); if (playingSelection && selection && time >= selection.end) { event.currentTarget.pause(); setPlayingSelection(false); } }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setPlayingSelection(false)} />}
      <div className="audio-editor-transport">
        <div className="audio-editor-transport-group"><button type="button" onClick={pauseOrPlay} disabled={disabled || saving}>{isPlaying ? "Ⅱ Pause" : "▶ Lecture"}</button><button type="button" onClick={stop} disabled={disabled || saving}>■ Retour au début / arrêt</button><button type="button" onClick={() => void play(true)} disabled={!selection || disabled || saving}>▶ Écouter la sélection</button></div>
        <div className="audio-editor-zoom"><button type="button" title="Zoom arrière" onClick={() => setZoom((value) => Math.max(1, value / 1.4))}>−</button><span>{Math.round(zoom * 100)} %</span><button type="button" title="Zoom avant" onClick={() => setZoom((value) => Math.min(12, value * 1.4))}>+</button><button type="button" title="Ajuster à la largeur" onClick={() => { setZoom(1); if (scrollRef.current) scrollRef.current.scrollLeft = 0; }}>Ajuster</button></div>
      </div>
      <div className="audio-editor-edit-actions"><button type="button" className="audio-cut-button" disabled={!selection || disabled || saving} onClick={removeSelection}>Supprimer la sélection</button><button type="button" className="audio-keep-button" disabled={!selection || selectedDuration < 0.05 || disabled || saving} onClick={keepSelection}>Conserver la sélection</button><button type="button" className="audio-reset-button" disabled={!dirty || disabled || saving} onClick={cancelEdits}>Annuler les modifications</button><button type="button" className="audio-reset-button" disabled={!originalReady || !originalBufferRef.current || originalBufferRef.current === initialBuffer || disabled || saving} onClick={restoreOriginal}>Revenir à l’original</button>{!hideSave && <button type="button" className="audio-save-button" disabled={(!dirty && !take) || disabled || saving || !buffer} onClick={() => void save()}>{saving ? "Enregistrement…" : take ? "Enregistrer la prise" : "Enregistrer les modifications"}</button>}{take && <button type="button" className="audio-reset-button" disabled={disabled || saving} onClick={onCancelTake}>Annuler la prise</button>}</div>
      {selectedTakeId && !take && <div className="audio-add-excerpt"><div><strong>{selection ? "Extrait sélectionné" : "Prise entière sélectionnée"}</strong><span>{selection ? `${formatTime(selection.start)} – ${formatTime(selection.end)} · ${formatTime(selectedDuration)}` : `00:00.00 – ${formatTime(totalDuration)} · ${formatTime(totalDuration)}`}</span></div><button type="button" disabled={disabled || saving || montageBusy} onClick={() => selection ? void addSelectedExcerpt() : void addWholeTake(selectedTakeId)}>＋ {selection ? "Ajouter la sélection au montage" : "Ajouter toute la prise au montage"}</button></div>}
      <p className="audio-editor-shortcuts">Glisser sur la forme d’onde pour sélectionner · poignées pour ajuster · faire glisser la plage pour la déplacer · Espace lecture · Suppr couper · Ctrl+Z / Ctrl+Y annuler/rétablir · Échap désélectionner · + / − zoom</p>
    </>}
    {montageEnabled && <section className="audio-montage-panel" aria-label="Montage final de la narration">
      <div className="audio-montage-section-heading"><div><strong>MONTAGE FINAL</strong><span>{montageClips.length} extrait{montageClips.length > 1 ? "s" : ""} · durée estimée {formatTime(montageLength)}{montageDuration ? ` · aperçu ${formatTime(montageDuration)}` : ""}</span></div><div className="audio-montage-history"><button type="button" disabled={!montageUndoAvailable || disabled || montageBusy} onClick={undoMontage}>↶ Annuler</button><button type="button" disabled={!montageRedoAvailable || disabled || montageBusy} onClick={redoMontage}>↷ Rétablir</button></div></div>
      <div className="audio-montage-zoom"><span>Zoom de la timeline</span><input type="range" aria-label="Zoom de la timeline du montage" min="0.75" max="3" step="0.25" value={montageZoom} onChange={(event) => setMontageZoom(Number(event.target.value))} /><output>{Math.round(montageZoom * 100)} %</output></div>
      <div className="audio-montage-track" aria-label="Extraits réorganisables" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (!dropTakeAt(event)) { const id = event.dataTransfer.getData("text/plain"); if (id) { event.preventDefault(); reorderClip(id, montageClips.at(-1)?.id ?? id); } } }}>
        <div className="audio-montage-ruler" onClick={seekMontage} style={{ width: `${Math.max(680, montageLength * 115 * montageZoom)}px` }}><span>00:00</span><span>{formatTime(montageDuration || montageLength)}</span><i style={{ left: `${(montageDuration || montageLength) ? Math.min(100, montagePlayhead / (montageDuration || montageLength) * 100) : 0}%` }} /></div>
        {!montageClips.length ? <p className="audio-take-empty">Le montage est vide. Ajoutez une sélection, une prise entière ou glissez une prise ici.</p> : <div className="audio-montage-track-inner" style={{ width: `${Math.max(680, montageLength * 115 * montageZoom)}px` }}>{montageClips.map((clip, index) => {
        const takeIndex = takes.findIndex((item) => item.id === clip.takeId); const durationForBlock = Math.max(0.01, clip.end - clip.start); const width = montageLength ? Math.max(12, durationForBlock / montageLength * 100) : 100;
        const sourceTake = takes.find((item) => item.id === clip.takeId); const sourceWave = takeWaveforms[clip.takeId]?.path === sourceTake?.path ? takeWaveforms[clip.takeId].peaks : undefined;
        const fallbackWave = clip.waveform ?? (sourceWave && sourceTake ? Array.from({ length: 42 }, (_, bar) => sourceWave[Math.min(sourceWave.length - 1, Math.floor((clip.start + (clip.end - clip.start) * bar / 42) / sourceTake.duration * sourceWave.length))] ?? 0) : selectedTakeId === clip.takeId ? Array.from({ length: 42 }, (_, bar) => { const sample = peaks[Math.floor((clip.start + (clip.end - clip.start) * bar / 42) / totalDuration * peaks.length)]; return sample?.peak ?? 0; }) : []);
        return <article key={clip.id} className={`audio-montage-clip${selectedClipId === clip.id ? " active" : ""}`} draggable onClick={() => setSelectedClipId(clip.id)} onDragStart={(event) => { event.dataTransfer.setData("text/plain", clip.id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (!dropTakeAt(event, clip.id)) { event.preventDefault(); event.stopPropagation(); reorderClip(event.dataTransfer.getData("text/plain"), clip.id); } }} style={{ flexBasis: `${width}%` }}>
          <header><span className="audio-clip-drag" title="Glisser pour changer l’ordre">⠿</span><strong>{index + 1}. Prise {Math.max(1, takeIndex + 1)}</strong><small>{formatTime(durationForBlock)}</small><button type="button" aria-label={`Retirer l’extrait ${index + 1}`} onClick={(event) => { event.stopPropagation(); removeClip(clip.id); }}>×</button></header>
          <small className="audio-clip-range">Source : {formatTime(clip.start)} – {formatTime(clip.end)}</small>
          <div className="audio-clip-wave">{fallbackWave.map((height, bar) => <i key={bar} style={{ height: `${Math.max(2, height * 100)}%` }} />)}<button type="button" className="audio-clip-trim-handle left" aria-label={`Déplacer le début de l’extrait ${index + 1}`} onPointerDown={(event) => beginClipTrim(event, clip, "left")} onPointerMove={moveClipTrim} onPointerUp={endClipTrim} onPointerCancel={endClipTrim} /><button type="button" className="audio-clip-trim-handle right" aria-label={`Déplacer la fin de l’extrait ${index + 1}`} onPointerDown={(event) => beginClipTrim(event, clip, "right")} onPointerMove={moveClipTrim} onPointerUp={endClipTrim} onPointerCancel={endClipTrim} /></div>
          <div className="audio-clip-actions"><button type="button" onClick={(event) => { event.stopPropagation(); previewClip(clip); }}>▶ Écouter</button><button type="button" onClick={(event) => { event.stopPropagation(); duplicateClip(clip); }}>Dupliquer</button>{index > 0 && <button type="button" onClick={(event) => { event.stopPropagation(); void previewJoin(index); }}>◫ Raccord</button>}</div>
        </article>;
      })}{Boolean(montagePreviewUrl && (montageDuration || montageLength)) && <i className="audio-montage-playhead" style={{ left: `${Math.min(100, montagePlayhead / (montageDuration || montageLength) * 100)}%` }} />}</div>}</div>
      {selectedClip && <div className="audio-clip-edit-panel"><div className="audio-clip-edit-heading"><strong>Rogner l’extrait {montageClips.findIndex((clip) => clip.id === selectedClip.id) + 1}</strong><button type="button" className="audio-reset-button" onClick={() => removeClip(selectedClip.id)}>Retirer du montage</button></div>
        <label>Début <output>{formatTime(selectedClip.start)}</output><input type="range" min="0" max={takes.find((item) => item.id === selectedClip.takeId)?.duration ?? selectedClip.end} step="0.01" value={selectedClip.start} onChange={(event) => editClip(selectedClip.id, { start: Math.min(Number(event.target.value), selectedClip.end - 0.05) })} onPointerUp={() => commitMontage(montageClips)} onKeyUp={() => commitMontage(montageClips)} /></label>
        <label>Fin <output>{formatTime(selectedClip.end)}</output><input type="range" min="0" max={takes.find((item) => item.id === selectedClip.takeId)?.duration ?? selectedClip.end} step="0.01" value={selectedClip.end} onChange={(event) => editClip(selectedClip.id, { end: Math.max(Number(event.target.value), selectedClip.start + 0.05) })} onPointerUp={() => commitMontage(montageClips)} onKeyUp={() => commitMontage(montageClips)} /></label>
        <label>{montageClips.findIndex((clip) => clip.id === selectedClip.id) < montageClips.length - 1 ? "Pause avant l’extrait suivant" : "Pause après le dernier extrait"}<span className="audio-pause-value"><output>{selectedClip.pauseAfter.toFixed(2)} s</output><input type="number" aria-label="Durée de pause en secondes" min="0" max="10" step="0.1" value={selectedClip.pauseAfter} disabled={disabled || saving || montageBusy} onChange={(event) => editClip(selectedClip.id, { pauseAfter: Math.min(10, Math.max(0, Number(event.target.value) || 0)) })} onBlur={() => commitMontage(montageDraftRef.current)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span><input type="range" min="0" max="10" step="0.1" value={selectedClip.pauseAfter} disabled={disabled || saving || montageBusy} onChange={(event) => editClip(selectedClip.id, { pauseAfter: Number(event.target.value) })} onPointerUp={() => commitMontage(montageDraftRef.current)} onKeyUp={() => commitMontage(montageDraftRef.current)} />{montageClips.findIndex((clip) => clip.id === selectedClip.id) === montageClips.length - 1 && <small className="audio-last-clip-pause-note">Cette pause sera appliquée si tu ajoutes ensuite un extrait.</small>}</label>
        <label>Fondu à l’entrée <output>{selectedClip.transitionMs} ms</output><input type="range" min="0" max="30" step="1" value={selectedClip.transitionMs} onChange={(event) => editClip(selectedClip.id, { transitionMs: Number(event.target.value) })} onPointerUp={() => commitMontage(montageClips)} onKeyUp={() => commitMontage(montageClips)} /></label>
      </div>}
      {montageError && <p className="recorder-error" role="alert">{montageError}</p>}
      <div className="audio-montage-footer"><button type="button" onClick={() => void previewMontage()} disabled={!montageClips.length || disabled || montageBusy}>{montageBusy ? "Préparation…" : "▶ Générer et écouter le montage"}</button>{montagePreviewUrl && <><button type="button" onClick={() => { const player = montageAudioRef.current; if (!player) return; if (player.paused) void player.play().catch(() => undefined); else player.pause(); }}>{montageIsPlaying ? "Ⅱ Pause" : "▶ Lire / reprendre"}</button><button type="button" onClick={restartMontage}>↺ Revenir au début</button><audio ref={montageAudioRef} controls preload="metadata" src={montagePreviewUrl} aria-label="Écouter le montage complet" onTimeUpdate={(event) => setMontagePlayhead(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setMontageDuration(event.currentTarget.duration)} onPlay={() => setMontageIsPlaying(true)} onPause={() => setMontageIsPlaying(false)} onEnded={() => { setMontageIsPlaying(false); setMontagePlayhead(0); }} /></>}<button type="button" className="audio-save-button" onClick={() => void validateMontage()} disabled={!montageClips.length || disabled || montageBusy || saving}>{saving ? "Enregistrement…" : "Valider et enregistrer le montage final"}</button></div>
    </section>}
  </section>;
});
