import { ContainerStatus, ContainerSummary } from "@dockmanage/types";
import Docker from "dockerode";
import compose from "docker-compose";
import { docker } from "./docker-client.js";
import path from "path";
import stream from "node:stream";
import { toAbsolutePath } from "./config-files-service.js";

const stripAnsi = (input: string): string =>
  input.replace(/\x1B[@-_][0-?]*[ -/]*[@-~]/g, "");

const getContainerLogsSource = async (
  id: string,
  follow: boolean,
  tail = 100,
): Promise<NodeJS.ReadableStream | Buffer> => {
  const container = docker.getContainer(id);
  const options = { stdout: true, stderr: true, follow, tail } as any;

  return new Promise<NodeJS.ReadableStream | Buffer>((resolve, reject) => {
    container.logs(options, (err: unknown, streamResult: unknown) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(streamResult as NodeJS.ReadableStream | Buffer);
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
      throw new Error(
        "Cannot connect to Docker. On Windows: ensure Docker Desktop is running and your user is in the 'docker-users' group, then restart this app.",
      );
    }

    throw error;
  }
};

export const startContainer = async (id: string): Promise<void> => {
  await docker.getContainer(id).start();
};

export const stopContainer = async (id: string): Promise<void> => {
  await docker.getContainer(id).stop();
};

export const restartContainer = async (id: string): Promise<void> => {
  await docker.getContainer(id).restart();
};

export const fetchContainerLogs = async (id: string): Promise<string> => {
  const logStreamOrBuffer = await getContainerLogsSource(id, false, 200);

  if (Buffer.isBuffer(logStreamOrBuffer)) {
    return stripAnsi(logStreamOrBuffer.toString("utf8"));
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

export const restartService = async (filePath: string): Promise<void> => {
  // Convert the provided path into an absolute directory path
  const absolutePath = toAbsolutePath(filePath)
  console.log(`Running compose command in ${absolutePath}`);
  // If filePath points to a file, get its directory
  const directory = path.dirname(absolutePath);
  const fileName = path.basename(absolutePath);

  const config = { 
    cwd: directory, 
    config: fileName, // Ensures it uses the specific file provided
    log: true 
  };

  try {
    console.log(`Restarting services using: ${absolutePath}`);
    
    const result = await compose.configServices(config)
    console.log("Found following services")
    console.log(result.data.services)
    const filteredService = result.data.services.filter((s) => s.toLowerCase() != "dockmanage");
    await compose.downMany(filteredService,config);
    await compose.pullMany(filteredService,config);
    await compose.buildMany(filteredService,config);
    await compose.upMany(filteredService,config);
    
    console.log('Restart complete.');
  } catch (err: any) {
    console.error('Failed to restart service:', err.message);
    throw err; // Re-throw so the caller knows it failed
  }
};