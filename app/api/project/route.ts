import { NextResponse } from "next/server";
import { normalizeProject } from "@/lib/quiz";
import { readProject, saveProject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const project = await readProject(new URL(request.url).searchParams.get("id") ?? undefined);
  return NextResponse.json(project, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? undefined;
  const project = normalizeProject(await request.json().catch(() => null));
  if (!project) {
    return NextResponse.json({ error: "Le projet doit contenir au maximum 5000 questions dans sa bibliothèque et son archive, avec 60 questions actives maximum." }, { status: 400 });
  }
  await saveProject(project, id);
  return NextResponse.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
}
