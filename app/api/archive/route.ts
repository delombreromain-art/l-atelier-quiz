import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { normalizeProject } from "@/lib/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARCHIVE_ROOT = "C:\\Users\\Romain DELOMBRE\\Desktop\\l'atelier quiz fichiers principaux\\Archive Quiz";
const ASSET_FOLDERS = new Set(["media", "audio", "music"]);

function safeAssetPath(value: string) {
  const normalized = path.posix.normalize(value.replace(/\\/g, "/").replace(/^\/+/, ""));
  const [folder, ...parts] = normalized.split("/");
  if (!ASSET_FOLDERS.has(folder) || parts.length === 0 || parts.some((part) => !part || part === "." || part === "..")) return null;
  return [folder, ...parts].join("/");
}

function collectAssets(value: unknown, assets = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    const asset = safeAssetPath(value);
    if (asset) assets.add(asset);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectAssets(item, assets));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectAssets(item, assets));
  }
  return assets;
}

function safeFolderName(title: string) {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "quiz";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { project?: unknown } | null;
  const project = normalizeProject(body?.project);
  if (!project) return NextResponse.json({ error: "Le projet du quiz est invalide." }, { status: 400 });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const folderName = `${safeFolderName(project.title)}_${timestamp}_${randomUUID().slice(0, 8)}`;
  const archiveDirectory = path.join(ARCHIVE_ROOT, folderName);
  const publicDirectory = path.join(process.cwd(), "public");
  const assets = [...collectAssets(project)].sort();

  try {
    await mkdir(ARCHIVE_ROOT, { recursive: true });
    await mkdir(archiveDirectory, { recursive: false });

    for (const asset of assets) {
      const source = path.resolve(publicDirectory, ...asset.split("/"));
      const publicRoot = path.resolve(publicDirectory) + path.sep;
      if (!source.startsWith(publicRoot)) throw new Error("Un chemin de média du projet est invalide.");
      const destination = path.join(archiveDirectory, ...asset.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }

    const temporaryProjectPath = path.join(archiveDirectory, "project.json.tmp");
    await writeFile(temporaryProjectPath, JSON.stringify(project, null, 2), { encoding: "utf8", flag: "wx" });
    await rename(temporaryProjectPath, path.join(archiveDirectory, "project.json"));

    const manifest = {
      exportedAt: new Date().toISOString(),
      projectTitle: project.title,
      questions: project.questions.length,
      archivedQuestions: project.archivedQuestions.length,
      assets,
    };
    await writeFile(path.join(archiveDirectory, "archive-manifest.json"), JSON.stringify(manifest, null, 2), { encoding: "utf8", flag: "wx" });

    return NextResponse.json({
      folder: folderName,
      questions: project.questions.length + project.archivedQuestions.length,
      images: assets.filter((asset) => asset.startsWith("media/")).length,
      assets: assets.length,
    });
  } catch (error) {
    await rm(archiveDirectory, { recursive: true, force: true }).catch(() => undefined);
    const missingAsset = error instanceof Error && "code" in error && error.code === "ENOENT";
    return NextResponse.json({
      error: missingAsset
        ? "Une image ou un média du quiz est introuvable. Aucune copie partielle n’a été conservée."
        : "La copie complète n’a pas pu être créée dans le dossier Archive Quiz.",
    }, { status: 500 });
  }
}
