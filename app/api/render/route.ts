import { randomUUID } from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { answerNarrationFrames, conclusionDurationFrames, introductionDurationFrames, normalizeProject, questionDurationFrames, questionVideoDuration, slugify, type QuizVideoProps } from "@/lib/quiz";
import { renderJobs, type RenderJob } from "@/lib/render-jobs";
import { ensureProjectFolders, saveProject, exportsDirectory } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const findChrome = async () => {
  const candidates = [
    process.env.REMOTION_CHROME_PATH,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed Chromium browser without downloading one.
    }
  }
  return undefined;
};

async function render(job: RenderJob, project: NonNullable<ReturnType<typeof normalizeProject>>, scope: "all" | "question", questionIndex: number) {
  const root = process.cwd();
  const browserExecutable = await findChrome();
  if (!browserExecutable) throw new Error("Chrome ou Microsoft Edge est nécessaire au rendu local. Aucun navigateur ne sera téléchargé automatiquement.");

  const selectedQuestions = scope === "question" ? [project.questions[questionIndex]] : project.questions;
  const videoProps: QuizVideoProps = { project, questions: selectedQuestions, questionOffset: scope === "question" ? questionIndex : 0 };
  const entryPoint = path.join(root, "remotion", "index.tsx");
  const bundleDirectory = path.join(root, "data", "remotion-bundle");
  job.stage = "preparing";
  job.message = "Préparation de la composition Remotion";
  job.progress = 2;

  const serveUrl = await bundle({
    entryPoint,
    outDir: bundleDirectory,
    publicDir: path.join(root, "public"),
    enableCaching: true,
    onProgress: (progress) => {
      job.progress = Math.round(2 + Math.min(1, progress) * 18);
      job.message = "Préparation de la composition Remotion";
    },
  });
  const inputProps = videoProps as unknown as Record<string, unknown>;
  const composition = await selectComposition({
    serveUrl,
    id: "QuizVideo",
    inputProps,
    browserExecutable,
    logLevel: "error",
  });

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const suffix = scope === "question" ? `-question-${questionIndex + 1}` : "";
  const filename = `${slugify(project.title)}${suffix}-${stamp}.mp4`;
  const outputPath = path.join(exportsDirectory, filename);
  job.stage = "rendering";
  job.message = "Rendu MP4 1080p · H.264";
  job.filename = filename;
  job.outputPath = outputPath;
  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: questionVideoDuration(selectedQuestions, introductionDurationFrames(project), scope === "all" ? conclusionDurationFrames(project) : 0),
      width: 1920,
      height: 1080,
      fps: 30,
    },
    serveUrl,
    codec: "h264",
    crf: 18,
    outputLocation: outputPath,
    inputProps,
    browserExecutable,
    logLevel: "error",
    concurrency: 4,
    onProgress: ({ progress }) => {
      job.progress = Math.max(20, Math.min(99, Math.round(20 + progress * 79)));
      job.message = "Rendu MP4 1080p · H.264";
    },
  });
  job.stage = "completed";
  job.progress = 100;
  job.message = "Vidéo prête";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as null | { project?: unknown; scope?: unknown; questionIndex?: unknown };
  const project = normalizeProject(body?.project);
  if (!project) return NextResponse.json({ error: "Le projet est invalide." }, { status: 400 });
  if (body?.scope !== "question" && project.questions.some((question) => !question.prompt.trim() || !question.answer.trim())) {
    return NextResponse.json({ error: "Complétez toutes les questions et leurs réponses avant le rendu." }, { status: 400 });
  }
  const scope = body?.scope === "question" ? "question" : "all";
  const questionIndex = Number.isInteger(body?.questionIndex) ? Number(body?.questionIndex) : 0;
  if (scope === "question" && (questionIndex < 0 || questionIndex >= project.questions.length)) {
    return NextResponse.json({ error: "Question à exporter inconnue." }, { status: 400 });
  }
  const selected = scope === "all" ? project.questions : [project.questions[questionIndex]];
  if (selected.some((question) => !question.prompt.trim() || !question.answer.trim())) {
    return NextResponse.json({ error: scope === "all" ? "Complétez toutes les questions et leurs réponses avant le rendu." : `Complétez la question ${questionIndex + 1} et sa réponse avant le rendu.` }, { status: 400 });
  }
  if (project.introductionText.trim() && (
    !project.introductionAudio ||
    project.introductionAudioVoice !== project.voice ||
    project.introductionAudioRate !== project.speechRate
  )) {
    return NextResponse.json({ error: "Générez la narration de l’introduction avec la voix et la vitesse sélectionnées avant l’export." }, { status: 400 });
  }
  if ((project.introductionAudioDuration ?? 0) > project.introductionDurationSeconds) {
    return NextResponse.json({ error: `La narration d’introduction doit tenir dans les ${project.introductionDurationSeconds} secondes choisies.` }, { status: 400 });
  }
  if (scope === "all" && project.conclusionText.trim() && (
    !project.conclusionAudio ||
    project.conclusionAudioVoice !== project.voice ||
    project.conclusionAudioRate !== project.speechRate
  )) {
    return NextResponse.json({ error: "Générez la narration de conclusion avec la voix et la vitesse sélectionnées avant l’export." }, { status: 400 });
  }
  if (scope === "all" && (project.conclusionAudioDuration ?? 0) > project.conclusionDurationSeconds) {
    return NextResponse.json({ error: `La narration de conclusion doit tenir dans les ${project.conclusionDurationSeconds} secondes choisies.` }, { status: 400 });
  }
  const missingAudio = selected.some((question) =>
    !question.questionAudio || !question.answerAudio ||
    question.questionAudioVoice !== project.voice || question.answerAudioVoice !== project.voice ||
    question.questionAudioRate !== project.speechRate || question.answerAudioRate !== project.speechRate ||
    (question.questionAudioDuration ?? 16) > questionDurationFrames(question) / 30 || (question.answerAudioDuration ?? 5) > 4 ||
    (question.answerCommentary.trim() && (!question.commentaryAudio || question.commentaryAudioVoice !== project.voice || question.commentaryAudioRate !== project.speechRate || answerNarrationFrames(question.answerAudioDuration, question.commentaryAudioDuration) > 4 * 30))
  );
  if (missingAudio) {
    return NextResponse.json({ error: "Générez les voix manquantes avec la voix et la vitesse sélectionnées. La question doit tenir dans son compte à rebours et la réponse dans les 4 secondes d’affichage." }, { status: 400 });
  }
  if ([...renderJobs.values()].some((item) => item.stage === "preparing" || item.stage === "rendering" || item.stage === "queued")) {
    return NextResponse.json({ error: "Un rendu est déjà en cours." }, { status: 409 });
  }

  await ensureProjectFolders();
  await saveProject(project);
  await mkdir(exportsDirectory, { recursive: true });
  const job: RenderJob = { id: randomUUID(), stage: "queued", progress: 0, message: "En attente", startedAt: Date.now() };
  renderJobs.set(job.id, job);
  void render(job, project, scope, questionIndex).catch((error: unknown) => {
    job.stage = "failed";
    job.message = "Le rendu a échoué";
    job.error = error instanceof Error ? error.message : "Erreur inconnue pendant le rendu.";
  });
  return NextResponse.json({ id: job.id }, { headers: { "Cache-Control": "no-store" } });
}
