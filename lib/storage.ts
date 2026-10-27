import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultProject, normalizeProject, type QuizProject } from "./quiz";

export const projectRoot = process.cwd();
export const dataDirectory = path.join(projectRoot, "data");
export const projectFile = path.join(dataDirectory, "atelier-quiz.json");
export const projectsDirectory = path.join(dataDirectory, "projects");
export const projectIndexFile = path.join(dataDirectory, "atelier-quiz-projects.json");
export const exportsDirectory = path.join(dataDirectory, "exports");
const DEFAULT_PROJECT_ID = "principal";
const safeId = (id?: string) => id && /^[a-z0-9-]{1,80}$/i.test(id) ? id : DEFAULT_PROJECT_ID;
const fileFor = (id: string) => id === DEFAULT_PROJECT_ID ? projectFile : path.join(projectsDirectory, `${id}.json`);
type ProjectIndex = { projects: { id: string; title: string }[] };

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
  const copy = { ...project, title: title.slice(0, 120) || "Nouveau quiz", questions: project.questions.map((question) => ({ ...question })), archivedQuestions: project.archivedQuestions.map((question) => ({ ...question })) };
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
  await writeFile(fileFor(selectedId), JSON.stringify(project, null, 2), "utf8");
  const index = await readIndex();
  const entry = index.projects.find((item) => item.id === selectedId);
  if (entry) entry.title = project.title;
  else index.projects.push({ id: selectedId, title: project.title });
  await writeFile(projectIndexFile, JSON.stringify(index, null, 2), "utf8");
};
