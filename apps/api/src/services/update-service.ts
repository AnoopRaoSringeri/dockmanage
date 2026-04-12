import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { docker } from "./docker-client.js";
import { ApiError } from "../utils/api-response.js";

const execFileAsync = promisify(execFile);
const repo = "AnoopRaoSringeri/dockmanage";
const tagsApiUrl = `https://api.github.com/repos/${repo}/tags`;

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
  try {
    const containers: any[] = await docker.listContainers({ all: true });
    const dockmanageContainer = containers.find(
      c => c.Names?.some((name: string) => name.includes("dockmanage")) ||
           c.Image?.includes("dockmanage")
    );

    if (!dockmanageContainer) {
      throw new ApiError("DockManage container not found", 500);
    }

    const image = dockmanageContainer.Image;
    const imageParts = image.split(":");
    const version = imageParts.length > 1 ? imageParts[imageParts.length - 1] : "unknown";

    return version;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Failed to get DockManage container version", 500);
  }
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

export const getLatestRelease = async (): Promise<UpdateStatus> => {
  const currentVersion = await getCurrentVersion();

  try {
    const tagsResponse = await fetch(tagsApiUrl, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });

    if (!tagsResponse.ok) {
      throw new ApiError(
        `Failed to fetch tags: ${tagsResponse.status} ${tagsResponse.statusText}`,
        502,
      );
    }

    const tags = await tagsResponse.json();
    if (!Array.isArray(tags) || tags.length === 0) {
      return buildUpdateStatus(
        currentVersion,
        currentVersion,
        `https://github.com/${repo}`,
        "Current",
      );
    }

    const topTag = typeof tags[0].name === "string" ? tags[0].name : "";
    const latestVersion = topTag.replace(/^v/i, "");

    if (!latestVersion) {
      return buildUpdateStatus(
        currentVersion,
        currentVersion,
        `https://github.com/${repo}`,
        "Current",
      );
    }

    return buildUpdateStatus(
      currentVersion,
      latestVersion,
      `https://github.com/${repo}/releases/tag/${topTag}`,
      topTag,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Failed to fetch latest version from GitHub", 502);
  }
};

export const updateDockManage = async (): Promise<UpdateResult> => {
  const releaseInfo = await getLatestRelease();
  let output = "";

  if (!releaseInfo.updateAvailable) {
    output = "Already on the latest version.";
    return {
      ...releaseInfo,
      output,
    };
  }

  try {
    const newImageTag = `anoopraosringeri/dockmanage:${releaseInfo.latestVersion}`;
    output += `Pulling new image: ${newImageTag}\n`;

    const { stdout: pullOutput, stderr: pullError } = await execFileAsync("docker", [
      "pull",
      newImageTag,
    ]);

    output += `Pull output:\n${pullOutput}\n`;
    if (pullError) {
      output += `Pull stderr:\n${pullError}\n`;
    }

    // Restart the dockmanage container using docker-compose if available
    const configDir = process.env.DOCKMANAGE_CONFIG_DIR || "/app/docker";
    output += `\nRestarting dockmanage container...\n`;

    try {
      const { stdout: upOutput, stderr: upError } = await execFileAsync("docker", [
        "compose",
        "-f",
        `${configDir}/docker-compose.yml`,
        "up",
        "-d",
        "dockmanage",
      ]);

      output += `Restart output:\n${upOutput}\n`;
      if (upError) {
        output += `Restart stderr:\n${upError}\n`;
      }
      output += `\nUpdate completed successfully!\n`;
    } catch {
      output += `Note: Could not auto-restart container via docker-compose. Please manually restart the dockmanage service.\n`;
    }

    return {
      ...releaseInfo,
      output,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new ApiError(`Failed to update DockManage: ${errorMessage}`, 500);
  }
};
