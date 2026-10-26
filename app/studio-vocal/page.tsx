"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { QuizProject, QuizQuestion, RecordingClip, RecordingTake, VoiceSource } from "@/lib/quiz";
import { VoiceRecorder, type VoiceRecorderHandle } from "../VoiceRecorder";
import "../studio.css";

type NarrationKind = "introduction" | "question" | "answer" | "conclusion";
type VoiceStep = {
  key: string;
  kind: NarrationKind;
  text: string;
  questionId?: string;
  questionNumber?: number;
  path: string | null;
  duration: number | null;
  originalPath: string | null;
  originalDuration: number | null;
  takes: RecordingTake[];
  clips: RecordingClip[];
  source: VoiceSource;
  aiAvailable: boolean;
};

const kindLabels: Record<NarrationKind, string> = {
  introduction: "Introduction",
  question: "Lecture de la question",
  answer: "Réponse (et commentaire)",
  conclusion: "Conclusion",
};

const makeQuestionStep = (question: QuizQuestion, index: number, kind: "question" | "answer", project: QuizProject): VoiceStep => ({
  key: `${question.id}:${kind}`,
  kind,
  text: kind === "question" ? question.prompt : [question.answer, question.answerCommentary].filter((part) => part.trim()).join("\n\n"),
  questionId: question.id,
  questionNumber: index + 1,
  path: question[`${kind}Recording`],
  duration: question[`${kind}RecordingDuration`],
  originalPath: question[`${kind}RecordingOriginal`],
  originalDuration: question[`${kind}RecordingOriginalDuration`],
  takes: question[`${kind}RecordingTakes`],
  clips: question[`${kind}RecordingClips`],
  source: question[`${kind}VoiceSource`],
  aiAvailable: Boolean(question[`${kind}Audio`] && question[`${kind}AudioVoice`] === project.voice && question[`${kind}AudioRate`] === project.speechRate),
});

const buildSteps = (project: QuizProject): VoiceStep[] => {
  const steps: VoiceStep[] = [];
  if (project.introductionText.trim()) steps.push({ key: "introduction", kind: "introduction", text: project.introductionText, path: project.introductionRecording, duration: project.introductionRecordingDuration, originalPath: project.introductionRecordingOriginal, originalDuration: project.introductionRecordingOriginalDuration, takes: project.introductionRecordingTakes, clips: project.introductionRecordingClips, source: project.introductionVoiceSource, aiAvailable: Boolean(project.introductionAudio && project.introductionAudioVoice === project.voice && project.introductionAudioRate === project.speechRate) });
  project.questions.forEach((question, index) => {
    if (question.prompt.trim()) steps.push(makeQuestionStep(question, index, "question", project));
    if (question.answer.trim()) steps.push(makeQuestionStep(question, index, "answer", project));
  });
  if (project.conclusionText.trim()) steps.push({ key: "conclusion", kind: "conclusion", text: project.conclusionText, path: project.conclusionRecording, duration: project.conclusionRecordingDuration, originalPath: project.conclusionRecordingOriginal, originalDuration: project.conclusionRecordingOriginalDuration, takes: project.conclusionRecordingTakes, clips: project.conclusionRecordingClips, source: project.conclusionVoiceSource, aiAvailable: Boolean(project.conclusionAudio && project.conclusionAudioVoice === project.voice && project.conclusionAudioRate === project.speechRate) });
  return steps;
};

const writeStepRecording = (project: QuizProject, step: VoiceStep, path: string, duration: number, originalPath: string, originalDuration: number): QuizProject => {
  const takes = step.takes.length ? step.takes : [{ id: `take-${path.split("/").at(-1)}`, path, duration }];
  const clips = step.takes.length ? step.clips : [{ id: `clip-${path.split("/").at(-1)}`, takeId: takes[0].id, start: 0, end: duration, pauseAfter: 0, transitionMs: 8 }];
  if (step.kind === "introduction") return { ...project, introductionRecording: path, introductionRecordingDuration: duration, introductionRecordingOriginal: originalPath, introductionRecordingOriginalDuration: originalDuration, introductionRecordingTakes: takes, introductionRecordingClips: clips, introductionVoiceSource: "recording" };
  if (step.kind === "conclusion") return { ...project, conclusionRecording: path, conclusionRecordingDuration: duration, conclusionRecordingOriginal: originalPath, conclusionRecordingOriginalDuration: originalDuration, conclusionRecordingTakes: takes, conclusionRecordingClips: clips, conclusionVoiceSource: "recording" };
  const { questionId } = step;
  if (!questionId) return project;
  const recordingField = `${step.kind}Recording` as "questionRecording" | "answerRecording";
  const durationField = `${step.kind}RecordingDuration` as "questionRecordingDuration" | "answerRecordingDuration";
  const sourceField = `${step.kind}VoiceSource` as "questionVoiceSource" | "answerVoiceSource";
  const originalField = `${step.kind}RecordingOriginal` as "questionRecordingOriginal" | "answerRecordingOriginal" | "commentaryRecordingOriginal";
  const originalDurationField = `${step.kind}RecordingOriginalDuration` as "questionRecordingOriginalDuration" | "answerRecordingOriginalDuration" | "commentaryRecordingOriginalDuration";
  const takesField = `${step.kind}RecordingTakes` as "questionRecordingTakes" | "answerRecordingTakes";
  const clipsField = `${step.kind}RecordingClips` as "questionRecordingClips" | "answerRecordingClips";
  return { ...project, questions: project.questions.map((question) => question.id === questionId ? { ...question, [recordingField]: path, [durationField]: duration, [originalField]: originalPath, [originalDurationField]: originalDuration, [takesField]: takes, [clipsField]: clips, [sourceField]: "recording" } : question) };
};

const writeStepMontage = (project: QuizProject, step: VoiceStep, takes: RecordingTake[], clips: RecordingClip[]): QuizProject => {
  if (step.kind === "introduction") return { ...project, introductionRecordingTakes: takes, introductionRecordingClips: clips };
  if (step.kind === "conclusion") return { ...project, conclusionRecordingTakes: takes, conclusionRecordingClips: clips };
  if (!step.questionId) return project;
  const takesField = `${step.kind}RecordingTakes` as "questionRecordingTakes" | "answerRecordingTakes";
  const clipsField = `${step.kind}RecordingClips` as "questionRecordingClips" | "answerRecordingClips";
  return { ...project, questions: project.questions.map((question) => question.id === step.questionId ? { ...question, [takesField]: takes, [clipsField]: clips } : question) };
};

const clearStepRecording = (project: QuizProject, step: VoiceStep): QuizProject => {
  if (step.kind === "introduction") return { ...project, introductionRecording: null, introductionRecordingDuration: null, introductionRecordingOriginal: null, introductionRecordingOriginalDuration: null, introductionRecordingTakes: [], introductionRecordingClips: [], introductionVoiceSource: "ai" };
  if (step.kind === "conclusion") return { ...project, conclusionRecording: null, conclusionRecordingDuration: null, conclusionRecordingOriginal: null, conclusionRecordingOriginalDuration: null, conclusionRecordingTakes: [], conclusionRecordingClips: [], conclusionVoiceSource: "ai" };
  if (!step.questionId) return project;
  const recordingField = `${step.kind}Recording` as "questionRecording" | "answerRecording";
  const durationField = `${step.kind}RecordingDuration` as "questionRecordingDuration" | "answerRecordingDuration";
  const sourceField = `${step.kind}VoiceSource` as "questionVoiceSource" | "answerVoiceSource";
  const originalField = `${step.kind}RecordingOriginal` as "questionRecordingOriginal" | "answerRecordingOriginal" | "commentaryRecordingOriginal";
  const originalDurationField = `${step.kind}RecordingOriginalDuration` as "questionRecordingOriginalDuration" | "answerRecordingOriginalDuration" | "commentaryRecordingOriginalDuration";
  const takesField = `${step.kind}RecordingTakes` as "questionRecordingTakes" | "answerRecordingTakes";
  const clipsField = `${step.kind}RecordingClips` as "questionRecordingClips" | "answerRecordingClips";
  return { ...project, questions: project.questions.map((question) => question.id === step.questionId ? { ...question, [recordingField]: null, [durationField]: null, [originalField]: null, [originalDurationField]: null, [takesField]: [], [clipsField]: [], [sourceField]: "ai" } : question) };
};

const sessionKeyFor = (project: QuizProject) => `atelier-quiz:voice-studio:${encodeURIComponent(project.title)}:${project.questions.map((question) => question.id).join("_")}`;
const isTypingTarget = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export default function VoiceStudioPage() {
  const [project, setProject] = useState<QuizProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pendingTake, setPendingTake] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [micDeviceId, setMicDeviceId] = useState("");
  const recorderRef = useRef<VoiceRecorderHandle>(null);
  const projectRef = useRef<QuizProject | null>(null);
  const stepsRef = useRef<VoiceStep[]>([]);
  const indexRef = useRef(0);
  const pendingUploadRef = useRef<{ blob: Blob; path: string } | null>(null);
  const sessionReadyRef = useRef(false);
  const autoAdvanceRef = useRef(autoAdvance);

  useEffect(() => {
    let canceled = false;
    fetch("/api/project", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Impossible de charger le quiz local.");
      return response.json() as Promise<QuizProject>;
    }).then((saved) => {
      if (!canceled) { projectRef.current = saved; setProject(saved); }
    }).catch((error: unknown) => { if (!canceled) setLoadError(error instanceof Error ? error.message : "Impossible de charger le quiz."); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, []);

  const steps = useMemo(() => project ? buildSteps(project) : [], [project]);
  stepsRef.current = steps;
  indexRef.current = currentIndex;
  const activeStep = steps[currentIndex] ?? null;
  autoAdvanceRef.current = autoAdvance;
  const sessionKey = project ? sessionKeyFor(project) : "";

  useEffect(() => {
    if (!project || sessionReadyRef.current) return;
    try {
      const saved = localStorage.getItem(sessionKey);
      if (saved) {
        const state = JSON.parse(saved) as { index?: number; skipped?: string[]; autoAdvance?: boolean };
        setCurrentIndex(Math.max(0, Math.min(steps.length - 1, Number(state.index) || 0)));
        setSkipped(Array.isArray(state.skipped) ? state.skipped.filter((key) => steps.some((step) => step.key === key)) : []);
        if (typeof state.autoAdvance === "boolean") setAutoAdvance(state.autoAdvance);
      }
    } catch { /* Start at the first narration if local progress is unavailable. */ }
    sessionReadyRef.current = true;
  }, [project, sessionKey, steps]);

  useEffect(() => {
    if (!sessionReadyRef.current || !sessionKey) return;
    try { localStorage.setItem(sessionKey, JSON.stringify({ index: currentIndex, skipped, autoAdvance })); }
    catch { /* The project audio remains safely saved even if browser progress cannot be stored. */ }
  }, [sessionKey, currentIndex, skipped, autoAdvance]);

  const refreshMicrophones = useCallback(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    void navigator.mediaDevices.enumerateDevices().then((devices) => setMicrophones(devices.filter((device) => device.kind === "audioinput"))).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshMicrophones(); navigator.mediaDevices?.addEventListener?.("devicechange", refreshMicrophones);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refreshMicrophones);
  }, [refreshMicrophones]);

  const skipCurrent = useCallback(() => {
    if (starting || recording || saving || pendingTake || !activeStep) return;
    if (!activeStep.path) setSkipped((current) => current.includes(activeStep.key) ? current : [...current, activeStep.key]);
    setCurrentIndex((index) => Math.min(index + 1, stepsRef.current.length - 1));
  }, [activeStep, pendingTake, recording, saving, starting]);

  const saveCurrentStep = useCallback(async (step: VoiceStep, blob: Blob, duration: number, originalBlob?: Blob, originalDuration?: number, isNewTake = false, replaceTakeId?: string) => {
    const currentProject = projectRef.current;
    if (!currentProject) throw new Error("Le quiz n’est pas chargé.");
    if (replaceTakeId && !step.takes.some((take) => take.id === replaceTakeId)) throw new Error("La prise sélectionnée est introuvable ; aucune source n’a été remplacée.");
    setSaving(true); setFeedback("Sauvegarde de la prise…");
    try {
      const uploadRecording = async (recordingBlob: Blob, recordingDuration: number) => {
        const body = new FormData(); body.set("file", new File([recordingBlob], "recording", { type: recordingBlob.type || "audio/webm" })); body.set("duration", String(recordingDuration));
        const response = await fetch("/api/recordings", { method: "POST", body });
        const result = await response.json() as { path?: string; error?: string };
        if (!response.ok || !result.path) throw new Error(result.error || "La prise n’a pas pu être sauvegardée.");
        return result.path;
      };
      let uploadedPath = pendingUploadRef.current?.blob === blob ? pendingUploadRef.current.path : "";
      if (!uploadedPath) {
        uploadedPath = await uploadRecording(blob, duration); pendingUploadRef.current = { blob, path: uploadedPath };
      }
      let stepToWrite = step;
      let preservedPath = step.originalPath;
      let preservedDuration = step.originalDuration ?? step.duration ?? duration;
      if (replaceTakeId && !isNewTake) {
        const takeIndex = step.takes.findIndex((take) => take.id === replaceTakeId);
        if (takeIndex < 0) throw new Error("La prise sélectionnée est introuvable ; aucune source n’a été remplacée.");
        const replacedTake = step.takes[takeIndex];
        const nextTakes = [...step.takes];
        nextTakes[takeIndex] = { ...replacedTake, path: uploadedPath, duration, originalPath: replacedTake.originalPath ?? replacedTake.path, originalDuration: replacedTake.originalDuration ?? replacedTake.duration };
        if (replacedTake.path !== uploadedPath && !nextTakes.some((take, index) => index !== takeIndex && take.path === replacedTake.path)) {
          nextTakes.push({ id: `original-${crypto.randomUUID()}`, path: replacedTake.path, duration: replacedTake.duration });
        }
        const matchingClips = step.clips.filter((clip) => clip.takeId === replaceTakeId);
        const nextClips = step.clips.filter((clip) => clip.takeId !== replaceTakeId);
        const firstClipIndex = step.clips.findIndex((clip) => clip.takeId === replaceTakeId);
        const basis = matchingClips[0];
        const replacementClip: RecordingClip = { id: basis?.id ?? crypto.randomUUID(), takeId: replaceTakeId, start: 0, end: duration, pauseAfter: basis?.pauseAfter ?? 0, transitionMs: basis?.transitionMs ?? 8 };
        nextClips.splice(firstClipIndex < 0 ? nextClips.length : Math.min(firstClipIndex, nextClips.length), 0, replacementClip);
        stepToWrite = { ...step, takes: nextTakes, clips: nextClips };
        preservedPath = step.originalPath ?? replacedTake.path;
        preservedDuration = step.originalDuration ?? replacedTake.duration;
      } else if (isNewTake) {
        preservedPath = originalBlob ? await uploadRecording(originalBlob, originalDuration ?? duration) : uploadedPath;
        preservedDuration = originalBlob ? originalDuration ?? duration : duration;
      } else if (!preservedPath) {
        preservedPath = step.path ?? step.takes[0]?.path ?? uploadedPath;
        preservedDuration = step.path ? step.duration ?? duration : step.takes[0]?.duration ?? duration;
      }
      const updatedProject = writeStepRecording(currentProject, stepToWrite, uploadedPath, duration, preservedPath, preservedDuration);
      const response = await fetch("/api/project", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedProject) });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "La référence de la prise n’a pas pu être enregistrée dans le quiz.");
      projectRef.current = updatedProject; setProject(updatedProject); pendingUploadRef.current = null; setFeedback(replaceTakeId ? `Modifications enregistrées pour ${kindLabels[step.kind]} ; la version précédente reste disponible.` : `Prise enregistrée pour ${kindLabels[step.kind]}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? `${error.message} La prise reste disponible pour réessayer.` : "Sauvegarde impossible. La prise reste disponible pour réessayer.");
      throw error;
    } finally { setSaving(false); }
  }, []);

  const saveTakeToLibrary = useCallback(async (step: VoiceStep, blob: Blob, duration: number) => {
    const currentProject = projectRef.current;
    if (!currentProject) throw new Error("Le quiz n’est pas chargé.");
    setSaving(true); setFeedback("Ajout de la prise à la bibliothèque…");
    try {
      const body = new FormData(); body.set("file", new File([blob], "take", { type: blob.type || "audio/webm" })); body.set("duration", String(duration));
      const response = await fetch("/api/recordings", { method: "POST", body });
      const result = await response.json() as { path?: string; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "La prise n’a pas pu être ajoutée.");
      const take = { id: crypto.randomUUID(), path: result.path, duration };
      const latestStep = buildSteps(currentProject).find((candidate) => candidate.key === step.key) ?? step;
      const updatedProject = writeStepMontage(currentProject, latestStep, [...latestStep.takes, take], latestStep.clips);
      const save = await fetch("/api/project", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedProject) });
      const saved = await save.json().catch(() => null) as { error?: string } | null;
      if (!save.ok) throw new Error(saved?.error || "La prise n’a pas pu être enregistrée dans le projet.");
      projectRef.current = updatedProject; setProject(updatedProject); setFeedback("Prise originale ajoutée à la bibliothèque.");
      return take;
    } finally { setSaving(false); }
  }, []);

  const saveMontageData = useCallback(async (step: VoiceStep, takes: RecordingTake[], clips: RecordingClip[]) => {
    const currentProject = projectRef.current;
    if (!currentProject) throw new Error("Le quiz n’est pas chargé.");
    const latestStep = buildSteps(currentProject).find((candidate) => candidate.key === step.key) ?? step;
    const updatedProject = writeStepMontage(currentProject, latestStep, takes, clips);
    setSaving(true);
    try {
      const response = await fetch("/api/project", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedProject) });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Le montage n’a pas pu être sauvegardé.");
      projectRef.current = updatedProject; setProject(updatedProject);
    } finally { setSaving(false); }
  }, []);

  const deleteStepRecording = async (step: VoiceStep) => {
    if (!step.path || !window.confirm("Supprimer définitivement cet enregistrement ?")) return;
    const currentProject = projectRef.current;
    if (!currentProject) return;
    setSaving(true); setFeedback("Suppression de la prise…");
    try {
      const updatedProject = clearStepRecording(currentProject, step);
      const response = await fetch("/api/project", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedProject) });
      if (!response.ok) throw new Error("La suppression n’a pas pu être enregistrée dans le quiz.");
      projectRef.current = updatedProject; setProject(updatedProject); setFeedback("Enregistrement supprimé.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Suppression impossible."); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || (event.target instanceof HTMLElement && event.target.closest(".voice-audio-editor")) || !activeStep || event.repeat || starting) return;
      const recorder = recorderRef.current;
      const isRecordingNow = recorder?.isRecording() ?? false;
      if (event.code === "Space") {
        event.preventDefault();
        if (isRecordingNow) recorder?.stop(); else if (!saving && !pendingTake) void recorder?.start();
      } else if (event.key === "Enter") {
        if (isRecordingNow) { event.preventDefault(); recorder?.stop(); }
        else if (recorder?.hasTake() && !saving) { event.preventDefault(); void recorder.saveTake().catch(() => undefined); }
        else if (!saving) { event.preventDefault(); setCurrentIndex((index) => Math.min(index + 1, stepsRef.current.length - 1)); }
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault(); if (!isRecordingNow && !saving && !pendingTake) { recorder?.discardTake(); void recorder?.start(); }
      } else if (event.key.toLowerCase() === "p") {
        event.preventDefault(); void recorder?.play().catch(() => undefined);
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault(); skipCurrent();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault(); if (!isRecordingNow && !saving && !pendingTake) setCurrentIndex((index) => Math.max(0, index - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault(); if (!isRecordingNow && !saving && !pendingTake) setCurrentIndex((index) => Math.min(index + 1, stepsRef.current.length - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeStep, pendingTake, saving, skipCurrent, starting]);

  useEffect(() => {
    const warnIfRecording = (event: BeforeUnloadEvent) => {
      if (starting || recorderRef.current?.isRecording() || recorderRef.current?.hasTake() || pendingTake) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warnIfRecording);
    return () => window.removeEventListener("beforeunload", warnIfRecording);
  }, [pendingTake, starting]);

  const recordedCount = steps.filter((step) => Boolean(step.path)).length;
  const skippedCount = skipped.filter((key) => steps.some((step) => step.key === key && !step.path)).length;
  const remainingCount = Math.max(0, steps.length - recordedCount - skippedCount);
  const progress = steps.length ? Math.round(((recordedCount + skippedCount) / steps.length) * 100) : 0;
  const statusOf = (step: VoiceStep, index: number) => index === currentIndex && starting
    ? "Démarrage…" : index === currentIndex && (recording || saving) ? "En cours" : index === currentIndex && pendingTake ? "À sauvegarder" : step.path ? "Enregistré" : skipped.includes(step.key) ? "Ignoré" : "À enregistrer";

  return <div className="studio-shell voice-studio-shell">
    <aside className="sidebar">
      <Link href="/" className="sidebar-brand"><span className="brand-glyph" aria-hidden="true">AQ</span><span><strong>L’Atelier Quiz</strong><small>STUDIO LOCAL</small></span></Link>
      <div className="sidebar-label">ENREGISTREMENT</div>
      <nav className="side-nav" aria-label="Navigation du studio vocal">
        <a className="voice-studio-nav-active" href="/studio-vocal"><span aria-hidden="true">🎙</span> Studio vocal</a>
        <Link href="/" className="voice-studio-back">← Retour à l’éditeur</Link>
      </nav>
      <div className="sidebar-spacer" />
      <div className="local-card"><span className="local-led" /><strong>Projet sur ce PC</strong><small>Les prises sont ajoutées aux narrations existantes du quiz et réutilisées dans Remotion.</small></div>
      <div className="sidebar-version">STUDIO VOCAL · SAUVEGARDE LOCALE</div>
    </aside>

    <main className="studio-main voice-studio-main">
      <header className="topbar"><div className="breadcrumb"><span>ATELIER</span><i>/</i> Studio vocal</div><div className={`save-indicator ${saving ? "save-saving" : "save-saved"}`}><span />{saving ? "Sauvegarde de la prise…" : "Quiz sauvegardé sur ce PC"}</div></header>
      <div className="workspace voice-studio-workspace">
        <div className="page-heading voice-studio-heading"><div><div className="kicker"><span /> ENREGISTREMENT EN SÉRIE</div><h1>Studio vocal</h1><p>Enregistrez les narrations du quiz dans l’ordre exact de la vidéo, presque sans toucher à la souris.</p></div>
          {project && <label className="voice-quiz-picker"><span>QUIZ ACTIF</span><select value={project.title} onChange={() => undefined} aria-label="Choisir le quiz"><option value={project.title}>{project.title}</option></select><small>Le projet local actif est sélectionné.</small></label>}
        </div>

        {loading && <div className="preview-loading">Chargement du quiz…</div>}
        {loadError && <div className="feedback" role="alert">{loadError}</div>}
        {project && <>
          <section className="voice-progress-panel">
            <div className="voice-progress-top"><div><strong>{project.title}</strong><span>{steps.length ? currentIndex + 1 : 0} / {steps.length} étapes</span></div><label className="voice-auto-toggle"><input type="checkbox" checked={autoAdvance} onChange={(event) => setAutoAdvance(event.target.checked)} /> Avancer automatiquement après sauvegarde</label></div>
            <div className="voice-progress-stats"><span><b>{recordedCount}</b> enregistrés</span><span><b>{remainingCount}</b> restants</span><span><b>{skippedCount}</b> ignorés</span><span><b>{steps.length}</b> narrations</span></div>
            <div className="voice-progress-track"><span style={{ width: `${progress}%` }} /></div>
          </section>

          {feedback && <div className="feedback" role="status"><span>i</span>{feedback}</div>}
          {steps.length === 0 ? <section className="voice-main-card"><h2>Aucun texte à enregistrer</h2><p>Ajoutez un texte d’introduction, des questions, des réponses ou un texte de conclusion dans l’éditeur.</p></section> : activeStep && <div className="voice-studio-grid">
            <div className="voice-main-column">
              <div className="voice-neighbor-card"><small>PRÉCÉDENT</small><span>{steps[currentIndex - 1] ? `${kindLabels[steps[currentIndex - 1].kind]} · ${steps[currentIndex - 1].text}` : "Début du quiz"}</span></div>
              <section className="voice-main-card" aria-live="polite">
                <div className="voice-current-meta"><span className="voice-question-number">{activeStep.questionNumber ? `QUESTION ${activeStep.questionNumber} / ${project.questions.length}` : activeStep.kind === "introduction" ? "INTRODUCTION" : "CONCLUSION"}</span><span className="voice-current-status">{statusOf(activeStep, currentIndex)}</span></div>
                <p className="voice-kind-label">Type : {kindLabels[activeStep.kind]}</p>
                <div className="voice-reading-text">{activeStep.text}</div>
                <VoiceRecorder
                  key={activeStep.key}
                  ref={recorderRef}
                  label={kindLabels[activeStep.kind]}
                  path={activeStep.path}
                  duration={activeStep.duration}
                  originalPath={activeStep.originalPath}
                  recordingTakes={activeStep.takes}
                  recordingClips={activeStep.clips}
                  source={activeStep.source}
                  aiAvailable={activeStep.aiAvailable}
                  onSourceChange={() => undefined}
                  showSourcePicker={false}
                  micDeviceId={micDeviceId}
                  onMicrophoneReady={refreshMicrophones}
                  onRecordingStateChange={setRecording}
                  onRecordingStartPendingChange={setStarting}
                  onPendingTakeChange={setPendingTake}
                  busy={saving}
                  onRecordingSaved={() => { if (autoAdvanceRef.current) setCurrentIndex((index) => Math.min(index + 1, stepsRef.current.length - 1)); }}
                  onSave={(blob, duration, originalBlob, originalDuration, isNewTake, replaceTakeId) => saveCurrentStep(activeStep, blob, duration, originalBlob, originalDuration, isNewTake, replaceTakeId)}
                  onAddTake={(blob, duration) => saveTakeToLibrary(activeStep, blob, duration)}
                  onUpdateMontage={(takes, clips) => saveMontageData(activeStep, takes, clips)}
                  onDelete={() => void deleteStepRecording(activeStep)}
                />
              <div className="voice-step-actions"><button className="button-outline" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0 || starting || saving || recording || pendingTake}>← Précédent</button><button className="button-outline" onClick={skipCurrent} disabled={starting || saving || recording || pendingTake}>Passer sans enregistrer · S</button><button className="button-gold" onClick={() => setCurrentIndex((index) => Math.min(index + 1, steps.length - 1))} disabled={currentIndex >= steps.length - 1 || starting || saving || recording || pendingTake}>Suivant →</button></div>
              </section>
              <div className="voice-neighbor-card voice-next-card"><small>SUIVANT</small><span>{steps[currentIndex + 1] ? `${kindLabels[steps[currentIndex + 1].kind]} · ${steps[currentIndex + 1].text}` : "Fin du quiz"}</span></div>
            </div>

            <aside className="voice-studio-aside">
              <section className="voice-shortcuts-panel"><h2>Raccourcis clavier</h2><div><kbd>Espace</kbd><span>Démarrer / arrêter la prise</span></div><div><kbd>Entrée</kbd><span>Valider la prise et avancer</span></div><div><kbd>R</kbd><span>Réanregistrer le texte en cours</span></div><div><kbd>P</kbd><span>Écouter la prise active</span></div><div><kbd>S</kbd><span>Passer sans enregistrer</span></div><div><kbd>←</kbd><span>Revenir au texte précédent</span></div><div><kbd>→</kbd><span>Passer au texte suivant</span></div><p>Les raccourcis sont suspendus lorsque vous écrivez dans un champ.</p></section>
              <section className="voice-mic-panel"><h2>Microphone</h2><label><span>Entrée audio</span><select value={micDeviceId} disabled={starting || recording || saving} onChange={(event) => setMicDeviceId(event.target.value)}><option value="">Microphone par défaut</option>{microphones.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label><small>Réduction de bruit, contrôle du gain, compression légère et fondus courts à la prise.</small></section>
              <section className="voice-steps-panel"><h2>Étapes du quiz <span>{steps.length}</span></h2><div className="voice-steps-list">{steps.map((step, index) => <button key={step.key} className={index === currentIndex ? "active" : ""} onClick={() => { if (!starting && !recording && !saving && !pendingTake) setCurrentIndex(index); }} disabled={starting || recording || saving || pendingTake}><span className="voice-step-index">{step.questionNumber ? String(step.questionNumber).padStart(2, "0") : step.kind === "introduction" ? "IN" : "FN"}</span><span className="voice-step-copy"><strong>{kindLabels[step.kind]}</strong><small>{step.text}</small></span><em className={`voice-step-status ${statusOf(step, index) === "Enregistré" ? "done" : statusOf(step, index) === "Ignoré" ? "skipped" : statusOf(step, index) === "En cours" ? "current" : ""}`}>{statusOf(step, index)}</em></button>)}</div></section>
            </aside>
          </div>}
        </>}
      </div>
    </main>
  </div>;
}
