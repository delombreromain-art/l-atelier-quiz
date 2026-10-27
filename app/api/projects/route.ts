import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/storage";
import { normalizeProject } from "@/lib/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listProjects(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { project?: unknown; title?: unknown } | null;
  const project = normalizeProject(body?.project);
  if (!project) return NextResponse.json({ error: "Le quiz source est invalide." }, { status: 400 });
  const title = typeof body?.title === "string" ? body.title : "Mon deuxième quiz";
  const created = await createProject(project, title);
  return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
}
