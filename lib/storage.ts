import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultProject, normalizeProject, type QuizProject } from "./quiz";
import { trimTrailingSilenceForLoop } from "./music-loop";

export const projectRoot = process.cwd();
export const dataDirectory = path.join(projectRoot, "data");
export const projectFile = path.join(dataDirectory, "atelier-quiz.json");
export const projectsDirectory = path.join(dataDirectory, "projects");
export const projectIndexFile = path.join(dataDirectory, "atelier-quiz-projects.json");
export const exportsDirectory = path.join(dataDirectory, "exports");
const DEFAULT_PROJECT_ID = "principal";
const safeId = (id?: string) => id && /^[a-z0-9-]{1,80}$/i.test(id) ? id : DEFAULT_PROJECT_ID;
const fileFor = (id: string) => id === DEFAULT_PROJECT_ID ? projectFile : path.join(projectsDirectory, `${id}.json`);
const riddleRecordingTemplateFile = path.join(dataDirectory, "voice-work", "hidden-expression-recording.json");
type ProjectIndex = { projects: { id: string; title: string }[] };

type RiddleRecordingTemplate = {
  questionRecording: string;
  questionRecordingDuration: number;
  questionRecordingOriginal: string | null;
  questionRecordingOriginalDuration: number | null;
  questionRecordingTakes: QuizProject["questions"][number]["questionRecordingTakes"];
  questionRecordingClips: QuizProject["questions"][number]["questionRecordingClips"];
};

const applyRiddleRecordingTemplate = async (project: QuizProject): Promise<QuizProject> => {
  let template: RiddleRecordingTemplate;
  try {
    template = JSON.parse(await readFile(riddleRecordingTemplateFile, "utf8")) as RiddleRecordingTemplate;
  } catch {
    return project;
  }
  if (!template.questionRecording || !Number.isFinite(template.questionRecordingDuration)) return project;
  let changed = false;
  const questions = project.questions.map((question) => {
    if (!question.isRiddle || question.questionRecording) return question;
    const takeIds = new Map(template.questionRecordingTakes.map((take) => [take.id, randomUUID()]));
    changed = true;
    return {
      ...question,
      questionRecording: template.questionRecording,
      questionRecordingDuration: template.questionRecordingDuration,
      questionRecordingOriginal: template.questionRecordingOriginal,
      questionRecordingOriginalDuration: template.questionRecordingOriginalDuration,
      questionRecordingTakes: template.questionRecordingTakes.map((take) => ({ ...take, id: takeIds.get(take.id) ?? randomUUID() })),
      questionRecordingClips: template.questionRecordingClips.map((clip) => ({ ...clip, id: randomUUID(), takeId: takeIds.get(clip.takeId) ?? clip.takeId })),
      questionVoiceSource: "recording" as const,
    };
  });
  return changed ? { ...project, questions } : project;
};

export const ensureProjectFolders = async () => {
  await Promise.all([
    mkdir(dataDirectory, { recursive: true }), mkdir(projectsDirectory, { recursive: true }), mkdir(exportsDirectory, { recursive: true }),
    mkdir(path.join(projectRoot, "public", "media"), { recursive: true }), mkdir(path.join(projectRoot, "public", "audio"), { recursive: true }), mkdir(path.join(projectRoot, "public", "music"), { recursive: true }),
  ]);
};

const readIndex = async (): Promise<ProjectIndex> => {
  await ensureProjectFolders();
  try {
    const parsed = JSON.parse(await readFile(projectIndexFile, "utf8")) as ProjectIndex;
    if (Array.isArray(parsed.projects) && parsed.projects.some((p) => p.id === DEFAULT_PROJECT_ID)) return parsed;
  } catch { /* Create a local index for the original project. */ }
  const index: ProjectIndex = { projects: [{ id: DEFAULT_PROJECT_ID, title: "Mon premier quiz" }] };
  await writeFile(projectIndexFile, JSON.stringify(index, null, 2), "utf8");
  return index;
};

export const listProjects = async () => {
  const index = await readIndex();
  const projects = await Promise.all(index.projects.map(async (entry) => ({ ...entry, project: await readProject(entry.id) })));
  return projects.map(({ id, project }) => ({ id, title: project.title }));
};

export const createProject = async (project: QuizProject, title: string) => {
  const index = await readIndex();
  const id = randomUUID();
  const templatedProject = await applyRiddleRecordingTemplate(project);
  const music = templatedProject.backgroundMusic ? await trimTrailingSilenceForLoop(templatedProject.backgroundMusic) : null;
  const projectToCopy = music?.trimmed ? { ...templatedProject, backgroundMusic: music.path } : templatedProject;
  const copy = { ...projectToCopy, title: title.slice(0, 120) || "Nouveau quiz", questions: projectToCopy.questions.map((question) => ({ ...question })), archivedQuestions: projectToCopy.archivedQuestions.map((question) => ({ ...question })) };
  await writeFile(fileFor(id), JSON.stringify(copy, null, 2), "utf8");
  index.projects.push({ id, title: copy.title });
  await writeFile(projectIndexFile, JSON.stringify(index, null, 2), "utf8");
  return { id, title: copy.title };
};

export const readProject = async (id?: string): Promise<QuizProject> => {
  await ensureProjectFolders();
  const selectedId = safeId(id);
  try {
    const value: unknown = JSON.parse(await readFile(fileFor(selectedId), "utf8"));
    return normalizeProject(value) ?? defaultProject;
  } catch {
    if (selectedId !== DEFAULT_PROJECT_ID) return defaultProject;
    await writeFile(projectFile, JSON.stringify(defaultProject, null, 2), "utf8");
    return defaultProject;
  }
};

export const saveProject = async (project: QuizProject, id?: string) => {
  await ensureProjectFolders();
  const selectedId = safeId(id);
  const templatedProject = await applyRiddleRecordingTemplate(project);
  await writeFile(fileFor(selectedId), JSON.stringify(templatedProject, null, 2), "utf8");
  const index = await readIndex();
  const entry = index.projects.find((item) => item.id === selectedId);
  if (entry) entry.title = templatedProject.title;
  else index.projects.push({ id: selectedId, title: templatedProject.title });
  await writeFile(projectIndexFile, JSON.stringify(index, null, 2), "utf8");
};
