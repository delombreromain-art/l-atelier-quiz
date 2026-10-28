import { createHash } from "node:crypto";
import { access, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MINIMUM_TRAILING_SILENCE_SECONDS = 0.25;

export type LoopMusicResult = { path: string; trimmed: boolean; duration: number | null };

const toolPath = (name: "ffmpeg.exe" | "ffprobe.exe") => path.join(process.cwd(), "node_modules", "@remotion", "compositor-win32-x64-msvc", name);

const getDuration = async (filePath: string) => {
  const { stdout } = await execFileAsync(toolPath("ffprobe.exe"), [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath,
  ], { windowsHide: true });
  const duration = Number.parseFloat(stdout.trim());
  return Number.isFinite(duration) && duration > 0 ? duration : null;
};

export const trimTrailingSilenceForLoop = async (asset: string): Promise<LoopMusicResult> => {
  const normalizedAsset = asset.replace(/^\/+/, "").replace(/\\/g, "/");
  const publicRoot = path.resolve(process.cwd(), "public");
  const musicRoot = path.resolve(publicRoot, "music");
  const sourcePath = path.resolve(publicRoot, normalizedAsset);
  if (!normalizedAsset.startsWith("music/") || !sourcePath.startsWith(`${musicRoot}${path.sep}`)) {
    return { path: asset, trimmed: false, duration: null };
  }

  try { await access(sourcePath); }
  catch { return { path: asset, trimmed: false, duration: null }; }

  const duration = await getDuration(sourcePath).catch(() => null);
  if (!duration) return { path: asset, trimmed: false, duration: null };

  const { stderr } = await execFileAsync(toolPath("ffmpeg.exe"), [
    "-i", sourcePath,
    "-af", "silencedetect=noise=-50dB:d=0.1",
    "-f", "null", "NUL",
  ], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }).catch(() => ({ stderr: "" }));

  const silenceStarts = [...stderr.matchAll(/silence_start:\s*([0-9.]+)/g)].map((match) => Number(match[1]));
  const silenceEnds = [...stderr.matchAll(/silence_end:\s*([0-9.]+)/g)].map((match) => Number(match[1]));
  const lastSilenceStart = silenceStarts.at(-1);
  const lastSilenceEnd = silenceEnds.at(-1) ?? -1;
  const trailingSilence = lastSilenceStart !== undefined && lastSilenceStart > lastSilenceEnd
    ? duration - lastSilenceStart
    : 0;

  if (trailingSilence < MINIMUM_TRAILING_SILENCE_SECONDS) {
    return { path: asset, trimmed: false, duration };
  }

  const digest = createHash("sha256").update(`${normalizedAsset}\0${duration}\0${lastSilenceStart}`).digest("hex").slice(0, 16);
  const outputName = `${path.basename(normalizedAsset, path.extname(normalizedAsset))}-loop-${digest}.mp3`;
  const outputPath = path.join(musicRoot, outputName);
  await mkdir(musicRoot, { recursive: true });
  try { await access(outputPath); }
  catch {
    try {
      await execFileAsync(toolPath("ffmpeg.exe"), [
        "-y", "-i", sourcePath,
        "-af", `atrim=end=${lastSilenceStart!.toFixed(6)},asetpts=PTS-STARTPTS`,
        "-map_metadata", "0", "-c:a", "libmp3lame", "-q:a", "2", outputPath,
      ], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    } catch {
      await rm(outputPath, { force: true }).catch(() => undefined);
      return { path: asset, trimmed: false, duration };
    }
  }

  const outputDuration = await getDuration(outputPath).catch(() => null);
  if (!outputDuration) return { path: asset, trimmed: false, duration };
  return { path: `music/${outputName}`, trimmed: true, duration: outputDuration };
};
