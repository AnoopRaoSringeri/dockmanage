import { ContainerStatus, ContainerSummary } from "@dockmanage/types";
import Docker from "dockerode";
import compose from "docker-compose";
import { docker } from "./docker-client.js";
import path from "path";
import stream from "node:stream";
import { toAbsolutePath } from "./config-files-service.js";

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
  const container = docker.getContainer(id);
  const logStreamOrBuffer = await new Promise<NodeJS.ReadableStream | Buffer>((resolve, reject) => {
    container.logs({ stdout: true, stderr: true, follow: false, tail: 200 }, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(stream as NodeJS.ReadableStream | Buffer);
    });
  });

  if (Buffer.isBuffer(logStreamOrBuffer)) {
    return logStreamOrBuffer.toString("utf8");
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

  return Buffer.concat([...chunks, ...errChunks]).toString("utf8");
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
    await compose.downMany(result.data.services.filter((s) => s.toLowerCase() != "dockmanage"),config);
    await compose.pullAll(config);
    await compose.buildAll(config);
    await compose.upAll(config);
    
    console.log('Restart complete.');
  } catch (err: any) {
    console.error('Failed to restart service:', err.message);
    throw err; // Re-throw so the caller knows it failed
  }
};