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
  const containers: Docker.ContainerInfo[] = await docker.listContainers({ all: true });

  return containers.map((container) => ({
    id: container.Id,
    name: container.Names?.[0]?.replace("/", "") ?? container.Id.slice(0, 12),
    image: container.Image,
    state: container.State,
    statusText: container.Status,
    status: mapStateToStatus(container.State),
  }));
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
