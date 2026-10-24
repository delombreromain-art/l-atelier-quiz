import { NextResponse } from "next/server";
import { renderJobs } from "@/lib/render-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = renderJobs.get(id);
  if (!job) return NextResponse.json({ error: "Rendu introuvable." }, { status: 404 });
  return NextResponse.json({
    id: job.id,
    stage: job.stage,
    progress: job.progress,
    message: job.message,
    error: job.error,
    downloadUrl: job.stage === "completed" ? `/api/render/${job.id}/file` : undefined,
  }, { headers: { "Cache-Control": "no-store" } });
}
