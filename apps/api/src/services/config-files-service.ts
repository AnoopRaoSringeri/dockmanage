import { ConfigFileContent, ConfigFileSummary } from "@dockmanage/types";
import { promises as fs } from "node:fs";
import path from "node:path";

const defaultConfigDir = path.resolve(process.cwd(), "docker");
const configDir = path.resolve(process.env.DOCKMANAGE_CONFIG_DIR ?? defaultConfigDir);

const ensureConfigDirectory = async () => {
  await fs.mkdir(configDir, { recursive: true });
};

const resolveSafeConfigPath = (relativeConfigPath: string): string => {
  const normalized = relativeConfigPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const fullPath = path.resolve(configDir, normalized);

  if (!fullPath.startsWith(configDir)) {
    throw new Error("Invalid config path");
  }

  return fullPath;
};

const toRelativePath = (absolutePath: string): string =>
  path.relative(configDir, absolutePath).replace(/\\/g, "/");

const collectYamlFiles = async (directory: string): Promise<string[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const absoluteEntryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectYamlFiles(absoluteEntryPath);
      results.push(...nested);
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))) {
      results.push(absoluteEntryPath);
    }
  }

  return results;
};

export const listConfigFiles = async (): Promise<ConfigFileSummary[]> => {
  await ensureConfigDirectory();
  const files = await collectYamlFiles(configDir);

  return files
    .map((filePath) => ({
      path: toRelativePath(filePath),
      name: path.basename(filePath),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
};

export const readConfigFile = async (relativeConfigPath: string): Promise<ConfigFileContent> => {
  await ensureConfigDirectory();
  const fullPath = resolveSafeConfigPath(relativeConfigPath);
  const content = await fs.readFile(fullPath, "utf8");

  return {
    path: toRelativePath(fullPath),
    content,
  };
};

export const saveConfigFile = async (relativeConfigPath: string, content: string): Promise<ConfigFileContent> => {
  await ensureConfigDirectory();
  const fullPath = resolveSafeConfigPath(relativeConfigPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf8");

  return {
    path: toRelativePath(fullPath),
    content,
  };
};
