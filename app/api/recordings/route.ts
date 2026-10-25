import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const formats: Record<string, string> = {
  "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3",
};

export async function POST(request: Request) {
  const body = await request.formData();
  const file = body.get("file");
  const duration = Number(body.get("duration"));
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Aucun enregistrement reçu." }, { status: 400 });
  if (file.size > 250 * 1024 * 1024) return NextResponse.json({ error: "L’enregistrement dépasse la limite de 250 Mo." }, { status: 413 });
  const mime = file.type.split(";")[0].trim().toLowerCase();
  const extension = formats[mime];
  if (!extension) return NextResponse.json({ error: `Format audio non pris en charge (${mime || "inconnu"}).` }, { status: 415 });
  if (!Number.isFinite(duration) || duration <= 0) return NextResponse.json({ error: "Durée d’enregistrement invalide." }, { status: 400 });
  const filename = `${randomUUID()}.${extension}`;
  const directory = path.join(process.cwd(), "public", "audio");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ path: `audio/${filename}`, duration, mimeType: mime });
}
