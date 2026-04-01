import { ApiResponse, ConfigFileContent, ConfigFileSummary, ContainerSummary, UpdateResult, UpdateStatus } from "@dockmanage/types";
import axios, { type AxiosResponse } from "axios";

const client = axios.create({
  baseURL: "/api",
});

const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const response = error.response;
    if (response?.data && typeof response.data === "object") {
      const apiResponse = response.data as ApiResponse<unknown>;
      if (!apiResponse.success && typeof apiResponse.error === "string") {
        return apiResponse.error;
      }
    }

    return error.message || "Network error";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown error";
};

const getApiData = async <T>(request: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> => {
  try {
    const { data } = await request;
    if (!data.success) {
      throw new Error(data.error);
    }

    return data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const fetchContainers = async (): Promise<ContainerSummary[]> =>
  getApiData(client.get<ApiResponse<ContainerSummary[]>>("/containers"));

export const runContainerAction = async (
  id: string,
  action: "start" | "stop" | "restart",
): Promise<void> => {
  await getApiData(client.post<ApiResponse<{ message: string }>>(`/containers/${id}/${action}`));
};

export const fetchContainerLogs = async (id: string): Promise<string> =>
  getApiData(client.get<ApiResponse<string>>(`/containers/${id}/logs`));

export const fetchConfigFiles = async (): Promise<ConfigFileSummary[]> =>
  getApiData(client.get<ApiResponse<ConfigFileSummary[]>>("/config-files"));

export const checkForUpdate = async (): Promise<UpdateStatus> =>
  getApiData(client.get<ApiResponse<UpdateStatus>>("/update/check"));

export const performUpdate = async (): Promise<UpdateResult> =>
  getApiData(client.post<ApiResponse<UpdateResult>>("/update/perform"));

export const deleteConfigFile = async (path: string): Promise<void> => {
  await getApiData(client.delete<ApiResponse<{ message: string }>>("/config-files/content", {
    params: { path },
  }));
};

export const openContainerLogStream = (
  id: string,
  onMessage: (line: string) => void,
  onError: (error: string) => void,
): EventSource => {
  const source = new EventSource(`/api/containers/${encodeURIComponent(id)}/logs?stream=true`);

  source.onmessage = (event) => {
    onMessage(event.data);
  };

  source.onerror = () => {
    onError("Log stream disconnected");
    source.close();
  };

  return source;
};

export const fetchConfigFileContent = async (configPath: string): Promise<ConfigFileContent> =>
  getApiData(
    client.get<ApiResponse<ConfigFileContent>>("/config-files/content", {
      params: { path: configPath },
    }),
  );

export const saveConfigFileContent = async (payload: ConfigFileContent): Promise<ConfigFileContent> =>
  getApiData(client.post<ApiResponse<ConfigFileContent>>("/config-files/content", payload));
