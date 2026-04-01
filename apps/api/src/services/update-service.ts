import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "path";
import { promisify } from "node:util";import { ApiError } from "../utils/api-response.js";
const execFileAsync = promisify(execFile);
const repo = "AnoopRaoSringeri/dockmanage";
const releaseApiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
const tagsApiUrl = `https://api.github.com/repos/${repo}/tags`;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const webPackagePath = path.join(repoRoot, "apps", "web", "package.json");

const parseSemver = (version: string): number[] =>
  version
    .replace(/^v/i, "")
    .split(".")
    .map((segment) => parseInt(segment, 10) || 0);

const compareSemver = (a: string, b: string): number => {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);

  for (let index = 0; index < Math.max(parsedA.length, parsedB.length); index += 1) {
    const aValue = parsedA[index] ?? 0;
    const bValue = parsedB[index] ?? 0;

    if (aValue > bValue) {
      return 1;
    }

    if (aValue < bValue) {
      return -1;
    }
  }

  return 0;
};

const getNpmCommand = (): string => (process.platform === "win32" ? "npm.cmd" : "npm");

const runCommand = async (command: string, args: string[]) => {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: repoRoot,
    windowsHide: true,
  });

  return { stdout: stdout.trim(), stderr: stderr.trim() };
};

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseName: string;
  updateAvailable: boolean;
}

export interface UpdateResult extends UpdateStatus {
  output: string;
}

export const getCurrentVersion = async (): Promise<string> => {
  const packageJson = await fs.readFile(webPackagePath, "utf8");
  const parsed = JSON.parse(packageJson) as { version?: string };

  if (!parsed.version) {
    throw new ApiError("Could not read current version from apps/web/package.json", 500);
  }

  return parsed.version;
};

const buildUpdateStatus = (
  currentVersion: string,
  latestVersion: string,
  releaseUrl: string,
  releaseName: string,
): UpdateStatus => ({
  currentVersion,
  latestVersion,
  releaseUrl,
  releaseName,
  updateAvailable: compareSemver(latestVersion, currentVersion) > 0,
});

const buildFallbackStatus = async (currentVersion: string): Promise<UpdateStatus> => ({
  currentVersion,
  latestVersion: currentVersion,
  releaseUrl: `https://github.com/${repo}`,
  releaseName: currentVersion,
  updateAvailable: false,
});

export const getLatestRelease = async (): Promise<UpdateStatus> => {
  const currentVersion = await getCurrentVersion();

  const response = await fetch(releaseApiUrl, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (response.status === 404) {
    const tagsResponse = await fetch(tagsApiUrl, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });

    if (!tagsResponse.ok) {
      return buildFallbackStatus(currentVersion);
    }

    const tags = await tagsResponse.json();
    if (!Array.isArray(tags) || tags.length === 0) {
      return buildFallbackStatus(currentVersion);
    }

    const topTag = typeof tags[0].name === "string" ? tags[0].name : "";
    const latestVersion = topTag.replace(/^v/i, "");
    if (!latestVersion) {
      return buildFallbackStatus(currentVersion);
    }

    return buildUpdateStatus(
      currentVersion,
      latestVersion,
      `https://github.com/${repo}/releases/tag/${topTag}`,
      topTag,
    );
  }

  if (!response.ok) {
    throw new ApiError(
      `Failed to fetch latest release: ${response.status} ${response.statusText}`,
      502,
    );
  }

  const json = await response.json();
  const latestVersion = typeof json.tag_name === "string" ? json.tag_name.replace(/^v/i, "") : "";
  const releaseUrl = typeof json.html_url === "string" ? json.html_url : `https://github.com/${repo}`;
  const releaseName = typeof json.name === "string" && json.name ? json.name : latestVersion;

  if (!latestVersion) {
    return buildFallbackStatus(currentVersion);
  }

  return buildUpdateStatus(currentVersion, latestVersion, releaseUrl, releaseName);
};

export const updateDockManage = async (): Promise<UpdateResult> => {
  const releaseInfo = await getLatestRelease();
  const npmCmd = getNpmCommand();
  let output = "";

  const fetchResult = await runCommand("git", ["fetch", "--tags", "origin"]);
  output += `git fetch output:\n${fetchResult.stdout}\n${fetchResult.stderr}\n`;

  const pullResult = await runCommand("git", ["pull", "--ff-only", "origin", "HEAD"]);
  output += `git pull output:\n${pullResult.stdout}\n${pullResult.stderr}\n`;

  const installResult = await runCommand(npmCmd, ["install"]);
  output += `npm install output:\n${installResult.stdout}\n${installResult.stderr}\n`;

  return {
    ...releaseInfo,
    output,
  };
};
