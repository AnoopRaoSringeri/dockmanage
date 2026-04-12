import { ContainerStatus, ContainerSummary } from "@dockmanage/types";
import Docker, { type PruneImagesInfo } from "dockerode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { docker } from "./docker-client.js";
import path from "path";
import stream from "node:stream";
import { toAbsolutePath } from "./config-files-service.js";
import { ApiError } from "../utils/api-response.js";

const stripAnsi = (input: string): string =>
  input.replace(/\x1B[@-_][0-?]*[ -/]*[@-~]/g, "");

const isReadableStream = (value: unknown): value is stream.Readable =>
  Boolean(value && typeof (value as any).on === "function" && typeof (value as any).pipe === "function");

const getContainerLogsSource = async (
  id: string,
  follow: boolean,
  tail = 100,
): Promise<stream.Readable | Buffer> => {
  const container = docker.getContainer(id);
  const options = follow
    ? { stdout: true, stderr: true, follow: true, tail }
    : { stdout: true, stderr: true, follow: false, tail };

  return new Promise<stream.Readable | Buffer>((resolve, reject) => {
    const logsFn: any = (container as any).logs;

    logsFn.call(container, options, (err: any, streamResult: any) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(streamResult as stream.Readable | Buffer);
    });
  });
};

const mapStateToStatus = (state: string): ContainerStatus => {
  if (state === "running") {
    return "running";
  }

  if (state === "restarting") {
    return "restarting";
  }

  if (state === "exited" || state === "dead" || state === "created") {
    return "stopped";
  }

  return "unknown";
};

const formatDockerError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return error;
  }

  const maybeErr = error as { code?: string; message?: string } | undefined;
  const message = maybeErr?.message ? `${fallbackMessage}: ${maybeErr.message}` : fallbackMessage;
  const status = maybeErr?.code === "ENOENT" ? 503 : 500;

  return new ApiError(message, status);
};

const extractConflictingContainerName = (errorMessage: string): string | null => {
  const match = errorMessage.match(/The container name "\/([^\"]+)"/i);
  return match ? match[1] : null;
};

const removeStoppedContainerIfExists = async (name: string): Promise<boolean> => {
  try {
    const container = docker.getContainer(name);
    const state = await container.inspect();

    if (state?.State?.Running) {
      return false;
    }

    await container.remove({ force: true });
    return true;
  } catch {
    return false;
  }
};

export const listContainers = async (): Promise<ContainerSummary[]> => {
  try {
    const containers: Docker.ContainerInfo[] = await docker.listContainers({ all: true });

    return containers.map((container) => ({
      id: container.Id,
      name: container.Names?.[0]?.replace("/", "") ?? container.Id.slice(0, 12),
      image: container.Image,
      state: container.State,
      statusText: container.Status,
      status: mapStateToStatus(container.State),
    }));
  } catch (error) {
    const maybeErr = error as { code?: string; message?: string } | undefined;
    if (maybeErr?.code === "ENOENT") {
      throw new ApiError(
        "Cannot connect to Docker. On Windows: ensure Docker Desktop is running and your user is in the 'docker-users' group, then restart this app.",
        503,
      );
    }

    throw formatDockerError(error, "Failed to list Docker containers");
  }
};

export const startContainer = async (id: string): Promise<void> => {
  try {
    await docker.getContainer(id).start();
  } catch (error) {
    throw formatDockerError(error, `Failed to start container '${id}'`);
  }
};

export const stopContainer = async (id: string): Promise<void> => {
  try {
    await docker.getContainer(id).stop();
  } catch (error) {
    throw formatDockerError(error, `Failed to stop container '${id}'`);
  }
};

export const restartContainer = async (id: string): Promise<void> => {
  try {
    await docker.getContainer(id).restart();
  } catch (error) {
    throw formatDockerError(error, `Failed to restart container '${id}'`);
  }
};

export const pruneUnusedImages = async (): Promise<PruneImagesInfo> => {
  try {
    return await new Promise<PruneImagesInfo>((resolve, reject) => {
      docker.pruneImages(
        { filters: JSON.stringify({ dangling: ["false"] }) } as any,
        (err: unknown, result: PruneImagesInfo | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          if (!result) {
            reject(new Error("Docker returned no prune result."));
            return;
          }

          resolve(result);
        },
      );
    });
  } catch (error) {
    throw formatDockerError(error, "Failed to prune unused Docker images");
  }
};

export const pruneStoppedContainers = async (): Promise<Docker.PruneContainersInfo> => {
  try {
    return await new Promise<Docker.PruneContainersInfo>((resolve, reject) => {
      docker.pruneContainers({}, (err: unknown, result: Docker.PruneContainersInfo | undefined) => {
        if (err) {
          reject(err);
          return;
        }

        if (!result) {
          reject(new Error("Docker returned no prune result."));
          return;
        }

        resolve(result);
      });
    });
  } catch (error) {
    throw formatDockerError(error, "Failed to prune stopped Docker containers");
  }
};

export const fetchContainerLogs = async (id: string): Promise<string> => {
  const logStreamOrBuffer = await getContainerLogsSource(id, false, 200);

  if (Buffer.isBuffer(logStreamOrBuffer)) {
    return stripAnsi(logStreamOrBuffer.toString("utf8"));
  }

  if (!isReadableStream(logStreamOrBuffer)) {
    return "";
  }

  const stdoutStream = new stream.PassThrough();
  const stderrStream = new stream.PassThrough();
  docker.modem.demuxStream(logStreamOrBuffer, stdoutStream, stderrStream);

  const chunks: Buffer[] = [];
  const errChunks: Buffer[] = [];

  stdoutStream.on("data", (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  stderrStream.on("data", (chunk) => {
    errChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  await new Promise<void>((resolve, reject) => {
    logStreamOrBuffer.on("end", resolve);
    logStreamOrBuffer.on("close", resolve);
    logStreamOrBuffer.on("error", reject);
  });

  return stripAnsi(Buffer.concat([...chunks, ...errChunks]).toString("utf8"));
};

export const streamContainerLogs = async (
  id: string,
  onData: (text: string) => void,
  onError: (error: unknown) => void,
  onEnd: () => void,
  tail = 100,
): Promise<() => void> => {
  const logStreamOrBuffer = await getContainerLogsSource(id, true, tail);

  if (Buffer.isBuffer(logStreamOrBuffer)) {
    onData(stripAnsi(logStreamOrBuffer.toString("utf8")));
    onEnd();
    return () => {};
  }

  if (!isReadableStream(logStreamOrBuffer)) {
    onEnd();
    return () => {};
  }

  const stdoutStream = new stream.PassThrough();
  const stderrStream = new stream.PassThrough();
  docker.modem.demuxStream(logStreamOrBuffer, stdoutStream, stderrStream);

  const pushLog = (chunk: Buffer) => {
    const text = stripAnsi(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : Buffer.from(chunk).toString("utf8"));
    if (!text.trim()) {
      return;
    }

    onData(text);
  };

  stdoutStream.on("data", pushLog);
  stderrStream.on("data", (chunk) => pushLog(Buffer.from("[stderr] " + chunk)));

  const cleanup = () => {
    stdoutStream.removeAllListeners();
    stderrStream.removeAllListeners();
    (logStreamOrBuffer as any).destroy?.();
    onEnd();
  };

  logStreamOrBuffer.on("end", cleanup);
  logStreamOrBuffer.on("close", cleanup);
  logStreamOrBuffer.on("error", onError);

  return cleanup;
};

const execFileAsync = promisify(execFile);

const runDockerCompose = async (cwd: string, args: string[]) => {
  const composeArgs = ["compose", ...args];
  const { stdout, stderr } = await execFileAsync("docker", composeArgs, {
    cwd,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (stderr) {
    console.warn("docker compose stderr:", stderr.toString());
  }

  return stdout.toString();
};

const getComposeServices = async (cwd: string, fileName: string): Promise<string[]> => {
  const output = await runDockerCompose(cwd, ["-f", fileName, "config", "--services"]);
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((service) => service.toLowerCase() !== "dockmanage");
};

export const restartService = async (filePath: string): Promise<void> => {
  const absolutePath = toAbsolutePath(filePath);
  console.log(`Running compose command in ${absolutePath}`);
  const directory = path.dirname(absolutePath);
  const fileName = path.basename(absolutePath);

  try {
    console.log(`Restarting services using: ${absolutePath}`);
    const services = await getComposeServices(directory, fileName);

    if (services.length === 0) {
      console.log("No services found to restart.");
      return;
    }

    console.log(`Restarting following services: ${services.map((s) => s).join(", ")}`)
    await runDockerCompose(directory, ["-f", fileName, "stop", ...services]);
    await runDockerCompose(directory, ["-f", fileName, "rm", "-f", ...services]);
    await runDockerCompose(directory, ["-f", fileName, "pull", ...services]);
    await runDockerCompose(directory, ["-f", fileName, "build", ...services]);
    await runDockerCompose(directory, ["-f", fileName, "up", "-d", ...services]);

    console.log("Restart complete.");
  } catch (err: any) {
    console.error("Failed to restart service:", err?.message ?? err);

    const conflictName =
      typeof err?.message === "string" ? extractConflictingContainerName(err.message) : null;
    
    if (conflictName?.toLowerCase() === "dockmanage") {
      // If dockmanage conflicts, retry after brief delay as conflict may be transient
      console.log("Conflict with dockmanage container detected - retrying after brief delay...");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        const services = await getComposeServices(directory, fileName);
        if (services.length > 0) {
          // Retry with --remove-orphans to clean up any orphaned containers
          await runDockerCompose(directory, ["-f", fileName, "up", "-d", "--remove-orphans", "--no-deps", "--no-recreate", ...services]);
        }
        console.log("Retry succeeded after conflict resolution.");
        return;
      } catch (retryError: any) {
        console.error("Retry failed:", retryError?.message ?? retryError);
        throw new ApiError(
          `Failed to restart service: ${retryError?.message ?? String(retryError)}. The dockmanage orchestrator may be under heavy load - please try again.`,
          500,
        );
      }
    }

    if (conflictName) {
      // For other container conflicts, try to remove the stale container
      console.log(`Attempting to remove stale container: ${conflictName}`);
      const removed = await removeStoppedContainerIfExists(conflictName);
      if (removed) {
        try {
          const services = await getComposeServices(directory, fileName);
          if (services.length > 0) {
            await runDockerCompose(directory, ["-f", fileName, "up", "-d", "--no-deps", "--no-recreate", ...services]);
          }
          console.log(`Retry succeeded after removing stale container ${conflictName}.`);
          return;
        } catch (retryError: any) {
          throw new ApiError(
            `Failed to restart service after removing stale container '${conflictName}': ${retryError?.message ?? String(retryError)}`,
            500,
          );
        }
      }
    }

    throw new ApiError(`Failed to restart service: ${err?.message ?? String(err)}`, 500);
  }
};
