"use client";

import { Player, type PlayerRef } from "@remotion/player";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  answerDisplayFrames,
  CONCLUSION_VOICE_DELAY_FRAMES,
  conclusionDurationFrames,
  conclusionNarration,
  defaultProject,
  ENDING_PAUSE_FRAMES,
  introductionDurationFrames,
  introductionNarration,
  INTRODUCTION_QUESTION_GAP_FRAMES,
  FPS,
  MAX_INTRODUCTION_SECONDS,
  MAX_CONCLUSION_SECONDS,
  MIN_INTRODUCTION_SECONDS,
  MIN_CONCLUSION_SECONDS,
  isVoiceId,
  isQuestionReadyForRender,
  questionDurationFrames,
  narrationAudio,
  questionVideoDuration,
  transitionFramesAfter,
  type QuizProject,
  type IntroductionLayerId,
  type IntroductionLayers,
  type QuizQuestion,
  type VoiceId,
} from "@/lib/quiz";
import { QuizVideo } from "@/remotion/QuizVideo";
import { ConclusionEditor, type ConclusionImageId } from "./ConclusionEditor";
import { IntroductionEditor } from "./IntroductionEditor";
import { VoiceRecorder } from "./VoiceRecorder";
import { StudioSidebar } from "./StudioSidebar";
import "./studio.css";

type RenderStatus = {
  id: string;
  stage: "queued" | "preparing" | "rendering" | "completed" | "failed";
  progress: number;
  message: string;
  error?: string;
  downloadUrl?: string;
};

type GeneratedVoice = { audio: string; duration: number; cached: boolean };
type LocalFileHandle = { createWritable: () => Promise<WritableStream<Uint8Array>> };
type LocalSaveWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<LocalFileHandle>;
};

const VOICES: { id: VoiceId; label: string; gender: string }[] = [
  { id: "fr_FR-siwis-medium", label: "SIWIS", gender: "Féminine · locale" },
  { id: "fr_FR-upmc-medium", label: "UPMC", gender: "Masculine · locale" },
  { id: "fr_FR-tom-medium", label: "TOM", gender: "Masculine · medium" },
  { id: "fr_FR-mls-medium", label: "MLS", gender: "Voix française · medium" },
];

const assetUrl = (path: string | null) => path ? `/${path.replace(/^\/+/, "")}` : null;

function Slider({ label, value, min, max, unit, onChange }: {
  label: string; value: number; min: number; max: number; unit: string; onChange: (next: number) => void;
}) {
  return (
    <label className="slider-field">
      <span>{label}<strong>{value}{unit}</strong></span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
export default function Home() {
  const [project, setProject] = useState<QuizProject>(defaultProject);
  const [projectId, setProjectId] = useState("principal");
  const [projectOptions, setProjectOptions] = useState<{ id: string; title: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [feedback, setFeedback] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState("");
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [renderStarting, setRenderStarting] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<number | "all" | "conclusion">("all");
  const [mediaBusy, setMediaBusy] = useState("");
  const [countdownPreviewPlaying, setCountdownPreviewPlaying] = useState(false);
  const [introductionMusicPreviewPlaying, setIntroductionMusicPreviewPlaying] = useState(false);
  const [conclusionMusicPreviewPlaying, setConclusionMusicPreviewPlaying] = useState(false);
  const [answerSoundPreviewPlaying, setAnswerSoundPreviewPlaying] = useState(false);
  const [specialSceneSoundPreviewPlaying, setSpecialSceneSoundPreviewPlaying] = useState(false);
  const playerRef = useRef<PlayerRef>(null);
  const countdownAudioRef = useRef<HTMLAudioElement>(null);
  const introductionMusicAudioRef = useRef<HTMLAudioElement>(null);
  const conclusionMusicAudioRef = useRef<HTMLAudioElement>(null);
  const answerSoundAudioRef = useRef<HTMLAudioElement>(null);
  const specialSceneSoundAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") || "principal";
    setProjectId(id);
    let canceled = false;
    fetch(`/api/project?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossible de lire le projet local.");
        return response.json() as Promise<QuizProject>;
      })
      .then((saved) => {
        if (!canceled) { setProject(saved); setLoaded(true); setSaveState("saved"); }
      })
      .catch(() => {
        if (!canceled) { setLoaded(true); setSaveState("error"); setFeedback("Le projet local n’a pas pu être chargé."); }
      });
    return () => { canceled = true; };
  }, []);

  useEffect(() => { fetch("/api/projects", { cache: "no-store" }).then((r) => r.json()).then((rows) => setProjectOptions(rows)).catch(() => undefined); }, []);

  useEffect(() => {
    let canceled = false;
    fetch("/api/render", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<RenderStatus | null> : null)
      .then((job) => { if (!canceled && job?.id) setRenderStatus(job); })
      .catch(() => undefined);
    return () => { canceled = true; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/project?id=${encodeURIComponent(projectId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(project) });
        if (!response.ok) throw new Error("Sauvegarde impossible.");
        setSaveState("saved");
      } catch { setSaveState("error"); }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [loaded, project, projectId]);

  useEffect(() => {
    if (countdownAudioRef.current) countdownAudioRef.current.volume = project.countdownSoundVolume / 100;
  }, [project.countdownSoundVolume]);

  useEffect(() => {
    if (introductionMusicAudioRef.current) introductionMusicAudioRef.current.volume = project.introductionMusicVolume / 100;
  }, [project.introductionMusicVolume]);

  useEffect(() => {
    if (conclusionMusicAudioRef.current) conclusionMusicAudioRef.current.volume = project.conclusionMusicVolume / 100;
  }, [project.conclusionMusicVolume]);

  useEffect(() => {
    if (answerSoundAudioRef.current) answerSoundAudioRef.current.volume = project.answerSoundVolume / 100;
  }, [project.answerSoundVolume]);

  useEffect(() => {
    if (specialSceneSoundAudioRef.current) specialSceneSoundAudioRef.current.volume = project.introductionDelayedScene.transition.soundVolume / 100;
  }, [project.introductionDelayedScene.transition.soundVolume]);

  useEffect(() => {
    const audio = countdownAudioRef.current;
    audio?.pause();
    if (audio) audio.currentTime = 0;
    setCountdownPreviewPlaying(false);
  }, [project.countdownSound]);

  useEffect(() => {
    const audio = conclusionMusicAudioRef.current;
    audio?.pause();
    if (audio) audio.currentTime = 0;
    setConclusionMusicPreviewPlaying(false);
  }, [project.conclusionMusic]);

  useEffect(() => {
    const audio = introductionMusicAudioRef.current;
    audio?.pause();
    if (audio) audio.currentTime = 0;
    setIntroductionMusicPreviewPlaying(false);
  }, [project.introductionMusic]);

  useEffect(() => {
    const audio = answerSoundAudioRef.current;
    audio?.pause();
    if (audio) audio.currentTime = 0;
    setAnswerSoundPreviewPlaying(false);
  }, [project.answerSound]);

  useEffect(() => {
    const audio = specialSceneSoundAudioRef.current;
    audio?.pause();
    if (audio) audio.currentTime = 0;
    setSpecialSceneSoundPreviewPlaying(false);
  }, [project.introductionDelayedScene.sound]);

  useEffect(() => {
    const id = renderStatus?.id;
    if (!id || renderStatus.stage === "completed" || renderStatus.stage === "failed") return;
    let stopped = false;
    let timer = 0;
    const poll = async () => {
      try {
        const response = await fetch(`/api/render/${id}`, { cache: "no-store" });
        const status = await response.json() as RenderStatus;
        if (!stopped && response.ok) {
          setRenderStatus(status);
          if (status.stage !== "completed" && status.stage !== "failed") timer = window.setTimeout(poll, 700);
        }
      } catch { if (!stopped) timer = window.setTimeout(poll, 1500); }
    };
    timer = window.setTimeout(poll, 400);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [renderStatus?.id, renderStatus?.stage]);

  useEffect(() => {
    if (!loaded || previewQuestion === "all") return;
    if (previewQuestion === "conclusion") {
      const questions = project.questions.filter((question) => question.enabled !== false);
      const conclusionStart = questionVideoDuration(
        questions,
        introductionDurationFrames(project),
        conclusionDurationFrames(project) > 0 ? ENDING_PAUSE_FRAMES : 0,
        project.voice,
        project.speechRate,
      );
      playerRef.current?.seekTo(conclusionStart);
      return;
    }
    playerRef.current?.seekTo(Math.round(project.introductionDurationSeconds * FPS) + INTRODUCTION_QUESTION_GAP_FRAMES);
  }, [loaded, previewQuestion, project]);

  const updateProject = useCallback((patch: Partial<QuizProject>) => {
    setProject((current) => ({ ...current, ...patch }));
  }, []);

  const updateQuestion = useCallback((index: number, patch: Partial<QuizQuestion>) => {
    setProject((current) => ({ ...current, questions: current.questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question) }));
  }, []);

  const uploadImage = useCallback(async (file: File, onPath: (path: string) => void, busyKey: string) => {
    setMediaBusy(busyKey); setFeedback("");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/media", { method: "POST", body });
      const result = await response.json() as { path?: string; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Import impossible.");
      onPath(result.path); setFeedback(`${file.name} importé sans modification.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Import impossible."); }
    finally { setMediaBusy(""); }
  }, []);

  const saveRecording = useCallback(async (blob: Blob, duration: number, onSaved: (path: string, duration: number, originalPath: string | null, originalDuration: number) => void, originalBlob?: Blob, originalDuration?: number, isNewTake = false) => {
    setMediaBusy("voice-recording"); setFeedback("");
    try {
      const upload = async (audioBlob: Blob, seconds: number) => {
        const body = new FormData();
        body.set("file", new File([audioBlob], "recording", { type: audioBlob.type || "audio/webm" }));
        body.set("duration", String(seconds));
        const response = await fetch("/api/recordings", { method: "POST", body });
        const result = await response.json() as { path?: string; error?: string };
        if (!response.ok || !result.path) throw new Error(result.error || "La prise n’a pas pu être sauvegardée.");
        return result.path;
      };
      const savedPath = await upload(blob, duration);
      const savedOriginal = originalBlob ? await upload(originalBlob, originalDuration ?? duration) : isNewTake ? savedPath : null;
      onSaved(savedPath, duration, savedOriginal, originalBlob ? originalDuration ?? duration : duration); setFeedback(`Enregistrement conservé (${duration.toFixed(1)} s).`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "La prise n’a pas pu être sauvegardée."); throw error; }
    finally { setMediaBusy(""); }
  }, []);

  const uploadIntroductionLayer = (id: IntroductionLayerId, file: File) => {
    void uploadImage(file, (image) => setProject((current) => ({
      ...current,
      introductionLayers: { ...current.introductionLayers, [id]: { ...current.introductionLayers[id], image } },
    })), `introduction-layer-${id}`);
  };

  const updateIntroductionLayers = (introductionLayers: IntroductionLayers) => updateProject({ introductionLayers });
  const uploadDelayedIntroductionLayer = (id: IntroductionLayerId, file: File) => {
    if (id !== "logo" && id !== "questionsPanel") return;
    void uploadImage(file, (image) => updateProject({
      introductionDelayedScene: {
        ...project.introductionDelayedScene,
        [id]: { ...project.introductionDelayedScene[id], image },
      },
    }), `introduction-delayed-layer-${id}`);
  };
  const uploadDelayedSceneSound = async (file: File) => {
    setMediaBusy("introduction-delayed-sound"); setFeedback("");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/music", { method: "POST", body });
      const result = await response.json() as { path?: string; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Import du son de la scène spéciale impossible.");
      setProject((current) => ({ ...current, introductionDelayedScene: { ...current.introductionDelayedScene, sound: result.path! } }));
      setFeedback(`${file.name} ajouté aux éléments de la scène spéciale.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Import du son de la scène spéciale impossible."); }
    finally { setMediaBusy(""); }
  };

  const uploadMusic = useCallback(async (file: File) => {
    setMediaBusy("background-music"); setFeedback("");
    try {
      const body = new FormData(); body.set("file", file); body.set("loopable", "true");
      const response = await fetch("/api/music", { method: "POST", body });
      const result = await response.json() as { path?: string; trimmed?: boolean; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Import de la musique impossible.");
      updateProject({ backgroundMusic: result.path });
      setFeedback(`${file.name} ajouté comme musique de fond globale.${result.trimmed ? " Le silence final a été retiré pour raccourcir la boucle." : ""}`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Import de la musique impossible."); }
    finally { setMediaBusy(""); }
  }, [updateProject]);

  const uploadCountdownSound = useCallback(async (file: File) => {
    setMediaBusy("countdown-sound"); setFeedback("");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/music", { method: "POST", body });
      const result = await response.json() as { path?: string; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Import du son de compte à rebours impossible.");
      updateProject({ countdownSound: result.path });
      setFeedback(`${file.name} ajouté au compte à rebours.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Import du son de compte à rebours impossible."); }
    finally { setMediaBusy(""); }
  }, [updateProject]);

  const uploadConclusionMusic = useCallback(async (file: File) => {
    setMediaBusy("conclusion-music"); setFeedback("");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/music", { method: "POST", body });
      const result = await response.json() as { path?: string; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Import de la musique de conclusion impossible.");
      updateProject({ conclusionMusic: result.path });
      setFeedback(`${file.name} ajoutée pour la conclusion.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Import de la musique de conclusion impossible."); }
    finally { setMediaBusy(""); }
  }, [updateProject]);

  const uploadIntroductionMusic = useCallback(async (file: File) => {
    setMediaBusy("introduction-music"); setFeedback("");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/music", { method: "POST", body });
      const result = await response.json() as { path?: string; duration?: number | null; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Import de la musique d’introduction impossible.");
      updateProject({ introductionMusic: result.path, introductionMusicDuration: result.duration ?? null });
      setFeedback(`${file.name} ajoutée pour l’introduction.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Import de la musique d’introduction impossible."); }
    finally { setMediaBusy(""); }
  }, [updateProject]);

  const uploadAnswerSound = useCallback(async (file: File) => {
    setMediaBusy("answer-sound"); setFeedback("");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/music", { method: "POST", body });
      const result = await response.json() as { path?: string; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Import du son des bonnes réponses impossible.");
      updateProject({ answerSound: result.path });
      setFeedback(`${file.name} ajouté à l’affichage des bonnes réponses.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Import du son des bonnes réponses impossible."); }
    finally { setMediaBusy(""); }
  }, [updateProject]);

  const previewCountdownSound = async () => {
    const audio = countdownAudioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }
    audio.volume = project.countdownSoundVolume / 100;
    audio.currentTime = 0;
    try { await audio.play(); }
    catch { setFeedback("Le son de compte à rebours n’a pas pu être lu."); }
  };

  const updateCountdownVolume = (countdownSoundVolume: number) => {
    if (countdownAudioRef.current) countdownAudioRef.current.volume = countdownSoundVolume / 100;
    updateProject({ countdownSoundVolume });
  };

  const previewConclusionMusic = async () => {
    const audio = conclusionMusicAudioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); audio.currentTime = 0; return; }
    audio.volume = project.conclusionMusicVolume / 100;
    audio.currentTime = 0;
    try { await audio.play(); }
    catch { setFeedback("La musique de conclusion n’a pas pu être lue."); }
  };

  const updateConclusionMusicVolume = (conclusionMusicVolume: number) => {
    if (conclusionMusicAudioRef.current) conclusionMusicAudioRef.current.volume = conclusionMusicVolume / 100;
    updateProject({ conclusionMusicVolume });
  };

  const previewIntroductionMusic = async () => {
    const audio = introductionMusicAudioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); audio.currentTime = 0; return; }
    audio.volume = project.introductionMusicVolume / 100;
    audio.currentTime = 0;
    try { await audio.play(); }
    catch { setFeedback("La musique d’introduction n’a pas pu être lue."); }
  };

  const previewSpecialSceneSound = async () => {
    const audio = specialSceneSoundAudioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); audio.currentTime = 0; return; }
    audio.volume = project.introductionDelayedScene.transition.soundVolume / 100;
    audio.currentTime = 0;
    try { await audio.play(); }
    catch { setFeedback("Le son de la scène spéciale n’a pas pu être lu."); }
  };

  const updateIntroductionMusicVolume = (introductionMusicVolume: number) => {
    if (introductionMusicAudioRef.current) introductionMusicAudioRef.current.volume = introductionMusicVolume / 100;
    updateProject({ introductionMusicVolume });
  };

  const previewAnswerSound = async () => {
    const audio = answerSoundAudioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); audio.currentTime = 0; return; }
    audio.volume = project.answerSoundVolume / 100;
    audio.currentTime = 0;
    try { await audio.play(); }
    catch { setFeedback("Le son des bonnes réponses n’a pas pu être lu."); }
  };

  const updateAnswerSoundVolume = (answerSoundVolume: number) => {
    if (answerSoundAudioRef.current) answerSoundAudioRef.current.volume = answerSoundVolume / 100;
    updateProject({ answerSoundVolume });
  };

  const generateVoice = useCallback(async (index: number, part: "question" | "answer") => {
    const question = project.questions[index];
    const text = part === "question" ? question.prompt : [question.answer, question.answerCommentary].filter((value) => value.trim()).join(". ");
    if (!text.trim()) throw new Error(`Ajoutez d’abord ${part === "question" ? "la question" : "la réponse"} ${index + 1}.`);
    const response = await fetch("/api/voice", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: project.voice, rate: project.speechRate }),
    });
    const result = await response.json() as GeneratedVoice & { error?: string };
    if (!response.ok) throw new Error(result.error || "La voix n’a pas pu être générée.");
    if (part === "question") {
      updateQuestion(index, { questionAudio: result.audio, questionAudioVoice: project.voice, questionAudioRate: project.speechRate, questionAudioDuration: result.duration });
    } else if (part === "answer") {
      updateQuestion(index, { answerAudio: result.audio, answerAudioVoice: project.voice, answerAudioRate: project.speechRate, answerAudioDuration: result.duration });
    }
    return result;
  }, [project, updateQuestion]);

  const synthesizeIntroduction = useCallback(async () => {
    const text = project.introductionText.trim();
    if (!text) throw new Error("Écrivez d’abord le texte d’introduction.");
    const response = await fetch("/api/voice", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: project.voice, rate: project.speechRate }),
    });
    const result = await response.json() as GeneratedVoice & { error?: string };
    if (!response.ok) throw new Error(result.error || "La voix de l’introduction n’a pas pu être générée.");
    updateProject({ introductionAudio: result.audio, introductionAudioDuration: result.duration, introductionAudioVoice: project.voice, introductionAudioRate: project.speechRate });
    return result;
  }, [project.introductionText, project.speechRate, project.voice, updateProject]);

  const synthesizeConclusion = useCallback(async () => {
    const text = project.conclusionText.trim();
    if (!text) throw new Error("Écrivez d’abord le texte de conclusion.");
    const response = await fetch("/api/voice", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: project.voice, rate: project.speechRate }),
    });
    const result = await response.json() as GeneratedVoice & { error?: string };
    if (!response.ok) throw new Error(result.error || "La voix de la conclusion n’a pas pu être générée.");
    updateProject({ conclusionAudio: result.audio, conclusionAudioDuration: result.duration, conclusionAudioVoice: project.voice, conclusionAudioRate: project.speechRate });
    return result;
  }, [project.conclusionText, project.speechRate, project.voice, updateProject]);

  const generateIntroductionVoice = async () => {
    setVoiceBusy(true); setFeedback("");
    try {
      const result = await synthesizeIntroduction();
      setFeedback(`La narration d’introduction est prête (${result.duration.toFixed(1)} s).`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "La voix de l’introduction n’a pas pu être générée."); }
    finally { setVoiceBusy(false); }
  };

  const generateConclusionVoice = async () => {
    setVoiceBusy(true); setFeedback("");
    try {
      const result = await synthesizeConclusion();
      setFeedback(`La narration de conclusion est prête (${result.duration.toFixed(1)} s).`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "La voix de conclusion n’a pas pu être générée."); }
    finally { setVoiceBusy(false); }
  };

  const generateAllVoices = async () => {
    const activeQuestions = project.questions.filter((question) => question.enabled !== false);
    setVoiceBusy(true); setFeedback(""); let complete = 0;
    const total = activeQuestions.reduce((sum, question) => sum + Number(Boolean(question.prompt.trim() && !question.questionRecording)) + Number(Boolean(question.answer.trim() && !question.answerRecording)), Number(Boolean(project.introductionText.trim() && !project.introductionRecording)) + Number(Boolean(project.conclusionText.trim() && !project.conclusionRecording)));
    try {
      if (project.introductionText.trim() && !project.introductionRecording) {
        setVoiceProgress(`Voix ${complete + 1} sur ${total} · introduction`);
        await synthesizeIntroduction(); complete += 1;
      }
      for (let index = 0; index < project.questions.length; index += 1) {
        if (project.questions[index].enabled === false) continue;
        const parts: Array<"question" | "answer"> = [];
        if (!project.questions[index].questionRecording) parts.push("question");
        if (!project.questions[index].answerRecording) parts.push("answer");
        for (const part of parts) {
          setVoiceProgress(`Voix ${complete + 1} sur ${total} · question ${index + 1}`);
          await generateVoice(index, part); complete += 1;
        }
      }
      if (project.conclusionText.trim() && !project.conclusionRecording) {
        setVoiceProgress(`Voix ${complete + 1} sur ${total} · conclusion`);
        await synthesizeConclusion(); complete += 1;
      }
      setFeedback(`Les ${complete} narrations sont prêtes et conservées localement.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Une narration n’a pas pu être générée."); }
    finally { setVoiceBusy(false); setVoiceProgress(""); }
  };

  const startRender = async (scope: "all" | "question", index = 0) => {
    const selected = scope === "all" ? activeQuestions : [activeQuestions[index]];
    if (!activeQuestions.length) { setFeedback("Activez au moins une question dans la bibliotheque."); return; }
    if (selected.some((question) => !isQuestionReadyForRender(question))) { setFeedback(scope === "all" ? "Complétez toutes les questions et leurs réponses avant l’export." : `Complétez la question ${index + 1} et sa réponse avant l’export.`); return; }
    if (!introVoiceReady) { setFeedback("Choisissez une voix disponible pour l’introduction, ou enregistrez-la."); navigate("introduction"); return; }
    const conclusionVoiceReady = !project.conclusionText.trim() || Boolean(conclusionNarration(project));
    if (scope === "all" && !conclusionVoiceReady) { setFeedback("Enregistrez la narration ou générez la voix IA de conclusion."); navigate("conclusion"); return; }
    const audioReady = selected.every((question) => narrationAudio(question, "question", project.voice, project.speechRate) && narrationAudio(question, "answer", project.voice, project.speechRate));
    if (!audioReady) { setFeedback("Générez les voix manquantes avec la voix sélectionnée."); navigate("voix"); return; }
    setRenderStarting(true); setRenderStatus(null); setFeedback("");
    try {
      const response = await fetch("/api/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, projectId, scope, questionIndex: index }) });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Le rendu n’a pas pu démarrer.");
      setRenderStatus({ id: result.id, stage: "queued", progress: 0, message: "En attente" });
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Le rendu n’a pas pu démarrer."); }
    finally { setRenderStarting(false); }
  };

  const saveRenderedVideo = async () => {
    if (!renderStatus?.downloadUrl) return;
    try {
      const response = await fetch(renderStatus.downloadUrl);
      if (!response.ok || !response.body) throw new Error("Le fichier vidéo local est introuvable.");
      const win = window as LocalSaveWindow;
      if (win.showSaveFilePicker) {
        const handle = await win.showSaveFilePicker({ suggestedName: "atelier-quiz.mp4", types: [{ description: "Vidéo MP4", accept: { "video/mp4": [".mp4"] } }] });
        const writable = await handle.createWritable(); await response.body.pipeTo(writable);
      } else {
        const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = objectUrl; link.download = "atelier-quiz.mp4"; link.click(); URL.revokeObjectURL(objectUrl);
      }
      setFeedback("La vidéo MP4 a été enregistrée à l’emplacement choisi. Une copie reste dans data/exports.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback(error instanceof Error ? error.message : "Enregistrement du MP4 impossible.");
    }
  };

  const navigate = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const createNewQuiz = async () => {
    const title = window.prompt("Nom du nouveau quiz", "Mon nouveau quiz");
    if (!title?.trim()) return;
    const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, title: title.trim() }) });
    const created = await response.json() as { id?: string; error?: string };
    if (!response.ok || !created.id) { setFeedback(created.error || "Création du quiz impossible."); return; }
    window.location.assign(`/?id=${encodeURIComponent(created.id)}`);
  };
  const exportCompleteArchive = async () => {
    setArchiveBusy(true);
    try {
      const response = await fetch("/api/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project }) });
      const result = await response.json() as { folder?: string; questions?: number; images?: number; assets?: number; omittedInactiveAudio?: number; error?: string };
      if (!response.ok || !result.folder) throw new Error(result.error || "La copie complète n’a pas pu être créée.");
      const omittedAudio = result.omittedInactiveAudio ? ` ${result.omittedInactiveAudio} ancienne(s) piste(s) IA inactive(s) et introuvable(s) ignorée(s).` : "";
      setFeedback(`Copie complète créée : C:\\Users\\Romain DELOMBRE\\Desktop\\l'atelier quiz fichiers principaux\\Archive Quiz\\${result.folder} — ${result.questions} questions, leur fichier questions.csv et ${result.images} images (${result.assets} médias référencés).${omittedAudio}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "La copie complète n’a pas pu être créée.");
    } finally {
      setArchiveBusy(false);
    }
  };
  const activeQuestions = project.questions.filter((question) => question.enabled !== false);
  const visibleQuestions = typeof previewQuestion === "number" ? [activeQuestions[previewQuestion]].filter(Boolean) : activeQuestions;
  const previewProject = { ...project, questions: activeQuestions };
  const questionOffset = typeof previewQuestion === "number" ? previewQuestion : 0;
  const introVoiceReady = !project.introductionText.trim() || Boolean(introductionNarration(project));
  const conclusionVoiceReady = !project.conclusionText.trim() || Boolean(conclusionNarration(project));
  const voiceTotal = activeQuestions.length * 2 + Number(Boolean(project.introductionText.trim() || project.introductionRecording || project.introductionAudio)) + Number(Boolean(project.conclusionText.trim() || project.conclusionRecording || project.conclusionAudio));
  const previewConclusionFrames = typeof previewQuestion !== "number" ? conclusionDurationFrames(project) : 0;
  const previewEndingDelayFrames = previewConclusionFrames > 0
    ? ENDING_PAUSE_FRAMES + (conclusionNarration(project) ? CONCLUSION_VOICE_DELAY_FRAMES : 0)
    : 0;
  const previewDuration = questionVideoDuration(visibleQuestions, introductionDurationFrames(project), previewConclusionFrames + previewEndingDelayFrames, project.voice, project.speechRate);
  const voiceFilesCount = activeQuestions.reduce((total, question) => total + Number(Boolean(question.questionRecording || question.questionAudio)) + Number(Boolean(question.answerRecording || question.answerAudio)), Number(Boolean(project.introductionRecording || project.introductionAudio)) + Number(Boolean(project.conclusionRecording || project.conclusionAudio)));
  const previewKey = `${previewQuestion === "all" ? "all" : previewQuestion === "conclusion" ? "conclusion" : `question-${previewQuestion}`}-${project.voiceVolume}-${project.countdownSound || "no-countdown-sound"}-${project.countdownSoundVolume}-${project.answerSound || "no-answer-sound"}-${project.answerSoundVolume}-${project.introductionMusic || "no-intro-music"}-${project.introductionMusicDuration || "unknown-intro-duration"}-${project.introductionMusicVolume}-${project.conclusionMusic || "theme-music"}-${project.conclusionMusicVolume}-${project.introductionRecording || ""}-${project.conclusionRecording || ""}-${project.questions.map((q) => `${q.questionRecording || ""}:${q.answerRecording || ""}`).join("|")}`;


  return (
    <div className="studio-shell">
      <StudioSidebar projectId={projectId} questionCount={project.questions.filter((question) => question.enabled !== false).length} page="studio" />

      <main className="studio-main" id="accueil">
        <header className="topbar">
          <div className="breadcrumb"><span>ATELIER</span><i>/</i> {project.title || "Nouveau quiz"}</div>
          <div className={`save-indicator save-${saveState}`}><span />{saveState === "loading" ? "Ouverture…" : saveState === "saving" ? "Enregistrement…" : saveState === "error" ? "Sauvegarde en erreur" : "Sauvegardé sur ce PC"}</div>
        </header>

        <div className="workspace">
          <div className="page-heading">
            <div><div className="kicker"><span /> PROTOTYPE VIDÉO · 1920 × 1080 · 30 FPS</div><h1>Préparer le quiz</h1><p>Jusqu’à 60 questions, leurs voix et un rendu MP4 local.</p></div>
            <div className="project-heading-actions"><label className="project-name-field"><span>QUIZ / PROJET</span><select value={projectId} onChange={(event) => window.location.assign(`/?id=${encodeURIComponent(event.target.value)}`)} aria-label="Choisir un quiz">{projectOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><input value={project.title} maxLength={120} onChange={(event) => updateProject({ title: event.target.value })} aria-label="Nom du projet" /></label><button type="button" className="upload-button" onClick={() => void createNewQuiz()}>＋ Créer un nouveau quiz</button><button type="button" className="upload-button archive-export-button" title="Crée une copie datée des questions (JSON et CSV), archives, images et médias dans le dossier Archive Quiz." onClick={() => void exportCompleteArchive()} disabled={!loaded || saveState !== "saved" || Boolean(mediaBusy) || voiceBusy || archiveBusy}>{archiveBusy ? "Copie en cours…" : "Copie complète · questions + CSV"}</button><a className="upload-button" href={`/questions?id=${encodeURIComponent(projectId)}`}>Questions: {project.questions.filter((q) => q.enabled !== false).length} / 60</a></div>
          </div>

          {feedback && <div className="feedback" role="status"><span>i</span>{feedback}<button aria-label="Fermer le message" onClick={() => setFeedback("")}>×</button></div>}

          <section className="countdown-audio-panel" id="son-compte-a-rebours" aria-label="Son du compte à rebours">
            <div className="countdown-audio-copy"><strong>SON DU COMPTE À REBOURS</strong><small>Joué pendant les 3 dernières secondes de chaque question et coupé à zéro.</small></div>
            <label className="upload-button">{mediaBusy === "countdown-sound" ? "Import…" : project.countdownSound ? "Remplacer le son" : "Importer un son"}<input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.webm" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCountdownSound(file); event.currentTarget.value = ""; }} /></label>
            {project.countdownSound && <button className="text-button" onClick={() => updateProject({ countdownSound: null })}>Retirer</button>}
            {project.countdownSound && <><button type="button" className="countdown-preview-button" onClick={() => void previewCountdownSound()}>{countdownPreviewPlaying ? "■ Arrêter l’écoute" : "▶ Écouter le son"}</button><audio ref={countdownAudioRef} className="countdown-audio-source" preload="metadata" src={assetUrl(project.countdownSound) || undefined} onPlay={() => setCountdownPreviewPlaying(true)} onPause={() => setCountdownPreviewPlaying(false)} onEnded={() => setCountdownPreviewPlaying(false)} aria-label="Aperçu audio du son de compte à rebours" /></>}
            <Slider label="Volume du compte à rebours" value={project.countdownSoundVolume} min={0} max={100} unit=" %" onChange={updateCountdownVolume} />
          </section>

          <section className="countdown-audio-panel answer-sound-panel" id="son-reponses" aria-label="Son des bonnes réponses">
            <div className="countdown-audio-copy"><strong>SON DES BONNES RÉPONSES</strong><small>Joué une fois au début de chaque réponse ; la voix peut prolonger son affichage au-delà de 4 secondes.</small></div>
            <label className="upload-button">{mediaBusy === "answer-sound" ? "Import…" : project.answerSound ? "Remplacer le son" : "Importer un son"}<input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.webm" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAnswerSound(file); event.currentTarget.value = ""; }} /></label>
            {project.answerSound && <button className="text-button" onClick={() => updateProject({ answerSound: null })}>Retirer</button>}
            {project.answerSound && <><button type="button" className="countdown-preview-button" onClick={() => void previewAnswerSound()}>{answerSoundPreviewPlaying ? "■ Arrêter l’écoute" : "▶ Écouter le son"}</button><audio ref={answerSoundAudioRef} className="countdown-audio-source" preload="metadata" src={assetUrl(project.answerSound) || undefined} onPlay={() => setAnswerSoundPreviewPlaying(true)} onPause={() => setAnswerSoundPreviewPlaying(false)} onEnded={() => setAnswerSoundPreviewPlaying(false)} aria-label="Aperçu du son des bonnes réponses" /></>}
            <Slider label="Volume des bonnes réponses" value={project.answerSoundVolume} min={0} max={100} unit=" %" onChange={updateAnswerSoundVolume} />
          </section>

          <div className="main-grid">
            <div className="editor-column">
              <section className="panel intro-panel" id="introduction">
                <div className="panel-heading"><div><span className="panel-step">01</span><div><h2>Introduction de la vidéo</h2><p>Composez le fond et les calques PNG transparents de l’introduction.</p></div></div></div>
                <label className="field-label">TEXTE LU PAR LA VOIX OFF <span>FACULTATIF · 1 000 CARACTÈRES MAXIMUM</span><textarea value={project.introductionText} maxLength={1000} rows={4} placeholder="Bienvenue dans ce quiz… Présentez le thème et invitez les spectateurs à jouer." onChange={(event) => updateProject({ introductionText: event.target.value, introductionAudio: null, introductionAudioDuration: null, introductionAudioVoice: null, introductionAudioRate: null })} /></label>
                <Slider label="Durée de l’introduction" value={project.introductionDurationSeconds} min={MIN_INTRODUCTION_SECONDS} max={MAX_INTRODUCTION_SECONDS} unit=" s" onChange={(introductionDurationSeconds) => updateProject({ introductionDurationSeconds })} />
                <p className="duration-note">La durée réelle augmente si la narration dépasse le réglage choisi.</p>
                <IntroductionEditor
                  background={project.introductionImage || project.background}
                  backgroundIsFallback={!project.introductionImage && Boolean(project.background)}
                  layers={project.introductionLayers}
                  busy={mediaBusy}
                  onUploadBackground={(file) => void uploadImage(file, (introductionImage) => updateProject({ introductionImage }), "introduction-image")}
                  onRemoveBackground={() => updateProject({ introductionImage: null })}
                  onUploadLayer={uploadIntroductionLayer}
                  onUpdateLayers={updateIntroductionLayers}
                />
                <div className="intro-delayed-scene">
                  <div className="panel-heading"><div><span className="panel-step">↗</span><div><h3>Scène spéciale · apparition à 8 secondes</h3><p>Le fond, le logo, le panneau 60 questions et le son basculent après l’introduction avec un éclair.</p></div></div></div>
                  <IntroductionEditor
                    mode="delayed"
                    background={project.introductionDelayedScene.background}
                    backgroundIsFallback={false}
                    layers={{ ...project.introductionLayers, logo: project.introductionDelayedScene.logo, questionsPanel: project.introductionDelayedScene.questionsPanel }}
                    busy={mediaBusy}
                    onUploadBackground={(file) => void uploadImage(file, (background) => updateProject({ introductionDelayedScene: { ...project.introductionDelayedScene, background } }), "introduction-delayed-image")}
                    onRemoveBackground={() => updateProject({ introductionDelayedScene: { ...project.introductionDelayedScene, background: null } })}
                    onUploadLayer={uploadDelayedIntroductionLayer}
                    onUpdateLayers={(next) => updateProject({ introductionDelayedScene: { ...project.introductionDelayedScene, logo: next.logo, questionsPanel: next.questionsPanel } })}
                  />
                  <div className="music-field" id="son-scene-speciale">
                    <div className="music-heading"><div><strong>SON DE LA SCÈNE SPÉCIALE</strong><small>Joué au passage vers la scène spéciale.</small></div><label className="upload-button">{mediaBusy === "introduction-delayed-sound" ? "Import…" : project.introductionDelayedScene.sound ? "Remplacer le son" : "Ajouter un son"}<input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.webm" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void uploadDelayedSceneSound(file); event.currentTarget.value = ""; }} /></label>{project.introductionDelayedScene.sound && <button className="text-button" onClick={() => updateProject({ introductionDelayedScene: { ...project.introductionDelayedScene, sound: null } })}>Retirer</button>}</div>
                    {project.introductionDelayedScene.sound && <div className="conclusion-music-preview-row"><button type="button" className="countdown-preview-button" onClick={() => void previewSpecialSceneSound()}>{specialSceneSoundPreviewPlaying ? "■ Arrêter l’écoute" : "▶ Écouter le son"}</button><span>L’écoute et l’aperçu vidéo suivent la même jauge.</span><audio ref={specialSceneSoundAudioRef} className="countdown-audio-source" preload="metadata" src={assetUrl(project.introductionDelayedScene.sound) || undefined} onPlay={() => setSpecialSceneSoundPreviewPlaying(true)} onPause={() => setSpecialSceneSoundPreviewPlaying(false)} onEnded={() => setSpecialSceneSoundPreviewPlaying(false)} aria-label="Aperçu du son de la scène spéciale" /></div>}
                    <p>Il se déclenche lors du passage à la scène spéciale, à 8 secondes.</p>
                    {project.introductionDelayedScene.sound && <Slider label="Volume du son de transition" value={project.introductionDelayedScene.transition.soundVolume} min={0} max={100} unit=" %" onChange={(soundVolume) => updateProject({ introductionDelayedScene: { ...project.introductionDelayedScene, transition: { ...project.introductionDelayedScene.transition, soundVolume } } })} />}
                  </div>
                </div>
                <div className="music-field conclusion-music-field" id="musique-introduction">
                  <div className="music-heading"><div><strong>MUSIQUE D’INTRODUCTION</strong><small>{project.introductionMusic ? "La piste joue une fois, puis laisse place à la musique du thème." : "Sans piste dédiée, la musique du thème joue dès le début."}</small></div><label className="upload-button">{mediaBusy === "introduction-music" ? "Import…" : project.introductionMusic ? "Remplacer la musique" : "Importer une musique"}<input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.webm" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadIntroductionMusic(file); event.currentTarget.value = ""; }} /></label>{project.introductionMusic && <button className="text-button" onClick={() => updateProject({ introductionMusic: null, introductionMusicDuration: null })}>Retirer</button>}</div>
                  {project.introductionMusic && <><div className="conclusion-music-preview-row"><button type="button" className="countdown-preview-button" onClick={() => void previewIntroductionMusic()}>{introductionMusicPreviewPlaying ? "■ Arrêter l’écoute" : "▶ Écouter la musique"}</button><span>Le niveau de l’aperçu suit cette jauge.</span><audio ref={introductionMusicAudioRef} className="countdown-audio-source" preload="metadata" src={assetUrl(project.introductionMusic) || undefined} onLoadedMetadata={(event) => { const duration = event.currentTarget.duration; if (Number.isFinite(duration) && duration > 0 && project.introductionMusicDuration !== duration) updateProject({ introductionMusicDuration: duration }); }} onPlay={() => setIntroductionMusicPreviewPlaying(true)} onPause={() => setIntroductionMusicPreviewPlaying(false)} onEnded={() => setIntroductionMusicPreviewPlaying(false)} aria-label="Aperçu de la musique d’introduction" /></div><Slider label="Volume de la musique d’introduction" value={project.introductionMusicVolume} min={0} max={100} unit=" %" onChange={updateIntroductionMusicVolume} /></>}
                </div>
                <div className="intro-voice-row"><span className={introVoiceReady ? "voice-done" : project.introductionText.trim() ? "voice-missing" : "voice-done"}>{project.introductionVoiceSource === "recording" && project.introductionRecording ? `Micro sélectionné · ${project.introductionRecordingDuration?.toFixed(1)} s` : project.introductionAudio && introVoiceReady ? `Voix IA sélectionnée · ${project.introductionAudioDuration?.toFixed(1)} s` : project.introductionText.trim() ? "Choisissez IA ou Micro ci-dessous" : "Ajoutez un texte pour créer la voix"}</span><button className="generate-one" disabled={voiceBusy || !project.introductionText.trim()} onClick={() => void generateIntroductionVoice()}>{voiceBusy ? "Génération…" : project.introductionAudio ? "Régénérer la voix IA" : "Générer la voix IA"}</button></div>
                {project.introductionAudio && <audio className="intro-audio-preview" controls preload="none" src={assetUrl(project.introductionAudio) || undefined} aria-label="Écouter la narration de l’introduction" />}
                <VoiceRecorder label="Narration de l’introduction" path={project.introductionRecording} duration={project.introductionRecordingDuration} originalPath={project.introductionRecordingOriginal} source={project.introductionVoiceSource} aiAvailable={Boolean(project.introductionAudio && project.introductionAudioVoice === project.voice && project.introductionAudioRate === project.speechRate)} onSourceChange={(introductionVoiceSource) => updateProject({ introductionVoiceSource })} busy={mediaBusy === "voice-recording"} onSave={(blob, duration, originalBlob, originalDuration, isNewTake) => saveRecording(blob, duration, (introductionRecording, introductionRecordingDuration, originalPath, savedOriginalDuration) => updateProject({ introductionRecording, introductionRecordingDuration, introductionRecordingOriginal: originalPath ?? project.introductionRecordingOriginal ?? project.introductionRecording ?? introductionRecording, introductionRecordingOriginalDuration: originalPath ? savedOriginalDuration : project.introductionRecordingOriginalDuration ?? project.introductionRecordingDuration ?? introductionRecordingDuration, introductionVoiceSource: "recording" }), originalBlob, originalDuration, isNewTake)} onDelete={() => updateProject({ introductionRecording: null, introductionRecordingDuration: null, introductionRecordingOriginal: null, introductionRecordingOriginalDuration: null, introductionVoiceSource: "ai" })} />
              </section>
              <section className="panel decor-panel" id="habillage">
                  <div className="panel-heading"><div><span className="panel-step">02</span><div><h2>Décor &amp; logo</h2><p>Fond et logo partagés, titre et image du thème d’ouverture.</p></div></div></div>
                <label className="field-label opening-theme-title">NOM DU THÈME D’OUVERTURE <span>REPÈRE INTERNE · NON AFFICHÉ</span><input value={project.themeTitle} maxLength={100} placeholder={project.title || "Thème d’ouverture"} onChange={(event) => updateProject({ themeTitle: event.target.value })} /><span>La photo seule apparaît en plein écran pendant 4 secondes avant la première question.</span></label>
                <div className="theme-art-field">
                  <div className="theme-art-preview">{project.themeImage ? <Image src={assetUrl(project.themeImage) || ""} alt="Image du thème d’ouverture" width={360} height={220} unoptimized /> : <span>IMAGE DU THÈME<br />CARTE DE TITRE</span>}</div>
                  <div className="theme-art-controls"><div><strong>Image du thème d’ouverture</strong><small>Illustration affichée avec le titre avant la question 1.</small></div><label className="upload-button">{mediaBusy === "opening-theme-image" ? "Import…" : project.themeImage ? "Remplacer l’image" : "Ajouter une image"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, (themeImage) => updateProject({ themeImage }), "opening-theme-image"); event.currentTarget.value = ""; }} /></label>{project.themeImage && <button className="text-button" onClick={() => updateProject({ themeImage: null })}>Retirer</button>}</div>
                </div>
                <IntroductionEditor
                  mode="main"
                  background={project.background}
                  backgroundIsFallback={false}
                  layers={{ ...project.introductionLayers, logo: { ...project.decorLogoLayer, image: project.logo } }}
                  busy={mediaBusy}
                  onUploadBackground={(file) => void uploadImage(file, (background) => updateProject({ background }), "background")}
                  onRemoveBackground={() => updateProject({ background: null })}
                  onUploadLayer={(id, file) => void uploadImage(file, (logo) => updateProject({ logo }), "logo")}
                  onUpdateLayers={(next) => updateProject({ logo: next.logo.image, decorLogoLayer: next.logo })}
                />
                <div className="music-field" id="musique-theme">
                  <div className="music-heading"><div><strong>MUSIQUE DE FOND · TOUT LE QUIZ</strong><small>La musique baisse pendant les voix IA ; elle reste au volume réglé pendant les prises micro.</small></div><label className="upload-button">{mediaBusy === "background-music" ? "Import…" : project.backgroundMusic ? "Remplacer la musique" : "Importer une musique"}<input type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.webm" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMusic(file); event.currentTarget.value = ""; }} /></label>{project.backgroundMusic && <button className="text-button" onClick={() => updateProject({ backgroundMusic: null })}>Retirer</button>}</div>
                  {project.backgroundMusic && <div className="music-controls"><audio controls preload="metadata" src={assetUrl(project.backgroundMusic) || undefined} /><Slider label="Volume de la musique" value={project.musicVolume} min={0} max={100} unit=" %" onChange={(musicVolume) => updateProject({ musicVolume })} /></div>}
                  <p>La musique de fond et celle de conclusion conservent leur réglage pendant les prises micro. Le ducking progressif à 18 % reste appliqué aux voix IA.</p>
                </div>
                <p className="panel-note">Le fond global est importé une fois et partagé par toutes les questions par défaut. Les exceptions se règlent dans chaque question ; les originaux restent inchangés.</p>
              </section>

              <section className="panel voice-panel" id="voix">
                <div className="panel-heading"><div><span className="panel-step">04</span><div><h2>Voix off française</h2><p>{voiceFilesCount} narration{voiceFilesCount > 1 ? "s" : ""} sur {voiceTotal} · réutilisation du cache local</p></div></div></div>
                <div className="voice-controls"><label className="field-label">VOIX<select value={project.voice} onChange={(event) => { if (isVoiceId(event.target.value)) updateProject({ voice: event.target.value }); }}>{VOICES.map((voice) => <option value={voice.id} key={voice.id}>{voice.label} — {voice.gender}</option>)}</select></label><Slider label="Vitesse" value={project.speechRate} min={80} max={120} unit=" %" onChange={(speechRate) => updateProject({ speechRate })} /><Slider label="Volume de la voix" value={project.voiceVolume} min={0} max={100} unit=" %" onChange={(voiceVolume) => updateProject({ voiceVolume })} /></div>
                <div className="voice-disclosure"><span>i</span><div><strong>Synthèse vocale locale · aucun texte envoyé</strong><p>Piper génère des voix neurales françaises sur ce PC. Le premier lancement nécessite une seule installation des modèles dans le dossier du projet ; les narrations WAV sont ensuite conservées localement et réutilisées.</p></div></div>
                <div className="voice-footer"><button className="button-gold" disabled={voiceBusy || !loaded} onClick={() => void generateAllVoices()}><span>✦</span> Générer les voix IA manquantes</button><span>{voiceBusy ? voiceProgress : "Les prises micro sont conservées localement. Les séquences s’allongent si une voix dépasse leur durée prévue."}</span></div>
              </section>

              <section className="panel conclusion-panel" id="conclusion">
                <div className="panel-heading"><div><span className="panel-step">05</span><div><h2>Conclusion de la vidéo</h2><p>Une dernière narration, un fond dédié et jusqu’à trois images superposées réglables.</p></div></div></div>
                <label className="field-label">TEXTE LU PAR LA VOIX IA <span>NON AFFICHÉ À L’ÉCRAN · 1 000 CARACTÈRES MAXIMUM</span><textarea value={project.conclusionText} maxLength={1000} rows={4} placeholder="Remerciez les participants et invitez-les à revenir…" onChange={(event) => updateProject({ conclusionText: event.target.value, conclusionAudio: null, conclusionAudioDuration: null, conclusionAudioVoice: null, conclusionAudioRate: null })} /></label>
                <Slider label="Durée de la conclusion" value={project.conclusionDurationSeconds} min={MIN_CONCLUSION_SECONDS} max={MAX_CONCLUSION_SECONDS} unit=" s" onChange={(conclusionDurationSeconds) => updateProject({ conclusionDurationSeconds })} />
                <p className="duration-note">La durée réelle augmente si la narration dépasse le réglage choisi.</p>
                <ConclusionEditor
                  backgroundImage={project.conclusionBackgroundImage}
                  images={{ primary: project.conclusionImage, secondary: project.conclusionImage2, tertiary: project.conclusionImage3 }}
                  layers={{ primary: project.conclusionLayer, secondary: project.conclusionLayer2, tertiary: project.conclusionLayer3 }}
                  busy={mediaBusy}
                  onUploadBackground={(file) => void uploadImage(file, (conclusionBackgroundImage) => updateProject({ conclusionBackgroundImage }), "conclusion-background")}
                  onRemoveBackground={() => updateProject({ conclusionBackgroundImage: null })}
                  onUpload={(id: ConclusionImageId, file) => void uploadImage(file, (image) => updateProject(id === "primary" ? { conclusionImage: image } : id === "secondary" ? { conclusionImage2: image } : { conclusionImage3: image }), `conclusion-image-${id}`)}
                  onRemove={(id) => updateProject(id === "primary" ? { conclusionImage: null } : id === "secondary" ? { conclusionImage2: null } : { conclusionImage3: null })}
                  onUpdate={(id, conclusionLayer) => updateProject(id === "primary" ? { conclusionLayer } : id === "secondary" ? { conclusionLayer2: conclusionLayer } : { conclusionLayer3: conclusionLayer })}
                />
                <div className="music-field conclusion-music-field" id="musique-conclusion">
                  <div className="music-heading"><div><strong>MUSIQUE DE CONCLUSION</strong><small>{project.conclusionMusic ? "Cette piste remplacera la musique du thème pendant la conclusion." : "Sans piste dédiée, la musique du thème continuera pendant la conclusion."}</small></div><label className="upload-button">{mediaBusy === "conclusion-music" ? "Import…" : project.conclusionMusic ? "Remplacer la musique" : "Importer une musique"}<input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.webm" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadConclusionMusic(file); event.currentTarget.value = ""; }} /></label>{project.conclusionMusic && <button className="text-button" onClick={() => updateProject({ conclusionMusic: null })}>Retirer</button>}</div>
                  {project.conclusionMusic && <><div className="conclusion-music-preview-row"><button type="button" className="countdown-preview-button" onClick={() => void previewConclusionMusic()}>{conclusionMusicPreviewPlaying ? "■ Arrêter l’écoute" : "▶ Écouter la musique"}</button><span>Le niveau de l’aperçu suit cette jauge.</span><audio ref={conclusionMusicAudioRef} className="countdown-audio-source" preload="metadata" src={assetUrl(project.conclusionMusic) || undefined} onPlay={() => setConclusionMusicPreviewPlaying(true)} onPause={() => setConclusionMusicPreviewPlaying(false)} onEnded={() => setConclusionMusicPreviewPlaying(false)} aria-label="Aperçu de la musique de conclusion" /></div><Slider label="Volume de la musique de conclusion" value={project.conclusionMusicVolume} min={0} max={100} unit=" %" onChange={updateConclusionMusicVolume} /></>}
                </div>
                <div className="intro-voice-row"><span className={conclusionVoiceReady ? "voice-done" : project.conclusionText.trim() ? "voice-missing" : "voice-done"}>{project.conclusionVoiceSource === "recording" && project.conclusionRecording ? `Micro sélectionné · ${project.conclusionRecordingDuration?.toFixed(1)} s` : project.conclusionAudio && conclusionVoiceReady ? `Voix IA sélectionnée · ${project.conclusionAudioDuration?.toFixed(1)} s` : project.conclusionText.trim() ? "Choisissez IA ou Micro ci-dessous" : "Ajoutez un texte pour créer la voix"}</span><button className="generate-one" disabled={voiceBusy || !project.conclusionText.trim()} onClick={() => void generateConclusionVoice()}>{voiceBusy ? "Génération…" : project.conclusionAudio ? "Régénérer la voix IA" : "Générer la voix IA"}</button></div>
                {project.conclusionAudio && <audio className="intro-audio-preview" controls preload="none" src={assetUrl(project.conclusionAudio) || undefined} aria-label="Écouter la narration de conclusion" />}
                <VoiceRecorder label="Narration de la conclusion" path={project.conclusionRecording} duration={project.conclusionRecordingDuration} originalPath={project.conclusionRecordingOriginal} source={project.conclusionVoiceSource} aiAvailable={Boolean(project.conclusionAudio && project.conclusionAudioVoice === project.voice && project.conclusionAudioRate === project.speechRate)} onSourceChange={(conclusionVoiceSource) => updateProject({ conclusionVoiceSource })} busy={mediaBusy === "voice-recording"} onSave={(blob, duration, originalBlob, originalDuration, isNewTake) => saveRecording(blob, duration, (conclusionRecording, conclusionRecordingDuration, originalPath, savedOriginalDuration) => updateProject({ conclusionRecording, conclusionRecordingDuration, conclusionRecordingOriginal: originalPath ?? project.conclusionRecordingOriginal ?? project.conclusionRecording ?? conclusionRecording, conclusionRecordingOriginalDuration: originalPath ? savedOriginalDuration : project.conclusionRecordingOriginalDuration ?? project.conclusionRecordingDuration ?? conclusionRecordingDuration, conclusionVoiceSource: "recording" }), originalBlob, originalDuration, isNewTake)} onDelete={() => updateProject({ conclusionRecording: null, conclusionRecordingDuration: null, conclusionRecordingOriginal: null, conclusionRecordingOriginalDuration: null, conclusionVoiceSource: "ai" })} />
              </section>
            </div>

            <div className="preview-column">
              <section className="panel preview-panel" id="preview">
                <div className="panel-heading preview-heading"><div><span className="panel-step">06</span><div><h2>Prévisualisation</h2><p>La composition Remotion sera rendue en MP4.</p></div></div><span className="resolution-chip">16:9</span></div>
                <div className="preview-frame">{loaded ? <Player key={`${previewKey}-${project.introductionDelayedScene.sound || "no-special-scene-sound"}-${project.introductionDelayedScene.transition.enabled}-${project.introductionDelayedScene.transition.startSeconds}`} ref={playerRef} component={QuizVideo} inputProps={{ project: previewProject, questions: visibleQuestions, questionOffset }} durationInFrames={previewDuration} compositionWidth={1920} compositionHeight={1080} fps={30} controls clickToPlay loop={false} errorFallback={({ error }) => <div className="preview-error"><strong>Erreur de prévisualisation</strong><span>{error.message}</span></div>} style={{ width: "100%" }} /> : <div className="preview-loading">Ouverture du projet…</div>}</div>
                <div className="preview-tools"><span>APERÇU</span><div className="preview-switches"><button className={previewQuestion === "all" ? "active" : ""} onClick={() => setPreviewQuestion("all")}>Tout le quiz</button>{activeQuestions.map((question, index) => <button className={previewQuestion === index ? "active" : ""} key={question.id} onClick={() => setPreviewQuestion(index)}>Q{index + 1}</button>)}</div>{conclusionDurationFrames(project) > 0 && <button type="button" className={`preview-conclusion-button${previewQuestion === "conclusion" ? " active" : ""}`} onClick={() => setPreviewQuestion("conclusion")}>Conclusion</button>}<span>{(previewDuration / 30).toFixed(0)} s</span></div>
                <div className="timeline" aria-label="Timeline du quiz"><div className="timeline-intro"><span>INTRO</span><i>{(introductionDurationFrames(project) / FPS).toFixed(1)} s</i></div><div className="timeline-gap"><span>PAUSE</span><i>1 s</i></div>{activeQuestions.map((question, index) => <button key={question.id} className={`timeline-question ${previewQuestion === index ? "chosen" : ""}`} onClick={() => setPreviewQuestion(index)}>{question.startsTheme && <b title="Nouveau thème avant cette question">T ·</b>}<span>Q{index + 1}</span><i>{questionDurationFrames(question, project.voice, project.speechRate) / FPS} s</i><i>{answerDisplayFrames(question, project.voice, project.speechRate) / FPS} s</i>{index < activeQuestions.length - 1 && <i>{transitionFramesAfter(activeQuestions, index) / 30} s</i>}</button>)}{(previewQuestion === "all" || previewQuestion === "conclusion") && conclusionDurationFrames(project) > 0 && <button type="button" className={`timeline-conclusion${previewQuestion === "conclusion" ? " chosen" : ""}`} title="Prévisualiser la conclusion" onClick={() => setPreviewQuestion("conclusion")}><span>FIN</span><i>{(conclusionDurationFrames(project) / FPS).toFixed(1)} s</i></button>}</div>
              </section>

              <section className="panel export-panel" id="export">
                <div className="panel-heading"><div><span className="panel-step">07</span><div><h2>Rendu vidéo</h2><p>Encodage local · H.264 · MP4 avec narration.</p></div></div></div>
                <div className="export-summary"><span><b>1920 × 1080</b><small>Résolution</small></span><span><b>30 FPS</b><small>Fréquence</small></span><span><b>{(previewDuration / 30).toFixed(0)} s</b><small>Durée choisie</small></span></div>
                <div className="export-buttons"><button className="button-outline" disabled={renderStarting || renderStatus?.stage === "rendering" || renderStatus?.stage === "preparing"} onClick={() => void startRender("question", typeof previewQuestion === "number" ? previewQuestion : 0)}>Rendre {typeof previewQuestion === "number" ? `la question ${previewQuestion + 1}` : "la question 1"}</button><button className="button-gold" disabled={renderStarting || renderStatus?.stage === "rendering" || renderStatus?.stage === "preparing"} onClick={() => void startRender("all")}><span>▶</span> Rendre le quiz complet</button></div>
                {renderStarting && <p className="render-message">Lancement du rendu local…</p>}
                {renderStatus && <div className={`render-state ${renderStatus.stage === "failed" ? "render-failed" : ""}`}><div className="render-state-line"><strong>{renderStatus.message}</strong><span>{renderStatus.progress}%</span></div><div className="progress-track"><div style={{ width: `${renderStatus.progress}%` }} /></div>{renderStatus.stage === "failed" && <p>{renderStatus.error}</p>}{renderStatus.stage === "completed" && <button className="button-gold save-mp4" onClick={() => void saveRenderedVideo()}>Enregistrer le MP4 à l’emplacement choisi</button>}</div>}
                <p className="panel-note">Une copie est conservée dans <code>data/exports</code>. Le rendu se fait sur ce PC avec Chrome/Edge et FFmpeg fourni par Remotion.</p>
              </section>
            </div>
          </div>
          <footer className="studio-footer"><span>L’ATELIER QUIZ</span><span>PROJET LOCAL · AUCUNE BASE DE DONNÉES DISTANTE</span></footer>
        </div>
      </main>
    </div>
  );
}
