import { NextResponse } from "next/server";
import { normalizeProject } from "@/lib/quiz";
import { readProject, saveProject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const project = await readProject();
  return NextResponse.json(project, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const project = normalizeProject(await request.json().catch(() => null));
  if (!project) {
    return NextResponse.json({ error: "Le projet doit contenir entre 1 et 60 questions." }, { status: 400 });
  }
  await saveProject(project);
  return NextResponse.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
}
