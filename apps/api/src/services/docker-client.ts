import Docker from "dockerode";
import os from "node:os";

interface DockerConnectionConfig {
  socketPath?: string;
  host?: string;
  port?: number;
  protocol?: "http" | "https";
}

const getDefaultSocketPath = (): string => {
  const platform = os.platform();

  if (platform === "win32") {
    // Native Windows named pipe path used by Docker Desktop.
    return "\\\\.\\pipe\\docker_engine";
  }

  // Linux and macOS both use the Docker unix socket by default.
  return "/var/run/docker.sock";
};

const fromDockerHostEnv = (dockerHost: string): DockerConnectionConfig => {
  if (dockerHost.startsWith("unix://")) {
    return { socketPath: dockerHost.replace("unix://", "") };
  }

  if (dockerHost.startsWith("npipe://")) {
    const raw = dockerHost.replace("npipe://", "");
    const normalized = raw.startsWith("//./pipe/")
      ? `npipe:////${raw.replace(/^\/+/, "")}`
      : `npipe:////./pipe/${raw.replace(/^\/+/, "")}`;

    return { socketPath: normalized };
  }

  if (dockerHost.startsWith("npipe:////")) {
    return { socketPath: dockerHost };
  }

  const normalizedHost = dockerHost.startsWith("tcp://")
    ? dockerHost.replace("tcp://", "http://")
    : dockerHost;

  const parsed = new URL(normalizedHost);

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 2375,
    protocol: parsed.protocol === "https:" ? "https" : "http",
  };
};

const getDockerConnectionConfig = (): DockerConnectionConfig => {
  const dockerHost = process.env.DOCKER_HOST;
  if (dockerHost) {
    return fromDockerHostEnv(dockerHost);
  }

  return { socketPath: process.env.DOCKER_SOCKET_PATH ?? getDefaultSocketPath() };
};

export const docker = new Docker(getDockerConnectionConfig());
