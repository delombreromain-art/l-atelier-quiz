import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { isVoiceId } from "@/lib/quiz";

const execFileAsync = promisify(execFile);
const MAX_TEXT_LENGTH = 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function measureAudio(file: string) {
  const ffprobe = path.join(process.cwd(), "node_modules", "@remotion", "compositor-win32-x64-msvc", "ffprobe.exe");
  const { stdout } = await execFileAsync(ffprobe, [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file,
  ]);
  return Number.parseFloat(stdout.trim());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as null | { text?: unknown; voice?: unknown; rate?: unknown };
  if (typeof body?.text !== "string" || !body.text.trim() || body.text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Le texte doit contenir entre 1 et 1 000 caractères." }, { status: 400 });
  }
  if (!isVoiceId(body.voice)) return NextResponse.json({ error: "Voix française inconnue." }, { status: 400 });
  const rate = Math.min(120, Math.max(80, Number(body.rate) || 100));
  const text = body.text.trim();
  const digest = createHash("sha256").update(`${body.voice}\u0000${rate}\u0000${text}`).digest("hex");
  const audioName = `${digest}.wav`;
  const root = process.cwd();
  const publicAudioPath = path.join(root, "public", "audio", audioName);
  const modelPath = path.join(root, "data", "voices", `${body.voice}.onnx`);
  const piperPython = path.join(root, ".tools", "piper-env", "Scripts", "python.exe");
  const synthScript = path.join(root, "scripts", "synthesize.py");
  await mkdir(path.dirname(publicAudioPath), { recursive: true });

  let cached = true;
  try { await stat(publicAudioPath); }
  catch {
    cached = false;
    try {
      await Promise.all([stat(modelPath), stat(piperPython), stat(synthScript)]);
    } catch {
      return NextResponse.json({ error: "Piper n’est pas installé. Lancez `npm run setup:voice` une première fois." }, { status: 503 });
    }
    const tempFile = `${publicAudioPath}.tmp-${randomUUID()}`;
    try {
      await execFileAsync(piperPython, [synthScript, modelPath, text, tempFile, String(rate)], {
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024,
      });
      await rename(tempFile, publicAudioPath);
    } catch (error) {
      await rm(tempFile, { force: true }).catch(() => undefined);
      const details = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "";
      const message = error instanceof Error ? error.message : "Le moteur vocal n’a pas répondu.";
      return NextResponse.json({ error: `La synthèse vocale a échoué : ${details || message}` }, { status: 500 });
    }
  }

  try {
    const duration = await measureAudio(publicAudioPath);
    return NextResponse.json({ audio: `audio/${audioName}`, duration, cached }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de mesurer la narration.";
    return NextResponse.json({ error: `La voix a été créée, mais sa durée n’a pas pu être lue : ${message}` }, { status: 500 });
  }
}
