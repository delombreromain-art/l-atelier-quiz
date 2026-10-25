"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { VoiceSource } from "@/lib/quiz";

type Props = {
  label: string;
  path: string | null;
  duration: number | null;
  source: VoiceSource;
  aiAvailable: boolean;
  onSourceChange: (source: VoiceSource) => void;
  busy?: boolean;
  autoSaveAfterStop?: boolean;
  onRecordingSaved?: () => void;
  onRecordingStateChange?: (recording: boolean) => void;
  onPendingTakeChange?: (pending: boolean) => void;
  onMicrophoneReady?: () => void;
  showSourcePicker?: boolean;
  micDeviceId?: string;
  onSave: (blob: Blob, duration: number) => Promise<void>;
  onDelete: () => void;
};

export type VoiceRecorderHandle = {
  start: () => Promise<void>;
  stop: () => void;
  saveTake: () => Promise<void>;
  play: () => Promise<void>;
  discardTake: () => void;
  isRecording: () => boolean;
  hasTake: () => boolean;
};

const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export const VoiceRecorder = forwardRef<VoiceRecorderHandle, Props>(function VoiceRecorder({ label, path, duration, source, aiAvailable, onSourceChange, busy = false, autoSaveAfterStop = false, onRecordingSaved, onRecordingStateChange, onPendingTakeChange, onMicrophoneReady, showSourcePicker = true, micDeviceId, onSave, onDelete }, ref) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const stopRequestedRef = useRef(false);
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    contextRef.current?.close().catch(() => undefined);
  }, []);

  useEffect(() => () => { if (take) URL.revokeObjectURL(take.url); }, [take]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setElapsed((performance.now() - startedAtRef.current) / 1000), 100);
    return () => window.clearInterval(timer);
  }, [recording]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (meterFrameRef.current !== null) cancelAnimationFrame(meterFrameRef.current);
    meterFrameRef.current = null; setMicLevel(0);
    const context = contextRef.current; contextRef.current = null; gainRef.current = null; analyserRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }, []);

  const begin = useCallback(async () => {
    setError(""); setElapsed(0);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("L’enregistrement micro n’est pas disponible dans ce navigateur. Essayez Chrome ou Edge en HTTPS ou sur localhost."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { ...(micDeviceId ? { deviceId: { exact: micDeviceId } } : {}), echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      onMicrophoneReady?.();
      let recordedStream = stream;
      try {
        const context = new AudioContext();
        await context.resume();
        const source = context.createMediaStreamSource(stream);
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -22; compressor.knee.value = 18; compressor.ratio.value = 2.2; compressor.attack.value = 0.008; compressor.release.value = 0.18;
        const gain = context.createGain(); gain.gain.setValueAtTime(0, context.currentTime); gain.gain.linearRampToValueAtTime(1, context.currentTime + 0.035);
        const analyser = context.createAnalyser(); analyser.fftSize = 256;
        const destination = context.createMediaStreamDestination();
        source.connect(analyser); source.connect(compressor); compressor.connect(gain); gain.connect(destination);
        contextRef.current = context; gainRef.current = gain; analyserRef.current = analyser; recordedStream = destination.stream;
        const samples = new Uint8Array(analyser.fftSize);
        const updateMeter = () => {
          const currentAnalyser = analyserRef.current;
          if (!currentAnalyser) return;
          currentAnalyser.getByteTimeDomainData(samples);
          let sum = 0; for (const sample of samples) { const value = (sample - 128) / 128; sum += value * value; }
          setMicLevel(Math.min(100, Math.round(Math.sqrt(sum / samples.length) * 260)));
          meterFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch { /* Keep the browser processed microphone stream if Web Audio is unavailable. */ }
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(recordedStream, { mimeType }) : new MediaRecorder(recordedStream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const seconds = Math.max(0.1, (performance.now() - startedAtRef.current) / 1000);
        stopStream(); setRecording(false); setElapsed(seconds); onRecordingStateChange?.(false);
        if (!blob.size) { setError("Aucun son n’a été capturé. Vérifiez le micro puis recommencez."); return; }
        setTake((current) => { if (current) URL.revokeObjectURL(current.url); return { blob, url: URL.createObjectURL(blob), duration: seconds }; });
        onPendingTakeChange?.(true);
        if (autoSaveAfterStop) {
          setSaving(true);
          void onSave(blob, seconds).then(() => {
            setTake(null); setError(""); onPendingTakeChange?.(false); onRecordingSaved?.();
          }).catch(() => setError("La sauvegarde a échoué. La prise est conservée ici : réessayez."))
            .finally(() => setSaving(false));
        }
      };
      recorder.onerror = () => { setError("L’enregistrement a échoué. Vérifiez les autorisations du micro."); setRecording(false); onRecordingStateChange?.(false); stopStream(); };
      recorderRef.current = recorder; startedAtRef.current = performance.now(); stopRequestedRef.current = false; recorder.start(250); setRecording(true); onRecordingStateChange?.(true);
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      setError(name === "NotAllowedError" ? "Accès au micro refusé. Autorisez le micro dans les réglages du navigateur." : name === "NotFoundError" ? "Aucun micro n’a été détecté." : "Impossible d’accéder au micro. Vérifiez qu’il n’est pas déjà utilisé.");
    }
  }, [autoSaveAfterStop, micDeviceId, onMicrophoneReady, onPendingTakeChange, onRecordingSaved, onRecordingStateChange, onSave, stopStream]);

  const finish = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording" || stopRequestedRef.current) return;
    stopRequestedRef.current = true;
    const context = contextRef.current; const gain = gainRef.current;
    if (context && gain && context.state === "running") {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setTargetAtTime(0, context.currentTime, 0.012);
      window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 45);
    } else recorder.stop();
  }, []);
  const discard = useCallback(() => { setTake(null); setError(""); onPendingTakeChange?.(false); }, [onPendingTakeChange]);
  const saveTake = useCallback(async () => {
    if (!take) return;
    setSaving(true);
    try { await onSave(take.blob, take.duration); setTake(null); setError(""); onPendingTakeChange?.(false); onRecordingSaved?.(); }
    catch { setError("La sauvegarde a échoué. La prise est conservée ici : réessayez."); throw new Error("Enregistrement non sauvegardé"); }
    finally { setSaving(false); }
  }, [onPendingTakeChange, onRecordingSaved, onSave, take]);
  const play = useCallback(async () => { const audio = audioRef.current; if (!audio) return; if (!audio.paused) { audio.pause(); return; } audio.currentTime = 0; await audio.play(); }, []);
  useImperativeHandle(ref, () => ({ start: begin, stop: finish, saveTake, play, discardTake: discard, isRecording: () => recorderRef.current?.state === "recording", hasTake: () => Boolean(take) }), [begin, finish, saveTake, play, discard, take]);

  return <div className="voice-recorder">
    <div className="voice-recorder-heading"><strong>{label}</strong><span>{recording ? <><i className="recording-dot" /> Enregistrement · {formatTime(elapsed)}</> : take ? `Prise prête · ${formatTime(take.duration)}` : path ? `Enregistrée · ${formatTime(duration ?? 0)}` : "Aucune prise"}</span></div>
    {showSourcePicker && <div className="voice-source-picker" role="group" aria-label={`Source vocale pour ${label}`}><span>Source :</span><button type="button" className={source === "ai" ? "active" : ""} disabled={!aiAvailable} onClick={() => onSourceChange("ai")}>Voix IA</button><button type="button" className={source === "recording" ? "active" : ""} disabled={!path} onClick={() => onSourceChange("recording")}>Micro</button></div>}
    <div className="voice-recorder-actions">
      {!recording ? <button type="button" className="recorder-button" disabled={busy || (autoSaveAfterStop && Boolean(take))} onClick={() => void begin()}>{take && autoSaveAfterStop ? "Prise à sauvegarder" : take ? "Recommencer" : path ? "Remplacer" : "Enregistrer au micro"}</button> : <button type="button" className="recorder-button recording" onClick={finish}>Arrêter</button>}
      {take && <><button type="button" className="text-button" disabled={busy || saving} onClick={() => void saveTake().catch(() => undefined)}>{busy || saving ? "Sauvegarde…" : "Utiliser cette prise"}</button><button type="button" className="text-button" disabled={busy || saving} onClick={discard}>Annuler la prise</button></>}
      {path && !take && !recording && <button type="button" className="text-button" disabled={busy} onClick={onDelete}>Supprimer</button>}
    </div>
    {take && <audio ref={audioRef} className="recorder-preview" controls preload="metadata" src={take.url} aria-label={`Écouter la prise ${label}`} />}
    {path && !take && <audio ref={audioRef} className="recorder-preview" controls preload="none" src={`/${path.replace(/^\/+/, "")}`} aria-label={`Écouter l’enregistrement ${label}`} />}
    {recording && <div className="mic-level" role="meter" aria-label="Niveau du microphone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={micLevel}><span style={{ width: `${micLevel}%` }} /></div>}
    {error && <p className="recorder-error" role="alert">{error}</p>}
  </div>;
});
