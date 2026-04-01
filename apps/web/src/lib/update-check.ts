import pkg from "../../package.json";

const repo = "AnoopRaoSringeri/dockmanage";
const releaseApiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

export const currentVersion = pkg.version;

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

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseName: string;
  updateAvailable: boolean;
}

export const checkForUpdates = async (): Promise<UpdateCheckResult> => {
  const response = await fetch(releaseApiUrl, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch latest release: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const latestVersion = typeof json.tag_name === "string" ? json.tag_name.replace(/^v/i, "") : "";
  const releaseUrl = typeof json.html_url === "string" ? json.html_url : "https://github.com/${repo}";
  const releaseName = typeof json.name === "string" && json.name ? json.name : latestVersion;

  if (!latestVersion) {
    throw new Error("Invalid release information received");
  }

  return {
    currentVersion: pkg.version,
    latestVersion,
    releaseUrl,
    releaseName,
    updateAvailable: compareSemver(latestVersion, pkg.version) > 0,
  };
};
