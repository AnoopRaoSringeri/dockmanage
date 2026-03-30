import { ContainerStatus, ContainerSummary } from "@dockmanage/types";
import Docker from "dockerode";
import { docker } from "./docker-client.js";

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
