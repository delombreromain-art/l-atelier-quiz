import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultProject, normalizeProject, type QuizProject } from "./quiz";

export const projectRoot = process.cwd();
export const dataDirectory = path.join(projectRoot, "data");
export const projectFile = path.join(dataDirectory, "atelier-quiz.json");
export const exportsDirectory = path.join(dataDirectory, "exports");

export const ensureProjectFolders = async () => {
  await Promise.all([
    mkdir(dataDirectory, { recursive: true }),
    mkdir(exportsDirectory, { recursive: true }),
    mkdir(path.join(projectRoot, "public", "media"), { recursive: true }),
    mkdir(path.join(projectRoot, "public", "audio"), { recursive: true }),
    mkdir(path.join(projectRoot, "public", "music"), { recursive: true }),
  ]);
};

export const readProject = async (): Promise<QuizProject> => {
  await ensureProjectFolders();
  try {
    const value: unknown = JSON.parse(await readFile(projectFile, "utf8"));
    return normalizeProject(value) ?? defaultProject;
  } catch {
    await writeFile(projectFile, JSON.stringify(defaultProject, null, 2), "utf8");
    return defaultProject;
  }
};

export const saveProject = async (project: QuizProject) => {
  await ensureProjectFolders();
  await writeFile(projectFile, JSON.stringify(project, null, 2), "utf8");
};
