import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { normalizeProject } from "@/lib/quiz";
import { readProject, saveProject, projectRoot } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const project = await readProject();
  return NextResponse.json(project, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const project = normalizeProject(await request.json().catch(() => null));
  if (!project) {
    return NextResponse.json({ error: "Le projet doit contenir entre 1 et 5000 questions, avec 60 questions actives maximum." }, { status: 400 });
  }
  const previous = await readProject();
  await saveProject(project);
  const recordingPaths = (value: typeof project) => [
    value.introductionRecording, value.conclusionRecording,
    ...value.questions.flatMap((question) => [question.questionRecording, question.answerRecording, question.commentaryRecording]),
  ].filter((asset): asset is string => Boolean(asset));
  const retained = new Set(recordingPaths(project));
  const removed = new Set(recordingPaths(previous).filter((asset) => !retained.has(asset)));
  await Promise.all([...removed].map(async (asset) => {
    if (!/^audio\/[0-9a-f-]{36}\.(webm|m4a|ogg|wav|mp3)$/i.test(asset)) return;
    await unlink(path.join(projectRoot, "public", asset)).catch(() => undefined);
  }));
  return NextResponse.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
}
