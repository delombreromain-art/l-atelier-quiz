import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { renderJobs } from "@/lib/render-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = renderJobs.get(id);
  if (!job || job.stage !== "completed" || !job.outputPath || !job.filename) {
    return NextResponse.json({ error: "La vidéo n’est pas prête." }, { status: 404 });
  }
  const info = await stat(job.outputPath);
  const stream = Readable.toWeb(createReadStream(job.outputPath)) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(info.size),
      "Content-Disposition": `attachment; filename="${job.filename}"; filename*=UTF-8''${encodeURIComponent(job.filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
