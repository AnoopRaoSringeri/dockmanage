import { ApiResponse, ConfigFileContent, ConfigFileSummary, ContainerSummary } from "@dockmanage/types";
import axios from "axios";

const client = axios.create({
  baseURL: "/api",
});

export const fetchContainers = async (): Promise<ContainerSummary[]> => {
  const { data } = await client.get<ApiResponse<ContainerSummary[]>>("/containers");
  if (!data.success) {
    throw new Error(data.error);
  }

  return data.data;
};

export const runContainerAction = async (
  id: string,
  action: "start" | "stop" | "restart",
): Promise<void> => {
  const { data } = await client.post<ApiResponse<{ message: string }>>(`/containers/${id}/${action}`);
  if (!data.success) {
    throw new Error(data.error);
  }
};

export const fetchContainerLogs = async (id: string): Promise<string> => {
  const { data } = await client.get<ApiResponse<string>>(`/containers/${id}/logs`);
  if (!data.success) {
    throw new Error(data.error);
  }

  return data.data;
};

export const fetchConfigFiles = async (): Promise<ConfigFileSummary[]> => {
  const { data } = await client.get<ApiResponse<ConfigFileSummary[]>>("/config-files");
  if (!data.success) {
    throw new Error(data.error);
  }

  return data.data;
};

export const fetchConfigFileContent = async (configPath: string): Promise<ConfigFileContent> => {
  const { data } = await client.get<ApiResponse<ConfigFileContent>>("/config-files/content", {
    params: { path: configPath },
  });

  if (!data.success) {
    throw new Error(data.error);
  }

  return data.data;
};

export const saveConfigFileContent = async (payload: ConfigFileContent): Promise<ConfigFileContent> => {
  const { data } = await client.post<ApiResponse<ConfigFileContent>>("/config-files/content", payload);
  if (!data.success) {
    throw new Error(data.error);
  }

  return data.data;
};
