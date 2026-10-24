import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/wave": ".wav",
  "audio/x-wav": ".wav",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",
};
const EXTENSION_BY_NAME: Record<string, string> = {
  mp3: ".mp3", wav: ".wav", m4a: ".m4a", aac: ".aac", ogg: ".ogg", webm: ".webm",
};

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  const extension = MIME_EXTENSIONS[file.type] ?? EXTENSION_BY_NAME[path.extname(file.name).slice(1).toLowerCase()];
  if (!extension) return NextResponse.json({ error: "Formats acceptés : MP3, WAV, M4A, AAC, OGG et WebM." }, { status: 415 });
  if (file.size === 0 || file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "Le fichier doit faire entre 1 octet et 100 Mo." }, { status: 413 });
  }

  const name = `${randomUUID()}${extension}`;
  const directory = path.join(process.cwd(), "public", "music");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, name), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  return NextResponse.json({ path: `music/${name}`, originalName: file.name });
}
