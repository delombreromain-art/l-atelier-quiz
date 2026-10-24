export type RenderStage = "queued" | "preparing" | "rendering" | "completed" | "failed";

export type RenderJob = {
  id: string;
  stage: RenderStage;
  progress: number;
  message: string;
  filename?: string;
  outputPath?: string;
  error?: string;
  startedAt: number;
};

const processState = globalThis as typeof globalThis & {
  atelierQuizRenderJobs?: Map<string, RenderJob>;
};

export const renderJobs = processState.atelierQuizRenderJobs ?? new Map<string, RenderJob>();
processState.atelierQuizRenderJobs = renderJobs;
