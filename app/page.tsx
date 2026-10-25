"use client";

import { Player, type PlayerRef } from "@remotion/player";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  answerNarrationFrames,
  defaultProject,
  introductionDurationFrames,
  INTRODUCTION_QUESTION_GAP_FRAMES,
  FPS,
  MAX_INTRODUCTION_SECONDS,
  MIN_INTRODUCTION_SECONDS,
  isVoiceId,
  makeQuestion,
  MAX_QUESTIONS,
  parseQuizCsv,
  questionDurationFrames,
  questionVideoDuration,
  transitionFramesAfter,
  type QuizProject,
  type QuizQuestion,
  type VoiceId,
} from "@/lib/quiz";
import { QuizVideo } from "@/remotion/QuizVideo";
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
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [feedback, setFeedback] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState("");
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [renderStarting, setRenderStarting] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<number | "all">("all");
  const [mediaBusy, setMediaBusy] = useState("");
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    let canceled = false;
    fetch("/api/project", { cache: "no-store" })
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

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/project", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(project) });
        if (!response.ok) throw new Error("Sauvegarde impossible.");
        setSaveState("saved");
      } catch { setSaveState("error"); }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [loaded, project]);

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
    playerRef.current?.seekTo(Math.round(project.introductionDurationSeconds * FPS) + INTRODUCTION_QUESTION_GAP_FRAMES);
  }, [loaded, previewQuestion, project.introductionDurationSeconds]);

  const updateProject = useCallback((patch: Partial<QuizProject>) => {
    setProject((current) => ({ ...current, ...patch }));
  }, []);

  const updateQuestion = useCallback((index: number, patch: Partial<QuizQuestion>) => {
    setProject((current) => ({ ...current, questions: current.questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question) }));
  }, []);

  const addQuestion = () => {
    if (project.questions.length >= MAX_QUESTIONS) return;
    const newIndex = project.questions.length;
    setProject((current) => ({ ...current, questions: [...current.questions, makeQuestion(current.questions.length + 1)] }));
    setPreviewQuestion(newIndex);
    setFeedback(`Question ${newIndex + 1} ajoutée.`);
  };

  const importQuestionsCsv = async (file: File) => {
    setFeedback("");
    try {
      const imported = parseQuizCsv(await file.text());
      const replacing = project.questions.some((question) => question.prompt.trim() || question.answer.trim() || question.answerCommentary.trim());
      if (replacing && !window.confirm(`Importer ${imported.length} questions remplacera les ${project.questions.length} questions actuelles. Continuer ?`)) return;
      setProject((current) => ({ ...current, questions: imported }));
      setPreviewQuestion("all");
      setFeedback(`${imported.length} question${imported.length > 1 ? "s" : ""} importée${imported.length > 1 ? "s" : ""}. Les narrations devront être générées pour ce nouveau contenu.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Impossible de lire ce fichier CSV.");
    }
  };

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

  const uploadMusic = useCallback(async (file: File) => {
    setMediaBusy("background-music"); setFeedback("");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/music", { method: "POST", body });
      const result = await response.json() as { path?: string; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Import de la musique impossible.");
      updateProject({ backgroundMusic: result.path });
      setFeedback(`${file.name} ajouté comme musique de fond globale.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Import de la musique impossible."); }
    finally { setMediaBusy(""); }
  }, [updateProject]);

  const generateVoice = useCallback(async (index: number, part: "question" | "answer" | "commentary") => {
    const question = project.questions[index];
    const text = part === "question" ? question.prompt : part === "answer" ? question.answer : question.answerCommentary;
    if (!text.trim()) throw new Error(`Ajoutez d’abord ${part === "question" ? "la question" : part === "answer" ? "la réponse" : "le commentaire"} ${index + 1}.`);
    const response = await fetch("/api/voice", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: project.voice, rate: project.speechRate }),
    });
    const result = await response.json() as GeneratedVoice & { error?: string };
    if (!response.ok) throw new Error(result.error || "La voix n’a pas pu être générée.");
    if (part === "question") {
      updateQuestion(index, { questionAudio: result.audio, questionAudioVoice: project.voice, questionAudioRate: project.speechRate, questionAudioDuration: result.duration });
      const availableSeconds = questionDurationFrames(question) / 30;
      if (result.duration > availableSeconds) setFeedback(`La narration de la question ${index + 1} dure ${result.duration.toFixed(1)} s, au-delà des ${availableSeconds} s disponibles.`);
    } else if (part === "answer") {
      updateQuestion(index, { answerAudio: result.audio, answerAudioVoice: project.voice, answerAudioRate: project.speechRate, answerAudioDuration: result.duration });
      if (result.duration > 4) setFeedback(`La narration de la réponse ${index + 1} dure ${result.duration.toFixed(1)} s, au-delà des 4 s disponibles.`);
    } else {
      updateQuestion(index, { commentaryAudio: result.audio, commentaryAudioVoice: project.voice, commentaryAudioRate: project.speechRate, commentaryAudioDuration: result.duration });
      if (answerNarrationFrames(question.answerAudioDuration, result.duration) > 4 * 30) setFeedback(`La réponse, la pause d’une seconde et le commentaire dépassent les 4 s d’affichage. Raccourcissez le commentaire.`);
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

  const generateIntroductionVoice = async () => {
    setVoiceBusy(true); setFeedback("");
    try {
      const result = await synthesizeIntroduction();
      setFeedback(`La narration d’introduction est prête (${result.duration.toFixed(1)} s).`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "La voix de l’introduction n’a pas pu être générée."); }
    finally { setVoiceBusy(false); }
  };

  const generateAllVoices = async () => {
    setVoiceBusy(true); setFeedback(""); let complete = 0;
    const total = project.questions.length * 2 + project.questions.filter((question) => question.answerCommentary.trim()).length + Number(Boolean(project.introductionText.trim()));
    try {
      if (project.introductionText.trim()) {
        setVoiceProgress(`Voix ${complete + 1} sur ${total} · introduction`);
        await synthesizeIntroduction(); complete += 1;
      }
      for (let index = 0; index < project.questions.length; index += 1) {
        const parts: Array<"question" | "answer" | "commentary"> = ["question", "answer"];
        if (project.questions[index].answerCommentary.trim()) parts.push("commentary");
        for (const part of parts) {
          setVoiceProgress(`Voix ${complete + 1} sur ${total} · question ${index + 1}`);
          await generateVoice(index, part); complete += 1;
        }
      }
      setFeedback(`Les ${complete} narrations sont prêtes et conservées localement.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Une narration n’a pas pu être générée."); }
    finally { setVoiceBusy(false); setVoiceProgress(""); }
  };

  const generateQuestionVoices = async (index: number) => {
    setVoiceBusy(true); setFeedback("");
      try { await generateVoice(index, "question"); await generateVoice(index, "answer"); if (project.questions[index].answerCommentary.trim()) await generateVoice(index, "commentary"); setFeedback(`Les voix de la question ${index + 1} sont prêtes.`); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Une narration n’a pas pu être générée."); }
    finally { setVoiceBusy(false); }
  };

  const startRender = async (scope: "all" | "question", index = 0) => {
    const selected = scope === "all" ? project.questions : [project.questions[index]];
    if (selected.some((question) => !question?.prompt.trim() || !question?.answer.trim())) { setFeedback(scope === "all" ? "Complétez toutes les questions et leurs réponses avant l’export." : `Complétez la question ${index + 1} et sa réponse avant l’export.`); return; }
    if (!introVoiceReady) { setFeedback("Générez la narration de l’introduction avec la voix et la vitesse sélectionnées."); navigate("introduction"); return; }
    if ((project.introductionAudioDuration ?? 0) > project.introductionDurationSeconds) { setFeedback("La narration d’introduction dépasse la durée choisie. Raccourcissez le texte puis régénérez la voix."); navigate("introduction"); return; }
    const audioReady = selected.every((question) => question.questionAudio && question.answerAudio && question.questionAudioVoice === project.voice && question.answerAudioVoice === project.voice && question.questionAudioRate === project.speechRate && question.answerAudioRate === project.speechRate && (question.questionAudioDuration ?? 16) <= questionDurationFrames(question) / 30 && (question.answerAudioDuration ?? 5) <= 4 && (!question.answerCommentary.trim() || (question.commentaryAudio && question.commentaryAudioVoice === project.voice && question.commentaryAudioRate === project.speechRate && answerNarrationFrames(question.answerAudioDuration, question.commentaryAudioDuration) <= 4 * 30)));
    if (!audioReady) { setFeedback("Générez les voix manquantes avec la voix sélectionnée. Les commentaires saisis doivent aussi avoir leur narration."); navigate("voix"); return; }
    setRenderStarting(true); setRenderStatus(null); setFeedback("");
    try {
      const response = await fetch("/api/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, scope, questionIndex: index }) });
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
  const visibleQuestions = previewQuestion === "all" ? project.questions : [project.questions[previewQuestion]];
  const questionOffset = previewQuestion === "all" ? 0 : previewQuestion;
  const introVoiceReady = !project.introductionText.trim() || Boolean(project.introductionAudio && project.introductionAudioVoice === project.voice && project.introductionAudioRate === project.speechRate);
  const voiceTotal = project.questions.length * 2 + project.questions.filter((question) => question.answerCommentary.trim()).length + Number(Boolean(project.introductionText.trim()));
  const previewDuration = questionVideoDuration(visibleQuestions, introductionDurationFrames(project));
  const voiceFilesCount = project.questions.reduce((total, question) => total + Number(Boolean(question.questionAudio)) + Number(Boolean(question.answerAudio)) + Number(Boolean(question.commentaryAudio)), Number(Boolean(project.introductionAudio)));
  const previewKey = previewQuestion === "all" ? `all-${project.voiceVolume}` : `question-${previewQuestion}-${project.voiceVolume}`;

  return (
    <div className="studio-shell">
      <aside className="sidebar">
        <a href="#accueil" className="sidebar-brand"><span className="brand-glyph" aria-hidden="true">AQ</span><span><strong>L’Atelier Quiz</strong><small>STUDIO LOCAL</small></span></a>
        <div className="sidebar-label">PRODUCTION</div>
        <nav className="side-nav" aria-label="Sections du studio">
          <button onClick={() => navigate("introduction")}><span>01</span> Introduction</button>
          <button onClick={() => navigate("habillage")}><span>02</span> Décor &amp; logo</button>
          <button onClick={() => navigate("questions")}><span>03</span> Questions</button>
          <button onClick={() => navigate("voix")}><span>04</span> Voix off</button>
          <button onClick={() => navigate("preview")}><span>05</span> Prévisualisation</button>
          <button onClick={() => navigate("export")}><span>06</span> Export MP4</button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="local-card"><span className="local-led" /><strong>Projet sur ce PC</strong><small>Questions, médias et voix sont enregistrés dans le dossier du projet.</small></div>
        <div className="sidebar-version">STUDIO LOCAL · 60 QUESTIONS MAX</div>
      </aside>

      <main className="studio-main" id="accueil">
        <header className="topbar">
          <div className="breadcrumb"><span>ATELIER</span><i>/</i> {project.title || "Nouveau quiz"}</div>
          <div className={`save-indicator save-${saveState}`}><span />{saveState === "loading" ? "Ouverture…" : saveState === "saving" ? "Enregistrement…" : saveState === "error" ? "Sauvegarde en erreur" : "Sauvegardé sur ce PC"}</div>
        </header>

        <div className="workspace">
          <div className="page-heading">
            <div><div className="kicker"><span /> PROTOTYPE VIDÉO · 1920 × 1080 · 30 FPS</div><h1>Préparer le quiz</h1><p>Jusqu’à 60 questions, leurs voix et un rendu MP4 local.</p></div>
            <div className="project-heading-actions"><label className="project-name-field"><span>NOM DU PROJET</span><input value={project.title} maxLength={120} onChange={(event) => updateProject({ title: event.target.value })} aria-label="Nom du projet" /></label><label className="upload-button csv-import-top">Importer un CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importQuestionsCsv(file); event.currentTarget.value = ""; }} /></label></div>
          </div>

          {feedback && <div className="feedback" role="status"><span>i</span>{feedback}<button aria-label="Fermer le message" onClick={() => setFeedback("")}>×</button></div>}

          <div className="main-grid">
            <div className="editor-column">
              <section className="panel intro-panel" id="introduction">
                <div className="panel-heading"><div><span className="panel-step">01</span><div><h2>Introduction de la vidéo</h2><p>L’image choisie occupe tout l’écran pendant la durée réglée.</p></div></div></div>
                <label className="field-label">TEXTE LU PAR LA VOIX OFF <span>FACULTATIF · 1 000 CARACTÈRES MAXIMUM</span><textarea value={project.introductionText} maxLength={1000} rows={4} placeholder="Bienvenue dans ce quiz… Présentez le thème et invitez les spectateurs à jouer." onChange={(event) => updateProject({ introductionText: event.target.value, introductionAudio: null, introductionAudioDuration: null, introductionAudioVoice: null, introductionAudioRate: null })} /></label>
                <Slider label="Durée de l’introduction" value={project.introductionDurationSeconds} min={MIN_INTRODUCTION_SECONDS} max={MAX_INTRODUCTION_SECONDS} unit=" s" onChange={(introductionDurationSeconds) => updateProject({ introductionDurationSeconds })} />
                <div className="intro-image-control">
                  <div className="intro-image-preview">{project.introductionImage ? <Image src={assetUrl(project.introductionImage) || ""} alt="Aperçu de l’image d’introduction en plein écran" width={320} height={180} unoptimized /> : <span>IMAGE FACULTATIVE<br />PLEIN ÉCRAN</span>}</div>
                  <div className="intro-image-actions"><strong>IMAGE D’ILLUSTRATION</strong><small>PNG, JPG ou WebP · plein écran avec zoom et fondu.</small><div><label className="upload-button">{mediaBusy === "introduction-image" ? "Import…" : project.introductionImage ? "Remplacer l’image" : "Ajouter une image"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, (introductionImage) => updateProject({ introductionImage }), "introduction-image"); event.currentTarget.value = ""; }} /></label>{project.introductionImage && <button className="text-button" onClick={() => updateProject({ introductionImage: null })}>Supprimer</button>}</div></div>
                </div>
                <div className="intro-voice-row"><span className={introVoiceReady && project.introductionAudio ? "voice-done" : project.introductionText.trim() ? "voice-missing" : "voice-done"}>{project.introductionAudio && introVoiceReady ? `Voix prête · ${project.introductionAudioDuration?.toFixed(1)} s` : project.introductionText.trim() ? "Voix à générer" : "Ajoutez un texte pour créer la voix"}</span><button className="generate-one" disabled={voiceBusy || !project.introductionText.trim()} onClick={() => void generateIntroductionVoice()}>{voiceBusy ? "Génération…" : project.introductionAudio ? "Régénérer la voix" : "Générer la voix d’introduction"}</button></div>
                {project.introductionAudio && <audio className="intro-audio-preview" controls preload="none" src={assetUrl(project.introductionAudio) || undefined} aria-label="Écouter la narration de l’introduction" />}
              </section>
              <section className="panel questions-panel" id="questions">
                <div className="panel-heading"><div><span className="panel-step">03</span><div><h2>Questions &amp; réponses</h2><p>Ajoutez jusqu’à 60 questions ; le rythme reste identique pour chacune.</p></div></div><div className="question-count">{project.questions.length}<small> / {MAX_QUESTIONS}</small></div></div>
                <div className="timing-strip"><span><b className="timing-cream">{project.introductionDurationSeconds} s</b> introduction</span><i>→</i><span><b className="timing-green">2 s</b> pause</span><i>→</i><span><b className="timing-gold">10 ou 15 s</b> question</span><i>→</i><span><b className="timing-cream">4 s</b> réponse</span><i>→</i><span><b className="timing-green">2 s</b> pause</span></div>
                <div className="question-list">
                  {project.questions.map((question, index) => {
                    const questionReady = question.questionAudio && question.questionAudioVoice === project.voice && question.questionAudioRate === project.speechRate;
                    const answerReady = question.answerAudio && question.answerAudioVoice === project.voice && question.answerAudioRate === project.speechRate;
                    const questionSeconds = questionDurationFrames(question) / 30;
                    const qTooLong = Boolean(question.questionAudioDuration && question.questionAudioDuration > questionSeconds);
                    const aTooLong = Boolean(question.answerAudioDuration && question.answerAudioDuration > 4);
                    return (
                      <article className="question-card" key={question.id}>
                        <div className="question-card-top"><div className="number-badge">{String(index + 1).padStart(2, "0")}</div><div className="question-card-title"><strong>Question {index + 1}</strong><small>{questionSeconds} s + 4 s réponse{question.answerCommentary.trim() ? ` · commentaire lu pendant la réponse` : ""}{index < project.questions.length - 1 ? " + 2 s de pause" : ""}</small></div><button className={`preview-small ${previewQuestion === index ? "selected" : ""}`} onClick={() => { setPreviewQuestion(index); navigate("preview"); }} title={`Prévisualiser la question ${index + 1}`}><span>▶</span> Aperçu</button></div>
                        <label className="field-label">TITRE À L’ÉCRAN <span>FACULTATIF</span><input value={question.title} maxLength={100} placeholder={`Question ${index + 1}`} onChange={(event) => updateQuestion(index, { title: event.target.value })} /></label>
                        <label className="field-label">QUESTION <span>OBLIGATOIRE · {questionSeconds} SECONDES · {question.title.length + question.prompt.length} CARACTÈRES À L’ÉCRAN</span><textarea value={question.prompt} maxLength={1000} rows={2} placeholder="Écrivez la question à deviner…" onChange={(event) => updateQuestion(index, { prompt: event.target.value })} /></label>
                        <label className="checkbox-line timer-override"><input type="checkbox" checked={question.force15Seconds} onChange={(event) => updateQuestion(index, { force15Seconds: event.target.checked })} /><span>Forcer le compte à rebours à 15 secondes · les questions de plus de 150 caractères restent automatiquement à 15 secondes</span></label>
                        <label className="field-label">RÉPONSE <span>OBLIGATOIRE · AFFICHÉE 4 SECONDES</span><textarea value={question.answer} maxLength={500} rows={2} placeholder="Écrivez la réponse à révéler…" onChange={(event) => updateQuestion(index, { answer: event.target.value })} /></label>
                        <label className="field-label">COMMENTAIRE PENDANT L’AFFICHAGE DE LA RÉPONSE <span>FACULTATIF · 1 S DE PAUSE AVANT SA LECTURE</span><textarea value={question.answerCommentary} maxLength={1000} rows={2} placeholder="Ajoutez une explication, une anecdote ou un commentaire…" onChange={(event) => updateQuestion(index, { answerCommentary: event.target.value, commentaryAudio: null, commentaryAudioDuration: null, commentaryAudioVoice: null, commentaryAudioRate: null })} /></label>
                        <div className="question-assets">
                          <div className="question-image-group">
                            <div className="illustration-preview">{question.image ? <Image src={assetUrl(question.image) || ""} alt={`Illustration de la question ${index + 1}`} width={98} height={84} unoptimized /> : <span>IMAGE<br />QUESTION</span>}</div>
                            <div className="asset-actions"><strong className="image-kind-label">IMAGE DE QUESTION</strong>
                              <label className="upload-button">{mediaBusy === `question-${index}` ? "Import…" : question.image ? "Remplacer" : "Importer"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, (image) => updateQuestion(index, { image }), `question-${index}`); event.currentTarget.value = ""; }} /></label>
                              {question.image && <button className="text-button" onClick={() => updateQuestion(index, { image: null })}>Retirer</button>}
                              <label className="checkbox-line"><input type="checkbox" checked={question.keepImageOnAnswer} onChange={(event) => updateQuestion(index, { keepImageOnAnswer: event.target.checked })} /> Garder cette image à la réponse si aucune image de réponse n’est définie</label>
                            </div>
                          </div>
                          <div className="question-image-group">
                            <div className="illustration-preview">{question.answerImage ? <Image src={assetUrl(question.answerImage) || ""} alt={`Illustration de la réponse ${index + 1}`} width={98} height={84} unoptimized /> : <span>IMAGE<br />RÉPONSE</span>}</div>
                            <div className="asset-actions"><strong className="image-kind-label">IMAGE DE RÉPONSE</strong>
                              <label className="upload-button">{mediaBusy === `answer-image-${index}` ? "Import…" : question.answerImage ? "Remplacer" : "Importer"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, (answerImage) => updateQuestion(index, { answerImage }), `answer-image-${index}`); event.currentTarget.value = ""; }} /></label>
                              {question.answerImage && <button className="text-button" onClick={() => updateQuestion(index, { answerImage: null })}>Retirer</button>}
                            </div>
                          </div>
                        </div>
                        {index > 0 && <div className="question-theme-tools">
                          <label className="theme-start-toggle"><input type="checkbox" checked={question.startsTheme} onChange={(event) => updateQuestion(index, { startsTheme: event.target.checked })} /><span><strong>Nouveau thème avant cette question</strong><small>Ajoute une courte séquence de titre et de transition.</small></span></label>
                          {question.startsTheme && <>
                          <label className="field-label theme-title-field">NOM DU THÈME <span>REPÈRE INTERNE · NON AFFICHÉ</span><input value={question.themeTitle} maxLength={100} placeholder={`Ex. Thème ${index + 1}`} onChange={(event) => updateQuestion(index, { themeTitle: event.target.value })} /></label>
                          <div className="question-theme-heading"><strong>CARTE DU NOUVEAU THÈME</strong><span>Fond global et logo conservés · image facultative</span></div>
                          <div className="question-theme-grid">
                            <div className="question-theme-item">
                              <div className="question-theme-thumb question-theme-image">{question.themeImage ? <Image src={assetUrl(question.themeImage) || ""} alt={`Image du thème avant la question ${index + 1}`} width={360} height={220} unoptimized /> : <span>IMAGE DU THÈME<br />CARTE DE TITRE</span>}</div>
                              <div className="question-theme-actions"><div><strong>Image du thème</strong><small>{question.themeImage ? "Affichée dans la transition" : "Facultative · carte de titre"}</small></div><label className="upload-button">{mediaBusy === `theme-image-${index}` ? "Import…" : question.themeImage ? "Remplacer" : "Ajouter"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, (themeImage) => updateQuestion(index, { themeImage }), `theme-image-${index}`); event.currentTarget.value = ""; }} /></label>{question.themeImage && <button className="text-button" onClick={() => updateQuestion(index, { themeImage: null })}>Retirer</button>}</div>
                            </div>
                          </div>
                          </>}
                        </div>}
                        <div className="question-voice-row"><div className="voice-status-list">
                          <span className={questionReady ? "voice-done" : "voice-missing"}>{questionReady ? "●" : "○"} Voix question{qTooLong ? <em className="duration-warning"> · {question.questionAudioDuration?.toFixed(1)} s</em> : question.questionAudioDuration ? <em> · {question.questionAudioDuration.toFixed(1)} s</em> : null}</span>
                          <span className={answerReady ? "voice-done" : "voice-missing"}>{answerReady ? "●" : "○"} Voix réponse{aTooLong ? <em className="duration-warning"> · {question.answerAudioDuration?.toFixed(1)} s</em> : question.answerAudioDuration ? <em> · {question.answerAudioDuration.toFixed(1)} s</em> : null}</span>
                          {question.answerCommentary.trim() && <span className={question.commentaryAudio && question.commentaryAudioVoice === project.voice && question.commentaryAudioRate === project.speechRate && answerNarrationFrames(question.answerAudioDuration, question.commentaryAudioDuration) <= 4 * 30 ? "voice-done" : "voice-missing"}>{question.commentaryAudio && question.commentaryAudioVoice === project.voice && question.commentaryAudioRate === project.speechRate && answerNarrationFrames(question.answerAudioDuration, question.commentaryAudioDuration) <= 4 * 30 ? "●" : "○"} Voix commentaire{question.commentaryAudioDuration ? <em className={answerNarrationFrames(question.answerAudioDuration, question.commentaryAudioDuration) > 4 * 30 ? "duration-warning" : ""}> · {question.commentaryAudioDuration.toFixed(1)} s{answerNarrationFrames(question.answerAudioDuration, question.commentaryAudioDuration) > 4 * 30 ? " · trop long avec la pause et la réponse" : ""}</em> : null}</span>}
                        </div><button className="generate-one" disabled={voiceBusy || !question.prompt.trim() || !question.answer.trim()} onClick={() => void generateQuestionVoices(index)}>{voiceBusy ? "Génération…" : question.answerCommentary.trim() ? "Générer les voix" : "Générer les deux voix"}</button></div>
                        <div className="audio-previews">{question.questionAudio && <audio controls preload="none" src={assetUrl(question.questionAudio) || undefined} aria-label={`Écouter la voix de la question ${index + 1}`} />}{question.answerAudio && <audio controls preload="none" src={assetUrl(question.answerAudio) || undefined} aria-label={`Écouter la voix de la réponse ${index + 1}`} />}{question.commentaryAudio && <audio controls preload="none" src={assetUrl(question.commentaryAudio) || undefined} aria-label={`Écouter le commentaire de la question ${index + 1}`} />}</div>
                      </article>
                    );
                  })}
                </div>
                <p className="panel-note csv-format-note">CSV UTF-8 séparé par des points-virgules ou des virgules · colonnes : <code>titre, question, reponse, commentaire</code> · jusqu’à 60 lignes de questions.</p>
                <div className="add-question-row"><span>{project.questions.length} sur {MAX_QUESTIONS} questions</span><button className="button-outline" disabled={project.questions.length >= MAX_QUESTIONS} onClick={addQuestion}><span>＋</span> Ajouter une question</button></div>
              </section>

              <section className="panel decor-panel" id="habillage">
                  <div className="panel-heading"><div><span className="panel-step">02</span><div><h2>Décor &amp; logo</h2><p>Fond et logo partagés, titre et image du thème d’ouverture.</p></div></div></div>
                <label className="field-label opening-theme-title">NOM DU THÈME D’OUVERTURE <span>REPÈRE INTERNE · NON AFFICHÉ</span><input value={project.themeTitle} maxLength={100} placeholder={project.title || "Thème d’ouverture"} onChange={(event) => updateProject({ themeTitle: event.target.value })} /><span>La photo seule apparaît en plein écran pendant 4 secondes avant la première question.</span></label>
                <div className="theme-art-field">
                  <div className="theme-art-preview">{project.themeImage ? <Image src={assetUrl(project.themeImage) || ""} alt="Image du thème d’ouverture" width={360} height={220} unoptimized /> : <span>IMAGE DU THÈME<br />CARTE DE TITRE</span>}</div>
                  <div className="theme-art-controls"><div><strong>Image du thème d’ouverture</strong><small>Illustration affichée avec le titre avant la question 1.</small></div><label className="upload-button">{mediaBusy === "opening-theme-image" ? "Import…" : project.themeImage ? "Remplacer l’image" : "Ajouter une image"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, (themeImage) => updateProject({ themeImage }), "opening-theme-image"); event.currentTarget.value = ""; }} /></label>{project.themeImage && <button className="text-button" onClick={() => updateProject({ themeImage: null })}>Retirer</button>}</div>
                </div>
                <div className="decor-grid">
                  <div className="decor-field"><div className="decor-preview background-preview">{project.background ? <Image src={assetUrl(project.background) || ""} alt="Aperçu du fond global" width={1200} height={675} unoptimized /> : <span className="empty-state"><b>16:9</b>Importez le décor de votre bibliothèque</span>}</div><div className="decor-controls"><div><strong>Fond global · tous les thèmes et questions</strong><small>{project.background ? "Importé une fois · conservé partout" : "PNG, JPG ou WebP · jusqu’à 50 Mo"}</small></div><label className="upload-button">{mediaBusy === "background" ? "Import…" : project.background ? "Remplacer" : "Importer"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, (background) => updateProject({ background }), "background"); event.currentTarget.value = ""; }} /></label>{project.background && <button className="text-button" onClick={() => updateProject({ background: null })}>Retirer</button>}</div></div>
                  <div className="decor-field logo-field"><div className="decor-preview logo-preview">{project.logo ? <Image src={assetUrl(project.logo) || ""} alt="Logo original importé" width={800} height={400} unoptimized /> : <span className="empty-state"><b>LOGO</b>Import facultatif</span>}</div><div className="decor-controls"><div><strong>Logo original</strong><small>Ajouté en calque indépendant</small></div><label className="upload-button">{mediaBusy === "logo" ? "Import…" : project.logo ? "Remplacer" : "Importer"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, (logo) => updateProject({ logo }), "logo"); event.currentTarget.value = ""; }} /></label>{project.logo && <button className="text-button" onClick={() => updateProject({ logo: null })}>Retirer</button>}</div></div>
                </div>
                <div className="music-field">
                  <div className="music-heading"><div><strong>MUSIQUE DE FOND · TOUT LE QUIZ</strong><small>Une seule piste en boucle, comme le fond global. Volume automatiquement réduit pendant les narrations.</small></div><label className="upload-button">{mediaBusy === "background-music" ? "Import…" : project.backgroundMusic ? "Remplacer la musique" : "Importer une musique"}<input type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.webm" disabled={Boolean(mediaBusy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMusic(file); event.currentTarget.value = ""; }} /></label>{project.backgroundMusic && <button className="text-button" onClick={() => updateProject({ backgroundMusic: null })}>Retirer</button>}</div>
                  {project.backgroundMusic && <div className="music-controls"><audio controls preload="metadata" src={assetUrl(project.backgroundMusic) || undefined} /><Slider label="Volume de la musique" value={project.musicVolume} min={0} max={100} unit=" %" onChange={(musicVolume) => updateProject({ musicVolume })} /></div>}
                  <p>La musique passe au volume choisi pendant l’introduction et les transitions, puis descend à 18 % de ce réglage pendant les voix.</p>
                </div>
                <p className="panel-note">Le fond global est importé une fois et partagé par toutes les questions par défaut. Les exceptions se règlent dans chaque question ; les originaux restent inchangés.</p>
              </section>

              <section className="panel voice-panel" id="voix">
                <div className="panel-heading"><div><span className="panel-step">04</span><div><h2>Voix off française</h2><p>{voiceFilesCount} narration{voiceFilesCount > 1 ? "s" : ""} sur {voiceTotal} · réutilisation du cache local</p></div></div></div>
                <div className="voice-controls"><label className="field-label">VOIX<select value={project.voice} onChange={(event) => { if (isVoiceId(event.target.value)) updateProject({ voice: event.target.value }); }}>{VOICES.map((voice) => <option value={voice.id} key={voice.id}>{voice.label} — {voice.gender}</option>)}</select></label><Slider label="Vitesse" value={project.speechRate} min={80} max={120} unit=" %" onChange={(speechRate) => updateProject({ speechRate })} /><Slider label="Volume de la voix" value={project.voiceVolume} min={0} max={100} unit=" %" onChange={(voiceVolume) => updateProject({ voiceVolume })} /></div>
                <div className="voice-disclosure"><span>i</span><div><strong>Synthèse vocale locale · aucun texte envoyé</strong><p>Piper génère des voix neurales françaises sur ce PC. Le premier lancement nécessite une seule installation des modèles dans le dossier du projet ; les narrations WAV sont ensuite conservées localement et réutilisées.</p></div></div>
                <div className="voice-footer"><button className="button-gold" disabled={voiceBusy || !loaded} onClick={() => void generateAllVoices()}><span>✦</span> Générer les {voiceTotal} narrations</button><span>{voiceBusy ? voiceProgress : "Les narrations trop longues sont signalées après mesure de l’audio."}</span></div>
              </section>
            </div>

            <div className="preview-column">
              <section className="panel preview-panel" id="preview">
                <div className="panel-heading preview-heading"><div><span className="panel-step">05</span><div><h2>Prévisualisation</h2><p>La composition Remotion sera rendue en MP4.</p></div></div><span className="resolution-chip">16:9</span></div>
                <div className="preview-frame">{loaded ? <Player key={previewKey} ref={playerRef} component={QuizVideo} inputProps={{ project, questions: visibleQuestions, questionOffset }} durationInFrames={previewDuration} compositionWidth={1920} compositionHeight={1080} fps={30} controls clickToPlay loop={false} errorFallback={({ error }) => <div className="preview-error"><strong>Erreur de prévisualisation</strong><span>{error.message}</span></div>} style={{ width: "100%" }} /> : <div className="preview-loading">Ouverture du projet…</div>}</div>
                <div className="preview-tools"><span>APERÇU</span><div className="preview-switches"><button className={previewQuestion === "all" ? "active" : ""} onClick={() => setPreviewQuestion("all")}>Tout le quiz</button>{project.questions.map((question, index) => <button className={previewQuestion === index ? "active" : ""} key={question.id} onClick={() => setPreviewQuestion(index)}>Q{index + 1}</button>)}</div><span>{(previewDuration / 30).toFixed(0)} s</span></div>
                <div className="timeline" aria-label="Timeline du quiz"><div className="timeline-intro"><span>INTRO</span><i>{project.introductionDurationSeconds} s</i></div><div className="timeline-gap"><span>PAUSE</span><i>2 s</i></div>{project.questions.map((question, index) => <button key={question.id} className={`timeline-question ${previewQuestion === index ? "chosen" : ""}`} onClick={() => setPreviewQuestion(index)}>{question.startsTheme && <b title="Nouveau thème avant cette question">T ·</b>}<span>Q{index + 1}</span><i>{questionDurationFrames(question) / 30} s</i><i>4 s</i>{index < project.questions.length - 1 && <i>{transitionFramesAfter(project.questions, index) / 30} s</i>}</button>)}</div>
              </section>

              <section className="panel export-panel" id="export">
                <div className="panel-heading"><div><span className="panel-step">06</span><div><h2>Rendu vidéo</h2><p>Encodage local · H.264 · MP4 avec narration.</p></div></div></div>
                <div className="export-summary"><span><b>1920 × 1080</b><small>Résolution</small></span><span><b>30 FPS</b><small>Fréquence</small></span><span><b>{(previewDuration / 30).toFixed(0)} s</b><small>Durée choisie</small></span></div>
                <div className="export-buttons"><button className="button-outline" disabled={renderStarting || renderStatus?.stage === "rendering" || renderStatus?.stage === "preparing"} onClick={() => void startRender("question", previewQuestion === "all" ? 0 : previewQuestion)}>Rendre {previewQuestion === "all" ? "la question 1" : `la question ${previewQuestion + 1}`}</button><button className="button-gold" disabled={renderStarting || renderStatus?.stage === "rendering" || renderStatus?.stage === "preparing"} onClick={() => void startRender("all")}><span>▶</span> Rendre le quiz complet</button></div>
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
